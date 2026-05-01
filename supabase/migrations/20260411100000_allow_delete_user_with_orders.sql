-- Allow deleting users that have submitted orders or changed order status.
-- The user reference becomes NULL but the order/history data is preserved.

-- orders.submitted_by: NOT NULL → nullable, ON DELETE SET NULL
ALTER TABLE orders
  ALTER COLUMN submitted_by DROP NOT NULL;

ALTER TABLE orders
  DROP CONSTRAINT orders_submitted_by_fkey,
  ADD CONSTRAINT orders_submitted_by_fkey
    FOREIGN KEY (submitted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- order_status_history.changed_by: NOT NULL → nullable, ON DELETE SET NULL
ALTER TABLE order_status_history
  ALTER COLUMN changed_by DROP NOT NULL;

ALTER TABLE order_status_history
  DROP CONSTRAINT order_status_history_changed_by_fkey,
  ADD CONSTRAINT order_status_history_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- audits.conducted_by: NOT NULL → nullable, ON DELETE SET NULL
ALTER TABLE audits
  ALTER COLUMN conducted_by DROP NOT NULL;

ALTER TABLE audits
  DROP CONSTRAINT audits_conducted_by_fkey,
  ADD CONSTRAINT audits_conducted_by_fkey
    FOREIGN KEY (conducted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
