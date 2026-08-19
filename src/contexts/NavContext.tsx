import { createContext, useContext, useState, type ReactNode } from 'react';

export type PageKey =
  | 'dashboard'
  | 'associados'
  | 'rastreadores'
  | 'ordens'
  | 'prestadores'
  | 'estoque'
  | 'financeiro'
  | 'base-tecnica'
  | 'inteligencia'
  | 'automacao'
  | 'tarefas'
  | 'veiculos'
  | 'administrador'
  

interface NavState {
  page: PageKey;
  setPage: (p: PageKey) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const NavContext = createContext<NavState | undefined>(undefined);

export function NavProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <NavContext.Provider value={{ page, setPage, mobileOpen, setMobileOpen }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
