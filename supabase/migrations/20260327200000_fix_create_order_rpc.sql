-- Migration: fix_create_order_rpc
-- Fixes create_order_with_items broken by the product soft-delete migration:
-- 1. Restores role auth check (only store users can create orders)
-- 2. Uses advisory lock + order_number_counters for race-safe order numbers
-- 3. Keeps active=true filter for soft-deleted products
-- 4. Drops the old single-arg overload left behind by CREATE OR REPLACE

-- Drop the old single-arg overload that may still exist in pg_proc
DROP FUNCTION IF EXISTS create_order_with_items(jsonb);

-- Recreate the correct two-arg version
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
  v_product record;
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

  -- Ensure the store_id matches the user's assigned store
  IF v_user_store_id != p_store_id THEN
    RAISE EXCEPTION 'Unauthorized: store mismatch';
  END IF;

  -- Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- Generate order number (atomic counter with advisory lock)
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

  -- Insert items with server-side price/name snapshot (only active products)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    SELECT id, name, price, modifier INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid
      AND active = true;

    IF v_product.id IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    INSERT INTO order_items (order_id, product_id, product_name, modifier, unit_price, quantity)
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.modifier,
      v_product.price,
      v_quantity
    );
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
