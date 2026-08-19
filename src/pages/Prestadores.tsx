import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, Badge, LoadingSpinner } from '@/components/ui';
import type { Prestador } from '@/types';

const especialidadeLabels: Record<Prestador['especialidade'], string> = {
  instalacao: 'Instalação',
  manutencao: 'Manutenção',
  remocao: 'Remoção',
  geral: 'Geral',
};

export function Prestadores() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canEdit = role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Prestador | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Prestador | null>(null);
  const [form, setForm] = useState<Partial<Prestador>>({});

  const loadData = async () => {
    const { data: rows } = await supabase.from('prestadores').select('*').order('nome');
    setData((rows || []) as Prestador[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ especialidade: 'geral', status: 'ativo' });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (row: Prestador) => {
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

    const { error } = editing
      ? await supabase.from('prestadores').update(payload).eq('id', editing.id)
      : await supabase.from('prestadores').insert(payload);

    if (error) { toast.error(friendlyError(error, 'prestadores')); return; }
    toast.success(editing ? 'Prestador atualizado com sucesso' : 'Prestador criado com sucesso');
    closeDrawer();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('prestadores').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(friendlyError(error, 'prestadores')); return; }
    toast.success('Prestador excluído com sucesso');
    setDeleteTarget(null);
    loadData();
  };

  const columns: Column<Prestador>[] = [
    { key: 'nome', header: 'Nome', sortable: true, render: (r) => <span className="font-medium text-slate-900 dark:text-white">{r.nome}</span> },
    { key: 'especialidade', header: 'Especialidade', sortable: true, render: (r) => <Badge color="blue">{especialidadeLabels[r.especialidade]}</Badge> },
    { key: 'telefone', header: 'Telefone', render: (r) => r.telefone || '-' },
    { key: 'email', header: 'E-mail', render: (r) => r.email || '-' },
    { key: 'area_cobertura', header: 'Área de Cobertura', render: (r) => r.area_cobertura || '-' },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
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
        title="Prestadores"
        subtitle="Técnicos e parceiros de serviço"
        action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Prestador</Button> : undefined}
      />
      <DataTable
        data={data}
        columns={columns}
        searchKeys={['nome', 'telefone', 'email', 'area_cobertura']}
        onRowClick={openEdit}
        emptyMessage="Nenhum prestador cadastrado"
      />

      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Prestador' : 'Novo Prestador'}
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
            <input className="input" disabled={!canEdit} value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do prestador" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Especialidade</label>
              <select className="input" disabled={!canEdit} value={form.especialidade ?? 'geral'} onChange={(e) => setForm({ ...form, especialidade: e.target.value as Prestador['especialidade'] })}>
                <option value="instalacao">Instalação</option>
                <option value="manutencao">Manutenção</option>
                <option value="remocao">Remoção</option>
                <option value="geral">Geral</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" disabled={!canEdit} value={form.status ?? 'ativo'} onChange={(e) => setForm({ ...form, status: e.target.value as Prestador['status'] })}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Telefone</label>
              <input className="input" disabled={!canEdit} value={form.telefone ?? ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(77) 99999-9999" />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" disabled={!canEdit} value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
            </div>
          </div>
          <div>
            <label className="label">Área de Cobertura</label>
            <input className="input" disabled={!canEdit} value={form.area_cobertura ?? ''} onChange={(e) => setForm({ ...form, area_cobertura: e.target.value })} placeholder="Vitória da Conquista e região" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={3} disabled={!canEdit} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} placeholder="Notas sobre o prestador" />
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Prestador"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
