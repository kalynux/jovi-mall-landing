import type {
    LoginPayload,
    RegisterPayload,
    AddRolePayload,
    AuthApiResponse,
    Role,
    WaVerificationCodeResponse,
    WaLinkStatusResponse,
    BrowserRefreshResponse,
    MessageResponse,
} from "./auth.types";
import { apiFetch } from "@/lib/api/client";

// ─── Auth API ────────────────────────────────────────────────────────────────

/** POST /api/auth/login — backend sets access_token + refresh_token cookies */
export async function login(payload: LoginPayload): Promise<AuthApiResponse> {
    return apiFetch<AuthApiResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/** POST /api/auth/register — backend sets cookies */
export async function register(
    payload: RegisterPayload
): Promise<AuthApiResponse> {
    return apiFetch<AuthApiResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/** POST /api/auth/add-role — requires valid access_token or refresh_token cookie */
export async function addRole(
    payload: AddRolePayload
): Promise<AuthApiResponse> {
    return apiFetch<AuthApiResponse>("/api/auth/add-role", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/** GET /api/auth/me — validates session using cookies; backend auto-refreshes if needed */
export async function getMe(): Promise<AuthApiResponse> {
    return apiFetch<AuthApiResponse>("/api/auth/me");
}

/**
 * GET /api/auth/auth-me/:role
 * Switches the active session to the given role.
 * Backend re-issues cookies scoped to the new role.
 */
export async function switchRole(role: Role): Promise<AuthApiResponse> {
    return apiFetch<AuthApiResponse>(`/api/auth/auth-me/${role}`);
}

/**
 * POST /api/auth/logout
 * Instructs backend to expire both access_token and refresh_token cookies.
 */
export async function logout(): Promise<void> {
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
}

// ─── WhatsApp Verification API ────────────────────────────────────────────────

/**
 * POST /api/auth/request-wa-verification
 * Triggers the backend to send a verification command to the user's WhatsApp.
 * Returns the code, command string, deep-link, expiry, and instructions.
 *
 * @param updateOtherRoles - If true, marks ALL unverified role entities verified
 *                           once this number is successfully linked.
 */
export async function requestWaVerification(
    updateOtherRoles: boolean
): Promise<WaVerificationCodeResponse> {
    return apiFetch<WaVerificationCodeResponse>(
        "/api/auth/request-wa-verification",
        {
            method: "POST",
            body: JSON.stringify({ update_other_roles: updateOtherRoles }),
        }
    );
}

/**
 * GET /api/webhooks/whatsapp/link/status
 * Polls whether the authenticated user's WhatsApp number has been linked.
 * Returns { linked, wa_phone_id?, name?, bound_at? } — api-doc/whatsapp/README.md §2.
 *
 * The whole WhatsApp module is mounted under `/api/webhooks/whatsapp`; there is
 * **no `/api/whatsapp` prefix** (whatsapp/README.md:3-11). The two authenticated
 * link routes share that prefix with the public inbound webhook, which has one
 * useful consequence here: `/api/webhooks` is exempt from rate limiting
 * (rate-limits.md § "Never limited"), so the verification modal's poll never
 * spends the caller's 1200/min IP budget.
 */
export async function getWaLinkStatus(): Promise<WaLinkStatusResponse> {
    return apiFetch<WaLinkStatusResponse>("/api/webhooks/whatsapp/link/status");
}

// ─── Session / Email Verification API ─────────────────────────────────────────

/**
 * POST /api/auth/browser/refresh
 * Proactively issues a fresh access_token cookie from the refresh_token cookie.
 * Browser clients rarely need this (requireAuth silently refreshes), but it lets
 * a client refresh ahead of expiry. Bearer-only callers cannot use it.
 */
export async function browserRefresh(): Promise<BrowserRefreshResponse> {
    return apiFetch<BrowserRefreshResponse>("/api/auth/browser/refresh", {
        method: "POST",
    });
}

/**
 * POST /api/auth/send-email-verification
 * Sends a verification link to the email on the caller's current role entity.
 * userId + role are read from the JWT — no body required.
 */
export async function sendEmailVerification(): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/auth/send-email-verification", {
        method: "POST",
    });
}

/**
 * GET /api/auth/verify-email?token=...
 * Confirms an email address from the token embedded in the verification link.
 * Public endpoint — called by the /verify-email page when the user clicks through.
 */
export async function verifyEmail(token: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>(
        `/api/auth/verify-email?token=${encodeURIComponent(token)}`
    );
}
