# Story 7.3: Admin — PDF Export for Orders and Audits

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an Admin,
I want to export individual orders and audit reports as PDF documents,
so that I can share them with stakeholders, attach them to emails, or keep offline records.

## Acceptance Criteria

1. **Given** an Admin views an order detail page (`/orders/{order-id}`),
   **When** they click the "Export PDF" button,
   **Then** a PDF document is generated and downloaded containing: order ID, store name, status, creation date, all line items (product name, modifier, quantity, unit price, line total), subtotal, and current status.

2. **Given** an Admin views a completed audit detail page (`/audits/{audit-id}`),
   **When** they click the "Export PDF" button,
   **Then** a PDF document is generated and downloaded containing: audit details (template name, store name, conductor, date, score), all checklist items grouped by category with their ratings and notes, and a score summary.

3. **Given** an Admin clicks "Export PDF" on an order,
   **When** the PDF generates,
   **Then** the filename follows the pattern `order-{short-id}-{date}.pdf` (e.g., `order-a1b2c3d4-2026-03-25.pdf`).

4. **Given** an Admin clicks "Export PDF" on an audit,
   **When** the PDF generates,
   **Then** the filename follows the pattern `audit-{store-name}-{date}.pdf` (e.g., `audit-downtown-store-2026-03-25.pdf`).

5. **Given** a Store user views their own order detail,
   **When** the page loads,
   **Then** the "Export PDF" button is also visible (store users can export their own orders).

6. **Given** a Store user views their audit results,
   **When** the page loads,
   **Then** the "Export PDF" button is also visible (store users can export their own audit reports).

7. **Given** any user clicks "Export PDF",
   **When** the PDF is being generated,
   **Then** a loading state is shown on the button (spinner + "Generating...") and the button is disabled until generation completes.

8. **Given** PDF generation fails for any reason,
   **When** the error occurs,
   **Then** a toast error message "Failed to generate PDF. Please try again." is shown and the button returns to its normal state.

## Tasks / Subtasks

- [ ] Task 1 — Install `jspdf` and `jspdf-autotable` packages (AC: all)
  - [ ] Run `npm install jspdf jspdf-autotable`
  - [ ] Run `npm install -D @types/jspdf` if types are needed (check if bundled)
  - [ ] These are client-side-only libraries — no server-side usage

- [ ] Task 2 — Create PDF generation utilities (AC: #1, #2, #3, #4)
  - [ ] Create `lib/pdf/generate-order-pdf.ts`:
    - Export `generateOrderPdf(order, items, storeName)` function
    - Uses `jspdf` + `jspdf-autotable` to create a structured PDF
    - Header: "Order Report" + order ID (short) + date
    - Info section: Store, Status, Created date
    - Items table: Product, Modifier, Qty, Unit Price, Line Total
    - Footer: Subtotal
    - Returns Blob for download
  - [ ] Create `lib/pdf/generate-audit-pdf.ts`:
    - Export `generateAuditPdf(audit, categories, responses, storeName, templateName)` function
    - Header: "Audit Report" + store name + date
    - Info section: Template, Store, Conducted by, Date, Score
    - For each category: category heading, then items table with: Item, Rating, Notes
    - Score summary at bottom
    - Returns Blob for download

- [ ] Task 3 — Create shared PDF download helper (AC: #3, #4)
  - [ ] Create `lib/pdf/download-pdf.ts`:
    - Export `downloadPdf(blob: Blob, filename: string)` utility
    - Creates an object URL, triggers download via hidden anchor, revokes URL

- [ ] Task 4 — Add "Export PDF" button to order detail page (AC: #1, #3, #5, #7, #8)
  - [ ] Create `components/orders/export-order-pdf-button.tsx` (Client Component)
    - Props: `order` data, `items` array, `storeName`
    - Uses `useTransition` for loading state
    - On click: dynamically imports `generateOrderPdf` (code-split), generates PDF, triggers download
    - Shows spinner + "Generating..." during generation
    - Toast on error
  - [ ] Add button to `app/(dashboard)/orders/[order-id]/page.tsx` in the header area
  - [ ] Visible to admin and store users (store users see their own orders)

- [ ] Task 5 — Add "Export PDF" button to audit detail page (AC: #2, #4, #6, #7, #8)
  - [ ] Create `components/audits/export-audit-pdf-button.tsx` (Client Component)
    - Props: `audit` data, `categories` with items and responses, `storeName`, `templateName`
    - Uses `useTransition` for loading state
    - On click: dynamically imports `generateAuditPdf`, generates PDF, triggers download
    - Shows spinner + "Generating..." during generation
    - Toast on error
  - [ ] Add button to `app/(dashboard)/audits/[audit-id]/page.tsx` in the header area
  - [ ] Visible to admin, commissary, and store users who can view the audit

- [ ] Task 6 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { OrderRow, OrderItemRow, AuditRow, AuditResponseRow } from "@/lib/types"
CN utility:              import { cn } from "@/lib/utils"
formatPrice:             import { formatPrice } from "@/lib/utils"
UI components:           Button from @/components/ui/button
Toast:                   import { toast } from "sonner"
Icons:                   FileDown, Loader2 from lucide-react
useTransition:           import { useTransition } from "react"
Score helpers:           import { getScoreLabel, AUDIT_RATING_LABELS } from "@/lib/constants/audit-status"
```

## Dev Notes

### Package Choice: jspdf

`jspdf` with `jspdf-autotable` plugin is the most widely used client-side PDF library. It:
- Works entirely in the browser (no server-side rendering needed)
- Supports tables via the autotable plugin
- Is tree-shakeable and can be dynamically imported for code splitting
- Has no native dependencies

### PDF Generation Pattern (Order)

```typescript
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function generateOrderPdf(
  order: { id: string; status: string; created_at: string },
  items: { product_name: string; modifier: string; quantity: number; unit_price: number }[],
  storeName: string
): Blob {
  const doc = new jsPDF();
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

  // Header
  doc.setFontSize(18);
  doc.text("Order Report", 14, 22);

  doc.setFontSize(11);
  doc.text(`Order: ${order.id.slice(0, 8)}`, 14, 32);
  doc.text(`Store: ${storeName}`, 14, 39);
  doc.text(`Status: ${order.status}`, 14, 46);
  doc.text(`Date: ${dateFmt.format(new Date(order.created_at))}`, 14, 53);

  // Items table
  const tableData = items.map((item) => [
    item.product_name,
    item.modifier,
    item.quantity.toString(),
    `$${item.unit_price.toFixed(2)}`,
    `$${(item.unit_price * item.quantity).toFixed(2)}`,
  ]);

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  autoTable(doc, {
    startY: 60,
    head: [["Product", "Modifier", "Qty", "Unit Price", "Total"]],
    body: tableData,
    foot: [["", "", "", "Subtotal:", `$${subtotal.toFixed(2)}`]],
    theme: "striped",
  });

  return doc.output("blob");
}
```

### Dynamic Import for Code Splitting

```tsx
"use client";

async function handleExportPdf() {
  try {
    const { generateOrderPdf } = await import("@/lib/pdf/generate-order-pdf");
    const { downloadPdf } = await import("@/lib/pdf/download-pdf");
    const blob = generateOrderPdf(order, items, storeName);
    const date = new Date().toISOString().slice(0, 10);
    downloadPdf(blob, `order-${order.id.slice(0, 8)}-${date}.pdf`);
  } catch {
    toast.error("Failed to generate PDF. Please try again.");
  }
}
```

### Download Helper

```typescript
export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### Anti-Patterns — NEVER DO

- Server-side PDF generation (puppeteer, etc.) — use client-side jspdf
- Import jspdf at the top level of a Server Component — it's browser-only
- `select('*')` in application code
- Show "Export PDF" for in-progress audits that have no score yet — only show for completed audits
- Block the UI during PDF generation — use `useTransition` or `startTransition`

## Project Structure Notes

**Files to CREATE:**

```
lib/pdf/generate-order-pdf.ts          — Order PDF generation logic
lib/pdf/generate-audit-pdf.ts          — Audit PDF generation logic
lib/pdf/download-pdf.ts                — Shared download utility
components/orders/export-order-pdf-button.tsx   — Export button for orders
components/audits/export-audit-pdf-button.tsx   — Export button for audits
```

**Files to MODIFY:**

```
app/(dashboard)/orders/[order-id]/page.tsx     — Add Export PDF button
app/(dashboard)/audits/[audit-id]/page.tsx     — Add Export PDF button (completed audits only)
package.json                                    — jspdf, jspdf-autotable dependencies
```

**Files NOT to touch:**
- No migrations needed
- No server actions needed — PDF generation is client-side

## Architecture Compliance

**D7 — Server Actions:** No new server actions — PDF generation is entirely client-side. Data is already available from the Server Component page props.

**D9 — Error Handling:** Client-side try/catch with toast error message on failure.

**Code Splitting:** Dynamic `import()` ensures jspdf is only loaded when the user clicks "Export PDF", not on initial page load.

## Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Admin views an order detail page — "Export PDF" button is visible
- Manual: Click "Export PDF" on an order — PDF downloads with correct filename
- Manual: Verify order PDF content: order info, line items table, subtotal
- Manual: Admin views a completed audit — "Export PDF" button is visible
- Manual: Click "Export PDF" on an audit — PDF downloads with correct filename
- Manual: Verify audit PDF content: audit info, categorized checklist with ratings, score
- Manual: "Export PDF" button not shown for in-progress audits
- Manual: Store user views own order — "Export PDF" button visible and functional
- Manual: Store user views own audit result — "Export PDF" button visible and functional
- Manual: Loading state shown during generation (spinner + "Generating...")

## Previous Story Intelligence

1. **Order detail page** already displays all order data + items — pass these as props to the export button component.
2. **Audit detail page** already fetches categories, items, and responses grouped — pass these as props.
3. **`formatPrice()` exists** but for PDF use `toFixed(2)` directly since jspdf works with strings.
4. **`AUDIT_RATING_LABELS`** exists in `lib/constants/audit-status.ts` for rating display text.
5. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat` and `toISOString().slice()`.

## Git Intelligence

Recommended commit message:
```
feat: story 7-3 — PDF export for orders and audits with jspdf
```

## References

- [Source: app/(dashboard)/orders/[order-id]/page.tsx] Order detail page
- [Source: app/(dashboard)/audits/[audit-id]/page.tsx] Audit detail page
- [Source: lib/constants/audit-status.ts] Rating labels and score helpers
- [Source: lib/types/index.ts] Type definitions
- [Source: memory/feedback_ui_language.md] UI must be in English
