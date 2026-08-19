import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useToasts, type ToastType } from '@/lib/toast';

const icons: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  error: 'border-red-500 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  warning: 'border-amber-500 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
};

export function ToastContainer({ toasts, remove }: ReturnType<typeof useToasts>) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3.5 rounded-lg border-l-4 shadow-lg animate-slideIn ${colors[t.type]}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
