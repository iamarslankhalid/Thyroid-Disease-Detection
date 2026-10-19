import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setToken, setUnauthorisedHandler, type User } from "../api";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? "loading" : "signed-out"));

  const clearSession = useCallback(() => {
    setToken(null);
    setUserState(null);
    setStatus("signed-out");
  }, []);

  useEffect(() => {
    setUnauthorisedHandler(clearSession);
    return () => setUnauthorisedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        setUserState(me);
        setStatus("signed-in");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        console.error("Could not restore session", error);
        clearSession();
      });
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login({ email, password });
    setToken(response.token);
    setUserState(response.user);
    setStatus("signed-in");
    return response.user;
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const response = await api.register({ full_name: fullName, email, password });
    setToken(response.token);
    setUserState(response.user);
    setStatus("signed-in");
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (error) {
      // The local session is dropped either way; a failed revoke only leaves
      // a token on the server that expires on its own.
      console.error("Sign-out request failed", error);
    }
    clearSession();
  }, [clearSession]);

  const setUser = useCallback((next: User) => setUserState(next), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout, setUser, clearSession }),
    [status, user, login, register, logout, setUser, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
