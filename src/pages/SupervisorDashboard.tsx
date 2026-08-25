import { useState, useEffect } from 'react';
import { ListTodo, Wrench, WifiOff, Package, CalendarClock, AlertOctagon, ArrowRight, CheckCircle2, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { loadSupervisorData, type SupervisorData } from '@/lib/insights';
import { MetricCard, Button, Badge, formatCurrency, formatDate, LoadingSpinner, EmptyState } from '@/components/ui';
import { CaseView } from '@/components/CaseView';
import { OperadorDashboard } from '@/pages/OperadorDashboard';

type ActionCategory =
  | 'overdue_os' | 'offline_trackers' | 'low_stock' | 'installations' | 'high_alerts' | 'tasks_today';

interface ActionCard {
  id: string;
  category: ActionCategory;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  responsible: string;
  dueDate: string;
  recommendedAction: string;
  relatedId?: string;
  relatedType?: string;
}

/** Produce a human-readable description of a critical event without dumping raw JSON. */
function describeAlert(e: SupervisorData['highPriorityAlerts'][number]): string {
  const type = e.event_type.replace(/_/g, ' ');
  const p = e.payload || {};
  const parts: string[] = [];
  if (typeof p.imei === 'string') parts.push(`Equipamento: ${p.imei}`);
  if (typeof p.associado_nome === 'string') parts.push(`Cliente: ${p.associado_nome}`);
  if (typeof p.numero === 'string') parts.push(`OS: ${p.numero}`);
  if (typeof p.nome === 'string') parts.push(`Item: ${p.nome}`);
  if (typeof p.veiculo_placa === 'string') parts.push(`Veículo: ${p.veiculo_placa}`);
  if (!parts.length && e.entity_type) parts.push(`Entidade: ${e.entity_type}`);
  return parts.length ? `${type} — ${parts.join(', ')}` : type;
}

function buildActionCards(data: SupervisorData): ActionCard[] {
  const cards: ActionCard[] = [];

  data.tasksToday.forEach((t) => {
    cards.push({
      id: `task-${t.id}`,
      category: 'tasks_today',
      severity: t.priority === 'urgente' ? 'critical' : t.priority === 'alta' ? 'warning' : 'info',
      title: t.title,
      responsible: t.owner,
      dueDate: t.deadline || '-',
      recommendedAction: t.description || 'Resolver tarefa',
      relatedId: t.id,
      relatedType: 'task',
    });
  });

  data.overdueOS.forEach((o) => {
    cards.push({
      id: `os-${o.id}`,
      category: 'overdue_os',
      severity: o.prioridade === 'urgente' ? 'critical' : 'warning',
      title: `OS ${o.numero} atrasada${o.associado_nome ? ` — ${o.associado_nome}` : ''}`,
      responsible: 'Supervisor de Operações',
      dueDate: formatDate(o.data_abertura),
      recommendedAction: `Verificar andamento da OS ${o.numero}. Tipo: ${o.tipo}.`,
      relatedId: o.id,
      relatedType: 'os',
    });
  });

  data.offlineTrackers.forEach((t) => {
    cards.push({
      id: `tracker-${t.id}`,
      category: 'offline_trackers',
      severity: 'critical',
      title: `Rastreador ${t.imei} offline${t.associado_nome ? ` — ${t.associado_nome}` : ''}`,
      responsible: 'Supervisor de Campo',
      dueDate: formatDate(new Date().toISOString().slice(0, 10)),
      recommendedAction: `Verificar sinal do equipamento ${t.imei}. Veículo: ${t.veiculo_placa || '-'}.`,
      relatedId: t.id,
      relatedType: 'tracker',
    });
  });

  data.lowStock.forEach((e) => {
    cards.push({
      id: `stock-${e.id}`,
      category: 'low_stock',
      severity: e.quantidade === 0 ? 'critical' : 'warning',
      title: `Estoque baixo: ${e.nome}`,
      responsible: 'Supervisor de Estoque',
      dueDate: formatDate(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)),
      recommendedAction: `Repor ${e.nome}. Atual: ${e.quantidade} / Mín: ${e.quantidade_minima}.`,
      relatedId: e.id,
      relatedType: 'stock',
    });
  });

  data.installationsToday.forEach((o) => {
    cards.push({
      id: `inst-${o.id}`,
      category: 'installations',
      severity: 'info',
      title: `Instalação hoje: OS ${o.numero}`,
      responsible: 'Prestador designado',
      dueDate: formatDate(o.data_abertura),
      recommendedAction: `Confirmar agendamento e verificar disponibilidade de equipamento. Tipo: ${o.tipo}.`,
      relatedId: o.id,
      relatedType: 'os',
    });
  });

  data.highPriorityAlerts.forEach((e) => {
    cards.push({
      id: `alert-${e.id}`,
      category: 'high_alerts',
      severity: 'critical',
      title: e.event_type.replace(/_/g, ' '),
      responsible: 'Sistema',
      dueDate: formatDate(e.created_at),
      recommendedAction: `Evento crítico detectado. ${describeAlert(e)}`,
      relatedId: e.id,
      relatedType: 'event',
    });
  });

  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  return cards.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

const categoryLabels: Record<ActionCategory, string> = {
  overdue_os: 'OS Atrasadas',
  offline_trackers: 'Veículos Offline',
  low_stock: 'Estoque Baixo',
  installations: 'Instalações Hoje',
  high_alerts: 'Alertas Críticos',
  tasks_today: 'Tarefas',
};

const categoryIcons: Record<ActionCategory, typeof Wrench> = {
  overdue_os: Wrench,
  offline_trackers: WifiOff,
  low_stock: Package,
  installations: CalendarClock,
  high_alerts: AlertOctagon,
  tasks_today: ListTodo,
};

const severityStyles: Record<string, { border: string; bg: string; badge: string }> = {
  critical: { border: 'border-l-red-500', bg: 'bg-red-50/30 dark:bg-red-900/10', badge: 'red' },
  warning: { border: 'border-l-amber-500', bg: 'bg-amber-50/30 dark:bg-amber-900/10', badge: 'yellow' },
  info: { border: 'border-l-slate-400', bg: 'bg-slate-50/30 dark:bg-slate-800/20', badge: 'slate' },
};

export function SupervisorDashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<SupervisorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActionCategory | 'all'>('all');
  const [resolveTarget, setResolveTarget] = useState<ActionCard | null>(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    loadSupervisorData().then((d) => { setData(d); setLoading(false); });
  }, []);

  // Role guard: operadores never see this dashboard — redirect to their own.
  if (profile?.role === 'operador') {
    return <OperadorDashboard />;
  }

  if (loading || !data) return <LoadingSpinner />;

  const allCards = buildActionCards(data);
  const filteredCards = filter === 'all' ? allCards : allCards.filter((c) => c.category === filter);

  const categoriesWithData = Array.from(new Set(allCards.map((c) => c.category))) as ActionCategory[];
  const counts: Record<string, number> = {};
  allCards.forEach((c) => { counts[c.category] = (counts[c.category] || 0) + 1; });

  // Inadimplência em risco — count + total value (the ONLY financial figure exposed here).
  const inadimplenciaCount = data.riskCustomers.filter((c) => c.status_pagamento !== 'em_dia').length;

  const handleResolve = async () => {
    if (!resolveTarget) return;
    const card = resolveTarget;

    if (card.relatedType === 'task' && card.relatedId) {
      await supabase.from('tasks').update({
        status: 'concluida',
        resolution_notes: resolution,
      }).eq('id', card.relatedId);
    } else {
      await supabase.from('tasks').insert({
        title: `[Resolvido] ${card.title}`,
        description: card.recommendedAction,
        owner: 'Supervisor',
        priority: card.severity === 'critical' ? 'urgente' : card.severity === 'warning' ? 'alta' : 'normal',
        status: 'concluida',
        deadline: new Date().toISOString().slice(0, 10),
        resolution_notes: resolution,
        financial_impact: 0,
      });
    }

    const updated = await loadSupervisorData();
    setData(updated);
    setResolveTarget(null);
    setResolution('');
  };

  return (
    <div className="space-y-5">
      {/* Compact summary — counts only, except Inadimplência em Risco (count + total) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Tarefas" value={data.tasksToday.length} icon={ListTodo} accent="red" />
        <MetricCard label="OS Atrasadas" value={data.overdueOS.length} icon={Wrench} accent="red" />
        <MetricCard label="Offline" value={data.offlineTrackers.length} icon={WifiOff} accent="orange" />
        <MetricCard label="Estoque Baixo" value={data.lowStock.length} icon={Package} accent="yellow" />
        <MetricCard
          label="Inadimplência em Risco"
          value={inadimplenciaCount}
          icon={TrendingDown}
          accent="red"
          sublabel={formatCurrency(data.revenueAtRisk)}
        />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Todas ({allCards.length})
        </button>
        {categoriesWithData.map((cat) => {
          const Icon = categoryIcons[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === cat ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {categoryLabels[cat]} ({counts[cat]})
            </button>
          );
        })}
      </div>

      {/* Simplified action cards — no financial impact, no raw payload */}
      {filteredCards.length === 0 ? (
        <EmptyState message="Nenhuma ação pendente para este filtro" icon={CheckCircle2} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const sev = severityStyles[card.severity];
            const Icon = categoryIcons[card.category];
            return (
              <div key={card.id} className={`card p-4 border-l-4 ${sev.border} ${sev.bg} animate-fadeIn`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {categoryLabels[card.category]}
                    </span>
                  </div>
                  <Badge color={sev.badge as 'red' | 'yellow' | 'slate'}>{card.severity}</Badge>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5 line-clamp-2">{card.title}</h3>

                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                  <span className="truncate">{card.responsible}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <CalendarClock className="w-3 h-3" />{card.dueDate}
                  </span>
                </div>

                <Button
                  variant={card.severity === 'critical' ? 'danger' : 'primary'}
                  className="w-full text-xs"
                  onClick={() => { setResolveTarget(card); setResolution(''); }}
                >
                  Resolver <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve drawer */}
      <CaseView
        open={!!resolveTarget}
        title="Resolver Ação"
        onClose={() => setResolveTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolveTarget(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleResolve} disabled={!resolution.trim()}>
              Marcar como Resolvido
            </Button>
          </>
        }
      >
        {resolveTarget && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Ação</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{resolveTarget.title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Ação Recomendada</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{resolveTarget.recommendedAction}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Responsável</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{resolveTarget.responsible}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Prazo</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{resolveTarget.dueDate}</p>
              </div>
            </div>
            <div>
              <label className="label">Notas de Resolução</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                className="input"
                placeholder="Descreva como a ação foi resolvida..."
              />
            </div>
          </div>
        )}
      </CaseView>
    </div>
  );
}
