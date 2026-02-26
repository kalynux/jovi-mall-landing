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

export interface AuthRoleEntity {
    _id: string;
    user_id: string;
    email: string | null;
    phone: string | null;
    business_name?: string | null;
    agency_name?: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    legit_verified: boolean;
    default_delivery_agency_id?: string | null;
    two_factor_enabled: boolean;
    version: number;
    timezone: string;
    status: string;
    created_at: string;
    updated_at: string;
    __v?: number;
    onboarding_step?: number;
    business_description?: string | null;
    country?: string | null;
    payout_details?: any | null;
    wa?: {
        verified: boolean;
    };
    notification_preferences?: {
        email: boolean;
        whatsapp: boolean;
        phone: boolean;
    };
    branding?: {
        logo_url: string | null;
        cover_image_url: string | null;
    };
    business_addresses?: any[];
    operating_hours?: any[];
    kyc_details?: {
        national_id_number: string | null;
        legit_verified: boolean;
    };
    social_links?: {
        instagram: string | null;
        facebook: string | null;
        twitter: string | null;
    };
    [key: string]: any;
}

// ─── Auth State ──────────────────────────────────────────────────────────────
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
    user: AuthUser | null;
    role: Role | null;
    role_entity: AuthRoleEntity | null;
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
    role: Role;
    role_entity: AuthRoleEntity;
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
