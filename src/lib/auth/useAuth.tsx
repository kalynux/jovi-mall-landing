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
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthUser, AuthStatus, Role, AuthRoleEntity } from "./auth.types";
import { restoreSession } from "./auth.service";
import { logoutAndRedirect } from "./auth.service";
import { hydrate as hydrateTokens } from "./token-store";
import { IS_NATIVE_BUILD, isNative } from "@/lib/platform";

/**
 * Floor between two foreground-triggered session checks.
 *
 * 30s is short enough that returning to the app after any real absence
 * re-verifies, and long enough that the burst of transitions a single user
 * action produces (keyboard, share sheet, in-app browser) costs one request
 * rather than several.
 */
const REVALIDATE_THROTTLE_MS = 30_000;

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
  /**
   * Fires logoutAndRedirect() and clears local state immediately. `to` is where
   * the page goes afterwards — a full, localised path; the home page if omitted.
   */
  logout: (to?: string) => Promise<void>;
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
    /**
     * ── `status` must ALWAYS leave "loading", whatever goes wrong ────────────
     *
     * Everything downstream treats "loading" as "ask again in a moment", and on
     * a device the splash screen is one of those things: it waits for the
     * session and hides when it resolves. So a throw anywhere in here used to
     * mean an app that sat on its own logo forever, with no error and no way
     * out.
     *
     * That was not hypothetical. `hydrateTokens()` reads Capacitor Preferences,
     * and a plugin-loading bug made every read reject (see
     * `lib/platform/storage.ts`). `restoreSession` has its own catch, so the
     * failure came from the line *before* it — which is exactly why the catch
     * belongs out here, around the whole sequence, rather than inside either
     * step.
     *
     * "Signed out" is the right answer to an unreadable session: there is no
     * credential we can prove, so behaving as though there is none is both
     * honest and recoverable — the shopper signs in again.
     */
    try {
      // Read the stored bearer pair into memory before the first request goes
      // out. A no-op on the web build, and the difference between a restored
      // session and a spurious "signed out" on the native one —
      // `restoreSession` calls `GET /auth/me`, which without a hydrated token
      // is just a 401.
      await hydrateTokens();

      const outcome = await restoreSession();

      if (outcome.kind === "session") {
        setUser(outcome.state.user);
        setRole(outcome.state.role);
        setRoleEntity(outcome.state.role_entity);
        setStatus(outcome.state.status);
        return;
      }

      if (outcome.kind === "signed-out") {
        setUser(null);
        setRole(null);
        setRoleEntity(null);
        setStatus("unauthenticated");
        return;
      }

      /**
       * ── "unreachable": keep what we have ───────────────────────────────────
       *
       * The server never told us the session ended, so we do not act as though
       * it did. This is the branch that fixes the reported bug: a revalidation
       * that fails because the phone lost signal for a moment used to overwrite
       * a perfectly good session with "signed out", and `useAuthGuard` then
       * redirected to the sign-in page.
       *
       * `setStatus` with the value it already holds is a no-op in React, so a
       * shopper mid-checkout sees nothing happen at all — which is the point.
       *
       * The cold-start case is the one exception: there is no earlier session to
       * keep, and something has to leave `"loading"` or the native splash waits
       * on it (see `NativeShell`). "Signed out" is the only honest answer when
       * we have never successfully asked — and it is recoverable, because the
       * stored credential is still there for the next attempt.
       */
      setStatus((current) => (current === "loading" ? "unauthenticated" : current));
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[auth] session restore failed, treating as signed out:", err);
      }
      setUser(null);
      setRole(null);
      setRoleEntity(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  /**
   * Re-check the session when the app comes back to the foreground.
   *
   * ── Why this exists ──────────────────────────────────────────────────────
   *
   * The session used to be resolved once, on mount, and never again. In a
   * browser tab that is nearly always enough — a tab that has been open for
   * hours is still holding the same cookies. In the app it is not: Android
   * reclaims a backgrounded WebView, and what the shopper experiences on
   * returning is the app deciding what it thinks about their session at the
   * worst possible moment. Re-asking on resume is what makes the account
   * "already loaded" when they open the app, which is the behaviour asked for.
   *
   * It also recovers the one case the `unreachable` branch above deliberately
   * leaves signed-out: a cold start with no connection. The shopper walks back
   * into signal, the app foregrounds, this fires, and the session comes back
   * with no sign-in.
   *
   * ── Throttled, because "resume" fires more often than you think ───────────
   *
   * A permission dialog, the share sheet, the in-app browser closing and the
   * keyboard opening all produce a foreground transition. Without the floor
   * below, a shopper tapping through checkout would fire `GET /auth/me` a dozen
   * times a minute — and on the API that route is IP-scoped at 300/min, shared
   * with everyone behind the same carrier NAT.
   */
  const lastCheck = useRef(0);

  const revalidate = useCallback(() => {
    const now = Date.now();
    if (now - lastCheck.current < REVALIDATE_THROTTLE_MS) return;
    lastCheck.current = now;
    void restore();
  }, [restore]);

  useEffect(() => {
    // The web half. `visibilitychange` covers a backgrounded tab returning, and
    // it fires in the WebView too — but not for an Android app resumed from the
    // task switcher, which is why the native listener below is not redundant.
    const onVisible = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [revalidate]);

  useEffect(() => {
    if (!IS_NATIVE_BUILD || !isNative()) return;

    let remove: (() => void) | undefined;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) revalidate();
      });
      remove = () => void handle.remove();
    })();

    return () => remove?.();
  }, [revalidate]);

  const logout = useCallback(async (to?: string) => {
    // Optimistically clear state so Navbar reverts immediately
    setUser(null);
    setRole(null);
    setRoleEntity(null);
    setStatus("unauthenticated");

    /**
     * Withdraw this device from push before the session ends.
     *
     * Not cosmetic: the token is registered against the USER, so a phone that
     * keeps it after sign-out delivers this shopper's order updates to whoever
     * holds the phone next. Only the device knows its own token, so no amount
     * of server-side tidying can do this instead.
     *
     * Imported dynamically inside the compile-time guard so the web build never
     * pulls the native module or the device registry in — this hook is mounted
     * on every marketing page too.
     */
    if (IS_NATIVE_BUILD) {
      try {
        const { disablePush } = await import("@/lib/native/push");
        await disablePush();
      } catch {
        // Never block a sign-out on it. A token the backend keeps is pruned
        // when FCM rejects it on the next send.
      }
    }

    await logoutAndRedirect(to);
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
