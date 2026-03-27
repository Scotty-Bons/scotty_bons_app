# Quick Spec: Admin Dashboard — Visual Redesign

## Change Summary

Redesign the admin dashboard page (`app/(dashboard)/dashboard/page.tsx`) from a flat, table-heavy utilitarian layout into a visually engaging, card-based dashboard with progress bars, color-coded indicators, sparkline-style visual cues, and better information hierarchy. **No functionality, data, or route changes** — purely visual/layout restructuring of the same data already fetched.

## Current State

The admin dashboard is a single ~680-line server component that renders:
- 4 flat KPI cards (Total Orders, Pending, Approved, Revenue) — all identical gray cards with a small icon and a number
- Orders by Status — 4 more flat cards with badges
- Orders by Store — plain divider list
- Recent Orders — plain divider list
- Compliance Overview — 4 more flat cards + 2 divider lists (by store, recent audits)
- Order Analytics — plain HTML table (monthly summary) + 2 more divider lists (top stores, popular products)

**Problems:**
1. **Visual monotony** — every section looks identical (white card + divide-y list), no visual hierarchy
2. **No data visualization** — numbers without context (is 42 orders good? bad? trending up?)
3. **Too much scrolling** — ~8 sections stacked vertically, important info buried at the bottom
4. **No color coding** — everything is gray/white, the warm ScottyBons orange is barely used
5. **No actionable emphasis** — pending orders requiring attention look the same as completed stats

## Target State

### Layout: 2-Column Grid with Priority Zones

```
┌─────────────────────────────────────────────┐
│  Welcome back, Admin!          [date today]  │
├──────────────────────┬──────────────────────┤
│  ★ Pending Orders    │  Revenue (month)     │
│  big number + badge  │  big number + trend  │
├──────────────────────┼──────────────────────┤
│  Approved Orders     │  Total Orders        │
│  number + progress   │  number + progress   │
├──────────────────────┴──────────────────────┤
│  ⚡ Needs Attention                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │Pending:X│ │Below70:Y│ │InProg:Z │       │
│  └─────────┘ └─────────┘ └─────────┘       │
├──────────────────────┬──────────────────────┤
│  Orders by Status    │  Compliance by Store │
│  ┌──── bar chart ──┐ │  ┌── score bars ───┐ │
│  │ Submitted ████░░│ │  │ Store A ████░ 82│ │
│  │ Approved  ██████│ │  │ Store B ███░░ 65│ │
│  │ Declined  █░░░░░│ │  │ Store C █████ 91│ │
│  │ Fulfilled ████░░│ │  └─────────────────┘ │
│  └─────────────────┘ │                      │
├──────────────────────┼──────────────────────┤
│  Recent Orders (5)   │  Recent Audits (5)   │
│  card list           │  card list           │
├──────────────────────┴──────────────────────┤
│  Monthly Trend (6 months)                    │
│  ┌── horizontal bar chart ───────────────┐  │
│  │ Mar 2026  ████████████  $12,400  (45) │  │
│  │ Feb 2026  ██████████    $10,200  (38) │  │
│  │ ...                                    │  │
│  └────────────────────────────────────────┘  │
├──────────────────────┬──────────────────────┤
│  Top Stores (5)      │  Popular Products(10)│
│  ranked cards        │  ranked cards        │
└──────────────────────┴──────────────────────┘
```

### Design Details

#### 1. Welcome Header
- `text-2xl font-bold` greeting: "Dashboard"
- Subtitle: today's date formatted
- No card wrapper — directly in the page

#### 2. KPI Cards (Top Row) — 2x2 Grid
Each card gets a **colored left accent strip** and **contextual icon background**:

| Card | Accent Color | Icon | Extra Visual |
|------|-------------|------|-------------|
| Pending Orders | `orange-500` (warning) | `Clock` | Pulsing dot if > 0, text "needs review" |
| Revenue | `emerald-500` | `DollarSign` | Show current month total vs last month % change |
| Approved Orders | `blue-500` | `CheckCircle` | Progress ring or fraction `{approved}/{total}` |
| Total Orders | `primary` (orange) | `Package` | Small "all time" label |

Card structure:
```
┌─ accent border-l-4 ─────────────────────┐
│  [icon in colored circle]               │
│  Label (text-sm text-muted-foreground)  │
│  Number (text-3xl font-bold)            │
│  Subtext (text-xs trend/context)        │
└─────────────────────────────────────────┘
```

#### 3. "Needs Attention" Alert Banner
Only shown when there are pending orders, stores below 70%, or in-progress audits:
- `bg-orange-50 border border-orange-200 rounded-2xl p-4`
- Horizontal row of mini-stat pills with icons
- Each pill: icon + number + label, clickable (links to relevant page)
- `AlertTriangle` icon at left of the banner title

#### 4. Orders by Status — Horizontal Bar Chart (CSS-only)
Replace the 4 identical cards with a single card containing visual bars:
- Each status gets a horizontal bar whose width is proportional to `count / totalOrders * 100%`
- Bar colors: submitted=`orange-400`, approved=`blue-500`, declined=`red-400`, fulfilled=`emerald-500`
- Label on left, count on right, bar in the middle
- All rendered with Tailwind `bg-*` and inline `style={{ width: pct% }}`

#### 5. Compliance by Store — Score Progress Bars
Replace the flat divider list with visual score bars:
- Each store: name on left, horizontal progress bar (filled to score%), score number on right
- Bar color derived from score: red (<60), orange (60-79), green (80+) using existing `getScoreColor`
- Sorted worst-first (already is)
- Clickable row (could link to store audit list)

#### 6. Recent Orders & Recent Audits — Side by Side
Two columns on desktop, stacked on mobile:
- Each item is a compact card with:
  - Left: colored dot/icon indicating status
  - Middle: order number/audit name + date + store
  - Right: amount/score badge
- "View all" link at bottom of each section → links to `/orders` and `/audits`

#### 7. Monthly Trend — Visual Bar Chart
Replace the HTML `<table>` with horizontal bars:
- Each month: label (left), bar (proportional to revenue), revenue amount (right), order count in parentheses
- Bar color: `bg-primary` (orange)
- Shows relative comparison between months visually

#### 8. Top Stores & Popular Products — Ranked Cards Side by Side
- Each item gets a rank number (#1, #2...) in a colored circle
- #1 gets `bg-primary text-white`, others get `bg-muted`
- Store items show a mini progress bar proportional to max revenue
- Product items show quantity with a small unit bar

### Color Palette Usage

| Element | Color | Tailwind Class |
|---------|-------|---------------|
| Pending/Warning | Warm orange | `text-orange-500 bg-orange-50` |
| Revenue/Success | Green | `text-emerald-600 bg-emerald-50` |
| Approved/Info | Blue | `text-blue-600 bg-blue-50` |
| Declined/Error | Red | `text-red-500 bg-red-50` |
| Fulfilled/Complete | Emerald | `text-emerald-500 bg-emerald-50` |
| Primary accent | Brand orange | `text-primary bg-[hsl(var(--primary-light))]` |
| Neutral | Gray | `text-muted-foreground` |

### Responsive Behavior

| Breakpoint | Layout |
|-----------|--------|
| `< sm` (mobile) | Single column, KPI cards 2x2, sections stacked |
| `sm` – `lg` | 2-column grid for lists, KPI cards 2x2 |
| `≥ lg` | Full 2-column layout as shown in wireframe |

---

## Implementation Plan

### Single file to modify: `app/(dashboard)/dashboard/page.tsx`

**No new files, no new components, no new dependencies.** All changes are in the JSX/Tailwind of the existing page. The data fetching and aggregation logic stays exactly the same.

#### Changes:

1. **Welcome header** — Replace plain `<h1>` with greeting + date subtitle

2. **KPI cards section** — Replace the 4 identical `<Card>` blocks with visually distinct cards using:
   - `border-l-4 border-{color}` for left accent
   - Icon wrapped in colored circle: `<div className="rounded-full bg-{color}-50 p-2.5">`
   - `text-3xl font-bold` for the number (up from `text-2xl`)
   - Contextual subtitle text (e.g., "needs review" for pending)

3. **"Needs Attention" banner** — Add conditional section after KPI cards:
   ```tsx
   {(pendingOrders > 0 || storesBelow70 > 0 || inProgressCount > 0) && (
     <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
       ...pills...
     </div>
   )}
   ```

4. **Orders by Status** — Replace 4 badge+number cards with horizontal bar visualization:
   ```tsx
   <div className="space-y-3">
     {ALL_STATUSES.map(status => {
       const pct = totalOrders > 0 ? (statusCounts[status] / totalOrders) * 100 : 0;
       return (
         <div key={status} className="flex items-center gap-3">
           <span className="w-20 text-sm">{STATUS_LABELS[status]}</span>
           <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
             <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
           </div>
           <span className="w-8 text-sm font-bold text-right">{statusCounts[status]}</span>
         </div>
       );
     })}
   </div>
   ```

5. **Compliance by Store** — Replace divider list with progress bar rows (same pattern as #4 but using score percentage)

6. **Recent Orders + Recent Audits** — Wrap in `grid lg:grid-cols-2 gap-6`, add colored status dots, add "View all →" links

7. **Monthly Trend** — Replace `<table>` with bar chart rows (same visual pattern), remove table header/body

8. **Top Stores + Popular Products** — Wrap in `grid lg:grid-cols-2 gap-6`, add rank circles, add mini progress bars

9. **Orders by Store** — Add mini bar proportional to max count, keep existing data

#### Helper variables to add (pure computation, no new fetches):

```tsx
// Month-over-month change for revenue
const currentMonthKey = monthlySorted[0]?.[0];
const lastMonthKey = monthlySorted[1]?.[0];
const currentMonthRevenue = currentMonthKey ? monthlyData[currentMonthKey].total : 0;
const lastMonthRevenue = lastMonthKey ? monthlyData[lastMonthKey].total : 0;
const revenueChange = lastMonthRevenue > 0
  ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
  : 0;

// Max values for proportional bars
const maxMonthlyRevenue = Math.max(...monthlySorted.map(([, d]) => d.total), 1);
const maxStoreOrders = Math.max(...Object.values(storeAgg).map(a => a.count), 1);
const maxStoreRevenue = Math.max(...topStores.map(([, d]) => d.total), 1);
const maxProductQty = Math.max(...topProducts.map(p => p.total), 1);

// Bar color map for order statuses
const STATUS_BAR_COLORS: Record<OrderStatus, string> = {
  submitted: "#f97316",  // orange-500
  approved: "#3b82f6",   // blue-500
  declined: "#ef4444",   // red-500
  fulfilled: "#10b981",  // emerald-500
};
```

---

## Out of Scope

- No charting libraries (recharts, chart.js, etc.) — all visualizations are CSS-only with Tailwind
- No new components or files — everything in the single page file
- No data model changes, no new API calls, no new Supabase queries
- No changes to other pages or shared components
- No dark mode specific tuning (tokens handle it automatically)

## Dependencies / Blockers

- None. All design tokens (`--primary`, `--primary-light`, etc.) are already configured in `globals.css`
- All data is already fetched and aggregated in the existing component
- All utility functions (`formatPrice`, `getScoreColor`, `getScoreLabel`) already exist

## Testing Approach

- Visual: compare before/after at 375px, 768px, 1280px
- Verify all numbers match the current dashboard (no data logic changes)
- Verify all links still work (recent orders → order detail, recent audits → audit detail)
- Check dark mode doesn't break
- Existing e2e tests should pass (no selector changes that affect functionality)
