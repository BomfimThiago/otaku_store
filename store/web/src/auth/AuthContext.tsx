import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { login as loginRequest, logout as logoutRequest, me, register as registerRequest } from '../api/client.js';
import type { LoginInput, RegisterInput, User } from '../api/types.js';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  register: (input: RegisterInput) => Promise<User>;
  login: (input: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    me()
      .then((result) => {
        if (cancelled) return;
        setUser(result);
      })
      .catch(() => {
        // Any failure (401 when logged out, network error, ...) just means
        // there is no active session — never throw out of this effect.
        if (cancelled) return;
        setUser(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input);
    setUser(result);
    return result;
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const result = await loginRequest(input);
    setUser(result);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, register, login, logout }),
    [user, loading, register, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
