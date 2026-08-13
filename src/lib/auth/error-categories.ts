/**
 * The nine-value error taxonomy carried by every backend error response.
 *
 * Source of truth: api-doc/errors/README.md § "`error.category`" and
 * api-doc/README.md:63-67. New in Phase 16, emitted identically by all three
 * backend services (jovi-mall, wi-admin, geo-tracker).
 *
 * It exists so a client can behave sensibly about an error it has no specific
 * handling for — which is most of them. Branch on `code` when there is
 * something particular to do; fall back to `category` for everything else.
 *
 * ⚠️ The category is *derived* server-side from `(code, statusCode)`, so one
 * code can carry different categories at different statuses. Never build a
 * static code → category lookup on this side; read what the response sent.
 */
export const ERROR_CATEGORIES = [
    "authentication",
    "authorization",
    "validation",
    "not_found",
    "conflict",
    "business_rule",
    "rate_limit",
    "external_service",
    "internal",
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/**
 * Runtime guard — the category arrives on an untrusted JSON body, and a
 * response from a proxy or an older backend may not carry one at all.
 */
export function isErrorCategory(value: unknown): value is ErrorCategory {
    return (
        typeof value === "string" &&
        (ERROR_CATEGORIES as readonly string[]).includes(value)
    );
}

/**
 * The two categories whose `message` is deliberately opaque.
 *
 * On `internal` and `external_service` the backend replaces the message with a
 * generic sentence and omits `details` entirely — permanently, in every
 * environment (api-doc/errors/README.md § "Two categories are deliberately
 * opaque"). The text that arrives is the code's registry default, written for
 * an operator reading a log rather than for the person reading the banner, so
 * these are the two cases where localized category copy beats the backend
 * message. `requestId` is the only real handle either one leaves.
 */
export function isOpaqueCategory(category: ErrorCategory | undefined): boolean {
    return category === "internal" || category === "external_service";
}
