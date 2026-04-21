---
title: 'Flat Ad & Royalties Fee — Apply Once on Summaries Only'
slug: 'flat-ad-fee-summary-only'
created: '2026-04-21'
status: 'completed'
stepsCompleted: [1, 2, 3, 4, 5, 6]
adversarial_review_applied: [F1, F2, F3, F4, F5, F6, F7, F8, F9]
adversarial_review_deferred: [F10, F11, F12, F13]
tech_stack:
  - Next.js 15 (App Router, React 19)
  - TypeScript
  - Supabase (Postgres + RLS + SECURITY DEFINER RPC)
  - jsPDF + jspdf-autotable (PDF generation)
  - Resend (transactional email)
files_to_modify:
  - app/(dashboard)/orders/[order-id]/page.tsx
  - app/(dashboard)/invoices/[invoice-id]/page.tsx
  - lib/pdf/generate-order-pdf.ts
  - lib/pdf/generate-invoice-pdf.ts
  - lib/pdf/generate-pdf-buffer.ts
  - lib/email/order-notifications.ts
  - components/orders/order-selection-summary.tsx
  - components/invoices/invoice-selection-summary.tsx
  - components/invoices/export-invoice-pdf-button.tsx
  - app/(dashboard)/invoices/actions.ts
  - app/(dashboard)/orders/actions.ts
  - lib/settings/actions.ts
  - lib/types/index.ts
  - supabase/migrations/20260421100000_drop_invoice_ad_royalties_fee.sql
code_patterns:
  - Server Components fetch via createClient() then compose props for client children
  - PDF generation functions accept a plain object shaped like DB row; no Supabase dependency in lib/pdf
  - Selection summaries are client components that call server actions to aggregate totals on demand
  - Stored procedure fulfill_order_with_invoice runs SECURITY DEFINER and is the single writer to invoices
  - PDF input interfaces are inlined per caller (no shared invoice/order row type in lib/pdf) — keep in sync manually
  - Financial settings live in a key/value table (financial_settings); read via a shared getFinancialSettings in lib/settings/actions.ts (extracted in this spec)
test_patterns:
  - No automated test suite in the repo (only node_modules test files exist)
  - Manual UI verification across /orders, /orders/[id], /invoices, /invoices/[id] and both selection summaries
  - SQL verification of migration via supabase db diff + manual pre/post row inspection on a shadow DB
---

# Tech-Spec: Flat Ad & Royalties Fee — Apply Once on Summaries Only

**Created:** 2026-04-21

## Overview

### Problem Statement

Today the "Ad & Royalties Fee" behaves as a per-order charge:

- Persisted on each row of `invoices.ad_royalties_fee` and baked into each invoice's `grand_total`.
- Rendered as a line item on the order detail page, invoice detail page, order/invoice PDFs, and in the order-notification email body (via the shared PDF buffer).
- Multiplied by the number of selected items on the aggregated selection summaries (orders: `fee * ids.length`; invoices: sum of each invoice's stored fee), which over-counts the charge.

Business semantics have changed: the fee is now a single flat charge that exists only as a billing line when the admin compares/aggregates multiple orders or invoices. It must not appear or be charged per-order.

### Solution

Two-part change:

1. **Purge per-order surfaces.** Remove the Ad & Royalties Fee from the order detail page, invoice detail page, both PDF generators (and the shared PDF buffer), and the email payload. Recompute `grandTotal` in those surfaces as `subtotal + tax_amount` (no fee) **from the live `subtotal` + `tax_amount` fields — never from the stored `grand_total`** (F1 fix: belt-and-suspenders against partial migrations). Stop persisting `ad_royalties_fee` on `invoices` (drop the column) and update the `fulfill_order_with_invoice` stored procedure so it no longer reads the setting nor includes the fee in the stored `grand_total`. For historical invoices, snapshot the old total into a new `grand_total_original` column (F3: preserves audit trail for customer-issued PDFs), then set `grand_total = ROUND(subtotal + tax_amount, 2)` so stored totals remain consistent with the recomputed UI totals.
2. **Apply once on summaries.** Keep the fee line on both selection summaries (`order-selection-summary.tsx`, `invoice-selection-summary.tsx`), but change the computation so the fee is read once from `financial_settings.ad_royalties_fee` and added exactly once to the aggregated `grandTotal`, regardless of how many orders/invoices are selected.

### Scope

**In Scope:**

- Remove fee line + fee from grand_total in: order detail page, invoice detail page, order PDF, invoice PDF, shared PDF buffer (both order + invoice variants), email notification totals.
- **Invoice detail page and invoice PDF generator: recompute `grand_total` locally from `subtotal + tax_amount`** rather than reading `invoice.grand_total` from the DB (F1 fix).
- Add `invoices.grand_total_original NUMERIC(12,2) NULL` column to preserve historical stored totals before rewriting them (F3 fix).
- Drop `invoices.ad_royalties_fee` column; rewrite stored `grand_total` to `ROUND(subtotal + tax_amount, 2)` for all rows (F8: idempotent, self-healing).
- Back up the pre-migration totals into `invoices_pre_ad_fee_migration_backup` before any destructive statement (F2 fix).
- Wrap all destructive migration statements in an explicit `BEGIN; ... COMMIT;` block (F2 fix).
- Update stored procedure `fulfill_order_with_invoice` to stop reading `ad_royalties_fee` from `financial_settings`, stop including it in `INSERT INTO invoices` / `grand_total`, and **preserve `SECURITY DEFINER SET search_path = public, pg_temp`** (F9 fix).
- Update `getInvoiceTotalsForInvoices` action to stop selecting/returning `ad_royalties_fee` and **stop returning the misleading `tax_rate` aggregate** (F4 fix) — the invoices summary will use the current `hst_rate` from `getFinancialSettings` for display instead.
- Update `InvoiceRow` and PDF input interfaces in `lib/types/index.ts`, `lib/pdf/generate-order-pdf.ts`, `lib/pdf/generate-invoice-pdf.ts`, `lib/pdf/generate-pdf-buffer.ts` — remove `ad_royalties_fee`; invoice variants also gain a derived `grand_total` that is computed locally from `subtotal + tax_amount` (callers can stop passing `grand_total`).
- Change `order-selection-summary.tsx` to stop multiplying `fee * ids.length`; apply once.
- Change `invoice-selection-summary.tsx` to read fee AND current HST rate from `financial_settings` (via the new shared `getFinancialSettings`) instead of trusting per-invoice totals.
- **Extract `getFinancialSettings` from `app/(dashboard)/orders/actions.ts` into a new shared module `lib/settings/actions.ts`** so both summaries import it without crossing route-group boundaries (F6 fix). Update the re-export in `orders/actions.ts` to maintain the existing `@/app/(dashboard)/orders/actions` import site in `order-selection-summary.tsx`, or migrate that import to the new path in the same commit.

**Out of Scope:**

- Removing the `ad_royalties_fee` key from `financial_settings` (still required by summaries).
- `components/settings/financial-settings-form.tsx` UI (the input stays).
- HST / subtotal / rounding logic changes.
- Backfill of email copies already sent, or PDFs already downloaded by end-users.
- Reissuing historical invoices; only the stored `grand_total` is corrected.

## Context for Development

### Codebase Patterns

- **Financial settings access.** Server components read `financial_settings` via `supabase.from("financial_settings").select("key, value").in("key", [...])` and reduce into a map (see `app/(dashboard)/orders/[order-id]/page.tsx:75-77` and `lib/email/order-notifications.ts:41-42`). For the orders summary there is already a dedicated server action `getFinancialSettings` in `app/(dashboard)/orders/actions.ts` returning `{ hst_rate, ad_royalties_fee }`.
- **Selection summaries.** Both summary components (`components/orders/order-selection-summary.tsx`, `components/invoices/invoice-selection-summary.tsx`) use `useTransition` + a single "Show Summary" button that fans out a server action call; they render a `<Card>` with an aggregated table and a totals footer. Fee row is gated behind `{adFee > 0 && …}` — keep that gate.
- **PDF generation.** Lives in `lib/pdf/`. Each generator accepts a plain object shaped like the corresponding DB row — no Supabase imports. `generate-pdf-buffer.ts` is the headless variant used from server-side email sending and also exports both order + invoice generators.
- **Stored procedure.** `fulfill_order_with_invoice` is the only writer of `invoices` and runs `SECURITY DEFINER`. It is redefined (via `CREATE OR REPLACE FUNCTION`) in whichever migration last touched it — currently `supabase/migrations/20260325200000_add_order_numbers.sql:170-254`. Pattern: new migration re-creates the function with an updated body.
- **Migrations.** Pure SQL, timestamped `YYYYMMDDHHMMSS_*.sql`. Most recent: `supabase/migrations/20260411100000_allow_delete_user_with_orders.sql`. New migration must sort after that one.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `app/(dashboard)/orders/[order-id]/page.tsx` | Order detail — remove fee line (lines 363-375), drop `ad_royalties_fee` from the fetch + PDF props, recompute `grandTotal` without fee (line 139) |
| `app/(dashboard)/invoices/[invoice-id]/page.tsx` | Invoice detail — remove fee line (lines 205-210), drop `ad_royalties_fee` from the select (line 26) + PDF props (line 83) |
| `lib/pdf/generate-order-pdf.ts` | Order PDF — remove `ad_royalties_fee` from the input interface (line 22) and from the totals table (lines 205-207) |
| `lib/pdf/generate-invoice-pdf.ts` | Invoice PDF — same as above (lines 20, 169-171) |
| `lib/pdf/generate-pdf-buffer.ts` | Shared PDF buffer (used by email) — remove fee from both order + invoice variants (lines 27/143 + 181/297) |
| `lib/email/order-notifications.ts` | Email body — stop reading `ad_royalties_fee` from settings (line 42, 50); `grandTotal = subtotal + taxAmount`; drop field from pdfPayload (line 72) |
| `components/orders/order-selection-summary.tsx` | Orders summary — change line 106 from `fee * ids.length` to a single flat `settingsResult.data?.ad_royalties_fee ?? 0` |
| `components/invoices/invoice-selection-summary.tsx` | Invoices summary — stop reading `adFee` from `totalsResult.data`; import `getFinancialSettings` from `@/lib/settings/actions`; recompute grand_total locally = `Σ(subtotal) + Σ(tax_amount) + fee` (fee applied once); use **current** `hst_rate` from settings for the HST label (not `totalsResult.data.tax_rate`, which was the last invoice's rate — pre-existing F4 bug) |
| `components/invoices/export-invoice-pdf-button.tsx` | Export PDF button — remove `ad_royalties_fee: number \| null` and `grand_total: number` from the local `invoice` prop interface (line 24-25) to match the updated PDF input type; add `grand_total_original: number \| null` as an optional field if needed for audit display (not currently rendered) |
| `app/(dashboard)/invoices/actions.ts` | `getInvoiceTotalsForInvoices` — remove `ad_royalties_fee` AND `tax_rate` from select + return type (lines 31-71); summary computes rate from current `financial_settings.hst_rate` instead |
| `app/(dashboard)/orders/actions.ts` | Remove `getFinancialSettings` body; replace with a re-export `export { getFinancialSettings } from "@/lib/settings/actions";` OR delete and migrate the one call-site in `order-selection-summary.tsx` to the new import path. Prefer migration (cleaner), but the re-export option is allowed for minimal churn. |
| `lib/settings/actions.ts` | **NEW** — `"use server"` module exporting `getFinancialSettings(): Promise<ActionResult<{ hst_rate: number; ad_royalties_fee: number }>>`. Implementation copied verbatim from the current `orders/actions.ts:38-66`. No order/invoice coupling. |
| `lib/types/index.ts` | `InvoiceRow` — remove `ad_royalties_fee` (line 98) |
| `supabase/migrations/20260324100000_order_invoice_enhancements.sql` | Historical: added `ad_royalties_fee` column to invoices (line 26) |
| `supabase/migrations/20260325200000_add_order_numbers.sql` | Historical: current body of `fulfill_order_with_invoice` (lines 141-254) — base the rewrite on this; copy everything except the `v_ad_fee` declaration, the fetch of `ad_royalties_fee` from financial_settings (lines 210-215), the `+ v_ad_fee` in `v_grand_total` (line 230), and the `ad_royalties_fee` column + `v_ad_fee` value in the `INSERT INTO invoices` (lines 237, 243) |

### Technical Decisions

- **Historical data correction with backup (F2 + F3 + F8).** Migration executes in this exact order, inside an explicit `BEGIN; ... COMMIT;` block:
  1. `CREATE TABLE IF NOT EXISTS invoices_pre_ad_fee_migration_backup AS SELECT id, subtotal, tax_rate, tax_amount, ad_royalties_fee, grand_total FROM invoices;` — snapshot BEFORE any destructive statement (F2 fix; rollback-enabler).
  2. `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS grand_total_original NUMERIC(12,2);` — audit column (F3 fix).
  3. `UPDATE invoices SET grand_total_original = grand_total;` — persist original totals for customer-dispute reconciliation (F3 fix).
  4. `UPDATE invoices SET grand_total = ROUND(subtotal + tax_amount, 2);` — idempotent self-heal (F8 fix: no `WHERE ad_royalties_fee > 0` — this makes AC 10 provable by construction).
  5. `ALTER TABLE invoices DROP COLUMN ad_royalties_fee;`
  6. `CREATE OR REPLACE FUNCTION fulfill_order_with_invoice(...) ... SECURITY DEFINER SET search_path = public, pg_temp;` — with the body adjustments described in Task 1.
- **Recompute grand_total in the read path (F1).** The invoice detail page and both PDF generators compute `grandTotal = subtotal + tax_amount` locally rather than trusting `invoice.grand_total`. This is a belt-and-suspenders guard: if the migration is partially applied, unapplied on a given environment, or the backup is restored, the UI still renders a correct total. The stored `invoice.grand_total` becomes a duplicate (kept for indexing/reporting convenience, not for display).
- **Single source of truth for summary fee and HST rate (F4).** `financial_settings.ad_royalties_fee` and `financial_settings.hst_rate` are the authoritative values. Both summaries read them at comparison time via the shared `getFinancialSettings`. The invoice summary no longer uses `getInvoiceTotalsForInvoices.tax_rate` (which was the last invoice's rate, not an aggregate — pre-existing bug). The HST label in the invoice summary shows the current rate; summed `tax_amount` comes from historical invoice rows (they may have been taxed at different rates in the past — the summary is a comparison tool, not an accounting statement).
- **Shared settings action in a neutral module (F6).** `getFinancialSettings` is extracted from `app/(dashboard)/orders/actions.ts` into `lib/settings/actions.ts` so neither feature route group depends on the other. The existing call site in `order-selection-summary.tsx` is migrated to `@/lib/settings/actions` in the same commit (preferred) or served via a re-export in `orders/actions.ts` (allowed fallback). New callers (invoice summary) import only from `@/lib/settings/actions`.
- **Stored procedure rewrite, not patch (F9).** `fulfill_order_with_invoice` is recreated in full in a new migration; the new body drops `v_ad_fee`, the `ad_royalties_fee` column from the `INSERT`, and the `+ v_ad_fee` from `v_grand_total`. All other behavior (order-number derivation, commissary fetch, store lookup, invoice_items copy, idempotency via `fulfilled_at` check, optimistic-lock `WHERE status = 'approved'`) is preserved verbatim. `SECURITY DEFINER SET search_path = public, pg_temp` is preserved explicitly — AC 13 verifies this via `\df+`.
- **Atomic-commit contract for TS consumers (F5).** Tasks 2-12 must land as a single git commit (or equivalent single PR). Running `tsc --noEmit` between intermediate steps (e.g., after Task 3 but before Task 12) would fail because `getInvoiceTotalsForInvoices` removes a field that `invoice-selection-summary.tsx` still reads. The workflow is: apply all 12 code edits, then compile once at the end.
- **Invoice summary / order summary computation asymmetry, documented (F7).** The order summary recomputes totals from live `order_items` + current HST; the invoice summary sums frozen per-invoice `subtotal` and `tax_amount` + applies current fee/HST-label. For the *same underlying data*, the two Grand Totals will diverge whenever historical HST rates or item prices differ from current values. This is intentional — the summaries target different use cases — but it is not asserted as an invariant. If reconciliation is ever required, a unified summary action is the correct refactor.
- **Gate stays.** The `adFee > 0` conditional render in both summaries is preserved so that when an admin sets the fee to 0 the row disappears naturally.
- **No UI label change.** "Ad & Royalties Fee" stays as the displayed label on summaries.
- **Docs drift (out of scope, follow-up F12).** `docs/entrega.md` lines 92, 124, 180 mention "marketing royalties". These copy strings become misleading after this change. Tracked as a follow-up; not edited in this spec.
- **No automated tests.** The project has no Jest/Vitest/Playwright suite. Verification is manual + SQL. Baseline `npm run build` warnings should be captured pre-edit (F13).

## Implementation Plan

### Tasks

Tasks are ordered so that schema → types → writers → readers → UI → verification. **Tasks 2-12 must land as a single git commit / single PR** (F5: intermediate TypeScript compile will fail otherwise). Task 1 (migration) is a separate deliverable but must be applied to a given environment in the same release as that commit (F11 risk — see Notes).

- [x] **Task 1: Create migration that backs up, adds audit column, rewrites totals, drops the old column, and rewrites the SP — all in one transaction.**
  - File: `supabase/migrations/20260421100000_drop_invoice_ad_royalties_fee.sql` (new)
  - Action: Create a single migration containing this full block:
    ```sql
    BEGIN;

    -- F2: Snapshot before any destructive statement.
    CREATE TABLE IF NOT EXISTS invoices_pre_ad_fee_migration_backup AS
      SELECT id, subtotal, tax_rate, tax_amount, ad_royalties_fee, grand_total, now() AS backed_up_at
      FROM invoices;

    -- F3: Preserve original total for audit / customer-dispute reconciliation.
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS grand_total_original NUMERIC(12,2);
    UPDATE invoices SET grand_total_original = grand_total WHERE grand_total_original IS NULL;

    -- F8: Idempotent self-heal — always set grand_total to subtotal + tax_amount.
    UPDATE invoices SET grand_total = ROUND(subtotal + tax_amount, 2);

    ALTER TABLE invoices DROP COLUMN ad_royalties_fee;

    CREATE OR REPLACE FUNCTION fulfill_order_with_invoice(p_order_id uuid) RETURNS uuid
    AS $$
    -- body here — see sub-steps below
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

    COMMIT;
    ```
  - SP body instructions: paste the body from `supabase/migrations/20260325200000_add_order_numbers.sql:141-254` with these deletions: (a) remove the `v_ad_fee numeric` declaration; (b) remove the `SELECT COALESCE(value::numeric, 0) INTO v_ad_fee FROM financial_settings WHERE key = 'ad_royalties_fee'; IF v_ad_fee IS NULL THEN v_ad_fee := 0; END IF;` block (lines 210-215); (c) change `v_grand_total := v_subtotal + v_tax_amount + v_ad_fee;` to `v_grand_total := v_subtotal + v_tax_amount;`; (d) in the `INSERT INTO invoices (...)` column list remove `ad_royalties_fee,` and in the VALUES list remove `v_ad_fee,`; (e) **keep `SECURITY DEFINER SET search_path = public, pg_temp` on the outer `CREATE OR REPLACE FUNCTION ... $$ LANGUAGE plpgsql` line** (F9); (f) keep the early-return idempotency check, the `WHERE status = 'approved'` optimistic lock, and the `ORD-` → `INV-` derivation verbatim.
  - Notes: Do NOT DROP the `ad_royalties_fee` key from `financial_settings` — the settings form and both summaries still read it. The `invoices_pre_ad_fee_migration_backup` table is kept indefinitely — future cleanup is a separate ticket.

- [x] **Task 2: Create shared `lib/settings/actions.ts` module.**
  - File: `lib/settings/actions.ts` (new)
  - Action: Create a `"use server"` module exporting:
    ```ts
    "use server";
    import { createClient } from "@/lib/supabase/server";
    import type { ActionResult } from "@/lib/types";

    export async function getFinancialSettings(): Promise<
      ActionResult<{ hst_rate: number; ad_royalties_fee: number }>
    > {
      // Copy body verbatim from current app/(dashboard)/orders/actions.ts:38-66.
    }
    ```
  - Notes: Exact body copy from `orders/actions.ts:38-66`. Once this file exists, Tasks 3 and 12 can both import from it without crossing route-group boundaries (F6 fix).

- [x] **Task 3: Migrate `getFinancialSettings` out of `orders/actions.ts`.**
  - File: `app/(dashboard)/orders/actions.ts`
  - Action: Remove the `getFinancialSettings` function body (lines 38-66). Replace with a re-export: `export { getFinancialSettings } from "@/lib/settings/actions";` OR delete the function entirely and, in the same commit, change the import in `components/orders/order-selection-summary.tsx:8` from `"@/app/(dashboard)/orders/actions"` to `"@/lib/settings/actions"` (preferred — removes the indirection).
  - Notes: Choose the "migrate import" option unless it creates tangential diff noise.

- [x] **Task 4: Remove `ad_royalties_fee` from TypeScript types.**
  - File: `lib/types/index.ts`
  - Action: Delete `ad_royalties_fee: number;` from the `InvoiceRow` type (currently line 98). Also consider adding optional `grand_total_original?: number | null;` if any consumer needs to display it — **not required for this spec** (the field is audit-only), include only if the invoice detail page's dev decides to surface it.
  - Notes: The compiler will now flag every consumer — use the error list to confirm Tasks 5-12 cover them all. Run `tsc --noEmit` only after Task 12 completes (F5).

- [x] **Task 5: Trim `getInvoiceTotalsForInvoices`.**
  - File: `app/(dashboard)/invoices/actions.ts`
  - Action: In `getInvoiceTotalsForInvoices` (lines 31-71): remove BOTH `ad_royalties_fee` AND `tax_rate` from the return generic `Promise<ActionResult<{...}>>`, from the `.select("subtotal, tax_rate, tax_amount, ad_royalties_fee, grand_total")` call, from the `reduce` initial object and accumulator, and from the returned shape. The returned type becomes `{ subtotal: number; tax_amount: number; grand_total: number }`.
  - Notes: F4 — `tax_rate` was returning the last invoice's rate, not an aggregate. Dropping it forces the invoice summary to use the current rate from `getFinancialSettings`. `grand_total` sum is still valid post-migration (it now equals `Σ(subtotal) + Σ(tax_amount)`).

- [x] **Task 6: Update `lib/email/order-notifications.ts` to drop the fee from totals and PDF payload.**
  - File: `lib/email/order-notifications.ts`
  - Action: Remove `"ad_royalties_fee"` from the `.in("key", [...])` at line 42. Remove `const adRoyaltiesFee = Number(fsMap.ad_royalties_fee ?? "0");` at line 50. Change `const grandTotal = subtotal + taxAmount + adRoyaltiesFee;` to `const grandTotal = subtotal + taxAmount;`. Remove the `ad_royalties_fee: adRoyaltiesFee,` property from the `pdfPayload` object (line 72).
  - Notes: If the file composes any plain-text/HTML email body (not just the PDF attachment), ensure fee lines are removed there too. Verify by reading the full file after edit.

- [x] **Task 7: Update order detail page to drop the fee row and recompute grand total without the fee.**
  - File: `app/(dashboard)/orders/[order-id]/page.tsx`
  - Action: Remove `"ad_royalties_fee"` from the `.in("key", [...])` (line 77). Delete the `const adRoyaltiesFee = Number(fsMap.ad_royalties_fee ?? "0");` line (125). Change `const grandTotal = subtotal + taxAmount + adRoyaltiesFee;` to `const grandTotal = subtotal + taxAmount;`. Remove the `ad_royalties_fee: adRoyaltiesFee,` prop passed to the PDF component (line 212). Delete the `{adRoyaltiesFee > 0 && (<tr>...</tr>)}` totals row (lines 363-376).
  - Notes: Double-check the colSpan accounting of the Subtotal / HST / Grand Total rows — they may not need adjustment since each row was independently rendered.

- [x] **Task 8: Update invoice detail page — drop the fee row AND compute grand_total locally from subtotal + tax_amount.**
  - File: `app/(dashboard)/invoices/[invoice-id]/page.tsx`
  - Action:
    1. Remove `ad_royalties_fee,` from the `.select("...")` string (line 26).
    2. Delete `const adFee = Number(invoice.ad_royalties_fee ?? 0);` (line 46).
    3. **F1 FIX:** Add `const computedGrandTotal = Math.round((Number(invoice.subtotal) + Number(invoice.tax_amount)) * 100) / 100;` and use `computedGrandTotal` in place of `Number(invoice.grand_total)` in the render (line 214) AND in the PDF props (line 84).
    4. Remove the `ad_royalties_fee: invoice.ad_royalties_fee ? Number(invoice.ad_royalties_fee) : null,` prop passed to the PDF button (line 83).
    5. Delete the `<div className="flex justify-between">` block that renders "Ad & Royalties Fee" (lines 205-210).
  - Notes: The stored `invoice.grand_total` is no longer read for display — the page becomes robust against a partially applied or rolled-back migration (F1).

- [x] **Task 9: Remove the fee from the order PDF generator.**
  - File: `lib/pdf/generate-order-pdf.ts`
  - Action: Delete `ad_royalties_fee: number | null;` from the input interface (line 22). Delete `const adFee = Number(order.ad_royalties_fee ?? 0);` (line 168). Delete the `if (adFee > 0) { totalsLines.push(["Ad & Royalties Fee:", fmt(adFee)]); }` block (lines 205-207).
  - Notes: `totalsLines` order becomes `Subtotal → HST → Grand Total` — keep `Grand Total` last.

- [x] **Task 10: Update the invoice PDF generator — drop fee AND recompute grand_total locally.**
  - File: `lib/pdf/generate-invoice-pdf.ts`
  - Action:
    1. Delete `ad_royalties_fee: number | null;` from the input interface (line 20).
    2. Delete `const adFee = Number(invoice.ad_royalties_fee ?? 0);` (line 132).
    3. Delete the `if (adFee > 0) { totalsLines.push(...); }` block (lines 169-171).
    4. **F1 FIX:** In the line that renders `Grand Total`, replace `Number(invoice.grand_total)` with a locally computed value: `const grandTotal = Math.round((Number(invoice.subtotal) + Number(invoice.tax_amount)) * 100) / 100;` and use `grandTotal` in the `totalsLines.push(["Grand Total:", fmt(grandTotal)])` line (line 172).
  - Notes: `totalsLines` order becomes `Subtotal → HST → Grand Total`. The input interface can keep `grand_total` for backward compatibility of callers, but the generator ignores it in favor of the recomputed value.

- [x] **Task 11: Remove the fee from the shared PDF buffer (both order + invoice variants); recompute invoice grand_total locally.**
  - File: `lib/pdf/generate-pdf-buffer.ts`
  - Action:
    1. Delete `ad_royalties_fee: number | null;` from the order input interface (line 27) and the invoice input interface (line 181).
    2. Delete `const adFee = Number(order.ad_royalties_fee ?? 0);` (line 133) and `const adFee = Number(invoice.ad_royalties_fee ?? 0);` (line 287).
    3. Delete `if (adFee > 0) totalsLines.push(["Ad & Royalties Fee:", fmt(adFee)]);` at lines 143 and 297.
    4. **F1 FIX (invoice variant only):** In the invoice variant, replace `Number(invoice.grand_total)` at the `Grand Total` push (line 298) with `Math.round((Number(invoice.subtotal) + Number(invoice.tax_amount)) * 100) / 100`.
  - Notes: This file has both variants; take care not to leave stale `adFee` references. The order variant reads `order.grand_total` which is computed fresh server-side — no local recompute needed there.

- [x] **Task 12: Remove the fee field from the Export Invoice PDF button prop interface.**
  - File: `components/invoices/export-invoice-pdf-button.tsx`
  - Action: Delete `ad_royalties_fee: number | null;` from the local `invoice` prop type (line 24). No other changes required — the `generateInvoicePdf(invoice, items)` call will compile against the new input interface.
  - Notes: The button's caller (invoice detail page) was already updated in Task 8 to stop passing the field.

- [x] **Task 13: Change the orders selection summary so the fee is applied once, not `× ids.length`.**
  - File: `components/orders/order-selection-summary.tsx`
  - Action:
    1. If Task 3 chose the "migrate import" option, change the import on line 8 from `"@/app/(dashboard)/orders/actions"` to `"@/lib/settings/actions"` (keep `getOrderItemsForOrders` imported from the original path).
    2. On line 106, change `const fee = (settingsResult.data?.ad_royalties_fee ?? 0) * ids.length;` to `const fee = settingsResult.data?.ad_royalties_fee ?? 0;`. No other edits needed — subsequent lines already compute `grand = itemsTotal + tax + fee` and gate the row behind `{adFee > 0 && …}`.
  - Notes: The card title "Aggregated Summary ({selected.size} orders)" continues to reflect count; the fee row no longer scales with count.

- [x] **Task 14: Change the invoices selection summary to read the fee AND current HST rate from `financial_settings` (via the shared module).**
  - File: `components/invoices/invoice-selection-summary.tsx`
  - Action:
    1. Add the import: `import { getFinancialSettings } from "@/lib/settings/actions";` (F6 fix — not from `orders/actions`).
    2. In `fetchSummary` (lines 70-113), extend the `Promise.all` to include `getFinancialSettings()` as a third fetch: `const [itemsResult, totalsResult, settingsResult] = await Promise.all([getInvoiceItemsForInvoices(ids), getInvoiceTotalsForInvoices(ids), getFinancialSettings()]);`.
    3. Delete `setAdFee(totalsResult.data.ad_royalties_fee);` (line 109) and `setHstRate(totalsResult.data.tax_rate);` (line 107 — F4: use the current setting instead).
    4. Replace the `if (totalsResult.data) { … }` block with:
       ```ts
       if (totalsResult.data && settingsResult.data) {
         const flatFee = settingsResult.data.ad_royalties_fee ?? 0;
         const currentHstRate = settingsResult.data.hst_rate;
         setSubtotal(totalsResult.data.subtotal);
         setHstRate(currentHstRate);
         setHstAmount(totalsResult.data.tax_amount);
         setAdFee(flatFee);
         setGrandTotal(
           Math.round(
             (totalsResult.data.subtotal + totalsResult.data.tax_amount + flatFee) * 100,
           ) / 100,
         );
       }
       ```
  - Notes: The HST % *label* (line 199, 202) now reflects the current setting, not the last invoice's rate (F4 fix). Summed `tax_amount` is historical (per-invoice); this is an acceptable mismatch for a comparison tool — see F7 under Technical Decisions.

- [x] **Task 15: Compile, lint, and full-surface manual verification.**
  - Files: run the app locally (`npm run dev`) with a shadow Supabase DB that has the migration applied.
  - Action:
    1. Capture baseline (F13): `npm run build` before any edits — save warnings count.
    2. After Tasks 2-14 land in one commit, re-run `npm run build` — confirm no NEW errors or warnings.
    3. Run `rg "ad_royalties_fee|adFee|Royalties Fee|adRoyaltiesFee" --ignore-dir=_bmad-output --ignore-dir=node_modules` — matches must be limited to: `components/settings/financial-settings-form.tsx`, `lib/validations/settings.ts`, `app/(dashboard)/settings/actions.ts`, `lib/settings/actions.ts`, and the new migration file.
    4. Walk the manual test script in "Testing Strategy" below end-to-end.
  - Notes: If any surface still shows the fee, grep the codebase once more — the error is almost certainly a missed file.

### Acceptance Criteria

- [x] **AC 1: Order detail — no fee row.** Given a fulfilled order whose source financial settings had `ad_royalties_fee > 0`, when an admin opens the order detail page, then the totals section shows only `Subtotal`, `HST`, and `Grand Total`, and `Grand Total == Subtotal + HST`.

- [x] **AC 2: Order PDF — no fee row.** Given an order, when the admin exports it to PDF (either from the detail page or via the email attachment), then the PDF totals section contains exactly `Subtotal`, `HST`, `Grand Total`, and no `Ad & Royalties Fee` line.

- [x] **AC 3: Invoice detail — no fee row, grand_total recomputed locally.** Given an invoice row where the stored `grand_total` field is DELIBERATELY corrupted (set to `99999`) via SQL, when the admin opens the invoice detail page, then the displayed `Grand Total` still equals `ROUND(subtotal + tax_amount, 2)` — proving the page reads the computed value, not the stored field (F1 acceptance test).

- [x] **AC 4: Invoice PDF — no fee row, grand_total recomputed locally.** Given any invoice, when the admin clicks "Export PDF", then the generated PDF contains exactly `Subtotal`, `HST`, `Grand Total` and no fee line, AND the Grand Total equals `ROUND(subtotal + tax_amount, 2)` regardless of `invoice.grand_total` (F1 acceptance test).

- [x] **AC 5: Email notification — no fee row.** Given an order transitions into a status that triggers the email notification, when the recipient receives it, then the attached PDF contains exactly `Subtotal`, `HST`, `Grand Total` and no fee line, and the email body (if it renders totals independently) does not mention the fee.

- [x] **AC 6: Order summary — fee applied once.** Given `financial_settings.ad_royalties_fee = 50` and the admin selects N=3 orders in `/orders`, when they click "Show Summary", then the summary renders exactly one `Ad & Royalties Fee` row valued at `$50.00` and the `Grand Total = itemsTotal + tax + 50` (not `+ 150`).

- [x] **AC 7: Invoice summary — fee applied once.** Given `financial_settings.ad_royalties_fee = 50` and the admin selects N=3 invoices in `/invoices`, when they click "Show Summary", then the summary renders exactly one `Ad & Royalties Fee` row valued at `$50.00` and the `Grand Total = Σ(subtotal) + Σ(tax_amount) + 50`.

- [x] **AC 8: Zero-fee edge case.** Given `financial_settings.ad_royalties_fee = 0`, when the admin opens either selection summary, then no `Ad & Royalties Fee` row is rendered (the `adFee > 0` gate hides it) and `Grand Total = Σ(subtotal) + Σ(tax_amount)`.

- [x] **AC 9: Schema — column gone.** Given the migration has been applied to a database, when `psql` runs `\d invoices`, then the `ad_royalties_fee` column does not exist.

- [x] **AC 10: Historical data consistency.** Given the migration has been applied, when `SELECT id FROM invoices WHERE grand_total <> ROUND(subtotal + tax_amount, 2)` is run, then zero rows are returned. This is a tautology given Task 1 step 4 is idempotent over all rows (F8 fix makes it provable by construction, not by trust in the historical SP).

- [x] **AC 11: New invoice post-migration.** Given a user approves and fulfills an order after migration, when the `fulfill_order_with_invoice` RPC completes, then the new `invoices` row has `grand_total = ROUND(subtotal + tax_amount, 2)` and no fee is written anywhere.

- [x] **AC 12: Type-safety.** Given the codebase after edits, when `npm run build` (or `npx tsc --noEmit`) runs, then no references to `ad_royalties_fee` exist outside of `financial_settings` reads and `components/settings/financial-settings-form.tsx` / `lib/validations/settings.ts` / `app/(dashboard)/settings/actions.ts` / `lib/settings/actions.ts`, and the build passes with no NEW warnings compared to the pre-edit baseline (F13).

- [x] **AC 13: Stored procedure preserves SECURITY DEFINER and search_path pin (F9).** Given the migration has been applied, when `psql` runs `\df+ fulfill_order_with_invoice`, then the output shows both `Security: definer` and `Config: search_path=public, pg_temp`. (If either is missing, the function becomes vulnerable to search_path hijack.)

- [x] **AC 14: Stored procedure idempotency preserved (F9).** Given an already-fulfilled order, when `fulfill_order_with_invoice(p_order_id)` is called again, then it either returns the existing `invoice_id` (if early-return guard is present) or raises a controlled exception — but NEVER creates a duplicate row in `invoices`. Verify via `SELECT COUNT(*) FROM invoices WHERE order_id = <test-order-id>` (= 1 both times).

- [x] **AC 15: Backup table exists and is populated (F2).** Given the migration has been applied, when `SELECT COUNT(*) FROM invoices_pre_ad_fee_migration_backup` is run, then the count equals the pre-migration `invoices` row count, AND `SELECT id, ad_royalties_fee, grand_total FROM invoices_pre_ad_fee_migration_backup WHERE ad_royalties_fee > 0 LIMIT 5` returns rows that match the pre-migration originals.

- [x] **AC 16: Audit column populated (F3).** Given the migration has been applied, when `SELECT COUNT(*) FROM invoices WHERE grand_total_original IS NULL` is run, then zero rows are returned (all existing invoices have their original total preserved).

- [x] **AC 17: Summaries asymmetry is documented, not asserted (F7).** Given an order and its resulting invoice after HST rate changes once in `financial_settings`, when the admin compares both via their respective summaries, the two Grand Totals may differ — this is EXPECTED. Confirmed by inspection of the "Known Limitations" note; no code assertion required.

## Additional Context

### Dependencies

- **Database access.** Migration must be applied to every environment (local, staging, prod) before the frontend changes hit that environment, otherwise the `getInvoiceTotalsForInvoices` action would `SELECT ad_royalties_fee` from a column that no longer exists and error out — conversely applying the DB migration first while the old frontend still queries the column also errors. Preferred rollout: deploy code + migration together (standard Vercel + Supabase migrate pipeline).
- **No new libraries.** All work uses existing deps: Supabase SDK, jsPDF, jspdf-autotable, Resend.
- **No other feature dependencies.** This spec is self-contained; no other in-flight story blocks or is blocked by it.
- **Financial settings row required.** The `financial_settings.ad_royalties_fee` row must still exist (it already does — `supabase/migrations/20260324100000_order_invoice_enhancements.sql` seeds/upserts it via the settings form). Verify it is present in each environment.

### Testing Strategy

**Automated:** None (repo has no test suite). `npm run build` + `npm run lint` remain the TypeScript/ESLint safety net.

**Manual — UI (run `npm run dev` against a shadow DB with the migration applied):**

1. Create/seed a `financial_settings.ad_royalties_fee = 50.00`, HST = 13%.
2. Open an existing fulfilled order detail page → confirm totals: `Subtotal`, `HST`, `Grand Total` (no fee row); `Grand Total == Subtotal + HST`.
3. Click "Export PDF" on that order → open the PDF and confirm the totals table matches.
4. Open the corresponding invoice detail page → same check.
5. Click "Export PDF" on the invoice → same check.
6. Navigate to `/orders`, select 3 orders, click "Show Summary" → confirm `Ad & Royalties Fee` row equals `$50.00` (not `$150.00`); `Grand Total` reconciles.
7. Navigate to `/invoices`, select 3 invoices, click "Show Summary" → same check.
8. Set `financial_settings.ad_royalties_fee = 0` → refresh both summaries → confirm the fee row disappears.
9. Approve + fulfill a brand-new order → confirm the newly created invoice row (via DB inspection) has no `ad_royalties_fee` column and `grand_total = subtotal + tax_amount`.
10. Trigger the order notification email (whatever status transition fires `order-notifications.ts`) → inspect the email body and the attached PDF → confirm no fee line.

**SQL / migration verification:**

- Apply migration (it self-snapshots into `invoices_pre_ad_fee_migration_backup`).
- Confirm backup (AC 15): `SELECT (SELECT COUNT(*) FROM invoices) = (SELECT COUNT(*) FROM invoices_pre_ad_fee_migration_backup);` returns `t`.
- Confirm audit column (AC 16): `SELECT COUNT(*) FROM invoices WHERE grand_total_original IS NULL;` returns 0.
- Confirm total consistency (AC 10): `SELECT id FROM invoices WHERE grand_total <> ROUND(subtotal + tax_amount, 2);` returns 0 rows.
- Confirm column drop (AC 9): `SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'ad_royalties_fee';` returns 0 rows.
- Confirm SP integrity (AC 13): `\df+ fulfill_order_with_invoice` shows `Security: definer` AND `Config: search_path=public, pg_temp`, and the function body does not contain `v_ad_fee`.
- Confirm SP idempotency (AC 14): call `fulfill_order_with_invoice(<already-fulfilled-order-id>)` twice; confirm only one `invoices` row exists for that `order_id` after both calls.
- F1 manual test: pick one existing invoice, note the displayed Grand Total on `/invoices/[id]`, then `UPDATE invoices SET grand_total = 99999 WHERE id = <that-id>;` and refresh the page — the Grand Total should STILL show `ROUND(subtotal + tax_amount, 2)`, proving the page recomputes. Restore with `UPDATE invoices SET grand_total = ROUND(subtotal + tax_amount, 2) WHERE id = <that-id>;`.

### Notes

**Risks (pre-mortem + review findings):**

- **R1: Deploy-skew error (F11).** If the DB migration lands without the frontend deploy (or vice versa), `getInvoiceTotalsForInvoices` or the invoice detail `.select("...ad_royalties_fee...")` will either throw or silently return `undefined`. Mitigation: ship DB + app in the same release; verify staging first. **Full expand-contract (two-release rollout) is considered and explicitly NOT chosen** for this ticket — the team is small, the deploy window is short, and the backup table + audit column provide a fast rollback. If the user base/audit surface grows, expand-contract becomes the right pattern.
- **R2: Stale browser bundle.** Admins with long-lived tabs may continue to hit a client bundle that expects `ad_royalties_fee` in the invoice payload. Mitigation: standard Next.js build invalidates the bundle; rely on the reload-on-error behaviour of the app.
- **R3: External PDFs already sent.** Customers may hold PDFs (emailed invoices) that show the old fee. Explicitly out of scope — but **partially mitigated** by the `grand_total_original` column (F3): the original total is recoverable from the DB for dispute reconciliation.
- **R4: Missed field usage.** TypeScript will catch most consumers, but any SQL-string usage (`.select("…, ad_royalties_fee, …")`) is untyped and could be missed. Mitigation: Task 15 includes an `rg` sweep — only `financial_settings` / settings-form / settings-validation / `lib/settings/actions.ts` / migration file should match.
- **R5: Migration rollback (F2).** If the migration partially applies and commits, the backup table `invoices_pre_ad_fee_migration_backup` allows manual recovery: (a) `ALTER TABLE invoices ADD COLUMN ad_royalties_fee NUMERIC(12,2) NOT NULL DEFAULT 0;` to re-add the column, (b) `UPDATE invoices i SET ad_royalties_fee = b.ad_royalties_fee, grand_total = b.grand_total FROM invoices_pre_ad_fee_migration_backup b WHERE i.id = b.id;`, (c) re-create the old SP body. Document this runbook in the PR description.

**Known limitations:**

- **Historical `invoices.grand_total` is rewritten retroactively** (F3 mitigated). The mutation of immutable accounting records is acceptable in scotty-ops' operational context per Option (a). The `grand_total_original` audit column preserves the pre-migration value for any later reconciliation; the `invoices_pre_ad_fee_migration_backup` table preserves a full row snapshot.
- **Summary computation asymmetry** (F7). The orders summary recomputes totals from live `order_items` + current HST rate + current flat fee. The invoices summary sums frozen per-invoice `subtotal` and `tax_amount` + applies current flat fee + labels HST with current rate. For the *same underlying data*, the two Grand Totals will diverge whenever historical HST rates or item prices differ from current values. This is intentional (the summaries serve different use cases: "what would this cost now?" vs. "what did these previously-fulfilled invoices total?") but NOT asserted as an invariant. A unified summary action is the correct refactor if reconciliation is ever required.
- **Summary HST rate label is current, not historical** (F4 consequence). The invoice summary shows `HST (13%)` using the current `financial_settings.hst_rate`, even if all selected invoices were taxed at a previous rate. Σ(tax_amount) reflects the historical rates. This is documented, not fixed — see F7 above.
- **Flat fee is a current-snapshot read.** The fee shown in the summary is the *current* `financial_settings.ad_royalties_fee`, not a snapshot at the time the orders/invoices were created. Aggregated comparisons done months apart may show different fees for the same set of items if the setting has been edited in between. This matches the new business semantics ("flat fee now") and is intentional.

**Future considerations (out of scope):**

- **Follow-up ticket F12**: `docs/entrega.md` copy needs updating (lines 92, 124, 180 reference "marketing royalties" in a way that no longer matches the per-order behaviour described elsewhere). Create as a separate doc ticket.
- If the fee later needs to become percentage-based or store-specific, the single flat read from `financial_settings.ad_royalties_fee` in both summaries becomes a natural extension point.
- **Cleanup ticket** for the `invoices_pre_ad_fee_migration_backup` backup table once production has been stable for one billing cycle post-deploy.
- **Cleanup ticket** for the `invoices.grand_total_original` audit column once any customer-dispute window has passed (policy-dependent).
- Re-emitted PDFs from historical invoices now show a corrected (fee-less) Grand Total. If auditors need to reconcile against previously-issued PDFs, use `grand_total_original` from the DB or inspect `invoices_pre_ad_fee_migration_backup`.

## Review Notes

- Adversarial review completed against the implementation diff (baseline `5c2c09f`).
- Findings: 6 total; 2 fixed, 4 acknowledged/out-of-scope.
- Resolution approach: auto-fix of real findings.

**Applied fixes:**
- **F1 (migration idempotency)** — added `IF EXISTS` to `DROP COLUMN ad_royalties_fee` so the migration can be safely re-run.
- **F4 (vestigial `grand_total`)** — removed `grand_total` from `getInvoiceTotalsForInvoices` return shape, select list, and reduce; the only caller (`invoice-selection-summary.tsx`) now recomputes locally.

**Acknowledged / not fixed:**
- **F2 (historical `grand_total` rewrite)** — spec-prescribed behavior; mitigated by `invoices_pre_ad_fee_migration_backup` + `grand_total_original`. Business confirmation recommended before rollout.
- **F3 (`getFinancialSettings` name collision)** — the admin-facing `app/(dashboard)/settings/actions.ts` exports a same-named function with a different signature. The spec explicitly prescribes the new name in `lib/settings/actions.ts`; renaming would contradict the spec. Autoimport landmine, flagged.
- **F5, F6** — pre-existing uncommitted churn in `app/(dashboard)/orders/actions.ts` (fire-and-forget email + batch-fetch dup-id check) unrelated to this spec.
