import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Edge Middleware — Protects /add-role and /auth-me.
 *
 * Strategy: check for the presence of EITHER cookie emitted by the backend:
 *   - access_token  (15 min JWT)
 *   - refresh_token (30 day rotation token)
 *
 * If both are absent the user has no session at all.
 * We do NOT decode or verify the JWT — that is the backend's responsibility.
 * The backend will reject expired/invalid tokens and return 401.
 *
 * SameSite=Lax cookies are included on same-site navigations and
 * cross-site top-level GET navigations, so this check works correctly.
 */
export function middleware(req: NextRequest) {
    const accessToken = req.cookies.get("access_token")?.value;
    const refreshToken = req.cookies.get("refresh_token")?.value;

    const hasSession = Boolean(accessToken || refreshToken);

    if (!hasSession) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("return", req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/add-role", "/auth-me"],
};
