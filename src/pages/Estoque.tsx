import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { DataTable, PageHeader, type Column } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, Badge, LoadingSpinner, formatCurrency, MetricCard } from '@/components/ui';
import type { EstoqueItem } from '@/types';

const categoriaLabels: Record<EstoqueItem['categoria'], string> = {
  rastreador: 'Rastreador',
  acessorio: 'Acessório',
  simcard: 'SIM Card',
  ferramenta: 'Ferramenta',
};

const categoriaColors: Record<EstoqueItem['categoria'], 'blue' | 'purple' | 'green' | 'orange'> = {
  rastreador: 'blue',
  acessorio: 'purple',
  simcard: 'green',
  ferramenta: 'orange',
};

export function Estoque() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = role === 'operador' || role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canEdit = role === 'operador' || role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<EstoqueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EstoqueItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EstoqueItem | null>(null);
  const [form, setForm] = useState<Partial<EstoqueItem>>({});

  const loadData = async () => {
    const { data: rows } = await supabase.from('estoque').select('*').order('nome');
    setData((rows || []) as EstoqueItem[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setForm({ categoria: 'rastreador', quantidade: 0, quantidade_minima: 0, preco_unitario: 0 });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (row: EstoqueItem) => {
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
    if (payload.quantidade != null) payload.quantidade = Number(payload.quantidade);
    if (payload.quantidade_minima != null) payload.quantidade_minima = Number(payload.quantidade_minima);
    if (payload.preco_unitario != null) payload.preco_unitario = Number(payload.preco_unitario);

    const { error } = editing
      ? await supabase.from('estoque').update(payload).eq('id', editing.id)
      : await supabase.from('estoque').insert(payload);

    if (error) { toast.error(friendlyError(error, 'estoque')); return; }
    toast.success(editing ? 'Item atualizado com sucesso' : 'Item criado com sucesso');
    closeDrawer();
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('estoque').delete().eq('id', deleteTarget.id);
    if (error) { toast.error(friendlyError(error, 'estoque')); return; }
    toast.success('Item excluído com sucesso');
    setDeleteTarget(null);
    loadData();
  };

  const lowStockCount = data.filter((d) => d.quantidade <= d.quantidade_minima).length;
  const outOfStockCount = data.filter((d) => d.quantidade === 0).length;
  const totalValue = data.reduce((sum, d) => sum + d.quantidade * d.preco_unitario, 0);

  const columns: Column<EstoqueItem>[] = [
    { key: 'nome', header: 'Item', sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-slate-900 dark:text-white">{r.nome}</span>
        {r.quantidade === 0 && <Badge color="red">Esgotado</Badge>}
        {r.quantidade > 0 && r.quantidade <= r.quantidade_minima && <Badge color="yellow">Baixo</Badge>}
      </div>
    ) },
    { key: 'categoria', header: 'Categoria', sortable: true, render: (r) => <Badge color={categoriaColors[r.categoria]}>{categoriaLabels[r.categoria]}</Badge> },
    { key: 'quantidade', header: 'Qtd', sortable: true, sortValue: (r) => r.quantidade, render: (r) => {
      const isLow = r.quantidade <= r.quantidade_minima;
      return <span className={`font-semibold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{r.quantidade}</span>;
    } },
    { key: 'quantidade_minima', header: 'Mín', sortable: true, sortValue: (r) => r.quantidade_minima, render: (r) => <span className="text-slate-400">{r.quantidade_minima}</span> },
    { key: 'preco_unitario', header: 'Preço Unit.', sortable: true, sortValue: (r) => r.preco_unitario, render: (r) => formatCurrency(r.preco_unitario) },
    { key: 'fornecedor', header: 'Fornecedor', render: (r) => r.fornecedor || '-' },
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
        title="Estoque"
        subtitle="Controle de equipamentos e insumos"
        action={canCreate ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Item</Button> : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard label="Total de Itens" value={data.length} icon={Package} accent="blue" />
        <MetricCard label="Itens em Baixa" value={lowStockCount} icon={AlertTriangle} accent="yellow" />
        <MetricCard label="Esgotados" value={outOfStockCount} icon={AlertTriangle} accent="red" />
        <MetricCard label="Valor em Estoque" value={formatCurrency(totalValue)} icon={Package} accent="green" />
      </div>

      <DataTable
        data={data}
        columns={columns}
        searchKeys={['nome', 'fornecedor']}
        onRowClick={openEdit}
        emptyMessage="Nenhum item em estoque"
      />

      <CaseView
        open={creating || !!editing}
        title={editing ? 'Editar Item' : 'Novo Item'}
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
            <input className="input" disabled={!canEdit} value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do item" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Categoria</label>
              <select className="input" disabled={!canEdit} value={form.categoria ?? 'rastreador'} onChange={(e) => setForm({ ...form, categoria: e.target.value as EstoqueItem['categoria'] })}>
                <option value="rastreador">Rastreador</option>
                <option value="acessorio">Acessório</option>
                <option value="simcard">SIM Card</option>
                <option value="ferramenta">Ferramenta</option>
              </select>
            </div>
            <div>
              <label className="label">Fornecedor</label>
              <input className="input" disabled={!canEdit} value={form.fornecedor ?? ''} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} placeholder="Nome do fornecedor" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Quantidade</label>
              <input className="input" type="number" disabled={!canEdit} value={form.quantidade ?? 0} onChange={(e) => setForm({ ...form, quantidade: e.target.value === '' ? 0 : Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Qtd. Mínima</label>
              <input className="input" type="number" disabled={!canEdit} value={form.quantidade_minima ?? 0} onChange={(e) => setForm({ ...form, quantidade_minima: e.target.value === '' ? 0 : Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Preço Unit. (R$)</label>
              <input className="input" type="number" step="0.01" disabled={!canEdit} value={form.preco_unitario ?? 0} onChange={(e) => setForm({ ...form, preco_unitario: e.target.value === '' ? 0 : Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={3} disabled={!canEdit} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} placeholder="Notas sobre o item" />
          </div>
        </div>
      </CaseView>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir Item"
        message={`Tem certeza que deseja excluir "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
