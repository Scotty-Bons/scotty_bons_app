-- Migration: fix_audit_template_updates
-- Purpose:
--   1. Data repair — dedupe audit_template_categories and audit_template_items
--      accumulated by a bug in the old updateTemplate server action, which deleted
--      categories without checking the error (blocked by audit_responses FK) and
--      then inserted a fresh copy on every save.
--   2. Add partial unique indexes to prevent regressions.
--   3. Create atomic RPCs for updating and duplicating templates.
--
-- Depends on: create_audit_templates, create_audits, audit_categories_and_ratings.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Data repair
-- ────────────────────────────────────────────────────────────────────────────

-- 1a. Dedupe categories per (template_id, name) — keep the oldest row.
--     Reassign items of duplicate categories to the canonical one, then delete
--     the duplicates.
CREATE TEMP TABLE _atpl_cat_map ON COMMIT DROP AS
SELECT
  c.id AS old_id,
  first_value(c.id) OVER (
    PARTITION BY c.template_id, c.name
    ORDER BY c.created_at ASC, c.id ASC
  ) AS canonical_id
FROM audit_template_categories c;

UPDATE audit_template_items ati
SET category_id = cm.canonical_id
FROM _atpl_cat_map cm
WHERE ati.category_id = cm.old_id
  AND cm.old_id <> cm.canonical_id;

DELETE FROM audit_template_categories c
USING _atpl_cat_map cm
WHERE c.id = cm.old_id
  AND cm.old_id <> cm.canonical_id;

-- 1b. Dedupe items per (template_id, category_id, label) — keep the oldest row.
--     Before deleting dupes, repoint audit_responses to the canonical item,
--     keeping only the most recent response per (audit_id, canonical_item).
CREATE TEMP TABLE _atpl_item_map ON COMMIT DROP AS
SELECT
  i.id AS old_id,
  first_value(i.id) OVER (
    PARTITION BY i.template_id, i.category_id, i.label
    ORDER BY i.created_at ASC, i.id ASC
  ) AS canonical_id
FROM audit_template_items i;

-- For responses pointing to duplicate items, keep only the most recent per
-- (audit_id, canonical_item). Older duplicates are lost — these existed only
-- because the bug surfaced the same logical question multiple times.
WITH ranked AS (
  SELECT
    ar.id,
    row_number() OVER (
      PARTITION BY ar.audit_id, im.canonical_id
      ORDER BY ar.created_at DESC, ar.id DESC
    ) AS rn
  FROM audit_responses ar
  JOIN _atpl_item_map im ON im.old_id = ar.template_item_id
)
DELETE FROM audit_responses
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

UPDATE audit_responses ar
SET template_item_id = im.canonical_id
FROM _atpl_item_map im
WHERE ar.template_item_id = im.old_id
  AND im.old_id <> im.canonical_id;

DELETE FROM audit_template_items i
USING _atpl_item_map im
WHERE i.id = im.old_id
  AND im.old_id <> im.canonical_id;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Belt-and-suspenders unique constraints.
--    DEFERRABLE so the new RPC can insert a row with a name that collides with
--    a soon-to-be-deleted row within the same transaction.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE audit_template_categories
  ADD CONSTRAINT audit_template_categories_template_name_key
  UNIQUE (template_id, name)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE audit_template_items
  ADD CONSTRAINT audit_template_items_category_label_key
  UNIQUE (category_id, label)
  DEFERRABLE INITIALLY DEFERRED;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. RPC: update_audit_template
--    Diff-based update. Categories/items with an "id" are updated in place;
--    those without are inserted. Anything missing from the payload is deleted
--    — unless it has audit_responses attached, in which case the call aborts
--    with a user-facing message.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_audit_template(
  p_template_id uuid,
  p_name text,
  p_description text,
  p_categories jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cat jsonb;
  v_item jsonb;
  v_cat_id uuid;
  v_item_id uuid;
  v_cat_idx int := 0;
  v_item_idx int;
  v_keep_cat_ids uuid[] := ARRAY[]::uuid[];
  v_keep_item_ids uuid[] := ARRAY[]::uuid[];
  v_blocked_label text;
BEGIN
  IF public.auth_role() <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_categories IS NULL OR jsonb_array_length(p_categories) = 0 THEN
    RAISE EXCEPTION 'A template must have at least one category' USING ERRCODE = 'P0001';
  END IF;

  -- Update header
  UPDATE audit_templates
  SET name = p_name,
      description = NULLIF(p_description, '')
  WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0002';
  END IF;

  -- Walk categories
  FOR v_cat IN SELECT * FROM jsonb_array_elements(p_categories)
  LOOP
    IF (v_cat->>'id') IS NOT NULL AND (v_cat->>'id') <> '' THEN
      v_cat_id := (v_cat->>'id')::uuid;
      UPDATE audit_template_categories
      SET name = v_cat->>'name',
          sort_order = v_cat_idx
      WHERE id = v_cat_id AND template_id = p_template_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Category % does not belong to this template', v_cat_id USING ERRCODE = 'P0002';
      END IF;
    ELSE
      INSERT INTO audit_template_categories (template_id, name, sort_order)
      VALUES (p_template_id, v_cat->>'name', v_cat_idx)
      RETURNING id INTO v_cat_id;
    END IF;

    v_keep_cat_ids := v_keep_cat_ids || v_cat_id;

    -- Walk items inside this category
    v_item_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_cat->'items')
    LOOP
      IF (v_item->>'id') IS NOT NULL AND (v_item->>'id') <> '' THEN
        v_item_id := (v_item->>'id')::uuid;
        UPDATE audit_template_items
        SET category_id  = v_cat_id,
            label        = v_item->>'label',
            description  = NULLIF(v_item->>'description', ''),
            sort_order   = v_item_idx,
            rating_labels = v_item->'rating_options'
        WHERE id = v_item_id AND template_id = p_template_id;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Item % does not belong to this template', v_item_id USING ERRCODE = 'P0002';
        END IF;
      ELSE
        INSERT INTO audit_template_items (
          template_id, category_id, label, description, sort_order, rating_labels
        )
        VALUES (
          p_template_id,
          v_cat_id,
          v_item->>'label',
          NULLIF(v_item->>'description', ''),
          v_item_idx,
          v_item->'rating_options'
        )
        RETURNING id INTO v_item_id;
      END IF;

      v_keep_item_ids := v_keep_item_ids || v_item_id;
      v_item_idx := v_item_idx + 1;
    END LOOP;

    v_cat_idx := v_cat_idx + 1;
  END LOOP;

  -- Refuse to delete any item that has audit responses attached.
  SELECT i.label INTO v_blocked_label
  FROM audit_template_items i
  WHERE i.template_id = p_template_id
    AND NOT (i.id = ANY(v_keep_item_ids))
    AND EXISTS (SELECT 1 FROM audit_responses ar WHERE ar.template_item_id = i.id)
  LIMIT 1;

  IF v_blocked_label IS NOT NULL THEN
    RAISE EXCEPTION 'Item "%" is used in submitted audits and cannot be deleted. Remove its responses first or keep the item.', v_blocked_label
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM audit_template_items
  WHERE template_id = p_template_id
    AND NOT (id = ANY(v_keep_item_ids));

  DELETE FROM audit_template_categories
  WHERE template_id = p_template_id
    AND NOT (id = ANY(v_keep_cat_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_audit_template(uuid, text, text, jsonb) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RPC: duplicate_audit_template
--    Clones a template (categories + items) into a new inactive template with
--    a "(Copy)" suffix. Returns the new template id.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.duplicate_audit_template(p_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_src audit_templates%ROWTYPE;
  v_new_id uuid;
  v_new_name text;
  v_suffix int := 1;
  v_cat record;
  v_new_cat_id uuid;
BEGIN
  IF public.auth_role() <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM audit_templates WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0002';
  END IF;

  -- Pick a unique name: "<orig> (Copy)", "<orig> (Copy 2)", ...
  v_new_name := v_src.name || ' (Copy)';
  WHILE EXISTS (SELECT 1 FROM audit_templates WHERE name = v_new_name) LOOP
    v_suffix := v_suffix + 1;
    v_new_name := v_src.name || ' (Copy ' || v_suffix || ')';
    IF v_suffix > 99 THEN
      RAISE EXCEPTION 'Unable to generate a unique name for the duplicate' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  INSERT INTO audit_templates (name, description, is_active, rating_labels)
  VALUES (v_new_name, v_src.description, false, v_src.rating_labels)
  RETURNING id INTO v_new_id;

  FOR v_cat IN
    SELECT id, name, sort_order
    FROM audit_template_categories
    WHERE template_id = p_template_id
    ORDER BY sort_order, created_at
  LOOP
    INSERT INTO audit_template_categories (template_id, name, sort_order)
    VALUES (v_new_id, v_cat.name, v_cat.sort_order)
    RETURNING id INTO v_new_cat_id;

    INSERT INTO audit_template_items (
      template_id, category_id, label, description, sort_order, rating_labels
    )
    SELECT v_new_id, v_new_cat_id, label, description, sort_order, rating_labels
    FROM audit_template_items
    WHERE category_id = v_cat.id
    ORDER BY sort_order;
  END LOOP;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicate_audit_template(uuid) TO authenticated;

COMMIT;
