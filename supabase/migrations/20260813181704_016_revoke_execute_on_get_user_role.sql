/*
# Revoke client EXECUTE on get_user_role()

The function is SECURITY DEFINER and is called by every RLS policy in the
database. RLS policies execute as the table owner, not as the calling role,
so they do not depend on EXECUTE grants. Revoking from anon and authenticated
removes the public RPC endpoint /rest/v1/rpc/get_user_role without affecting
any policy.
*/

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role() FROM anon;
REVOKE ALL ON FUNCTION public.get_user_role() FROM authenticated;
