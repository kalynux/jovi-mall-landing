import type { Role, UiRole } from "./auth.types";
import { IS_NATIVE_BUILD } from "@/lib/platform";

// ─── Subdomain Map ──────────────────────────────────────────────────────────
/**
 * Production hosts, one per role. `wimall.com` belongs to another company —
 * the product ships on `wi-mall.com`, and the API lives at `api.wi-mall.com`
 * (see NEXT_PUBLIC_API_URL, not this map, which is browser destinations only).
 *
 * `admin` has no announced host yet; `admin.wi-mall.com` follows the pattern
 * and is what the allowlist below trusts. Confirm it before the admin app ships.
 */
export const ROLE_SUBDOMAIN_MAP: Record<Role, string> = {
    vendor: "vendor.wi-mall.com",
    agency: "agency.wi-mall.com",
    agent: "agent.wi-mall.com",
    customer: "wi-mall.com",
    admin: "admin.wi-mall.com",
} as const;

/**
 * Allowlist for the `?return=` query parameter.
 * Only URLs matching these hosts are considered safe redirect targets.
 */
export const ALLOWED_RETURN_HOSTS: string[] = [
    "wi-mall.com",
    "www.wi-mall.com",
    "vendor.wi-mall.com",
    "agency.wi-mall.com",
    "agent.wi-mall.com",
    "admin.wi-mall.com",
    "localhost",
    // Dev ports must cover every entry in DEV_PORT_MAP below, otherwise a valid
    // post-login return to a role's dev server is rejected as an open redirect.
    "localhost:3000", // customer
    "localhost:3001",
    "localhost:3002",
    "localhost:3003", // agent
    "localhost:3004", // admin
    "localhost:5173", // vendor
    "localhost:5174", // agency
];

// ─── URL Builders ───────────────────────────────────────────────────────────

/**
 * Returns the full https:// URL for a role's subdomain.
 * Falls back to localhost for local development.
 *
 * ── The native build must be answered before the dev check ───────────────────
 *
 * The `isDev` test below reads `window.location.hostname === "localhost"`, and a
 * Capacitor WebView reports exactly that: its origin is `https://localhost` on
 * Android and `capacitor://localhost` on iOS. Left alone, every destination on a
 * real phone would resolve to `http://localhost:3000` — a dev server on the
 * handset, which is nothing.
 *
 * So the app answers first, and it answers differently in kind: the customer
 * storefront is not a URL to navigate to, it is the app itself, so this returns
 * an in-app path. The other roles stay absolute — they are separate products on
 * separate hosts, and the caller opens them in the system browser rather than
 * steering the WebView out of its own origin.
 */
export function getRoleUrl(role: Role, path = ""): string {
    if (IS_NATIVE_BUILD) {
        if (role === "customer") return path || "/shop";
        return `https://${ROLE_SUBDOMAIN_MAP[role]}${path || ""}`;
    }

    const isDev =
        typeof window !== "undefined" && window.location.hostname === "localhost";

    if (isDev) {
        // In local dev, all subdomains collapse to localhost; use a port offset
        const DEV_PORT_MAP: Record<Role, number> = {
            customer: 3000,
            vendor: 5173,
            agency: 5174,
            agent: 3003,
            admin: 3004,
        };
        const port = DEV_PORT_MAP[role];
        return `http://localhost:${port}${path || ""}`;
    }

    const host = ROLE_SUBDOMAIN_MAP[role];
    return `https://${host}${path || ""}`;
}

/**
 * Validates a return URL against the allowlist to prevent open redirects.
 * Returns the validated URL, or null if the URL is unsafe.
 */
export function validateReturnUrl(rawUrl: string | null | undefined): string | null {
    if (!rawUrl) return null;

    try {
        // For relative paths (e.g. "/add-role") allow directly
        if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) {
            return rawUrl;
        }

        const url = new URL(rawUrl);

        const hostWithPort = url.port
            ? `${url.hostname}:${url.port}`
            : url.hostname;

        const isAllowed =
            ALLOWED_RETURN_HOSTS.includes(url.hostname) ||
            ALLOWED_RETURN_HOSTS.includes(hostWithPort);

        if (!isAllowed) return null;
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;

        return url.toString();
    } catch {
        return null;
    }
}

/**
 * Resolves the post-login redirect URL.
 * Priority: validated ?return= param → role subdomain home
 */
export function resolvePostLoginUrl(
    role: Role,
    returnParam: string | null | undefined,
    path = ""
): string {
    const safeReturn = validateReturnUrl(returnParam);
    if (safeReturn) return safeReturn;
    return getRoleUrl(role, path);
}

/**
 * Resolves the post-register redirect to the role's /onboarding route.
 */
export function resolveOnboardingUrl(role: UiRole): string {
    return getRoleUrl(role, "/onboarding");
}
