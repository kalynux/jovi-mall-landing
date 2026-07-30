import type {
    LoginPayload,
    RegisterPayload,
    AddRolePayload,
    AuthApiResponse,
    Role,
    ApiErrorBody,
    WaVerificationCodeResponse,
    WaLinkStatusResponse,
    BrowserRefreshResponse,
    MessageResponse,
} from "./auth.types";
import { AuthError, ApiError } from "./auth.types";

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8022";

// ─── Helper ──────────────────────────────────────────────────────────────────
async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include", // always send both cookies
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
    });

    let body: Record<string, unknown> = {};
    try {
        body = await res.json();
    } catch {
        // empty body — fall through to generic error below
    }

    if (!res.ok) {
        // Try to conform to the structured backend error contract first.
        // See: api-doc/errors/README.md
        const structured = body as Partial<ApiErrorBody>;
        if (structured?.error?.code) {
            throw new ApiError(
                structured.error.message,
                structured.error.statusCode ?? res.status,
                structured.error.code,
                structured.error.details,
                structured.requestId  // propagate request trace ID for support display
            );
        }

        // Fallback for non-structured responses (network layer, proxies, etc.)
        throw new AuthError(
            (body?.message as string) ||
            (body?.error as string) ||
            `Request failed (${res.status})`,
            res.status
        );
    }

    // ── Success envelope unwrap ──────────────────────────────────────────────
    // Breaking change (api-doc/README.md, 2026-07-17): every endpoint now wraps
    // its payload in `{ success, data, meta }`. Callers want `data`, not the
    // envelope. We stay defensive: only unwrap when the standard envelope is
    // actually present (`success === true` and a `data` key exists — `data` may
    // legitimately be `null`, e.g. logout). Anything else (a bare body from a
    // provider webhook, a proxy, etc.) is returned as-is.
    const envelope = body as { success?: boolean; data?: unknown };
    if (
        envelope &&
        typeof envelope === "object" &&
        envelope.success === true &&
        "data" in envelope
    ) {
        return envelope.data as T;
    }

    return body as T;
}

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
 * GET /api/whatsapp/link/status
 * Polls whether the authenticated user's WhatsApp number has been linked.
 * Returns { linked, wa_phone_id?, name?, bound_at? } — api-doc/whatsapp/README.md §2,
 * which also confirms this path is on the `/api/whatsapp` router, NOT under `/webhooks/`.
 *
 * Envelope note: whatsapp/README.md shows a bare body, while api-doc/README.md
 * lists link-status among the endpoints moved to `{ success, data }` on 2026-07-17.
 * No code change needed either way — `apiFetch` unwraps only when the envelope is
 * actually present, so both shapes arrive here as `{ linked, ... }`.
 */
export async function getWaLinkStatus(): Promise<WaLinkStatusResponse> {
    return apiFetch<WaLinkStatusResponse>("/api/whatsapp/link/status");
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
