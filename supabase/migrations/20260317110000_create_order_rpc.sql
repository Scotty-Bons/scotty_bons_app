-- Migration: create_order_rpc
-- Atomic order creation with server-side price lookup.
-- Fixes: client-sent prices trusted (security), non-atomic insert (reliability).
-- Depends on: create_orders (orders, order_items tables must exist)

-- ── RPC: create_order_with_items ────────────────────────────────────────────
-- Takes only product_id + quantity from client.
-- Looks up current name, unit_of_measure, price from products table (snapshot).
-- Inserts order + items in a single transaction — no orphaned orders possible.

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_items jsonb -- [{"product_id": "uuid-string", "quantity": 1}, ...]
)
RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_store_id uuid;
  v_user_id uuid;
  v_role user_role;
  v_item jsonb;
  v_product record;
  v_quantity integer;
BEGIN
  -- ── Auth checks ───────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, store_id INTO v_role, v_store_id
  FROM profiles WHERE user_id = v_user_id;

  IF v_role != 'store' OR v_store_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: only store users can create orders';
  END IF;

  -- ── Validate items ────────────────────────────────────────────────────────
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- ── Insert order ──────────────────────────────────────────────────────────
  INSERT INTO orders (store_id, submitted_by, status)
  VALUES (v_store_id, v_user_id, 'submitted')
  RETURNING id INTO v_order_id;

  -- ── Insert items with server-side price/name snapshot ─────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    SELECT id, name, price, unit_of_measure INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

    IF v_product.id IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    INSERT INTO order_items (order_id, product_id, product_name, unit_of_measure, unit_price, quantity)
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.unit_of_measure,
      v_product.price,
      v_quantity
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
