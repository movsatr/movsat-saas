/*
# MovSat OS — Profiles Table & Role Helper Function

## Overview
Creates the profiles table that stores each user's role (operador, supervisor, diretoria)
and a SECURITY DEFINER helper function get_user_role() that all RLS policies will call
to determine the authenticated user's permission level.

## New Tables
- profiles
  - id (uuid, PK, references auth.users ON DELETE CASCADE) — links to Supabase Auth
  - email (text, not null) — user email, mirrored from auth.users
  - name (text, not null) — display name shown in the UI
  - role (text, not null, default operador) — one of operador, supervisor, diretoria
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())

## New Functions
- get_user_role() — SECURITY DEFINER, STABLE. Returns the role text for the current
  authenticated user by reading from profiles. Bypasses RLS (runs as table owner) so it
  can read the role row even though profiles has restrictive RLS. Returns NULL if the
  user has no profile row. All RLS policies on business tables call this function.
- handle_new_user() — SECURITY DEFINER trigger function. Fires AFTER INSERT on
  auth.users. Auto-creates a profiles row with default role operador so new auth
  users immediately have a profile. The role is later set by an admin via SQL.

## Triggers
- on_auth_user_created — AFTER INSERT on auth.users calls handle_new_user()

## Security (RLS)
- RLS enabled on profiles.
- SELECT policy: users can read ONLY their own profile row (auth.uid() = id).
- No INSERT/UPDATE/DELETE policies — profiles cannot be modified from the frontend.
  The handle_new_user trigger (SECURITY DEFINER) bypasses RLS to create rows.
  Role changes are done via SQL migrations only, never from the app.

## Important Notes
1. The get_user_role() function is the backbone of all RLS in MovSat OS. Every
   business table policy calls it to check the user role before allowing access.
2. Roles are never exposed or editable from the frontend. The app reads its own role
   via the SELECT-own-row policy on profiles; all authorization decisions happen in
   RLS policies server-side.
3. New users created via Supabase Auth automatically get a profile with role operador.
   An admin must promote them via SQL.
*/

-- === PROFILES TABLE ===
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'operador'
    CHECK (role IN ('operador', 'supervisor', 'diretoria')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS immediately
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- === ROLE HELPER FUNCTION ===
-- SECURITY DEFINER so it bypasses RLS on profiles to read the caller role.
-- STABLE so the planner can cache the result within a single statement.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- === AUTO-CREATE PROFILE ON NEW USER ===
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'operador'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- === RLS POLICIES FOR PROFILES ===
-- Users can read only their own profile (to see their own role).
-- No INSERT / UPDATE / DELETE policies = those operations are denied from the frontend.
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Grant minimal table privileges to authenticated role
GRANT SELECT ON public.profiles TO authenticated;
