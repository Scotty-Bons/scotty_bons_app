# Quick Spec: Product Out of Stock

## Overview
Allow **admin** and **commissary** users to mark products as "out of stock." Out-of-stock products remain visible in the catalog and new order screens for all users (including store) but display an **"Out of Stock"** badge and cannot be added to orders.

## Scope
- **In scope:** New `in_stock` boolean column on `products` table, toggle action for admin/commissary, visual badge on all product-listing surfaces, blocking add-to-cart for out-of-stock products
- **Out of scope:** Per-modifier stock tracking, per-store stock levels, automatic stock management, stock quantity tracking, notifications when stock changes

## Design Decisions
- Use a new `in_stock` boolean (default `true`) rather than repurposing `active`. The `active` field means "soft-deleted" — an inactive product is hidden everywhere. `in_stock` means "visible but not orderable."
- Commissary users currently get redirected away from the products page. A new server action will allow them to toggle stock status without needing catalog admin access — they'll toggle stock from the **orders page** or via a dedicated lightweight endpoint. However, the simplest MVP is to give commissary users read + stock-toggle access to the products page.
- The order creation RPC must reject out-of-stock products to enforce the constraint server-side.

## Database Migration

### New column
```sql
ALTER TABLE products ADD COLUMN in_stock boolean NOT NULL DEFAULT true;
CREATE INDEX idx_products_in_stock ON products(in_stock) WHERE in_stock = false;
```

### RLS policy update
Commissary users need SELECT access to products (currently only admin + store):
```sql
DROP POLICY "products_select_admin_store" ON products;
CREATE POLICY "products_select_all_roles" ON products FOR SELECT
  USING (auth_role() IN ('admin', 'commissary', 'store'));
```

New UPDATE policy for stock toggle (admin + commissary):
```sql
CREATE POLICY "products_update_stock_admin_commissary" ON products FOR UPDATE
  USING (auth_role() IN ('admin', 'commissary'))
  WITH CHECK (auth_role() IN ('admin', 'commissary'));
```

Note: The existing admin-only UPDATE policy already covers admins. The new policy adds commissary. If there's a single existing UPDATE policy for admin, either broaden it or add a second one. Ensure the policy only allows commissary to update `in_stock` — this can be enforced at the application layer (server action) since RLS column-level restrictions aren't native to Postgres.

### Order RPC update
In the `create_order_with_items` function, add a stock check alongside the existing `active = true` check:
```sql
-- Change line: AND p.active = true
-- To: AND p.active = true AND p.in_stock = true
```
Error message: `'Product is out of stock: %', v_item->>'modifier_id'`

## Target Files

| File | What changes |
|------|-------------|
| `supabase/migrations/TIMESTAMP_add_product_in_stock.sql` | New migration: add `in_stock` column, update RLS, update order RPC |
| `lib/types/index.ts` | Add `in_stock: boolean` to `ProductRow` |
| `app/(dashboard)/products/page.tsx` | Remove commissary redirect, fetch `in_stock` field, pass `userRole` to components |
| `app/(dashboard)/products/actions.ts` | Add `toggleProductStock` server action (admin + commissary), add `verifyAdminOrCommissary` helper |
| `components/products/catalog-admin.tsx` | Add stock toggle button in product dropdown menu, show badge |
| `components/products/catalog-browser.tsx` | Show "Out of Stock" badge on out-of-stock products |
| `components/orders/new-order-cart.tsx` | Show badge, disable "Add" button for out-of-stock modifiers |

## Implementation Details

### 1. Migration (`supabase/migrations/TIMESTAMP_add_product_in_stock.sql`)
- Add `in_stock` boolean column with default `true`
- Add index on `in_stock = false`
- Update SELECT RLS to include commissary
- Add UPDATE policy for admin + commissary
- Replace the `create_order_with_items` function with stock check added

### 2. Types (`lib/types/index.ts`)
```typescript
export type ProductRow = {
  id: string;
  name: string;
  category_id: string;
  category_name?: string;
  image_url?: string | null;
  sort_order: number;
  in_stock: boolean;  // NEW
  modifiers: ProductModifierRow[];
};
```

### 3. Products page (`app/(dashboard)/products/page.tsx`)
- Remove line `if (profile?.role === "commissary") redirect("/orders");`
- Add `in_stock` to the product select query: `.select("id, name, category_id, image_url, sort_order, in_stock, product_modifiers(...)")`
- Map `in_stock` into `ProductRow`
- Determine view: admin sees `CatalogAdmin`, commissary sees `CatalogBrowser` with stock toggle capability, store sees `CatalogBrowser` read-only
- Pass `userRole` prop to components so they can conditionally show toggle controls

### 4. Server action (`app/(dashboard)/products/actions.ts`)
```typescript
async function verifyAdminOrCommissary() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("user_id", user.id).single();
  return (profile?.role === "admin" || profile?.role === "commissary") ? supabase : null;
}

export async function toggleProductStock(
  productId: string
): Promise<ActionResult<null>> {
  const idParsed = idSchema.safeParse(productId);
  if (!idParsed.success) return { data: null, error: "Invalid product ID." };

  const supabase = await verifyAdminOrCommissary();
  if (!supabase) return { data: null, error: "Unauthorized." };

  // Get current stock status
  const { data: product } = await supabase
    .from("products").select("in_stock").eq("id", productId).eq("active", true).single();
  if (!product) return { data: null, error: "Product not found." };

  const { error } = await supabase
    .from("products").update({ in_stock: !product.in_stock }).eq("id", productId);
  if (error) return { data: null, error: "Failed to update stock status." };

  return { data: null, error: null };
}
```

### 5. Catalog Admin (`components/products/catalog-admin.tsx`)
- Add "Mark Out of Stock" / "Mark In Stock" option to the product dropdown menu (between Edit and Delete)
- Use `PackageX` or `PackageCheck` icons from lucide-react
- Show a small badge next to product name when `in_stock === false`:
```tsx
{!product.in_stock && (
  <span className="ml-1.5 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
    Out of Stock
  </span>
)}
```
- Call `toggleProductStock` action with `useTransition` + `router.refresh()`

### 6. Catalog Browser (`components/products/catalog-browser.tsx`)
- Accept optional `userRole` prop
- Show "Out of Stock" badge next to product name when `in_stock === false`
- If `userRole` is `"commissary"`, show a toggle button (small icon button) to toggle stock status
- Apply `opacity-60` to out-of-stock product rows for visual distinction

### 7. New Order Cart (`components/orders/new-order-cart.tsx`)
- Show "Out of Stock" badge next to product name for out-of-stock products
- Disable the "Add" button for out-of-stock product modifiers (replace with disabled badge or greyed-out button)
- Apply `opacity-60` to out-of-stock rows
- If a product becomes out-of-stock while items are in cart, existing cart items remain (cart is client-side state) but submission will fail at RPC level with a clear error

### Badge Component (inline, no new file needed)
Consistent badge across all three components:
```tsx
const OutOfStockBadge = () => (
  <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
    Out of Stock
  </span>
);
```

## Acceptance Criteria
- [ ] New `in_stock` column exists with default `true`
- [ ] Admin can toggle product stock status from catalog admin dropdown menu
- [ ] Commissary can access products page and toggle stock status
- [ ] Store users see "Out of Stock" badge but cannot toggle
- [ ] Out-of-stock products are visible in catalog browser with badge and reduced opacity
- [ ] Out-of-stock products are visible in new order screen with badge and disabled "Add" button
- [ ] Order RPC rejects orders containing out-of-stock products
- [ ] Toggling stock status refreshes the page to reflect changes
- [ ] Existing `active` (soft-delete) behavior is unchanged

## Dependencies
- No new packages needed
- Uses existing `lucide-react` icons (`PackageX`, `PackageCheck`)
- Uses existing `Badge` or inline span styling
