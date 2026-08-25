import { supabase } from '@/lib/supabase';
import type { Associado, Rastreador, OrdemServico, FinanceiroRecord, EstoqueItem, Task, EventLog } from '@/types';

export interface SupervisorData {
  overdueOS: (OrdemServico & { associado_nome?: string })[];
  offlineTrackers: (Rastreador & { associado_nome?: string })[];
  riskCustomers: Associado[];
  d7Customers: Associado[];
  d15Customers: Associado[];
  d30Customers: Associado[];
  lowStock: EstoqueItem[];
  installationsToday: OrdemServico[];
  recoveryOpportunities: (FinanceiroRecord & { associado_nome?: string })[];
  highPriorityAlerts: EventLog[];
  tasksToday: Task[];
  revenueAtRisk: number;
}

function daysSince(date: string): number {
  const d = new Date(date + (date.includes('T') ? '' : 'T00:00:00'));
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export async function loadSupervisorData(): Promise<SupervisorData> {
  const [osRes, trackerRes, custRes, stockRes, finRes, eventsRes, tasksRes] = await Promise.all([
    supabase.from('ordens_servico').select('*, associado:associados!inner(nome)').in('status', ['aberta', 'em_andamento']).order('data_abertura', { ascending: true }),
    supabase.from('rastreadores').select('*, associado:associados!inner(nome)').in('status', ['com_problema', 'inativo']),
    supabase.from('associados').select('*'),
    supabase.from('estoque').select('*'),
    supabase.from('financeiro').select('*, associado:associados!inner(nome)').in('status', ['pendente', 'atrasado']),
    supabase.from('events').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('tasks').select('*').order('deadline', { ascending: true }),
  ]);

  const allOS = (osRes.data || []) as unknown as (OrdemServico & { associado: { nome: string } })[];
  const overdueOS = allOS
    .filter((o) => daysSince(o.data_abertura) > 7)
    .map((o) => ({ ...o, associado_nome: o.associado?.nome }))
    .sort((a, b) => daysSince(b.data_abertura) - daysSince(a.data_abertura));

  const allTrackers = (trackerRes.data || []) as unknown as (Rastreador & { associado: { nome: string } })[];
  const offlineTrackers = allTrackers.map((t) => ({ ...t, associado_nome: t.associado?.nome }));

  const customers = (custRes.data || []) as Associado[];
  const riskCustomers = customers.filter((c) => c.status_pagamento === 'inadimplente' || c.status_equipamento === 'com_problema');

  const d7: Associado[] = [];
  const d15: Associado[] = [];
  const d30: Associado[] = [];
  customers.forEach((c) => {
    if (c.status_pagamento === 'atrasado' || c.status_pagamento === 'inadimplente') {
      const fin = (finRes.data || []) as unknown as (FinanceiroRecord & { associado: { nome: string } })[];
      const custFin = fin.filter((f) => f.associado_id === c.id);
      const maxDays = Math.max(0, ...custFin.map((f) => f.data_vencimento ? daysSince(f.data_vencimento) : 0));
      if (maxDays >= 30) d30.push(c);
      else if (maxDays >= 15) d15.push(c);
      else if (maxDays >= 7) d7.push(c);
    }
  });

  const lowStock = ((stockRes.data || []) as EstoqueItem[]).filter((e) => e.quantidade <= e.quantidade_minima);

  const allOSForInst = (osRes.data || []) as unknown as (OrdemServico & { associado: { nome: string } })[];
  const today = new Date().toISOString().slice(0, 10);
  const installationsToday = allOSForInst.filter((o) => o.tipo === 'instalacao' && o.data_abertura === today);

  const allFin = (finRes.data || []) as unknown as (FinanceiroRecord & { associado: { nome: string } })[];
  const recoveryOpportunities = allFin
    .filter((f) => f.status === 'atrasado')
    .map((f) => ({ ...f, associado_nome: f.associado?.nome }))
    .sort((a, b) => Number(b.valor) - Number(a.valor));

  const highPriorityAlerts = ((eventsRes.data || []) as EventLog[]).filter((e) => e.severity === 'critical');

  const tasksToday = ((tasksRes.data || []) as Task[]).filter(
    (t) => (t.status === 'pendente' || t.status === 'em_andamento') && t.deadline === today,
  );

  const revenueAtRisk = riskCustomers
    .filter((c) => c.status_pagamento !== 'em_dia')
    .reduce((sum, c) => sum + Number(c.valor_mensalidade), 0);

  return {
    overdueOS,
    offlineTrackers,
    riskCustomers,
    d7Customers: d7,
    d15Customers: d15,
    d30Customers: d30,
    lowStock,
    installationsToday,
    recoveryOpportunities,
    highPriorityAlerts,
    tasksToday,
    revenueAtRisk,
  };
}

export interface DiretoriaKPIs {
  mrr: number;
  revenueReceived: number;
  revenuePending: number;
  revenueAtRisk: number;
  churnRate: number;
  activeCustomers: number;
  activeVehicles: number;
  avgTicket: number;
  growthVsLastMonth: number;
  recoveryRate: number;
  totalCustomers: number;
  totalVehicles: number;
  annualRevenue: number;
  revenueLost: number;
  revenueRecovered: number;
  cac: number;
  ltv: number;
  monthlyGrowth: number;
  yearlyGrowth: number;
  customersAtRisk: number;
  goals: { mrrTarget: number; churnTarget: number; growthTarget: number };
}

export interface DiretoriaChartData {
  revenueEvolution: { month: string; recebido: number; pendente: number; atrasado: number }[];
  churnEvolution: { month: string; rate: number }[];
  customerGrowth: { month: string; total: number; ativos: number }[];
  revenueBySegment: { segment: string; revenue: number }[];
  revenueByCity: { city: string; revenue: number }[];
  revenueByState: { state: string; revenue: number }[];
  topCustomers: { nome: string; revenue: number }[];
  cashFlowction: { month: string; tado: number; realizado: number }[];
}

export async function loadDiretoriaData(): Promise<{ kpis: DiretoriaKPIs; charts: DiretoriaChartData }> {
  const [custRes, trackerRes, finRes] = await Promise.all([
    supabase.from('associados').select('*'),
    supabase.from('rastreadores').select('*'),
    supabase.from('financeiro').select('*'),
  ]);

  const customers = (custRes.data || []) as Associado[];
  const trackers = (trackerRes.data || []) as Rastreador[];
  const finance = (finRes.data || []) as FinanceiroRecord[];

  const activeCustomers = customers.filter((c) => c.status_pagamento !== 'inadimplente').length;
  const totalCustomers = customers.length;
  const activeVehicles = trackers.filter((t) => t.status === 'ativo').length;
  const totalVehicles = trackers.length;

  const mrr = customers
    .filter((c) => c.status_pagamento !== 'inadimplente')
    .reduce((sum, c) => sum + Number(c.valor_mensalidade), 0);

  const revenueReceived = finance.filter((f) => f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0);
  const revenuePending = finance.filter((f) => f.status === 'pendente').reduce((s, f) => s + Number(f.valor), 0);
  const revenueAtRisk = finance.filter((f) => f.status === 'atrasado').reduce((s, f) => s + Number(f.valor), 0);

  const churnRate = totalCustomers > 0 ? (customers.filter((c) => c.status_pagamento === 'inadimplente').length / totalCustomers) * 100 : 0;

  const paidInvoices = finance.filter((f) => f.status === 'pago');
  const avgTicket = paidInvoices.length > 0 ? revenueReceived / paidInvoices.length : 0;

  const recovered = finance.filter((f) => f.status === 'pago' && f.data_pagamento).length;
  const totalOverdue = finance.filter((f) => f.status === 'atrasado' || (f.status === 'pago' && f.data_pagamento)).length;
  const recoveryRate = totalOverdue > 0 ? (recovered / totalOverdue) * 100 : 0;

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const lastMonthRevenue = customers
    .filter((c) => c.created_at < lastMonth.toISOString() && c.status_pagamento !== 'inadimplente')
    .reduce((sum, c) => sum + Number(c.valor_mensalidade), 0);
  const growthVsLastMonth = lastMonthRevenue > 0 ? ((mrr - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;

  // Revenue evolution (last 6 months)
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  const revenueEvolution = months.map((m) => {
    const monthFin = finance.filter((f) => (f.data_vencimento || f.created_at).slice(0, 7) === m);
    return {
      month: new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
      recebido: monthFin.filter((f) => f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0),
      pendente: monthFin.filter((f) => f.status === 'pendente').reduce((s, f) => s + Number(f.valor), 0),
      atrasado: monthFin.filter((f) => f.status === 'atrasado').reduce((s, f) => s + Number(f.valor), 0),
    };
  });

  // Churn evolution (approximated from data)
  const churnEvolution = months.map((m) => {
    const monthCust = customers.filter((c) => c.created_at.slice(0, 7) <= m);
    const churned = monthCust.filter((c) => c.status_pagamento === 'inadimplente').length;
    return {
      month: new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
      rate: monthCust.length > 0 ? (churned / monthCust.length) * 100 : 0,
    };
  });

  // Customer growth
  const customerGrowth = months.map((m) => {
    const total = customers.filter((c) => c.created_at.slice(0, 7) <= m).length;
    const ativos = customers.filter((c) => c.created_at.slice(0, 7) <= m && c.status_pagamento !== 'inadimplente').length;
    return {
      month: new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
      total,
      ativos,
    };
  });

  // Revenue by segment (plano)
  const segmentMap: Record<string, number> = {};
  customers.forEach((c) => {
    const rev = finance
      .filter((f) => f.associado_id === c.id && f.status === 'pago')
      .reduce((s, f) => s + Number(f.valor), 0);
    segmentMap[c.plano] = (segmentMap[c.plano] || 0) + rev + Number(c.valor_mensalidade);
  });
  const revenueBySegment = Object.entries(segmentMap)
    .map(([segment, revenue]) => ({ segment, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Revenue by city
  const cityMap: Record<string, number> = {};
  customers.forEach((c) => {
    const city = c.cidade || 'Não informado';
    const rev = finance
      .filter((f) => f.associado_id === c.id && f.status === 'pago')
      .reduce((s, f) => s + Number(f.valor), 0);
    cityMap[city] = (cityMap[city] || 0) + rev + Number(c.valor_mensalidade);
  });
  const revenueByCity = Object.entries(cityMap)
    .map(([city, revenue]) => ({ city, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Top 20 customers by revenue
  const custRevenue: Record<string, number> = {};
  customers.forEach((c) => {
    const rev = finance
      .filter((f) => f.associado_id === c.id && f.status === 'pago')
      .reduce((s, f) => s + Number(f.valor), 0) + Number(c.valor_mensalidade) * 12;
    custRevenue[c.id] = rev;
  });
  const topCustomers = customers
    .map((c) => ({ nome: c.nome, revenue: custRevenue[c.id] || 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  // Cash flow ction
  const cashFlowction = months.map((m) => {
    const monthFin = finance.filter((f) => (f.data_vencimento || f.created_at).slice(0, 7) === m);
    const realizado = monthFin.filter((f) => f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0);
    const tado = monthFin.reduce((s, f) => s + Number(f.valor), 0);
    return {
      month: new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
      tado,
      realizado,
    };
  });

  // --- New KPIs for Diretoria dashboard ---
  const annualRevenue = mrr * 12;

  const revenueLost = finance
    .filter((f) => f.status === 'cancelado')
    .reduce((s, f) => s + Number(f.valor), 0);

  const revenueRecovered = finance
    .filter((f) => f.status === 'pago' && f.data_pagamento && f.data_vencimento && f.data_vencimento < f.data_pagamento)
    .reduce((s, f) => s + Number(f.valor), 0);

  const cac = totalCustomers > 0 ? revenueReceived / totalCustomers : 0;

  const avgMensalidade = customers.length > 0
    ? customers.reduce((s, c) => s + Number(c.valor_mensalidade), 0) / customers.length
    : 0;
  const ltv = churnRate > 0
    ? avgMensalidade * 12 * (1 / churnRate)
    : avgMensalidade * 12 * 24;

  const monthlyGrowth = growthVsLastMonth;

  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const mrrYearAgo = customers
    .filter((c) => c.created_at < yearAgo.toISOString() && c.status_pagamento !== 'inadimplente')
    .reduce((sum, c) => sum + Number(c.valor_mensalidade), 0);
  const yearlyGrowth = mrrYearAgo > 0
    ? ((mrr * 12 - mrrYearAgo * 12) / (mrrYearAgo * 12)) * 100
    : 0;

  const customersAtRisk = customers.filter(
    (c) => c.status_pagamento === 'atrasado' || c.status_pagamento === 'inadimplente',
  ).length;

  const goals = {
    mrrTarget: mrr * 1.15,
    churnTarget: 5,
    growthTarget: 15,
  };

  // Revenue by state
  const stateMap: Record<string, number> = {};
  customers.forEach((c) => {
    const state = c.estado || 'Não informado';
    const rev = finance
      .filter((f) => f.associado_id === c.id && f.status === 'pago')
      .reduce((s, f) => s + Number(f.valor), 0);
    stateMap[state] = (stateMap[state] || 0) + rev + Number(c.valor_mensalidade);
  });
  const revenueByState = Object.entries(stateMap)
    .map(([state, revenue]) => ({ state, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    kpis: {
      mrr, revenueReceived, revenuePending, revenueAtRisk, churnRate,
      activeCustomers, activeVehicles, avgTicket, growthVsLastMonth, recoveryRate,
      totalCustomers, totalVehicles,
      annualRevenue, revenueLost, revenueRecovered, cac, ltv,
      monthlyGrowth, yearlyGrowth, customersAtRisk, goals,
    },
    charts: {
      revenueEvolution, churnEvolution, customerGrowth,
      revenueBySegment, revenueByCity, revenueByState, topCustomers, cashFlowction,
    },
  };
}
