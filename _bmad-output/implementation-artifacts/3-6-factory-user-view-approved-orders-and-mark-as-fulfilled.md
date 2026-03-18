# Story 3.6: Factory User — View Approved Orders and Mark as Fulfilled

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Factory user,
I want to view approved orders and mark them as fulfilled when production is complete,
so that the order lifecycle is completed and store users can see their order has been processed.

## Acceptance Criteria

1. **Given** a Factory user views the orders list,
   **When** the page loads,
   **Then** all non-deleted orders across all stores are visible (RLS already handles this), with store names displayed on each order.

2. **Given** a Factory user views an order detail page for an `approved` order,
   **When** the page renders,
   **Then** a "Mark as Fulfilled" button is visible in the order header.

3. **Given** a Factory user clicks "Mark as Fulfilled",
   **When** the confirmation dialog opens,
   **Then** a clear message is shown confirming the action, with "Cancel" and "Mark as Fulfilled" buttons.

4. **Given** a Factory user confirms the fulfillment,
   **When** the action completes successfully,
   **Then** the order status updates to `fulfilled`, the `fulfilled_at` timestamp is set, the status badge reflects the new status, a success toast is shown, and the page refreshes to show the updated state.

5. **Given** a Factory user views an order that is NOT `approved` (e.g., `submitted`, `under_review`, `declined`, `fulfilled`),
   **When** the page renders,
   **Then** no "Mark as Fulfilled" button is shown — only approved orders can be fulfilled.

6. **Given** the fulfillment action fails (network error or DB error),
   **When** the error is returned,
   **Then** an error toast is displayed and the order status does not change.

7. **Given** any non-Factory user (admin, store) views an approved order,
   **When** the page renders,
   **Then** no "Mark as Fulfilled" button is shown — only Factory users can fulfill orders. (Note: Admin sees their own action buttons from Story 3-4.)

8. **Given** an order has been fulfilled,
   **When** the order detail page renders for any user,
   **Then** the `fulfilled_at` timestamp is displayed in the order metadata card.

9. **Given** a Factory user fulfills an order,
   **When** the status change is persisted,
   **Then** a new entry is automatically recorded in `order_status_history` via the existing DB trigger (Story 3-4).

## Tasks / Subtasks

- [ ] Task 1 — DB migration: add UPDATE policy for factory role on orders (AC: #4, #9)
  - [ ] Create `supabase/migrations/20260318100000_factory_fulfill_orders.sql`
  - [ ] Add `orders_update_factory` policy: factory can UPDATE orders WHERE `status = 'approved'` AND `deleted_at IS NULL`
  - [ ] WITH CHECK: factory can only set `status = 'fulfilled'` (restrict what they can write)
  - [ ] Add `order_status_history_insert_factory` policy: factory can INSERT into `order_status_history` (needed for the SECURITY DEFINER trigger that runs as session user)

- [ ] Task 2 — Server Action: `fulfillOrder` (AC: #4, #5, #6, #9)
  - [ ] Add `fulfillOrder` export to `app/(dashboard)/orders/[order-id]/actions.ts`
  - [ ] Signature: `fulfillOrder(orderId: string): Promise<ActionResult<void>>`
  - [ ] Auth check: get user, get profile — return error if not factory
  - [ ] Fetch order: validate status is `approved` — return error otherwise
  - [ ] Update: set `status = 'fulfilled'`, `fulfilled_at = new Date().toISOString()`
  - [ ] On success: revalidatePath("/orders") and revalidatePath(`/orders/${orderId}`); return success
  - [ ] On error: return error message

- [ ] Task 3 — Client Component: `FulfillOrderButton` (AC: #2, #3, #4, #5, #6, #7)
  - [ ] Create `components/orders/fulfill-order-button.tsx` with `"use client"` directive
  - [ ] Props: `orderId: string`, `currentStatus: OrderStatus`, `role: string`
  - [ ] Render nothing if `role !== "factory"` or `currentStatus !== "approved"`
  - [ ] "Mark as Fulfilled" button (blue/primary style) → opens confirmation dialog
  - [ ] Confirmation dialog with "Cancel" and "Mark as Fulfilled" buttons
  - [ ] Use `useTransition` for pending state
  - [ ] On success: `toast.success("Order marked as fulfilled.")` + `router.refresh()`
  - [ ] On error: `toast.error(result.error)`

- [ ] Task 4 — Integrate `FulfillOrderButton` into order detail page (AC: #2, #7, #8)
  - [ ] Update `app/(dashboard)/orders/[order-id]/page.tsx`
  - [ ] Import and place `<FulfillOrderButton>` in the order header alongside existing action buttons
  - [ ] Display `fulfilled_at` timestamp in the metadata card when present

- [ ] Task 5 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { OrderStatus, ActionResult } from "@/lib/types"
Status constants:        import { STATUS_COLORS, STATUS_LABELS, TERMINAL_STATUSES } from "@/lib/constants/order-status"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Button, Dialog, DialogContent from @/components/ui/*
Toast:                   import { toast } from "sonner"
Icons:                   CheckCircle from lucide-react
revalidatePath:          import { revalidatePath } from "next/cache"
useRouter:               import { useRouter } from "next/navigation"
useTransition:           import { useTransition } from "react"
Server action pattern:   see app/(dashboard)/orders/[order-id]/actions.ts (updateOrderStatus, deleteOrder)
```

## Dev Notes

### RLS Policy for Factory UPDATE

Currently, factory users only have a SELECT policy on orders. To allow them to mark orders as fulfilled, we need an UPDATE policy scoped to:
- **USING:** `auth_role() = 'factory' AND status = 'approved' AND deleted_at IS NULL` — factory can only UPDATE approved, non-deleted orders
- **WITH CHECK:** `auth_role() = 'factory' AND status = 'fulfilled'` — factory can only set status to 'fulfilled'

This is a tightly scoped policy — factory users cannot change any other status or modify any other field in a way that violates the WITH CHECK.

We also need an INSERT policy on `order_status_history` for factory role, because the `record_order_status_change()` trigger function uses `SECURITY DEFINER` but still runs with the session's `auth.uid()`. The INSERT policy on `order_status_history` currently only allows admin — we need to add factory.

### Server Action Pattern

Follow the exact pattern from `updateOrderStatus` and `deleteOrder`:

```typescript
export async function fulfillOrder(orderId: string): Promise<ActionResult<void>> {
  "use server";
  if (!UUID_REGEX.test(orderId)) return { data: null, error: "Invalid order ID." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (!profile || profile.role !== "factory") return { data: null, error: "Unauthorized." };

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (!order) return { data: null, error: "Order not found." };

  if (order.status !== "approved") {
    return { data: null, error: "Only approved orders can be fulfilled." };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) return { data: null, error: "Failed to fulfill order. Please try again." };

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { data: undefined, error: null };
}
```

### Trigger Side-Effects

The existing `orders_status_change_history` trigger (Story 3-4) will fire when `status` changes from `approved` to `fulfilled`, automatically inserting a new entry in `order_status_history`. The `fulfilled_at` field change does not affect this trigger (it only checks `IF NEW.status != OLD.status`).

### `fulfilled_at` Display

The `fulfilled_at` field already exists in the `orders` table (from the initial migration). The order detail page already fetches it. We just need to display it in the metadata card when it has a value.

### Architecture Compliance

**D7 — Server Actions:** `fulfillOrder` follows the established pattern: auth → role → validation → DB mutation → revalidate → return ActionResult.

**D5 — RLS:** Factory UPDATE policy is tightly scoped. No service_role key. Server Action role check is defense-in-depth.

**D8 — SSR + Realtime:** The existing `RealtimeOrderList` from Story 3-3 will automatically reflect status changes made by factory users. No additional Realtime wiring needed.

**Anti-Patterns — NEVER DO:**
- Allow factory to set any status other than `fulfilled` — enforce at RLS and Server Action level
- Call `redirect()` inside the Server Action — return ActionResult, let the client navigate
- Trust the `currentStatus` prop — always re-validate status on the server before mutating
- Use `service_role` key — RLS handles access control

### Library & Framework Requirements

**No new packages needed.** All dependencies (shadcn/ui Dialog, Button, sonner, lucide-react) are already installed.

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Factory user views orders list → sees all orders with store names
- Manual: Factory user views `approved` order → "Mark as Fulfilled" button visible
- Manual: Factory user views `submitted`/`under_review`/`declined` order → no "Mark as Fulfilled" button
- Manual: Factory user clicks "Mark as Fulfilled" → confirmation dialog → confirms → success toast, status changes to "Fulfilled", `fulfilled_at` timestamp appears in metadata
- Manual: Admin views `approved` order → no "Mark as Fulfilled" button (admin has their own action buttons)
- Manual: Store user views `approved` order → no "Mark as Fulfilled" button
- Manual: After fulfillment, status history timeline shows new "Fulfilled" entry
- Manual: Real-time — admin/factory user on order list sees status update automatically

### Previous Story Intelligence (from Stories 3-1 through 3-5)

1. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat("en-CA", ...)` for all date formatting.
2. **Server Action: do NOT call `redirect()` inside** — return `ActionResult`, let the Client Component handle via `router.refresh()`.
3. **`ActionResult<void>` pattern** — return `{ data: undefined, error: null }` for success.
4. **RLS is the enforcement layer** — role check in Server Action is defense-in-depth.
5. **UI Language is English** — all labels, dialogs, toasts in English.
6. **`useTransition` for pending state** — disable buttons while `isPending === true`.

### Git Intelligence

**Recent commits:**
- `6eaa5c3` feat: stories 3-4 and 3-5 — admin order actions and soft delete

**Recommended commit message:**
`feat: factory user fulfill approved orders (story 3-6)`

### References

- [Source: sprint-status.yaml] Story 3-6: `factory-user-view-approved-orders-and-mark-as-fulfilled`
- [Source: Story 3-4] Server Action pattern, DB trigger for status history
- [Source: Story 3-5] DeleteOrderButton component pattern (dialog + useTransition)
- [Source: migration 20260317100000] Current RLS policies — factory only has SELECT
- [Source: migration 20260317130000] `record_order_status_change()` trigger
- [Source: migration 20260317140000] Soft delete — `deleted_at IS NULL` filter in all policies
- [Source: lib/types/index.ts] `OrderStatus` includes `"fulfilled"`
- [Source: memory/feedback_ui_language.md] UI must be in English

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

1. DB migration adds tightly-scoped `orders_update_factory` policy: factory can only UPDATE approved, non-deleted orders and can only set status to `fulfilled`.
2. Added `order_status_history_insert_factory` policy for completeness, though the SECURITY DEFINER trigger technically bypasses RLS. Defense-in-depth.
3. `fulfillOrder` server action validates: UUID format, factory role, approved status. Returns `{ data: undefined, error: null }` on success.
4. `FulfillOrderButton` uses `useTransition` for pending state; confirmation dialog before action. Blue styling consistent with the "fulfilled" status badge color.
5. No `redirect()` inside the server action — `router.refresh()` from the client component re-renders with updated status.
6. `fulfilled_at` timestamp displayed in the order metadata card when present (visible to all roles).
7. Existing `orders_status_change_history` trigger (Story 3-4) auto-records the status change in `order_status_history`.
8. Existing `RealtimeOrderList` (Story 3-3) auto-reflects changes to other connected users.
9. `npm run build` and `npm run lint` both pass with zero errors/warnings.

### File List

- **CREATED** `supabase/migrations/20260318100000_factory_fulfill_orders.sql`
- **CREATED** `components/orders/fulfill-order-button.tsx`
- **MODIFIED** `app/(dashboard)/orders/[order-id]/actions.ts`
- **MODIFIED** `app/(dashboard)/orders/[order-id]/page.tsx`

### Change Log

- Added DB migration with factory UPDATE policy on orders (scoped to approved→fulfilled only) and factory INSERT policy on order_status_history.
- Added `fulfillOrder` server action with auth, role, and status validation.
- Added `FulfillOrderButton` client component with confirmation dialog and pending state.
- Integrated `<FulfillOrderButton>` into the order detail page header.
- Added `fulfilled_at` timestamp display in order metadata card.
