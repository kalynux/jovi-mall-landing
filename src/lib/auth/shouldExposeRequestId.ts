import type { BackendErrorCode, ErrorCode } from "./backend-error-codes";
import { isOpaqueCategory, type ErrorCategory } from "./error-categories";

/**
 * **Fallback only** — used when a response carries no `error.category`.
 *
 * Since Phase 16 the category is the real rule: `internal` and
 * `external_service` are exactly the errors where the message is generic,
 * `details` is omitted, and the requestId is the only handle anyone has
 * (api-doc/errors/README.md). This hand-maintained set predates that field and
 * survives only for a response that has none — a proxy, or a pre-Phase-16
 * deploy.
 *
 * ⚠️  Do **not** grow this set as codes are added. It is known to disagree with
 *     the backend's own classification in places (the category is derived from
 *     `(code, statusCode)`, so a single code can be `external_service` at 5xx
 *     and something else at 4xx — a distinction a flat code set cannot make).
 *     Anything it gets wrong is corrected by the category branch below whenever
 *     one is present, which is every current response.
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
 * The client-side sentinels `"UNKNOWN_ERROR"` and `"NETWORK_ERROR"` are always
 * auto-exposed because the user cannot diagnose either one themselves. In
 * practice neither carries a requestId — a request that failed to reach the
 * server was never assigned one — so the caller renders nothing regardless;
 * they are classified here so the rule holds if that ever changes.
 *
 * @param code     - A BackendErrorCode or one of the client-side sentinels
 * @param category - The error envelope's nine-value category, when present.
 *                   This is the authoritative signal; `code` is the fallback.
 */
export function shouldExposeRequestId(
    code: ErrorCode | undefined,
    category?: ErrorCategory
): boolean {
    if (!code) return false;
    if (code === "UNKNOWN_ERROR" || code === "NETWORK_ERROR") return true;

    // The rule as the backend actually states it.
    if (category) return isOpaqueCategory(category);

    // No category on the response — fall back to the legacy code set.
    return SYSTEM_LEVEL_CODES.has(code as BackendErrorCode);
}
