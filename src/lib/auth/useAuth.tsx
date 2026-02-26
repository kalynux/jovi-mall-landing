"use client";
/**
 * AuthProvider + useAuth
 *
 * Mount <AuthProvider> ONCE at the root layout level.
 * Call useAuth() anywhere downstream — zero duplicate restoreSession() calls,
 * single source of truth, no external state library required.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthUser, AuthStatus, Role, AuthRoleEntity } from "./auth.types";
import { restoreSession } from "./auth.service";
import { logoutAndRedirect } from "./auth.service";

// ─── Shape ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** Null while loading or when unauthenticated. */
  user: AuthUser | null;
  role: Role | null;
  role_entity: AuthRoleEntity | null;
  status: AuthStatus;
  /**
   * Re-runs restoreSession() — call after login/register if you need the
   * Navbar to reflect the new user without a full page reload.
   * In the current flow this is rarely needed since auth actions redirect.
   */
  refresh: () => Promise<void>;
  /** Fires logoutAndRedirect() and clears local state immediately. */
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  role_entity: null,
  status: "loading",
  refresh: async () => {},
  logout: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [role_entity, setRoleEntity] = useState<AuthRoleEntity | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const restore = useCallback(async () => {
    const state = await restoreSession();
    setUser(state.user);
    setRole(state.role);
    setRoleEntity(state.role_entity);
    setStatus(state.status);
  }, []);

  // Run once on mount — never again unless refresh() is explicitly called.
  useEffect(() => {
    restore();
  }, [restore]);

  const logout = useCallback(async () => {
    // Optimistically clear state so Navbar reverts immediately
    setUser(null);
    setRole(null);
    setRoleEntity(null);
    setStatus("unauthenticated");
    await logoutAndRedirect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, role_entity, status, refresh: restore, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current auth state from the nearest <AuthProvider>.
 * Must be used inside a component tree that has <AuthProvider> as an ancestor.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
