-- Migration: create_rls_helpers
-- Creates auth_role() and auth_store_id() — the SOLE source of truth for all RLS policies.
-- Depends on: create_profiles migration (for user_role type and profiles table)
--
-- ARCHITECTURE RULE: All RLS policies MUST call these functions — never inline subqueries.
-- Pattern: USING (auth_role() = 'admin' OR store_id = auth_store_id())

-- Returns the current authenticated user's role from the profiles table.
-- SECURITY DEFINER: reads profiles without RLS interference during policy evaluation.
-- STABLE: result won't change within a transaction — enables query plan optimization.
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Returns the current authenticated user's store_id from the profiles table.
-- Returns NULL for Admin and Factory users (who have no store assignment).
-- SECURITY DEFINER: reads profiles without RLS interference during policy evaluation.
-- STABLE: result won't change within a transaction — enables query plan optimization.
CREATE OR REPLACE FUNCTION auth_store_id()
RETURNS uuid AS $$
  SELECT store_id FROM public.profiles WHERE user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
