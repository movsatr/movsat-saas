import { Lightbulb, TrendingUp, AlertTriangle, TrendingDown } from 'lucide-react';
import { type ReactNode } from 'react';

type InsightType = 'opportunity' | 'warning' | 'success' | 'info';

const config: Record<InsightType, { icon: typeof Lightbulb; color: string; bg: string }> = {
  opportunity: { icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  success: { icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  info: { icon: Lightbulb, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
};

export function InsightCard({
  type = 'info', title, children, action,
}: {
  type?: InsightType;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const cfg = config[type];
  const Icon = cfg.icon;
  return (
    <div className={`card p-4 border-l-4 border-l-transparent ${cfg.bg} animate-fadeIn`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${cfg.color}`}>{title}</p>
          <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">{children}</div>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export { TrendingDown };
