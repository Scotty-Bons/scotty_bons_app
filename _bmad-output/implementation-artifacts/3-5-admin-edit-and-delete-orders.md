# Story 3.5: Admin — Delete Orders (Soft Delete)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to delete an order that is still in a non-terminal status,
so that I can remove erroneous or duplicate orders from the system before they progress further in the lifecycle.

## Acceptance Criteria

1. **Given** an Admin views an order detail page,
   **When** the order status is `submitted` or `under_review`,
   **Then** a "Delete Order" button (destructive style) is visible in the order header — it is hidden for terminal statuses (`approved`, `declined`, `fulfilled`).

2. **Given** an Admin clicks "Delete Order",
   **When** the confirmation dialog opens,
   **Then** a clear warning is shown that the action will remove the order from the system, with a "Cancel" and a "Delete Order" confirm button.

3. **Given** an Admin confirms the deletion,
   **When** the action completes successfully,
   **Then** the order's `deleted_at` field is set to the current timestamp (soft delete), a success toast is shown, and the Admin is redirected to `/orders`.

4. **Given** an order has been soft-deleted,
   **When** any user (Admin, Store, Factory) queries the orders list or attempts to load the order detail page,
   **Then** the order is not returned — soft-deleted orders are invisible at the RLS level (`deleted_at IS NULL` enforced in all SELECT policies).

5. **Given** a non-Admin user views any order detail page,
   **When** the page renders,
   **Then** no "Delete Order" button is shown.

6. **Given** the delete action fails (network error or DB error),
   **When** the error is returned,
   **Then** an error toast is displayed and the order is not deleted.

7. **Given** an Admin attempts to delete an order with a terminal status (`approved`, `declined`, `fulfilled`),
   **When** the Server Action runs,
   **Then** the action returns an error and does not modify the order — terminal orders cannot be deleted.

## Tasks / Subtasks

- [ ] Task 1 — DB migration: add `deleted_at` column and update RLS SELECT/UPDATE policies (AC: #4, #7)
  - [ ] Create `supabase/migrations/20260317140000_add_order_soft_delete.sql`
  - [ ] `ALTER TABLE orders ADD COLUMN deleted_at timestamptz;`
  - [ ] Drop and recreate `orders_select_admin`: add `AND deleted_at IS NULL` to USING clause
  - [ ] Drop and recreate `orders_select_store`: add `AND deleted_at IS NULL` to USING clause
  - [ ] Drop and recreate `orders_select_factory`: add `AND deleted_at IS NULL` to USING clause
  - [ ] Drop and recreate `orders_update_admin`: add `AND deleted_at IS NULL` to USING clause (prevent updating a deleted order)
  - [ ] Run `supabase db push` to apply migration to remote (or document as step for dev)
  - [ ] Note: `orders_delete_admin` hard-delete policy already exists from the original migration — leave it untouched (we are not using hard delete, but the policy is harmless)

- [ ] Task 2 — Server Action: `deleteOrder` (AC: #3, #6, #7)
  - [ ] Add `deleteOrder` export to `app/(dashboard)/orders/[order-id]/actions.ts` (same file as `updateOrderStatus`)
  - [ ] Signature: `deleteOrder(orderId: string): Promise<ActionResult<void>>`
  - [ ] Auth check: get user, get profile — return `{ data: null, error: "Unauthorized." }` if not admin
  - [ ] Fetch order: `.from("orders").select("status").eq("id", orderId).single()` — return `{ data: null, error: "Order not found." }` if null
  - [ ] Validate non-terminal: if status is `approved`, `declined`, or `fulfilled` → return `{ data: null, error: "Terminal orders cannot be deleted." }`
  - [ ] Soft delete: `.from("orders").update({ deleted_at: new Date().toISOString() }).eq("id", orderId)`
  - [ ] On success: `revalidatePath("/orders")`; return `{ data: undefined, error: null }`
  - [ ] On error: return `{ data: null, error: "Failed to delete order. Please try again." }`
  - [ ] Note: do NOT call `redirect()` inside the Server Action — let the client component navigate

- [ ] Task 3 — Client Component: `DeleteOrderButton` (AC: #1, #2, #3, #5, #6)
  - [ ] Create `components/orders/delete-order-button.tsx` with `"use client"` directive
  - [ ] Props: `orderId: string`, `currentStatus: OrderStatus`, `role: string`
  - [ ] Render nothing if `role !== "admin"` or `currentStatus` is terminal (`approved`, `declined`, `fulfilled`)
  - [ ] "Delete Order" button (destructive/red variant): on click → open confirmation dialog
  - [ ] Confirmation dialog: use `Dialog` + `DialogContent` from `@/components/ui/dialog`
    - Title: "Delete Order"
    - Body: "This order will be permanently removed from the system. This action cannot be undone."
    - Buttons: "Cancel" (outline), "Delete Order" (destructive/red)
  - [ ] Use `useTransition` for pending state — disable buttons while `isPending === true`
  - [ ] On confirm: call `deleteOrder(orderId)` inside `startTransition`
  - [ ] On success: `toast.success("Order deleted.")` then `router.push("/orders")`
  - [ ] On error: `toast.error(result.error)` and keep dialog open

- [ ] Task 4 — Integrate `DeleteOrderButton` into order detail page (AC: #1, #5)
  - [ ] Update `app/(dashboard)/orders/[order-id]/page.tsx`
  - [ ] Import `DeleteOrderButton` from `@/components/orders/delete-order-button`
  - [ ] Place `<DeleteOrderButton orderId={order.id} currentStatus={status} role={profile.role} />` in the order header row, alongside `<OrderStatusActions>`

- [ ] Task 5 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors
  - [ ] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { OrderStatus, ActionResult } from "@/lib/types"
Status constants:        import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants/order-status"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Button, Dialog, DialogContent from @/components/ui/*
Toast:                   import { toast } from "sonner"
Icons:                   Trash2 from lucide-react
revalidatePath:          import { revalidatePath } from "next/cache"
useRouter:               import { useRouter } from "next/navigation"
useTransition:           import { useTransition } from "react"
Server action pattern:   see app/(dashboard)/orders/[order-id]/actions.ts (updateOrderStatus)
```

## Dev Notes

### Soft Delete Approach

A `deleted_at` column is used instead of hard delete for two reasons:
1. **Auditability** — the data is preserved in the DB for potential recovery or compliance review.
2. **Referential integrity** — `order_items` and `order_status_history` have `ON DELETE CASCADE`, so hard-deleting an order would permanently destroy all child records.

Visibility is enforced at the **RLS layer**, not the application layer. All three SELECT policies for `orders` (admin, store, factory) are updated to include `AND deleted_at IS NULL`. This means no soft-deleted order can ever be returned via the Supabase client, regardless of which query pattern is used.

### Migration Pattern

Follow the same migration style as `20260317100000_create_orders.sql`:

```sql
-- Add soft delete column
ALTER TABLE orders ADD COLUMN deleted_at timestamptz;

-- Update SELECT policies to exclude soft-deleted orders
DROP POLICY IF EXISTS "orders_select_admin" ON orders;
CREATE POLICY "orders_select_admin"
  ON orders FOR SELECT
  USING (auth_role() = 'admin' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "orders_select_store" ON orders;
CREATE POLICY "orders_select_store"
  ON orders FOR SELECT
  USING (auth_role() = 'store' AND store_id = auth_store_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "orders_select_factory" ON orders;
CREATE POLICY "orders_select_factory"
  ON orders FOR SELECT
  USING (auth_role() = 'factory' AND deleted_at IS NULL);

-- Update UPDATE policy to prevent operating on deleted orders
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin"
  ON orders FOR UPDATE
  USING (auth_role() = 'admin' AND deleted_at IS NULL)
  WITH CHECK (auth_role() = 'admin');
```

### Trigger Side-Effects

The `orders_status_change_history` trigger checks `IF NEW.status != OLD.status`. When we soft-delete via `UPDATE orders SET deleted_at = now()`, the status is unchanged, so **no spurious history entry is written**. The `orders_updated_at` trigger (BEFORE UPDATE) will fire and set `updated_at = now()` — this is expected and harmless.

### Server Action Pattern

Follow the exact pattern from `updateOrderStatus` in the same file:

```typescript
export async function deleteOrder(orderId: string): Promise<ActionResult<void>> {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") return { data: null, error: "Unauthorized." };

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (!order) return { data: null, error: "Order not found." };

  const TERMINAL: OrderStatus[] = ["approved", "declined", "fulfilled"];
  if (TERMINAL.includes(order.status as OrderStatus)) {
    return { data: null, error: "Terminal orders cannot be deleted." };
  }

  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) return { data: null, error: "Failed to delete order. Please try again." };

  revalidatePath("/orders");
  return { data: undefined, error: null };
}
```

### Client Component Pattern

```tsx
"use client";

export function DeleteOrderButton({ orderId, currentStatus, role }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const TERMINAL: OrderStatus[] = ["approved", "declined", "fulfilled"];
  if (role !== "admin" || TERMINAL.includes(currentStatus)) return null;

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteOrder(orderId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Order deleted.");
        router.push("/orders");
      }
    });
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4 mr-1.5" />
        Delete Order
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {/* title, warning text, Cancel + Delete Order buttons */}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

### Page Integration — What Changes

Currently `app/(dashboard)/orders/[order-id]/page.tsx` renders the order header as:

```tsx
<div className="flex items-center gap-3">
  <Badge ...>{STATUS_LABELS[status]}</Badge>
  <OrderStatusActions orderId={order.id} currentStatus={status} role={profile.role} />
</div>
```

Add `<DeleteOrderButton>` alongside `<OrderStatusActions>`:

```tsx
<div className="flex items-center gap-3">
  <Badge ...>{STATUS_LABELS[status]}</Badge>
  <OrderStatusActions orderId={order.id} currentStatus={status} role={profile.role} />
  <DeleteOrderButton orderId={order.id} currentStatus={status} role={profile.role} />
</div>
```

### RLS Already in Place — No New Policies for child tables

`order_items` and `order_status_history` child tables do not need RLS updates. They are only queried within the order detail page, which redirects on `!order`. Once an order is soft-deleted, the RLS on `orders` prevents it from being returned, so the detail page will redirect to `/orders` before any child queries are attempted.

### Redirect vs. Refresh

Unlike `updateOrderStatus` (which keeps the user on the detail page via `router.refresh()`), delete sends the user away from the page. The client component calls `router.push("/orders")` after receiving a success result. Do **not** call `redirect()` inside the Server Action — keep the same `ActionResult<void>` return pattern.

### Architecture Compliance

**D7 — Server Actions:** `deleteOrder` follows the established Server Action pattern: auth check → role check → business rule validation → DB mutation → revalidate → return `ActionResult`.

**D5 — RLS:** Soft delete is enforced at the RLS layer. No application-layer filtering needed. No `service_role` key.

**Anti-Patterns — NEVER DO:**
- Hard delete via `.delete()` — use `.update({ deleted_at: ... })` instead
- Filter `deleted_at IS NULL` in application queries — RLS handles this; application-layer filters are fragile
- Call `redirect()` inside the Server Action — return `ActionResult`, let the client navigate
- Trust the `currentStatus` prop from the client — always re-validate status on the server before mutating
- Forget to handle the terminal-status guard on the server — the button being hidden client-side is not sufficient

### Library & Framework Requirements

**Already installed — no new packages needed:**

| Package | Purpose | Notes |
|---------|---------|-------|
| shadcn/ui `Dialog` | Confirmation dialog | Already used in `order-status-actions.tsx` |
| shadcn/ui `Button` | Delete button (destructive variant) | Already available |
| `sonner` | Toast notifications | Already installed |
| `lucide-react` | `Trash2` icon | Already installed |

**No new packages to install.**

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin views `submitted` order → "Delete Order" button is visible
- Manual: Admin views `approved` order → "Delete Order" button is NOT visible
- Manual: Admin clicks "Delete Order" → confirmation dialog opens; clicking "Cancel" closes it without effect
- Manual: Admin confirms deletion → success toast, redirected to `/orders`, deleted order no longer appears in the list
- Manual: Deleted order URL (`/orders/[id]`) → redirects to `/orders` (order not found via RLS)
- Manual: Store User views order detail → no "Delete Order" button
- Manual: Factory User views order detail → no "Delete Order" button
- Manual: Error case → `toast.error` shown, order not deleted

### Previous Story Intelligence (from Stories 3-1 through 3-4)

1. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat("en-CA", ...)` for all date formatting.
2. **Server Action: do NOT call `redirect()` inside** — return `ActionResult`, let the Client Component handle navigation.
3. **`ActionResult<void>` pattern** — return `{ data: undefined, error: null }` for success (not `{ data: null, error: null }`).
4. **RLS is the enforcement layer** — role check in the Server Action is defense-in-depth.
5. **UI Language is English** — all button labels, dialog text, toast messages in English.
6. **`useTransition` for pending state** — disable all interactive elements while `isPending === true`.
7. **`lib/supabase/client.ts` already exists** — `DeleteOrderButton` calls a Server Action, it does NOT need a direct Supabase client.

### Git Intelligence

**Recent commits:**
- `35b6652` feat: story 3-2 updates, story 3-3 artifacts, and order page enhancements

**Recommended commit message:**
`feat: add admin soft-delete for non-terminal orders (story 3-5)`

### References

- [Source: sprint-status.yaml] Story 3-5: `admin-edit-and-delete-orders`
- [Source: Story 3-4 Dev Notes] Server Action pattern, `ActionResult<void>`, no `redirect()` in Server Actions
- [Source: Story 3-4 Dev Notes] Client Component dialog and `useTransition` pending state pattern
- [Source: migration 20260317100000] RLS policies for orders — dropping and recreating in new migration
- [Source: lib/types/index.ts] `OrderStatus` type: `"submitted" | "under_review" | "approved" | "declined" | "fulfilled"`
- [Source: memory/feedback_ui_language.md] UI must be in English
