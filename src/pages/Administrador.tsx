import { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  Users,
  KeyRound,
  ClipboardList,
  UserPlus,
  Search,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Role } from '@/types';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at: string;
};

const roles: Role[] = [
  'operador',
  'supervisor',
  'diretoria',
  'administrador',
];

const roleLabels: Record<Role, string> = {
  operador: 'Operador',
  supervisor: 'Supervisor',
  diretoria: 'Diretoria',
  administrador: 'Administrador',
};

export function Administrador() {
  const { profile } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('id, email, name, role, created_at, updated_at')
      .order('name', { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setUsers([]);
    } else {
      setUsers((data || []) as AdminUser[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const changeRole = async (user: AdminUser, role: Role) => {
    if (role === user.role) return;

    setSaving(user.id);
    setError(null);
    setSuccess(null);

    const { data, error: rpcError } = await supabase.rpc(
      'set_user_role',
      {
        p_user_id: user.id,
        p_role: role,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setSaving(null);
      return;
    }

    const updated = data as AdminUser;

    setUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? { ...item, role: updated.role, updated_at: updated.updated_at }
          : item
      )
    );

    await supabase.from('atividades').insert({
      tipo: 'usuario_perfil_alterado',
      descricao: `Perfil de ${user.name} alterado de ${roleLabels[user.role]} para ${roleLabels[role]}.`,
      modulo: 'administrador',
      usuario_id: profile?.id ?? null,
      usuario_name: profile?.name ?? null,
    });

    setSuccess(`Perfil de ${user.name} atualizado.`);
    setSaving(null);
  };

  const filteredUsers = users.filter((user) => {
    const term = search.toLowerCase();

    return (
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      roleLabels[user.role].toLowerCase().includes(term)
    );
  });

  if (profile?.role !== 'administrador') {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-red-600" />
            <div>
              <h1 className="font-semibold text-red-800 dark:text-red-300">
                Acesso restrito
              </h1>
              <p className="text-sm text-red-700 dark:text-red-400">
                Esta área está disponível somente para administradores.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-red-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Administração
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Gestão de usuários, perfis, permissões e auditoria.
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <Users className="mb-3 h-6 w-6 text-slate-500" />
          <p className="text-sm text-slate-500">Usuários</p>
          <p className="mt-1 text-2xl font-bold">{users.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <UserCheck className="mb-3 h-6 w-6 text-emerald-600" />
          <p className="text-sm text-slate-500">Administradores</p>
          <p className="mt-1 text-2xl font-bold">
            {users.filter((user) => user.role === 'administrador').length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <KeyRound className="mb-3 h-6 w-6 text-slate-500" />
          <p className="text-sm text-slate-500">Perfis disponíveis</p>
          <p className="mt-1 text-2xl font-bold">{roles.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Gestão de Usuários
            </h2>
            <p className="text-sm text-slate-500">
              Altere o nível de acesso de cada usuário.
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar usuário..."
              className="w-full rounded-lg border border-slate-200 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-red-500 dark:border-slate-700"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Usuário</th>
                <th className="px-5 py-3">E-mail</th>
                <th className="px-5 py-3">Perfil</th>
                <th className="px-5 py-3">Criado em</th>
                <th className="px-5 py-3">Ação</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <Users className="h-4 w-4 text-slate-500" />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {user.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-slate-500">
                    {user.email}
                  </td>

                  <td className="px-5 py-4">
                    <select
                      value={user.role}
                      disabled={saving === user.id}
                      onChange={(event) =>
                        changeRole(user, event.target.value as Role)
                      }
                      className="rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-5 py-4 text-slate-500">
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </td>

                  <td className="px-5 py-4">
                    {saving === user.id ? (
                      <span className="text-xs text-slate-400">
                        Salvando...
                      </span>
                    ) : user.role === 'administrador' ? (
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <UserX className="h-5 w-5 text-slate-400" />
                    )}
                  </td>
                </tr>
              ))}

              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-slate-500" />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Auditoria
            </h2>
            <p className="text-sm text-slate-500">
              As alterações de perfil são registradas em atividades.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled
        className="hidden"
      >
        <UserPlus />
      </button>
    </div>
  );
}
