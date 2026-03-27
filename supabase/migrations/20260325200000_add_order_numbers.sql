-- Migration: add_order_numbers
-- Adds incremental order_number (ORD-YYYY-NNNN) to orders.
-- Invoice numbers now derive from order numbers (INV-YYYY-NNNN with same sequence).
-- Backfills existing orders chronologically.

-- ── 1. Add order_number column (nullable for backfill) ────────────────────────

ALTER TABLE orders ADD COLUMN order_number text;

-- ── 2. Create counter table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_number_counters (
  year    integer PRIMARY KEY,
  counter integer NOT NULL DEFAULT 0
);
ALTER TABLE order_number_counters ENABLE ROW LEVEL SECURITY;

-- ── 3. Backfill existing orders with sequential numbers ──────────────────────

DO $$
DECLARE
  r RECORD;
  v_year integer;
  v_counter integer;
  v_last_year integer := 0;
BEGIN
  FOR r IN SELECT id, created_at FROM orders ORDER BY created_at ASC LOOP
    v_year := EXTRACT(YEAR FROM r.created_at)::integer;
    IF v_year != v_last_year THEN
      v_counter := 0;
      v_last_year := v_year;
    END IF;
    v_counter := v_counter + 1;
    UPDATE orders SET order_number = 'ORD-' || v_year || '-' || LPAD(v_counter::text, 4, '0') WHERE id = r.id;
  END LOOP;

  -- Seed counters from actual data
  INSERT INTO order_number_counters (year, counter)
  SELECT EXTRACT(YEAR FROM created_at)::integer, COUNT(*)
  FROM orders GROUP BY 1
  ON CONFLICT (year) DO UPDATE SET counter = EXCLUDED.counter;
END $$;

-- ── 4. Make NOT NULL + UNIQUE ────────────────────────────────────────────────

ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);

-- ── 5. Backfill existing invoices to match their order's number ──────────────

UPDATE invoices i
SET invoice_number = 'INV' || SUBSTRING(o.order_number FROM 4)
FROM orders o
WHERE i.order_id = o.id;

-- ── 6. Update create_order_with_items to generate order_number ───────────────

CREATE OR REPLACE FUNCTION create_order_with_items(
  p_items jsonb
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
  v_year integer;
  v_counter integer;
  v_order_number text;
BEGIN
  -- Auth checks
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, store_id INTO v_role, v_store_id
  FROM profiles WHERE user_id = v_user_id;

  IF v_role != 'store' OR v_store_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: only store users can create orders';
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
  VALUES (v_store_id, v_user_id, 'submitted', v_order_number)
  RETURNING id INTO v_order_id;

  -- Insert items with server-side price/name snapshot
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    SELECT id, name, price, modifier INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::uuid;

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

-- ── 7. Update fulfill_order_with_invoice: derive invoice number from order ───

CREATE OR REPLACE FUNCTION fulfill_order_with_invoice(p_order_id uuid)
RETURNS uuid AS $$
DECLARE
  v_order RECORD;
  v_store RECORD;
  v_invoice_id uuid;
  v_invoice_number text;
  v_subtotal numeric(12,2);
  v_tax_rate numeric(5,4);
  v_tax_amount numeric(12,2);
  v_ad_fee numeric(12,2);
  v_grand_total numeric(12,2);
  v_company_name text;
  v_company_address text;
  v_company_phone text;
  v_postal text;
BEGIN
  -- Auth check: only commissary or admin can fulfill
  IF auth_role() NOT IN ('commissary', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  -- Fetch and validate order (now includes order_number)
  SELECT id, store_id, status, order_number INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.status != 'approved' THEN
    RAISE EXCEPTION 'Only approved orders can be fulfilled.';
  END IF;

  -- Check if invoice already exists for this order (idempotency guard)
  IF EXISTS (SELECT 1 FROM invoices WHERE order_id = p_order_id) THEN
    SELECT id INTO v_invoice_id FROM invoices WHERE order_id = p_order_id;
    RETURN v_invoice_id;
  END IF;

  -- Update order status to fulfilled (with optimistic lock on status)
  UPDATE orders
    SET status = 'fulfilled', fulfilled_at = now(), updated_at = now()
    WHERE id = p_order_id AND status = 'approved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order status changed concurrently.';
  END IF;

  -- Derive invoice number from order number: ORD-2026-0042 → INV-2026-0042
  v_invoice_number := 'INV' || SUBSTRING(v_order.order_number FROM 4);

  -- Fetch financial_settings: commissary info
  SELECT value INTO v_company_name FROM financial_settings WHERE key = 'commissary_name';
  SELECT value INTO v_company_address FROM financial_settings WHERE key = 'commissary_address';
  SELECT value INTO v_company_phone FROM financial_settings WHERE key = 'commissary_phone';
  SELECT value INTO v_postal FROM financial_settings WHERE key = 'commissary_postal_code';

  v_company_name := COALESCE(v_company_name, '');
  v_company_address := COALESCE(v_company_address, '');
  v_company_phone := COALESCE(v_company_phone, '');

  IF v_postal IS NOT NULL AND v_postal != '' THEN
    v_company_address := v_company_address || E'\n' || v_postal;
  END IF;

  -- Fetch HST rate
  SELECT COALESCE(value::numeric / 100, 0) INTO v_tax_rate
    FROM financial_settings WHERE key = 'hst_rate';
  IF v_tax_rate IS NULL THEN
    v_tax_rate := 0;
  END IF;

  -- Fetch ad & royalties fee
  SELECT COALESCE(value::numeric, 0) INTO v_ad_fee
    FROM financial_settings WHERE key = 'ad_royalties_fee';
  IF v_ad_fee IS NULL THEN
    v_ad_fee := 0;
  END IF;

  -- Fetch store info (name + billing details)
  SELECT name, business_name, address, postal_code, phone, email
    INTO v_store FROM stores WHERE id = v_order.store_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store not found.';
  END IF;

  -- Calculate subtotal from order items
  SELECT COALESCE(SUM(unit_price * quantity), 0) INTO v_subtotal
    FROM order_items WHERE order_id = p_order_id;

  -- Calculate tax on subtotal only, then add ad fee
  v_tax_amount := ROUND(v_subtotal * v_tax_rate, 2);
  v_grand_total := v_subtotal + v_tax_amount + v_ad_fee;

  -- Insert invoice with commissary (From) and store (Bill To) info
  INSERT INTO invoices (
    order_id, invoice_number, store_id, store_name,
    store_business_name, store_address, store_postal_code, store_phone, store_email,
    company_name, company_address, company_tax_id,
    subtotal, tax_rate, tax_amount, ad_royalties_fee, grand_total
  ) VALUES (
    p_order_id, v_invoice_number, v_order.store_id, v_store.name,
    COALESCE(v_store.business_name, ''), COALESCE(v_store.address, ''),
    COALESCE(v_store.postal_code, ''), COALESCE(v_store.phone, ''), COALESCE(v_store.email, ''),
    v_company_name, v_company_address, v_company_phone,
    v_subtotal, v_tax_rate, v_tax_amount, v_ad_fee, v_grand_total
  ) RETURNING id INTO v_invoice_id;

  -- Copy order items into invoice items
  INSERT INTO invoice_items (invoice_id, product_name, modifier, unit_price, quantity, line_total)
    SELECT v_invoice_id, product_name, modifier, unit_price, quantity,
           ROUND(unit_price * quantity, 2)
    FROM order_items WHERE order_id = p_order_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
