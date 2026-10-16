/*
Security hardening: prevent client roles from invoking the DDL event-trigger
routine as an exposed PostgREST RPC. The ensure_rls event trigger remains
owned by postgres and continues to invoke this function for DDL events.
*/
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;
