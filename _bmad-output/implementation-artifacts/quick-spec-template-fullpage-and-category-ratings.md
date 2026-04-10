# Quick Spec: Template Full-Page Editor & Per-Category Rating Scales

## Overview
Two changes to the audit template system:

1. **Full-page editor:** Convert the template create/edit UI from a cramped dialog popup into a dedicated full page (like `/orders/new`), using routes `/audits/templates/new` and `/audits/templates/[id]/edit`.

2. **Per-category rating scales:** Move rating scale configuration from template-level to category-level, so each category can have its own set of rating options (e.g., "Food Safety" might use Poor/Acceptable/Good while "Cleanliness" uses Fail/Pass).

## Scope
- **In scope:** New full-page routes for create/edit, per-category rating options in form & DB, updated score calculation, updated audit execution checklist
- **Out of scope:** Template list page redesign (stays as-is), audit detail/completed view changes, PDF report changes (these will follow naturally from the data), migration of existing templates (migration auto-assigns current template-level ratings to all existing categories)

## Target Files

| File | What changes |
|------|-------------|
| `app/(dashboard)/audits/templates/new/page.tsx` | **New** — server component for the "New Template" full page |
| `app/(dashboard)/audits/templates/[id]/edit/page.tsx` | **New** — server component for the "Edit Template" full page |
| `components/audits/template-form.tsx` | Move rating scale config inside each category section; remove template-level rating section |
| `components/audits/templates-client.tsx` | Remove Dialog for create/edit; "New Template" and "Edit" buttons navigate to new routes instead |
| `lib/validations/audit-templates.ts` | Move `rating_options` from template-level into `templateCategorySchema` |
| `app/(dashboard)/audits/templates/actions.ts` | Save `rating_options` per category (new `rating_labels` column on `audit_template_categories`) instead of on `audit_templates` |
| `supabase/migrations/YYYYMMDD_category_rating_labels.sql` | **New** — add `rating_labels JSONB` column to `audit_template_categories`, migrate existing data from `audit_templates.rating_labels` |
| `components/audits/audit-checklist.tsx` | Accept per-category `ratingOptions` instead of a single template-level set |
| `app/(dashboard)/audits/actions.ts` | Update `completeAudit` and `updateAuditResponse` to look up rating weights from category-level `rating_labels` |
| `app/(dashboard)/audits/[audit-id]/page.tsx` | Pass per-category rating options to `AuditChecklist` |
| `app/(dashboard)/audits/[audit-id]/conduct/page.tsx` | Pass per-category rating options to `AuditChecklist` |
| `lib/types/index.ts` | Update `AuditTemplateCategoryRow` to include `rating_labels` |

## Database

### New migration: `YYYYMMDD_category_rating_labels.sql`

```sql
-- 1. Add rating_labels column to categories
ALTER TABLE audit_template_categories
  ADD COLUMN rating_labels jsonb NOT NULL DEFAULT '[{"key":"poor","label":"Poor","weight":0},{"key":"satisfactory","label":"Satisfactory","weight":0.5},{"key":"good","label":"Good","weight":1}]'::jsonb;

-- 2. Copy existing template-level rating_labels to all categories of each template
UPDATE audit_template_categories AS atc
SET rating_labels = at.rating_labels
FROM audit_templates AS at
WHERE at.id = atc.template_id;

-- 3. (Optional) Drop rating_labels from audit_templates
-- Keep it for now as a deprecated fallback; remove in a future cleanup migration
-- ALTER TABLE audit_templates DROP COLUMN rating_labels;
```

**Decision:** Keep `audit_templates.rating_labels` for now (backward compat) but stop reading from it in application code. Remove in a future cleanup.

## UI Design

### 1. Full-Page Template Editor

**Route: `/audits/templates/new`**
- Breadcrumb: `Audits > Templates > New Template`
- Full-width layout (max-w-5xl) like the New Order page
- Renders `<TemplateForm>` directly on the page (no dialog)
- Cancel button navigates back to `/audits/templates`
- After successful save, redirect to `/audits/templates`

**Route: `/audits/templates/[id]/edit`**
- Breadcrumb: `Audits > Templates > Edit Template`
- Server component fetches template + categories + items, passes as `defaultValues` to `<TemplateForm>`
- Same layout and behavior as the "new" page

**Templates list page changes (`templates-client.tsx`):**
- "New Template" button becomes a `<Link href="/audits/templates/new">`
- "Edit" (pencil) button becomes a `<Link href={`/audits/templates/${id}/edit`}>`
- Remove the `Dialog` component and all dialog state (`dialogOpen`, `editingTemplate`)
- Keep the `AlertDialog` for delete confirmation (it's fine as a popup)

### 2. Per-Category Rating Scale

Each category section in `<TemplateForm>` gets its own "Rating Scale" block (collapsed by default, expandable):

```
▼ Food Safety (3 items)
  Rating Scale for this category:
  [Poor   | 0  ] [Satisfactory | 0.5] [Good | 1  ] [+ Add Rating]
  
  1. Temperature checks maintained...
  2. Food stored properly...
  3. Expiration dates verified...
```

- The rating options UI (label + weight + reorder + delete) moves from the top of the form **into** each `CategorySection` component
- Each category gets its own `rating_options` field array
- Default: when adding a new category, pre-populate with the standard 3-option scale (Poor/Satisfactory/Good)
- A "Copy ratings from..." dropdown (optional nice-to-have) could let admins copy a rating scale from another category — **out of scope for now**

### 3. Audit Checklist Changes

Currently `AuditChecklist` receives a single `ratingOptions: RatingOption[]` prop. Change to:

```typescript
interface AuditChecklistProps {
  auditId: string;
  categories: AuditTemplateCategoryRow[]; // now includes rating_labels
  items: AuditTemplateItemRow[];
  existingResponses: AuditResponseRow[];
  existingEvidence: AuditEvidenceRow[];
  // Remove: ratingOptions: RatingOption[]  (now per-category)
}
```

Each category section renders its own set of rating buttons based on `category.rating_labels`.

## Implementation Details

### Validation Schema Changes (`lib/validations/audit-templates.ts`)

```typescript
const templateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  rating_options: z
    .array(ratingOptionSchema)
    .min(2, "At least 2 rating options are required."),
  items: z.array(templateItemSchema).min(1),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  // Remove: rating_options (moved to category level)
  categories: z.array(templateCategorySchema).min(1),
});
```

### Template Actions Changes (`templates/actions.ts`)

In `createTemplate` and `updateTemplate`:
- When inserting categories, include `rating_labels: cat.rating_options`
- Stop writing `rating_labels` to `audit_templates` (or write the first category's scale as a fallback)

### Score Calculation Changes (`audits/actions.ts`)

In `completeAudit` and `updateAuditResponse`:
- Instead of fetching `audit_templates.rating_labels`, fetch `audit_template_categories.rating_labels` for each category
- Build a per-item weight map by joining items → categories → rating_labels
- Score formula stays the same: `sum(weights) / (totalItems * maxWeight) * 100`
- `maxWeight` should be the global max across all categories

```typescript
// Fetch categories with their rating labels
const { data: categories } = await supabase
  .from("audit_template_categories")
  .select("id, rating_labels")
  .eq("template_id", audit.template_id);

// Fetch items to know which category each belongs to
const { data: templateItems } = await supabase
  .from("audit_template_items")
  .select("id, category_id")
  .eq("template_id", audit.template_id);

// Build item → weight map
const categoryRatings = new Map(categories.map(c => [c.id, c.rating_labels]));
const itemWeightMap: Record<string, Record<string, number>> = {};
let maxWeight = 1;

for (const item of templateItems) {
  const ratings = categoryRatings.get(item.category_id) ?? [];
  const wm: Record<string, number> = {};
  for (const r of ratings) {
    wm[r.key] = r.weight;
    if (r.weight > maxWeight) maxWeight = r.weight;
  }
  itemWeightMap[item.id] = wm;
}
```

### New Page: `/audits/templates/new/page.tsx`

```typescript
export default async function NewTemplatePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/orders");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <nav className="text-sm flex items-center gap-1.5">
        <Link href="/audits/templates" className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Templates
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">New Template</span>
      </nav>
      <h1 className="text-2xl font-bold">New Template</h1>
      <TemplateFormPage />
    </div>
  );
}
```

### New Page: `/audits/templates/[id]/edit/page.tsx`

Same pattern but fetches existing template data (like the current `TemplatesClient` does for editing) and passes as `defaultValues`.

### `TemplateFormPage` wrapper (new client component)

A thin client wrapper around `<TemplateForm>` that handles:
- Calling `createTemplate` / `updateTemplate` server actions
- Toast notifications
- Navigation back to `/audits/templates` on success

This replaces the submit/cancel logic currently in `TemplatesClient`.

## Acceptance Criteria

- [ ] Clicking "New Template" navigates to `/audits/templates/new` (full page, not dialog)
- [ ] Clicking "Edit" on a template navigates to `/audits/templates/[id]/edit`
- [ ] Template form has full page width — no longer cramped in a dialog
- [ ] Each category has its own rating scale configuration
- [ ] New categories default to Poor/Satisfactory/Good rating scale
- [ ] Different categories can have different rating options
- [ ] Rating options are saved per-category in the database
- [ ] Audit checklist shows correct per-category rating buttons during execution
- [ ] Score calculation correctly uses per-category weights
- [ ] Existing templates are migrated: their template-level rating labels are copied to all their categories
- [ ] Cancel button on form navigates back to templates list
- [ ] Form validation works: each category must have at least 2 rating options
- [ ] Edit page loads correctly with pre-populated category-level rating options

## Dependencies
- No new packages needed
- Reuses existing `TemplateForm`, `getRatingStyle`, validation helpers
- Database migration must run before deploy

## Migration Notes
- The DB migration copies `audit_templates.rating_labels` to all existing categories, so existing audits and templates continue working
- `audit_templates.rating_labels` column is kept but deprecated — app code stops reading from it
- Future cleanup migration can drop the column once confirmed stable
