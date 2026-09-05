/**
 * Which app a confirmation link came from — the `?app=` half of the two
 * email-token routes this site hosts on behalf of every dashboard.
 *
 * ── Why the landing owns these pages at all ──────────────────────────────────
 *
 * Both confirmation links are built from a single backend environment variable
 * (`STOREFRONT_URL`), with no role branch:
 *
 *   {STOREFRONT_URL}/account/confirm-email?token=…   login-email change
 *   {STOREFRONT_URL}/verify-email?token=…            registration verification
 *
 * So a vendor, an agency and an agent all land here. That is correct rather
 * than accidental: `POST /api/auth/email-change/confirm` reads no `req.auth`
 * and takes no actor — it resolves the account from the SHA-256 of the token
 * and then syncs the new address onto *every* role profile the account holds.
 * The confirmation is genuinely role-free, so one page can serve all four apps.
 *
 * ── What the role IS still needed for: the way out ───────────────────────────
 *
 * The confirm response carries `{ email }` and nothing else — no role. Without
 * a hint, this site can only offer its own storefront links, which is the wrong
 * destination for three of the four audiences. So the backend stamps the
 * requesting role into the link at request time (the request half, `PATCH
 * /api/me/email`, is authenticated and knows the actor) and this module reads
 * it back.
 *
 * ⚠ **Role, not URL, and that is the security property.** `?app=vendor` is a
 * key into a compile-time map; an unrecognised value resolves to `null` and the
 * page falls back to its own links. A `?return=<url>` parameter would be an
 * open redirect on a page reachable without a session — `validateReturnUrl`
 * exists for the cases that genuinely need one, and this is not one of them.
 *
 * ⚠ **The hint is advisory.** Links already sitting in inboxes carry no `app=`,
 * and an account can hold several roles anyway, so every caller must render
 * something sensible when this returns `null`.
 */
import type { Role } from "@/lib/auth/auth.types";
import { getRoleUrl } from "@/lib/auth/auth.redirect";

/**
 * The four audiences a confirmation link can be sent to.
 *
 * `admin` is deliberately absent: it has no announced host (see the note on
 * `ROLE_SUBDOMAIN_MAP`), so stamping it would produce a link to a guess.
 */
const ORIGIN_ROLES = ["customer", "vendor", "agency", "agent"] as const;

export type OriginRole = (typeof ORIGIN_ROLES)[number];

/** The query parameter the backend appends. One name, used by both routes. */
export const ORIGIN_PARAM = "app";

/**
 * Read the origin hint, accepting only an exact member of the enum.
 *
 * Anything else — absent, misspelled, a URL somebody pasted in — is `null`, and
 * `null` is a supported state rather than an error: every link minted before
 * the backend started stamping this lands here.
 */
export function parseOriginRole(raw: string | null | undefined): OriginRole | null {
    return ORIGIN_ROLES.includes(raw as OriginRole) ? (raw as OriginRole) : null;
}

/**
 * Where a returning user should be sent, for an origin that is not this site.
 *
 * The **app root**, not a deep link into its settings screen. Each dashboard
 * routes its own root, whereas a settings path is a detail this repo cannot
 * verify and would silently rot into a 404 the day the other app reorganises.
 * The person has just finished the flow; landing them signed-in at home is the
 * whole requirement.
 *
 * Returns `null` for `customer`, because this site *is* the customer app —
 * callers link internally with `@/i18n/navigation`'s `Link` so the locale
 * prefix and the native build's in-app routing both keep working, neither of
 * which an absolute URL would do.
 */
export function originAppUrl(role: OriginRole | null): string | null {
    if (!role || role === "customer") return null;
    return getRoleUrl(role as Role);
}
