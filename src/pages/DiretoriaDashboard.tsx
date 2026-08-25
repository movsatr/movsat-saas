import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Users, Truck,
  Wallet, Banknote, AlertTriangle, Activity, CalendarClock,
} from 'lucide-react';
import { loadDiretoriaData, type DiretoriaKPIs, type DiretoriaChartData } from '@/lib/insights';
import { MetricCard, LoadingSpinner, formatCurrency } from '@/components/ui';
import { ChartCard, GroupedBarChart, LineChart, DonutChart, HorizontalBarChart } from '@/components/Charts';

export function DiretoriaDashboard() {
  const [kpis, setKpis] = useState<DiretoriaKPIs | null>(null);
  const [charts, setCharts] = useState<DiretoriaChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiretoriaData().then(({ kpis, charts }) => {
      setKpis(kpis);
      setCharts(charts);
      setLoading(false);
    });
  }, []);

  if (loading || !kpis || !charts) return <LoadingSpinner />;

  const fmt = (v: number) => formatCurrency(v);
  const growthTrend = kpis.growthVsLastMonth >= 0 ? 'up' : 'down' as 'up' | 'down';


  return (
    <div className="space-y-5">
      {/* Executive summary banner */}
      <div className="card p-5 bg-gradient-to-r from-slate-900 to-red-950 dark:from-slate-900 dark:to-slate-950 border-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Visão Executiva</h2>
            <p className="text-sm text-red-300/70 mt-0.5">Indicadores estratégicos da operação</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-red-300/60 uppercase tracking-wide">MRR</p>
              <p className="text-xl font-bold text-white">{fmt(kpis.mrr)}</p>
            </div>
            <div className="w-px h-10 bg-red-800/50" />
            <div>
              <p className="text-xs text-red-300/60 uppercase tracking-wide">Crescimento</p>
              <p className={`text-xl font-bold ${kpis.growthVsLastMonth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpis.growthVsLastMonth >= 0 ? '+' : ''}{kpis.growthVsLastMonth.toFixed(1)}%
              </p>
            </div>
            <div className="w-px h-10 bg-red-800/50" />
            <div>
              <p className="text-xs text-red-300/60 uppercase tracking-wide">Churn</p>
              <p className="text-xl font-bold text-white">{kpis.churnRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPIs — most important only */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="MRR" value={fmt(kpis.mrr)} icon={DollarSign} accent="green" sublabel="Receita recorrente mensal" />
        <MetricCard label="Receita Anual" value={fmt(kpis.annualRevenue)} icon={CalendarClock} accent="green" sublabel="MRR × 12" />
        <MetricCard label="Receita Recebida" value={fmt(kpis.revenueReceived)} icon={Banknote} accent="green" />
        <MetricCard label="Receita em Risco" value={fmt(kpis.revenueAtRisk)} icon={AlertTriangle} accent="red" sublabel={`${kpis.customersAtRisk} clientes em risco`} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Receita Pendente" value={fmt(kpis.revenuePending)} icon={Wallet} accent="yellow" />
        <MetricCard label="Receita Recuperada" value={fmt(kpis.revenueRecovered)} icon={Activity} accent="green" sublabel="Faturas atrasadas pagas" />
        <MetricCard label="Receita Perdida" value={fmt(kpis.revenueLost)} icon={TrendingDown} accent="red" sublabel="Faturas canceladas" />
        <MetricCard label="Taxa de Recuperação" value={`${kpis.recoveryRate.toFixed(0)}%`} icon={Activity} accent="orange" />
      </div>

     

      {/* Growth & customers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Crescimento Mensal" value={`${kpis.growthVsLastMonth >= 0 ? '+' : ''}${kpis.growthVsLastMonth.toFixed(1)}%`} icon={growthTrend === 'up' ? TrendingUp : TrendingDown} accent={growthTrend === 'up' ? 'green' : 'red'} trendValue={`Meta: ${kpis.goals.growthTarget}%`} />
        <MetricCard label="Crescimento Anual" value={`${kpis.yearlyGrowth >= 0 ? '+' : ''}${kpis.yearlyGrowth.toFixed(1)}%`} icon={growthTrend === 'up' ? TrendingUp : TrendingDown} accent={kpis.yearlyGrowth >= 0 ? 'green' : 'red'} />
        <MetricCard label="Clientes Ativos" value={kpis.activeCustomers} icon={Users} accent="red" sublabel={`${kpis.totalCustomers} total`} />
        <MetricCard label="Veículos Ativos" value={kpis.activeVehicles} icon={Truck} accent="red" sublabel={`${kpis.totalVehicles} total`} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Evolução de Receita" subtitle="Recebido, pendente e atrasado (6 meses)">
          <GroupedBarChart
            data={charts.revenueEvolution.map((d) => ({ label: d.month, values: { recebido: d.recebido, pendente: d.pendente, atrasado: d.atrasado } }))}
            series={[
              { key: 'recebido', color: 'green', label: 'Recebido' },
              { key: 'pendente', color: 'amber', label: 'Pendente' },
              { key: 'atrasado', color: 'red', label: 'Atrasado' },
            ]}
          />
        </ChartCard>

        <ChartCard title="Evolução de Churn" subtitle="Taxa de cancelamento (6 meses)">
          <LineChart
            data={charts.churnEvolution.map((d) => ({ label: d.month, value: d.rate }))}
            color="red"
            valueFormat={(v) => `${v.toFixed(1)}%`}
          />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Crescimento de Clientes" subtitle="Total e ativos (6 meses)">
          <GroupedBarChart
            data={charts.customerGrowth.map((d) => ({ label: d.month, values: { total: d.total, ativos: d.ativos } }))}
            series={[
              { key: 'total', color: 'red', label: 'Total' },
              { key: 'ativos', color: 'green', label: 'Ativos' },
            ]}
          />
        </ChartCard>

        <ChartCard title="ção de Fluxo de Caixa" subtitle="Realizado vs tado (6 meses)">
          <GroupedBarChart
            data={charts.cashFlowction.map((d) => ({ label: d.month, values: { tado: d.tado, realizado: d.realizado } }))}
            series={[
              { key: 'tado', color: 'red', label: 'tado' },
              { key: 'realizado', color: 'green', label: 'Realizado' },
            ]}
          />
        </ChartCard>
      </div>

      {/* Charts row 3 — geographic and segment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="Receita por Segmento" subtitle="Distribuição por plano">
          {charts.revenueBySegment.length > 0 ? (
            <DonutChart
              data={charts.revenueBySegment.slice(0, 5).map((d, i) => ({
                label: d.segment,
                value: d.revenue,
                color: (['red', 'green', 'amber', 'slate', 'orange'] as const)[i % 5],
              }))}
            />
          ) : <div className="text-sm text-slate-400 text-center py-8">Sem dados</div>}
        </ChartCard>

        <ChartCard title="Receita por Cidade" subtitle="Distribuição geográfica">
          {charts.revenueByCity.length > 0 ? (
            <HorizontalBarChart
              data={charts.revenueByCity.slice(0, 6).map((d) => ({ label: d.city, value: d.revenue }))}
              color="red"
              valueFormat={fmt}
            />
          ) : <div className="text-sm text-slate-400 text-center py-8">Sem dados</div>}
        </ChartCard>

        <ChartCard title="Receita por Estado" subtitle="Distribuição estadual">
          {charts.revenueByState && charts.revenueByState.length > 0 ? (
            <HorizontalBarChart
              data={charts.revenueByState.slice(0, 6).map((d) => ({ label: d.state, value: d.revenue }))}
              color="green"
              valueFormat={fmt}
            />
          ) : <div className="text-sm text-slate-400 text-center py-8">Sem dados</div>}
        </ChartCard>
      </div>

      {/* Top 20 customers table */}
      <ChartCard title="Top 20 Clientes por Receita" subtitle="Ranking completo">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-5 py-2 text-xs font-semibold text-slate-400 uppercase">#</th>
                <th className="text-left px-5 py-2 text-xs font-semibold text-slate-400 uppercase">Cliente</th>
                <th className="text-right px-5 py-2 text-xs font-semibold text-slate-400 uppercase">Receita Anual</th>
                <th className="text-right px-5 py-2 text-xs font-semibold text-slate-400 uppercase">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {charts.topCustomers.map((c, i) => {
                const total = charts.topCustomers.reduce((s, x) => s + x.revenue, 0) || 1;
                const pct = (c.revenue / total) * 100;
                return (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-5 py-2 font-medium text-slate-900 dark:text-white">{c.nome}</td>
                    <td className="px-5 py-2 text-right font-semibold text-slate-900 dark:text-white">{fmt(c.revenue)}</td>
                    <td className="px-5 py-2 text-right text-slate-500">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function GoalBar({ label, current, target, format, progress, inverse }: {
  label: string;
  current: number;
  target: number;
  format: (v: number) => string;
  progress: number;
  inverse?: boolean;
}) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const isGood = inverse ? progress < 100 : progress >= 50;
  const barColor = isGood ? 'bg-emerald-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-xs text-slate-400">
          {format(current)} / {format(target)}
        </span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
