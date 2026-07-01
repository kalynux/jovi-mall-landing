import type { Role, UiRole } from "./auth.types";

// ─── Subdomain Map ──────────────────────────────────────────────────────────
export const ROLE_SUBDOMAIN_MAP: Record<Role, string> = {
    vendor: "vendor.example.com",
    agency: "agency.example.com",
    agent: "agent.example.com",
    customer: "example.com",
    admin: "admin.example.com",
} as const;

/**
 * Allowlist for the `?return=` query parameter.
 * Only URLs matching these hosts are considered safe redirect targets.
 */
export const ALLOWED_RETURN_HOSTS: string[] = [
    "example.com",
    "vendor.example.com",
    "agency.example.com",
    "agent.example.com",
    "admin.example.com",
    "localhost",
    "localhost:3000",
    "localhost:3001",
    "localhost:5173",
];

// ─── URL Builders ───────────────────────────────────────────────────────────

/**
 * Returns the full https:// URL for a role's subdomain.
 * Falls back to localhost for local development.
 */
export function getRoleUrl(role: Role, path = ""): string {
    console.log(role)
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
