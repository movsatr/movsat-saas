import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Truck, Satellite, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { PageHeader } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, LoadingSpinner, Badge, formatCurrency, formatDate } from '@/components/ui';
import type { Associado, AssociadoWithRelations } from '@/types';

const PAGE_SIZE = 50;

export function Associados() {

  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = role === 'operador' || role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canEdit = role === 'operador' || role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'operador' || role === 'diretoria' || role === 'administrador';
  const canSeeFinancial = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<AssociadoWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Associado | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Associado | null>(null);
  const [form, setForm] = useState<Partial<Associado>>({});
  const mountedRef = useRef(true);

  const [atlasContracts, setAtlasContracts] = useState<Record<string, unknown>[]>([]);
  const [atlasLoading, setAtlasLoading] = useState(false);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const [atlasPage, setAtlasPage] = useState(1);
  const [atlasCount, setAtlasCount] = useState(0);
  const [atlasTotalPages, setAtlasTotalPages] = useState(1);
  const ATLAS_PAGE_SIZE = 10;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const allAssociados: AssociadoWithRelations[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error } = await supabase
          .from('associados')
          .select(`
            *,
            rastreadores:rastreadores(
              id, imei, modelo, status, data_instalacao,
              veiculo:veiculos(id, placa, modelo, ano)
            ),
            veiculos:veiculos(
              id, placa, modelo, ano, rastreador_id, status
            )
          `)
          .order('nome')
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;
        if (!page || page.length === 0) { hasMore = false; break; }

        allAssociados.push(...(page as unknown as AssociadoWithRelations[]));

        if (page.length < PAGE_SIZE) { hasMore = false; }
        else { offset += PAGE_SIZE; }
      }

      if (mountedRef.current) {
        setData(allAssociados);
      }
    } catch (err) {
      if (mountedRef.current) {
        setLoadError(err instanceof Error ? err.message : 'Falha ao carregar associados.');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const loadAtlasContracts = async (page = atlasPage) => {
    if (role !== 'administrador') return;
    setAtlasLoading(true);
    setAtlasError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Sessão inválida. Entre novamente.');
      const headers = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-api`;

      const readRows = (payload: any): Record<string, unknown>[] => {
        const root = payload?.data;
        const body = root?.data ?? root;
        const rows = body?.results ?? body?.items ?? body;
        return Array.isArray(rows) ? rows : [];
      };
      const readCount = (payload: any): number => {
        const root = payload?.data;
        const body = root?.data ?? root;
        const count = Number(body?.count ?? body?.total ?? 0);
        return Number.isFinite(count) ? count : 0;
      };
      const readResource = async (url: string, fallbackMessage: string) => {
        const response = await fetch(url, { headers });
        const payload = await response.json();
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || fallbackMessage);
        }
        return payload;
      };

      // A lista Softruck é exclusiva desse fornecedor e pode retornar zero.
      // Partimos dos contratos, consultamos os produtos vinculados e só então buscamos os veículos.
      const contractPayload = await readResource(
        `${baseUrl}?resource=contracts&page=${page}&page_size=${ATLAS_PAGE_SIZE}`,
        'Falha ao consultar contratos da Atlas.'
      );
      const contracts = readRows(contractPayload);
      const contractCount = readCount(contractPayload);

      const productsByContract = await Promise.all(contracts.map(async (contract) => {
        const contractId = contract.id;
        if (contractId == null) return { contract, products: [] as Record<string, unknown>[] };
        const productPayload = await readResource(
          `${baseUrl}?resource=contract_object_product&contract_id=${encodeURIComponent(String(contractId))}&page_size=100`,
          'Falha ao consultar produtos dos contratos Atlas.'
        );
        const products = readRows(productPayload);
        return { contract, products };
      }));

      const matchingObjects = productsByContract.flatMap(({ contract, products }) => {
        const trackerProducts = products.filter((product) => {
          const productId = String(product.product_id ?? '').trim();
          const productCode = String(
            product.product_code ?? product.code ?? product.product?.code ?? product.product_data?.code ?? ''
          ).trim();
          // Na resposta de vínculo da API só há product_id; o código 0013 corresponde ao ID 13.
          return productId === '13' || productId === '0013' || productCode === '0013';
        });
        return trackerProducts
          .filter((product) => product.contract_object_id != null)
          .map((product) => ({
            contractId: contract.id,
            objectId: String(product.contract_object_id),
            contract,
          }));
      });

      const byContract = new Map<string, typeof matchingObjects>();
      matchingObjects.forEach((item) => {
        const key = String(item.contractId);
        const existing = byContract.get(key) ?? [];
        existing.push(item);
        byContract.set(key, existing);
      });

      const vehicleRows = await Promise.all(Array.from(byContract.entries()).map(async ([contractId, items]) => {
        const objectPayload = await readResource(
          `${baseUrl}?resource=contract_object_vehicle&contract_id=${encodeURIComponent(contractId)}&page_size=100`,
          'Falha ao consultar veículos vinculados aos contratos Atlas.'
        );
        const objects = readRows(objectPayload);
        const wantedIds = new Set(items.map((item) => item.objectId));
        return objects
          .filter((row) => wantedIds.has(String(row.id ?? '')))
          .map((row) => {
            const person = (row.person_data ?? {}) as Record<string, unknown>;
            const vehicle = (row.vehicle_data ?? {}) as Record<string, unknown>;
            const contract = (row.contract_data ?? items[0]?.contract ?? {}) as Record<string, unknown>;
            return {
              ...row,
              person_data: {
                ...person,
                name: person.name ?? row.person_name ?? row.name,
                cpf_cnpj: person.cpf_cnpj ?? row.person_cpf_cnpj,
              },
              vehicle_data: {
                ...vehicle,
                plate: vehicle.plate ?? row.vehicle_plate,
                assembler: vehicle.assembler ?? row.vehicle_assembler,
                model: vehicle.model ?? row.vehicle_model,
              },
              contract_data: {
                ...contract,
                contract_id: contract.contract_id ?? row.contract_id,
                contract_status: contract.contract_status ?? row.contract_status,
              },
              product_code: '0013',
            } as Record<string, unknown>;
          });
      }));

      const trackerObjects = vehicleRows.flat();
      setAtlasContracts(trackerObjects);
      setAtlasPage(page);
      setAtlasCount(trackerObjects.length);
      setAtlasTotalPages(Math.max(1, Math.ceil(contractCount / ATLAS_PAGE_SIZE)));
    } catch (error) {
      setAtlasError(error instanceof Error ? error.message : 'Falha ao carregar associados rastreados da Atlas.');
    } finally {
      setAtlasLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (role === 'administrador') loadAtlasContracts(1); }, [role]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const openEdit = (row: AssociadoWithRelations) => {
    const { rastreadores: _r, veiculos: _v, ...rest } = row;
    void _r; void _v;
    setForm(rest);
    setEditing(rest);
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

  const filtered = search
    ? data.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.nome.toLowerCase().includes(q) ||
          (r.cpf_cnpj ?? '').toLowerCase().includes(q) ||
          (r.telefone ?? '').toLowerCase().includes(q) ||
          (r.email ?? '').toLowerCase().includes(q) ||
          (r.cidade ?? '').toLowerCase().includes(q) ||
          r.rastreadores.some((rt) => rt.imei.toLowerCase().includes(q)) ||
          r.veiculos.some((v) => v.placa.toLowerCase().includes(q))
        );
      })
    : data;

  const equipIcon = (status: string) => {
    if (status === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (status === 'com_problema') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-slate-400" />;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Associados"
        subtitle={`${data.length} associados cadastrados${search ? ` • ${filtered.length} na busca` : ''}`}
        action={canCreate ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Associado</Button> : undefined}
      />

      {role === 'administrador' && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Frota rastreada — Atlas</h2>
              <p className="mt-1 text-sm text-slate-500">Objetos retornados pela Atlas/Softruck, filtrados pelo produto Rastreador (0013).</p>
            </div>
            <Button onClick={() => loadAtlasContracts(1)} disabled={atlasLoading}>{atlasLoading ? 'Atualizando…' : 'Atualizar'}</Button>
          </div>
          {atlasError && <p className="mb-3 text-sm text-red-600">{atlasError}</p>}
          {!atlasError && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500">Registros de rastreamento</p>
                <p className="mt-1 text-xl font-semibold">{atlasCount.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500">Associados distintos nesta página</p>
                <p className="mt-1 text-xl font-semibold">{new Set(atlasContracts.map((row) => (row.person_data ?? {}) as Record<string, unknown>).map((person) => String(person.id ?? person.cpf_cnpj ?? person.name ?? '')).filter(Boolean)).size}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500">Veículos com placa nesta página</p>
                <p className="mt-1 text-xl font-semibold">{atlasContracts.filter((row) => Boolean(((row.vehicle_data ?? {}) as Record<string, unknown>).plate)).length}</p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                <th className="px-3 py-3">Associado Atlas</th><th className="px-3 py-3">CPF/CNPJ</th><th className="px-3 py-3">Placa</th><th className="px-3 py-3">Veículo</th><th className="px-3 py-3">Contrato</th><th className="px-3 py-3">Status</th>
              </tr></thead>
              <tbody>
                {atlasContracts.map((row, index) => {
                  const person = (row.person_data ?? {}) as Record<string, unknown>;
                  const vehicle = (row.vehicle_data ?? {}) as Record<string, unknown>;
                  const contract = (row.contract_data ?? {}) as Record<string, unknown>;
                  return <tr key={String(row.id ?? index)} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-3 font-medium">{String(person.name ?? 'Nome não informado pela API')}</td>
                    <td className="px-3 py-3">{String(person.cpf_cnpj ?? '—')}</td>
                    <td className="px-3 py-3 font-mono">{String(vehicle.plate ?? '—')}</td>
                    <td className="px-3 py-3">{[vehicle.assembler, vehicle.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-3">{String(contract.contract_id ?? '—')}</td>
                    <td className="px-3 py-3">{String(contract.contract_status ?? '—')}</td>
                  </tr>;
                })}
                {!atlasLoading && atlasContracts.length === 0 && !atlasError && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={6}>A API não retornou objetos rastreados para esta consulta.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={atlasLoading || atlasPage <= 1} onClick={() => loadAtlasContracts(atlasPage - 1)}>Anterior</Button>
            <span className="text-xs text-slate-500">Página {atlasPage} / {atlasTotalPages}</span>
            <Button variant="secondary" disabled={atlasLoading || atlasPage >= atlasTotalPages} onClick={() => loadAtlasContracts(atlasPage + 1)}>Próxima</Button>
          </div>
        </section>
      )}

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>
          <Button variant="secondary" className="mt-2" onClick={loadData}>Tentar novamente</Button>
        </div>
      )}

      <div className="mb-4 relative max-w-xs">
        <input
          type="text"
          placeholder="Buscar por nome, CPF, IMEI, placa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">CPF/CNPJ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cidade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plano</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Veículos</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rastreadores</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Equip.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pagamento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    {search ? 'Nenhum resultado para a busca.' : 'Nenhum associado cadastrado.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isExpanded = expandedRows.has(row.id);
                  const hasRelations = row.rastreadores.length > 0 || row.veiculos.length > 0;
                  const placas = row.veiculos.map((v) => v.placa).join(', ');
                  const imeis = row.rastreadores.map((r) => r.imei).join(', ');
                  return (
                    <tbody key={row.id}>
                      <tr
                        className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${hasRelations ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
                        onClick={() => hasRelations && toggleRow(row.id)}
                      >
                        <td className="px-3 py-3 text-slate-400">
                          {hasRelations && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.nome}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.cpf_cnpj || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.telefone || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {[row.cidade, row.estado].filter(Boolean).join('/') || '-'}
                        </td>
                        <td className="px-4 py-3">{row.plano}</td>
                        <td className="px-4 py-3">
                          {row.veiculos.length > 0 ? (
                            <span className="font-mono text-xs uppercase">{placas}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.rastreadores.length > 0 ? (
                            <span className="font-mono text-xs">{imeis}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {equipIcon(row.status_equipamento)}
                            <span className="text-xs text-slate-500">{row.rastreadores.length}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={row.status_pagamento} /></td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            {canEdit && <button onClick={() => openEdit(row)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Editar"><Pencil className="w-4 h-4 text-slate-500" /></button>}
                            {canDelete && <button onClick={() => setDeleteTarget(row)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Excluir"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && hasRelations && (
                        <tr className="bg-slate-50/75 dark:bg-slate-800/20">
                          <td></td>
                          <td colSpan={10} className="px-4 py-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Truck className="w-4 h-4 text-blue-500" />
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Veículos ({row.veiculos.length})</h4>
                                </div>
                                {row.veiculos.length === 0 ? (
                                  <p className="text-xs text-slate-400">Nenhum veículo cadastrado.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {row.veiculos.map((v) => {
                                      const linkedRast = row.rastreadores.find((r) => r.id === v.rastreador_id);
                                      return (
                                        <div key={v.id} className="flex items-center justify-between rounded-md border border-slate-100 dark:border-slate-800 px-3 py-2">
                                          <div>
                                            <span className="font-mono text-sm font-semibold uppercase">{v.placa}</span>
                                            <span className="text-slate-500 ml-2 text-sm">{v.modelo} ({v.ano})</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge color={v.status === 'ativo' ? 'green' : 'slate'}>{v.status}</Badge>
                                            {linkedRast && <Badge color="blue">Rastreador: {linkedRast.imei}</Badge>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Satellite className="w-4 h-4 text-green-500" />
                                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Rastreadores ({row.rastreadores.length})</h4>
                                </div>
                                {row.rastreadores.length === 0 ? (
                                  <p className="text-xs text-slate-400">Nenhum rastreador vinculado.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {row.rastreadores.map((r) => {
                                      const linkedVeic = r.veiculo?.[0];
                                      return (
                                        <div key={r.id} className="flex items-center justify-between rounded-md border border-slate-100 dark:border-slate-800 px-3 py-2">
                                          <div>
                                            <span className="font-mono text-sm font-semibold">{r.imei}</span>
                                            {r.modelo && <span className="text-slate-500 ml-2 text-sm">{r.modelo}</span>}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <StatusBadge status={r.status} />
                                            {linkedVeic && <Badge color="blue">Veículo: {linkedVeic.placa}</Badge>}
                                            {r.data_instalacao && <span className="text-xs text-slate-400">{formatDate(r.data_instalacao)}</span>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {(canSeeFinancial || row.observacoes) && (
                              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                                {canSeeFinancial && <span>Mensalidade: {formatCurrency(row.valor_mensalidade)}</span>}
                                <span>Cadastro: {formatDate(row.data_cadastro)}</span>
                                {row.observacoes && <span className="italic">Obs: {row.observacoes}</span>}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
              <label className="label">Estado</label>
              <input className="input" disabled={!canEdit} value={form.estado ?? ''} onChange={(e) => setForm({ ...form, estado: e.target.value })} placeholder="UF" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Plano</label>
              <select className="input" disabled={!canEdit} value={form.plano ?? 'Basico'} onChange={(e) => setForm({ ...form, plano: e.target.value })}>
                <option value="Basico">Básico</option>
                <option value="Intermediario">Intermediário</option>
                <option value="Premium">Premium</option>
                <option value="Empresarial">Empresarial</option>
              </select>
            </div>
            {canSeeFinancial && (
              <div>
                <label className="label">Mensalidade (R$)</label>
                <input className="input" type="number" step="0.01" disabled={!canEdit} value={form.valor_mensalidade ?? 0} onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status Pagamento</label>
              <select className="input" disabled={!canEdit} value={form.status_pagamento ?? 'em_dia'} onChange={(e) => setForm({ ...form, status_pagamento: e.target.value as Associado['status_pagamento'] })}>
                <option value="em_dia">Em dia</option>
                <option value="atrasado">Atrasado</option>
                <option value="inadimplente">Inadimplente</option>
              </select>
            </div>
            <div>
              <label className="label">Status Equipamento</label>
              <select className="input" disabled={!canEdit} value={form.status_equipamento ?? 'sem_equipamento'} onChange={(e) => setForm({ ...form, status_equipamento: e.target.value as Associado['status_equipamento'] })}>
                <option value="ok">OK</option>
                <option value="com_problema">Com problema</option>
                <option value="sem_equipamento">Sem equipamento</option>
              </select>
            </div>
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
