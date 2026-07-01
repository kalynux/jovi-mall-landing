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
        /** WhatsApp phone number ID — set once the number is linked */
        wa_phone_id?: string;
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

// ─── WhatsApp Verification ───────────────────────────────────────────────────

/** Response from POST /auth/request-wa-verification */
export interface WaVerificationCodeResponse {
    /** Short numeric/alpha code the user must send */
    code: string;
    /** Full command string (e.g. "VERIFY abc123") */
    command: string;
    /** Direct WhatsApp deep-link including the pre-filled command */
    wa_link: string;
    /** Seconds until this code expires */
    expires_in_seconds: number;
    /** Human-readable instructions to display */
    instructions: string;
    /** Formatted WhatsApp bot number */
    bot_number?: string;
}

/** Response from GET /api/whatsapp/link/status */
export interface WaLinkStatusResponse {
    linked: boolean;
    /** Populated when linked — the linked phone number */
    phone?: string;
    /** Populated when linked — the WhatsApp phone ID */
    wa_phone_id?: string;
}

// ─── Post-Auth Action ────────────────────────────────────────────────────────

/**
 * Discriminated union returned by loginAndGetAction / switchRoleAndGetAction
 * / addRoleAndGetAction. The calling page uses it to decide whether to
 * navigate immediately or mount the WA verification modal.
 */
export type PostAuthAction =
    | { type: "redirect"; url: string }
    | { type: "wa_gate"; roleEntity: AuthRoleEntity; redirectUrl: string };

// ─── Backend error contract (api-doc/errors/README.md) ───────────────────────

/** Shape of a field entry inside VALIDATION_ERROR details.fields[] */
export interface ValidationFieldError {
    path: string;
    message: string;
    code: string;
}

/** Shape of the backend error envelope */
export interface ApiErrorBody {
    success: false;
    requestId: string;
    error: {
        code: string;
        message: string;
        statusCode: number;
        details?: {
            // VALIDATION_ERROR
            fields?: ValidationFieldError[];
            // DATABASE_UNIQUE_CONSTRAINT_VIOLATION
            keyValue?: Record<string, string>;
            // other contextual detail shapes (catalog, analytics, etc.)
            [key: string]: unknown;
        };
    };
}

// ─── Form Error Shape ───────────────────────────────────────────────────────

/**
 * Normalised form error structure used across all auth forms.
 *
 * - `global.message`   — translated global error text shown above the submit button
 * - `global.requestId` — optional support trace ID sourced from the API response envelope;
 *                        only present on non-field errors (per README best practice §3)
 * - `fields`           — per-field translated error messages keyed by field path
 */
export type FormErrors = {
    global?: {
        message: string;
        requestId?: string;
    };
    fields: Record<string, string | undefined>;
};

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Base error for any auth-related failure. Kept for backward compatibility. */
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

/**
 * Structured error thrown by apiFetch on !res.ok.
 * Carries the full backend error body so callers can map field/global errors
 * without re-parsing.
 * instanceof AuthError === true — all existing catch blocks remain valid.
 */
export class ApiError extends AuthError {
    constructor(
        message: string,
        statusCode: number,
        public readonly code: string,
        public readonly details?: ApiErrorBody["error"]["details"],
        /** Top-level requestId from the response envelope. Display to user for support tracing. */
        public readonly requestId?: string
    ) {
        super(message, statusCode);
        this.name = "ApiError";
    }
}
