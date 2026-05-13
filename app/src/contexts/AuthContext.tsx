import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { authOperations } from '@/operations/authOperations';
import { setForceLogoutHandler } from '@/services/api';
import { pushService } from '@/services/pushService';
import { biometricService } from '@/services/biometricService';
import type {
  AuthState,
  LoginCredentials,
  RegisterCredentials,
} from '@/types';

interface AuthContextType extends AuthState {
  isInitializing: boolean;
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    credentials: RegisterCredentials,
  ) => Promise<{ success: boolean; error?: string; email?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  });
  const [isInitializing, setIsInitializing] = useState(true);

  const forceLogout = useCallback(() => {
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    setForceLogoutHandler(forceLogout);
    return () => setForceLogoutHandler(() => {});
  }, [forceLogout]);

  const checkAuth = useCallback(async () => {
    const result = await authOperations.checkAuthStatus();

    if (result.success && result.data) {
      // Se biometria está habilitada, exigir antes de liberar o app.
      // Falha → trata como sessão inválida (mantém token, mas força
      // novo login). Não removemos o token aqui pra o user poder
      // tentar novamente abrindo o app de novo.
      const requiresBio = await biometricService.isEnabled();
      if (requiresBio) {
        const ok = await biometricService.authenticate();
        if (!ok) {
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          setIsInitializing(false);
          return;
        }
      }

      setState({
        user: result.data.user,
        token: result.data.token,
        isAuthenticated: true,
        isLoading: false,
      });
      void pushService.register().catch(() => {});
    } else {
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
    setIsInitializing(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const result = await authOperations.performLogin(credentials);

    if (result.success && result.data) {
      setState({
        user: result.data.user,
        token: result.data.token,
        isAuthenticated: true,
        isLoading: false,
      });
      void pushService.register().catch(() => {});
      return { success: true };
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
      return { success: false, error: result.error };
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const result = await authOperations.performRegister(credentials);

    setState((prev) => ({ ...prev, isLoading: false }));

    if (result.success && result.data) {
      return { success: true, email: result.data.email };
    } else {
      return { success: false, error: result.error };
    }
  }, []);

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    await pushService.unregister().catch(() => {});
    await authOperations.performLogout();
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{ ...state, isInitializing, login, register, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
