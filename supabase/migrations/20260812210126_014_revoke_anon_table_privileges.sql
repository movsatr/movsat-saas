/*
# Security fix F13 — revoke anon table privileges in the public schema

## Problem
The `anon` role held SELECT, INSERT, UPDATE and DELETE on all 18 public tables.
Nothing leaks today only because every policy is scoped `TO authenticated`, so
a signed-out request matches no policy. That is a single mistake away from an
open door: any future policy written without a TO clause defaults to all roles
and would immediately publish that table to the internet.

## Change
Revoke all table privileges in the public schema from `anon`, and stop granting
them by default to `anon` on future tables.

## Why this is safe
MovSat OS has no anonymous surface: every screen sits behind the sign-in gate
in src/App.tsx, and every existing policy already names only `authenticated`.
The `authenticated` role keeps all of its grants, so signed-in staff are
unaffected. Supabase Auth itself does not read these tables through the anon
role.
*/

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
