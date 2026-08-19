/**
 * Maps a backend error onto a short, friendly Portuguese sentence.
 *
 * Raw PostgREST / Postgres errors carry table names, column names, constraint
 * names and row-level-security policy names. Showing them to a user hands out
 * a map of the schema and of the authorization model, so they are logged to the
 * console for developers and never rendered.
 */

interface BackendError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/** Postgres / PostgREST SQLSTATE codes we can explain in plain language. */
const CODE_MESSAGES: Record<string, string> = {
  '23505': 'Já existe um registro com esses dados.',
  '23503': 'Este registro está vinculado a outro e não pode ser alterado ou removido.',
  '23514': 'Algum campo está fora dos valores permitidos.',
  '23502': 'Preencha todos os campos obrigatórios.',
  '22P02': 'Algum campo está em formato inválido.',
  '42501': 'Seu perfil não tem permissão para esta ação.',
  '42601': 'Não foi possível processar a busca.',
  PGRST301: 'Sua sessão expirou. Entre novamente.',
};

const DEFAULT_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.';

/**
 * @param error   the error returned by Supabase
 * @param context short label used in the console log, e.g. 'salvar veículo'
 */
export function friendlyError(error: unknown, context = 'operação'): string {
  const e = (error ?? {}) as BackendError;

  console.error(`[${context}]`, error);

  if (e.code && CODE_MESSAGES[e.code]) return CODE_MESSAGES[e.code];

  // Row-level-security rejections arrive as a message rather than a stable code.
  const msg = (e.message || '').toLowerCase();
  if (msg.includes('row-level security') || msg.includes('permission denied')) {
    return 'Seu perfil não tem permissão para esta ação.';
  }
  if (msg.includes('duplicate key')) return 'Já existe um registro com esses dados.';
  if (msg.includes('jwt') || msg.includes('token')) {
    return 'Sua sessão expirou. Entre novamente.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Sem conexão com o servidor. Verifique sua internet.';
  }

  return DEFAULT_MESSAGE;
}

/** Sign-in failures are deliberately uniform so accounts cannot be enumerated. */
export function friendlyAuthError(error: unknown): string {
  const e = (error ?? {}) as BackendError;
  console.error('[autenticação]', error);

  const msg = (e.message || '').toLowerCase();
  if (msg.includes('too many') || msg.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Sem conexão com o servidor. Verifique sua internet.';
  }
  return 'E-mail ou senha incorretos.';
}
