import type { ErrorCategory } from "./error-categories";

// ─── Roles ─────────────────────────────────────────────────────────────────
/** Full role type — includes all backend roles */
export type Role = "customer" | "vendor" | "agency" | "agent" | "admin";

/** Roles surfaced in public-facing UI pickers. Admin is excluded. */
export type UiRole = Exclude<Role, "admin">;

export const UI_ROLES: UiRole[] = ["vendor", "agency", "agent", "customer"];

/**
 * Narrows an untrusted value (a `?role=` query param, most often) to a UiRole.
 * Use this rather than re-spelling the role list — it had drifted into four
 * separate inline copies before.
 */
export function isUiRole(value: unknown): value is UiRole {
    return typeof value === "string" && (UI_ROLES as string[]).includes(value);
}

// ─── User ───────────────────────────────────────────────────────────────────

/**
 * Raw `data.user` object as returned on the wire by the auth endpoints
 * (`/auth/login`, `/auth/register`, `/auth/me`, `/auth/auth-me/:role`, …).
 *
 * The backend serialises the account document verbatim — note the `_id`,
 * `login_phone`, `login_email` field names. The active role is NOT on this
 * object; it is the sibling top-level `role` field of the response. Use
 * `normalizeUser()` (auth.service.ts) to convert this into the app-facing
 * `AuthUser` before storing it in state.
 */
export interface RawAuthUser {
    _id: string;
    login_phone: string;
    login_email?: string | null;
    roles: Role[];
    status: string;
    [key: string]: unknown;
}

/**
 * App-facing, normalized user shape.
 *
 * Derived from `RawAuthUser` + the response's top-level `role`. This is what
 * the AuthProvider/context exposes; components should read from here, never
 * from the raw wire object.
 */
export interface AuthUser {
    id: string;
    phone: string;
    email?: string;
    roles: Role[];
    /** The role this session is currently scoped to (from top-level `role`). */
    activeRole: Role;
    status?: string;
}

export interface AuthRoleEntity {
    _id: string;
    user_id: string;
    email: string | null;
    phone: string | null;
    /** Personal name for customer/agent/admin role entities. */
    name?: string | null;
    /**
     * Personal name for vendor/agency role entities — the equivalent of `name`.
     *
     * A vendor/agency profile holds only the *person's* name. Their BUSINESS
     * name lives on a separate document (Store for a vendor, Magazin for an
     * agency) and is therefore absent from `role_entity`; fetch it from the
     * store/magazin endpoints when you need it.
     */
    display_name?: string | null;
    /**
     * @deprecated Never returned by the auth endpoints — the vendor's business
     * name is `Store.name`. Kept only so legacy reads still type-check.
     */
    business_name?: string | null;
    /**
     * @deprecated Never returned by the auth endpoints — the agency's business
     * name is `Magazin.name`. Kept only so legacy reads still type-check.
     */
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
    notification_preferences?: {
        email: boolean;
        whatsapp: boolean;
        phone: boolean;
    };
    // ── Customer role_entity fields (api-doc/auth/README.md → role_entity Shapes) ──
    /** Renamed from avatar_url. */
    avatar?: string | null;
    bio?: string | null;
    /** Element shape is not documented in api-doc — narrow at the use site. */
    saved_addresses?: unknown[];
    preferences?: {
        language: string;
        currency: string;
        marketing_opt_in: boolean;
        ai_tone: string[];
        ads_compact_mode: boolean;
        compact_mode: boolean;
    };
    /**
     * Branding images are *attached files*, not raw URLs — the ids come from
     * POST /api/files/upload. Renamed from logo_url/cover_image_url
     * (api-doc/auth/README.md, Vendor role_entity + Onboarding step 3).
     */
    branding?: {
        logo_file_id: string | null;
        cover_image_file_id: string | null;
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
    /** The person's own name → role profile (`display_name` for vendor/agency). */
    name: string;
    password: string;
    role: UiRole;
    /** Vendor only. Seeds `Store.name`, not the vendor profile. 2–100 chars. */
    business_name?: string;
    /** Agency only. Seeds `Magazin.name`, not the agency profile. 2–100 chars. */
    agency_name?: string;
}

export interface AddRolePayload {
    role: UiRole;
    /** The person's own name → role profile (`display_name` for vendor/agency). */
    name?: string;
    /** Vendor only. Seeds `Store.name`, not the vendor profile. 2–100 chars. */
    business_name?: string;
    /** Agency only. Seeds `Magazin.name`, not the agency profile. 2–100 chars. */
    agency_name?: string;
}

// ─── API Response ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
    data?: T;
    message?: string;
    error?: string;
}

/**
 * Auth endpoint payload — the object that lives under `data` in the standard
 * `{ success, data, meta }` envelope (unwrapped by `apiFetch`). `user` is the
 * raw wire shape; the service layer normalizes it before it reaches state.
 */
export interface AuthApiResponse {
    user: RawAuthUser;
    role: Role;
    role_entity: AuthRoleEntity;
    message?: string;
}

// ─── Extra auth endpoint payloads ────────────────────────────────────────────

/** `data` payload of POST /auth/browser/refresh */
export interface BrowserRefreshResponse {
    user: { id: string; role: Role };
}

/**
 * `data` payload of POST /auth/send-email-verification and
 * GET /auth/verify-email — both return a single human-readable note.
 */
export interface MessageResponse {
    message: string;
}

// ─── Passwordless customer sign-in ───────────────────────────────────────────

/**
 * `data` payload of `POST /auth/magic/link` and `POST /auth/magic/code`.
 *
 * Deliberately narrower than `AuthApiResponse`: **there is no `role_entity`
 * here** (api-doc/auth/customer-auth.md § 2). A customer's `onboarding_step` is
 * capped at `0` by the schema, so the one thing the other endpoints return it
 * for — deciding between onboarding and the dashboard — has a constant answer.
 * Both routes set the same two HttpOnly cookies a password login does.
 */
export interface MagicSignInResponse {
    /** Always `"customer"` — no other role is reachable through the bot. */
    role: Role;
    user: RawAuthUser;
    /**
     * Present only on the bearer route, `/api/auth/mobile/magic/*`, which the
     * app calls because a WebView can hold no cookie. The website's route sets
     * two HttpOnly cookies and returns no tokens at all, so this is `undefined`
     * there — which is why `token-store.saveFromResponse` is safe to call on
     * both and the sign-in pages need no branch.
     */
    tokens?: TokenEnvelope;
}

/**
 * A token pair as `/api/auth/mobile/*` delivers it.
 *
 * The lifetimes are SECONDS, and they are the ones `jwt.sign` was actually
 * given rather than a second reading of the same environment variable — see
 * `tokenEnvelope` on the backend. We do not use them today: expiry is
 * discovered by the 401 that `apiFetch` retries, which is one source of truth
 * instead of two that can disagree across a clock skew.
 */
export interface TokenEnvelope {
    accessToken: string;
    refreshToken: string;
    accessExpiresIn: number;
    refreshExpiresIn: number;
}

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
        /**
         * The nine-value taxonomy — **always present** since Phase 16, on every
         * error from every backend service (api-doc/errors/README.md).
         *
         * Required here because that is the contract. `apiFetch` still
         * validates it at runtime, since it parses this shape out of an
         * untrusted body.
         */
        category: ErrorCategory;
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
        public readonly requestId?: string,
        /**
         * The nine-value taxonomy — the default branch for any code without
         * specific handling (api-doc/errors/README.md § "Best Practices" §3).
         *
         * Optional here, unlike on `ApiErrorBody`, because this class is built
         * from a parsed response: `undefined` means the body carried no valid
         * category, not that the contract permits its absence.
         */
        public readonly category?: ErrorCategory,
        /**
         * `Retry-After`, in seconds, when the response carried one.
         *
         * It is here because the body often cannot answer the same question.
         * The `rate_limit` category filters `details` down to a three-key
         * allowlist — `retryAfterSeconds`, `limit`, `windowSeconds` — and the
         * comparison, while it lower-cases and strips separators, still matches
         * whole words. So `COD_CODE_RESEND_TOO_SOON`, which is raised with
         * `{ retryInSeconds }`, arrives with **no `details` at all**: "in" is a
         * different word from "after", nothing survives the filter, and an empty
         * projection is omitted entirely rather than sent as `{}`.
         *
         * The header is the reliable channel, so it is read once here instead of
         * guessed at each call site.
         */
        public readonly retryAfterSeconds?: number
    ) {
        super(message, statusCode);
        this.name = "ApiError";
    }
}
