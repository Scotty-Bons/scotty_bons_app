-- Trigger function: automatically record order status changes in order_status_history
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Trigger: fires after every UPDATE on orders, per row
CREATE TRIGGER orders_status_change_history
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION record_order_status_change();
