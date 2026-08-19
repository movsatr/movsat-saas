/*
# Security fix F7 — remove client INSERT on the events log

## Problem
Policy "insert_events" allowed any signed-in user with any role to write rows
into `events`, the append-only business event log. An operator could POST
/rest/v1/events with a fabricated event_type and payload and have it appear as
genuine history on the Inteligencia and Diretoria dashboards, and be matched by
automation rules.

## Change
Drop the client INSERT policy on events.

## Why this is safe
Migration 005 defines events as an append-only log written by the six
SECURITY DEFINER trigger functions (fn_associados_events, fn_ordens_events,
fn_financeiro_events, fn_estoque_events, fn_rastreadores_events) via
emit_event(). Those run as the table owner and are unaffected by policies. The
n8n-webhook edge function writes with the service role key. No frontend code
inserts into events; the app only reads it.
*/

DROP POLICY IF EXISTS "insert_events" ON public.events;
