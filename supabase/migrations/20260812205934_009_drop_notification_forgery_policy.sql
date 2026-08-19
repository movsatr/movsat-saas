/*
# Security fix F6 — remove client INSERT on notifications

## Problem
Policy "insert_notifications" had WITH CHECK
  (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']))
which constrains only the SENDER's role and never the recipient. Any signed-in
staff member could POST /rest/v1/notifications choosing any user_id or
target_role and plant a forged alert in a colleague's or the Diretoria's
notification bell.

## Change
Drop the client INSERT policy on notifications.

## Why this is safe
No frontend code inserts notifications; the only client write is
`update({ read: true })` in AppShell, which is covered by the unchanged
update_notifications policy. Notifications are produced by the n8n-webhook
edge function using the service role key, which is not subject to policies.
*/

DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
