import type { BackendErrorCode } from "./backend-error-codes";

/**
 * Translate a backend error code to a localised string.
 *
 * Contract:
 *   1. If `t("errors.{code}")` resolves → return it (primary path)
 *   2. Else if `fallback` is provided    → return it (backend message)
 *   3. Else                              → return `t("errors.UNKNOWN_ERROR")`
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
 */
export function translateCode(
    t: (key: string, values?: Record<string, string>) => string,
    code: string | BackendErrorCode,
    fallback?: string
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

    if (fallback) return fallback;

    // Last resort: generic unknown error
    try {
        return t("UNKNOWN_ERROR");
    } catch {
        return "An unexpected error occurred. Please try again.";
    }
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
