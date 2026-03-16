-- Enable Supabase Realtime on the orders table
-- Admin and factory users will receive real-time events for all order changes
-- Realtime respects RLS policies — each user only receives events for rows they can SELECT
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
