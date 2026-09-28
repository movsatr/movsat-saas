import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback,
} from 'react';

import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/types';
import { friendlyAuthError } from '@/lib/errors';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  passwordRecovery: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  updatePassword: (
    password: string
  ) => Promise<{ error: string | null }>;
  finishPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const loadProfile = useCallback(async (uid: string) => {
    console.log('MOVSAT AUTH: buscando profile:', uid);

    try {
      const query = supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout ao carregar profile'));
        }, 8000);
      });

      const { data, error } = await Promise.race([
        query,
        timeout,
      ]);

      if (error) {
        console.error(
          'MOVSAT AUTH: erro no profile:',
          error.message
        );
        return null;
      }

      console.log(
        'MOVSAT AUTH: profile carregado:',
        data
      );

      return data as Profile | null;
    } catch (error) {
      console.error(
        'MOVSAT AUTH: falha ao carregar profile:',
        error
      );

      return null;
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    console.log(
      'MOVSAT AUTH: iniciando autenticação...'
    );

    try {
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              'Timeout ao obter sessão do Supabase'
            )
          );
        }, 8000);
      });

      const sessionRequest =
        supabase.auth.getSession();

      const result = await Promise.race([
        sessionRequest,
        timeout,
      ]);

      const currentSession = result.data.session;

      console.log(
        'MOVSAT AUTH: sessão encontrada:',
        currentSession
      );

      setSession(currentSession);

      if (currentSession?.user) {
        const currentProfile = await loadProfile(
          currentSession.user.id
        );

        setProfile(currentProfile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error(
        'MOVSAT AUTH: erro na inicialização:',
        error
      );

      setSession(null);
      setProfile(null);
    } finally {
      console.log(
        'MOVSAT AUTH: finalizando loading'
      );

      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log(
          'MOVSAT AUTH EVENT:',
          event,
          currentSession?.user?.email
        );

        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          console.log(
            'MOVSAT AUTH: recuperação de senha detectada'
          );

          setPasswordRecovery(true);
        }

        setSession(currentSession);

        if (!currentSession?.user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        setTimeout(async () => {
          if (!mounted) return;

          const currentProfile =
            await loadProfile(
              currentSession.user.id
            );

          if (!mounted) return;

          setProfile(currentProfile);
          setLoading(false);
        }, 0);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [initializeAuth, loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      console.log(
        'MOVSAT AUTH: tentando login:',
        email
      );

      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        console.error(
          'MOVSAT AUTH: erro login:',
          error.message
        );

        return {
          error: friendlyAuthError(error),
        };
      }

      console.log(
        'MOVSAT AUTH: login realizado'
      );

      return {
        error: null,
      };
    },
    []
  );

  const updatePassword = useCallback(
    async (password: string) => {
      console.log(
        'MOVSAT AUTH: atualizando senha'
      );

      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        console.error(
          'MOVSAT AUTH: erro ao atualizar senha:',
          error.message
        );

        return {
          error: friendlyAuthError(error),
        };
      }

      console.log(
        'MOVSAT AUTH: senha atualizada com sucesso'
      );

      return {
        error: null,
      };
    },
    []
  );

  const finishPasswordRecovery = useCallback(() => {
    console.log(
      'MOVSAT AUTH: finalizando recuperação de senha'
    );

    setPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();

    setProfile(null);
    setSession(null);
    setPasswordRecovery(false);
    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        passwordRecovery,
        signIn,
        updatePassword,
        finishPasswordRecovery,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}

export function hasAccess(
  role: Role | null,
  allowed: Role[]
): boolean {
  if (!role) return false;

  return allowed.includes(role);
}