import { useState, useEffect } from 'react';
import {
  Zap, Play, Pause, Plus, Pencil, Trash2, Activity, Clock,
  ListChecks, Webhook, Copy, CheckCircle2, XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Button, StatusBadge, Badge, LoadingSpinner, EmptyState,
  formatDateTime, MetricCard,
} from '@/components/ui';
import type { AutomationRule, AutomationLog, AutomationQueueItem, ScheduledTask, EventLog } from '@/types';

type Tab = 'rules' | 'events' | 'queue' | 'scheduled';

interface AutomationStats {
  totalExecutions: number;
  successRate: number;
  avgDuration: number;
  lastError: string | null;
}

const EVENT_TYPES = [
  'customer_created', 'customer_updated', 'customer_at_risk', 'customer_cancelled',
  'invoice_due', 'invoice_overdue', 'invoice_paid', 'payment_received',
  'tracker_offline', 'tracker_online', 'equipment_removed',
  'service_order_created', 'service_order_completed', 'installation_completed',
  'stock_low', 'stock_out',
];

export function Automacao() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canEdit = role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'diretoria' || role === 'administrador';

  const [tab, setTab] = useState<Tab>('rules');
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [queue, setQueue] = useState<AutomationQueueItem[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledTask[]>([]);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const [form, setForm] = useState<Partial<AutomationRule>>({});
  const [webhookCopied, setWebhookCopied] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [r, l, q, s, e, statsRes] = await Promise.all([
      supabase.from('automation_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('automation_queue').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('scheduled_tasks').select('*').order('next_run', { ascending: true }),
      supabase.from('events').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('automation_logs').select('status, duration_ms, error_message, created_at').order('created_at', { ascending: false }),
    ]);
    setRules((r.data || []) as AutomationRule[]);
    setLogs((l.data || []) as AutomationLog[]);
    setQueue((q.data || []) as AutomationQueueItem[]);
    setScheduled((s.data || []) as ScheduledTask[]);
    setEvents((e.data || []) as EventLog[]);

    // Compute automation statistics from all logs
    const allLogs = (statsRes.data || []) as Pick<AutomationLog, 'status' | 'duration_ms' | 'error_message' | 'created_at'>[];
    const total = allLogs.length;
    const successCount = allLogs.filter((x) => x.status === 'sucesso').length;
    const avgDur = total > 0 ? allLogs.reduce((sum, x) => sum + Number(x.duration_ms), 0) / total : 0;
    const lastFail = allLogs.find((x) => x.status === 'falha');
    setStats({
      totalExecutions: total,
      successRate: total > 0 ? (successCount / total) * 100 : 0,
      avgDuration: Math.round(avgDur),
      lastError: lastFail?.error_message || null,
    });

    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.trigger) {
      toast.error('Nome e trigger são obrigatórios');
      return;
    }
    const payload = {
      name: form.name,
      description: form.description || null,
      trigger: form.trigger,
      conditions: form.conditions || {},
      actions: form.actions || [],
      status: form.status || 'rascunho',
    };
    if (editing) {
      const { error } = await supabase.from('automation_rules').update(payload).eq('id', editing.id);
      if (error) toast.error('Erro ao atualizar: ' + friendlyError(error, 'automacao'));
      else toast.success('Regra atualizada');
    } else {
      const { error } = await supabase.from('automation_rules').insert(payload);
      if (error) toast.error('Erro ao criar: ' + friendlyError(error, 'automacao'));
      else toast.success('Regra criada');
    }
    setEditing(null);
    setCreating(false);
    setForm({});
    loadAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('automation_rules').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Erro ao excluir: ' + friendlyError(error, 'automacao'));
    else toast.success('Regra excluída');
    setDeleteTarget(null);
    loadAll();
  };

  const toggleRuleStatus = async (rule: AutomationRule) => {
    const newStatus = rule.status === 'ativa' ? 'pausada' : 'ativa';
    const { error } = await supabase.from('automation_rules').update({ status: newStatus }).eq('id', rule.id);
    if (error) toast.error(friendlyError(error, 'automacao'));
    else toast.success(newStatus === 'ativa' ? 'Regra ativada' : 'Regra pausada');
    loadAll();
  };

  const handleTest = async (rule: AutomationRule) => {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          rule_id: rule.id,
          rule_name: rule.name,
          trigger: rule.trigger,
          timestamp: new Date().toISOString(),
        }),
      });
      if (res.ok) toast.success(`Teste enviado para "${rule.name}"`);
      else toast.error(`Erro no teste: HTTP ${res.status}`);
    } catch {
      toast.error('Falha ao conectar no webhook');
    }
  };

  const handleDuplicate = async (rule: AutomationRule) => {
    const payload = {
      name: `${rule.name} (cópia)`,
      description: rule.description,
      trigger: rule.trigger,
      conditions: rule.conditions,
      actions: rule.actions,
      status: 'rascunho' as const,
    };
    const { error } = await supabase.from('automation_rules').insert(payload);
    if (error) toast.error('Erro ao duplicar: ' + friendlyError(error, 'automacao'));
    else toast.success('Regra duplicada com sucesso');
    loadAll();
  };

  const handleExecute = async (rule: AutomationRule) => {
    const payload = {
      rule_id: rule.id,
      event_id: null,
      payload: { manual: true, trigger: rule.trigger, rule_name: rule.name } as Record<string, unknown>,
      status: 'queued' as const,
      attempts: 0,
      max_attempts: 3,
      scheduled_for: new Date().toISOString(),
    };
    const { error } = await supabase.from('automation_queue').insert(payload);
    if (error) toast.error('Erro ao executar: ' + friendlyError(error, 'automacao'));
    else toast.success('Regra adicionada à fila de execução');
    loadAll();
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/n8n-webhook`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
    toast.success('Webhook URL copiada');
  };

  const tabs: { key: Tab; label: string; icon: typeof Zap; count: number }[] = [
    { key: 'rules', label: 'Regras', icon: Zap, count: rules.length },
    { key: 'events', label: 'Eventos', icon: Activity, count: events.length },
    { key: 'queue', label: 'Fila', icon: ListChecks, count: queue.filter((q) => q.status === 'queued').length },
    { key: 'scheduled', label: 'Agendadas', icon: Clock, count: scheduled.length },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Central de Automação"
        subtitle="Regras, eventos, fila de processamento e tarefas agendadas para n8n"
        action={canEdit && (
          <Button onClick={() => { setCreating(true); setForm({ status: 'rascunho', conditions: {}, actions: [] }); }}>
            <Plus className="w-4 h-4" /> Nova Regra
          </Button>
        )}
      />

      {/* Webhook info bar */}
      <div className="card p-4 bg-gradient-to-r from-red-50 to-slate-50 dark:from-red-900/20 dark:to-slate-900/20 border-red-200 dark:border-red-800">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Webhook className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Endpoint do Webhook para n8n</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">{webhookUrl}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={copyWebhook} className="text-xs flex-shrink-0">
            {webhookCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {webhookCopied ? 'Copiado!' : 'Copiar URL'}
          </Button>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Regras Ativas" value={rules.filter((r) => r.status === 'ativa').length} icon={Zap} accent="green" />
        <MetricCard label="Eventos Críticos" value={events.filter((e) => e.severity === 'critical').length} icon={Activity} accent="red" />
        <MetricCard label="Itens na Fila" value={queue.filter((q) => q.status === 'queued').length} icon={ListChecks} accent="red" />
        <MetricCard label="Agendadas" value={scheduled.filter((s) => s.status === 'ativa').length} icon={Clock} accent="yellow" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'border-red-600 text-red-600 dark:text-red-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && <span className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{t.count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tab === 'rules' ? (
        <RulesTab
          rules={rules}
          canEdit={canEdit}
          canDelete={canDelete}
          stats={stats}
          onEdit={(r) => { setEditing(r); setForm(r); }}
          onToggle={toggleRuleStatus}
          onDelete={setDeleteTarget}
          onTest={handleTest}
          onDuplicate={handleDuplicate}
          onExecute={handleExecute}
        />
      ) : tab === 'events' ? (
        <EventsTab events={events} />
      ) : tab === 'queue' ? (
        <QueueTab queue={queue} />
      ) : (
        <ScheduledTab scheduled={scheduled} />
      )}

      {/* Create/Edit drawer */}
      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Regra' : 'Nova Regra de Automação'}
        onClose={() => { setEditing(null); setCreating(false); setForm({}); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditing(null); setCreating(false); setForm({}); }}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nome da Regra</label>
            <input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Notificação de Inadimplência" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="O que esta regra faz..." />
          </div>
          <div>
            <label className="label">Trigger (Evento)</label>
            <select className="input" value={form.trigger || ''} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
              <option value="">Selecione um trigger...</option>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="schedule">schedule (cron)</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status || 'rascunho'} onChange={(e) => setForm({ ...form, status: e.target.value as AutomationRule['status'] })}>
              <option value="rascunho">Rascunho</option>
              <option value="ativa">Ativa</option>
              <option value="pausada">Pausada</option>
            </select>
          </div>
          <div>
            <label className="label">Condições (JSON)</label>
            <textarea
              className="input font-mono text-xs"
              rows={3}
              value={JSON.stringify(form.conditions || {}, null, 2)}
              onChange={(e) => { try { setForm({ ...form, conditions: JSON.parse(e.target.value) }); } catch { /* invalid json, ignore */ } }}
            />
          </div>
          <div>
            <label className="label">Ações (JSON)</label>
            <textarea
              className="input font-mono text-xs"
              rows={4}
              value={JSON.stringify(form.actions || [], null, 2)}
              onChange={(e) => { try { setForm({ ...form, actions: JSON.parse(e.target.value) }); } catch { /* invalid json, ignore */ } }}
            />
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Regra"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function RulesTab({
  rules, canEdit, canDelete, stats, onEdit, onToggle, onDelete, onTest, onDuplicate, onExecute,
}: {
  rules: AutomationRule[];
  canEdit: boolean;
  canDelete: boolean;
  stats: AutomationStats | null;
  onEdit: (r: AutomationRule) => void;
  onToggle: (r: AutomationRule) => void;
  onDelete: (r: AutomationRule) => void;
  onTest: (r: AutomationRule) => void;
  onDuplicate: (r: AutomationRule) => void;
  onExecute: (r: AutomationRule) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Automation statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Total Execuções" value={stats.totalExecutions} icon={Activity} accent="slate" />
          <MetricCard
            label="Taxa de Sucesso"
            value={`${stats.successRate.toFixed(1)}%`}
            icon={CheckCircle2}
            accent={stats.successRate >= 80 ? 'green' : stats.successRate >= 50 ? 'yellow' : 'red'}
          />
          <MetricCard
            label="Tempo Médio"
            value={stats.avgDuration > 0 ? `${stats.avgDuration}ms` : '-'}
            icon={Clock}
            accent="slate"
          />
          <MetricCard
            label="Último Erro"
            value={stats.lastError ? (stats.lastError.length > 30 ? stats.lastError.slice(0, 30) + '…' : stats.lastError) : 'Nenhum'}
            icon={XCircle}
            accent={stats.lastError ? 'red' : 'green'}
          />
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState message="Nenhuma regra de automação cadastrada" icon={Zap} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="card p-4 animate-fadeIn">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{rule.name}</h3>
                  </div>
                  {rule.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{rule.description}</p>}
                </div>
                <StatusBadge status={rule.status} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mt-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">Trigger:</span> <code className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1 rounded">{rule.trigger}</code>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">Última execução:</span> {formatDateTime(rule.last_execution)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">Próxima:</span> {formatDateTime(rule.next_execution)}
                </div>
              </div>

              {rule.actions && rule.actions.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-3">
                  {(rule.actions as Record<string, unknown>[]).map((action, i) => (
                    <Badge key={i} color="slate">{String(action.type || 'action')}</Badge>
                  ))}
                </div>
              )}

              {canEdit && (
                <div className="flex gap-1.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onToggle(rule)}>
                    {rule.status === 'ativa' ? <><Pause className="w-3.5 h-3.5" /> Pausar</> : <><Play className="w-3.5 h-3.5" /> Ativar</>}
                  </Button>
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onEdit(rule)}>
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Button>
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onTest(rule)}>
                    <Play className="w-3.5 h-3.5" /> Testar
                  </Button>
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onDuplicate(rule)}>
                    <Copy className="w-3.5 h-3.5" /> Duplicar
                  </Button>
                  <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onExecute(rule)}>
                    <Zap className="w-3.5 h-3.5" /> Executar
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" className="text-xs px-2 py-1 text-red-600 hover:text-red-700" onClick={() => onDelete(rule)}>
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventsTab({ events }: { events: EventLog[] }) {
  const columns: Column<EventLog>[] = [
    { key: 'severity', header: 'Severidade', sortable: true, render: (e) => <Badge color={e.severity === 'critical' ? 'red' : e.severity === 'warning' ? 'yellow' : 'slate'}>{e.severity}</Badge> },
    { key: 'event_type', header: 'Evento', sortable: true, render: (e) => <code className="text-xs text-red-600 dark:text-red-400">{e.event_type}</code> },
    { key: 'entity_type', header: 'Entidade', render: (e) => e.entity_type || '-' },
    { key: 'payload', header: 'Payload', render: (e) => <span className="text-xs font-mono text-slate-400 truncate block max-w-xs">{JSON.stringify(e.payload).slice(0, 80)}</span> },
    { key: 'created_at', header: 'Data/Hora', sortable: true, render: (e) => <span className="text-xs">{formatDateTime(e.created_at)}</span> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Activity className="w-4 h-4" />
        <span>Todos os eventos importantes do sistema são registrados automaticamente e disponíveis para n8n consumir.</span>
      </div>
      <DataTable data={events} columns={columns} searchKeys={['event_type', 'entity_type']} pageSize={15} emptyMessage="Nenhum evento registrado" />
    </div>
  );
}

function QueueTab({ queue }: { queue: AutomationQueueItem[] }) {
  if (queue.length === 0) return <EmptyState message="Fila vazia — nenhum item aguardando processamento" icon={ListChecks} />;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
        <ListChecks className="w-4 h-4" />
        <span>Itens na fila para processamento pelo n8n. O webhook endpoint consome estes itens.</span>
      </div>
      {queue.map((item) => (
        <div key={item.id} className="card p-3 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={item.status} />
              <span className="text-xs text-slate-400">Tentativas: {item.attempts}/{item.max_attempts}</span>
            </div>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{JSON.stringify(item.payload).slice(0, 100)}</p>
            {item.error_message && <p className="text-xs text-red-500 mt-1">{item.error_message}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
            {item.locked_by && <p className="text-xs text-amber-500 mt-0.5">Lock: {item.locked_by}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduledTab({ scheduled }: { scheduled: ScheduledTask[] }) {
  if (scheduled.length === 0) return <EmptyState message="Nenhuma tarefa agendada" icon={Clock} />;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
        <Clock className="w-4 h-4" />
        <span>Tarefas recorrentes com cron expression. n8n pode consumir estes agendamentos para execução periódica.</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {scheduled.map((task) => (
          <div key={task.id} className="card p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{task.name}</h3>
                <code className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded mt-1 inline-block">{task.cron_expression}</code>
              </div>
              <StatusBadge status={task.status} />
            </div>
            <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 mt-3">
              <div><span className="font-medium">Última execução:</span> {formatDateTime(task.last_run)}</div>
              <div><span className="font-medium">Próxima execução:</span> {formatDateTime(task.next_run)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
