import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Truck, Satellite, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';
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
  const [atlasCount, setAtlasCount] = useState(0);
  const ATLAS_CONTRACTS_PER_PAGE = 50;
  const ATLAS_PRODUCT_ID = '283';
  const ATLAS_PROBE_CONCURRENCY = 8;

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

  const loadAtlasContracts = async () => {
    if (role !== 'administrador' && role !== 'diretoria') return;
    setAtlasLoading(true);
    setAtlasError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Sessão inválida. Entre novamente para consultar a Mutual Tech.');

      const headers = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-api`;

      const atlasGet = async (params: Record<string, string>): Promise<Record<string, unknown> | Record<string, unknown>[]> => {
        const query = new URLSearchParams(params);
        const response = await fetch(`${baseUrl}?${query.toString()}`, {
          headers,
          signal: AbortSignal.timeout(35000),
        });
        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const errorPayload = await response.json();
            detail = String(errorPayload?.error ?? detail);
          } catch { /* resposta não-JSON */ }
          throw new Error(`Falha na consulta à Mutual Tech: ${detail}`);
        }
        const payload = await response.json().catch(() => null);
        if (!payload || payload.ok === false) {
          throw new Error(String(payload?.error ?? 'Resposta inválida da Mutual Tech.'));
        }
        return payload.data as Record<string, unknown> | Record<string, unknown>[];
      };

      const getRows = (payload: Record<string, unknown> | Record<string, unknown>[]): Record<string, unknown>[] => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload.results)) return payload.results as Record<string, unknown>[];
        if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[];
        const nested = payload.data;
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
          const nestedData = nested as Record<string, unknown>;
          if (Array.isArray(nestedData.results)) return nestedData.results as Record<string, unknown>[];
          if (Array.isArray(nestedData.data)) return nestedData.data as Record<string, unknown>[];
        }
        return [];
      };

      const getTotal = (payload: Record<string, unknown> | Record<string, unknown>[]): number | null => {
        if (Array.isArray(payload)) return null;
        const nested = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
          ? payload.data as Record<string, unknown>
          : null;
        const raw = payload.count ?? payload.total ?? nested?.count ?? nested?.total;
        const total = Number(raw);
        return raw != null && Number.isFinite(total) ? total : null;
      };

      // Mantém os parâmetros validados: contratos ATIVO e produto 283.
      // Percorre todas as páginas de contratos e, em cada contrato, todas as
      // páginas de vínculos do produto. A consulta só é considerada completa
      // quando a paginação termina sem falhas.
      const fetchAllPages = async (
        params: Record<string, string>,
        pageSize: number,
        maxPages = 1000,
      ): Promise<Record<string, unknown>[]> => {
        const allRows: Record<string, unknown>[] = [];
        for (let page = 1; page <= maxPages; page++) {
          const payload = await atlasGet({ ...params, page: String(page), page_size: String(pageSize) });
          const rows = getRows(payload);
          allRows.push(...rows);
          const total = getTotal(payload);
          if (rows.length === 0 || rows.length < pageSize || (total !== null && page * pageSize >= total)) {
            return allRows;
          }
        }
        throw new Error('A Mutual Tech excedeu o limite de páginas consultadas. A lista não foi marcada como completa; tente novamente.');
      };

      const contracts = await fetchAllPages({
        resource: 'contracts',
        contract_status: 'ATIVO',
      }, ATLAS_CONTRACTS_PER_PAGE);

      const contractIds = [...new Set(contracts
        .map((contract) => String(contract.id ?? ''))
        .filter(Boolean))];

      const productRows: Record<string, unknown>[] = [];
      const failedContracts: string[] = [];
      for (let offset = 0; offset < contractIds.length; offset += ATLAS_PROBE_CONCURRENCY) {
        const batch = contractIds.slice(offset, offset + ATLAS_PROBE_CONCURRENCY);
        const results = await Promise.allSettled(batch.map(async (contractId) =>
          fetchAllPages({
            resource: 'contract_object_product',
            contract_id: contractId,
            product_id: ATLAS_PRODUCT_ID,
          }, 10)
        ));
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            failedContracts.push(batch[index]);
            return;
          }
          productRows.push(...result.value);
        });
      }

      if (failedContracts.length > 0) {
        throw new Error(`Consulta incompleta: não foi possível verificar ${failedContracts.length} contrato(s) na Mutual Tech. Nenhum resultado parcial será apresentado como lista completa. Atualize para tentar novamente.`);
      }

      // Evita duplicar o mesmo vínculo quando a API repetir registros entre páginas.
      const uniqueProducts = [...new Map(productRows.map((row) => [
        String(row.id ?? row.object_id ?? `${row.contract_id ?? ''}-${row.plate ?? ''}-${row.product_id ?? ATLAS_PRODUCT_ID}`),
        row,
      ])).values()];

      const found: Record<string, unknown>[] = [];
      for (let offset = 0; offset < uniqueProducts.length; offset += ATLAS_PROBE_CONCURRENCY) {
        const batch = uniqueProducts.slice(offset, offset + ATLAS_PROBE_CONCURRENCY);
        const results = await Promise.allSettled(batch.map(async (row) => {
          const plate = String(row.plate ?? row.vehicle_plate ?? '');
          let person: Record<string, unknown> = {};
          let contract: Record<string, unknown> = {
            contract_id: row.contract_id ?? '—',
            contract_status: 'ATIVO',
          };
          if (plate) {
            const vehicleData = await atlasGet({
              resource: 'contract_object_vehicle',
              vehicle_plate: plate,
              page: '1',
              page_size: '10',
            });
            const vehicleRows = getRows(vehicleData);
            const matchingVehicle = vehicleRows.find((vehicle) =>
              String(vehicle.contract_id ?? '') === String(row.contract_id ?? '')
            ) ?? vehicleRows[0];
            if (matchingVehicle) {
              person = {
                id: matchingVehicle.person_id,
                name: matchingVehicle.person_name,
                cpf_cnpj: matchingVehicle.person_cpf_cnpj,
              };
              contract = {
                contract_id: matchingVehicle.contract_id ?? row.contract_id ?? '—',
                contract_status: matchingVehicle.contract_status ?? 'ATIVO',
              };
            }
          }
          return {
            id: row.id ?? row.object_id ?? `${String(row.contract_id ?? '')}-${plate}`,
            person_data: person,
            vehicle_data: { plate, model: row.model, assembler: row.assembler },
            contract_data: contract,
            product_code: ATLAS_PRODUCT_ID,
          };
        }));
        results.forEach((result) => {
          if (result.status === 'rejected') {
            throw new Error('A consulta encontrou veículos cujo titular não pôde ser confirmado. Atualize para repetir a consulta completa.');
          }
          found.push(result.value);
        });
      }

      found.sort((a, b) =>
        String((a.vehicle_data as Record<string, unknown>).plate).localeCompare(
          String((b.vehicle_data as Record<string, unknown>).plate)
        )
      );

      setAtlasContracts(found);
      setAtlasCount(found.length);
      setAtlasError(null);
    } catch (error) {
      setAtlasContracts([]);
      setAtlasCount(0);
      const msg = error instanceof Error ? error.message : 'Falha ao carregar associados rastreados da Mutual Tech.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
        setAtlasError('Não foi possível conectar à Mutual Tech. Verifique sua internet e tente novamente.');
      } else {
        setAtlasError(msg);
      }
    } finally {
      setAtlasLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (role === 'administrador' || role === 'diretoria') loadAtlasContracts(); }, [role]);

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

      {(role === 'administrador' || role === 'diretoria') && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Integração Atlas/Mutual</h2>
                <Badge color="slate">origem dos dados</Badge>
                <Badge color="blue">somente leitura</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">Veículos vinculados ao produto RASTREADOR (ID 283) em todos os contratos ativos da Mutual Tech. Consulta somente leitura; não altera os cadastros do MovSat.</p>
            </div>
            <Button variant="secondary" onClick={() => loadAtlasContracts()} disabled={atlasLoading}>{atlasLoading ? 'Consultando todos…' : 'Atualizar consulta completa'}</Button>
          </div>
          {atlasLoading && <p className="mb-3 text-sm text-slate-500">Consultando a Atlas…</p>}
          {atlasError && <p className="mb-3 text-sm text-red-600">{atlasError}</p>}
          {!atlasError && atlasContracts.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500">Veículos encontrados com produto 283</p>
                <p className="mt-1 text-xl font-semibold">{atlasCount.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500">Associados distintos na Atlas</p>
                <p className="mt-1 text-xl font-semibold">{new Set(atlasContracts.map((row) => (row.person_data ?? {}) as Record<string, unknown>).map((person) => String(person.id ?? person.cpf_cnpj ?? person.name ?? '')).filter(Boolean)).size}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500">Veículos com placa</p>
                <p className="mt-1 text-xl font-semibold">{atlasContracts.filter((row) => Boolean(((row.vehicle_data ?? {}) as Record<string, unknown>).plate)).length}</p>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                <th className="px-3 py-3">Associado</th><th className="px-3 py-3">CPF/CNPJ</th><th className="px-3 py-3">Placa</th><th className="px-3 py-3">Veículo</th><th className="px-3 py-3">Contrato</th><th className="px-3 py-3">Status</th>
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
                {!atlasLoading && atlasContracts.length === 0 && !atlasError && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={6}>Nenhum veículo encontrado com o produto rastreador (283) nos contratos ativos consultados.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">Consulta completa dos contratos ativos e dos vínculos paginados com o produto 283.</p>
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
