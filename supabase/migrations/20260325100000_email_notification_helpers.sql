-- Email notification helper functions
-- SECURITY DEFINER to allow server actions to look up user emails by role
-- Restricted to authenticated only via REVOKE/GRANT

-- Get all active user emails for a given role
CREATE OR REPLACE FUNCTION get_emails_by_role(p_role text)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validate role input
  IF p_role NOT IN ('admin', 'store', 'commissary') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT au.email::text
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.role = p_role AND p.is_active = true;
END;
$$;

-- Get a single user's email by user_id
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
  WHERE au.id = p_user_id AND p.is_active = true;
  RETURN v_email;
END;
$$;

-- Get all active store user emails for a given store
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
  WHERE p.role = 'store' AND p.store_id = p_store_id AND p.is_active = true;
END;
$$;

-- Restrict execution: only authenticated users can call these
-- (anon and public cannot enumerate emails)
REVOKE EXECUTE ON FUNCTION get_emails_by_role(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION get_user_email(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION get_store_user_emails(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION get_emails_by_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_store_user_emails(uuid) TO authenticated;
