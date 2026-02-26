// ─── Roles ─────────────────────────────────────────────────────────────────
/** Full role type — includes all backend roles */
export type Role = "customer" | "vendor" | "agency" | "agent" | "admin";

/** Roles surfaced in public-facing UI pickers. Admin is excluded. */
export type UiRole = Exclude<Role, "admin">;

export const UI_ROLES: UiRole[] = ["vendor", "agency", "agent", "customer"];

// ─── User ───────────────────────────────────────────────────────────────────
/** Shape returned by GET /api/auth/me */
export interface AuthUser {
    id: string;
    name: string;
    phone: string;
    email?: string;
    roles: Role[];
    /** The role this session is currently scoped to */
    activeRole: Role;
}

// ─── Auth State ──────────────────────────────────────────────────────────────
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
    user: AuthUser | null;
    status: AuthStatus;
}

// ─── API Payloads ────────────────────────────────────────────────────────────
export interface LoginPayload {
    identifier: string;
    password: string;
    role?: UiRole;
}

export interface RegisterPayload {
    phone: string;
    email?: string;
    name: string;
    password: string;
    role: UiRole;
    business_name?: string;
    agency_name?: string;
}

export interface AddRolePayload {
    role: UiRole;
    name?: string;
    business_name?: string;
    agency_name?: string;
}

// ─── API Response ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
    data?: T;
    message?: string;
    error?: string;
}

export interface AuthApiResponse {
    user: AuthUser;
    message?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────
export class AuthError extends Error {
    constructor(
        message: string,
        public readonly statusCode?: number,
        public readonly field?: string
    ) {
        super(message);
        this.name = "AuthError";
    }
}
