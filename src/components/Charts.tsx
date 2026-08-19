import { type ReactNode } from 'react';

// ============ Color constants ============
const COLORS = {
  blue: '#dc2626',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  slate: '#64748b',
  purple: '#8b5cf6',
  orange: '#f97316',
  cyan: '#06b6d4',
};

// ============ Bar Chart ============
export function BarChart({
  data, height = 200, color = 'blue', valueFormat,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: keyof typeof COLORS;
  valueFormat?: (v: number) => string;
}) {
  if (data.length === 0) return <EmptyChart />;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;
  const colorHex = COLORS[color];

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between gap-1 h-full pb-6 relative">
        {data.map((d, i) => {
          const h = (d.value / maxVal) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div
                className="w-full max-w-[48px] rounded-t-md transition-all duration-300 hover:opacity-80 relative"
                style={{
                  height: `${h}%`,
                  backgroundColor: colorHex,
                  minHeight: d.value > 0 ? '4px' : '0',
                }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm z-10">
                  {valueFormat ? valueFormat(d.value) : d.value}
                </div>
              </div>
              <div className="absolute bottom-0 translate-y-full pt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate w-full text-center">
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Grouped Bar Chart ============
export function GroupedBarChart({
  data, height = 220, series,
}: {
  data: { label: string; values: Record<string, number> }[];
  height?: number;
  series: { key: string; color: keyof typeof COLORS; label: string }[];
}) {
  if (data.length === 0) return <EmptyChart />;
  const maxVal = Math.max(...data.flatMap((d) => series.map((s) => d.values[s.key] || 0)), 1);
  const groupWidth = 100 / data.length;

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-2 h-full pb-6 relative" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="flex items-end gap-0.5 h-full w-full justify-center">
              {series.map((s) => {
                const h = ((d.values[s.key] || 0) / maxVal) * 100;
                return (
                  <div
                    key={s.key}
                    className="rounded-t-sm transition-all duration-300 hover:opacity-80 group relative"
                    style={{
                      height: `${h}%`,
                      backgroundColor: COLORS[s.color],
                      width: `${100 / series.length * 0.8}%`,
                      minHeight: (d.values[s.key] || 0) > 0 ? '3px' : '0',
                    }}
                    title={`${s.label}: ${d.values[s.key] || 0}`}
                  />
                );
              })}
            </div>
            <div className="absolute bottom-0 translate-y-full pt-1 text-[10px] text-slate-500 dark:text-slate-400">
              {d.label}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 justify-center mt-6 flex-wrap">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[s.color] }} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Line Chart ============
export function LineChart({
  data, height = 200, color = 'blue', valueFormat,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: keyof typeof COLORS;
  valueFormat?: (v: number) => string;
}) {
  if (data.length === 0) return <EmptyChart />;
  const maxVal = Math.max(...data.map((d) => d.value), 0.1);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = maxVal - minVal || 1;
  const w = 100;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = 100 - ((d.value - minVal) / range) * 90 - 5;
    return { x, y, ...d };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1].x} 100 L 0 100 Z`;
  const colorHex = COLORS[color];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: '100%' }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorHex} stopOpacity="0.2" />
            <stop offset="100%" stopColor={colorHex} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#grad-${color})`} />
        <path d={path} fill="none" stroke={colorHex} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={colorHex} vectorEffect="non-scaling-stroke" className="hover:r-3 transition-all" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        {data.map((d, i) => (
          <div key={i} className="text-[10px] text-slate-500 dark:text-slate-400 flex-1 text-center">
            {d.label}
          </div>
        ))}
      </div>
      <div className="flex gap-3 justify-center mt-2 flex-wrap">
        {data.map((d, i) => (
          <div key={i} className="text-[10px] text-slate-400 hidden group-hover:block">
            {valueFormat ? valueFormat(d.value) : d.value}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Donut Chart ============
export function DonutChart({
  data, size = 160,
}: {
  data: { label: string; value: number; color: keyof typeof COLORS }[];
  size?: number;
}) {
  if (data.length === 0) return <EmptyChart />;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="flex-shrink-0">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-slate-800" />
        {data.map((d, i) => {
          const dash = (d.value / total) * circumference;
          const circle = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={COLORS[d.color]}
              strokeWidth="10"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              className="transition-all duration-300"
            />
          );
          offset += dash;
          return circle;
        })}
        <text x="50" y="48" textAnchor="middle" className="fill-slate-900 dark:fill-white text-[10px] font-bold">
          {total > 999 ? `${(total / 1000).toFixed(1)}k` : total}
        </text>
        <text x="50" y="58" textAnchor="middle" className="fill-slate-400 text-[5px]">
          Total
        </text>
      </svg>
      <div className="space-y-1.5 flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: COLORS[d.color] }} />
            <span className="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate">{d.label}</span>
            <span className="text-xs font-medium text-slate-900 dark:text-white">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Horizontal Bar Chart ============
export function HorizontalBarChart({
  data, color = 'blue', valueFormat,
}: {
  data: { label: string; value: number }[];
  color?: keyof typeof COLORS;
  valueFormat?: (v: number) => string;
}) {
  if (data.length === 0) return <EmptyChart />;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const colorHex = COLORS[color];

  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3 group">
          <div className="w-28 text-xs text-slate-600 dark:text-slate-300 truncate text-right flex-shrink-0">{d.label}</div>
          <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden relative">
            <div
              className="h-full rounded-md transition-all duration-500 hover:opacity-80 flex items-center justify-end pr-2"
              style={{
                width: `${(d.value / maxVal) * 100}%`,
                backgroundColor: colorHex,
                minWidth: d.value > 0 ? '24px' : '0',
              }}
            >
              <span className="text-[10px] font-medium text-white whitespace-nowrap">
                {valueFormat ? valueFormat(d.value) : d.value}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ Chart Card wrapper ============
export function ChartCard({
  title, subtitle, children, action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card p-5 animate-fadeIn">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-32 text-sm text-slate-400">
      Sem dados para exibir
    </div>
  );
}
