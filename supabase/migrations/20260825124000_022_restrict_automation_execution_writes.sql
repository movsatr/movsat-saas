/*
  Automation execution state is privileged. Supervisors may observe automation
  data but cannot enqueue executions or forge execution logs.
*/

DROP POLICY IF EXISTS "insert_queue" ON public.automation_queue;
CREATE POLICY "insert_queue"
  ON public.automation_queue FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));

DROP POLICY IF EXISTS "insert_automation_logs" ON public.automation_logs;
CREATE POLICY "insert_automation_logs"
  ON public.automation_logs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = ANY (ARRAY['diretoria', 'administrador']));
