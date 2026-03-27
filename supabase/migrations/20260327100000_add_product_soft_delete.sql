-- Migration: add_product_soft_delete
-- Adds an "active" column so products can be soft-deleted instead of hard-deleted.
-- This avoids FK violations from order_items referencing the product.
-- Also relaxes the category FK so categories can be deleted (nullifies on soft-deleted products).

ALTER TABLE products ADD COLUMN active boolean NOT NULL DEFAULT true;

-- Index for efficient filtering of active products
CREATE INDEX idx_products_active ON products(active) WHERE active = true;

-- Allow category deletion: set category_id to NULL on products (only matters for inactive ones)
ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE products ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL;

-- Update the create_order_with_items RPC to reject inactive products
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_store_id uuid,
  p_items jsonb
)
RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_product record;
  v_quantity integer;
  v_order_number text;
  v_year text := to_char(now(), 'YYYY');
  v_seq integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stores WHERE id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must have at least one item';
  END IF;

  -- Get next sequence number for this year
  SELECT COALESCE(MAX(
    CASE
      WHEN order_number LIKE 'ORD-' || v_year || '-%'
      THEN CAST(SPLIT_PART(order_number, '-', 3) AS integer)
      ELSE 0
    END
  ), 0) + 1 INTO v_seq
  FROM orders;

  v_order_number := 'ORD-' || v_year || '-' || LPAD(v_seq::text, 4, '0');

  INSERT INTO orders (store_id, submitted_by, status, order_number)
  VALUES (p_store_id, v_user_id, 'submitted', v_order_number)
  RETURNING id INTO v_order_id;

  INSERT INTO order_status_history (order_id, status, changed_by)
  VALUES (v_order_id, 'submitted', v_user_id);

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
