-- Migration: factory_fulfill_orders
-- Adds UPDATE policy for factory role to mark approved orders as fulfilled.
-- Adds INSERT policy on order_status_history for factory role (needed by trigger).
-- Depends on: create_orders, order_status_change_trigger, add_order_soft_delete

-- ── Factory UPDATE policy on orders ──────────────────────────────────────────
-- Factory can only UPDATE approved, non-deleted orders — and can only set status to 'fulfilled'.

CREATE POLICY "orders_update_factory"
  ON orders FOR UPDATE
  USING (auth_role() = 'factory' AND status = 'approved' AND deleted_at IS NULL)
  WITH CHECK (auth_role() = 'factory' AND status = 'fulfilled');

-- ── Factory INSERT policy on order_status_history ────────────────────────────
-- The record_order_status_change() trigger uses SECURITY DEFINER but auth.uid()
-- still resolves to the session user. The existing INSERT policy only allows admin,
-- so we need to allow factory as well for the trigger to succeed.

CREATE POLICY "order_status_history_insert_factory"
  ON order_status_history FOR INSERT
  WITH CHECK (auth_role() = 'factory');
