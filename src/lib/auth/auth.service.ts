import type {
    AuthState,
    LoginPayload,
    RegisterPayload,
    AddRolePayload,
    AuthUser,
    RawAuthUser,
    Role,
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

// ─── Session Restore ─────────────────────────────────────────────────────────

/**
 * What asking the server about the session told us.
 *
 * ── Why "we could not ask" is its own answer ─────────────────────────────────
 *
 * This used to return a bare `AuthState`, and every failure — a 401, a 5xx, a
 * timed-out request, a phone that lost signal mid-call — collapsed into
 * `status: "unauthenticated"`. The comment called it "fail safe". For a
 * shopping session it is the opposite: `useAuthGuard` reads that status and
 * redirects, so one dropped request on a 3G connection took a signed-in shopper
 * to the sign-in page while their refresh token was good for another month.
 * That is the "logged out every few minutes" report.
 *
 * Only the server can end a session. If we could not reach it, we have learned
 * nothing, and the honest answer is `unreachable` — which the caller can
 * respond to by keeping the session it already has.
 */
export type SessionOutcome =
    /** The server answered, and the caller is signed in as this user. */
    | { kind: "session"; state: AuthState }
    /** The server answered, and the session is over. Only 401/403 lands here. */
    | { kind: "signed-out" }
    /** We never got a usable answer. Says nothing about the credential. */
    | { kind: "unreachable"; error: unknown };

/**
 * Verifies the current session by calling GET /api/auth/me.
 *
 * On the cookie path the backend silently refreshes the access cookie from the
 * refresh cookie, so an expired access token never surfaces here at all. On the
 * bearer path `lib/api/client.ts` rotates and retries, and throws `OfflineError`
 * rather than the original 401 when it could not complete that rotation — which
 * is what keeps a connectivity failure out of the `signed-out` branch below.
 *
 * Never throws.
 */
export async function restoreSession(): Promise<SessionOutcome> {
    try {
        const { user, role, role_entity } = await api.getMe();
        return {
            kind: "session",
            state: {
                user: normalizeUser(user, role),
                role,
                role_entity,
                status: "authenticated",
            },
        };
    } catch (err) {
        /**
         * 401 and 403 are the server's verdict on the credential, and the only
         * two that end a session.
         *
         * 403 belongs here beside 401 because a suspended or closed account
         * (`AUTH_ACCOUNT_SUSPENDED`, `AUTH_ACCOUNT_CLOSED`) answers 403, and
         * re-authenticating will not help — but neither will retrying, so
         * holding the session open would leave the shopper looking at a
         * storefront that refuses every action.
         */
        if (err instanceof AuthError && (err.statusCode === 401 || err.statusCode === 403)) {
            return { kind: "signed-out" };
        }

        // Everything else — `OfflineError`, a bare `TypeError` from fetch, a
        // 5xx, a timeout. The credential is untouched.
        if (process.env.NODE_ENV !== "production") {
            console.warn("[auth.service] could not verify the session:", err);
        }
        return { kind: "unreachable", error: err };
    }
}

// ─── Login ───────────────────────────────────────────────────────────────────

/**
 * Performs login and returns the URL to hand the browser.
 *
 * Every one of these used to return a two-armed `PostAuthAction`, because a
 * WhatsApp verification gate could interpose itself between authenticating and
 * arriving. That gate is gone — `POST /auth/request-wa-verification` was
 * deleted along with the whole per-role WhatsApp link surface, and connecting a
 * messaging account is no longer an auth concern at all
 * (api-doc/connections/README.md § "What was removed"). Signing in now has
 * exactly one outcome, so it returns exactly one thing.
 *
 * Throws ApiError / AuthError on login failure (handled by the calling form).
 */
export async function loginAndGetRedirect(
    payload: LoginPayload,
    returnParam?: string | null
): Promise<string> {
    const { role } = await api.login(payload);
    return resolvePostLoginUrl(role, returnParam);
}

// ─── Register ────────────────────────────────────────────────────────────────

/**
 * Registers a new user and returns the onboarding URL for the new role.
 *
 * Throws ApiError / AuthError on registration failure.
 */
export async function registerAndGetRedirect(
    payload: RegisterPayload
): Promise<string> {
    const { role } = await api.register(payload);
    return resolveOnboardingUrl(role as Exclude<Role, "admin">);
}

// ─── Add Role ────────────────────────────────────────────────────────────────

/**
 * Adds a new role and returns the updated user, the new role, and where to send
 * the browser once the caller has confirmed.
 *
 * Throws ApiError / AuthError on failure.
 */
export async function addRoleAndGetRedirect(payload: AddRolePayload): Promise<{
    user: AuthUser;
    newRole: Role;
    redirectUrl: string;
}> {
    const { user, role } = await api.addRole(payload);
    return {
        user: normalizeUser(user, role),
        newRole: role,
        redirectUrl: resolveOnboardingUrl(role as Exclude<Role, "admin">),
    };
}

/**
 * Redirects the user to a role's /onboarding after they confirm role switch.
 */
export function redirectToOnboarding(role: Role): void {
    window.location.href = getRoleUrl(role, "/onboarding");
}

// ─── Role Switch ─────────────────────────────────────────────────────────────

/**
 * Switches the active session role and returns that role's dashboard URL.
 *
 * Throws AuthError on failure.
 */
export async function switchRoleAndGetRedirect(role: Role): Promise<string> {
    await api.switchRole(role);
    return getRoleUrl(role);
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
    /**
     * `"/"` means two different things, and both are right.
     *
     * On the web it is the marketing home. In the app it is `out/index.html` —
     * the locale bootstrap `build-native.mjs` writes — which reads the stored
     * language and replaces itself with `/{locale}/shop/`.
     *
     * That bootstrap is why this is not `"/shop"`. The app build prefixes every
     * locale (there is no middleware on a device to rewrite an unprefixed path),
     * so `/shop` is a URL the export never wrote and a signed-out shopper would
     * land on a 404. Going through the bootstrap also re-resolves the language,
     * which is the correct behaviour for a session ending.
     */
    window.location.href = "/";
}
