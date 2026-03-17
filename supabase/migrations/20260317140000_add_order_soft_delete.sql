-- Migration: add_order_soft_delete
-- Adds deleted_at column for soft deletes and updates RLS policies
-- to exclude soft-deleted orders from all queries.
-- Depends on: create_orders

-- ── Add soft delete column ──────────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN deleted_at timestamptz;

-- ── Update SELECT policies to exclude soft-deleted orders ───────────────────

DROP POLICY IF EXISTS "orders_select_admin" ON orders;
CREATE POLICY "orders_select_admin"
  ON orders FOR SELECT
  USING (auth_role() = 'admin' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "orders_select_store" ON orders;
CREATE POLICY "orders_select_store"
  ON orders FOR SELECT
  USING (auth_role() = 'store' AND store_id = auth_store_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "orders_select_factory" ON orders;
CREATE POLICY "orders_select_factory"
  ON orders FOR SELECT
  USING (auth_role() = 'factory' AND deleted_at IS NULL);

-- ── Update UPDATE policy to prevent operating on deleted orders ─────────────

DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin"
  ON orders FOR UPDATE
  USING (auth_role() = 'admin' AND deleted_at IS NULL)
  WITH CHECK (auth_role() = 'admin');

-- ── Partial index for soft-delete filter performance ─────────────────────────

CREATE INDEX idx_orders_not_deleted ON orders (id) WHERE deleted_at IS NULL;
