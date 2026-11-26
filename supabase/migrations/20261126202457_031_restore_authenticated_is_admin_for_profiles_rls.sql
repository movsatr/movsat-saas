-- The profiles SELECT policy created in migration 029 calls is_admin().
-- Keep the helper unavailable to PUBLIC/anon, but allow authenticated users
-- to execute it so PostgreSQL can evaluate that RLS policy.
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
