# Story 7.1: Admin — Compliance Dashboard

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to see a compliance dashboard with audit metrics across all stores,
so that I can quickly identify stores that need attention and track overall compliance trends.

## Acceptance Criteria

1. **Given** an Admin navigates to `/dashboard`,
   **When** the page loads,
   **Then** a new "Compliance Overview" section is displayed below the existing order dashboard, showing aggregate audit metrics.

2. **Given** audits exist in the system,
   **When** the compliance section renders,
   **Then** summary cards show: Total Audits, Average Score (%), Audits In Progress, and Stores Below 70% Score.

3. **Given** completed audits exist for multiple stores,
   **When** the "Compliance by Store" table renders,
   **Then** each row shows: Store Name, Total Audits, Average Score, Last Audit Date, and a color-coded compliance badge (Good ≥ 80%, Needs Attention 60–79%, Critical < 60%).

4. **Given** no audits exist yet,
   **When** the compliance section renders,
   **Then** an empty state is shown with the message "No audits have been conducted yet."

5. **Given** the compliance table has data,
   **When** the Admin views the table,
   **Then** rows are sorted by average score ascending (worst first) so problem stores are immediately visible.

6. **Given** a recent audits list is displayed,
   **When** the Admin views the section,
   **Then** the 5 most recent completed audits are shown with: Store Name, Template Name, Score, and Date — each linking to `/audits/{audit-id}`.

7. **Given** a Store or Commissary user navigates to `/dashboard`,
   **When** the page loads,
   **Then** they are redirected to `/orders` (existing behavior — no change needed).

8. **Given** any compliance dashboard data is rendered,
   **When** displayed,
   **Then** all scores are formatted as percentages with one decimal place (e.g., "85.5%"), dates use `Intl.DateTimeFormat("en-CA", { dateStyle: "medium" })`, and all UI text is in English.

## Tasks / Subtasks

- [ ] Task 1 — Extend dashboard page with compliance data fetching (AC: #1, #2, #3, #4)
  - [ ] In `app/(dashboard)/dashboard/page.tsx`, add parallel fetches for:
    - `supabase.from("audits").select("id, store_id, template_id, score, conducted_at, created_at").not("conducted_at", "is", null)` — completed audits
    - `supabase.from("audits").select("id", { count: "exact", head: true }).is("conducted_at", null)` — in-progress count
  - [ ] Compute aggregate metrics: total completed, average score, in-progress count, stores below 70%
  - [ ] Group completed audits by `store_id` to build per-store aggregates: count, avg score, last audit date
  - [ ] Reuse existing store names map from orders section

- [ ] Task 2 — Compliance summary cards (AC: #2)
  - [ ] Add a "Compliance Overview" heading below the existing orders section
  - [ ] Render 4 summary cards in a grid matching the existing order cards style:
    - Total Audits (icon: `ClipboardCheck`)
    - Average Score (icon: `BarChart3`)
    - In Progress (icon: `Clock`)
    - Stores Below 70% (icon: `AlertTriangle`)

- [ ] Task 3 — Compliance by Store table (AC: #3, #5)
  - [ ] Create a Card with "Compliance by Store" heading
  - [ ] Render rows sorted by average score ascending
  - [ ] Each row shows: store name, audit count, average score (formatted), last audit date, compliance badge
  - [ ] Compliance badge: `Good` (green, ≥80%), `Needs Attention` (amber, 60–79%), `Critical` (red, <60%)

- [ ] Task 4 — Recent Completed Audits list (AC: #6)
  - [ ] Add "Recent Audits" section showing latest 5 completed audits
  - [ ] Each row links to `/audits/{audit-id}` and shows: template name, store name, score, date
  - [ ] Fetch template names for display (reuse pattern from audits page)

- [ ] Task 5 — Empty state handling (AC: #4)
  - [ ] If no completed audits exist, show a Card with ClipboardCheck icon and "No audits have been conducted yet." message
  - [ ] Hide the compliance by store table and recent audits section in this case

- [ ] Task 6 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { AuditRow } from "@/lib/types"
CN utility:              import { cn } from "@/lib/utils"
formatPrice:             import { formatPrice } from "@/lib/utils"
UI components:           Badge, Card, CardContent, CardHeader, CardTitle from @/components/ui/*
Score helpers:           import { getScoreColor, getScoreLabel } from "@/lib/constants/audit-status"
Icons:                   ClipboardCheck, BarChart3, Clock, AlertTriangle from lucide-react
Date formatting:         new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" })
```

## Dev Notes

### Implementation Approach

This story extends the existing `app/(dashboard)/dashboard/page.tsx` — it does NOT create a new page. The compliance section is appended below the existing order metrics.

### Data Fetching Pattern

Add the audit fetches to the existing `Promise.all` block:

```typescript
const [ordersResult, itemsResult, storesResult, completedAuditsResult, inProgressCountResult] = await Promise.all([
  // ... existing order fetches ...
  supabase
    .from("audits")
    .select("id, store_id, template_id, score, conducted_at, created_at")
    .not("conducted_at", "is", null)
    .order("conducted_at", { ascending: false }),
  supabase
    .from("audits")
    .select("id", { count: "exact", head: true })
    .is("conducted_at", null),
]);

const completedAudits = completedAuditsResult.data ?? [];
const inProgressCount = inProgressCountResult.count ?? 0;
```

### Store Aggregation

```typescript
const storeCompliance: Record<string, { count: number; totalScore: number; lastDate: string }> = {};
for (const audit of completedAudits) {
  const existing = storeCompliance[audit.store_id] ?? { count: 0, totalScore: 0, lastDate: "" };
  existing.count++;
  existing.totalScore += audit.score ?? 0;
  if (audit.conducted_at && audit.conducted_at > existing.lastDate) {
    existing.lastDate = audit.conducted_at;
  }
  storeCompliance[audit.store_id] = existing;
}
```

### Compliance Badge Component

```tsx
function ComplianceBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-green-600 text-white">Good</Badge>;
  if (score >= 60) return <Badge className="bg-amber-500 text-white">Needs Attention</Badge>;
  return <Badge className="bg-red-600 text-white">Critical</Badge>;
}
```

### Anti-Patterns — NEVER DO

- `select('*')` in application code — always select specific columns
- Create a separate page for compliance — this is part of the existing dashboard
- Install chart libraries (recharts, chart.js) — use simple HTML/CSS cards and tables
- Use `date-fns` — use `Intl.DateTimeFormat` instead (date-fns is NOT installed)
- Fetch data in client components — the dashboard is a Server Component
- Show compliance data to non-admin users

## Project Structure Notes

**Files to MODIFY:**

```
app/(dashboard)/dashboard/page.tsx     — Add compliance section below orders
lib/constants/audit-status.ts          — Add compliance badge helpers if needed
```

**Files NOT to touch:**
- No new files needed — this extends the existing dashboard page
- No migrations — reads existing audit data
- No new components needed — all rendering is in the Server Component page

## Architecture Compliance

**D5 — RLS Policy Design:** Admin-only page; RLS already allows admin to SELECT all audits.

**D7 — Server Actions:** No new server actions needed — this is read-only data fetching in a Server Component.

**D9 — Error Handling:** Graceful fallback to empty state if audit queries return no data.

## Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin navigates to Dashboard — compliance section visible below orders
- Manual: With completed audits, summary cards show correct counts and averages
- Manual: Compliance by Store table shows all stores with audits, sorted worst-first
- Manual: Stores below 70% count matches the number of stores with avg score < 70
- Manual: Recent Audits shows last 5 completed, each linking to correct audit detail page
- Manual: With no audits, empty state message is shown
- Manual: Store user redirected to /orders (existing behavior unchanged)

## Previous Story Intelligence

1. **Dashboard page pattern** — `app/(dashboard)/dashboard/page.tsx` already fetches orders, items, and stores in parallel. Extend this pattern.
2. **Score helpers exist** — `lib/constants/audit-status.ts` has `getScoreColor()` and `getScoreLabel()`. Reuse for badge styling.
3. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat` for date formatting.
4. **UI Language is English** — all labels, toasts, validation messages in English.
5. **`formatPrice()` exists** in `lib/utils` for currency formatting.

## Git Intelligence

Recent related commits:
- `dc449a3` fix: code review — security and correctness fixes for Sprint 2
- `27ae503` feat: implement all Sprint 2 stories (Epics 4-6, 9 stories)

Recommended commit message:
```
feat: story 7-1 — admin compliance dashboard with store metrics
```

## References

- [Source: app/(dashboard)/dashboard/page.tsx] Existing dashboard implementation
- [Source: lib/constants/audit-status.ts] Score color/label helpers
- [Source: lib/types/index.ts] AuditRow type definition
- [Source: memory/feedback_ui_language.md] UI must be in English
