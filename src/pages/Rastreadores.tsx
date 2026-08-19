import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, LoadingSpinner, formatDate } from '@/components/ui';
import type { Rastreador, Associado } from '@/types';

type RastreadorWithAssoc = Rastreador & { associado?: { nome: string } | null };

export function Rastreadores() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canEdit = role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<RastreadorWithAssoc[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RastreadorWithAssoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RastreadorWithAssoc | null>(null);
  const [form, setForm] = useState<Partial<Rastreador>>({});

  const loadData = async () => {
    const [rastRes, assocRes] = await Promise.all([
      supabase.from('rastreadores').select('*, associado:associados(nome)').order('imei'),
      supabase.from('associados').select('id, nome').order('nome'),
    ]);
    setData((rastRes.data || []) as RastreadorWithAssoc[]);
    setAssociados((assocRes.data || []) as Associado[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ status: 'ativo', data_instalacao: new Date().toISOString().slice(0, 10) });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (row: RastreadorWithAssoc) => {
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
    if (!form.imei?.trim()) { toast.error('IMEI é obrigatório'); return; }
    if (!form.modelo?.trim()) { toast.error('Modelo é obrigatório'); return; }
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    const { error } = editing
      ? await supabase.from('rastreadores').update(payload).eq('id', editing.id)
      : await supabase.from('rastreadores').insert(payload);

    if (error) { toast.error(friendlyError(error, 'rastreadores')); return; }
    toast.success(editing ? 'Rastreador atualizado com sucesso' : 'Rastreador criado com sucesso');
    closeDrawer();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('rastreadores').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(friendlyError(error, 'rastreadores')); return; }
    toast.success('Rastreador excluído com sucesso');
    setDeleteTarget(null);
    loadData();
  };

  const columns: Column<RastreadorWithAssoc>[] = [
    { key: 'imei', header: 'IMEI', sortable: true, render: (r) => <span className="font-mono text-xs font-medium text-slate-900 dark:text-white">{r.imei}</span> },
    { key: 'modelo', header: 'Modelo', sortable: true, render: (r) => r.modelo },
    { key: 'associado', header: 'Associado', sortable: true, sortValue: (r) => r.associado?.nome ?? '', render: (r) => r.associado?.nome || <span className="text-slate-400">—</span> },
    { key: 'veiculo_placa', header: 'Placa', render: (r) => r.veiculo_placa ? <span className="font-mono text-xs uppercase">{r.veiculo_placa}</span> : '-' },
    { key: 'veiculo_modelo', header: 'Veículo', render: (r) => [r.veiculo_modelo, r.veiculo_cor].filter(Boolean).join(' ') || '-' },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'data_instalacao', header: 'Instalação', sortable: true, sortValue: (r) => r.data_instalacao ?? '', render: (r) => formatDate(r.data_instalacao) },
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
        title="Rastreadores"
        subtitle="Gestão de equipamentos e veículos"
        action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Rastreador</Button> : undefined}
      />
      <DataTable
        data={data}
        columns={columns}
        searchKeys={['imei', 'modelo', 'veiculo_placa', 'veiculo_modelo']}
        onRowClick={openEdit}
        emptyMessage="Nenhum rastreador cadastrado"
      />

      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Rastreador' : 'Novo Rastreador'}
        onClose={closeDrawer}
        footer={
          <>
            <Button variant="secondary" onClick={closeDrawer}>Cancelar</Button>
            {canEdit && <Button variant="primary" onClick={handleSave}>Salvar</Button>}
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">IMEI *</label>
              <input className="input font-mono" disabled={!canEdit} value={form.imei ?? ''} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="000000000000000" />
            </div>
            <div>
              <label className="label">Modelo *</label>
              <input className="input" disabled={!canEdit} value={form.modelo ?? ''} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="GT06, TK303, etc." />
            </div>
          </div>
          <div>
            <label className="label">Associado</label>
            <select className="input" disabled={!canEdit} value={form.associado_id ?? ''} onChange={(e) => setForm({ ...form, associado_id: e.target.value || undefined })}>
              <option value="">Sem associado</option>
              {associados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Placa</label>
              <input className="input font-mono uppercase" disabled={!canEdit} value={form.veiculo_placa ?? ''} onChange={(e) => setForm({ ...form, veiculo_placa: e.target.value.toUpperCase() })} placeholder="ABC-1234" />
            </div>
            <div>
              <label className="label">Modelo do Veículo</label>
              <input className="input" disabled={!canEdit} value={form.veiculo_modelo ?? ''} onChange={(e) => setForm({ ...form, veiculo_modelo: e.target.value })} placeholder="Honda Civic" />
            </div>
            <div>
              <label className="label">Cor</label>
              <input className="input" disabled={!canEdit} value={form.veiculo_cor ?? ''} onChange={(e) => setForm({ ...form, veiculo_cor: e.target.value })} placeholder="Prata" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" disabled={!canEdit} value={form.status ?? 'ativo'} onChange={(e) => setForm({ ...form, status: e.target.value as Rastreador['status'] })}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="com_problema">Com problema</option>
                <option value="manutencao">Manutenção</option>
              </select>
            </div>
            <div>
              <label className="label">Data de Instalação</label>
              <input className="input" type="date" disabled={!canEdit} value={form.data_instalacao ?? ''} onChange={(e) => setForm({ ...form, data_instalacao: e.target.value || null })} />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={3} disabled={!canEdit} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} placeholder="Notas sobre o equipamento" />
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Rastreador"
        message={`Tem certeza que deseja excluir o rastreador "${deleteTarget?.imei}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
