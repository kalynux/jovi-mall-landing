"use client";
import { useEffect, useState } from "react";
// Deliberately mismatched pair: the router is the locale-aware one, so a
// redirect from /fr/auth-me lands on /fr/login rather than the English page.
// The pathname is not — the `return` param has to carry the full prefixed path
// so the visitor comes back to the page they were actually on.
import { usePathname } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import type { AuthUser, AuthStatus, Role, AuthRoleEntity } from "./auth.types";
import { restoreSession } from "./auth.service";
import { requiresWaVerification } from "./wa-verification-gate";

interface GuardResult {
    user: AuthUser | null;
    role: Role | null;
    role_entity: AuthRoleEntity | null;
    status: AuthStatus;
    /**
     * True when the authenticated user's role entity has not completed
     * WhatsApp verification. Derived from `role_entity` via
     * `requiresWaVerification()` — no extra network call.
     *
     * Pages that use useAuthGuard should render <WhatsAppVerificationModal>
     * when this is true, preventing access to the page content.
     */
    waGateRequired: boolean;
}

/**
 * Client-side route guard for auth-protected pages (/add-role, /auth-me).
 *
 * On mount, verifies the session via GET /api/auth/me.
 * If unauthenticated → redirects to /login?return=<current-path>.
 * If authenticated but WA not verified → sets waGateRequired = true.
 *
 * Usage:
 *   const { user, role, role_entity, status, waGateRequired } = useAuthGuard();
 *   if (status === 'loading') return <Spinner />;
 *   if (waGateRequired && role_entity) return <WhatsAppVerificationModal ... />;
 */
export function useAuthGuard(): GuardResult {
    const router = useRouter();
    const pathname = usePathname();
    const [state, setState] = useState<GuardResult>({
        user: null,
        role: null,
        role_entity: null,
        status: "loading",
        waGateRequired: false,
    });

    useEffect(() => {
        let cancelled = false;

        restoreSession().then((authState) => {
            if (cancelled) return;

            if (authState.status === "unauthenticated") {
                const returnPath = encodeURIComponent(pathname ?? "/");
                router.replace(`/login?return=${returnPath}`);
                return;
            }

            const waGateRequired =
                authState.role_entity != null
                    ? requiresWaVerification(authState.role_entity)
                    : false;

            setState({
                user: authState.user,
                role: authState.role,
                role_entity: authState.role_entity,
                status: authState.status,
                waGateRequired,
            });
        });

        return () => {
            cancelled = true;
        };
    }, [router, pathname]);

    return state;
}
