'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth-storage';

interface AuthContextValue {
  user: api.AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<api.AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const existing = getToken();
    Promise.resolve(existing ? api.me(existing) : null)
      .then((currentUser) => {
        if (existing && currentUser) {
          setTokenState(existing);
          setUser(currentUser);
        }
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  function applyAuthResult(result: api.AuthResult) {
    setToken(result.accessToken);
    setTokenState(result.accessToken);
    setUser(result.user);
  }

  async function signIn(email: string, password: string) {
    const result = await api.signIn(email, password);
    applyAuthResult(result);
  }

  async function signUp(email: string, password: string) {
    const result = await api.signUp(email, password);
    applyAuthResult(result);
  }

  function signOut() {
    clearToken();
    setTokenState(null);
    setUser(null);
    router.push('/sign-in');
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
