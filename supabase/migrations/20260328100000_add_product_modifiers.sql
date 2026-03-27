-- Migration: add_product_modifiers
-- Allows each product to have multiple modifiers, each with its own price.
-- E.g., "Blue T-Shirt" → Small $10, Medium $12, Large $15

-- 1. Create product_modifiers table
CREATE TABLE product_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_modifiers_product_id ON product_modifiers(product_id);
ALTER TABLE product_modifiers ADD CONSTRAINT uq_product_modifier_label UNIQUE (product_id, label);

-- 2. RLS policies
ALTER TABLE product_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view modifiers"
  ON product_modifiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage modifiers"
  ON product_modifiers FOR ALL
  TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

-- 3. Migrate existing data: one modifier per product from current columns
INSERT INTO product_modifiers (product_id, label, price, sort_order)
SELECT id, modifier, price, 0 FROM products;

-- 4. Drop old columns from products
ALTER TABLE products DROP COLUMN price;
ALTER TABLE products DROP COLUMN modifier;

-- 5. Recreate create_order_with_items RPC to accept modifier_id
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

    SELECT pm.id, pm.label, pm.price, p.id AS product_id, p.name AS product_name
    INTO v_modifier
    FROM product_modifiers pm
    JOIN products p ON pm.product_id = p.id
    WHERE pm.id = (v_item->>'modifier_id')::uuid
      AND p.active = true;

    IF v_modifier.id IS NULL THEN
      RAISE EXCEPTION 'Modifier not found or product inactive: %', v_item->>'modifier_id';
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
