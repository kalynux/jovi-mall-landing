import type { UseFormSetError, FieldValues, Path } from "react-hook-form";
import type { BackendErrorCode, ErrorCode } from "./backend-error-codes";
import { ApiError } from "./auth.types";
import { translateCode, translateFieldCode } from "./error-translator";
import { isNetworkError } from "@/lib/errors/is-network-error";

/**
 * Translator function type — matches the signature returned by `useTranslations("errors")`.
 * Accepting this as a parameter keeps mapApiErrors decoupled from React hooks
 * and allows it to be called from any context (component, server action, test).
 */
type ErrorTranslator = (key: string) => string;

// ─── Root type encoding ───────────────────────────────────────────────────────
//
// RHF's FieldError.type is a plain string. We encode two pieces of data in it:
//
//   `${errorCode}|${requestId}`
//
// The pipe ( | ) is safe because:
//   - BackendErrorCode values are SCREAMING_SNAKE_CASE — no pipes
//   - requestId values are UUIDs / alphanumeric — no pipes
//
// Consumers call parseRootType() to recover both fields without guessing.

const ROOT_TYPE_SEP = "|" as const;

/**
 * Encode an errorCode and optional requestId into a single root.type string.
 * @internal Used by mapApiErrors only.
 */
function encodeRootType(
    errorCode: ErrorCode,
    requestId: string | undefined
): string {
    if (!requestId) return errorCode;
    return `${errorCode}${ROOT_TYPE_SEP}${requestId}`;
}

/**
 * Decode the errorCode and requestId from a RHF root.type value.
 *
 * Returns `undefined` for both if the string is absent or malformed.
 *
 * Usage in a page component:
 * ```tsx
 * const { errorCode, requestId } = parseRootType(errors.root?.type as string | undefined);
 * ```
 */
export function parseRootType(raw: string | undefined): {
    errorCode: ErrorCode | undefined;
    requestId: string | undefined;
} {
    if (!raw) return { errorCode: undefined, requestId: undefined };

    const sepIdx = raw.indexOf(ROOT_TYPE_SEP);

    if (sepIdx === -1) {
        // Only errorCode encoded (no requestId)
        return {
            errorCode: raw as ErrorCode,
            requestId: undefined,
        };
    }

    return {
        errorCode: raw.slice(0, sepIdx) as ErrorCode,
        requestId: raw.slice(sepIdx + 1) || undefined,
    };
}

/**
 * Maps a thrown API error to react-hook-form field/root errors.
 *
 * Contract alignment: api-doc/errors/README.md
 *
 * Translation strategy (code-driven, never message-string-dependent):
 *   - ALL messages resolved via translateCode(t, code, fallback)
 *   - Field errors translate using fieldError.code (Zod code), fallback to fieldError.message
 *   - Global errors translate using error.code, fallback to error.message
 *   - root.type encodes "errorCode|requestId" for GlobalError to consume via parseRootType()
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
        // Network failure, malformed body, or non-API throw.
        //
        // The two are split because they are different problems for the person
        // reading the banner: an unreachable server is something they can wait
        // out or fix by reconnecting, while UNKNOWN_ERROR is "we don't know".
        // Telling someone on a dropped connection that something unexpected
        // happened sends them looking for a mistake they did not make.
        //
        // No requestId either way — a request that never arrived was never
        // assigned one.
        const code = isNetworkError(error) ? "NETWORK_ERROR" : "UNKNOWN_ERROR";
        // Only used if the code has no translation; never shown for
        // NETWORK_ERROR, whose raw text is "Failed to fetch".
        const rawMessage = error instanceof Error ? error.message : undefined;

        setError("root" as Path<T>, {
            type: encodeRootType(code, undefined),
            message: translateCode(t, code, rawMessage),
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
                    type: encodeRootType(error.code, error.requestId),
                    message: translateCode(t, error.code, error.message),
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
                    type: encodeRootType(error.code, error.requestId),
                    message: translateCode(t, error.code, error.message),
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
                    error.requestId
                ),
                message: translateCode(t, error.code, error.message),
            });
    }
}
