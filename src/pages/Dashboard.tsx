import { useAuth } from '@/contexts/AuthContext';
import { SupervisorDashboard } from '@/pages/SupervisorDashboard';
import { DiretoriaDashboard } from '@/pages/DiretoriaDashboard';
import { OperadorDashboard } from '@/pages/OperadorDashboard';

export function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role;

  if (role === 'diretoria' || role === 'administrador') return <DiretoriaDashboard />;
  if (role === 'operador') return <OperadorDashboard />;
  return <SupervisorDashboard />;
}
