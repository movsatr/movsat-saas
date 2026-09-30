import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, LoadingSpinner, formatCurrency, formatDate } from '@/components/ui';
import type { Associado } from '@/types';

export function Associados() {

  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = role === 'operador' || role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canEdit = role === 'operador' || role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'operador' || role === 'diretoria' || role === 'administrador';
  const canSeeFinancial = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<Associado[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Associado | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Associado | null>(null);
  const [form, setForm] = useState<Partial<Associado>>({});

  const loadData = async () => {
    const { data: rows } = await supabase.from('associados').select('*').order('nome');
    setData((rows || []) as Associado[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({
      plano: 'Basico',
      status_pagamento: 'em_dia',
      status_equipamento: 'sem_equipamento',
      valor_mensalidade: 0,
      data_cadastro: new Date().toISOString().slice(0, 10),
    });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (row: Associado) => {
    setForm(row);
    setEditing(row);
    setCreating(false);
  };

  const closeDrawer = () => {
    setCreating(false);
    setEditing(null);
    setForm({});
  };

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error('Nome é obrigatório'); return; }
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    if (payload.valor_mensalidade != null) payload.valor_mensalidade = Number(payload.valor_mensalidade);

    const { error } = editing
      ? await supabase.from('associados').update(payload).eq('id', editing.id)
      : await supabase.from('associados').insert(payload);

    if (error) { toast.error(friendlyError(error, 'associados')); return; }
    toast.success(editing ? 'Associado atualizado com sucesso' : 'Associado criado com sucesso');
    closeDrawer();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('associados').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(friendlyError(error, 'associados')); return; }
    toast.success('Associado excluído com sucesso');
    setDeleteTarget(null);
    loadData();
  };

  const columns: Column<Associado>[] = [
    { key: 'nome', header: 'Nome', sortable: true, render: (r) => <span className="font-medium text-slate-900 dark:text-white">{r.nome}</span> },
    { key: 'cpf_cnpj', header: 'CPF/CNPJ', render: (r) => r.cpf_cnpj || '-' },
    { key: 'telefone', header: 'Telefone', render: (r) => r.telefone || '-' },
    { key: 'plano', header: 'Plano', sortable: true, render: (r) => r.plano },
    { key: 'valor_mensalidade', header: 'Mensalidade', sortable: true, sortValue: (r) => r.valor_mensalidade, render: (r) => canSeeFinancial ? formatCurrency(r.valor_mensalidade) : '-' },
    { key: 'status_pagamento', header: 'Pagamento', sortable: true, render: (r) => <StatusBadge status={r.status_pagamento} /> },
    { key: 'status_equipamento', header: 'Equipamento', sortable: true, render: (r) => <StatusBadge status={r.status_equipamento} /> },
    { key: 'cidade', header: 'Cidade', render: (r) => r.cidade || '-' },
    { key: 'data_cadastro', header: 'Cadastro', sortable: true, sortValue: (r) => r.data_cadastro, render: (r) => formatDate(r.data_cadastro) },
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

  return (
    <div>
      <PageHeader
        title="Associados"
        subtitle="Gestão de clientes e mensalidades"
        action={canCreate ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Associado</Button> : undefined}
      />
      <DataTable
        data={data}
        columns={columns}
        searchKeys={['nome', 'cpf_cnpj', 'telefone', 'email', 'cidade']}
        onRowClick={openEdit}
        emptyMessage="Nenhum associado cadastrado"
      />

      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Associado' : 'Novo Associado'}
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
            <label className="label">Nome *</label>
            <input className="input" disabled={!canEdit} value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do associado" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">CPF/CNPJ</label>
              <input className="input" disabled={!canEdit} value={form.cpf_cnpj ?? ''} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" disabled={!canEdit} value={form.telefone ?? ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(77) 99999-9999" />
            </div>
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" disabled={!canEdit} value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="label">Endereço</label>
            <input className="input" disabled={!canEdit} value={form.endereco ?? ''} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cidade</label>
              <input className="input" disabled={!canEdit} value={form.cidade ?? ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade" />
            </div>
            <div>
              <label className="label">Plano</label>
              <select className="input" disabled={!canEdit} value={form.plano ?? 'Basico'} onChange={(e) => setForm({ ...form, plano: e.target.value })}>
                <option value="Basico">Básico</option>
                <option value="Intermediario">Intermediário</option>
                <option value="Premium">Premium</option>
                <option value="Empresarial">Empresarial</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {canSeeFinancial && (
              <div>
                <label className="label">Mensalidade (R$)</label>
                <input className="input" type="number" step="0.01" disabled={!canEdit} value={form.valor_mensalidade ?? 0} onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
            )}
            <div>
              <label className="label">Status Pagamento</label>
              <select className="input" disabled={!canEdit} value={form.status_pagamento ?? 'em_dia'} onChange={(e) => setForm({ ...form, status_pagamento: e.target.value as Associado['status_pagamento'] })}>
                <option value="em_dia">Em dia</option>
                <option value="atrasado">Atrasado</option>
                <option value="inadimplente">Inadimplente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Status Equipamento</label>
            <select className="input" disabled={!canEdit} value={form.status_equipamento ?? 'sem_equipamento'} onChange={(e) => setForm({ ...form, status_equipamento: e.target.value as Associado['status_equipamento'] })}>
              <option value="ok">OK</option>
              <option value="com_problema">Com problema</option>
              <option value="sem_equipamento">Sem equipamento</option>
            </select>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={3} disabled={!canEdit} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} placeholder="Notas internas" />
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Associado"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
