"use client";
/**
 * useRoleCta
 *
 * Answers one question for a role CTA: given who is looking at this button,
 * where should it go?
 *
 *   logged out                     → /register?role=<id>  (lands on step 2)
 *   logged in, role not held       → /add-role?role=<id>
 *   logged in, role held + active  → that role's dashboard
 *   logged in, role held, inactive → switch the session, then the dashboard
 *
 * The switch path mirrors the role switcher at (auth)/auth-me/page.tsx: the
 * backend re-issues cookies for the new role, so the handoff must be a full
 * page load (window.location), not a client-side route change.
 *
 * `customer` is deliberately outside `CtaRole` — the customer CTA always opens
 * the WhatsApp bot popup and never navigates, so the type makes it impossible
 * to wire a customer button through the auth branch by mistake.
 */
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "./useAuth";
import { switchRoleAndGetRedirect } from "./auth.service";
import { getRoleUrl } from "./auth.redirect";
import type { UiRole } from "./auth.types";
import { translateError } from "./error-translator";

/** Roles that own a dashboard and can therefore be signed into. */
export type CtaRole = Exclude<UiRole, "customer">;

export type RoleCtaMode =
    /** Auth has not resolved yet. Resolves to the logged-out destination. */
    | "resolving"
    | "register"
    | "add-role"
    | "dashboard"
    | "switch";

export interface RoleCta {
    mode: RoleCtaMode;
    /** Locale-relative internal route for `register` / `add-role`; else null. */
    href: string | null;
    /** Cross-origin dashboard URL for `dashboard`; else null. */
    externalHref: string | null;
    /** Performs the switch-then-redirect for `switch`. No-op otherwise. */
    activate: () => void;
    /** True from the moment `activate()` fires until the page leaves. */
    pending: boolean;
    /** Translated failure message from a switch that did not go through. */
    error: string | null;
    /** True when the label should read "Go to <role> dashboard". */
    isDashboard: boolean;
}

/**
 * Signed-in visitor who does NOT hold this role.
 *
 * `/register` is wrong while a session cookie exists — the account already
 * exists, so the flow is "add a role to it". If that product decision changes,
 * this function is the only thing to edit.
 */
function missingRoleDestination(role: CtaRole): string {
    return `/add-role?role=${role}`;
}

/**
 * Page-wide single flight.
 *
 * `switchRole` makes the backend re-issue session cookies. Two switches racing
 * — a visitor clicks "Go to Vendor Dashboard", scrolls, clicks "Go to Agent
 * Dashboard" — can land the browser on one role's origin holding the other
 * role's cookies. Per-component state cannot see the other buttons, so the
 * guard has to live outside React. Nothing resets it on the success path: that
 * path ends in a full page load, which tears the module down anyway.
 */
const switchInFlight = { current: false };

/**
 * `resolving` intentionally resolves to the logged-out destination rather than
 * a loading state. These are marketing CTAs, several of them inside otherwise
 * fully server-rendered pages: the register label is what the crawler and the
 * large majority of visitors should see, and a skeleton where the headline CTA
 * belongs would ship an empty call to action in the HTML.
 */
export function useRoleCta(role: CtaRole): RoleCta {
    const t = useTranslations("authMe");
    const tErrors = useTranslations("errors");
    const { user, role: activeRole, status } = useAuth();

    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mode: RoleCtaMode = useMemo(() => {
        if (status === "loading") return "resolving";
        if (status !== "authenticated" || !user) return "register";
        if (!user.roles.includes(role)) return "add-role";
        return activeRole === role ? "dashboard" : "switch";
    }, [status, user, role, activeRole]);

    const activate = useCallback(async () => {
        if (mode !== "switch" || switchInFlight.current) return;
        switchInFlight.current = true;
        setError(null);
        setPending(true);
        try {
            // Leave `pending` and the in-flight flag set — the page is on its
            // way out and re-enabling the button would only invite a second
            // switch during the navigation.
            window.location.href = await switchRoleAndGetRedirect(role);
        } catch (err) {
            switchInFlight.current = false;
            setPending(false);
            // `translateError` resolves the backend code/category against the
            // shared `errors` catalogue; `switchError` is the role-specific
            // last resort for a throw that carries neither.
            setError(translateError(tErrors, err, t("switchError")));
        }
    }, [mode, role, t, tErrors]);

    const isDashboard = mode === "dashboard" || mode === "switch";

    return {
        mode,
        href: isDashboard
            ? null
            : mode === "add-role"
                ? missingRoleDestination(role)
                : `/register?role=${role}`,
        // getRoleUrl() reads window.location, so it must never run during SSR.
        // `mode` is only ever "dashboard" after AuthProvider's mount effect has
        // resolved, which keeps this client-only by construction.
        externalHref: mode === "dashboard" ? getRoleUrl(role) : null,
        activate,
        pending,
        error,
        isDashboard,
    };
}
