"use client";
import { useEffect } from "react";
// Deliberately mismatched pair: the router is the locale-aware one, so a
// redirect from /fr/auth-me lands on /fr/login rather than the English page.
// The pathname is not — the `return` param has to carry the full prefixed path
// so the visitor comes back to the page they were actually on.
import { usePathname } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import type { AuthUser, AuthStatus, Role, AuthRoleEntity } from "./auth.types";
import { useAuth } from "./useAuth";
import { isShopPath } from "@/lib/shop/shop.routes";
import { IS_NATIVE_BUILD } from "@/lib/platform";

interface GuardResult {
    user: AuthUser | null;
    role: Role | null;
    role_entity: AuthRoleEntity | null;
    status: AuthStatus;
}

/**
 * Client-side route guard for auth-protected pages (/add-role, /auth-me, and
 * every `/shop/account/*` and `/shop/checkout` screen).
 *
 * If the session is over → redirects to /login?return=<current-path>.
 *
 * A session past the 90-day cap answers `401 AUTH_SESSION_CAP_REACHED`, which
 * `restoreSession` reports as signed-out like any other 401 — correct, and the
 * only correct handling: no credential the client holds can fix it, so the
 * sign-in page is the destination and a retry would loop.
 *
 * ── It reads the provider now; it does not verify on its own ─────────────────
 *
 * This used to call `restoreSession()` itself, in an effect keyed on
 * `[router, pathname]`. Two consequences, both bad. It issued a SECOND
 * `GET /auth/me` beside the one `AuthProvider` had already made — on every
 * mount and again on every navigation between account screens, so moving from
 * Orders to Addresses cost a round trip whose only job was to re-learn what the
 * provider already knew. And because it kept its own copy of the answer, a
 * request that merely failed to arrive was indistinguishable, here, from a
 * server that had ended the session — so it redirected, and that is the
 * "kicked out to the login page" report.
 *
 * `AuthProvider` is the one thing that asks, and it is the one thing that knows
 * the difference (see `SessionOutcome`). This hook now reads that state and
 * decides one thing: whether to leave. `status === "unauthenticated"` reaches
 * it only when the server actually said so, or when we have never managed to
 * ask at all — never because a single request was lost.
 *
 * Usage:
 *   const { user, role, role_entity, status } = useAuthGuard();
 *   if (status === 'loading') return <Spinner />;
 */
export function useAuthGuard(): GuardResult {
    const router = useRouter();
    const pathname = usePathname();
    const { user, role, role_entity, status } = useAuth();

    useEffect(() => {
        if (status !== "unauthenticated") return;

        const from = pathname ?? "/";
        // In the app a screen's subject is in its query string —
        // `/shop/account/ticket?id=…` — because the static export cannot address
        // it by path, and `usePathname()` carries no query. Without this, a
        // shopper sent to sign in from a support or order link came back to the
        // right screen with nothing on it. The web's paths already hold the id,
        // so the web keeps exactly the `return` it always sent.
        const query = IS_NATIVE_BUILD ? window.location.search : "";
        const returnPath = encodeURIComponent(`${from}${query}`);
        // Bounced out of the storefront — so the visitor is a shopper, and
        // `/login` can open on customer sign-in instead of asking which of four
        // roles they are. Everywhere else still asks.
        const roleParam = isShopPath(from) ? "&role=customer" : "";
        router.replace(`/login?return=${returnPath}${roleParam}`);
    }, [status, router, pathname]);

    return { user, role, role_entity, status };
}
