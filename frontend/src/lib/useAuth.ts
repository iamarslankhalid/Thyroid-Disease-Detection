import { createContext, useContext } from "react";
import type { User } from "../api";

export type AuthStatus = "loading" | "signed-in" | "signed-out";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (fullName: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Replace the cached user after a profile change. */
  setUser: (user: User) => void;
  /** Forget the session locally, e.g. after deleting the account. */
  clearSession: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
