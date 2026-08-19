import {
  Shield,
  Users,
  KeyRound,
  ClipboardList,
  UserPlus,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Administrador() {
  const { profile } = useAuth();

  const cards = [
    {
      title: 'Gestão de Usuários',
      description:
        'Criar, editar, ativar ou inativar usuários do MovSat OS.',
      icon: Users,
      action: 'Gerenciar usuários',
    },
    {
      title: 'Perfis e Permissões',
      description:
        'Definir níveis de acesso e permissões por função.',
      icon: KeyRound,
      action: 'Configurar permissões',
    },
    {
      title: 'Auditoria',
      description:
        'Consultar ações administrativas realizadas no sistema.',
      icon: ClipboardList,
      action: 'Ver auditoria',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
            <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Administração
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Controle de usuários, acessos e segurança do MovSat OS.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-bold">
            {profile?.name?.charAt(0).toUpperCase() || 'A'}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {profile?.name || 'Administrador'}
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acesso administrativo
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Acesso autorizado
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Controles administrativos
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gerencie os principais recursos administrativos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.title}
                type="button"
                className="card p-5 text-left hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
                    <Icon className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400" />
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-red-500 transition-colors" />
                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                  {card.title}
                </h3>

                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {card.description}
                </p>

                <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {card.action}
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
            <UserPlus className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Próximos controles
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              A estrutura está preparada para receber a gestão completa de
              usuários, permissões e auditoria.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
