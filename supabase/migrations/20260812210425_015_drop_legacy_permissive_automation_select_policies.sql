/*
# Corrective migration for F9

## Problem
Migration 012 narrowed the automation SELECT policies, but automation_queue and
scheduled_tasks each carried a SECOND, older SELECT policy under a different
name ("select_queue" and "select_scheduled") that still allowed the operador
role. Permissive policies are combined with OR, so the narrowing had no effect
on those two tables: an operator could still read the queue and the schedule.

## Change
Drop the two legacy policies, leaving only select_automation_queue and
select_scheduled_tasks from migration 012.

## Why this is safe
src/pages/Automacao.tsx is the only reader of both tables and is restricted to
supervisor, diretoria and administrador, which is exactly what the remaining
policies allow.
*/

DROP POLICY IF EXISTS "select_queue" ON public.automation_queue;
DROP POLICY IF EXISTS "select_scheduled" ON public.scheduled_tasks;
