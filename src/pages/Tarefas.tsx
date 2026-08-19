import { useState, useEffect } from 'react';
import {
  ListTodo, Plus, Filter, ArrowRight, CheckCircle2, Clock,
  AlertTriangle, DollarSign,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import {
  Button, PriorityBadge, StatusBadge, Badge, LoadingSpinner,
  EmptyState, MetricCard, formatCurrency, formatDate,
} from '@/components/ui';
import type { Task, Associado, OrdemServico, Rastreador } from '@/types';

export function Tarefas() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canSeeFinancial = role === 'diretoria' || role === 'administrador';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [rastreadores, setRastreadores] = useState<Rastreador[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [form, setForm] = useState<Partial<Task>>({});

  const load = async () => {
    setLoading(true);
    const [t, a, o, r] = await Promise.all([
      supabase.from('tasks').select('*').order('deadline', { ascending: true }),
      supabase.from('associados').select('id, nome').order('nome'),
      supabase.from('ordens_servico').select('id, numero').order('numero'),
      supabase.from('rastreadores').select('id, imei').order('imei'),
    ]);
    setTasks((t.data || []) as Task[]);
    setAssociados((a.data || []) as Associado[]);
    setOrdens((o.data || []) as OrdemServico[]);
    setRastreadores((r.data || []) as Rastreador[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.title) { toast.error('Título é obrigatório'); return; }
    const payload = {
      title: form.title,
      description: form.description || null,
      owner: form.owner || 'Não atribuído',
      priority: form.priority || 'normal',
      status: form.status || 'pendente',
      deadline: form.deadline || null,
      related_customer: form.related_customer || null,
      related_os: form.related_os || null,
      related_tracker: form.related_tracker || null,
      financial_impact: form.financial_impact || 0,
      resolution_notes: form.resolution_notes || null,
    };
    if (editing) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editing.id);
      if (error) toast.error(friendlyError(error, 'tarefas'));
      else toast.success('Tarefa atualizada');
    } else {
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) toast.error(friendlyError(error, 'tarefas'));
      else toast.success('Tarefa criada');
    }
    setCreating(false);
    setEditing(null);
    setForm({});
    load();
  };

  const updateStatus = async (task: Task, status: Task['status']) => {
    const { error } = await supabase.from('tasks').update({ status }).eq('id', task.id);
    if (error) toast.error(friendlyError(error, 'tarefas'));
    else {
      toast.success('Status atualizado');
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    }
  };

  const filtered = tasks.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => t.status !== 'concluida' && t.status !== 'cancelada' && t.deadline && t.deadline < today);
  const pending = tasks.filter((t) => t.status === 'pendente');
  const inProgress = tasks.filter((t) => t.status === 'em_andamento');
  const completed = tasks.filter((t) => t.status === 'concluida');
  const totalImpact = tasks.filter((t) => t.status !== 'concluida').reduce((s, t) => s + Number(t.financial_impact), 0);

  const columns: Column<Task>[] = [
    {
      key: 'title', header: 'Tarefa', sortable: true,
      render: (t) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{t.title}</p>
          {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
        </div>
      ),
    },
    { key: 'priority', header: 'Prioridade', sortable: true, render: (t) => <PriorityBadge priority={t.priority} /> },
    { key: 'status', header: 'Status', sortable: true, render: (t) => <StatusBadge status={t.status === 'pendente' ? 'pendente_task' : t.status} /> },
    { key: 'owner', header: 'Responsável', sortable: true, render: (t) => <span className="text-xs">{t.owner}</span> },
    {
      key: 'deadline', header: 'Prazo', sortable: true,
      render: (t) => {
        if (!t.deadline) return <span className="text-xs text-slate-400">-</span>;
        const isOverdue = t.deadline < today && t.status !== 'concluida' && t.status !== 'cancelada';
        return <span className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-500'}`}>{formatDate(t.deadline)}</span>;
      },
    },
    { key: 'financial_impact', header: 'Impacto', sortable: true, render: (t) => canSeeFinancial && Number(t.financial_impact) > 0 ? <span className="text-xs font-medium text-red-600 dark:text-red-400">{formatCurrency(Number(t.financial_impact))}</span> : '-' },
    {
      key: 'actions', header: 'Ações',
      render: (t) => (
        <div className="flex items-center gap-1">
          {t.status !== 'concluida' && t.status !== 'cancelada' && (
            <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => updateStatus(t, 'concluida')}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
            </Button>
          )}
          <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => { setEditing(t); setForm(t); }}>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tarefas Operacionais"
        subtitle="Motor de tarefas — cada alerta pode gerar uma ou mais tarefas com responsável, prazo e impacto financeiro"
        action={canCreate && (
          <Button onClick={() => { setCreating(true); setForm({ status: 'pendente', priority: 'normal', owner: 'Não atribuído', financial_impact: 0 }); }}>
            <Plus className="w-4 h-4" /> Nova Tarefa
          </Button>
        )}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Pendentes" value={pending.length} icon={Clock} accent="red" />
        <MetricCard label="Em Andamento" value={inProgress.length} icon={ListTodo} accent="yellow" />
        <MetricCard label="Concluídas" value={completed.length} icon={CheckCircle2} accent="green" />
        <MetricCard label="Atrasadas" value={overdue.length} icon={AlertTriangle} accent="red" />
        {canSeeFinancial && <MetricCard label="Impacto Total" value={formatCurrency(totalImpact)} icon={DollarSign} accent="orange" />}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-400"><Filter className="w-4 h-4" /> Filtrar:</div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <option value="all">Todas as prioridades</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="normal">Normal</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>

      {loading ? <LoadingSpinner /> : <DataTable data={filtered} columns={columns} searchKeys={['title', 'description', 'owner']} pageSize={15} emptyMessage="Nenhuma tarefa encontrada" />}

      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Tarefa' : 'Nova Tarefa'}
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
            <label className="label">Título</label>
            <input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Responsável</label>
              <input className="input" value={form.owner || ''} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            </div>
            <div>
              <label className="label">Prazo</label>
              <input type="date" className="input" value={form.deadline || ''} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prioridade</label>
              <select className="input" value={form.priority || 'normal'} onChange={(e) => setForm({ ...form, priority: e.target.value as Task['priority'] })}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status || 'pendente'} onChange={(e) => setForm({ ...form, status: e.target.value as Task['status'] })}>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
          {canSeeFinancial && (
            <div>
              <label className="label">Impacto Financeiro (R$)</label>
              <input type="number" step="0.01" className="input" value={form.financial_impact || 0} onChange={(e) => setForm({ ...form, financial_impact: Number(e.target.value) })} />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Cliente</label>
              <select className="input" value={form.related_customer || ''} onChange={(e) => setForm({ ...form, related_customer: e.target.value || null })}>
                <option value="">-</option>
                {associados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">OS</label>
              <select className="input" value={form.related_os || ''} onChange={(e) => setForm({ ...form, related_os: e.target.value || null })}>
                <option value="">-</option>
                {ordens.map((o) => <option key={o.id} value={o.id}>{o.numero}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Rastreador</label>
              <select className="input" value={form.related_tracker || ''} onChange={(e) => setForm({ ...form, related_tracker: e.target.value || null })}>
                <option value="">-</option>
                {rastreadores.map((r) => <option key={r.id} value={r.id}>{r.imei}</option>)}
              </select>
            </div>
          </div>
          {editing && (
            <div>
              <label className="label">Notas de Resolução</label>
              <textarea className="input" rows={2} value={form.resolution_notes || ''} onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })} placeholder="Como a tarefa foi resolvida..." />
            </div>
          )}
        </div>
      </CaseView>
    </div>
  );
}
