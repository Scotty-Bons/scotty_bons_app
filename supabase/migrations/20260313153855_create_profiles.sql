-- Migration: create_profiles
-- Creates the `profiles` table and the trigger that auto-creates a profile on new auth.users INSERT.
-- Depends on: create_stores migration (for FK to stores.id)
-- Depends on: update_updated_at_column() function (defined in create_stores migration)

-- Role enum — sole source of truth for user roles across the entire app.
CREATE TYPE user_role AS ENUM ('admin', 'factory', 'store');

CREATE TABLE IF NOT EXISTS profiles (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  store_id    uuid REFERENCES stores(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create a profile row whenever a new user is inserted into auth.users.
-- Default role is 'store'; Admins update role/store_id via Story 1.4 user management.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role)
  VALUES (NEW.id, 'store');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
