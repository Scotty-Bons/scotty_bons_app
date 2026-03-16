# Story 3.3: Admin — View All Orders with Real-Time Updates

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to view all orders across all stores with real-time status updates,
so that I always have an accurate, up-to-date view of pending and active orders without manually refreshing.

## Acceptance Criteria

1. **Given** an Admin navigates to the Orders section,
   **When** the page loads,
   **Then** all orders across all stores are listed with store name, submission date, status badge (color-coded), and order total.

2. **Given** an Admin views the orders list,
   **When** a new order is submitted or any order status changes,
   **Then** the list updates automatically within 3 seconds via Supabase Realtime — no manual refresh required (NFR3).

3. **Given** the Admin's order list is rendered by `realtime-order-list.tsx` (Client Component),
   **When** a Supabase Realtime event is received on the `orders:all` channel,
   **Then** the component calls `router.refresh()` to re-fetch data from the Server Component — it never manually updates local state with database values; the channel is subscribed on mount and unsubscribed on unmount.

4. **Given** an Admin clicks on any order,
   **When** the detail page loads,
   **Then** they see the full item list, quantities, prices, total, store name, submitting user, current status, and full status history with timestamps.

5. **Given** the order list is empty,
   **When** the Admin views the orders section,
   **Then** an informative empty state is displayed.

## Tasks / Subtasks

- [x] Task 1 — Enable Supabase Realtime on the `orders` table (AC: #2, #3)
  - [x] Create migration `supabase/migrations/20260317120000_enable_orders_realtime.sql`
  - [x] Run `ALTER PUBLICATION supabase_realtime ADD TABLE orders;` to enable Realtime events on the orders table
  - [x] Verify: Supabase Realtime only broadcasts rows matching RLS policies — admin sees all orders via existing `orders_select_admin` policy

- [x] Task 2 — Create `RealtimeOrderList` Client Component (AC: #2, #3)
  - [x] Create `components/orders/realtime-order-list.tsx` with `"use client"` directive
  - [x] Props: `children: React.ReactNode` (wraps the server-rendered order list)
  - [x] On mount (`useEffect`): create Supabase browser client via `createClient()` from `@/lib/supabase/client`
  - [x] Subscribe to channel `supabase.channel("orders-realtime").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => router.refresh()).subscribe()`
  - [x] Cleanup: `supabase.removeChannel(channel)` in useEffect return
  - [x] Use `useRouter()` from `next/navigation` for `router.refresh()`
  - [x] Optional: show a subtle "Live" indicator (green dot) when channel status is `SUBSCRIBED`

- [x] Task 3 — Update orders list page for Admin view (AC: #1, #5)
  - [x] Modify `app/(dashboard)/orders/page.tsx`: wrap the order list in `<RealtimeOrderList>` for admin and factory roles
  - [x] Ensure admin/factory see store name on each order card (already implemented in Story 3-2)
  - [x] Verify empty state renders correctly for admin ("No orders yet")
  - [x] Ensure all order cards link to `/orders/[order-id]` detail page (already implemented in Story 3-2)

- [x] Task 4 — Enhance order detail page for Admin view (AC: #4)
  - [x] Update `app/(dashboard)/orders/[order-id]/page.tsx` to show submitting user display name
  - [x] Fetch submitting user's profile: `.from("profiles").select("full_name").eq("user_id", order.submitted_by).single()`
  - [x] Display "Submitted by: [name]" in the order metadata section
  - [x] Verify store name is displayed (fetch from `stores` table if not already shown)

- [x] Task 5 — Build and lint verification (AC: all)
  - [x] Run `npm run build` — zero errors
  - [x] Run `npm run lint` — zero warnings/errors
  - [x] Verify TypeScript compilation passes

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Supabase browser client: import { createClient } from "@/lib/supabase/client"
Types:                   import type { OrderStatus, OrderRow } from "@/lib/types"
Status constants:        import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants/order-status"
Price formatting:        import { formatPrice } from "@/lib/utils"
CN utility:              import { cn } from "@/lib/utils"
UI components:           Badge, Card, CardContent, CardHeader, CardTitle from @/components/ui/*
Icons:                   Package, ArrowLeft, Clock, AlertCircle, Radio from lucide-react
Breadcrumbs:             import { Breadcrumbs } from "@/components/shared/breadcrumbs"
```

## Dev Notes

### This Story Introduces Supabase Realtime — First Realtime Usage in the Project

Story 3-3 is the first story to use Supabase Realtime. The pattern established here will be reused by Story 3-6 (Factory User real-time view). Get it right.

**Architecture Decision D8:** The Realtime pattern is SSR + targeted Realtime:
1. Server Component fetches initial data (SSR — already working)
2. Client Component wrapper subscribes to Realtime channel on mount
3. On any Realtime event → call `router.refresh()` to re-fetch from Server Component
4. **NEVER manually update local state with database values from the Realtime event** — always re-fetch via `router.refresh()`
5. Unsubscribe channel on unmount (cleanup function in useEffect)

### Supabase Realtime — How It Works with RLS

Supabase Realtime for `postgres_changes` respects RLS policies. The authenticated user's JWT is used to filter which rows they receive events for. Since admin has `SELECT` on all orders, admin will receive events for all order changes.

**Important:** The `orders` table must be added to the `supabase_realtime` publication. This is a one-time migration:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
```

Without this, no Realtime events will fire for the orders table, regardless of channel subscriptions.

### Realtime Channel Subscription Pattern

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeOrderList({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return <>{children}</>;
}
```

**Key details:**
- Channel name `"orders-realtime"` is arbitrary — just a unique identifier
- `event: "*"` listens for INSERT, UPDATE, and DELETE
- The callback ignores the payload — it just triggers `router.refresh()`
- `supabase.removeChannel(channel)` properly cleans up the subscription
- `createClient()` from `@/lib/supabase/client` creates a browser client (already exists in the project)

### Existing Orders Page — What Needs to Change

The current `app/(dashboard)/orders/page.tsx` (Server Component) already:
- Fetches all orders via RLS (admin sees all, store sees own)
- Shows store name for admin/factory roles
- Shows status badges with correct colors
- Links each order to `/orders/[order-id]` detail page
- Has empty state for no orders

**What needs to change for Story 3-3:**
1. **Wrap the order list content in `<RealtimeOrderList>`** for admin and factory roles — this is the ONLY change to the page structure
2. Import `RealtimeOrderList` from `@/components/orders/realtime-order-list`
3. Conditionally wrap: only admin and factory roles get Realtime (Store Users do NOT need real-time updates per FR30)

**Implementation pattern:**
```tsx
// In orders/page.tsx — wrap the order list for admin/factory
const orderListContent = (
  <div className="space-y-3">
    {orders.map((order) => (
      <Link key={order.id} href={`/orders/${order.id}`}>
        {/* existing order card */}
      </Link>
    ))}
  </div>
);

// Conditionally wrap with Realtime
{role === "admin" || role === "factory" ? (
  <RealtimeOrderList>{orderListContent}</RealtimeOrderList>
) : (
  orderListContent
)}
```

### Order Detail Page — Admin Enhancements

The existing detail page (`orders/[order-id]/page.tsx` from Story 3-2) shows:
- Items table with quantities, prices, line totals
- Order total
- Status badge
- Status history timeline
- Decline reason (if applicable)
- Breadcrumb navigation

**New for Admin in Story 3-3:**
- Show **submitting user display name** (fetch from profiles table)
- Show **store name** (fetch from stores table)
- These are visible to admin role only (store users already know their own store)

**Query for submitting user:**
```typescript
const { data: submitter } = await supabase
  .from("profiles")
  .select("full_name")
  .eq("user_id", order.submitted_by)
  .single();
```

**Query for store name:**
```typescript
const { data: store } = await supabase
  .from("stores")
  .select("name")
  .eq("id", order.store_id)
  .single();
```

### Project Structure Notes

**Files to CREATE:**

```
scotty-ops/scotty-ops/
├── supabase/migrations/YYYYMMDD_enable_orders_realtime.sql  — Enable Realtime on orders table
├── components/orders/realtime-order-list.tsx                  — Realtime wrapper Client Component
```

**Files to MODIFY:**

```
scotty-ops/scotty-ops/
├── app/(dashboard)/orders/page.tsx           — Wrap order list in RealtimeOrderList for admin/factory
├── app/(dashboard)/orders/[order-id]/page.tsx — Add submitting user name and store name for admin
```

**Files NOT to touch:**
- `app/(dashboard)/orders/actions.ts` — no new actions needed
- `app/(dashboard)/orders/new/page.tsx` — order creation, unrelated
- `components/orders/new-order-cart.tsx` — cart component, unrelated
- `lib/types/index.ts` — types already sufficient
- `lib/validations/orders.ts` — no new validation needed
- `lib/supabase/server.ts` — no changes needed
- `lib/supabase/client.ts` — already exists, no changes needed
- `lib/constants/order-status.ts` — already has STATUS_COLORS and STATUS_LABELS
- `middleware.ts` — no changes needed

### Architecture Compliance

**D8 — SSR + Targeted Realtime:** This is the canonical implementation of D8. Server Component fetches initial data. Client Component wrapper subscribes to Realtime. On event → `router.refresh()`. No manual state updates.

**D5 — RLS:** Admin sees all orders via existing `orders_select_admin` policy. No new RLS policies needed. Realtime events respect RLS — admin receives events for all orders.

**D9 — Error Handling:** If Realtime connection fails, the page still works — it just won't auto-update. The Server Component renders correctly on initial load regardless of Realtime status. No error toasts needed for Realtime failures.

**Anti-Patterns — NEVER DO:**
- `supabase.from('orders').select('*')` — always select specific columns
- Manually update React state from Realtime event payload — always use `router.refresh()`
- Import server Supabase client in the Realtime Client Component — use browser client only
- Create a REST API route for fetching orders — SSR does this directly
- Use `service_role` key in browser client — authenticated client with RLS only
- Subscribe to Realtime without unsubscribing on unmount — always clean up
- `new Date().toLocaleDateString()` — use `Intl.DateTimeFormat("en-CA", ...)`

### Library & Framework Requirements

**Already installed — no new packages needed:**

| Package | Purpose | Notes |
|---------|---------|-------|
| `@supabase/ssr` (0.9.0) | Server-side Supabase client | Already configured |
| `@supabase/supabase-js` (2.99.1) | Includes Realtime support | Already installed |
| `lucide-react` | Icons | Already installed |

**No new packages to install.** Supabase Realtime is built into `@supabase/supabase-js` — no additional dependency.

### Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual verification: Admin sees all orders from all stores with store names
- Manual verification: Admin order list updates within 3 seconds when a new order is submitted (have a store user create an order in another browser/tab)
- Manual verification: Admin order list updates when any order status changes
- Manual verification: Clicking an order navigates to `/orders/[order-id]` with full detail
- Manual verification: Order detail shows submitting user name and store name for admin
- Manual verification: Empty state displays correctly when no orders exist
- Manual verification: Store User's order list does NOT have Realtime wrapper (no auto-refresh)
- Manual verification: Factory User's order list DOES have Realtime wrapper (auto-refresh)
- Manual verification: Navigating away from orders page and back does not leave orphaned Realtime subscriptions (check browser dev tools → Network → WebSocket)

### Previous Story Intelligence (from Stories 3-1 and 3-2)

**Key learnings that MUST inform this implementation:**

1. **`date-fns` is NOT installed** — Stories 3-1 and 3-2 used `Intl.DateTimeFormat("en-CA", ...)` instead. Continue this pattern.

2. **`formatPrice` exists in `lib/utils.ts`** — Use for all price display. Do NOT create a new formatter.

3. **Status constants extracted to shared file** — Story 3-2 extracted `STATUS_COLORS` and `STATUS_LABELS` to `lib/constants/order-status.ts`. Import from there — do NOT duplicate.

4. **RLS is the enforcement layer** — Admin RLS policies already allow SELECT on all orders. No additional application-layer role checks for data access.

5. **Next.js 15 async params** — Route params must be awaited: `const { "order-id": orderId } = await params;`

6. **Store name query pattern** — Story 3-2 already fetches store names for admin/factory by collecting unique `store_id` values and querying `stores` table. Reuse this pattern.

7. **Order items aggregation** — Story 3-2 (and current orders page) fetches all order_items for item count and total calculations. At current scale this is acceptable.

8. **`lib/supabase/client.ts` already exists** — The browser client is already configured. Use it for Realtime subscription in the Client Component.

9. **UI Language is English** — All labels, buttons, toasts must be in English per project feedback.

10. **Code review findings from Story 3-1:** Never trust client-submitted data for prices (handled by RPC). Always redirect on missing profile instead of defaulting role.

### Git Intelligence

**Recent commits:**
- `24f886f` fix: rename proxy.ts to middleware-utils.ts to avoid Vercel Edge module conflict
- `220151e` feat: add stories 1-3 through 3-1 — settings, users, products, categories, orders

**Patterns established:**
- `feat:` for new features
- Commits include story reference
- Recommended: `feat: add real-time order list with Supabase Realtime subscription (story 3-3)`

### References

- [Source: epics.md — Epic 3, Story 3.3] User story, acceptance criteria, Realtime requirements
- [Source: prd.md — FR30] Order lists update in real time for Admins and Factory Users
- [Source: architecture.md — D5] RLS helper functions auth_role() / auth_store_id()
- [Source: architecture.md — D8] SSR + Targeted Realtime pattern, router.refresh(), channel naming
- [Source: architecture.md — Project Structure] realtime-order-list.tsx component location
- [Source: architecture.md — Real-time Order Update Flow] Event flow diagram
- [Source: ux-design-specification.md — Journey 2] Sandra approves order, real-time updates
- [Source: ux-design-specification.md — Status Colors] Gray/Amber/Green/Red/Blue per status
- [Source: Story 3-1 — Dev Notes] date-fns not installed, formatPrice exists, RLS patterns, async params
- [Source: Story 3-2 — Dev Notes] Status constants extracted to shared file, store name query pattern
- [Source: Story 3-2 — Completion Notes] Shared order-status.ts constants, orange border, store names
- [Source: memory/feedback_ui_language.md] UI must be in English

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation with no issues.

### Completion Notes List

- First Supabase Realtime usage in the project — established the canonical SSR + Realtime pattern (D8)
- RealtimeOrderList component includes a "Live" indicator (green pulsing dot) when WebSocket is connected
- Admin/factory order list wrapped in RealtimeOrderList; store users are NOT wrapped (per FR30)
- Order detail page now shows store name and submitter name for admin/factory roles (parallel fetched via Promise.all)
- Also fixed tsconfig.json to exclude nested `scotty-ops/` subdirectory from TypeScript compilation (pre-existing issue)
- Build: zero errors, Lint: zero errors, TypeScript: zero errors

### File List

**Created:**
- `supabase/migrations/20260317120000_enable_orders_realtime.sql` — Enable Realtime publication on orders table
- `components/orders/realtime-order-list.tsx` — Client Component wrapper that subscribes to Supabase Realtime and calls router.refresh()

**Modified:**
- `app/(dashboard)/orders/page.tsx` — Wrap order list in RealtimeOrderList for admin/factory roles
- `app/(dashboard)/orders/[order-id]/page.tsx` — Add submitter name and store name for admin/factory roles
- `tsconfig.json` — Exclude nested scotty-ops/ subdirectory from compilation
