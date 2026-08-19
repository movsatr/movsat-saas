/*
import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui';

interface Veiculo {
  id: string;
  placa: string;
  modelo: string;
  ano: number;
  associado_id: string;
  associado_nome?: string;
  rastreador_id?: string;
  rastreador_imei?: string;
  status: 'ativo' | 'inativo';
  created_at: string;
}

export function Veiculos() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Veiculo | null>(null);
  const [associados, setAssociados] = useState<{ id: string; name: string }[]>([]);
  const [rastreadores, setRastreadores] = useState<{ id: string; imei: string }[]>([]);

  const [form, setForm] = useState({
    placa: '',
    modelo: '',
    ano: new Date().getFullYear(),
    associado_id: '',
    rastreador_id: '',
    status: 'ativo' as 'ativo' | 'inativo',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('veiculos')
      .select('*, associados(name), rastreadores(imei)')
      .order('created_at', { ascending: false });

    if (data) {
      setVeiculos(data.map((v: any) => ({
        ...v,
        associado_nome: v.associados?.name,
        rastreador_imei: v.rastreadores?.imei,
      })));
    }

    const [a, r] = await Promise.all([
      supabase.from('associados').select('id, name').order('name'),
      supabase.from('rastreadores').select('id, imei').order('imei'),
    ]);
    if (a.data) setAssociados(a.data);
    if (r.data) setRastreadores(r.data);
    setLoading(false);
  }

  function abrirNovo() {
    setEditando(null);
    setForm({ placa: '', modelo: '', ano: new Date().getFullYear(), associado_id: '', rastreador_id: '', status: 'ativo' });
    setModalOpen(true);
  }

  function abrirEditar(v: Veiculo) {
    setEditando(v);
    setForm({ placa: v.placa, modelo: v.modelo, ano: v.ano, associado_id: v.associado_id, rastreador_id: v.rastreador_id || '', status: v.status });
    setModalOpen(true);
  }

  async function salvar() {
    if (!form.placa || !form.modelo || !form.associado_id) return;
    const payload = {
      placa: form.placa,
      modelo: form.modelo,
      ano: form.ano,
      associado_id: form.associado_id,
      rastreador_id: form.rastreador_id || null,
      status: form.status,
    };
    if (editando) {
      await supabase.from('veiculos').update(payload).eq('id', editando.id);
    } else {
      await supabase.from('veiculos').insert(payload);
    }
    setModalOpen(false);
    load();
  }

  async function inativar(id: string) {
    await supabase.from('veiculos').update({ status: 'inativo' }).eq('id', id);
    load();
  }

  const filtrados = veiculos.filter((v) => {
    const matchSearch =
      v.placa.toLowerCase().includes(search.toLowerCase()) ||
      v.modelo.toLowerCase().includes(search.toLowerCase()) ||
      (v.associado_nome || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || v.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Veículos</h1>
          <p className="text-sm text-slate-400">Gestão da frota vinculada</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="w-4 h-4" /> Novo Veículo
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por placa, modelo ou associado..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as any)}
          className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="todos">Todos</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Placa</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Modelo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ano</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Associado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rastreador</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">Carregando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400">Nenhum veículo encontrado</td></tr>
            ) : (
              filtrados.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">{v.placa}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{v.modelo}</td>
                  <td className="px-4 py-3 text-slate-500">{v.ano}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{v.associado_nome || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{v.rastreador_imei || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      v.status === 'ativo'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700'
                    }`}>
                      {v.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => abrirEditar(v)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </button>
                      <button onClick={() => inativar(v.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setModalOpen(false)}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {editando ? 'Editar Veículo' : 'Novo Veículo'}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Placa *</label>
                  <input
                    value={form.placa}
                    onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    placeholder="ABC1D23"
                    maxLength={7}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Ano *</label>
                  <input
                    type="number"
                    value={form.ano}
                    onChange={(e) => setForm({ ...form, ano: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    min={1990}
                    max={2030}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Modelo *</label>
                <input
                  value={form.modelo}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Ex: Honda CG 160"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Associado *</label>
                <select
                  value={form.associado_id}
                  onChange={(e) => setForm({ ...form, associado_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="">Selecionar...</option>
                  {associados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Rastreador</label>
                <select
                  value={form.rastreador_id}
                  onChange={(e) => setForm({ ...form, rastreador_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="">Selecionar...</option>
                  {rastreadores.map((r) => <option key={r.id} value={r.id}>{r.imei}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={salvar}>Salvar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}