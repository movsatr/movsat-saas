/*
# Events, Tasks, Automation, Notifications Infrastructure

## Purpose
Transform MovSat OS from a CRUD app into an event-driven operational platform.
This migration adds the data backbone for events, tasks, automation rules,
automation logs, a processing queue, scheduled tasks, and notifications.
It also adds a `cidade` column to `associados` for revenue-by-city reporting.

## New Tables
1. events — append-only log of every important business action.
2. tasks — operational tasks generated from alerts/events.
3. automation_rules — declarative automation definitions for n8n.
4. automation_logs — execution history of each automation rule.
5. automation_queue — pending items for external processors (n8n).
6. scheduled_tasks — cron-like schedule definitions.
7. notifications — user-facing notifications derived from events/tasks.

## Modified Tables
- associados: added cidade (text, nullable). Backfilled to 'Vitória da Conquista'.

## Functions
- emit_event(...) — SECURITY DEFINER helper to insert events.

## Security
- All new tables have RLS enabled with role-based policies using get_user_role().
*/

-- 0. Add cidade to associados
ALTER TABLE associados ADD COLUMN IF NOT EXISTS cidade text;
UPDATE associados SET cidade = 'Vitória da Conquista' WHERE cidade IS NULL;

-- 1. events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'info' CHECK (severity = ANY (ARRAY['info','warning','critical'])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_events" ON events;
CREATE POLICY "select_events" ON events FOR SELECT TO authenticated USING (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));
DROP POLICY IF EXISTS "insert_events" ON events;
CREATE POLICY "insert_events" ON events FOR INSERT TO authenticated WITH CHECK (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));

-- 2. tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  owner text DEFAULT 'Não atribuído',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority = ANY (ARRAY['baixa','normal','alta','urgente'])),
  status text NOT NULL DEFAULT 'pendente' CHECK (status = ANY (ARRAY['pendente','em_andamento','concluida','cancelada'])),
  deadline date,
  related_customer uuid REFERENCES associados(id) ON DELETE SET NULL,
  related_os uuid REFERENCES ordens_servico(id) ON DELETE SET NULL,
  related_tracker uuid REFERENCES rastreadores(id) ON DELETE SET NULL,
  financial_impact numeric DEFAULT 0,
  resolution_notes text,
  source_event uuid REFERENCES events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner);
CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(related_customer);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_tasks" ON tasks;
CREATE POLICY "select_tasks" ON tasks FOR SELECT TO authenticated USING (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));
DROP POLICY IF EXISTS "insert_tasks" ON tasks;
CREATE POLICY "insert_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (get_user_role() = ANY (ARRAY['supervisor','diretoria']));
DROP POLICY IF EXISTS "update_tasks" ON tasks;
CREATE POLICY "update_tasks" ON tasks FOR UPDATE TO authenticated USING (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria'])) WITH CHECK (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));
DROP POLICY IF EXISTS "delete_tasks" ON tasks;
CREATE POLICY "delete_tasks" ON tasks FOR DELETE TO authenticated USING (get_user_role() = 'diretoria');

-- 3. automation_rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger text NOT NULL,
  conditions jsonb DEFAULT '{}'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status = ANY (ARRAY['ativa','pausada','rascunho'])),
  last_execution timestamptz,
  next_execution timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_status ON automation_rules(status);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules(trigger);
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_automation_rules" ON automation_rules;
CREATE POLICY "select_automation_rules" ON automation_rules FOR SELECT TO authenticated USING (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));
DROP POLICY IF EXISTS "insert_automation_rules" ON automation_rules;
CREATE POLICY "insert_automation_rules" ON automation_rules FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'diretoria');
DROP POLICY IF EXISTS "update_automation_rules" ON automation_rules;
CREATE POLICY "update_automation_rules" ON automation_rules FOR UPDATE TO authenticated USING (get_user_role() = ANY (ARRAY['supervisor','diretoria'])) WITH CHECK (get_user_role() = ANY (ARRAY['supervisor','diretoria']));
DROP POLICY IF EXISTS "delete_automation_rules" ON automation_rules;
CREATE POLICY "delete_automation_rules" ON automation_rules FOR DELETE TO authenticated USING (get_user_role() = 'diretoria');

-- 4. automation_logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES automation_rules(id) ON DELETE CASCADE,
  trigger_event text,
  status text NOT NULL DEFAULT 'sucesso' CHECK (status = ANY (ARRAY['sucesso','falha','skip'])),
  input jsonb DEFAULT '{}'::jsonb,
  output jsonb DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_automation_logs" ON automation_logs;
CREATE POLICY "select_automation_logs" ON automation_logs FOR SELECT TO authenticated USING (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));
DROP POLICY IF EXISTS "insert_automation_logs" ON automation_logs;
CREATE POLICY "insert_automation_logs" ON automation_logs FOR INSERT TO authenticated WITH CHECK (get_user_role() = ANY (ARRAY['supervisor','diretoria']));
DROP POLICY IF EXISTS "delete_automation_logs" ON automation_logs;
CREATE POLICY "delete_automation_logs" ON automation_logs FOR DELETE TO authenticated USING (get_user_role() = 'diretoria');

-- 5. automation_queue
CREATE TABLE IF NOT EXISTS automation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES automation_rules(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status = ANY (ARRAY['queued','processing','completed','failed','dead'])),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  locked_by text,
  locked_at timestamptz,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_queue_status ON automation_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON automation_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_queue_rule ON automation_queue(rule_id);
ALTER TABLE automation_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_queue" ON automation_queue;
CREATE POLICY "select_queue" ON automation_queue FOR SELECT TO authenticated USING (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));
DROP POLICY IF EXISTS "insert_queue" ON automation_queue;
CREATE POLICY "insert_queue" ON automation_queue FOR INSERT TO authenticated WITH CHECK (get_user_role() = ANY (ARRAY['supervisor','diretoria']));
DROP POLICY IF EXISTS "update_queue" ON automation_queue;
CREATE POLICY "update_queue" ON automation_queue FOR UPDATE TO authenticated USING (get_user_role() = ANY (ARRAY['supervisor','diretoria'])) WITH CHECK (get_user_role() = ANY (ARRAY['supervisor','diretoria']));
DROP POLICY IF EXISTS "delete_queue" ON automation_queue;
CREATE POLICY "delete_queue" ON automation_queue FOR DELETE TO authenticated USING (get_user_role() = 'diretoria');

-- 6. scheduled_tasks
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_id uuid REFERENCES automation_rules(id) ON DELETE SET NULL,
  cron_expression text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ativa' CHECK (status = ANY (ARRAY['ativa','pausada'])),
  last_run timestamptz,
  next_run timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_tasks(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_tasks(next_run);
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_scheduled" ON scheduled_tasks;
CREATE POLICY "select_scheduled" ON scheduled_tasks FOR SELECT TO authenticated USING (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));
DROP POLICY IF EXISTS "insert_scheduled" ON scheduled_tasks;
CREATE POLICY "insert_scheduled" ON scheduled_tasks FOR INSERT TO authenticated WITH CHECK (get_user_role() = 'diretoria');
DROP POLICY IF EXISTS "update_scheduled" ON scheduled_tasks;
CREATE POLICY "update_scheduled" ON scheduled_tasks FOR UPDATE TO authenticated USING (get_user_role() = 'diretoria') WITH CHECK (get_user_role() = 'diretoria');
DROP POLICY IF EXISTS "delete_scheduled" ON scheduled_tasks;
CREATE POLICY "delete_scheduled" ON scheduled_tasks FOR DELETE TO authenticated USING (get_user_role() = 'diretoria');

-- 7. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role text,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type = ANY (ARRAY['info','success','warning','critical'])),
  related_entity_type text,
  related_entity_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_notifications" ON notifications;
CREATE POLICY "select_notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR (target_role IS NOT NULL AND target_role = get_user_role()));
DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (get_user_role() = ANY (ARRAY['operador','supervisor','diretoria']));
DROP POLICY IF EXISTS "update_notifications" ON notifications;
CREATE POLICY "update_notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_notifications" ON notifications;
CREATE POLICY "delete_notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id OR get_user_role() = 'diretoria');

-- 8. emit_event() function
CREATE OR REPLACE FUNCTION emit_event(
  p_event_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_severity text DEFAULT 'info',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_severity NOT IN ('info','warning','critical') THEN p_severity := 'info'; END IF;
  INSERT INTO events (event_type, entity_type, entity_id, payload, severity, metadata)
  VALUES (p_event_type, p_entity_type, p_entity_id, p_payload, p_severity, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION emit_event(text, text, uuid, jsonb, text, jsonb) TO authenticated;

-- 9. Trigger: associados events
DROP TRIGGER IF EXISTS trg_associados_events ON associados;
CREATE OR REPLACE FUNCTION fn_associados_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_event('customer_created', 'associado', NEW.id,
      jsonb_build_object('nome', NEW.nome, 'plano', NEW.plano, 'cidade', NEW.cidade), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM emit_event('customer_updated', 'associado', NEW.id,
      jsonb_build_object('nome', NEW.nome, 'changes', to_jsonb(NEW) - to_jsonb(OLD)), 'info');
    IF OLD.status_pagamento <> NEW.status_pagamento AND NEW.status_pagamento = 'inadimplente' THEN
      PERFORM emit_event('customer_at_risk', 'associado', NEW.id,
        jsonb_build_object('nome', NEW.nome, 'status_pagamento', NEW.status_pagamento), 'critical');
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_associados_events AFTER INSERT OR UPDATE ON associados
  FOR EACH ROW EXECUTE FUNCTION fn_associados_events();

-- 10. Trigger: rastreadores events
DROP TRIGGER IF EXISTS trg_rastreadores_events ON rastreadores;
CREATE OR REPLACE FUNCTION fn_rastreadores_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF NEW.status IN ('com_problema','inativo') THEN
      PERFORM emit_event('tracker_offline', 'rastreador', NEW.id,
        jsonb_build_object('imei', NEW.imei, 'status', NEW.status, 'associado_id', NEW.associado_id), 'critical');
    ELSIF NEW.status = 'ativo' THEN
      PERFORM emit_event('tracker_online', 'rastreador', NEW.id,
        jsonb_build_object('imei', NEW.imei, 'status', NEW.status), 'info');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_rastreadores_events AFTER UPDATE ON rastreadores
  FOR EACH ROW EXECUTE FUNCTION fn_rastreadores_events();

-- 11. Trigger: ordens_servico events
DROP TRIGGER IF EXISTS trg_ordens_events ON ordens_servico;
CREATE OR REPLACE FUNCTION fn_ordens_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_event('service_order_created', 'ordem_servico', NEW.id,
      jsonb_build_object('numero', NEW.numero, 'tipo', NEW.tipo, 'prioridade', NEW.prioridade), 'info');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status AND NEW.status = 'concluida' THEN
    PERFORM emit_event('service_order_completed', 'ordem_servico', NEW.id,
      jsonb_build_object('numero', NEW.numero, 'tipo', NEW.tipo), 'info');
    IF NEW.tipo = 'instalacao' THEN
      PERFORM emit_event('installation_completed', 'ordem_servico', NEW.id,
        jsonb_build_object('numero', NEW.numero), 'info');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_ordens_events AFTER INSERT OR UPDATE ON ordens_servico
  FOR EACH ROW EXECUTE FUNCTION fn_ordens_events();

-- 12. Trigger: financeiro events
DROP TRIGGER IF EXISTS trg_financeiro_events ON financeiro;
CREATE OR REPLACE FUNCTION fn_financeiro_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_event('invoice_due', 'financeiro', NEW.id,
      jsonb_build_object('descricao', NEW.descricao, 'valor', NEW.valor,
        'data_vencimento', NEW.data_vencimento, 'status', NEW.status),
      CASE WHEN NEW.status = 'atrasado' THEN 'critical' ELSE 'warning' END);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF NEW.status = 'pago' THEN
      PERFORM emit_event('payment_received', 'financeiro', NEW.id,
        jsonb_build_object('descricao', NEW.descricao, 'valor', NEW.valor), 'info');
    ELSIF NEW.status = 'atrasado' THEN
      PERFORM emit_event('invoice_overdue', 'financeiro', NEW.id,
        jsonb_build_object('descricao', NEW.descricao, 'valor', NEW.valor), 'critical');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_financeiro_events AFTER INSERT OR UPDATE ON financeiro
  FOR EACH ROW EXECUTE FUNCTION fn_financeiro_events();

-- 13. Trigger: estoque events
DROP TRIGGER IF EXISTS trg_estoque_events ON estoque;
CREATE OR REPLACE FUNCTION fn_estoque_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.quantidade <= NEW.quantidade_minima AND NEW.quantidade > 0 THEN
    PERFORM emit_event('stock_low', 'estoque', NEW.id,
      jsonb_build_object('nome', NEW.nome, 'quantidade', NEW.quantidade, 'minima', NEW.quantidade_minima), 'warning');
  ELSIF TG_OP = 'UPDATE' AND NEW.quantidade = 0 THEN
    PERFORM emit_event('stock_out', 'estoque', NEW.id,
      jsonb_build_object('nome', NEW.nome), 'critical');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_estoque_events AFTER UPDATE ON estoque
  FOR EACH ROW EXECUTE FUNCTION fn_estoque_events();

-- 14. Seed automation rules
INSERT INTO automation_rules (name, description, trigger, conditions, actions, status, next_execution)
SELECT 'Notificação de Inadimplência D+7', 'Quando uma fatura atingir 7 dias de atraso, notificar o supervisor e criar tarefa de recuperação.',
  'invoice_overdue', '{"days_overdue_gte": 7}'::jsonb,
  '[{"type":"notify","target_role":"supervisor"},{"type":"create_task","priority":"alta","title":"Recuperar cliente inadimplente"}]'::jsonb,
  'ativa', now() + interval '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Notificação de Inadimplência D+7');

INSERT INTO automation_rules (name, description, trigger, conditions, actions, status, next_execution)
SELECT 'Alerta de Equipamento Offline', 'Quando um rastreador ficar offline, criar tarefa de manutenção e notificar supervisor.',
  'tracker_offline', '{}'::jsonb,
  '[{"type":"create_task","priority":"urgente","title":"Verificar rastreador offline"},{"type":"notify","target_role":"supervisor"}]'::jsonb,
  'ativa', now() + interval '30 minutes'
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Alerta de Equipamento Offline');

INSERT INTO automation_rules (name, description, trigger, conditions, actions, status, next_execution)
SELECT 'Alerta de Estoque Baixo', 'Quando um item de estoque atingir a quantidade mínima, notificar supervisor para reposição.',
  'stock_low', '{}'::jsonb,
  '[{"type":"notify","target_role":"supervisor"},{"type":"create_task","priority":"normal","title":"Repor estoque"}]'::jsonb,
  'ativa', now() + interval '2 hours'
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Alerta de Estoque Baixo');

INSERT INTO automation_rules (name, description, trigger, conditions, actions, status, next_execution)
SELECT 'Relatório Diário da Diretoria', 'Gerar resumo diário de KPIs e enviar para diretoria.',
  'schedule', '{"cron": "0 8 * * *"}'::jsonb,
  '[{"type":"notify","target_role":"diretoria"},{"type":"generate_report"}]'::jsonb,
  'ativa', now() + interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Relatório Diário da Diretoria');

INSERT INTO automation_rules (name, description, trigger, conditions, actions, status, next_execution)
SELECT 'Confirmação de Instalação', 'Quando uma instalação for concluída, notificar o cliente e criar follow-up.',
  'installation_completed', '{}'::jsonb,
  '[{"type":"notify","target_role":"supervisor"},{"type":"create_task","priority":"baixa","title":"Follow-up pós-instalação"}]'::jsonb,
  'ativa', now() + interval '1 hour'
WHERE NOT EXISTS (SELECT 1 FROM automation_rules WHERE name = 'Confirmação de Instalação');

-- 15. Seed scheduled tasks
INSERT INTO scheduled_tasks (name, cron_expression, status, next_run)
SELECT 'Relatório Diário 08h', '0 8 * * *', 'ativa', now() + interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM scheduled_tasks WHERE name = 'Relatório Diário 08h');

INSERT INTO scheduled_tasks (name, cron_expression, status, next_run)
SELECT 'Sincronização de Status de Pagamento', '0 6 * * *', 'ativa', now() + interval '1 day'
WHERE NOT EXISTS (SELECT 1 FROM scheduled_tasks WHERE name = 'Sincronização de Status de Pagamento');

INSERT INTO scheduled_tasks (name, cron_expression, status, next_run)
SELECT 'Verificação de Rastreadores Offline', '*/30 * * * *', 'ativa', now() + interval '30 minutes'
WHERE NOT EXISTS (SELECT 1 FROM scheduled_tasks WHERE name = 'Verificação de Rastreadores Offline');

-- 16. Seed historical events
INSERT INTO events (event_type, entity_type, entity_id, payload, severity, created_at)
SELECT 'customer_created', 'associado', id,
  jsonb_build_object('nome', nome, 'plano', plano, 'cidade', coalesce(cidade,'Vitória da Conquista')),
  'info', created_at
FROM associados
WHERE NOT EXISTS (SELECT 1 FROM events WHERE entity_type = 'associado' AND entity_id = associados.id AND event_type = 'customer_created');

INSERT INTO events (event_type, entity_type, entity_id, payload, severity, created_at)
SELECT 'service_order_created', 'ordem_servico', id,
  jsonb_build_object('numero', numero, 'tipo', tipo, 'prioridade', prioridade),
  'info', created_at
FROM ordens_servico
WHERE NOT EXISTS (SELECT 1 FROM events WHERE entity_type = 'ordem_servico' AND entity_id = ordens_servico.id AND event_type = 'service_order_created');

INSERT INTO events (event_type, entity_type, entity_id, payload, severity, created_at)
SELECT 'invoice_due', 'financeiro', id,
  jsonb_build_object('descricao', descricao, 'valor', valor, 'data_vencimento', data_vencimento, 'status', status),
  CASE WHEN status = 'atrasado' THEN 'critical' WHEN status = 'pendente' THEN 'warning' ELSE 'info' END,
  created_at
FROM financeiro
WHERE NOT EXISTS (SELECT 1 FROM events WHERE entity_type = 'financeiro' AND entity_id = financeiro.id AND event_type = 'invoice_due');

INSERT INTO events (event_type, entity_type, entity_id, payload, severity, created_at)
SELECT 'tracker_offline', 'rastreador', r.id,
  jsonb_build_object('imei', r.imei, 'status', r.status, 'associado_id', r.associado_id),
  'critical', r.updated_at
FROM rastreadores r
WHERE r.status IN ('com_problema','inativo')
  AND NOT EXISTS (SELECT 1 FROM events WHERE entity_type = 'rastreador' AND entity_id = r.id AND event_type = 'tracker_offline');

-- 17. Seed tasks
INSERT INTO tasks (title, description, owner, priority, status, deadline, related_customer, financial_impact)
SELECT 'Recuperar cliente inadimplente: ' || a.nome,
  'Cliente com status de pagamento inadimplente. Entrar em contato para negociação.',
  'Carlos Silva', 'urgente', 'pendente', CURRENT_DATE + 3, a.id, a.valor_mensalidade * 3
FROM associados a
WHERE a.status_pagamento = 'inadimplente'
  AND NOT EXISTS (SELECT 1 FROM tasks WHERE related_customer = a.id AND title LIKE 'Recuperar cliente inadimplente%');

INSERT INTO tasks (title, description, owner, priority, status, deadline, related_customer, related_tracker, financial_impact)
SELECT 'Verificar rastreador offline: ' || r.imei,
  'Rastreador com status ' || r.status || '. Verificar sinal e acionar prestador se necessário.',
  'Carlos Silva', 'urgente', 'pendente', CURRENT_DATE + 1, r.associado_id, r.id, 0
FROM rastreadores r
WHERE r.status IN ('com_problema','inativo')
  AND NOT EXISTS (SELECT 1 FROM tasks WHERE related_tracker = r.id AND title LIKE 'Verificar rastreador offline%');

INSERT INTO tasks (title, description, owner, priority, status, deadline)
SELECT 'Repor estoque: ' || e.nome,
  'Item com quantidade ' || e.quantidade || ' (mínimo: ' || e.quantidade_minima || '). Solicitar reposição ao fornecedor ' || coalesce(e.fornecedor,'-') || '.',
  'Carlos Silva',
  CASE WHEN e.quantidade = 0 THEN 'urgente' ELSE 'alta' END,
  'pendente', CURRENT_DATE + 2
FROM estoque e
WHERE e.quantidade <= e.quantidade_minima
  AND NOT EXISTS (SELECT 1 FROM tasks WHERE title LIKE 'Repor estoque: ' || e.nome || '%');

INSERT INTO tasks (title, description, owner, priority, status, deadline, related_os)
SELECT 'OS Atrasada: ' || o.numero,
  'Ordem de serviço ' || o.numero || ' (' || o.tipo || ') em aberto há mais de 7 dias. Verificar andamento.',
  'Carlos Silva',
  CASE WHEN o.prioridade = 'urgente' THEN 'urgente' ELSE 'alta' END,
  'pendente', CURRENT_DATE + 1, o.id
FROM ordens_servico o
WHERE o.status IN ('aberta','em_andamento')
  AND o.data_abertura < CURRENT_DATE - 7
  AND NOT EXISTS (SELECT 1 FROM tasks WHERE related_os = o.id AND title LIKE 'OS Atrasada%');

-- 18. Seed notifications
INSERT INTO notifications (target_role, title, message, type)
SELECT 'supervisor', 'Cliente inadimplente detectado', a.nome || ' está com status inadimplente. Ação de recuperação necessária.', 'critical'
FROM associados a
WHERE a.status_pagamento = 'inadimplente'
  AND NOT EXISTS (SELECT 1 FROM notifications WHERE message LIKE a.nome || '%');

INSERT INTO notifications (target_role, title, message, type)
SELECT 'supervisor', 'Rastreador offline', 'Rastreador ' || r.imei || ' está offline. Verificação necessária.', 'critical'
FROM rastreadores r
WHERE r.status IN ('com_problema','inativo')
  AND NOT EXISTS (SELECT 1 FROM notifications WHERE message LIKE '%' || r.imei || '%');

INSERT INTO notifications (target_role, title, message, type)
SELECT 'diretoria', 'Faturas atrasadas', 'Há ' || count(*)::text || ' faturas com status atrasado. Verificar impacto financeiro.', 'warning'
FROM financeiro
WHERE status = 'atrasado'
GROUP BY status
HAVING count(*) > 0;
