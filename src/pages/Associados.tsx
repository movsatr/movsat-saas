import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Truck, Satellite, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/lib/toast';
import { friendlyError } from '@/lib/errors';
import { PageHeader } from '@/components/DataTable';
import { CaseView } from '@/components/CaseView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button, StatusBadge, LoadingSpinner, Badge, formatCurrency, formatDate } from '@/components/ui';
import { compareWithLocal, fetchActiveObjectProductCatalog, type ActiveProductScanResult, type ActiveTrackerRecord, type AtlasQuery } from '@/lib/atlas-contract-objects';
import type { Associado, AssociadoWithRelations } from '@/types';

const PAGE_SIZE = 50;

export function Associados() {

  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = role === 'operador' || role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canEdit = role === 'supervisor' || role === 'diretoria' || role === 'administrador';
  const canDelete = role === 'diretoria' || role === 'administrador';
  const canSeeFinancial = role === 'diretoria' || role === 'administrador';

  const [data, setData] = useState<AssociadoWithRelations[]>([]);
  const [unassignedVehicles, setUnassignedVehicles] = useState<Array<{ id_externo: string | null; rastreador: { id: string; imei: string; status: string } | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Associado | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Associado | null>(null);
  const [form, setForm] = useState<Partial<Associado>>({});
  const canChangeForm = creating ? canCreate : canEdit;
  const mountedRef = useRef(true);

  const [atlasContracts, setAtlasContracts] = useState<ActiveTrackerRecord[]>([]);
  const [productScan, setProductScan] = useState<ActiveProductScanResult | null>(null);
  const [atlasLoading, setAtlasLoading] = useState(false);
  const [atlasProgress, setAtlasProgress] = useState<{ page: number; pagesTotal: number | null; objectsScanned: number; totalActiveObjects: number | null } | null>(null);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const [atlasLastRefresh, setAtlasLastRefresh] = useState<string | null>(null);
  const [softruckDiagnostic, setSoftruckDiagnostic] = useState<{ count: number; fields: string[]; routes?: Array<{ resource: string; httpStatus: number; count: number | null; pageRows: number | null; sampleFields: string[] }> } | null>(null);

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
              id, placa, modelo, ano, id_externo, associado_id, rastreador_id, status,
              rastreador:rastreadores(id, imei, status)
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

      let localUnassignedVehicles: Array<{ id_externo: string | null; rastreador: { id: string; imei: string; status: string } | null }> = [];
      if (role === 'administrador' || role === 'diretoria') {
        let vehicleOffset = 0;
        while (true) {
          const { data: unassignedPage, error: unassignedError } = await supabase
            .from('veiculos')
            .select('id_externo, rastreador:rastreadores(id, imei, status)')
            .is('associado_id', null)
            .not('id_externo', 'is', null)
            .range(vehicleOffset, vehicleOffset + PAGE_SIZE - 1);
          if (unassignedError) throw unassignedError;
          const page = (unassignedPage ?? []) as unknown as typeof localUnassignedVehicles;
          localUnassignedVehicles.push(...page);
          if (page.length < PAGE_SIZE) break;
          vehicleOffset += PAGE_SIZE;
        }
      }

      if (mountedRef.current) {
        setData(allAssociados);
        setUnassignedVehicles(localUnassignedVehicles);
      }
    } catch (err) {
      if (mountedRef.current) {
        setLoadError(err instanceof Error ? err.message : 'Falha ao carregar associados.');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const loadAtlasContracts = useCallback(async () => {
    if (role !== 'administrador' && role !== 'diretoria') return;
    setAtlasLoading(true);
    setAtlasError(null);
    setAtlasProgress({ page: 0, pagesTotal: null, objectsScanned: 0, totalActiveObjects: null });
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Sessão inválida. Entre novamente para consultar a Mutual Tech.');
      const headers = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-api`;

      const atlasGet: AtlasQuery = async (params) => {
        const query = new URLSearchParams(params);
        const response = await fetch(`${baseUrl}?${query.toString()}`, {
          headers,
          signal: AbortSignal.timeout(35000),
        });
        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const errorPayload = await response.json() as { error?: string };
            detail = errorPayload.error ?? detail;
          } catch { /* resposta não-JSON */ }
          throw new Error(`Falha na consulta à Mutual Tech: ${detail}`);
        }
        const payload = await response.json() as { ok?: boolean; error?: string; data?: unknown };
        if (payload.ok !== true) {
          throw new Error(payload.error ?? 'Resposta inválida da Mutual Tech.');
        }
        return payload.data;
      };

      const scan = await fetchActiveObjectProductCatalog(atlasGet, setAtlasProgress);
      setProductScan(scan);
      setAtlasContracts([]);
      setSoftruckDiagnostic(null);
      setAtlasLastRefresh(scan.complete ? new Date().toISOString() : null);
    } catch (error) {
      setAtlasContracts([]);
      setProductScan(null);
      setSoftruckDiagnostic(null);
      setAtlasLastRefresh(null);
      const msg = error instanceof Error ? error.message : 'Falha ao consultar os rastreadores ativos da Mutual Tech.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
        setAtlasError('Não foi possível conectar à Mutual Tech. Verifique sua internet e tente novamente.');
      } else {
        setAtlasError(msg);
      }
    } finally {
      setAtlasLoading(false);
      setAtlasProgress(null);
    }
  }, [role]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (role === 'administrador' || role === 'diretoria') loadAtlasContracts(); }, [role, loadAtlasContracts]);

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
    if (editing && !canEdit) {
      toast.error('Seu perfil não pode editar associados');
      return;
    }
    if (creating && !canCreate) {
      toast.error('Seu perfil não pode criar associados');
      return;
    }

    const nome = form.nome?.trim() ?? '';
    if (!nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    const cpfCnpj = form.cpf_cnpj?.trim() ?? '';
    if (cpfCnpj) {
      const digits = cpfCnpj.replace(/\D/g, '');
      if (digits.length !== 11 && digits.length !== 14) {
        toast.error('CPF/CNPJ inválido');
        return;
      }
    }

    const email = form.email?.trim() ?? '';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('E-mail inválido');
      return;
    }

    const mensalidade = Number(form.valor_mensalidade ?? 0);
    if (!Number.isFinite(mensalidade) || mensalidade < 0) {
      toast.error('Mensalidade inválida');
      return;
    }

    const payload: Record<string, unknown> = {
      ...form,
      nome,
      cpf_cnpj: cpfCnpj || null,
      email: email || null,
      valor_mensalidade: mensalidade,
    };
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
    if (!canDelete) {
      toast.error('Seu perfil não pode excluir associados');
      setDeleteTarget(null);
      return;
    }
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
              <p className="mt-1 text-sm text-slate-500">Varredura somente leitura de todos os objetos e contratos ativos da Mutual Tech. Primeiro identifica e contabiliza os produtos vinculados; a confirmação de rastreador depende da validação posterior dos vínculos de veículo e titular.</p>
            </div>
            <Button variant="secondary" onClick={loadAtlasContracts} disabled={atlasLoading}>{atlasLoading ? 'Consultando…' : 'Atualizar consulta completa'}</Button>
          </div>
          {atlasLoading && <div className="mb-3 text-sm text-slate-600">
            <p>Varredura em lotes de 50 objetos. {atlasProgress?.page ? `Página ${atlasProgress.page}${atlasProgress.pagesTotal ? ` de ${atlasProgress.pagesTotal}` : ''} · ${atlasProgress.objectsScanned.toLocaleString('pt-BR')} objetos processados` : 'Preparando primeira página…'}</p>
            {atlasProgress?.totalActiveObjects && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, atlasProgress.objectsScanned / atlasProgress.totalActiveObjects * 100)}%` }} /></div>}
          </div>}
          {atlasError && <p className="mb-3 text-sm text-red-600">{atlasError}</p>}
          {atlasLastRefresh && !atlasError && <p className="mb-3 text-xs text-slate-500">Última consulta completa: {new Date(atlasLastRefresh).toLocaleString('pt-BR')}</p>}
          {productScan && <div className="mb-4 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Varredura de produtos dos objetos ativos</p>
              <Badge color={productScan.complete ? 'green' : 'yellow'}>{productScan.complete ? 'Varredura completa' : 'Incompleta'}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div><p className="text-xs text-slate-500">Objetos ativos na base</p><p className="text-lg font-semibold">{productScan.totalActiveObjects?.toLocaleString('pt-BR') ?? '—'}</p></div>
              <div><p className="text-xs text-slate-500">Objetos consultados</p><p className="text-lg font-semibold">{productScan.objectsScanned.toLocaleString('pt-BR')}</p></div>
              <div><p className="text-xs text-slate-500">Vínculos de produto</p><p className="text-lg font-semibold">{productScan.productRowsScanned.toLocaleString('pt-BR')}</p></div>
              <div><p className="text-xs text-slate-500">Páginas percorridas</p><p className="text-lg font-semibold">{productScan.pagesScanned.toLocaleString('pt-BR')}</p></div>
            </div>
            {productScan.failedObjects > 0 && <p className="mt-2 text-sm text-red-600">{productScan.failedObjects} objetos tiveram falha na consulta. O resultado não pode ser considerado conclusivo.</p>}
            {productScan.countChangedDuringScan && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">A Mutual alterou a contagem durante a consulta (inicial: {productScan.totalActiveObjects?.toLocaleString('pt-BR') ?? '—'}; última leitura: {productScan.latestReportedTotal?.toLocaleString('pt-BR') ?? '—'}). Os dados foram preservados, mas esta execução não será marcada como conclusiva.</p>}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700"><th className="py-2 pr-3">ID produto</th><th className="py-2 pr-3">Produto / descrição</th><th className="py-2 pr-3">Código fornecedor</th><th className="py-2 pr-3">Vínculos</th><th className="py-2 pr-3">Ativados</th><th className="py-2">Excluídos</th></tr></thead>
                <tbody>{productScan.products.map((product) => <tr key={[product.productId, product.name, product.description, product.supplierCode].join('|')} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3 font-mono">{product.productId}</td>
                  <td className="py-2 pr-3"><span className="font-medium">{product.name}</span>{product.description && <span className="block text-xs text-slate-500">{product.description}</span>}</td>
                  <td className="py-2 pr-3">{product.supplierCode || '—'}</td>
                  <td className="py-2 pr-3 tabular-nums">{product.occurrences.toLocaleString('pt-BR')}</td>
                  <td className="py-2 pr-3 tabular-nums">{product.activated.toLocaleString('pt-BR')}</td>
                  <td className="py-2 tabular-nums">{product.deleted.toLocaleString('pt-BR')}</td>
                </tr>)}
                {productScan.products.length === 0 && <tr><td colSpan={6} className="py-5 text-center text-slate-500">Nenhum vínculo de produto retornado nas páginas consultadas.</td></tr>}</tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">Esta etapa identifica o catálogo associado aos objetos ativos. Ela não declara quantidade de rastreadores: a confirmação exige cruzar os produtos identificados com ativação, veículo, contrato e titular.</p>
          </div>}{softruckDiagnostic && <div className="mb-4 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><p className="font-medium">Rastreadores ativos confirmados na Mutual: {softruckDiagnostic.count}.</p><p className="mt-1 text-xs text-slate-500">Campos conciliados: {softruckDiagnostic.fields.join(', ') || 'nenhum campo encontrado'}.</p><p className="mt-1 text-xs text-slate-500">A classificação considera vínculo de produto ativado, contrato e objeto ativos, com IDs consistentes entre as consultas.</p>{softruckDiagnostic.routes && <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700"><p className="font-medium">Diagnóstico das rotas (somente contagens e nomes de campos)</p>{softruckDiagnostic.routes.map((route) => <div key={route.resource} className="text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">{route.resource}</span>: HTTP {route.httpStatus} · total {route.count ?? 'não informado'} · página {route.pageRows ?? '—'} registros{route.sampleFields.length ? ` · campos: ${route.sampleFields.join(', ')}` : ''}</div>)}</div>}</div>}
          {atlasContracts.length > 0 && <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                <th className="px-3 py-3">Associado Mutual</th><th className="px-3 py-3">CPF/CNPJ</th><th className="px-3 py-3">Placa</th><th className="px-3 py-3">Veículo</th><th className="px-3 py-3">Contrato / objeto</th><th className="px-3 py-3">Produto ativo</th><th className="px-3 py-3">Comparação local</th>
              </tr></thead>
              <tbody>
                {atlasContracts.map((row) => {
                  const localMatch = compareWithLocal(row, data, unassignedVehicles);
                  const localStatus = localMatch.status === 'matched'
                    ? `Já cadastrado: ${localMatch.associateName}${localMatch.trackerStatus ? ` · rastreador local ${localMatch.trackerStatus}` : ' · sem rastreador local'}${localMatch.personMatches === false ? ' · titular divergente' : ''}`
                    : localMatch.status === 'unassigned'
                      ? `Veículo cadastrado sem associado${localMatch.trackerStatus ? ` · rastreador local ${localMatch.trackerStatus}` : ''}`
                      : localMatch.status === 'ambiguous'
                        ? 'ID externo duplicado nos dados locais'
                        : localMatch.status === 'missing_external_id'
                          ? 'Sem ID externo; não conciliável'
                          : 'Veículo ainda não cadastrado';
                  return <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-3 font-medium">{row.person.name ?? 'Nome não informado'}</td>
                    <td className="px-3 py-3">{row.person.cpfCnpj ?? '—'}</td>
                    <td className="px-3 py-3 font-mono">{row.vehicle.plate ?? '—'}</td>
                    <td className="px-3 py-3">{[row.vehicle.assembler, row.vehicle.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-3">{row.contract.id} / {row.id}</td>
                    <td className="px-3 py-3">{row.product.name} · ativo</td>
                    <td className="px-3 py-3">{localStatus}</td>
                  </tr>;
                })}
                {!atlasLoading && atlasContracts.length === 0 && !atlasError && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={7}>A identificação de rastreadores ativos depende da confirmação do vínculo de produto pela Mutual Tech. Esta tela está em modo diagnóstico.</td></tr>}
              </tbody>
            </table>
          </div>}
          <p className="mt-3 text-xs text-slate-500">A consulta Softruck é somente leitura. Nenhum cadastro local é criado ou alterado.</p>
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
            {canChangeForm && <Button variant="primary" onClick={handleSave}>Salvar</Button>}
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input className="input" disabled={!canChangeForm} value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do associado" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">CPF/CNPJ</label>
              <input className="input" disabled={!canChangeForm} value={form.cpf_cnpj ?? ''} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" disabled={!canChangeForm} value={form.telefone ?? ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(77) 99999-9999" />
            </div>
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" type="email" disabled={!canChangeForm} value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="label">Endereço</label>
            <input className="input" disabled={!canChangeForm} value={form.endereco ?? ''} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número, bairro" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cidade</label>
              <input className="input" disabled={!canChangeForm} value={form.cidade ?? ''} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade" />
            </div>
            <div>
              <label className="label">Estado</label>
              <input className="input" disabled={!canChangeForm} value={form.estado ?? ''} onChange={(e) => setForm({ ...form, estado: e.target.value })} placeholder="UF" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Plano</label>
              <select className="input" disabled={!canChangeForm} value={form.plano ?? 'Basico'} onChange={(e) => setForm({ ...form, plano: e.target.value })}>
                <option value="Basico">Básico</option>
                <option value="Intermediario">Intermediário</option>
                <option value="Premium">Premium</option>
                <option value="Empresarial">Empresarial</option>
              </select>
            </div>
            {canSeeFinancial && (
              <div>
                <label className="label">Mensalidade (R$)</label>
                <input className="input" type="number" min="0" step="0.01" disabled={!canChangeForm} value={form.valor_mensalidade ?? 0} onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status Pagamento</label>
              <select className="input" disabled={!canChangeForm} value={form.status_pagamento ?? 'em_dia'} onChange={(e) => setForm({ ...form, status_pagamento: e.target.value as Associado['status_pagamento'] })}>
                <option value="em_dia">Em dia</option>
                <option value="atrasado">Atrasado</option>
                <option value="inadimplente">Inadimplente</option>
              </select>
            </div>
            <div>
              <label className="label">Status Equipamento</label>
              <select className="input" disabled={!canChangeForm} value={form.status_equipamento ?? 'sem_equipamento'} onChange={(e) => setForm({ ...form, status_equipamento: e.target.value as Associado['status_equipamento'] })}>
                <option value="ok">OK</option>
                <option value="com_problema">Com problema</option>
                <option value="sem_equipamento">Sem equipamento</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={3} disabled={!canChangeForm} value={form.observacoes ?? ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} placeholder="Notas internas" />
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
