import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, PriorityBadge, LoadingSpinner, formatDate } from '@/components/ui';
import type { OrdemServico, Associado, Rastreador, Prestador } from '@/types';

type OSWithRelations = OrdemServico & {
  associado?: { nome: string } | null;
  rastreador?: { imei: string } | null;
  prestador?: { nome: string } | null;
};

export function OrdensServico() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canEdit = role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<OSWithRelations[]>([]);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [rastreadores, setRastreadores] = useState<Rastreador[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OSWithRelations | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OSWithRelations | null>(null);
  const [form, setForm] = useState<Partial<OrdemServico>>({});

  const loadData = async () => {
    const [osRes, assocRes, rastRes, prestRes] = await Promise.all([
      supabase.from('ordens_servico').select('*, associado:associados(nome), rastreador:rastreadores(imei), prestador:prestadores(nome)').order('data_abertura', { ascending: false }),
      supabase.from('associados').select('id, nome').order('nome'),
      supabase.from('rastreadores').select('id, imei, associado_id').order('imei'),
      supabase.from('prestadores').select('id, nome, especialidade, status').order('nome'),
    ]);
    setData((osRes.data || []) as OSWithRelations[]);
    setAssociados((assocRes.data || []) as Associado[]);
    setRastreadores((rastRes.data || []) as Rastreador[]);
    setPrestadores((prestRes.data || []) as Prestador[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    const now = new Date();
    const numero = `OS-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`;
    setForm({
      numero,
      tipo: 'instalacao',
      status: 'aberta',
      prioridade: 'normal',
      data_abertura: now.toISOString().slice(0, 10),
    });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (row: OSWithRelations) => {
    const { associado, rastreador, prestador, ...rest } = row;
    void associado; void rastreador; void prestador;
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
    if (!form.numero?.trim()) { toast.error('Número da OS é obrigatório'); return; }
    if (!form.associado_id) { toast.error('Selecione um associado'); return; }
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    // Auto-set data_conclusao when status changes to 'concluida'
    if (payload.status === 'concluida' && !payload.data_conclusao) {
      payload.data_conclusao = new Date().toISOString().slice(0, 10);
    }

    const { error } = editing
      ? await supabase.from('ordens_servico').update(payload).eq('id', editing.id)
      : await supabase.from('ordens_servico').insert(payload);

    if (error) { toast.error(friendlyError(error, 'ordens de servico')); return; }
    toast.success(editing ? 'Ordem de serviço atualizada com sucesso' : 'Ordem de serviço criada com sucesso');
    closeDrawer();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('ordens_servico').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(friendlyError(error, 'ordens de servico')); return; }
    toast.success('Ordem de serviço excluída com sucesso');
    setDeleteTarget(null);
    loadData();
  };

  const filteredRastreadores = form.associado_id
    ? rastreadores.filter((r) => r.associado_id === form.associado_id)
    : rastreadores;

  const activePrestadores = prestadores.filter((p) => p.status === 'ativo');

  const columns: Column<OSWithRelations>[] = [
    { key: 'numero', header: 'Número', sortable: true, render: (r) => <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">{r.numero}</span> },
    { key: 'associado', header: 'Associado', sortable: true, sortValue: (r) => r.associado?.nome ?? '', render: (r) => r.associado?.nome || <span className="text-slate-400">—</span> },
    { key: 'rastreador', header: 'Rastreador', sortable: true, sortValue: (r) => r.rastreador?.imei ?? '', render: (r) => r.rastreador?.imei ? <span className="font-mono text-xs">{r.rastreador.imei}</span> : '-' },
    { key: 'prestador', header: 'Prestador', render: (r) => r.prestador?.nome || '-' },
    { key: 'tipo', header: 'Tipo', sortable: true, render: (r) => <span className="capitalize">{r.tipo}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'prioridade', header: 'Prioridade', sortable: true, render: (r) => <PriorityBadge priority={r.prioridade} /> },
    { key: 'data_abertura', header: 'Abertura', sortable: true, sortValue: (r) => r.data_abertura, render: (r) => formatDate(r.data_abertura) },
    { key: 'data_conclusao', header: 'Conclusão', render: (r) => formatDate(r.data_conclusao) },
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
        title="Ordens de Serviço"
        subtitle="Solicitações de instalação, manutenção e remoção"
        action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Nova OS</Button> : undefined}
      />
      <DataTable
        data={data}
        columns={columns}
        searchKeys={['numero', 'descricao']}
        onRowClick={openEdit}
        emptyMessage="Nenhuma ordem de serviço encontrada"
      />

      <CaseView
        open={creating || !!editing}
        title={editing ? `Editar OS ${editing.numero}` : 'Nova Ordem de Serviço'}
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
              <label className="label">Número *</label>
              <input className="input font-mono" disabled={!canEdit} value={form.numero ?? ''} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="OS-2024-0001" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" disabled={!canEdit} value={form.tipo ?? 'instalacao'} onChange={(e) => setForm({ ...form, tipo: e.target.value as OrdemServico['tipo'] })}>
                <option value="instalacao">Instalação</option>
                <option value="manutencao">Manutenção</option>
                <option value="remocao">Remoção</option>
                <option value="consultoria">Consultoria</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Associado *</label>
            <select className="input" disabled={!canEdit} value={form.associado_id ?? ''} onChange={(e) => setForm({ ...form, associado_id: e.target.value, rastreador_id: null })}>
              <option value="">Selecione...</option>
              {associados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rastreador</label>
              <select className="input" disabled={!canEdit || !form.associado_id} value={form.rastreador_id ?? ''} onChange={(e) => setForm({ ...form, rastreador_id: e.target.value || null })}>
                <option value="">{form.associado_id ? 'Sem rastreador' : 'Selecione um associado'}</option>
                {filteredRastreadores.map((r) => <option key={r.id} value={r.id}>{r.imei}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prestador</label>
              <select className="input" disabled={!canEdit} value={form.prestador_id ?? ''} onChange={(e) => setForm({ ...form, prestador_id: e.target.value || null })}>
                <option value="">Sem prestador</option>
                {activePrestadores.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.especialidade})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" disabled={!canEdit} value={form.status ?? 'aberta'} onChange={(e) => setForm({ ...form, status: e.target.value as OrdemServico['status'] })}>
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div>
              <label className="label">Prioridade</label>
              <select className="input" disabled={!canEdit} value={form.prioridade ?? 'normal'} onChange={(e) => setForm({ ...form, prioridade: e.target.value as OrdemServico['prioridade'] })}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Data de Abertura</label>
              <input className="input" type="date" disabled={!canEdit} value={form.data_abertura ?? ''} onChange={(e) => setForm({ ...form, data_abertura: e.target.value })} />
            </div>
            <div>
              <label className="label">Data de Conclusão</label>
              <input className="input" type="date" disabled={!canEdit} value={form.data_conclusao ?? ''} onChange={(e) => setForm({ ...form, data_conclusao: e.target.value || null })} />
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input" rows={3} disabled={!canEdit} value={form.descricao ?? ''} onChange={(e) => setForm({ ...form, descricao: e.target.value || null })} placeholder="Descreva o problema ou solicitação" />
          </div>
          <div>
            <label className="label">Solução</label>
            <textarea className="input" rows={3} disabled={!canEdit} value={form.solucao ?? ''} onChange={(e) => setForm({ ...form, solucao: e.target.value || null })} placeholder="Descreva a solução aplicada" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} disabled={!canEdit} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} placeholder="Notas adicionais" />
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Ordem de Serviço"
        message={`Tem certeza que deseja excluir a OS "${deleteTarget?.numero}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
