"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AuthUser, AuthStatus, Role, AuthRoleEntity } from "./auth.types";
import { restoreSession } from "./auth.service";

interface GuardResult {
    user: AuthUser | null;
    role: Role | null;
    role_entity: AuthRoleEntity | null;
    status: AuthStatus;
}

/**
 * Client-side route guard for auth-protected pages (/add-role, /auth-me).
 *
 * On mount, it verifies the session via GET /api/auth/me.
 * If the user is unauthenticated, redirects to /login?return=<current-path>.
 *
 * Usage:
 *   const { user, role, role_entity, status } = useAuthGuard();
 *   if (status === 'loading') return <Spinner />;
 */
export function useAuthGuard(): GuardResult {
    const router = useRouter();
    const pathname = usePathname();
    const [state, setState] = useState<GuardResult>({
        user: null,
        role: null,
        role_entity: null,
        status: "loading",
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

            setState({ user: authState.user, role: authState.role, role_entity: authState.role_entity, status: authState.status });
        });

        return () => {
            cancelled = true;
        };
    }, [router, pathname]);

    return state;
}
