import type {
    AuthState,
    LoginPayload,
    RegisterPayload,
    AddRolePayload,
    AuthUser,
    RawAuthUser,
    Role,
    PostAuthAction,
} from "./auth.types";
import { AuthError } from "./auth.types";
import * as api from "./auth.api";

// ─── Normalization ───────────────────────────────────────────────────────────

/**
 * Converts the raw wire `data.user` object into the app-facing `AuthUser`.
 *
 * The backend returns `{ _id, login_phone, login_email, roles, status }` and
 * reports the active role in the sibling top-level `role` field — never on the
 * user object. This is the single place that reconciles the two.
 */
export function normalizeUser(raw: RawAuthUser, activeRole: Role): AuthUser {
    return {
        id: raw._id,
        phone: raw.login_phone,
        email: raw.login_email ?? undefined,
        roles: raw.roles,
        activeRole,
        status: raw.status,
    };
}
import {
    resolvePostLoginUrl,
    resolveOnboardingUrl,
    getRoleUrl,
} from "./auth.redirect";
import { requiresWaVerification } from "./wa-verification-gate";

// ─── Session Restore ─────────────────────────────────────────────────────────

/**
 * Verifies the current session by calling GET /api/auth/me.
 * Backend auto-refreshes access_token using refresh_token if expired.
 * Never throws — returns unauthenticated state on any failure.
 */
export async function restoreSession(): Promise<AuthState> {
    try {
        const { user, role, role_entity } = await api.getMe();
        return {
            user: normalizeUser(user, role),
            role,
            role_entity,
            status: "authenticated",
        };
    } catch (err) {
        if (err instanceof AuthError && err.statusCode === 401) {
            return { user: null, role: null, role_entity: null, status: "unauthenticated" };
        }
        // Network errors, 5xx, etc. — treat as unauthenticated (fail safe)
        console.error("[auth.service] restoreSession failed:", err);
        return { user: null, role: null, role_entity: null, status: "unauthenticated" };
    }
}

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Performs login and returns a `PostAuthAction`.
 *
 * - `{ type: "redirect", url }` → navigate immediately
 * - `{ type: "wa_gate", roleEntity, redirectUrl }` → mount WA modal first
 *
 * Throws ApiError / AuthError on login failure (handled by the calling form).
 */
export async function loginAndGetAction(
    payload: LoginPayload,
    returnParam?: string | null
): Promise<PostAuthAction> {
    const { role, role_entity } = await api.login(payload);
    const redirectUrl = resolvePostLoginUrl(role, returnParam);

    if (requiresWaVerification(role_entity)) {
        return { type: "wa_gate", roleEntity: role_entity, redirectUrl };
    }
    return { type: "redirect", url: redirectUrl };
}

/**
 * @deprecated Use loginAndGetAction() — this wrapper exists for backward
 * compatibility. It bypasses the WA gate and should not be used in new code.
 */
export async function loginAndRedirect(
    payload: LoginPayload,
    returnParam?: string | null
): Promise<void> {
    const { role } = await api.login(payload);
    const url = resolvePostLoginUrl(role, returnParam);
    window.location.href = url;
}

// ─── Register ────────────────────────────────────────────────────────────────

/**
 * Registers a new user and returns a `PostAuthAction`.
 *
 * - `{ type: "redirect", url }` → navigate immediately to onboarding
 * - `{ type: "wa_gate", roleEntity, redirectUrl }` → mount WA modal first
 *
 * Throws ApiError / AuthError on registration failure.
 */
export async function registerAndGetAction(
    payload: RegisterPayload
): Promise<PostAuthAction> {
    const { role, role_entity } = await api.register(payload);
    const redirectUrl = resolveOnboardingUrl(role as Exclude<Role, "admin">);

    if (requiresWaVerification(role_entity)) {
        return { type: "wa_gate", roleEntity: role_entity, redirectUrl };
    }
    return { type: "redirect", url: redirectUrl };
}

/**
 * @deprecated Use registerAndGetAction() — this wrapper exists for backward
 * compatibility. It bypasses the WA gate and should not be used in new code.
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
 * Adds a new role and returns:
 * - the updated user
 * - the new role
 * - a `PostAuthAction` indicating whether to redirect or show the WA gate
 *
 * Throws ApiError / AuthError on failure.
 */
export async function addRoleAndGetAction(payload: AddRolePayload): Promise<{
    user: AuthUser;
    newRole: Role;
    action: PostAuthAction;
}> {
    const { user, role, role_entity } = await api.addRole(payload);
    const redirectUrl = resolveOnboardingUrl(role as Exclude<Role, "admin">);

    const action: PostAuthAction = requiresWaVerification(role_entity)
        ? { type: "wa_gate", roleEntity: role_entity, redirectUrl }
        : { type: "redirect", url: redirectUrl };

    return { user: normalizeUser(user, role), newRole: role, action };
}

/**
 * @deprecated Use addRoleAndGetAction() — kept for backward compatibility.
 */
export async function addRoleFlow(payload: AddRolePayload): Promise<{
    user: AuthUser;
    newRole: Role;
}> {
    const { user, role } = await api.addRole(payload);
    return { user: normalizeUser(user, role), newRole: role };
}

/**
 * Redirects the user to a role's /onboarding after they confirm role switch.
 */
export function redirectToOnboarding(role: Role): void {
    window.location.href = getRoleUrl(role, "/onboarding");
}

// ─── Role Switch ─────────────────────────────────────────────────────────────

/**
 * Switches the active session role and returns a `PostAuthAction`.
 *
 * - `{ type: "redirect", url }` → navigate immediately
 * - `{ type: "wa_gate", roleEntity, redirectUrl }` → mount WA modal first
 *
 * Throws AuthError on failure.
 */
export async function switchRoleAndGetAction(role: Role): Promise<PostAuthAction> {
    const { role_entity } = await api.switchRole(role);
    const redirectUrl = getRoleUrl(role);

    if (requiresWaVerification(role_entity)) {
        return { type: "wa_gate", roleEntity: role_entity, redirectUrl };
    }
    return { type: "redirect", url: redirectUrl };
}

/**
 * @deprecated Use switchRoleAndGetAction() — kept for backward compatibility.
 */
export async function switchRoleAndRedirect(role: Role): Promise<void> {
    await api.switchRole(role);
    window.location.href = getRoleUrl(role);
}

// ─── Logout ──────────────────────────────────────────────────────────────────

/**
 * Logs out the user by instructing the backend to expire both cookies,
 * then redirects to the landing home page.
 */
export async function logoutAndRedirect(): Promise<void> {
    try {
        await api.logout();
    } catch {
        // Even if logout API fails, clear local state and redirect
    }
    window.location.href = "/";
}
