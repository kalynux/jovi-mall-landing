import type { UseFormSetError, FieldValues, Path } from "react-hook-form";
import type { BackendErrorCode, ErrorCode } from "./backend-error-codes";
import { ApiError } from "./auth.types";
import {
    errorCodeOf,
    translateCode,
    translateError,
    translateFieldCode,
} from "./error-translator";
import { isErrorCategory, type ErrorCategory } from "./error-categories";

/**
 * Translator function type — matches the signature returned by `useTranslations("errors")`.
 * Accepting this as a parameter keeps mapApiErrors decoupled from React hooks
 * and allows it to be called from any context (component, server action, test).
 */
type ErrorTranslator = (key: string) => string;

// ─── Root type encoding ───────────────────────────────────────────────────────
//
// RHF's FieldError.type is a plain string. We encode three pieces of data in it:
//
//   `${errorCode}|${requestId}|${category}`
//
// The pipe ( | ) is safe because:
//   - BackendErrorCode values are SCREAMING_SNAKE_CASE — no pipes
//   - requestId values are UUIDs / alphanumeric — no pipes
//   - ErrorCategory values are lowercase [a-z_] — no pipes
//
// Trailing empty segments are trimmed, so the common case stays a bare "CODE"
// and a two-segment "CODE|req" from before the category existed still decodes
// correctly. A category with no requestId encodes the middle slot as empty:
// "CODE||internal".
//
// Consumers call parseRootType() to recover all three without guessing.

const ROOT_TYPE_SEP = "|" as const;

/**
 * Encode an errorCode plus optional requestId and category into one root.type.
 * @internal Used by mapApiErrors only.
 */
function encodeRootType(
    errorCode: ErrorCode,
    requestId: string | undefined,
    category: ErrorCategory | undefined
): string {
    return [errorCode, requestId ?? "", category ?? ""]
        .join(ROOT_TYPE_SEP)
        .replace(/\|+$/, "");
}

/**
 * Decode the errorCode, requestId and category from a RHF root.type value.
 *
 * Returns `undefined` for any field the string does not carry.
 *
 * Usage in a page component:
 * ```tsx
 * const { errorCode, requestId, category } = parseRootType(
 *   errors.root?.type as string | undefined
 * );
 * ```
 */
export function parseRootType(raw: string | undefined): {
    errorCode: ErrorCode | undefined;
    requestId: string | undefined;
    category: ErrorCategory | undefined;
} {
    if (!raw) {
        return { errorCode: undefined, requestId: undefined, category: undefined };
    }

    // split() rather than indexOf(): the requestId sits between two separators,
    // so slicing at the FIRST pipe would fold the category into it.
    const [code, requestId, category] = raw.split(ROOT_TYPE_SEP);

    return {
        errorCode: (code || undefined) as ErrorCode | undefined,
        // `|| undefined` matters — the middle slot is legitimately empty when
        // there is a category but no requestId.
        requestId: requestId || undefined,
        category: isErrorCategory(category) ? category : undefined,
    };
}

/**
 * Maps a thrown API error to react-hook-form field/root errors.
 *
 * Contract alignment: api-doc/errors/README.md
 *
 * Translation strategy (code-driven, never message-string-dependent):
 *   - Global messages resolved via translateError(t, error) — code, then the
 *     category for the two opaque ones, then the backend message
 *   - Field errors translate using fieldError.code (Zod code), fallback to fieldError.message
 *   - root.type encodes "errorCode|requestId|category" for GlobalError to
 *     consume via parseRootType()
 *
 * Mapping rules:
 *   - VALIDATION_ERROR                    → details.fields[] → per-field setError(path)
 *   - DATABASE_UNIQUE_CONSTRAINT_VIOLATION → details.keyValue keys → per-field setError
 *   - everything else (domain/auth/server) → setError("root", { message, type: encoded })
 *   - unknown/non-ApiError shapes          → setError("root", { message: fallback })
 *
 * The generic constraint <T extends FieldValues> ensures the caller's form
 * type is respected. Unknown field paths from the backend are cast safely —
 * RHF will simply ignore fields that don't exist in the schema.
 *
 * @param error    - The caught error (may be ApiError or any unknown shape)
 * @param setError - RHF's setError function bound to the caller's form type
 * @param t        - `useTranslations("errors")` — centralises all i18n resolution here
 */
export function mapApiErrors<T extends FieldValues>(
    error: unknown,
    setError: UseFormSetError<T>,
    t: ErrorTranslator
): void {
    if (!(error instanceof ApiError)) {
        // Network failure, malformed body, or non-API throw. `errorCodeOf`
        // splits the two sentinels apart — see its doc comment for why that
        // distinction matters to the person reading the banner.
        //
        // No requestId and no category either way — a request that never
        // arrived was never assigned one, and never got an envelope back.
        setError("root" as Path<T>, {
            type: encodeRootType(errorCodeOf(error), undefined, undefined),
            message: translateError(t, error),
        });
        return;
    }

    switch (error.code) {
        case "VALIDATION_ERROR": {
            const fields = error.details?.fields;
            if (Array.isArray(fields) && fields.length > 0) {
                for (const fieldErr of fields) {
                    // Backend paths may be dot-notation like "user.email".
                    // Strip any leading segment prefix to get the flat field
                    // name used in the RHF schema.
                    const path = fieldErr.path.includes(".")
                        ? (fieldErr.path.split(".").pop() ?? fieldErr.path)
                        : fieldErr.path;

                    setError(path as Path<T>, {
                        // Translate the Zod code (e.g. "invalid_type", "custom"),
                        // falling back to the backend's per-field human message.
                        message: translateFieldCode(t, fieldErr.code, fieldErr.message),
                    });
                }
            } else {
                // Structural VALIDATION_ERROR but no fields array — treat as global
                setError("root" as Path<T>, {
                    type: encodeRootType(error.code, error.requestId, error.category),
                    message: translateError(t, error),
                });
            }
            break;
        }

        case "DATABASE_UNIQUE_CONSTRAINT_VIOLATION": {
            const keyValue = error.details?.keyValue;
            if (keyValue && typeof keyValue === "object") {
                // Map each conflicting key to its form field.
                for (const key of Object.keys(keyValue)) {
                    setError(key as Path<T>, {
                        message: translateCode(
                            t,
                            "DATABASE_UNIQUE_CONSTRAINT_VIOLATION",
                            error.message
                        ),
                    });
                }
            } else {
                setError("root" as Path<T>, {
                    type: encodeRootType(error.code, error.requestId, error.category),
                    message: translateError(t, error),
                });
            }
            break;
        }

        default:
            // Domain errors (AUTH_INVALID_CREDENTIALS, AUTH_TOKEN_EXPIRED, etc.)
            // and all unrecognised codes fall through here and go to the global slot.
            // root.type encodes "errorCode|requestId" for GlobalError.
            setError("root" as Path<T>, {
                type: encodeRootType(
                    error.code as BackendErrorCode,
                    error.requestId,
                    error.category
                ),
                message: translateError(t, error),
            });
    }
}
