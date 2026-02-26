import type {
    AuthState,
    LoginPayload,
    RegisterPayload,
    AddRolePayload,
    AuthUser,
    Role,
} from "./auth.types";
import { AuthError } from "./auth.types";
import * as api from "./auth.api";
import {
    resolvePostLoginUrl,
    resolveOnboardingUrl,
    getRoleUrl,
} from "./auth.redirect";

// ─── Session Restore ─────────────────────────────────────────────────────────

/**
 * Verifies the current session by calling GET /api/auth/me.
 * Backend auto-refreshes access_token using refresh_token if expired.
 * Never throws — returns unauthenticated state on any failure.
 */
export async function restoreSession(): Promise<AuthState> {
    try {
        const user = await api.getMe();
        return { user, status: "authenticated" };
    } catch (err) {
        if (err instanceof AuthError && err.statusCode === 401) {
            return { user: null, status: "unauthenticated" };
        }
        // Network errors, 5xx, etc. — treat as unauthenticated (fail safe)
        console.error("[auth.service] restoreSession failed:", err);
        return { user: null, status: "unauthenticated" };
    }
}

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Performs login, then redirects the browser to the appropriate URL.
 * Respects a validated ?return= param.
 * Throws AuthError on failure (to be handled by the calling form).
 */
export async function loginAndRedirect(
    payload: LoginPayload,
    returnParam?: string | null
): Promise<void> {
    const { user } = await api.login(payload);
    const role = payload.role ?? (user.roles[0] as Role);
    const url = resolvePostLoginUrl(role, returnParam);
    window.location.href = url;
}

// ─── Register ────────────────────────────────────────────────────────────────

/**
 * Registers a new user, then redirects to the role's /onboarding route.
 * Throws AuthError on failure.
 */
export async function registerAndRedirect(
    payload: RegisterPayload
): Promise<void> {
    await api.register(payload);
    const url = resolveOnboardingUrl(payload.role);
    window.location.href = url;
}

// ─── Add Role ────────────────────────────────────────────────────────────────

/**
 * Adds a new role to the currently authenticated user.
 * Returns the updated user + the new role for the UI to prompt the user.
 * Throws AuthError on failure.
 */
export async function addRoleFlow(payload: AddRolePayload): Promise<{
    user: AuthUser;
    newRole: Role;
}> {
    const { user } = await api.addRole(payload);
    return { user, newRole: payload.role };
}

/**
 * Redirects the user to a role's /onboarding after they confirm role switch.
 */
export function redirectToOnboarding(role: Role): void {
    window.location.href = getRoleUrl(role, "/onboarding");
}

// ─── Role Switch ─────────────────────────────────────────────────────────────

/**
 * Switches the active session role and redirects to that role's subdomain.
 * Backend re-issues cookies scoped to the new role.
 * Throws AuthError on failure.
 */
export async function switchRoleAndRedirect(role: Role): Promise<void> {
    await api.switchRole(role);
    window.location.href = getRoleUrl(role);
}

// ─── Logout ──────────────────────────────────────────────────────────────────

/**
 * Logs out the user by instructing the backend to expire both cookies,
 * then redirects to /login.
 */
export async function logoutAndRedirect(): Promise<void> {
    try {
        await api.logout();
    } catch {
        // Even if logout API fails, clear local state and redirect
    }
    window.location.href = "/login";
}
