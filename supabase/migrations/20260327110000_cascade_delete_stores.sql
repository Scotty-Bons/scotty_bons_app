-- Migration: cascade_delete_stores
-- Allow deleting a store and all its associated orders, invoices, and audits.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_store_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_store_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE audits DROP CONSTRAINT IF EXISTS audits_store_id_fkey;
ALTER TABLE audits ADD CONSTRAINT audits_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;
