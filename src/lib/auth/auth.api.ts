import type {
    LoginPayload,
    RegisterPayload,
    AddRolePayload,
    AuthApiResponse,
    AuthUser,
    Role,
} from "./auth.types";
import { AuthError } from "./auth.types";

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
        // empty body is fine for some responses
    }

    if (!res.ok) {
        throw new AuthError(
            (body?.message as string) ||
            (body?.error as string) ||
            `Request failed (${res.status})`,
            res.status
        );
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
export async function getMe(): Promise<AuthUser> {
    return apiFetch<AuthUser>("/api/auth/me");
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
