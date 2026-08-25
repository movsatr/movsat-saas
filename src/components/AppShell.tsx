import { useState, useEffect, type ReactNode } from 'react';
import {
  Satellite, LayoutDashboard, Users, Truck, Wrench, Package,
  DollarSign, FileText, Brain, Zap, ListTodo, Menu, X, Sun, Moon,
  Bell, LogOut, ChevronRight, Car, Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNav, type PageKey } from '@/contexts/NavContext';
import { useTheme } from '@/lib/theme';
import { GlobalSearch } from '@/components/GlobalSearch';
import { supabase } from '@/lib/supabase';

import type { Notification, Task, Role } from '@/types';

import {
  SeverityBadge,
  PriorityBadge,
  Button,
  formatDateTime,
  formatDate,
} from '@/components/ui';

interface NavItem {
  key: PageKey;
  label: string;
  icon: typeof Satellite;
  roles: Role[];
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

const navItems: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['operador', 'supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'associados',
    label: 'Associados',
    icon: Users,
    roles: ['operador', 'supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'rastreadores',
    label: 'Rastreadores',
    icon: Truck,
    roles: ['operador', 'supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'veiculos',
    label: 'Veículos',
    icon: Car,
    roles: ['operador', 'supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'ordens',
    label: 'Ordens de Serviço',
    icon: Wrench,
    roles: ['operador', 'supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'prestadores',
    label: 'Prestadores',
    icon: Users,
    roles: ['supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'estoque',
    label: 'Estoque',
    icon: Package,
    roles: ['operador', 'supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    roles: ['diretoria', 'administrador'],
  },
  {
    key: 'base-tecnica',
    label: 'Base Técnica',
    icon: FileText,
    roles: ['operador', 'supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'inteligencia',
    label: 'Inteligência',
    icon: Brain,
    roles: ['supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'automacao',
    label: 'Automação',
    icon: Zap,
    roles: ['supervisor', 'administrador'],
  },
  {
    key: 'tarefas',
    label: 'Tarefas',
    icon: ListTodo,
    roles: ['operador', 'supervisor', 'diretoria', 'administrador'],
  },
  {
    key: 'administrador',
    label: 'Administração',
    icon: Shield,
    roles: ['administrador'],
  },
];

/* =========================================================
   GRUPOS DO MENU
   ========================================================= */

const navGroups: {
  title: string;
  keys: PageKey[];
}[] = [
  {
    title: 'OPERAÇÃO',
    keys: ['dashboard', 'rastreadores', 'veiculos', 'ordens', 'tarefas'],
  },
  {
    title: 'COMERCIAL',
    keys: ['associados', 'prestadores'],
  },
  {
    title: 'FINANCEIRO',
    keys: ['financeiro', 'inteligencia'],
  },
  {
    title: 'GESTÃO',
    keys: ['estoque', 'base-tecnica', 'automacao'],
  },
  {
    title: 'ADMINISTRAÇÃO',
    keys: ['administrador'],
  },
];

/* =========================================================
   NOMES DOS PERFIS
   ========================================================= */

const roleLabels: Record<Role, string> = {
  operador: 'Operador',
  supervisor: 'Supervisor',
  diretoria: 'Diretoria',
  administrador: 'Administrador',
};

/* =========================================================
   APP SHELL
   ========================================================= */

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();

  const {
    page,
    setPage,
    mobileOpen,
    setMobileOpen,
  } = useNav();

  const { theme, toggle } = useTheme();

  const [notifOpen, setNotifOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [notifLoading, setNotifLoading] = useState(true);

  /*
   * Se não existir perfil por algum motivo,
   * o padrão visual será operador.
   */
  const role: Role = profile?.role ?? 'operador';

  /* =======================================================
     ITENS VISÍVEIS PARA O USUÁRIO
     ======================================================= */

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(role)
  );

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  const pendingTasks = tasks.filter(
    (task) =>
      task.status === 'pendente' ||
      task.status === 'em_andamento'
  ).length;

  /* =======================================================
     DEBUG ADMIN
     ======================================================= */

  useEffect(() => {
    console.log('MOVSAT OS - AUTENTICAÇÃO:', {
      profile,
      role,
      isAdministrator: role === 'administrador',
      currentPage: page,
    });
  }, [profile, role, page]);

  /* =======================================================
     CARREGAR NOTIFICAÇÕES E TAREFAS
     ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setNotifLoading(true);

      try {
        const [notificationsResponse, tasksResponse] =
          await Promise.all([
            supabase
              .from('notifications')
              .select('*')
              .or(
                `target_role.eq.${role},target_role.is.null`
              )
              .order('created_at', {
                ascending: false,
              })
              .limit(20),

            supabase
              .from('tasks')
              .select('*')
              .order('created_at', {
                ascending: false,
              })
              .limit(20),
          ]);

        if (!mounted) return;

        if (notificationsResponse.error) {
          console.error(
            'Erro ao carregar notificações:',
            notificationsResponse.error.message
          );
        } else if (notificationsResponse.data) {
          setNotifications(
            notificationsResponse.data as Notification[]
          );
        }

        if (tasksResponse.error) {
          console.error(
            'Erro ao carregar tarefas:',
            tasksResponse.error.message
          );
        } else if (tasksResponse.data) {
          setTasks(tasksResponse.data as Task[]);
        }
      } catch (error) {
        console.error(
          'Erro ao carregar dados do AppShell:',
          error
        );
      } finally {
        if (mounted) {
          setNotifLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [role, page]);

  /* =======================================================
     NAVEGAÇÃO
     ======================================================= */

  const handleNav = (key: PageKey) => {
    setPage(key);
    setMobileOpen(false);
  };

  /* =======================================================
     NOTIFICAÇÃO COMO LIDA
     ======================================================= */

  const markNotifRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      console.error(
        'Erro ao marcar notificação como lida:',
        error.message
      );
      return;
    }

    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read: true,
            }
          : notification
      )
    );
  };

  /* =======================================================
     PÁGINA ATUAL
     ======================================================= */

  const currentPageLabel =
    navItems.find((item) => item.key === page)?.label ??
    'Dashboard';

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">

      {/* ===================================================
          SIDEBAR DESKTOP
      =================================================== */}

      <aside className="hidden lg:flex w-60 flex-col fixed inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30">
        <SidebarContent
          items={visibleItems}
          current={page}
          onNav={handleNav}
          role={role}
          profileName={profile?.name ?? ''}
          onSignOut={signOut}
        />
      </aside>

      {/* ===================================================
          SIDEBAR MOBILE
      =================================================== */}

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">

          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="relative w-64 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 animate-slideIn">
            <SidebarContent
              items={visibleItems}
              current={page}
              onNav={handleNav}
              role={role}
              profileName={profile?.name ?? ''}
              onSignOut={signOut}
            />
          </aside>

        </div>
      )}

      {/* ===================================================
          ÁREA PRINCIPAL
      =================================================== */}

      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">

        {/* HEADER */}

        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">

          <div className="flex items-center gap-3 px-4 py-3">

            {/* Menu mobile */}

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>

            {/* Nome da página */}

            <div className="hidden sm:block">
              <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                {currentPageLabel}
              </h1>
            </div>

            {/* Busca */}

            <GlobalSearch />

            {/* Ações */}

            <div className="flex items-center gap-1.5 ml-auto">

              {/* Tarefas */}

              <button
                type="button"
                onClick={() => setTaskOpen(true)}
                className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Tarefas"
              >
                <ListTodo className="w-5 h-5 text-slate-600 dark:text-slate-300" />

                {pendingTasks > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingTasks > 9
                      ? '9+'
                      : pendingTasks}
                  </span>
                )}
              </button>

              {/* Notificações */}

              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Notificações"
              >
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />

                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse-soft">
                    {unreadCount > 9
                      ? '9+'
                      : unreadCount}
                  </span>
                )}
              </button>

              {/* Tema */}

              <button
                type="button"
                onClick={toggle}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Alternar tema"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-slate-300" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </button>

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

              {/* Usuário */}

              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {profile?.name ?? 'Usuário'}
                </span>

                <span className="text-xs text-slate-400">
                  {roleLabels[role]}
                </span>
              </div>

              {/* Sair */}

              <button
                type="button"
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>

            </div>
          </div>
        </header>

        {/* CONTEÚDO */}

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {children}
        </main>

      </div>

      {/* ===================================================
          PAINEL DE NOTIFICAÇÕES
      =================================================== */}

      {notifOpen && (
        <div
          className="fixed inset-0 z-[60] flex justify-end"
          onClick={() => setNotifOpen(false)}
        >

          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto animate-slideIn"
            onClick={(event) => event.stopPropagation()}
          >

            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-10">

              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Notificações
              </h2>

              <button
                type="button"
                onClick={() => setNotifOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar notificações"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>

            </div>

            <div className="p-4 space-y-2">

              {notifLoading ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  Carregando...
                </p>
              ) : notifications.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  Nenhuma notificação
                </p>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                      notification.read
                        ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                        : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
                    }`}
                    onClick={() =>
                      !notification.read &&
                      markNotifRead(notification.id)
                    }
                  >

                    <div className="flex items-start gap-2">

                      <SeverityBadge
                        severity={notification.type}
                      />

                      <div className="flex-1 min-w-0">

                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {notification.title}
                        </p>

                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {notification.message}
                        </p>

                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatDateTime(
                            notification.created_at
                          )}
                        </p>

                      </div>

                    </div>

                  </div>
                ))
              )}

            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          PAINEL DE TAREFAS
      =================================================== */}

      {taskOpen && (
        <div
          className="fixed inset-0 z-[60] flex justify-end"
          onClick={() => setTaskOpen(false)}
        >

          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto animate-slideIn"
            onClick={(event) => event.stopPropagation()}
          >

            <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-10">

              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Tarefas Operacionais
              </h2>

              <button
                type="button"
                onClick={() => setTaskOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar tarefas"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>

            </div>

            <div className="p-4 space-y-3">

              {tasks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  Nenhuma tarefa
                </p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="card p-3"
                  >

                    <div className="flex items-start justify-between gap-2">

                      <p className="text-sm font-medium text-slate-900 dark:text-white flex-1">
                        {task.title}
                      </p>

                      <PriorityBadge
                        priority={task.priority}
                      />

                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>
                        Resp: {task.owner}
                      </span>

                      <span>
                        Prazo: {formatDate(task.deadline)}
                      </span>
                    </div>

                    <div className="flex gap-2 mt-3">

                      {role !== 'operador' && <select
                        value={task.status}
                        onChange={async (event) => {
                          const newStatus =
                            event.target.value as Task['status'];

                          const { error } = await supabase
                            .from('tasks')
                            .update({
                              status: newStatus,
                            })
                            .eq('id', task.id);

                          if (error) {
                            console.error(
                              'Erro ao atualizar tarefa:',
                              error.message
                            );
                            return;
                          }

                          setTasks((previous) =>
                            previous.map((item) =>
                              item.id === task.id
                                ? {
                                    ...item,
                                    status: newStatus,
                                  }
                                : item
                            )
                          );
                        }}
                        className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                      >
                        <option value="pendente">
                          Pendente
                        </option>

                        <option value="em_andamento">
                          Em andamento
                        </option>

                        <option value="concluida">
                          Concluída
                        </option>

                        <option value="cancelada">
                          Cancelada
                        </option>
                      </select>}

                    </div>

                  </div>
                ))
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* =========================================================
   SIDEBAR CONTENT
   ========================================================= */

function SidebarContent({
  items,
  current,
  onNav,
  role,
  profileName,
  onSignOut,
}: {
  items: NavItem[];
  current: PageKey;
  onNav: (key: PageKey) => void;
  role: Role;
  profileName: string;
  onSignOut: () => void;
}) {
  return (
    <>
      {/* ===================================================
          LOGO
      =================================================== */}

      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-200 dark:border-slate-800">

        <div className="p-1.5 rounded-lg bg-red-600">
          <Satellite className="w-5 h-5 text-white" />
        </div>

        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            MovSat OS
          </p>

          <p className="text-[10px] text-slate-400">
            Gestão Operacional
          </p>
        </div>

      </div>

      {/* ===================================================
          MENU
      =================================================== */}

      <nav className="flex-1 overflow-y-auto px-3 py-3">

        {navGroups.map((group) => {

          const groupItems = items.filter((item) =>
            group.keys.includes(item.key)
          );

          if (groupItems.length === 0) {
            return null;
          }

          return (
            <div
              key={group.title}
              className="mb-4"
            >

              <p className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 px-3 pb-1 tracking-wider">
                {group.title}
              </p>

              <div className="space-y-0.5">

                {groupItems.map((item) => {

                  const Icon = item.icon;
                  const active = current === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onNav(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
                        active
                          ? 'bg-red-600 text-white shadow-sm shadow-red-600/20'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >

                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          active
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                        }`}
                      />

                      <span className="flex-1 text-left truncate">
                        {item.label}
                      </span>

                      {active && (
                        <ChevronRight className="w-3.5 h-3.5 text-white" />
                      )}

                    </button>
                  );
                })}

              </div>
            </div>
          );
        })}

      </nav>

      {/* ===================================================
          USUÁRIO
      =================================================== */}

      <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800">

        <div className="flex items-center gap-2.5 px-2 py-2">

          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400 text-xs font-bold flex-shrink-0">
            {profileName
              ? profileName.charAt(0).toUpperCase()
              : 'U'}
          </div>

          <div className="flex-1 min-w-0">

            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {profileName || 'Usuário'}
            </p>

            <p className="text-xs text-slate-400">
              {roleLabels[role]}
            </p>

          </div>

        </div>

        <Button
          variant="ghost"
          className="w-full mt-1 justify-start text-xs"
          onClick={onSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>

      </div>
    </>
  );
}
