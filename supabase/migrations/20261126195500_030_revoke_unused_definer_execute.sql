/*
  Security hardening for unused SECURITY DEFINER RPCs.

  get_user_role() remains executable by authenticated because business-table
  RLS policies depend on it. set_user_role(uuid,text) remains executable by
  authenticated because the Administrator screen calls it and the function
  enforces the administrator role internally.

  is_admin() and update_ordem_servico_operacional(...) have no application
  callers. Remove their exposed RPC execution privileges. This also reconciles
  production privileges with the intent documented in migration 025.
*/
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_ordem_servico_operacional(uuid, text, text, date)
  FROM PUBLIC, anon, authenticated;
