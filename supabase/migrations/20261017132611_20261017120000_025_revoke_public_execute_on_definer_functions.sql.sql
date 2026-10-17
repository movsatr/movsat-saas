/*
Security hardening: close anonymous execution of SECURITY DEFINER routines.
set_user_role is called by the Administrador screen with a signed-in session,
so authenticated keeps EXECUTE; its internal check still restricts changes
to administrators and fails closed for null roles.
update_ordem_servico_operacional is unused by the client; authenticated also
loses EXECUTE to minimize the exposed surface.
*/
REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_ordem_servico_operacional(uuid, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_ordem_servico_operacional(uuid, text, text, date) FROM anon;
REVOKE ALL ON FUNCTION public.update_ordem_servico_operacional(uuid, text, text, date) FROM authenticated;