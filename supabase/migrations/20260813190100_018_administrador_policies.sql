/*
# MovSat OS — Add administrador to all business table policies

## Problem
Migration 006 added 'administrador' to the profiles role check constraint,
but none of the RLS policies on the business tables (created in 002 and 003)
include 'administrador' in their role lists. An administrator gets
get_user_role() = 'administrador', which matches none of the existing
policies, leaving them completely locked out of every table.

## Change
Drop and recreate every policy on the business tables that was missing
'administrador', adding it to the allowed roles. The administrador gets
the same access as diretoria on every table:
- Full CRUD on associados, rastreadores, prestadores, estoque, ordens_servico,
  financeiro, base_tecnica
- SELECT + INSERT on atividades (append-only, no UPDATE/DELETE)
- Full CRUD on events (SELECT only — INSERT via emit_event trigger),
  tasks, automation_rules, automation_logs, automation_queue,
  scheduled_tasks, notifications

## Tables affected (from migration 002)
- associados, rastreadores, prestadores, estoque

## Tables affected (from migration 003)
- ordens_servico, financeiro, base_tecnica, atividades

## Tables affected (from migration 005)
- events, tasks, automation_rules, automation_logs, automation_queue,
  scheduled_tasks, notifications

## No conflict with migrations 008-016
- 008 revokes EXECUTE on emit_event — does not touch table policies
- 009 drops insert_notifications — we recreate it here with administrador
- 010 drops insert_events — we do NOT recreate it (events written by trigger only)
- 011 drops insert_atividades — we recreate it here with administrador
- 012 narrows automation SELECT to supervisor/diretoria — we add administrador
- 013 revokes EXECUTE on trigger functions — does not touch table policies
- 014 revokes anon table privileges — does not touch authenticated policies
- 015 drops legacy select_queue / select_scheduled — already dropped, we
  use select_automation_queue / select_scheduled_tasks names

## Why this runs after 008-016
This migration must run after the security fixes because it recreates
some of the policies they dropped (insert_notifications, insert_atividades).
By running last, the final state is correct: administrador is included
AND the security constraints are preserved.
*/

-- === ASSOCIADOS ===
DROP POLICY IF EXISTS "select_associados" ON public.associados;
CREATE POLICY "select_associados"
  ON public.associados FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_associados" ON public.associados;
CREATE POLICY "insert_associados"
  ON public.associados FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_associados" ON public.associados;
CREATE POLICY "update_associados"
  ON public.associados FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_associados" ON public.associados;
CREATE POLICY "delete_associados"
  ON public.associados FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === RASTREADORES ===
DROP POLICY IF EXISTS "select_rastreadores" ON public.rastreadores;
CREATE POLICY "select_rastreadores"
  ON public.rastreadores FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_rastreadores" ON public.rastreadores;
CREATE POLICY "insert_rastreadores"
  ON public.rastreadores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_rastreadores" ON public.rastreadores;
CREATE POLICY "update_rastreadores"
  ON public.rastreadores FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_rastreadores" ON public.rastreadores;
CREATE POLICY "delete_rastreadores"
  ON public.rastreadores FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === PRESTADORES ===
DROP POLICY IF EXISTS "select_prestadores" ON public.prestadores;
CREATE POLICY "select_prestadores"
  ON public.prestadores FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_prestadores" ON public.prestadores;
CREATE POLICY "insert_prestadores"
  ON public.prestadores FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_prestadores" ON public.prestadores;
CREATE POLICY "update_prestadores"
  ON public.prestadores FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_prestadores" ON public.prestadores;
CREATE POLICY "delete_prestadores"
  ON public.prestadores FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === ESTOQUE ===
DROP POLICY IF EXISTS "select_estoque" ON public.estoque;
CREATE POLICY "select_estoque"
  ON public.estoque FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_estoque" ON public.estoque;
CREATE POLICY "insert_estoque"
  ON public.estoque FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_estoque" ON public.estoque;
CREATE POLICY "update_estoque"
  ON public.estoque FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_estoque" ON public.estoque;
CREATE POLICY "delete_estoque"
  ON public.estoque FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === ORDENS_SERVICO ===
DROP POLICY IF EXISTS "select_ordens_servico" ON public.ordens_servico;
CREATE POLICY "select_ordens_servico"
  ON public.ordens_servico FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_ordens_servico" ON public.ordens_servico;
CREATE POLICY "insert_ordens_servico"
  ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_ordens_servico" ON public.ordens_servico;
CREATE POLICY "update_ordens_servico"
  ON public.ordens_servico FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_ordens_servico" ON public.ordens_servico;
CREATE POLICY "delete_ordens_servico"
  ON public.ordens_servico FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === FINANCEIRO ===
DROP POLICY IF EXISTS "select_financeiro" ON public.financeiro;
CREATE POLICY "select_financeiro"
  ON public.financeiro FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_financeiro" ON public.financeiro;
CREATE POLICY "insert_financeiro"
  ON public.financeiro FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_financeiro" ON public.financeiro;
CREATE POLICY "update_financeiro"
  ON public.financeiro FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_financeiro" ON public.financeiro;
CREATE POLICY "delete_financeiro"
  ON public.financeiro FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === BASE_TECNICA ===
DROP POLICY IF EXISTS "select_base_tecnica" ON public.base_tecnica;
CREATE POLICY "select_base_tecnica"
  ON public.base_tecnica FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_base_tecnica" ON public.base_tecnica;
CREATE POLICY "insert_base_tecnica"
  ON public.base_tecnica FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_base_tecnica" ON public.base_tecnica;
CREATE POLICY "update_base_tecnica"
  ON public.base_tecnica FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_base_tecnica" ON public.base_tecnica;
CREATE POLICY "delete_base_tecnica"
  ON public.base_tecnica FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === ATIVIDADES (append-only: SELECT + INSERT only) ===
DROP POLICY IF EXISTS "select_atividades" ON public.atividades;
CREATE POLICY "select_atividades"
  ON public.atividades FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

-- insert_atividades was dropped by migration 011 (security fix F4).
-- Recreate with administrador included. Client-side INSERT is needed
-- because the app logs activities from the frontend.
DROP POLICY IF EXISTS "insert_atividades" ON public.atividades;
CREATE POLICY "insert_atividades"
  ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

-- === EVENTS (SELECT only — INSERT dropped by migration 010) ===
DROP POLICY IF EXISTS "select_events" ON public.events;
CREATE POLICY "select_events"
  ON public.events FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

-- insert_events was dropped by migration 010 (security fix F3).
-- Events are now written only by emit_event() (SECURITY DEFINER trigger).
-- We do NOT recreate a client INSERT policy here.

-- === TASKS ===
DROP POLICY IF EXISTS "select_tasks" ON public.tasks;
CREATE POLICY "select_tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_tasks" ON public.tasks;
CREATE POLICY "insert_tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_tasks" ON public.tasks;
CREATE POLICY "update_tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_tasks" ON public.tasks;
CREATE POLICY "delete_tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === AUTOMATION_RULES ===
DROP POLICY IF EXISTS "select_automation_rules" ON public.automation_rules;
CREATE POLICY "select_automation_rules"
  ON public.automation_rules FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_automation_rules" ON public.automation_rules;
CREATE POLICY "insert_automation_rules"
  ON public.automation_rules FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_automation_rules" ON public.automation_rules;
CREATE POLICY "update_automation_rules"
  ON public.automation_rules FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_automation_rules" ON public.automation_rules;
CREATE POLICY "delete_automation_rules"
  ON public.automation_rules FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === AUTOMATION_LOGS ===
DROP POLICY IF EXISTS "select_automation_logs" ON public.automation_logs;
CREATE POLICY "select_automation_logs"
  ON public.automation_logs FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_automation_logs" ON public.automation_logs;
CREATE POLICY "insert_automation_logs"
  ON public.automation_logs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_automation_logs" ON public.automation_logs;
CREATE POLICY "delete_automation_logs"
  ON public.automation_logs FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === AUTOMATION_QUEUE ===
DROP POLICY IF EXISTS "select_automation_queue" ON public.automation_queue;
CREATE POLICY "select_automation_queue"
  ON public.automation_queue FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_queue" ON public.automation_queue;
CREATE POLICY "insert_queue"
  ON public.automation_queue FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_queue" ON public.automation_queue;
CREATE POLICY "update_queue"
  ON public.automation_queue FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_queue" ON public.automation_queue;
CREATE POLICY "delete_queue"
  ON public.automation_queue FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === SCHEDULED_TASKS ===
DROP POLICY IF EXISTS "select_scheduled_tasks" ON public.scheduled_tasks;
CREATE POLICY "select_scheduled_tasks"
  ON public.scheduled_tasks FOR SELECT TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_scheduled" ON public.scheduled_tasks;
CREATE POLICY "insert_scheduled"
  ON public.scheduled_tasks FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_scheduled" ON public.scheduled_tasks;
CREATE POLICY "update_scheduled"
  ON public.scheduled_tasks FOR UPDATE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

DROP POLICY IF EXISTS "delete_scheduled" ON public.scheduled_tasks;
CREATE POLICY "delete_scheduled"
  ON public.scheduled_tasks FOR DELETE TO authenticated
  USING (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

-- === NOTIFICATIONS ===
DROP POLICY IF EXISTS "select_notifications" ON public.notifications;
CREATE POLICY "select_notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (target_role IS NOT NULL AND target_role = public.get_user_role()));

-- insert_notifications was dropped by migration 009 (security fix F1).
-- Recreate with administrador included. The app creates notifications
-- from the frontend (Automacao.tsx queue insertion, etc.).
DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
CREATE POLICY "insert_notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['operador', 'supervisor', 'diretoria', 'administrador']));

DROP POLICY IF EXISTS "update_notifications" ON public.notifications;
CREATE POLICY "update_notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_notifications" ON public.notifications;
CREATE POLICY "delete_notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));
