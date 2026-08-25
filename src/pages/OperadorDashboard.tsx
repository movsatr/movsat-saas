import { useState, useEffect } from 'react';
import {
  ListTodo, Wrench, WifiOff, CalendarClock, ClipboardList,
  CheckCircle2, ArrowRight, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  MetricCard, PriorityBadge, StatusBadge,
  formatDate, LoadingSpinner, EmptyState,
} from '@/components/ui';
import type { Task, OrdemServico, Rastreador } from '@/types';

interface OperadorData {
  tasks: Task[];
  installations: (OrdemServico & { associado_nome?: string })[];
  serviceOrders: (OrdemServico & { associado_nome?: string })[];
  offlineTrackers: (Rastreador & { associado_nome?: string })[];
  pendingItems: Task[];
}

async function loadOperadorData(): Promise<OperadorData> {
  const [tasksRes, osRes, trackerRes] = await Promise.all([
    supabase.from('tasks').select('*').neq('status', 'concluida').neq('status', 'cancelada').order('deadline', { ascending: true }),
    supabase.from('ordens_servico').select('*, associado:associados!inner(nome)').in('status', ['aberta', 'em_andamento']).order('data_abertura', { ascending: true }),
    supabase.from('rastreadores').select('*, associado:associados!inner(nome)').in('status', ['com_problema', 'inativo']),
  ]);

  const allOS = (osRes.data || []) as unknown as (OrdemServico & { associado: { nome: string } })[];

  const installations = allOS
    .filter((o) => o.tipo === 'instalacao')
    .map((o) => ({ ...o, associado_nome: o.associado?.nome }));

  const serviceOrders = allOS
    .filter((o) => o.tipo !== 'instalacao')
    .map((o) => ({ ...o, associado_nome: o.associado?.nome }));

  const allTrackers = (trackerRes.data || []) as unknown as (Rastreador & { associado: { nome: string } })[];
  const offlineTrackers = allTrackers.map((t) => ({ ...t, associado_nome: t.associado?.nome }));

  const tasks = (tasksRes.data || []) as Task[];
  const pendingItems = tasks.filter((t) => t.status === 'pendente');

  return { tasks, installations, serviceOrders, offlineTrackers, pendingItems };
}

type Section = 'tasks' | 'installations' | 'serviceOrders' | 'offlineTrackers' | 'pendingItems';

const sectionLabels: Record<Section, string> = {
  tasks: 'Tarefas',
  installations: 'Instalações',
  serviceOrders: 'Ordens de Serviço',
  offlineTrackers: 'Veículos Offline',
  pendingItems: 'Pendências',
};

const sectionIcons: Record<Section, typeof Wrench> = {
  tasks: ListTodo,
  installations: CalendarClock,
  serviceOrders: Wrench,
  offlineTrackers: WifiOff,
  pendingItems: ClipboardList,
};

export function OperadorDashboard() {
  const [data, setData] = useState<OperadorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Section | null>(null);

  useEffect(() => {
    loadOperadorData().then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return <LoadingSpinner />;

  const sections: { key: Section; count: number; items: { id: string; title: string; subtitle: string; priority?: string; status?: string; deadline?: string | null }[] }[] = [
    {
      key: 'tasks', count: data.tasks.length,
      items: data.tasks.map((t) => ({ id: t.id, title: t.title, subtitle: t.description || '', priority: t.priority, status: t.status, deadline: t.deadline })),
    },
    {
      key: 'installations', count: data.installations.length,
      items: data.installations.map((o) => ({ id: o.id, title: `OS ${o.numero}`, subtitle: o.associado_nome || '-', status: o.status, deadline: o.data_abertura })),
    },
    {
      key: 'serviceOrders', count: data.serviceOrders.length,
      items: data.serviceOrders.map((o) => ({ id: o.id, title: `OS ${o.numero}`, subtitle: `${o.tipo} — ${o.associado_nome || '-'}`, status: o.status, deadline: o.data_abertura })),
    },
    {
      key: 'offlineTrackers', count: data.offlineTrackers.length,
      items: data.offlineTrackers.map((t) => ({ id: t.id, title: t.imei, subtitle: t.associado_nome || '-', status: t.status })),
    },
    {
      key: 'pendingItems', count: data.pendingItems.length,
      items: data.pendingItems.map((t) => ({ id: t.id, title: t.title, subtitle: t.description || '', priority: t.priority, status: t.status, deadline: t.deadline })),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {sections.map((s) => {
          const Icon = sectionIcons[s.key];
          return (
            <MetricCard
              key={s.key}
              label={sectionLabels[s.key]}
              value={s.count}
              icon={Icon}
              accent={s.count > 0 ? 'red' : 'green'}
            />
          );
        })}
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const Icon = sectionIcons[section.key];
          const isExpanded = expanded === section.key;
          if (section.count === 0) return null;
          return (
            <div key={section.key} className="card overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : section.key)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <Icon className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{sectionLabels[section.key]}</p>
                    <p className="text-xs text-slate-400">{section.count} {section.count === 1 ? 'item' : 'itens'}</p>
                  </div>
                </div>
                <ArrowRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 animate-fadeIn">
                  {section.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.priority && <PriorityBadge priority={item.priority} />}
                        {item.status && <StatusBadge status={item.status === 'pendente' ? 'pendente_task' : item.status} />}
                        {item.deadline && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{formatDate(item.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {sections.every((s) => s.count === 0) && (
          <EmptyState message="Nenhuma pendência para hoje" icon={CheckCircle2} />
        )}
      </div>

    </div>
  );
}
