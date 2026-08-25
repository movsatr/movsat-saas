import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, LoadingSpinner } from '@/components/ui';
import type { Veiculo, Associado, Rastreador } from '@/types';

type VeiculoWithRel = Veiculo & {
  associado?: { nome: string } | null;
  rastreador?: { imei: string } | null;
};

export function Veiculos() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canEdit = role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<VeiculoWithRel[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [rastreadores, setRastreadores] = useState<Rastreador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VeiculoWithRel | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VeiculoWithRel | null>(null);
  const [form, setForm] = useState<Partial<Veiculo>>({});
  const [statusFilter] = useState<string>('');

  const loadData = async () => {
    const [veicRes, assocRes, rastRes] = await Promise.all([
      supabase.from('veiculos').select('*, associado:associados(nome), rastreador:rastreadores(imei)').order('placa'),
      supabase.from('associados').select('id, nome').order('nome'),
      supabase.from('rastreadores').select('id, imei, modelo').order('imei'),
    ]);
    setData((veicRes.data || []) as VeiculoWithRel[]);
    setAssociados((assocRes.data || []) as Associado[]);
    setRastreadores((rastRes.data || []) as Rastreador[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ status: 'ativo', ano: new Date().getFullYear() });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (row: VeiculoWithRel) => {
    const { associado, rastreador, ...rest } = row;
    void associado; void rastreador;
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
    if (!form.placa?.trim()) { toast.error('Placa é obrigatória'); return; }
    if (!form.modelo?.trim()) { toast.error('Modelo é obrigatório'); return; }
    if (!form.ano || form.ano < 1900) { toast.error('Ano inválido'); return; }
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    delete payload.created_at;
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    payload.ano = Number(payload.ano);

    const { error } = editing
      ? await supabase.from('veiculos').update(payload).eq('id', editing.id)
      : await supabase.from('veiculos').insert(payload);

    if (error) { toast.error(friendlyError(error, 'veiculos')); return; }
    toast.success(editing ? 'Veículo atualizado com sucesso' : 'Veículo criado com sucesso');
    closeDrawer();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('veiculos').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(friendlyError(error, 'veiculos')); return; }
    toast.success('Veículo excluído com sucesso');
    setDeleteTarget(null);
    loadData();
  };

  const filtered = statusFilter
    ? data.filter((v) => v.status === statusFilter)
    : data;

  const columns: Column<VeiculoWithRel>[] = [
    { key: 'placa', header: 'Placa', sortable: true, render: (v) => <span className="font-mono text-xs font-semibold uppercase text-slate-900 dark:text-white">{v.placa}</span> },
    { key: 'modelo', header: 'Modelo', sortable: true, render: (v) => v.modelo },
    { key: 'ano', header: 'Ano', sortable: true, render: (v) => v.ano },
    { key: 'associado', header: 'Associado', sortable: true, sortValue: (v) => v.associado?.nome ?? '', render: (v) => v.associado?.nome || <span className="text-slate-400">—</span> },
    { key: 'rastreador', header: 'Rastreador', sortable: true, sortValue: (v) => v.rastreador?.imei ?? '', render: (v) => v.rastreador?.imei ? <span className="font-mono text-xs">{v.rastreador.imei}</span> : <span className="text-slate-400">—</span> },
    { key: 'id_externo', header: 'ID Mutualsoft', render: (v) => v.id_externo || <span className="text-slate-400">—</span> },
    { key: 'status', header: 'Status', sortable: true, render: (v) => <StatusBadge status={v.status} /> },
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
        title="Veículos"
        subtitle="Frota de veículos cadastrados"
        action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Veículo</Button> : undefined}
      />

      <DataTable
        data={filtered}
        columns={columns}
        searchKeys={['placa', 'modelo', 'id_externo']}
        onRowClick={openEdit}
        emptyMessage="Nenhum veículo cadastrado"
      />

      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Veículo' : 'Novo Veículo'}
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
              <label className="label">Placa *</label>
              <input className="input font-mono uppercase" disabled={!canEdit} value={form.placa ?? ''} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} placeholder="ABC-1234" />
            </div>
            <div>
              <label className="label">Ano *</label>
              <input className="input" type="number" disabled={!canEdit} value={form.ano ?? ''} onChange={(e) => setForm({ ...form, ano: Number(e.target.value) })} placeholder="2024" />
            </div>
          </div>
          <div>
            <label className="label">Modelo *</label>
            <input className="input" disabled={!canEdit} value={form.modelo ?? ''} onChange={(e) => setForm({ ...form, modelo: e.target.value })} placeholder="Honda Civic" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Associado</label>
              <select className="input" disabled={!canEdit} value={form.associado_id ?? ''} onChange={(e) => setForm({ ...form, associado_id: e.target.value || null })}>
                <option value="">Sem associado</option>
                {associados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Rastreador</label>
              <select className="input" disabled={!canEdit} value={form.rastreador_id ?? ''} onChange={(e) => setForm({ ...form, rastreador_id: e.target.value || null })}>
                <option value="">Sem rastreador</option>
                {rastreadores.map((r) => <option key={r.id} value={r.id}>{r.imei}{r.modelo ? ` — ${r.modelo}` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ID Mutualsoft</label>
              <input className="input" disabled={!canEdit} value={form.id_externo ?? ''} onChange={(e) => setForm({ ...form, id_externo: e.target.value || null })} placeholder="Opcional" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" disabled={!canEdit} value={form.status ?? 'ativo'} onChange={(e) => setForm({ ...form, status: e.target.value as Veiculo['status'] })}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Veículo"
        message={`Tem certeza que deseja excluir o veículo "${deleteTarget?.placa}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
