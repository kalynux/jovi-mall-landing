import type { BackendErrorCode } from "./backend-error-codes";

/**
 * System-level error codes — errors where the user cannot take a corrective
 * action and where a requestId is directly useful for support escalation.
 *
 * Classification criteria (from api-doc/errors/README.md):
 *   - Server or infrastructure failures (5xx equivalent)
 *   - Database unreachability / connection failures
 *   - Misconfiguration codes that signal a platform-level problem
 *   - Codes that imply no user-actionable resolution
 *
 * All other codes are user-actionable (credential errors, validation errors,
 * duplicate field errors, not-found on resources the user controls, etc.)
 * and should NOT auto-expose requestId — a manual toggle is available instead.
 *
 * ⚠️  Maintain this set whenever new codes are added to BackendErrorCode.
 *     Any code NOT in this set will default to the toggle-only behaviour.
 */
const SYSTEM_LEVEL_CODES = new Set<BackendErrorCode>([
    // ─── Core infrastructure ─────────────────────────────────────────────────
    "INTERNAL_SERVER_ERROR",

    // ─── Database connectivity ────────────────────────────────────────────────
    "DATABASE_UNAVAILABLE",
    "DATABASE_CONNECTION_ERROR",

    // ─── Misconfiguration (always platform-side, never user-actionable) ───────
    "CONFIG_MISSING_WA_ACCESS_TOKEN",
    "CONFIG_MISSING_WA_PHONE_ID",
    "CONFIG_MISSING_STORAGE_PROVIDER",
    "CONFIG_INVALID_STORAGE_PROVIDER",

    // ─── Mail infrastructure ──────────────────────────────────────────────────
    "MAIL_TEMPLATE_NOT_FOUND",

    // ─── Storage infrastructure ───────────────────────────────────────────────
    // STORAGE_UPLOAD_FAILED can be transient (network) but is always platform-side
    "STORAGE_UPLOAD_FAILED",
    "STORAGE_DELETE_FAILED",

    // ─── Booking — sync failures (platform integration, not user error) ───────
    "BOOKING_CALENDAR_SYNC_FAILED",

    // ─── Payment — initiation failure (gateway-side, not user error) ─────────
    "PAYMENT_INITIATION_FAILED",
    "PAYMENT_VERIFICATION_FAILED",
    "PAYMENT_WEBHOOK_INVALID_PAYLOAD",
    "PAYMENT_GATEWAY_NOT_IMPLEMENTED",

    // ─── WhatsApp provider rejections (platform-side) ────────────────────────
    "WHATSAPP_PROVIDER_REJECTED",

    // ─── Command registry (internal) ─────────────────────────────────────────
    "COMMAND_ALREADY_REGISTERED",

    // ─── Google OAuth infrastructure (missing credentials / key errors) ───────
    "GOOGLE_MISSING_CLIENT_ID",
    "GOOGLE_MISSING_CLIENT_SECRET",
    "GOOGLE_MISSING_REDIRECT_URI",
    "GOOGLE_TOKEN_ENCRYPTION_KEY_MISSING",
]);

/**
 * Returns `true` when a `requestId` should be displayed **automatically**
 * (inline, without requiring user interaction) for a given error code.
 *
 * Auto-expose → system/infrastructure errors where support tracing is
 *               the only remedy available to the user.
 *
 * Toggle-only → all user-actionable errors (wrong password, email taken,
 *               validation failures, not-found on own resources…).
 *
 * The sentinel value `"UNKNOWN_ERROR"` (used for non-ApiError throws such as
 * network failures or malformed responses) is always auto-exposed because
 * the user cannot diagnose the problem themselves.
 *
 * @param code - A BackendErrorCode or the special sentinel "UNKNOWN_ERROR"
 */
export function shouldExposeRequestId(
    code: BackendErrorCode | "UNKNOWN_ERROR" | undefined
): boolean {
    if (!code) return false;
    if (code === "UNKNOWN_ERROR") return true;
    return SYSTEM_LEVEL_CODES.has(code as BackendErrorCode);
}
