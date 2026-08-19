import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NavProvider, useNav } from '@/contexts/NavContext';
import { LoginScreen } from '@/components/LoginScreen';
import { AppShell } from '@/components/AppShell';
import { ToastContainer } from '@/components/ToastContainer';
import { useToasts } from '@/lib/toast';
import { LoadingSpinner } from '@/components/ui';

import { Dashboard } from '@/pages/Dashboard';
import { Associados } from '@/pages/Associados';
import { Administrador } from '@/pages/Administrador';
import { Rastreadores } from '@/pages/Rastreadores';
import { OrdensServico } from '@/pages/OrdensServico';
import { Prestadores } from '@/pages/Prestadores';
import { Estoque } from '@/pages/Estoque';
import { Financeiro } from '@/pages/Financeiro';
import { BaseTecnica } from '@/pages/BaseTecnica';
import { Inteligencia } from '@/pages/Inteligencia';
import { Automacao } from '@/pages/Automacao';
import { Tarefas } from '@/pages/Tarefas';
import { Veiculos } from '@/pages/Veiculos';

import type { Role } from '@/types';

function PageRouter() {
  const { page } = useNav();
  const { profile } = useAuth();

  const role: Role = profile?.role || 'operador';

  const access: Record<string, Role[]> = {
    dashboard: ['operador', 'supervisor', 'diretoria', 'administrador'],
    associados: ['operador', 'supervisor', 'diretoria', 'administrador'],
    rastreadores: ['operador', 'supervisor', 'diretoria', 'administrador'],
    veiculos: ['operador', 'supervisor', 'diretoria', 'administrador'],
    ordens: ['operador', 'supervisor', 'diretoria', 'administrador'],
    prestadores: ['supervisor', 'diretoria', 'administrador'],
    estoque: ['operador', 'supervisor', 'diretoria', 'administrador'],
    financeiro: ['diretoria', 'administrador'],
    'base-tecnica': ['operador', 'supervisor', 'diretoria', 'administrador'],
    inteligencia: ['supervisor', 'diretoria', 'administrador'],
    automacao: ['supervisor', 'diretoria', 'administrador'],
    tarefas: ['operador', 'supervisor', 'diretoria', 'administrador'],
    administrador: ['administrador'],
  };

  const allowed =
    access[page] || [
      'operador',
      'supervisor',
      'diretoria',
      'administrador',
    ];

  if (!allowed.includes(role)) {
    return (
      <div className="flex items-center justify-center py-20 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
            Acesso Restrito
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Seu perfil não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  switch (page) {
    case 'dashboard':
      return <Dashboard />;
    case 'associados':
      return <Associados />;
    case 'rastreadores':
      return <Rastreadores />;
    case 'veiculos':
      return <Veiculos />;
    case 'ordens':
      return <OrdensServico />;
    case 'prestadores':
      return <Prestadores />;
    case 'estoque':
      return <Estoque />;
    case 'financeiro':
      return <Financeiro />;
    case 'base-tecnica':
      return <BaseTecnica />;
    case 'inteligencia':
      return <Inteligencia />;
    case 'automacao':
      return <Automacao />;
    case 'tarefas':
      return <Tarefas />;
    case 'administrador':
      return <Administrador />;
    default:
      return <Dashboard />;
  }
}

function AppContent() {
  const { session, profile, loading } = useAuth();
  const toastApi = useToasts();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <>
        <LoginScreen />
        <ToastContainer {...toastApi} />
      </>
    );
  }

  return (
    <NavProvider>
      <AppShell>
        <PageRouter />
      </AppShell>
      <ToastContainer {...toastApi} />
    </NavProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
