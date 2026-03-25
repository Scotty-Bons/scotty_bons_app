# Quick Spec: Incremental Order Numbers

## Change Summary

Add an incremental, human-readable `order_number` to orders (format: `ORD-2026-0001`), replacing the truncated UUID display (`a1b2c3d4`) across the entire UI. Follows the same pattern already used by `invoice_number` (`INV-2026-0001`).

## Current State

- Orders use UUID `id` as the only identifier
- Displayed everywhere as `Order #{id.slice(0, 8)}` (e.g., "Order #a1b2c3d4")
- Invoice already has `invoice_number` with `INV-YYYY-NNNN` format via a counter table + SECURITY DEFINER RPC

## Target State

- Orders have an `order_number` column with format `ORD-YYYY-NNNN`
- Generated atomically inside `create_order_with_items` RPC (same pattern as invoice)
- All UI displays `order_number` instead of truncated UUID
- Email notifications use `order_number`

## Database Changes

### Migration: `20260325200000_add_order_numbers.sql`

```sql
-- 1. Add order_number column (nullable initially for backfill)
ALTER TABLE orders ADD COLUMN order_number text;

-- 2. Create counter table (same pattern as invoice_number_counters)
CREATE TABLE IF NOT EXISTS order_number_counters (
  year    integer PRIMARY KEY,
  counter integer NOT NULL DEFAULT 0
);
ALTER TABLE order_number_counters ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — only SECURITY DEFINER functions access this

-- 3. Backfill existing orders with sequential numbers based on created_at
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
  -- Seed counters
  INSERT INTO order_number_counters (year, counter)
  SELECT EXTRACT(YEAR FROM created_at)::integer, COUNT(*)
  FROM orders GROUP BY 1
  ON CONFLICT (year) DO UPDATE SET counter = EXCLUDED.counter;
END $$;

-- 4. Make NOT NULL + UNIQUE after backfill
ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);

-- 5. Update create_order_with_items to generate order_number
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

  -- Generate order number (atomic counter)
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
```

## Type Changes

### `lib/types/index.ts`

Add `order_number` to `OrderRow`:

```typescript
export type OrderRow = {
  id: string;
  order_number: string;  // NEW
  store_id: string;
  // ... rest unchanged
};
```

## UI Changes (replace `id.slice(0,8)` → `order_number`)

| File | What to change |
|------|----------------|
| `app/(dashboard)/dashboard/page.tsx` | Fetch `order_number`, display it in recent orders |
| `app/(dashboard)/orders/page.tsx` | Pass `order_number` through to list component |
| `components/orders/order-list-with-selection.tsx` | Display `order_number` instead of `id.slice(0,8)` |
| `app/(dashboard)/orders/[order-id]/page.tsx` | Display `order_number` in breadcrumb and header |
| `app/(dashboard)/orders/[order-id]/edit/page.tsx` | Display `order_number` in breadcrumb |
| `lib/pdf/generate-order-pdf.ts` | Use `order_number` in PDF |
| `components/orders/export-order-pdf-button.tsx` | Pass `order_number`, use in filename |
| `lib/email/order-notifications.ts` | Use `order_number` instead of `orderId.slice(0,8)` |

## Scope

- **In scope:** DB migration, RPC update, type update, all UI/email references
- **Out of scope:** Changing the URL scheme (routes still use UUID `id` for security)
- **No new packages needed**

## Risks

- Backfill assigns numbers chronologically — existing orders get stable numbers
- Advisory lock on counter ensures no duplicates under concurrency
- Routes remain UUID-based (`/orders/{uuid}`) — `order_number` is display-only
