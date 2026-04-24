# Quick Spec — Audit Templates: fix duplication-on-save + add "Duplicate template"

**Date:** 2026-04-24
**Owner:** Gustavo
**Source:** Client report (forwarded). Screenshot shows `Store Checklist — 977 items`.
**Scope:** 1 bug fix + 1 small feature, admin-only area.

---

## 1. Problem

### Bug — items duplicate on every save
Editing an audit template and saving multiplies every item already on the template. One production template grew to **977 items**. Item count displayed on the list page is driven by rows in `audit_template_items` (`app/(dashboard)/audits/templates/page.tsx:28-38`), so the accumulation is real data, not a UI bug.

### Feature — duplicate template
Admins want to copy an existing template (categories + items + rating labels) into a new draft instead of rebuilding from scratch.

---

## 2. Root cause (bug)

File: `app/(dashboard)/audits/templates/actions.ts` — `updateTemplate()` lines 144-183.

```ts
// Delete old categories (cascades to items)
await supabase
  .from("audit_template_categories")
  .delete()
  .eq("template_id", templateId);        // ← error NOT checked

// ... then loops and inserts fresh categories + items
```

Two problems compound:

1. **Silent delete failure.** `audit_responses.template_item_id → audit_template_items(id)` is declared **without** `ON DELETE CASCADE` (`supabase/migrations/20260319300000_create_audits.sql:34`), so it defaults to `NO ACTION`. As soon as the template has ever been used in an audit, the cascade `templates → categories → items` chain is blocked by the `audit_responses` FK — the whole `DELETE FROM audit_template_categories` fails.
2. **The error is thrown away.** The code does not read `{ error }` on the delete, then proceeds to **insert** a full new set of categories + items. Old rows survive, new rows are added. Every save ≈ doubles the item count.

Secondary concern: the delete-then-insert strategy destroys item IDs even on clean templates, which would orphan `audit_responses.template_item_id` references (currently prevented only by the FK blocking the delete). The correct model is diff-based: keep existing IDs, update changed, insert new, delete removed.

---

## 3. Fix — code

### 3.1 Rewrite `updateTemplate()` as a diff-based update

Form must submit IDs for existing categories/items (new ones have no ID). Server action becomes:

1. Load current categories + items for the template (id, category_id).
2. Build three sets per collection: **to-update** (IDs present in payload), **to-insert** (no ID in payload), **to-delete** (in DB, missing from payload).
3. For items in `to-delete`, check `audit_responses` — if any response references the item, **reject the save** with a user-facing error: *"Item '…' is used in X submitted audits. Deactivate the template or edit only labels/order instead of deleting this item."* Only proceed if safe.
4. Apply within a single Supabase RPC (PL/pgSQL function, `SECURITY DEFINER` + admin check) so the whole edit is atomic. The RPC signature: `update_audit_template(p_template_id uuid, p_name text, p_description text, p_categories jsonb)` where `p_categories` carries nested items with optional IDs. Return `void` on success, raise with a meaningful message on violation so the action can surface it.

**Why RPC, not client-side orchestration:** the current sequential Supabase calls have no transaction — a partial failure already corrupted this customer's data. A single RPC makes the update all-or-nothing and lets us encode the `audit_responses` safety check in SQL.

### 3.2 Update client schema + form

- `lib/validations/audit-templates.ts`: add optional `id: z.string().uuid().optional()` on category and item shapes (used by the edit flow only).
- `components/audits/template-form.tsx` (edit mode): carry existing category/item IDs through the form state so they are submitted back. On "Add", leave `id` undefined.

### 3.3 Data repair migration

Production has inflated templates (e.g., 977 items). One-shot migration to deduplicate.

File: `supabase/migrations/<ts>_dedupe_audit_template_items.sql`

Logic per `(template_id, category_id, label)` group:
- Keep the **oldest** `audit_template_items.id` (`MIN(created_at), id`).
- Re-point any `audit_responses.template_item_id` pointing to a duplicate over to the kept row.
- Delete the duplicate items.
- Same dedupe for `audit_template_categories` on `(template_id, name)` — keep oldest, reassign `audit_template_items.category_id`, delete dupes.

Rollback note: destructive but mergeable — run once, verify counts on `Store Checklist` and `Commissary Checklist`, then ship.

### 3.4 Belt-and-suspenders

Add a partial unique index to prevent future regressions:
```sql
CREATE UNIQUE INDEX audit_template_items_unique_per_category
  ON audit_template_items (category_id, label);
CREATE UNIQUE INDEX audit_template_categories_unique_per_template
  ON audit_template_categories (template_id, name);
```
(Applied *after* dedupe migration runs in the same migration file.)

---

## 4. Feature — Duplicate template

### 4.1 UX

On `components/audits/templates-client.tsx`, add a third icon button next to Edit/Delete on each card (icon: `Copy` from lucide-react, tooltip/aria-label: **"Duplicate"**).

Click flow: single click → confirm dialog ("Duplicate *\"Store Checklist\"* into a new draft template?") → on confirm, call server action → toast success → navigate to `/audits/templates/{newId}/edit` so the user can rename and tweak before activating.

### 4.2 Server action

`duplicateTemplate(templateId)` in the same `actions.ts`:
1. Verify admin.
2. Load template + categories + items.
3. Insert new template with `name = "<original> (Copy)"`, `is_active = false`, copy `description` and `rating_labels`. Handle `23505` unique-violation by appending ` (Copy 2)`, ` (Copy 3)`, … up to a small cap.
4. For each category, insert a new category row then bulk-insert its items (same pattern as `createTemplate`).
5. Return `{ data: { id: newId }, error: null }`.

Use an RPC for atomicity too (`duplicate_audit_template(p_template_id uuid) returns uuid`) — same reasoning as §3.1. If we keep it client-side for speed, wrap it in the existing "rollback on failure" pattern already present in `createTemplate()` (lines 74, 92).

### 4.3 Safety

- New template defaults to `is_active = false`. Admin must review and toggle on — avoids accidentally exposing a half-copied template to stores.
- No copying of `audit_responses`, `audits`, or usage history.

---

## 5. Files to touch

| File | Change |
|---|---|
| `supabase/migrations/<ts>_fix_audit_template_updates.sql` | New migration: dedupe data, add unique indexes, add FK `ON DELETE RESTRICT` already implicit, create `update_audit_template` + `duplicate_audit_template` RPCs |
| `app/(dashboard)/audits/templates/actions.ts` | Rewrite `updateTemplate`; add `duplicateTemplate`; surface delete-blocked-by-responses error |
| `lib/validations/audit-templates.ts` | Add optional `id` on category/item schemas |
| `components/audits/template-form.tsx` | Carry IDs through form state in edit mode |
| `components/audits/templates-client.tsx` | Add Duplicate button + confirm dialog + handler |

---

## 6. Acceptance criteria

**Bug**
- [ ] Edit an existing template with ≥1 item used in audit responses, change a label, save. Reload → item count is unchanged, label reflects the edit.
- [ ] Edit a template whose items have no responses, remove one item, add two, save. Reload → count = `old - 1 + 2`.
- [ ] Try to remove an item that has responses → save fails with a clear error, nothing changes in DB.
- [ ] Run dedupe migration on a DB seeded with duplicates → row counts match `DISTINCT (template_id, category_id, label)` per template.
- [ ] Existing `audit_responses` still resolve to valid `template_item_id` rows after dedupe.

**Feature**
- [ ] Duplicate button visible on each template card (admin only, matches existing button styling).
- [ ] Clicking Duplicate → confirm → new template appears as `"<name> (Copy)"`, `Inactive`, same item count as source.
- [ ] Editor opens on the new template, user can rename and activate.
- [ ] Duplicating twice in a row produces `(Copy)` then `(Copy 2)` (no unique-violation surfaced to user).

---

## 7. Out of scope

- Rewriting the audit response model (e.g., snapshotting item labels at response time, which would fully decouple responses from mutable items — worth a separate spec if edits keep tripping this FK).
- Versioning templates.
- Migration UI: the dedupe runs as a normal Supabase migration; no user-facing step.

---

## 8. Risks

- **Dedupe repoints `audit_responses`**: if a customer historically answered the "same question" (same label) differently across duplicated items, merging collapses them to a single `template_item_id`. `audit_responses UNIQUE(audit_id, template_item_id)` means conflicts will raise on repoint. Mitigation: in dedupe SQL, for each (audit, label) keep the **latest** response and delete the others before repointing. Document this in the migration comment; confirm with the client that losing any older duplicate responses is acceptable given the rows are artifacts of the bug.
- **RPC vs. client orchestration**: adding two RPCs is slightly more code than inline Supabase calls, but gives atomicity we currently lack. Worth it — the current non-atomic path caused this incident.
