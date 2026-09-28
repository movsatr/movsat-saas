import { useState } from 'react';
import { LockKeyhole, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function ResetPasswordScreen() {
  const { updatePassword, finishPasswordRecovery } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setError('');

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    const result = await updatePassword(password);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(true);

    setTimeout(() => {
      finishPasswordRecovery();
    }, 1500);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Senha alterada
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Sua senha foi alterada com sucesso.
          </p>

          <p className="mt-4 text-xs text-slate-400">
            Entrando no sistema...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/40">
            <LockKeyhole className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Nova senha
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Cadastre uma nova senha para acessar o Mov Sat OS.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Nova senha
            </label>

            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua nova senha"
                autoComplete="new-password"
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 pr-10 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            <p className="mt-1.5 text-xs text-slate-400">
              Mínimo de 8 caracteres.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Confirmar nova senha
            </label>

            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Digite a senha novamente"
                autoComplete="new-password"
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 pr-10 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Alterando senha...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}