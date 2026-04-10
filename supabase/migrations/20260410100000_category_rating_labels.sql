-- Move rating_labels from audit_templates to audit_template_items
-- so each checklist item can have its own rating scale.

-- 1. Add rating_labels column to items (default = standard 3-option scale)
ALTER TABLE audit_template_items
  ADD COLUMN rating_labels jsonb NOT NULL DEFAULT '[{"key":"poor","label":"Poor","weight":0},{"key":"satisfactory","label":"Satisfactory","weight":0.5},{"key":"good","label":"Good","weight":1}]'::jsonb;

-- 2. Copy existing template-level rating_labels to all items of each template
UPDATE audit_template_items AS ati
SET rating_labels = at.rating_labels
FROM audit_templates AS at
WHERE at.id = ati.template_id;
