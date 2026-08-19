import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, Info, Clock,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const variants: Record<Variant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  return (
    <button className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

type BadgeColor = 'green' | 'red' | 'yellow' | 'blue' | 'slate' | 'orange' | 'purple';

const badgeColors: Record<BadgeColor, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  yellow: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

export function Badge({ color = 'slate', children, className = '' }: { color?: BadgeColor; children: ReactNode; className?: string }) {
  return <span className={`badge ${badgeColors[color]} ${className}`}>{children}</span>;
}

const statusConfig: Record<string, { color: BadgeColor; label: string }> = {
  em_dia: { color: 'green', label: 'Em dia' },
  atrasado: { color: 'yellow', label: 'Atrasado' },
  inadimplente: { color: 'red', label: 'Inadimplente' },
  ok: { color: 'green', label: 'OK' },
  com_problema: { color: 'red', label: 'Com problema' },
  sem_equipamento: { color: 'slate', label: 'Sem equipamento' },
  ativo: { color: 'green', label: 'Ativo' },
  inativo: { color: 'slate', label: 'Inativo' },
  manutencao: { color: 'yellow', label: 'Manutenção' },
  aberta: { color: 'blue', label: 'Aberta' },
  em_andamento: { color: 'yellow', label: 'Em andamento' },
  concluida: { color: 'green', label: 'Concluída' },
  cancelada: { color: 'slate', label: 'Cancelada' },
  pago: { color: 'green', label: 'Pago' },
  pendente: { color: 'yellow', label: 'Pendente' },
  cancelado: { color: 'slate', label: 'Cancelado' },
  pendente_task: { color: 'blue', label: 'Pendente' },
  ativa: { color: 'green', label: 'Ativa' },
  pausada: { color: 'yellow', label: 'Pausada' },
  rascunho: { color: 'slate', label: 'Rascunho' },
  queued: { color: 'blue', label: 'Em fila' },
  processing: { color: 'yellow', label: 'Processando' },
  completed: { color: 'green', label: 'Completo' },
  failed: { color: 'red', label: 'Falhou' },
  dead: { color: 'slate', label: 'Morto' },
  sucesso: { color: 'green', label: 'Sucesso' },
  falha: { color: 'red', label: 'Falha' },
  skip: { color: 'slate', label: 'Pulado' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { color: 'slate' as BadgeColor, label: status };
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { color: BadgeColor; label: string }> = {
    baixa: { color: 'slate', label: 'Baixa' },
    normal: { color: 'blue', label: 'Normal' },
    alta: { color: 'orange', label: 'Alta' },
    urgente: { color: 'red', label: 'Urgente' },
  };
  const cfg = map[priority] || { color: 'slate' as BadgeColor, label: priority };
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}

const severityConfig: Record<string, { color: BadgeColor; icon: typeof Info }> = {
  info: { color: 'blue', icon: Info },
  warning: { color: 'yellow', icon: AlertTriangle },
  critical: { color: 'red', icon: XCircle },
  success: { color: 'green', icon: CheckCircle2 },
};

export function SeverityBadge({ severity }: { severity: string }) {
  const cfg = severityConfig[severity] || severityConfig.info;
  const Icon = cfg.icon;
  return <Badge color={cfg.color}><Icon className="w-3 h-3" />{severity}</Badge>;
}

export function MetricCard({
  label, value, sublabel, trend, icon: Icon, trendValue, accent = 'blue',
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: typeof Info;
  trendValue?: string;
  accent?: 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'slate';
}) {
  const accentColors: Record<string, string> = {
    blue: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    green: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    yellow: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30',
    slate: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="card p-5 animate-fadeIn">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 truncate">{value}</p>
          {sublabel && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sublabel}</p>}
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${accentColors[accent]} flex-shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ message, icon: Icon }: { message: string; icon?: typeof Info }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
      {Icon && <Icon className="w-10 h-10 mb-3 opacity-50" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="animate-spin rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-red-600"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

export function ClockIcon({ className = '' }: { className?: string }) {
  return <Clock className={className} />;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date + (date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('pt-BR');
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function daysBetween(date: string): number {
  const d = new Date(date + (date.includes('T') ? '' : 'T00:00:00'));
  const now = new Date();
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysSince(date: string): number {
  return -daysBetween(date);
}
