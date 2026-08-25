import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, TrendingDown, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { InsightCard } from '@/components/InsightCard';
import { MetricCard, LoadingSpinner, formatCurrency, StatusBadge } from '@/components/ui';
import type { Associado, Rastreador } from '@/types';

interface QuadrantMember extends Associado {
  trackerCount: number;
  hasProblemTracker: boolean;
}

interface QuadrantData {
  members: QuadrantMember[];
  revenueAtRisk: number;
}

export function Inteligencia() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canSeeFinancial = role === 'diretoria' || role === 'administrador';

  const [loading, setLoading] = useState(true);
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [rastreadores, setRastreadores] = useState<Rastreador[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [assocRes, rastRes] = await Promise.all([
      supabase.from('associados').select('*'),
      supabase.from('rastreadores').select('id, associado_id, status'),
    ]);
    setAssociados((assocRes.data || []) as Associado[]);
    setRastreadores((rastRes.data || []) as Rastreador[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <LoadingSpinner />;

  // ---------------------------------------------------------------------------
  // Build per-associado equipment status from rastreadores.
  // An associado "has equipment" if they have any tracker. They "have a problem"
  // if any tracker has status 'com_problema' or 'manutencao'.
  // ---------------------------------------------------------------------------
  const trackersByAssoc: Record<string, Rastreador[]> = {};
  rastreadores.forEach((r) => {
    if (r.associado_id) {
      (trackersByAssoc[r.associado_id] ||= []).push(r);
    }
  });

  const enriched: QuadrantMember[] = associados.map((a) => {
    const trackers = trackersByAssoc[a.id] || [];
    const hasProblemTracker = trackers.some(
      (t) => t.status === 'com_problema' || t.status === 'manutencao',
    );
    return { ...a, trackerCount: trackers.length, hasProblemTracker };
  });

  // Payment status buckets
  const isPaying = (a: Associado) => a.status_pagamento === 'em_dia' || a.status_pagamento === 'atrasado';
  const isDefaulter = (a: Associado) => a.status_pagamento === 'inadimplente';
  const hasEquipmentOk = (m: QuadrantMember) => m.trackerCount > 0 && !m.hasProblemTracker;
  const hasEquipmentProblem = (m: QuadrantMember) => m.trackerCount > 0 && m.hasProblemTracker;

  // Quadrant 1: Pagantes com Equipamento OK (healthy)
  const healthy: QuadrantData = {
    members: enriched.filter((m) => isPaying(m) && hasEquipmentOk(m)),
    revenueAtRisk: 0,
  };

  // Quadrant 2: Pagantes com Equipamento com Problema (URGENT)
  const urgent: QuadrantData = {
    members: enriched.filter((m) => isPaying(m) && hasEquipmentProblem(m)),
    revenueAtRisk: 0,
  };
  urgent.revenueAtRisk = urgent.members.reduce((s, m) => s + Number(m.valor_mensalidade), 0);

  // Quadrant 3: Inadimplentes com Equipamento OK (candidates for cut)
  const cutCandidates: QuadrantData = {
    members: enriched.filter((m) => isDefaulter(m) && hasEquipmentOk(m)),
    revenueAtRisk: 0,
  };
  cutCandidates.revenueAtRisk = cutCandidates.members.reduce((s, m) => s + Number(m.valor_mensalidade), 0);

  // Quadrant 4: Inadimplentes com Equipamento com Problema (critical)
  const critical: QuadrantData = {
    members: enriched.filter((m) => isDefaulter(m) && hasEquipmentProblem(m)),
    revenueAtRisk: 0,
  };
  critical.revenueAtRisk = critical.members.reduce((s, m) => s + Number(m.valor_mensalidade), 0);

  // Recovery opportunity = revenue from defaulters that could be recovered
  const recoveryOpportunity = cutCandidates.revenueAtRisk + critical.revenueAtRisk;
  // Revenue at risk = paying customers with equipment problems (churn risk)
  const revenueAtRisk = urgent.revenueAtRisk;

  // Summary metrics
  const totalCustomers = associados.length;
  const payingCount = enriched.filter(isPaying).length;
  const defaulterCount = enriched.filter(isDefaulter).length;
  const withEquipment = enriched.filter((m) => m.trackerCount > 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Inteligência</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Análise cruzada: status de pagamento × saúde do equipamento
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total de Clientes" value={totalCustomers} accent="blue" icon={CheckCircle2} />
        <MetricCard label="Clientes Pagantes" value={payingCount} accent="green" icon={CheckCircle2} sublabel={`${totalCustomers ? ((payingCount / totalCustomers) * 100).toFixed(0) : 0}% do total`} />
        <MetricCard label="Inadimplentes" value={defaulterCount} accent="red" icon={XCircle} sublabel={`${totalCustomers ? ((defaulterCount / totalCustomers) * 100).toFixed(0) : 0}% do total`} />
        <MetricCard label="Com Equipamento" value={withEquipment} accent="blue" icon={CheckCircle2} />
      </div>

      {/* Financial opportunity metrics */}
      {canSeeFinancial && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MetricCard
            label="Receita em Risco (Churn)"
            value={formatCurrency(revenueAtRisk)}
            accent="red"
            icon={TrendingDown}
            sublabel="Pagantes com equipamento com problema"
          />
          <MetricCard
            label="Oportunidade de Recuperação"
            value={formatCurrency(recoveryOpportunity)}
            accent="orange"
            icon={RefreshCw}
            sublabel="Inadimplentes com equipamento instalado"
          />
        </div>
      )}

      {/* Four quadrants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Q1: Healthy */}
        <InsightCard type="success" title={`Pagantes com Equipamento OK — ${healthy.members.length}`}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clientes saudáveis: pagam em dia e o equipamento funciona. Base estável da operação.
            </p>
            {healthy.members.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhum cliente neste quadrante.</p>
            ) : (
              <QuadrantList members={healthy.members.slice(0, 8)} emptyMessage="" canSeeFinancial={canSeeFinancial} />
            )}
            {healthy.members.length > 8 && (
              <p className="text-xs text-slate-400">+{healthy.members.length - 8} outros...</p>
            )}
          </div>
        </InsightCard>

        {/* Q2: URGENT */}
        <InsightCard type="warning" title={`URGENTE: Pagantes com Equipamento com Problema — ${urgent.members.length}`}>
          <div className="space-y-3">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              ⚠️ Prioridade máxima: clientes que pagam mas estão sem serviço. Risco iminente de cancelamento.
            </p>
            {canSeeFinancial && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Receita em risco:</span>
                <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(urgent.revenueAtRisk)}</span>
              </div>
            )}
            {urgent.members.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhum cliente neste quadrante. 🎉</p>
            ) : (
              <QuadrantList members={urgent.members.slice(0, 8)} emptyMessage="" canSeeFinancial={canSeeFinancial} />
            )}
            {urgent.members.length > 8 && (
              <p className="text-xs text-slate-400">+{urgent.members.length - 8} outros...</p>
            )}
          </div>
        </InsightCard>

        {/* Q3: Cut candidates */}
        <InsightCard type="opportunity" title={`Candidatos a Corte: Inadimplentes com Equipamento OK — ${cutCandidates.members.length}`}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inadimplentes com equipamento funcionando. Oportunidade de recuperar receita via negociação ou corte do serviço.
            </p>
            {canSeeFinancial && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Receita recuperável:</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(cutCandidates.revenueAtRisk)}</span>
              </div>
            )}
            {cutCandidates.members.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhum cliente neste quadrante.</p>
            ) : (
              <QuadrantList members={cutCandidates.members.slice(0, 8)} emptyMessage="" canSeeFinancial={canSeeFinancial} />
            )}
            {cutCandidates.members.length > 8 && (
              <p className="text-xs text-slate-400">+{cutCandidates.members.length - 8} outros...</p>
            )}
          </div>
        </InsightCard>

        {/* Q4: Critical */}
        <InsightCard type="info" title={`Crítico: Inadimplentes com Equipamento com Problema — ${critical.members.length}`}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pior cenário: não pagam e o equipamento está com problema. Avaliar remoção do equipamento e baixa do cliente.
            </p>
            {canSeeFinancial && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Valor em jogo:</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">{formatCurrency(critical.revenueAtRisk)}</span>
              </div>
            )}
            {critical.members.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Nenhum cliente neste quadrante.</p>
            ) : (
              <QuadrantList members={critical.members.slice(0, 8)} emptyMessage="" canSeeFinancial={canSeeFinancial} />
            )}
            {critical.members.length > 8 && (
              <p className="text-xs text-slate-400">+{critical.members.length - 8} outros...</p>
            )}
          </div>
        </InsightCard>
      </div>

      {/* Legend / methodology */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Metodologia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span><strong>Pagante:</strong> status_pagamento = "em_dia" ou "atrasado"</span>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span><strong>Inadimplente:</strong> status_pagamento = "inadimplente"</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <span><strong>Equipamento OK:</strong> tem rastreador(es) ativo(s) sem problema</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span><strong>Equipamento c/ Problema:</strong> rastreador com status "com_problema" ou "manutencao"</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper component: renders a compact list of associados within a quadrant.
// ---------------------------------------------------------------------------
function QuadrantList({ members, emptyMessage, canSeeFinancial }: { members: QuadrantMember[]; emptyMessage: string; canSeeFinancial: boolean }) {
  if (members.length === 0) {
    if (!emptyMessage) return null;
    return <p className="text-sm text-slate-400 italic">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-1.5">
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/60 dark:bg-slate-800/40"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{m.nome}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-400">{m.trackerCount} eq.</span>
            <StatusBadge status={m.status_pagamento} />
            {canSeeFinancial && (
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {formatCurrency(m.valor_mensalidade)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
