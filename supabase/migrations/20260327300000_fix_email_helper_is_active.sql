-- Migration: fix_email_helper_is_active
-- The email helper functions reference profiles.is_active which does not exist.
-- Remove the is_active filter so email lookups actually return results.

CREATE OR REPLACE FUNCTION get_emails_by_role(p_role text)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_role NOT IN ('admin', 'store', 'commissary') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT au.email::text
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.role = p_role::user_role;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_email(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT au.email::text INTO v_email
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE au.id = p_user_id;
  RETURN v_email;
END;
$$;

CREATE OR REPLACE FUNCTION get_store_user_emails(p_store_id uuid)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT au.email::text
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.role = 'store'::user_role AND p.store_id = p_store_id;
END;
$$;
