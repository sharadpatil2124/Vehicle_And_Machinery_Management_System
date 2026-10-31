import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, SESSION_EXPIRED_EVENT } from '../api/client';
import { readSession, writeSession, clearSession } from '../api/session';

const AuthContext = createContext(null);

function toSession({ token, user, organization }) {
  return { token, user, organization };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [previousUserId, setPreviousUserId] = useState(null);

  const startSession = useCallback((payload) => {
    const next = toSession(payload);
    writeSession(next);
    setSession(next);
    setSessionExpired(false);
    return next;
  }, []);

  const updateSession = useCallback(
    (changes) => {
      if (!session) return;
      const next = toSession({ ...session, ...changes });
      writeSession(next);
      setSession(next);
    },
    [session]
  );

  const currentUserId = session?.user?.id ?? null;

  const endSession = useCallback(() => {
    setPreviousUserId(currentUserId);
    clearSession();
    setSession(null);
  }, [currentUserId]);

  useEffect(() => {
    function handleExpired() {
      setSessionExpired(true);
      endSession();
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
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
    setSessionExpired(false);
    endSession();
  }, [endSession]);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      organization: session?.organization ?? null,
      role: session?.user?.role ?? null,
      isAuthenticated: Boolean(session?.token),
      sessionExpired,
      previousUserId,
      signUp,
      logIn,
      logOut,
      updateSession,
    }),
    [session, sessionExpired, previousUserId, signUp, logIn, logOut, updateSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within <AuthProvider>');
  return context;
}
