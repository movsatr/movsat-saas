import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', onConfirm, onCancel, danger = true,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onCancel}>
      <div className="card p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-4">
          {danger && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/30 flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
