import type { BackendErrorCode, ErrorCode } from "./backend-error-codes";
import { ApiError } from "./auth.types";
import { isOpaqueCategory, type ErrorCategory } from "./error-categories";
import { isNetworkError } from "@/lib/errors/is-network-error";

type Translator = (key: string, values?: Record<string, string>) => string;

/**
 * Translate a backend error code to a localised string.
 *
 * Contract:
 *   1. If `t("errors.{code}")` resolves          → return it (primary path)
 *   2. Else if `fallback` is provided            → return it (backend message)
 *   3. Else if `t("errors.category.{category}")` → return it (default branch)
 *   4. Else                                      → `t("errors.UNKNOWN_ERROR")`
 *
 * Steps 2 and 3 swap when the category is `internal` or `external_service` —
 * see the comment at the swap for why.
 *
 * `t` is the bound translator from `useTranslations("errors")`.
 *
 * Why a plain function instead of a hook:
 *   - Keeps translation logic decoupled from React rendering
 *   - Can be called anywhere (mapApiErrors, server actions, tests)
 *   - Components pass `t` in; they never implement fallback logic themselves
 *
 * @param t          - `useTranslations("errors")` result, bound to the caller's locale
 * @param code       - The backend error code (known or unknown string)
 * @param fallback   - Optional fallback string (typically `error.message` from backend)
 * @param category   - Optional nine-value category from the error envelope
 */
export function translateCode(
    t: Translator,
    code: string | BackendErrorCode,
    fallback?: string,
    category?: ErrorCategory
): string {
    // next-intl throws (in strict mode) or returns the key when a key is missing.
    // We use a try/catch to detect missing keys without needing to pre-enumerate
    // the full translation map at runtime.
    try {
        const translated = t(code as string);
        // next-intl returns the key itself when a message is not found in some
        // configurations. Treat a returned key equal to the code as a miss.
        if (translated && translated !== code) {
            return translated;
        }
    } catch {
        // Missing key — fall through
    }

    // On `internal` and `external_service` the backend replaces `message` with
    // the code's generic registry default and omits `details` entirely, in
    // every environment. That string is written for an operator reading a log,
    // so localized category copy beats it — this is the one place the category
    // outranks the message. On the other seven the message is real,
    // rule-specific copy ("Show `message`; it explains which rule"), and it
    // keeps winning.
    const opaque = isOpaqueCategory(category);

    if (!opaque && fallback) return fallback;

    if (category) {
        try {
            const key = `category.${category}`;
            const translated = t(key);
            if (translated && translated !== key) return translated;
        } catch {
            // Missing key — fall through
        }
    }

    if (fallback) return fallback;

    // Last resort: generic unknown error
    try {
        return t("UNKNOWN_ERROR");
    } catch {
        return "An unexpected error occurred. Please try again.";
    }
}

/**
 * The code to attribute to an arbitrary throw — `ApiError`'s own, or one of the
 * two client-side sentinels.
 *
 * Splitting network failures from unknown ones matters to the person reading
 * the banner: an unreachable server is something they can wait out or fix by
 * reconnecting, while `UNKNOWN_ERROR` is "we don't know". Telling someone on a
 * dropped connection that something unexpected happened sends them looking for
 * a mistake they did not make.
 */
export function errorCodeOf(error: unknown): ErrorCode {
    if (error instanceof ApiError) return error.code as ErrorCode;
    return isNetworkError(error) ? "NETWORK_ERROR" : "UNKNOWN_ERROR";
}

/**
 * Resolve any thrown value to localized user-facing copy.
 *
 * The ladder that four call sites were each spelling out by hand, in one place:
 *
 *   1. `errors.<CODE>`
 *   2. `errors.category.<category>` — only for the two opaque categories
 *   3. the backend `message`
 *   4. `errors.UNKNOWN_ERROR`
 *
 * A non-`ApiError` throw resolves to `errors.NETWORK_ERROR` when it looks like
 * a dropped connection, so a raw "Failed to fetch" is never shown; anything
 * else falls to `fallback`, then `errors.UNKNOWN_ERROR`.
 *
 * @param t        - `useTranslations("errors")` result
 * @param error    - The caught value, of any shape
 * @param fallback - Optional copy for an unidentifiable throw. Used *ahead* of
 *                   `UNKNOWN_ERROR`, because a caller that can name the failed
 *                   operation says more than the generic catch-all.
 */
export function translateError(
    t: Translator,
    error: unknown,
    fallback?: string
): string {
    if (error instanceof ApiError) {
        return translateCode(t, error.code, error.message, error.category);
    }

    // The raw message is deliberately not used: for a network failure it is
    // "Failed to fetch", which is worse than the copy the code resolves to.
    if (isNetworkError(error)) return translateCode(t, "NETWORK_ERROR");

    // Nothing identifiable. A caller-supplied fallback names the operation that
    // failed ("We couldn't switch your role"), which beats a generic catch-all
    // — so it wins here, unlike everywhere else in the ladder.
    return fallback ?? translateCode(t, "UNKNOWN_ERROR");
}

/**
 * Translate a field-level Zod/validation error code.
 *
 * Field errors from VALIDATION_ERROR use Zod's internal codes (e.g. "invalid_type",
 * "too_small") stored in `fieldError.code`. These codes live in the same `errors`
 * namespace under a `fields.` prefix, with fallback to the raw backend message.
 *
 * @param t        - `useTranslations("errors")` result
 * @param zodCode  - Zod issue code string (e.g. "invalid_type", "custom")
 * @param fallback - The backend's human-readable field message (used when no translation)
 */
export function translateFieldCode(
    t: (key: string) => string,
    zodCode: string,
    fallback: string
): string {
    try {
        const key = `fields.${zodCode}`;
        const translated = t(key);
        if (translated && translated !== key) {
            return translated;
        }
    } catch {
        // Missing key — fall through
    }

    // Field errors always have a backend message; fall back to it verbatim.
    return fallback;
}
