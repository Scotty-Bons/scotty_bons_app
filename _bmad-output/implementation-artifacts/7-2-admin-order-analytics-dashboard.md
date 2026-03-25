# Story 7.2: Admin — Order Analytics Dashboard

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to see an analytics section on the dashboard with order trends and revenue insights,
so that I can understand ordering patterns, identify top-performing stores, and track financial metrics over time.

## Acceptance Criteria

1. **Given** an Admin navigates to `/dashboard`,
   **When** the page loads,
   **Then** an "Order Analytics" section is displayed (after the existing orders summary and compliance sections) showing period-based metrics.

2. **Given** orders exist in the system,
   **When** the analytics section renders,
   **Then** a "Monthly Summary" table shows the last 6 months with columns: Month, Order Count, Total Revenue, Average Order Value — sorted most recent first.

3. **Given** fulfilled orders exist with invoices,
   **When** the analytics section renders,
   **Then** a "Top Stores by Revenue" list shows the top 5 stores ranked by total invoice `grand_total`, displaying: Store Name, Order Count, Total Revenue.

4. **Given** orders exist in the system,
   **When** the analytics section renders,
   **Then** a "Popular Products" list shows the top 10 products by total quantity ordered across all orders, displaying: Product Name, Modifier, Total Quantity.

5. **Given** no orders exist,
   **When** the analytics section renders,
   **Then** an empty state message "No order data available yet." is shown.

6. **Given** the monthly summary table has data,
   **When** displayed,
   **Then** revenue values use `formatPrice()` and months use `Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long" })`.

7. **Given** a Store or Commissary user navigates to `/dashboard`,
   **When** the page loads,
   **Then** they are redirected to `/orders` (existing behavior unchanged).

## Tasks / Subtasks

- [ ] Task 1 — Extend dashboard with analytics data fetching (AC: #1, #2, #3, #4, #5)
  - [ ] In `app/(dashboard)/dashboard/page.tsx`, add to the `Promise.all` block:
    - Fetch all `order_items` (already fetched — reuse `itemsResult`)
    - Fetch invoices: `supabase.from("invoices").select("id, store_id, grand_total, created_at")`
  - [ ] Compute monthly aggregates from orders: group by year-month, count orders, sum totals
  - [ ] Compute top stores by total invoice `grand_total`
  - [ ] Compute popular products by total quantity from `order_items`

- [ ] Task 2 — Monthly Summary table (AC: #2, #6)
  - [ ] Create a Card with "Monthly Summary" heading
  - [ ] Render a table with columns: Month, Orders, Revenue, Avg Order Value
  - [ ] Show last 6 months only, sorted most recent first
  - [ ] Format month names with `Intl.DateTimeFormat`
  - [ ] Format revenue with `formatPrice()`

- [ ] Task 3 — Top Stores by Revenue (AC: #3)
  - [ ] Create a Card with "Top Stores by Revenue" heading
  - [ ] Render top 5 stores by total `grand_total` from invoices
  - [ ] Each row shows: rank, store name, order count, total revenue

- [ ] Task 4 — Popular Products (AC: #4)
  - [ ] Create a Card with "Popular Products" heading
  - [ ] Aggregate `order_items` by `product_name` + `modifier`, sum quantities
  - [ ] Show top 10 sorted by total quantity descending
  - [ ] Each row shows: rank, product name, modifier, total quantity

- [ ] Task 5 — Empty state handling (AC: #5)
  - [ ] If no orders exist, show a single Card with "No order data available yet."

- [ ] Task 6 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { OrderStatus } from "@/lib/types"
CN utility:              import { cn } from "@/lib/utils"
formatPrice:             import { formatPrice } from "@/lib/utils"
UI components:           Card, CardContent, CardHeader, CardTitle from @/components/ui/*
Icons:                   TrendingUp, Store, ShoppingBasket from lucide-react
Date formatting:         new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "long" })
```

## Dev Notes

### Implementation Approach

Like Story 7-1, this extends `app/(dashboard)/dashboard/page.tsx`. No new pages or components needed.

### Monthly Aggregation

```typescript
// Group orders by year-month
const monthlyData: Record<string, { count: number; total: number }> = {};
for (const order of orders) {
  const date = new Date(order.created_at);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const existing = monthlyData[key] ?? { count: 0, total: 0 };
  existing.count++;
  existing.total += orderTotals[order.id] ?? 0;
  monthlyData[key] = existing;
}

// Sort by key descending (most recent first), take last 6
const monthlySorted = Object.entries(monthlyData)
  .sort(([a], [b]) => b.localeCompare(a))
  .slice(0, 6);
```

### Top Stores from Invoices

```typescript
const storeRevenue: Record<string, { count: number; total: number }> = {};
for (const invoice of invoicesData) {
  const existing = storeRevenue[invoice.store_id] ?? { count: 0, total: 0 };
  existing.count++;
  existing.total += Number(invoice.grand_total);
  storeRevenue[invoice.store_id] = existing;
}

const topStores = Object.entries(storeRevenue)
  .sort(([, a], [, b]) => b.total - a.total)
  .slice(0, 5);
```

### Popular Products

```typescript
const productQty: Record<string, { name: string; modifier: string; total: number }> = {};
for (const item of items) {
  const key = `${item.product_name}|${item.modifier}`;
  const existing = productQty[key] ?? { name: item.product_name, modifier: item.modifier, total: 0 };
  existing.total += item.quantity;
  productQty[key] = existing;
}

const topProducts = Object.values(productQty)
  .sort((a, b) => b.total - a.total)
  .slice(0, 10);
```

**Note:** `items` from `order_items` need `product_name` and `modifier` columns. Update the existing fetch to include these:

```typescript
supabase.from("order_items").select("order_id, product_name, modifier, unit_price, quantity"),
```

### Anti-Patterns — NEVER DO

- `select('*')` in application code — always select specific columns
- Install chart/visualization libraries — use simple HTML tables and lists
- Create separate analytics page — this is part of the existing dashboard
- Use `date-fns` — use `Intl.DateTimeFormat` (NOT installed)
- Fetch data in client components — Server Component only

## Project Structure Notes

**Files to MODIFY:**

```
app/(dashboard)/dashboard/page.tsx     — Add analytics section, update order_items fetch to include product_name and modifier
```

**Files NOT to touch:**
- No new files or migrations needed
- No new components — all in the Server Component page

## Architecture Compliance

**D5 — RLS Policy Design:** Admin-only page; RLS allows admin to SELECT all orders, order_items, and invoices.

**D7 — Server Actions:** No new server actions — read-only Server Component.

## Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin navigates to Dashboard — analytics section visible below compliance
- Manual: Monthly Summary shows correct counts and revenue for last 6 months
- Manual: Top Stores shows top 5 by total invoice revenue
- Manual: Popular Products shows top 10 by quantity
- Manual: With no orders, empty state message shown
- Manual: Store/Commissary users still redirected to /orders

## Previous Story Intelligence

1. **Story 7-1 extends the same page** — implement 7-1 first, then 7-2 adds below it.
2. **`order_items` already fetched** — the dashboard currently fetches `order_id, unit_price, quantity`. Need to add `product_name, modifier` to the select.
3. **`formatPrice()` exists** in `lib/utils`.
4. **Invoice data is new to dashboard** — add invoice fetch to the existing `Promise.all`.
5. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat`.

## Git Intelligence

Recommended commit message:
```
feat: story 7-2 — admin order analytics dashboard with monthly trends and top stores
```

## References

- [Source: app/(dashboard)/dashboard/page.tsx] Existing dashboard with order metrics
- [Source: lib/utils.ts] formatPrice utility
- [Source: lib/types/index.ts] InvoiceRow, OrderItemRow types
- [Source: memory/feedback_ui_language.md] UI must be in English
