# Quick Tech Spec: Fix Dashboard Date Filter ("All" Range + Chart Title)

Status: ready-for-dev

## Change Summary

Two fixes to the dashboard date filter behavior:

1. **"All time" should start from the earliest data in the system**, not from Unix epoch (1970). Currently `new Date(0)` generates hundreds of empty month labels in the Order Value chart. Fix: query for the earliest `orders.created_at` and `audits.conducted_at`, use whichever is oldest as the range start.

2. **Order Value Chart title is hardcoded to "Last 12 Months"** regardless of the selected filter. Fix: pass the `rangeLabel` to the chart and display it dynamically.

## Motivation

When a user selects "All" in the date filter, the Order Value chart renders month labels starting from Jan 1970, producing ~670 empty bars before any real data appears — the chart is effectively unusable. Additionally, the chart title always says "Last 12 Months" even when a different range is selected, which is confusing.

Note: All four dashboard sections (status cards, order value chart, audit ranking, top products) are already correctly filtered by the date range server-side. No changes needed for sections 3 and 4 — only the "All" range calculation and the chart title need fixing.

## Scope

### In Scope
- Fix `getDateRange("all")` to query earliest record date instead of epoch
- Update `OrderValueChart` title to reflect the actual selected range
- Fix export dialog's hardcoded `2020-01-01` for "all" to also use earliest date

### Out of Scope
- Changing which sections are affected by the date filter (already working)
- Adding new filter options
- Any database or RLS changes

## Changes Required

### 1. Modify: `app/(dashboard)/dashboard/page.tsx`

**Fix "all" range — query earliest dates before main fetch:**

After the profile check (line 156), add an early query when range is "all":

```typescript
// ── Resolve "all" range to earliest data date ──
let resolvedRangeFrom = rangeFrom;
if (rangeKey === "all") {
  const [earliestOrder, earliestAudit] = await Promise.all([
    supabase
      .from("orders")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .single(),
    supabase
      .from("audits")
      .select("conducted_at")
      .not("conducted_at", "is", null)
      .order("conducted_at", { ascending: true })
      .limit(1)
      .single(),
  ]);

  const dates = [
    earliestOrder.data?.created_at,
    earliestAudit.data?.conducted_at,
  ].filter(Boolean) as string[];

  if (dates.length > 0) {
    dates.sort();
    resolvedRangeFrom = new Date(dates[0]);
  }
}
```

Then update `rangeFromISO` to use `resolvedRangeFrom`:

```diff
- const rangeFromISO = rangeFrom.toISOString();
+ const rangeFromISO = resolvedRangeFrom.toISOString();
```

And update the chart month generation to use `resolvedRangeFrom`:

```diff
- const chartStart = new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), 1);
+ const chartStart = new Date(resolvedRangeFrom.getFullYear(), resolvedRangeFrom.getMonth(), 1);
```

**Pass `rangeLabel` to `OrderValueChart`:**

```diff
  <OrderValueChart
    data={orderValueChartData}
    stores={stores
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name))}
    storeNames={sortedStoreNames}
    colors={storeColors}
+   rangeLabel={rangeLabel}
  />
```

### 2. Modify: `components/dashboard/order-value-chart.tsx`

**Accept and display `rangeLabel`:**

```diff
  interface OrderValueChartProps {
    data: OrderValueDataPoint[];
    stores: { id: string; name: string }[];
    storeNames: string[];
    colors: Record<string, string>;
+   rangeLabel: string;
  }
```

```diff
  export function OrderValueChart({
    data,
    stores,
    storeNames,
    colors,
+   rangeLabel,
  }: OrderValueChartProps) {
```

Update both title instances (line 75 empty state and line 89 normal state):

```diff
- Monthly Order Value (Last 12 Months)
+ Monthly Order Value ({rangeLabel})
```

### 3. Modify: `components/dashboard/export-top-products-dialog.tsx`

Fix the hardcoded `2020-01-01` for "all" range. Since the export dialog builds its own date range from the `currentRange` prop, the simplest fix is to use a very early but reasonable date (matching the behavior of the main page would require passing the resolved date). Use 5 years ago as a safe fallback:

```diff
- case "all": return { from: "2020-01-01", to };
+ case "all": {
+   const d = new Date();
+   d.setFullYear(d.getFullYear() - 10);
+   return { from: d.toISOString().slice(0, 10), to };
+ }
```

## Validation Criteria

- [ ] Selecting "All" in date filter shows data starting from the earliest order/audit date, not 1970
- [ ] The Order Value chart shows a reasonable number of month bars when "All" is selected
- [ ] Chart title reflects the selected range (e.g., "Monthly Order Value (All time)", "Monthly Order Value (Last 7 days)")
- [ ] All four dashboard sections still update correctly when changing date filters
- [ ] Default "12m" range continues to work as before
- [ ] Export dialog "All" range uses a reasonable start date
- [ ] No regressions on any dashboard section
