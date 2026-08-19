/*
# Security fix F3 — revoke client EXECUTE on emit_event

## Problem
public.emit_event(...) is SECURITY DEFINER and inserts into `events` as the
function owner, bypassing row level security. EXECUTE was granted to `anon`
and `authenticated`, so any caller holding the public anon key could post to
/rest/v1/rpc/emit_event and fabricate rows in the append-only business event
log that drives the Inteligencia dashboards and the automation rule engine.

## Change
Revoke EXECUTE from public, anon and authenticated.

## Why this is safe
The only legitimate caller is the n8n-webhook edge function, which connects
with the service role key. The service role is not constrained by these
grants. The six trigger functions call emit_event from inside the database as
the table owner, which likewise does not depend on these grants.
*/

REVOKE ALL ON FUNCTION public.emit_event(text, text, uuid, jsonb, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_event(text, text, uuid, jsonb, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.emit_event(text, text, uuid, jsonb, text, jsonb) FROM authenticated;
