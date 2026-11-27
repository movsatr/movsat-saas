import { Fragment, useState, useEffect, useRef, useCallback } from 'react';
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

type SoftruckRecord = Record<string, unknown>;

function asRecord(value: unknown): SoftruckRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SoftruckRecord : {};
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function rowsFrom(value: unknown): SoftruckRecord[] {
  if (Array.isArray(value)) return value.map(asRecord);
  const record = asRecord(value);
  for (const key of ['results', 'items', 'records', 'vehicles', 'devices', 'users']) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).map(asRecord);
  }
  if (Array.isArray(record.data)) return (record.data as unknown[]).map(asRecord);
  if (record.data && typeof record.data === 'object') return rowsFrom(record.data);
  return [];
}

function relationRows(record: SoftruckRecord, keys: string[]): SoftruckRecord[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.map(asRecord);
    const nested = asRecord(value);
    if (Array.isArray(nested.data)) return (nested.data as unknown[]).map(asRecord);
    if (Object.keys(nested).length) return [nested];
  }
  const relationships = asRecord(record.relationships);
  for (const key of keys) {
    const nested = asRecord(relationships[key]);
    if (Array.isArray(nested.data)) return (nested.data as unknown[]).map(asRecord);
    if (nested.data && typeof nested.data === 'object') return [asRecord(nested.data)];
  }
  return [];
}

function softruckPlate(record: SoftruckRecord): string {
  const attributes = asRecord(record.attributes);
  return firstText(record.plate, record.license_plate, record.licensePlate, record.registration, record.vehicle_plate, attributes.plate, attributes.license_plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function softruckId(record: SoftruckRecord): string {
  return firstText(record.id, record.uuid, record.vehicle_id, record.device_id);
}

function softruckLabel(record: SoftruckRecord, fields: string[]): string {
  const attributes = asRecord(record.attributes);
  return firstText(...fields.map((field) => record[field]), ...fields.map((field) => attributes[field]));
}

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

  const [atlasContracts, setAtlasContracts] = useState<Record<string, unknown>[]>([]);
  const [atlasLoading, setAtlasLoading] = useState(false);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const [atlasPage, setAtlasPage] = useState(1);
  const [atlasCount, setAtlasCount] = useState(0);
  const [atlasTotalPages, setAtlasTotalPages] = useState(1);
  const [softruckVehicles, setSoftruckVehicles] = useState<SoftruckRecord[]>([]);
  const [softruckDevices, setSoftruckDevices] = useState<SoftruckRecord[]>([]);
  const [softruckUsers, setSoftruckUsers] = useState<SoftruckRecord[]>([]);
  const [softruckLoading, setSoftruckLoading] = useState(false);
  const [softruckLoaded, setSoftruckLoaded] = useState(false);
  const [softruckError, setSoftruckError] = useState<string | null>(null);
  const [softruckSearch, setSoftruckSearch] = useState('');
  const ATLAS_CONTRACTS_PER_PAGE = 50;
  const ATLAS_PRODUCT_ID = '283';
  const ATLAS_PROBE_CONCURRENCY = 8;

  const canChangeForm = creating ? canCreate : canEdit;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = useCallback(async () => {
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

      const localUnassignedVehicles: Array<{ id_externo: string | null; rastreador: { id: string; imei: string; status: string } | null }> = [];
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
  }, [role]);

  const loadAtlasContracts = async (page = atlasPage) => {
    if (role !== 'administrador' && role !== 'diretoria') return;
    setAtlasLoading(true);
    setAtlasError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Sessão inválida. Entre novamente para consultar a Atlas.');
      const headers = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token };
      const baseUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/atlas-api';
      const query = new URLSearchParams({
        resource: 'contract_object_nested',
        status: 'ATIVO',
        contract_status: 'ATIVO',
        page: String(Math.max(1, page)),
        page_size: String(ATLAS_CONTRACTS_PER_PAGE),
      });
      const response = await fetch(baseUrl + '?' + query.toString(), {
        headers,
        signal: AbortSignal.timeout(45000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok === false) {
        throw new Error('Falha na consulta Atlas/Mutual: ' + String(payload?.error ?? ('HTTP ' + response.status)));
      }
      const result = payload?.data;
      const root = asRecord(result);
      const nested = asRecord(root.data);
      const rows = Array.isArray(result) ? result
        : Array.isArray(root.results) ? root.results
        : Array.isArray(root.data) ? root.data
        : Array.isArray(nested.results) ? nested.results
        : Array.isArray(nested.data) ? nested.data
        : [];
      const count = Number(root.count ?? root.total ?? nested.count ?? nested.total ?? rows.length);
      const totalPages = Math.max(1, Math.ceil((Number.isFinite(count) ? count : rows.length) / ATLAS_CONTRACTS_PER_PAGE));
      const found = (rows as Record<string, unknown>[]).filter((row) => {
        const products = Array.isArray(row.products_data) ? row.products_data.map(asRecord) : [];
        return products.some((product) => {
          const label = [
            product.product_name,
            product.subproduct_description,
            product.subproduct_supplier_code,
          ].filter((value) => typeof value === 'string').join(' ');
          return /rastre|track/i.test(label);
        });
      }).map((row) => ({
        id: row.id,
        person_data: asRecord(row.person_data),
        vehicle_data: asRecord(row.vehicle_data),
        contract_data: asRecord(row.contract_data),
        product_data: Array.isArray(row.products_data) ? row.products_data : [],
      }));

      setAtlasContracts(found);
      setAtlasPage(Math.max(1, page));
      setAtlasCount(found.length);
      setAtlasTotalPages(totalPages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao consultar contratos ativos da Atlas/Mutual.';
      setAtlasError(message);
    } finally {
      setAtlasLoading(false);
    }
  };

  const loadSoftruckFleet = async () => {
    if (role !== 'administrador' && role !== 'diretoria') return;
    setSoftruckLoading(true);
    setSoftruckError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Sessão inválida. Entre novamente para consultar a Softruck.');

      const baseUrl = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/softruck-v5-api';
      const headers = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token };
      const fetchResource = async (resource: string, page: number) => {
        const query = new URLSearchParams({ resource, page: String(page), limit: '100' });
        const response = await fetch(baseUrl + '?' + query.toString(), {
          headers,
          signal: AbortSignal.timeout(45000),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.ok !== true) {
          const detail = String(payload?.error ?? ('HTTP ' + response.status));
          if (detail === 'softruck_api_token_not_configured') {
            throw new Error('Token da API Softruck não configurado no Supabase (SOFTRUCK_V5_API_TOKEN).');
          }
          throw new Error('Falha na consulta Softruck (' + resource + '): ' + detail);
        }
        return payload.data;
      };

      const fetchAll = async (resource: string) => {
        const collected: SoftruckRecord[] = [];
        for (let page = 1; page <= 500; page += 1) {
          const responseData = await fetchResource(resource, page);
          const pageRows = rowsFrom(responseData);
          collected.push(...pageRows);
          const meta = asRecord(responseData);
          const totalPages = Number(meta.total_pages ?? meta.last_page ?? meta.pages ?? 0);
          if (pageRows.length === 0 || (totalPages > 0 && page >= totalPages) || (totalPages <= 0 && pageRows.length < 100)) break;
        }
        return collected;
      };

      const results = await Promise.all([
        fetchAll('vehicles'),
        fetchAll('devices'),
        fetchAll('users'),
      ]);
      setSoftruckVehicles(results[0]);
      setSoftruckDevices(results[1]);
      setSoftruckUsers(results[2]);
      setSoftruckLoaded(true);
      toast.success('Softruck consultada: ' + results[0].length + ' veículos, ' + results[1].length + ' dispositivos e ' + results[2].length + ' usuários.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao consultar a Softruck.';
      setSoftruckError(message);
      toast.error(message);
    } finally {
      setSoftruckLoading(false);
    }
  };


  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { if (role === 'administrador' || role === 'diretoria') loadAtlasContracts(1); }, [role]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });  };

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
              <p className="mt-1 text-sm text-slate-500">Veículos com produto identificado como rastreamento nos objetos e contratos ativos da Atlas/Mutual. Não altera os cadastros do MovSat.</p>
            </div>
            <Button variant="secondary" onClick={() => loadAtlasContracts(atlasError ? Math.min(atlasPage + 1, atlasTotalPages) : 1)} disabled={atlasLoading || (Boolean(atlasError) && atlasPage >= atlasTotalPages)}>{atlasLoading ? 'Buscando…' : atlasError ? 'Buscar próxima página' : 'Atualizar'}</Button>
          </div>
          {atlasLoading && <p className="mb-3 text-sm text-slate-500">Consultando a Atlas…</p>}
          {atlasError && <p className="mb-3 text-sm text-red-600">{atlasError}</p>}
          {!atlasError && atlasContracts.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500">Veículos com produto de rastreamento identificado nesta página</p>
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
                <th className="px-3 py-3">Associado</th><th className="px-3 py-3">Placa</th><th className="px-3 py-3">Veículo</th><th className="px-3 py-3">Contrato</th><th className="px-3 py-3">Status</th>
              </tr></thead>
              <tbody>
                {atlasContracts.map((row, index) => {
                  const person = (row.person_data ?? {}) as Record<string, unknown>;
                  const vehicle = (row.vehicle_data ?? {}) as Record<string, unknown>;
                  const contract = (row.contract_data ?? {}) as Record<string, unknown>;
                  return <tr key={String(row.id ?? index)} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-3 font-medium">{String(person.name ?? 'Nome não informado pela API')}</td>
                    
                    <td className="px-3 py-3 font-mono">{String(vehicle.plate ?? '—')}</td>
                    <td className="px-3 py-3">{[vehicle.assembler, vehicle.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-3">{String(contract.contract_id ?? '—')}</td>
                    <td className="px-3 py-3">{String(contract.contract_status ?? '—')}</td>
                  </tr>;
                })}
                {!atlasLoading && atlasContracts.length === 0 && !atlasError && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={5}>Nenhum veículo com produto identificado como rastreamento nesta página.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={atlasLoading || atlasPage <= 1} onClick={() => loadAtlasContracts(atlasPage - 1)}>Anterior</Button>
            <span className="text-xs text-slate-500">Página {atlasPage} de {atlasTotalPages} de objetos/contratos ativos — veículos com produto identificado como rastreamento</span>
            <Button variant="secondary" disabled={atlasLoading || atlasPage >= atlasTotalPages} onClick={() => loadAtlasContracts(atlasPage + 1)}>Próxima</Button>
          </div>
        </section>
      )}

      {(role === 'administrador' || role === 'diretoria') && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Integração Softruck</h2>
                <Badge color="blue">somente leitura</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">Frota, placas, dispositivos/rastreadores e titulares consultados diretamente na Softruck. Nenhum cadastro local é criado ou alterado.</p>
            </div>
            <Button variant="secondary" onClick={loadSoftruckFleet} disabled={softruckLoading}>
              {softruckLoading ? 'Consultando Softruck…' : softruckLoaded ? 'Atualizar dados Softruck' : 'Consultar Softruck'}
            </Button>
          </div>
          {softruckError && <p className="mb-3 text-sm text-red-600">{softruckError}</p>}
          {softruckLoading && <p className="mb-3 text-sm text-slate-500">Buscando todas as páginas de veículos, dispositivos e usuários…</p>}
          {softruckLoaded && (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Veículos na Softruck</p>
                  <p className="mt-1 text-xl font-semibold">{softruckVehicles.length.toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Dispositivos/rastreadores</p>
                  <p className="mt-1 text-xl font-semibold">{softruckDevices.length.toLocaleString('pt-BR')}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-xs text-slate-500">Usuários/titulares</p>
                  <p className="mt-1 text-xl font-semibold">{softruckUsers.length.toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <div className="mb-3 max-w-sm">
                <input className="input" value={softruckSearch} onChange={(event) => setSoftruckSearch(event.target.value)} placeholder="Buscar placa, modelo ou titular na Softruck..." />
              </div>
              <div className="max-h-[520px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-3">Placa</th>
                      <th className="px-3 py-3">Veículo</th>
                      <th className="px-3 py-3">Rastreador / identificador</th>
                      <th className="px-3 py-3">Titular</th>
                      <th className="px-3 py-3">Atlas/Mutual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {softruckVehicles
                      .filter((vehicle) => {
                        const plate = softruckPlate(vehicle);
                        const model = softruckLabel(vehicle, ['model', 'vehicle_model', 'name', 'description']);
                        const holder = relationRows(vehicle, ['users', 'user', 'owners']).map((user) => softruckLabel(user, ['name', 'full_name', 'display_name'])).join(' ');
                        const query = softruckSearch.trim().toLowerCase();
                        return !query || [plate, model, holder].join(' ').toLowerCase().includes(query);
                      })
                      .map((vehicle, index) => {
                        const plate = softruckPlate(vehicle);
                        const vehicleId = softruckId(vehicle);
                        const embeddedDevices = relationRows(vehicle, ['devices', 'device']);
                        const embeddedUsers = relationRows(vehicle, ['users', 'user', 'owners']);
                        const deviceId = firstText(vehicle.device_id, vehicle.deviceId, vehicle.main_device_id);
                        const userId = firstText(vehicle.user_id, vehicle.userId, vehicle.owner_id);
                        const linkedDevice = embeddedDevices[0] ?? softruckDevices.find((device) => softruckId(device) === deviceId || firstText(device.vehicle_id, device.vehicleId, device.object_id) === vehicleId);
                        const linkedUser = embeddedUsers[0] ?? softruckUsers.find((user) => softruckId(user) === userId || firstText(user.vehicle_id, user.vehicleId, user.object_id) === vehicleId);
                        const tracker = linkedDevice ? softruckLabel(linkedDevice, ['imei', 'serial', 'identifier', 'code', 'name', 'device_id']) : firstText(vehicle.imei, vehicle.serial, vehicle.identifier);
                        const holder = linkedUser ? softruckLabel(linkedUser, ['name', 'full_name', 'display_name', 'username']) : firstText(vehicle.user_name, vehicle.owner_name, vehicle.holder_name);
                        const atlasMatch = atlasContracts.some((row) => {
                          const atlasVehicle = asRecord(row.vehicle_data);
                          return plate && firstText(atlasVehicle.plate).toUpperCase().replace(/[^A-Z0-9]/g, '') === plate;
                        });
                        return (
                          <tr key={vehicleId || (plate + '-' + index)} className="border-t border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-3 font-mono font-semibold">{plate || 'Placa não retornada'}</td>
                            <td className="px-3 py-3">{softruckLabel(vehicle, ['model', 'vehicle_model', 'name', 'description']) || 'Não informado'}</td>
                            <td className="px-3 py-3 font-mono text-xs">{tracker || 'Vínculo não retornado pela API'}</td>
                            <td className="px-3 py-3">{holder || 'Titular não retornado pela API'}</td>
                            <td className="px-3 py-3">{atlasMatch ? <Badge color="green">Encontrado na página Atlas atual</Badge> : <Badge color="slate">Não localizado nesta página Atlas</Badge>}</td>
                          </tr>
                        );
                      })}
                    {softruckVehicles.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">A API não retornou veículos.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">O cruzamento Atlas/Mutual mostrado aqui considera somente a página Atlas atualmente carregada. Campos de vínculo ausentes na resposta Softruck aparecem como “não retornado”, sem serem classificados como ausência de rastreador ou titular.</p>
            </>
          )}
        </section>
      )}

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">          <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>
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
          <table className="min-w-[1450px] w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[240px]">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[190px]">CPF/CNPJ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[150px]">Telefone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[180px]">Cidade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[140px]">Plano</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[220px]">Veículos</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[220px]">Rastreadores</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[100px]">Equip.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-[150px]">Pagamento</th>
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
                    <Fragment key={row.id}>
                      <tr
                        className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${hasRelations ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
                        onClick={() => hasRelations && toggleRow(row.id)}
                      >
                        <td className="px-3 py-3 text-slate-400">
                          {hasRelations && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white break-words">{row.nome}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.cpf_cnpj || '-'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.telefone || '-'}</td>
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
                    </Fragment>
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
          </div>          <div>
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
          </div>          <div>
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