-- Migration: product_stock_quantity
-- Adds optional inventory tracking on products. When stock_quantity is NULL the
-- product accepts any order quantity (current behavior). When it is set, orders
-- are limited by it: stock is decremented on order creation and restored when
-- the order is declined or soft-deleted (if it had not been fulfilled yet).

-- ── Columns ────────────────────────────────────────────────────────────────────

ALTER TABLE products ADD COLUMN stock_quantity integer;
ALTER TABLE products ADD CONSTRAINT products_stock_quantity_nonneg
  CHECK (stock_quantity IS NULL OR stock_quantity >= 0);

-- stock_returned guards against double-restoration (e.g. status moved to
-- declined and then the order was also soft-deleted).
ALTER TABLE orders ADD COLUMN stock_returned boolean NOT NULL DEFAULT false;

-- ── create_order_with_items: stock-aware, supports admin role ─────────────────

DROP FUNCTION IF EXISTS create_order_with_items(uuid, jsonb);

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_store_id uuid,
  p_items jsonb
)
RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_user_id uuid;
  v_role user_role;
  v_user_store_id uuid;
  v_item jsonb;
  v_modifier record;
  v_quantity integer;
  v_year integer;
  v_counter integer;
  v_order_number text;
  v_product_id uuid;
  v_qty_for_product integer;
  v_current_stock integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, store_id INTO v_role, v_user_store_id
  FROM profiles WHERE user_id = v_user_id;

  IF v_role NOT IN ('store', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_role = 'store' THEN
    IF v_user_store_id IS NULL OR v_user_store_id != p_store_id THEN
      RAISE EXCEPTION 'Unauthorized: store mismatch';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id) THEN
      RAISE EXCEPTION 'Store not found';
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- Generate order number
  v_year := EXTRACT(YEAR FROM now())::integer;
  PERFORM pg_advisory_xact_lock(hashtext('order_number'), v_year);

  INSERT INTO order_number_counters (year, counter)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET counter = order_number_counters.counter + 1
  RETURNING counter INTO v_counter;

  v_order_number := 'ORD-' || v_year || '-' || LPAD(v_counter::text, 4, '0');

  INSERT INTO orders (store_id, submitted_by, status, order_number)
  VALUES (p_store_id, v_user_id, 'submitted', v_order_number)
  RETURNING id INTO v_order_id;

  -- Insert items first, validating modifier + product status.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    SELECT pm.id, pm.label, pm.price, p.id AS product_id, p.name AS product_name, p.in_stock
    INTO v_modifier
    FROM product_modifiers pm
    JOIN products p ON pm.product_id = p.id
    WHERE pm.id = (v_item->>'modifier_id')::uuid
      AND p.active = true;

    IF v_modifier.id IS NULL THEN
      RAISE EXCEPTION 'Modifier not found or product inactive: %', v_item->>'modifier_id';
    END IF;

    IF v_modifier.in_stock = false THEN
      RAISE EXCEPTION 'Product is out of stock: %', v_modifier.product_name;
    END IF;

    INSERT INTO order_items (order_id, product_id, product_name, modifier, unit_price, quantity)
    VALUES (
      v_order_id,
      v_modifier.product_id,
      v_modifier.product_name,
      v_modifier.label,
      v_modifier.price,
      v_quantity
    );
  END LOOP;

  -- Stock decrement: aggregate by product, lock each product row, validate
  -- and subtract. Iterating in a deterministic order avoids deadlocks.
  FOR v_product_id, v_qty_for_product IN
    SELECT product_id, SUM(quantity)::integer
    FROM order_items
    WHERE order_id = v_order_id
    GROUP BY product_id
    ORDER BY product_id
  LOOP
    SELECT stock_quantity INTO v_current_stock
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      CONTINUE; -- untracked: accept any quantity
    END IF;

    IF v_current_stock < v_qty_for_product THEN
      RAISE EXCEPTION 'Insufficient stock for product %: requested %, available %',
        v_product_id, v_qty_for_product, v_current_stock;
    END IF;

    UPDATE products
    SET stock_quantity = stock_quantity - v_qty_for_product
    WHERE id = v_product_id;
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ── Helper: apply per-product stock deltas atomically ────────────────────────
-- Used by order-edit flow to reconcile stock when item quantities change.
-- p_changes is a JSON array of {product_id, delta}. Positive delta consumes
-- stock (validated against available); negative delta restores stock.
-- Untracked products (stock_quantity IS NULL) are skipped.

CREATE OR REPLACE FUNCTION adjust_stock_by_delta(p_changes jsonb)
RETURNS void AS $$
DECLARE
  v_product_id uuid;
  v_delta integer;
  v_current integer;
BEGIN
  IF p_changes IS NULL OR jsonb_array_length(p_changes) = 0 THEN
    RETURN;
  END IF;

  FOR v_product_id, v_delta IN
    SELECT (c->>'product_id')::uuid, (c->>'delta')::integer
    FROM jsonb_array_elements(p_changes) c
    WHERE (c->>'delta')::integer != 0
    ORDER BY (c->>'product_id')::uuid
  LOOP
    SELECT stock_quantity INTO v_current
    FROM products
    WHERE id = v_product_id
    FOR UPDATE;

    IF v_current IS NULL THEN
      CONTINUE;
    END IF;

    IF v_delta > 0 AND v_current < v_delta THEN
      RAISE EXCEPTION 'Insufficient stock for product %: required %, available %',
        v_product_id, v_delta, v_current;
    END IF;

    UPDATE products
    SET stock_quantity = stock_quantity - v_delta
    WHERE id = v_product_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ── Trigger: restore stock on decline or soft-delete (if not fulfilled) ───────

CREATE OR REPLACE FUNCTION return_order_stock_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_should_return boolean := false;
BEGIN
  IF NEW.stock_returned THEN
    RETURN NEW;
  END IF;

  -- Status transitioned to declined
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'declined' THEN
    v_should_return := true;
  END IF;

  -- Order soft-deleted (cancellation), and was not already fulfilled
  IF OLD.deleted_at IS NULL
     AND NEW.deleted_at IS NOT NULL
     AND NEW.status != 'fulfilled' THEN
    v_should_return := true;
  END IF;

  IF NOT v_should_return THEN
    RETURN NEW;
  END IF;

  UPDATE products p
  SET stock_quantity = p.stock_quantity + agg.qty
  FROM (
    SELECT product_id, SUM(quantity)::integer AS qty
    FROM order_items
    WHERE order_id = NEW.id
    GROUP BY product_id
  ) agg
  WHERE agg.product_id = p.id
    AND p.stock_quantity IS NOT NULL;

  NEW.stock_returned := true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_return_order_stock
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION return_order_stock_trigger();
