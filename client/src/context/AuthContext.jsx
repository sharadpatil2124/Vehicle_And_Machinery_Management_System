import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, SESSION_EXPIRED_EVENT } from '../api/client';
import { readSession, writeSession, clearSession } from '../api/session';

const AuthContext = createContext(null);

function toSession({ token, user, organization }) {
  return { token, user, organization };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const startSession = useCallback((payload) => {
    const next = toSession(payload);
    writeSession(next);
    setSession(next);
    return next;
  }, []);

  const endSession = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, endSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, endSession);
  }, [endSession]);

  const signUp = useCallback(
    async (details) => startSession((await authApi.signUp(details)).data),
    [startSession]
  );

  const logIn = useCallback(
    async (credentials) => startSession((await authApi.logIn(credentials)).data),
    [startSession]
  );

  const logOut = useCallback(async () => {
    try {
      await authApi.logOut();
    } catch {
    }
    endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      organization: session?.organization ?? null,
      role: session?.user?.role ?? null,
      isAuthenticated: Boolean(session?.token),
      signUp,
      logIn,
      logOut,
    }),
    [session, signUp, logIn, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within <AuthProvider>');
  return context;
}
