import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, Badge, LoadingSpinner, formatDate } from '@/components/ui';
import type { BaseTecnicaDoc } from '@/types';

const categoriaLabels: Record<BaseTecnicaDoc['categoria'], string> = {
  instalacao: 'Instalação',
  configuracao: 'Configuração',
  troubleshooting: 'Troubleshooting',
  especificacao: 'Especificação',
  manual: 'Manual',
};

const categoriaColors: Record<BaseTecnicaDoc['categoria'], 'blue' | 'purple' | 'red' | 'green' | 'orange'> = {
  instalacao: 'blue',
  configuracao: 'purple',
  troubleshooting: 'red',
  especificacao: 'green',
  manual: 'orange',
};

export function BaseTecnica() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canEdit = role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<BaseTecnicaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BaseTecnicaDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BaseTecnicaDoc | null>(null);
  const [form, setForm] = useState<Partial<BaseTecnicaDoc>>({});
  const [viewing, setViewing] = useState<BaseTecnicaDoc | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const loadData = async () => {
    const { data: rows } = await supabase.from('base_tecnica').select('*').order('titulo');
    setData((rows || []) as BaseTecnicaDoc[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ categoria: 'manual', status: 'ativo' });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (row: BaseTecnicaDoc) => {
    setForm(row);
    setEditing(row);
    setCreating(false);
    setViewing(null);
  };

  const closeDrawer = () => {
    setCreating(false);
    setEditing(null);
    setForm({});
  };

  const handleSave = async () => {
    if (!form.titulo?.trim()) { toast.error('Título é obrigatório'); return; }
    if (!form.conteudo?.trim()) { toast.error('Conteúdo é obrigatório'); return; }
    const payload: Record<string, unknown> = { ...form };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });

    const { error } = editing
      ? await supabase.from('base_tecnica').update(payload).eq('id', editing.id)
      : await supabase.from('base_tecnica').insert(payload);

    if (error) { toast.error(friendlyError(error, 'base tecnica')); return; }
    toast.success(editing ? 'Documento atualizado com sucesso' : 'Documento criado com sucesso');
    closeDrawer();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('base_tecnica').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(friendlyError(error, 'base tecnica')); return; }
    toast.success('Documento excluído com sucesso');
    setDeleteTarget(null);
    loadData();
  };

  const filteredData = categoryFilter === 'all' ? data : data.filter((d) => d.categoria === categoryFilter);

  const columns: Column<BaseTecnicaDoc>[] = [
    { key: 'titulo', header: 'Título', sortable: true, render: (r) => (
      <button onClick={() => setViewing(r)} className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left">
        {r.titulo}
      </button>
    ) },
    { key: 'categoria', header: 'Categoria', sortable: true, render: (r) => <Badge color={categoriaColors[r.categoria]}>{categoriaLabels[r.categoria]}</Badge> },
    { key: 'tags', header: 'Tags', render: (r) => {
      if (!r.tags) return '-';
      const tags = r.tags.split(',').map((t) => t.trim()).filter(Boolean);
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t, i) => <Badge key={i} color="slate">{t}</Badge>)}
          {tags.length > 3 && <Badge color="slate">+{tags.length - 3}</Badge>}
        </div>
      );
    } },
    { key: 'status', header: 'Status', sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'updated_at', header: 'Atualizado', sortable: true, sortValue: (r) => r.updated_at, render: (r) => formatDate(r.updated_at) },
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

  const categoryOptions = ['all', ...Object.keys(categoriaLabels)] as const;

  return (
    <div>
      <PageHeader
        title="Base Técnica"
        subtitle="Documentação e procedimentos técnicos"
        action={canEdit ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Documento</Button> : undefined}
      />

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {categoryOptions.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {cat === 'all' ? 'Todas' : categoriaLabels[cat as BaseTecnicaDoc['categoria']]}
          </button>
        ))}
      </div>

      <DataTable
        data={filteredData}
        columns={columns}
        searchKeys={['titulo', 'tags']}
        onRowClick={(row) => setViewing(row)}
        emptyMessage="Nenhum documento encontrado"
      />

      {/* View drawer (read-only) */}
      <CaseView
        open={!!viewing && !editing && !creating}
        title={viewing?.titulo || 'Documento'}
        onClose={() => setViewing(null)}
        footer={
          viewing ? (
            <>
              <Button variant="secondary" onClick={() => setViewing(null)}>Fechar</Button>
              {canEdit && <Button variant="primary" onClick={() => openEdit(viewing)}>Editar</Button>}
            </>
          ) : undefined
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color={categoriaColors[viewing.categoria]}>{categoriaLabels[viewing.categoria]}</Badge>
              <StatusBadge status={viewing.status} />
              {viewing.tags && viewing.tags.split(',').map((t, i) => t.trim() && <Badge key={i} color="slate">{t.trim()}</Badge>)}
            </div>
            <div className="text-xs text-slate-400">Atualizado em {formatDate(viewing.updated_at)}</div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                {viewing.conteudo}
              </pre>
            </div>
          </div>
        )}
      </CaseView>

      {/* Create/Edit drawer */}
      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Documento' : 'Novo Documento'}
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
            <label className="label">Título *</label>
            <input className="input" disabled={!canEdit} value={form.titulo ?? ''} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título do documento" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoria</label>
              <select className="input" disabled={!canEdit} value={form.categoria ?? 'manual'} onChange={(e) => setForm({ ...form, categoria: e.target.value as BaseTecnicaDoc['categoria'] })}>
                {Object.entries(categoriaLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" disabled={!canEdit} value={form.status ?? 'ativo'} onChange={(e) => setForm({ ...form, status: e.target.value as BaseTecnicaDoc['status'] })}>
                <option value="ativo">Ativo</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Tags (separadas por vírgula)</label>
            <input className="input" disabled={!canEdit} value={form.tags ?? ''} onChange={(e) => setForm({ ...form, tags: e.target.value || null })} placeholder="gps, gt06, instalação" />
          </div>
          <div>
            <label className="label">Conteúdo *</label>
            <textarea className="input font-mono text-xs" rows={12} disabled={!canEdit} value={form.conteudo ?? ''} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} placeholder="Escreva o conteúdo técnico do documento..." />
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Documento"
        message={`Tem certeza que deseja excluir "${deleteTarget?.titulo}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
