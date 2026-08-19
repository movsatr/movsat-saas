import { useCallback, useSyncExternalStore } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// ---------------------------------------------------------------------------
// Module-level state — the `toast` singleton and the `useToasts` hook share
// this single source of truth so one ToastContainer renders every toast.
// ---------------------------------------------------------------------------
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((l) => l());
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  if (timers.has(id)) {
    clearTimeout(timers.get(id)!);
    timers.delete(id);
  }
  emit();
}

function pushToast(type: ToastType, message: string) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, type, message }];
  timers.set(id, setTimeout(() => removeToast(id), 4000));
  emit();
}

/** Imperative toast API — `toast.success('Saved!')` */
export const toast = {
  success: (msg: string) => pushToast('success', msg),
  error: (msg: string) => pushToast('error', msg),
  info: (msg: string) => pushToast('info', msg),
  warning: (msg: string) => pushToast('warning', msg),
};

/** React hook used by <ToastContainer /> to subscribe to the singleton. */
export function useToasts() {
  const subscribe = useCallback((callback: () => void) => {
    listeners.add(callback);
    return () => { listeners.delete(callback); };
  }, []);

  const getSnapshot = useCallback(() => toasts, []);
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const remove = useCallback((id: string) => removeToast(id), []);

  return { toasts: currentToasts, push: pushToast, remove };
}

export type ToastPushFn = (type: ToastType, message: string) => void;
