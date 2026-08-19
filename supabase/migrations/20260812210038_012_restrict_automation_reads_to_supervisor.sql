/*
# Security fix F9 — align automation module reads with the app's own access map

## Problem
src/App.tsx restricts the "automacao" page to supervisor, diretoria and
administrador, but the SELECT policies on the four automation tables allowed
the operador role. An operator could call /rest/v1/automation_rules?select=*
with their own session token and read every rule, its trigger conditions and
its action definitions, plus the queue, the execution logs and the schedule.

## Change
Narrow the SELECT policies on automation_rules, automation_queue,
automation_logs and scheduled_tasks to supervisor, diretoria and administrador.
'administrador' is added because it is a valid role per the profiles check
constraint (migration 006) and belongs to the same privilege tier.

## Why this is safe
src/pages/Automacao.tsx is the only reader of these four tables in the entire
frontend, and that page is already unreachable for the operador role.
*/

DROP POLICY IF EXISTS "select_automation_rules" ON public.automation_rules;
CREATE POLICY "select_automation_rules"
  ON public.automation_rules FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "select_automation_queue" ON public.automation_queue;
CREATE POLICY "select_automation_queue"
  ON public.automation_queue FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "select_automation_logs" ON public.automation_logs;
CREATE POLICY "select_automation_logs"
  ON public.automation_logs FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "select_scheduled_tasks" ON public.scheduled_tasks;
CREATE POLICY "select_scheduled_tasks"
  ON public.scheduled_tasks FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));
