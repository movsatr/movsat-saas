import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, DollarSign, Banknote, Wallet, AlertTriangle, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, LoadingSpinner, formatCurrency, formatDate, MetricCard } from '@/components/ui';
import type { FinanceiroRecord, Associado } from '@/types';

type FinanceiroWithAssoc = FinanceiroRecord & { associado?: { nome: string } | null };

type StatusFilter = 'all' | FinanceiroRecord['status'];

const tipoLabels: Record<FinanceiroRecord['tipo'], string> = {
  mensalidade: 'Mensalidade',
  instalacao: 'Instalação',
  manutencao: 'Manutenção',
  outro: 'Outro',
};

export function Financeiro() {
  const { profile } = useAuth();
  const role = profile?.role;

  // Financeiro is diretoria-only; AppShell already hides the nav, but guard here too.
  if (role !== 'diretoria' && role !== 'administrador') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <AlertTriangle className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">Acesso restrito à diretoria.</p>
      </div>
    );
  }

  return <FinanceiroContent />;
}

function FinanceiroContent() {
  const canEdit = true; // diretoria only — full access
  const canDelete = true;

  const [data, setData] = useState<FinanceiroWithAssoc[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<FinanceiroWithAssoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanceiroWithAssoc | null>(null);
  const [form, setForm] = useState<Partial<FinanceiroRecord>>({});

  const loadData = async () => {
    const [finRes, assocRes] = await Promise.all([
      supabase.from('financeiro').select('*, associado:associados(nome)').order('data_vencimento', { ascending: false }),
      supabase.from('associados').select('id, nome').order('nome'),
    ]);
    setData((finRes.data || []) as FinanceiroWithAssoc[]);
    setAssociados((assocRes.data || []) as Associado[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({
      tipo: 'mensalidade',
      status: 'pendente',
      valor: 0,
      data_vencimento: new Date().toISOString().slice(0, 10),
    });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (row: FinanceiroWithAssoc) => {
    const { associado, ...rest } = row;
    void associado;
    setForm(rest);
    setEditing(row);
    setCreating(false);
  };

  const closeDrawer = () => {
    setCreating(false);
    setEditing(null);
    setForm({});
  };

  const handleSave = async () => {
    if (!form.associado_id) { toast.error('Selecione um associado'); return; }
    if (!form.descricao?.trim()) { toast.error('Descrição é obrigatória'); return; }
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    if (payload.valor != null) payload.valor = Number(payload.valor);

    // If status is 'pago' and no data_pagamento, set today
    if (payload.status === 'pago' && !payload.data_pagamento) {
      payload.data_pagamento = new Date().toISOString().slice(0, 10);
    }
    if (payload.status !== 'pago') {
      payload.data_pagamento = null;
    }

    const { error } = editing
      ? await supabase.from('financeiro').update(payload).eq('id', editing.id)
      : await supabase.from('financeiro').insert(payload);

    if (error) { toast.error(friendlyError(error, 'financeiro')); return; }
    toast.success(editing ? 'Registro atualizado com sucesso' : 'Registro criado com sucesso');
    closeDrawer();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('financeiro').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(friendlyError(error, 'financeiro')); return; }
    toast.success('Registro excluído com sucesso');
    setDeleteTarget(null);
    loadData();
  };

  // Summary metrics
  const totalRecebido = data.filter((d) => d.status === 'pago').reduce((s, d) => s + Number(d.valor), 0);
  const totalPendente = data.filter((d) => d.status === 'pendente').reduce((s, d) => s + Number(d.valor), 0);
  const totalAtrasado = data.filter((d) => d.status === 'atrasado').reduce((s, d) => s + Number(d.valor), 0);

  const filteredData = statusFilter === 'all' ? data : data.filter((d) => d.status === statusFilter);

  const columns: Column<FinanceiroWithAssoc>[] = [
    { key: 'associado', header: 'Associado', sortable: true, sortValue: (r) => r.associado?.nome ?? '', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{r.associado?.nome || '-'}</span> },
    { key: 'tipo', header: 'Tipo', sortable: true, render: (r) => <span className="text-xs">{tipoLabels[r.tipo]}</span> },
    { key: 'descricao', header: 'Descrição', render: (r) => r.descricao },
    { key: 'valor', header: 'Valor', sortable: true, sortValue: (r) => Number(r.valor), render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(r.valor)}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'data_vencimento', header: 'Vencimento', sortable: true, sortValue: (r) => r.data_vencimento, render: (r) => formatDate(r.data_vencimento) },
    { key: 'data_pagamento', header: 'Pagamento', render: (r) => formatDate(r.data_pagamento) },
    { key: 'forma_pagamento', header: 'Forma', render: (r) => r.forma_pagamento ? <span className="capitalize text-xs">{r.forma_pagamento}</span> : '-' },
    {
      key: 'actions', header: '', render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canEdit && <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Editar"><Pencil className="w-4 h-4 text-slate-500" /></button>}
          {canDelete && <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Excluir"><Trash2 className="w-4 h-4 text-red-500" /></button>}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'pago', label: 'Pago' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'atrasado', label: 'Atrasado' },
    { value: 'cancelado', label: 'Cancelado' },
  ];

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Controle financeiro e cobranças"
        action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Registro</Button> : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Recebido" value={formatCurrency(totalRecebido)} icon={Banknote} accent="green" />
        <MetricCard label="Pendente" value={formatCurrency(totalPendente)} icon={Wallet} accent="yellow" />
        <MetricCard label="Atrasado" value={formatCurrency(totalAtrasado)} icon={AlertTriangle} accent="red" />
        <MetricCard label="Total Geral" value={formatCurrency(totalRecebido + totalPendente + totalAtrasado)} icon={DollarSign} accent="blue" />
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Filter className="w-4 h-4 text-slate-400" />
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <DataTable
        data={filteredData}
        columns={columns}
        searchKeys={['descricao']}
        onRowClick={openEdit}
        emptyMessage="Nenhum registro financeiro encontrado"
      />

      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Registro' : 'Novo Registro Financeiro'}
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="secondary" onClick={closeDrawer}>Cancelar</Button>
            {canEdit && <Button variant="primary" onClick={handleSave}>Salvar</Button>}
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Associado *</label>
            <select className="input" disabled={!canEdit} value={form.associado_id ?? ''} onChange={(e) => setForm({ ...form, associado_id: e.target.value })}>
              <option value="">Selecione...</option>
              {associados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo</label>
              <select className="input" disabled={!canEdit} value={form.tipo ?? 'mensalidade'} onChange={(e) => setForm({ ...form, tipo: e.target.value as FinanceiroRecord['tipo'] })}>
                <option value="mensalidade">Mensalidade</option>
                <option value="instalacao">Instalação</option>
                <option value="manutencao">Manutenção</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input" type="number" step="0.01" disabled={!canEdit} value={form.valor ?? 0} onChange={(e) => setForm({ ...form, valor: e.target.value === '' ? 0 : Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Descrição *</label>
            <input className="input" disabled={!canEdit} value={form.descricao ?? ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição da cobrança" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" disabled={!canEdit} value={form.status ?? 'pendente'} onChange={(e) => setForm({ ...form, status: e.target.value as FinanceiroRecord['status'] })}>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="label">Forma de Pagamento</label>
              <select className="input" disabled={!canEdit || form.status !== 'pago'} value={form.forma_pagamento ?? ''} onChange={(e) => setForm({ ...form, forma_pagamento: (e.target.value || null) as FinanceiroRecord['forma_pagamento'] })}>
                <option value="">—</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="cartao">Cartão</option>
                <option value="dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data de Vencimento</label>
              <input className="input" type="date" disabled={!canEdit} value={form.data_vencimento ?? ''} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
            </div>
            <div>
              <label className="label">Data de Pagamento</label>
              <input className="input" type="date" disabled={!canEdit || form.status !== 'pago'} value={form.data_pagamento ?? ''} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value || null })} />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={3} disabled={!canEdit} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} placeholder="Notas financeiras" />
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Registro"
        message={`Tem certeza que deseja excluir "${deleteTarget?.descricao}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
