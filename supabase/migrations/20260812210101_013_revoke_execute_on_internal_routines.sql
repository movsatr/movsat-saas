/*
# Security fix F12 — revoke client EXECUTE on internal trigger routines

## Problem
handle_new_user() and the five business trigger functions are SECURITY DEFINER
and live in the `public` schema, which PostgREST exposes as RPC endpoints.
EXECUTE was granted to anon and authenticated. Direct invocation currently
errors out ("trigger functions can only be called as triggers"), so this is
hardening rather than an open door, but nothing outside the trigger machinery
should hold EXECUTE on a definer routine.

## Change
Revoke EXECUTE from PUBLIC, anon and authenticated on all six.

## Why this is safe
Triggers execute their function as the table owner and do not consult EXECUTE
grants, so every trigger keeps firing exactly as before.
*/

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.fn_associados_events()',
    'public.fn_estoque_events()',
    'public.fn_financeiro_events()',
    'public.fn_ordens_events()',
    'public.fn_rastreadores_events()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;
