# Story 3.4: Admin — Approve, Decline, and Place Order Under Review

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to approve, decline (with a reason), or place an order under review directly from the order detail page,
so that I can manage the full order lifecycle without leaving the application.

## Acceptance Criteria

1. **Given** an Admin views an order detail page,
   **When** the order status is `submitted` or `under_review`,
   **Then** action buttons are displayed: "Place Under Review" (only from `submitted`), "Approve", and "Decline" — buttons are hidden for terminal statuses (`approved`, `declined`, `fulfilled`).

2. **Given** an Admin clicks "Place Under Review",
   **When** the action completes successfully,
   **Then** the order status updates to `under_review`, the status badge reflects the new status, and a success toast is shown.

3. **Given** an Admin clicks "Approve",
   **When** the action completes successfully,
   **Then** the order status updates to `approved`, the status badge reflects the new status, and a success toast is shown.

4. **Given** an Admin clicks "Decline",
   **When** the confirmation dialog opens,
   **Then** the Admin must enter a decline reason (required — empty reason is not accepted) before the action can be submitted.

5. **Given** an Admin submits a decline with a valid reason,
   **When** the action completes successfully,
   **Then** the order status updates to `declined`, the decline reason is persisted and visible in the red callout, and a success toast is shown.

6. **Given** any status-change action is performed,
   **When** the action completes,
   **Then** a new entry is automatically recorded in `order_status_history` with the new status, timestamp, and the Admin's user ID as `changed_by` — this is handled via a DB trigger, not application code.

7. **Given** a non-Admin user views the order detail page,
   **When** the page renders,
   **Then** no action buttons are shown — the order detail page remains read-only for Store and Factory users.

8. **Given** a status-change action fails (network error or DB error),
   **When** the error is returned,
   **Then** an error toast is displayed and the order status does not change.

## Tasks / Subtasks

- [x] Task 1 — DB migration: trigger for automatic status history on update (AC: #6)
  - [x] Create `supabase/migrations/20260317130000_order_status_change_trigger.sql`
  - [x] Create trigger function `record_order_status_change()` — SECURITY DEFINER SET search_path = public, pg_temp — on `AFTER UPDATE OF status ON orders`: if `NEW.status != OLD.status`, insert into `order_status_history (order_id, status, changed_by)` with `(NEW.id, NEW.status, auth.uid())`
  - [x] Create trigger `orders_status_change_history AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION record_order_status_change()`
  - [x] Run `supabase db push` to apply migration to remote (or document as step for dev)

- [x] Task 2 — Server Action: `updateOrderStatus` (AC: #2, #3, #5, #8)
  - [x] Create `app/(dashboard)/orders/[order-id]/actions.ts`
  - [x] Export `updateOrderStatus(orderId: string, newStatus: OrderStatus, declineReason?: string): Promise<ActionResult<void>>`
  - [x] Validate input: `newStatus` must be one of the actionable transitions (`under_review`, `approved`, `declined`); if `declined`, `declineReason` must be a non-empty string
  - [x] Auth check: get user, get profile — return `{ data: null, error: "Unauthorized." }` if not admin
  - [x] Build update payload: `{ status: newStatus, decline_reason: newStatus === "declined" ? declineReason : null }`
  - [x] Update: `.from("orders").update(payload).eq("id", orderId)` — RLS `orders_update_admin` already enforces admin-only access; DB trigger auto-inserts history
  - [x] On success: `revalidatePath("/orders")` and `revalidatePath(\`/orders/${orderId}\`)`; return `{ data: undefined, error: null }`
  - [x] On error: return `{ data: null, error: "Failed to update order status. Please try again." }`

- [x] Task 3 — Client Component: `OrderStatusActions` (AC: #1, #2, #3, #4, #5, #7, #8)
  - [x] Create `components/orders/order-status-actions.tsx` with `"use client"` directive
  - [x] Props: `orderId: string`, `currentStatus: OrderStatus`, `role: string`
  - [x] Render nothing if `role !== "admin"` or `currentStatus` is terminal (`approved`, `declined`, `fulfilled`)
  - [x] Use `useTransition` for pending state — disable all buttons while `isPending === true`
  - [x] Use `useRouter()` from `next/navigation` and call `router.refresh()` after successful action
  - [x] "Place Under Review" button (amber/warning style): only rendered when `currentStatus === "submitted"`; on click → call `updateOrderStatus(orderId, "under_review")`
  - [x] "Approve" button (green): rendered when `currentStatus === "submitted"` or `"under_review"`; on click → call `updateOrderStatus(orderId, "approved")`
  - [x] "Decline" button (red/destructive): rendered when `currentStatus === "submitted"` or `"under_review"`; on click → open decline dialog
  - [x] Decline dialog: use `Dialog` + `DialogContent` from `@/components/ui/dialog` — textarea for reason (required, min 1 char), "Cancel" button, "Decline Order" submit button
  - [x] On action result: if `error` → `toast.error(error)`; if success → `toast.success("Order status updated")` + `router.refresh()`
  - [x] Close decline dialog and clear reason field after successful decline

- [x] Task 4 — Integrate `OrderStatusActions` into order detail page (AC: #1, #7)
  - [x] Update `app/(dashboard)/orders/[order-id]/page.tsx`
  - [x] Import `OrderStatusActions` from `@/components/orders/order-status-actions`
  - [x] Place `<OrderStatusActions orderId={order.id} currentStatus={status} role={profile.role} />` in the order header row, adjacent to the status badge
  - [x] No prop drilling needed — `profile.role` is already fetched in the page

- [x] Task 5 — Build and lint verification (AC: all)
  - [x] Run `npm run build` — zero errors
  - [x] Run `npm run lint` — zero warnings/errors
  - [x] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Supabase browser client: import { createClient } from "@/lib/supabase/client"
Types:                   import type { OrderStatus, ActionResult } from "@/lib/types"
Status constants:        import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants/order-status"
Price formatting:        import { formatPrice } from "@/lib/utils"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Badge, Button, Card*, Dialog* from @/components/ui/*
Toast:                   import { toast } from "sonner"
Icons:                   CheckCircle, XCircle, Clock, AlertCircle from lucide-react
revalidatePath:          import { revalidatePath } from "next/cache"
useRouter:               import { useRouter } from "next/navigation"
useTransition:           import { useTransition } from "react"
```

## Dev Notes

### DB Trigger Approach — Why Not an RPC

Story 3-1 used an RPC for atomic `orders + order_items` INSERT because: (a) the store user needed both in one transaction, and (b) server-side price lookup was a security requirement.

Story 3-4 is different: the admin only needs to UPDATE one row in `orders`. The history record is a consequence, not a parallel insert. A `AFTER UPDATE OF status ON orders` trigger expresses this causality correctly and prevents any future mutation path from forgetting to write history. This is the idiomatic approach.

**Trigger signature:**

```sql
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER orders_status_change_history
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION record_order_status_change();
```

**`auth.uid()` inside SECURITY DEFINER:** This works correctly in Supabase. Even though the function runs with elevated privileges, `auth.uid()` reads from the PostgreSQL session's `request.jwt.claims` setting — which is always the authenticated user's JWT. The admin's user ID will be correctly recorded as `changed_by`.

### Status Transition Matrix

| Current Status  | Allowed Transitions           | Buttons Shown                              |
|-----------------|-------------------------------|--------------------------------------------|
| `submitted`     | `under_review`, `approved`, `declined` | "Under Review", "Approve", "Decline" |
| `under_review`  | `approved`, `declined`        | "Approve", "Decline"                       |
| `approved`      | (terminal — none)             | None                                       |
| `declined`      | (terminal — none)             | None                                       |
| `fulfilled`     | (terminal — none)             | None                                       |

### Server Action Pattern

Follow the pattern established in `app/(dashboard)/orders/actions.ts`:
- `"use server"` at top of file
- Auth check before any DB call
- Role check: only `admin` can call `updateOrderStatus`
- Return `ActionResult<void>` — `data: undefined` on success (not `null`)
- `revalidatePath` invalidates both the list and the detail page cache

```typescript
// Correct return on success
revalidatePath("/orders");
revalidatePath(`/orders/${orderId}`);
return { data: undefined, error: null };
```

### Client Component: Button & Dialog Pattern

The `OrderStatusActions` is a Client Component because:
1. It uses `useTransition` for async pending state
2. It manages local dialog open/close state with `useState`
3. It uses `toast()` (client-side)
4. It calls `router.refresh()` after success

**IMPORTANT — do NOT call `redirect()` inside Server Actions for this story.** The order detail page should stay open after a status change; `router.refresh()` (called from the Client Component) will re-fetch the page data and show the updated status/badge.

**Decline dialog pattern:**

```tsx
const [open, setOpen] = useState(false);
const [reason, setReason] = useState("");

// On submit:
const result = await updateOrderStatus(orderId, "declined", reason.trim());
if (result.error) {
  toast.error(result.error);
} else {
  toast.success("Order declined.");
  setOpen(false);
  setReason("");
  router.refresh();
}
```

**Pending state pattern:**

```tsx
const [isPending, startTransition] = useTransition();

const handleApprove = () => {
  startTransition(async () => {
    const result = await updateOrderStatus(orderId, "approved");
    if (result.error) toast.error(result.error);
    else { toast.success("Order approved."); router.refresh(); }
  });
};
```

### RLS Already in Place — No New Policies Needed

From `20260317100000_create_orders.sql`:
- `orders_update_admin` — admin can UPDATE any order ✓
- `order_status_history_insert_admin` — admin can INSERT history ✓

The trigger fires under the session's JWT, so `order_status_history_insert_admin` (`auth_role() = 'admin'`) is satisfied when an admin triggers the UPDATE. **No new migrations for RLS needed.**

### `decline_reason` Field Handling

When approving or placing under review, clear `decline_reason` by setting it to `null` in the update payload. This ensures a previously-declined order (if ever re-activated in future stories) doesn't carry a stale reason. For this story's scope (terminal states), this is a defensive measure.

```typescript
const payload: { status: OrderStatus; decline_reason: string | null } = {
  status: newStatus,
  decline_reason: newStatus === "declined" ? (declineReason ?? null) : null,
};
```

### Existing Order Detail Page — What Changes

Currently `app/(dashboard)/orders/[order-id]/page.tsx`:
- Shows: breadcrumb, order header (ID + status badge), metadata card, decline reason callout, items table, status history timeline
- Fetches: order, items, history, submitter name, store name (for admin/factory)

**What changes for Story 3-4:**
1. Import `OrderStatusActions` component
2. Add `<OrderStatusActions orderId={order.id} currentStatus={status} role={profile.role} />` next to the status badge in the order header

**No other changes to the page.** The `decline_reason` callout already works — it shows when `status === "declined" && order.decline_reason`. After an admin declines, `router.refresh()` will re-render the page with the new status and the callout will appear automatically.

### Project Structure Notes

**Files to CREATE:**

```
app/(dashboard)/orders/[order-id]/actions.ts          — updateOrderStatus Server Action
components/orders/order-status-actions.tsx             — Admin action buttons + decline dialog
supabase/migrations/20260317130000_order_status_change_trigger.sql
```

**Files to MODIFY:**

```
app/(dashboard)/orders/[order-id]/page.tsx             — Add <OrderStatusActions> to header
```

**Files NOT to touch:**
- `app/(dashboard)/orders/actions.ts` — createOrder, unrelated
- `app/(dashboard)/orders/page.tsx` — order list, no changes needed
- `components/orders/realtime-order-list.tsx` — Realtime wrapper (Story 3-3), unrelated
- `lib/types/index.ts` — types already sufficient (OrderStatus exists)
- `lib/constants/order-status.ts` — shared constants, no changes needed
- `lib/validations/orders.ts` — createOrder validation, unrelated
- `proxy.ts` / middleware — no changes needed
- `supabase/migrations/20260317100000_create_orders.sql` — do NOT modify existing migrations

### Architecture Compliance

**D7 — Server Actions:** `updateOrderStatus` in `app/(dashboard)/orders/[order-id]/actions.ts` follows the Server Action pattern: auth check, role check, DB mutation, revalidate, return ActionResult.

**D5 — RLS:** Admin UPDATE policy + SECURITY DEFINER trigger for history insert. No bypassing RLS. No service_role key in app code.

**D8 — SSR + Realtime:** No new Realtime subscriptions needed. The `RealtimeOrderList` from Story 3-3 is already subscribed to `orders` changes. When the admin changes an order status, the store user's order list will update automatically via the existing Realtime channel.

**D9 — Error Handling:** Server Action returns `ActionResult<void>`. Client Component uses `toast.error()` on failure. Buttons are disabled during `isPending`. No `redirect()` in Server Action.

**Anti-Patterns — NEVER DO:**
- `redirect()` inside `updateOrderStatus` Server Action — let the client component handle navigation
- Manually insert into `order_status_history` from the Server Action — the DB trigger handles this
- Trust the `newStatus` value from the client without validation — always validate allowed transitions on the server
- Use `service_role` key — RLS with `orders_update_admin` handles admin access
- `supabase.from('orders').update({...})` without `.eq("id", orderId)` — always scope updates by ID
- Call `revalidatePath` before the DB operation — always mutate first, then revalidate

### Library & Framework Requirements

**Already installed — no new packages needed:**

| Package | Purpose | Notes |
|---------|---------|-------|
| `@supabase/ssr` | Server-side Supabase client | Already configured |
| `sonner` | Toast notifications | Already installed (used in earlier stories) |
| `lucide-react` | Icons | Already installed |
| shadcn/ui `Dialog` | Decline reason modal | Already available in `components/ui/dialog` |
| shadcn/ui `Button` | Action buttons | Already available |

**No new packages to install.**

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin clicks "Place Under Review" on a `submitted` order → status changes to `under_review`, status badge updates, new history entry appears in the timeline
- Manual: Admin clicks "Approve" on a `submitted` or `under_review` order → status changes to `approved`, action buttons disappear, status badge updates green
- Manual: Admin clicks "Decline" → dialog opens; submitting with empty reason is blocked; submitting with a reason → status changes to `declined`, decline reason callout appears
- Manual: Store User views the same order detail page → no action buttons visible
- Manual: Factory User views the same order detail page → no action buttons visible
- Manual: After admin approves/declines, no action buttons shown (terminal state)
- Manual: Real-time update — open orders list in another tab (as store user or admin); admin changes status on one tab → other tab auto-updates within 3 seconds (via existing Realtime from Story 3-3)
- Manual: Error case — network off → "Decline" action shows error toast, status does not change

### Previous Story Intelligence (from Stories 3-1, 3-2, 3-3)

1. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat("en-CA", ...)` for all date formatting.

2. **`formatPrice` exists in `lib/utils.ts`** — reuse for price display.

3. **Next.js 15 async params** — already handled in the page; actions don't use params directly.

4. **Server Action: do NOT call `redirect()` inside** — return result, let the Client Component handle navigation via `router.refresh()`.

5. **RLS is the enforcement layer** — the `orders_update_admin` policy is the actual security gate. The role check in the Server Action is defense-in-depth (belt and suspenders).

6. **`ActionResult<void>` pattern** — return `{ data: undefined, error: null }` for success (not `{ data: null, error: null }` — `null` data is ambiguous).

7. **`lib/supabase/client.ts` already exists** — browser client for Client Components that need direct Supabase access. `OrderStatusActions` calls Server Actions — it does NOT need a direct Supabase client.

8. **UI Language is English** — all button labels, dialog text, toast messages in English.

9. **Realtime side-effect is free** — `orders_status_change_history` trigger causes an UPDATE on `orders` + INSERT on `order_status_history`. The Realtime channel subscribed to `orders` (Story 3-3) will fire on the orders UPDATE. No extra wiring needed.

10. **`profiles` table has no `full_name` column defined in the migration** — Story 3-3 fetched `full_name` from profiles and it worked (because the migration might define it or it's a view). If needed for `changed_by` display, keep the same pattern. This story does NOT display changed_by names — just timestamps and statuses.

### Git Intelligence

**Recent commits (from Story 3-3):**
- `35b6652` feat: story 3-2 updates, story 3-3 artifacts, and order page enhancements

**Recommended commit message:**
`feat: add admin order status actions (approve, decline, under review) (story 3-4)`

### References

- [Source: sprint-status.yaml] Story 3-4: `admin-approve-decline-and-place-order-under-review`
- [Source: Story 3-3 Dev Notes] Realtime pattern — admin status change triggers router.refresh() on other clients automatically
- [Source: Story 3-3 Completion Notes] RealtimeOrderList wraps admin and factory views — status changes will propagate automatically
- [Source: Story 3-2 Dev Notes] Server Action pattern — return ActionResult, no redirect() inside
- [Source: Story 3-1 Dev Notes] RLS is enforcement, role check is defense-in-depth
- [Source: migration 20260317100000] RLS policies: orders_update_admin, order_status_history_insert_admin
- [Source: lib/types/index.ts] OrderStatus type: "submitted" | "under_review" | "approved" | "declined" | "fulfilled"
- [Source: memory/feedback_ui_language.md] UI must be in English

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — clean implementation, no debugging required.

### Completion Notes List

1. DB trigger uses `SECURITY DEFINER SET search_path = public, pg_temp` per architecture requirements. `auth.uid()` correctly captures the admin's session JWT inside the trigger.
2. `updateOrderStatus` server action validates: allowed transitions, non-empty decline reason for "declined", admin role. Returns `{ data: undefined, error: null }` on success (not `null`).
3. `OrderStatusActions` uses `useTransition` for pending state; buttons disabled during any in-flight action.
4. Decline dialog requires non-empty reason — "Decline Order" button is disabled when `reason.trim().length === 0`, providing client-side guard in addition to server-side validation.
5. No `redirect()` inside the server action — `router.refresh()` from the client component re-renders with updated status.
6. `decline_reason` is set to `null` when approving or placing under review (defensive clearing per story spec).
7. `npm run build` and `npm run lint` both pass with zero errors/warnings.

### File List

- **CREATED** `supabase/migrations/20260317130000_order_status_change_trigger.sql`
- **CREATED** `app/(dashboard)/orders/[order-id]/actions.ts`
- **CREATED** `components/orders/order-status-actions.tsx`
- **MODIFIED** `app/(dashboard)/orders/[order-id]/page.tsx`

### Change Log

- Added DB trigger `orders_status_change_history` and function `record_order_status_change()` to auto-insert into `order_status_history` on status change.
- Added `updateOrderStatus` server action with auth, role, and input validation.
- Added `OrderStatusActions` client component with "Place Under Review", "Approve", and "Decline" buttons + decline dialog.
- Integrated `<OrderStatusActions>` into the order header row of the order detail page.
