-- Migration: add_product_in_stock
-- Adds in_stock boolean to products so admin/commissary can mark items out of stock.
-- Out-of-stock products remain visible but cannot be added to orders.

-- 1. Add in_stock column (default true — all existing products are in stock)
ALTER TABLE products ADD COLUMN in_stock boolean NOT NULL DEFAULT true;

-- Partial index: only index out-of-stock rows (small subset)
CREATE INDEX idx_products_in_stock ON products(in_stock) WHERE in_stock = false;

-- 2. Update SELECT RLS to include commissary
DROP POLICY "products_select_admin_store" ON products;
CREATE POLICY "products_select_all_roles" ON products FOR SELECT
  USING (auth_role() IN ('admin', 'commissary', 'store'));

-- 3. Allow commissary to UPDATE products (for stock toggle — enforced at app layer)
CREATE POLICY "products_update_commissary" ON products FOR UPDATE
  USING (auth_role() = 'commissary')
  WITH CHECK (auth_role() = 'commissary');

-- 4. Update create_order_with_items to reject out-of-stock products
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
BEGIN
  -- Auth checks
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, store_id INTO v_role, v_user_store_id
  FROM profiles WHERE user_id = v_user_id;

  IF v_role != 'store' OR v_user_store_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: only store users can create orders';
  END IF;

  IF v_user_store_id != p_store_id THEN
    RAISE EXCEPTION 'Unauthorized: store mismatch';
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

  -- Insert order
  INSERT INTO orders (store_id, submitted_by, status, order_number)
  VALUES (p_store_id, v_user_id, 'submitted', v_order_number)
  RETURNING id INTO v_order_id;

  -- Insert items — look up from product_modifiers joined with products
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

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
