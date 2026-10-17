/*
Fix: get_user_role() is a SECURITY DEFINER function called by every RLS policy
on the business tables (associados, rastreadores, ordens_servico, etc.).
Migration 016 revoked EXECUTE from authenticated, which broke every SELECT
that goes through RLS — the browser saw "Failed to fetch" / "Falha ao carregar
associados" because the policy predicate raised a permission error.

get_user_role is safe to expose to authenticated: it only returns the caller's
own role from profiles, reads no sensitive data, and the SECURITY DEFINER owner
is postgres. anon stays revoked because there is no anonymous surface.
*/
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;