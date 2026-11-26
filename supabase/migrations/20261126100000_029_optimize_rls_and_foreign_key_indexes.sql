-- Add indexes for foreign keys that are joined or filtered by operational workflows.
CREATE INDEX IF NOT EXISTS idx_automation_queue_event_id
  ON public.automation_queue (event_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_rastreador_id
  ON public.ordens_servico (rastreador_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_rule_id
  ON public.scheduled_tasks (rule_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_os
  ON public.tasks (related_os);
CREATE INDEX IF NOT EXISTS idx_tasks_related_tracker
  ON public.tasks (related_tracker);
CREATE INDEX IF NOT EXISTS idx_tasks_source_event
  ON public.tasks (source_event);

-- Consolidate equivalent SELECT policies and evaluate auth helpers once per statement.
DROP POLICY IF EXISTS select_own_profile ON public.profiles;
DROP POLICY IF EXISTS select_admin_all_profiles ON public.profiles;
CREATE POLICY select_profiles_authenticated
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS select_notifications ON public.notifications;
CREATE POLICY select_notifications
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (
      target_role IS NOT NULL
      AND target_role = (SELECT public.get_user_role())
    )
  );

DROP POLICY IF EXISTS delete_notifications ON public.notifications;
CREATE POLICY delete_notifications
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (SELECT public.get_user_role()) IN ('diretoria', 'administrador')
  );

DROP POLICY IF EXISTS update_notifications ON public.notifications;
CREATE POLICY update_notifications
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
