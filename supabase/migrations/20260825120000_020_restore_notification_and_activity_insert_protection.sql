/*
  Restore the security posture established by migrations 009 and 011.

  Migration 018 inadvertently recreated unrestricted client INSERT policies
  for notifications and atividades. Those policies allow any authenticated
  user to forge a notification for another user or an activity attributed to
  someone else. Legitimate writers use trusted server-side paths and are not
  subject to these RLS policies.
*/

DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "insert_atividades" ON public.atividades;
