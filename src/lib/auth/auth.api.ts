import type {
    LoginPayload,
    RegisterPayload,
    AddRolePayload,
    AuthApiResponse,
    Role,
    BrowserRefreshResponse,
    MagicSignInResponse,
    MessageResponse,
} from "./auth.types";
import { AuthError } from "./auth.types";
import { apiFetch } from "@/lib/api/client";
import { USES_BEARER_AUTH, saveFromResponse, clear as clearTokens } from "./token-store";

// ─── Which namespace issues this session ─────────────────────────────────────
/**
 * `/api/auth/*` sets cookies; `/api/auth/mobile/*` returns the same pair in
 * `data.tokens` and sets nothing. Same `AuthService`, same JWTs, same lifetimes,
 * same error codes — only the delivery differs, which is why one constant can
 * switch between them.
 *
 * ⚠️ **Only the four session-minting routes have a twin.** Everything below this
 * block — `me`, `logout`, email verification, password reset — is deliberately
 * on the shared path: those either read a credential the bearer already
 * satisfies, or take one in the body. Do not widen this prefix into a blanket
 * rewrite; `/api/auth/mobile/me` does not exist.
 */
const SESSION_NS = USES_BEARER_AUTH ? "/api/auth/mobile" : "/api/auth";

/**
 * Store the pair out of a session-minting response, then hand the response on.
 *
 * A browser response carries no `tokens` block and this is a no-op for it, so
 * both targets share one call path rather than branching at each site.
 */
async function keepSession(res: AuthApiResponse): Promise<AuthApiResponse> {
    await saveFromResponse(res as { tokens?: { accessToken?: string; refreshToken?: string } });
    return res;
}

// ─── Auth API ────────────────────────────────────────────────────────────────

/** POST /auth/login — sets cookies on the web, returns `data.tokens` in the app. */
export async function login(payload: LoginPayload): Promise<AuthApiResponse> {
    return keepSession(
        await apiFetch<AuthApiResponse>(`${SESSION_NS}/login`, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    );
}

/** POST /auth/register — same two deliveries as login. */
export async function register(
    payload: RegisterPayload
): Promise<AuthApiResponse> {
    return keepSession(
        await apiFetch<AuthApiResponse>(`${SESSION_NS}/register`, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    );
}

/** POST /auth/add-role — the new pair is scoped to the role just added. */
export async function addRole(
    payload: AddRolePayload
): Promise<AuthApiResponse> {
    return keepSession(
        await apiFetch<AuthApiResponse>(`${SESSION_NS}/add-role`, {
            method: "POST",
            body: JSON.stringify(payload),
        })
    );
}

/** GET /api/auth/me — validates session using cookies; backend auto-refreshes if needed */
export async function getMe(): Promise<AuthApiResponse> {
    return apiFetch<AuthApiResponse>("/api/auth/me");
}

/**
 * GET /auth/auth-me/:role
 * Switches the active session to the given role, re-issuing the pair scoped to
 * it.
 *
 * On the bearer path this is also the launch-time session restore, and it is
 * the one endpoint that must not be skipped: it re-issues **both** tokens at
 * full lifetime, which is what restarts the 30-day window. A client that only
 * ever rotated on 401 would hit a hard expiry 30 days after sign-in no matter
 * how much the app was used.
 */
export async function switchRole(role: Role): Promise<AuthApiResponse> {
    return keepSession(await apiFetch<AuthApiResponse>(`${SESSION_NS}/auth-me/${role}`));
}

/**
 * POST /api/auth/logout
 *
 * No mobile twin, and none is needed: the route clears cookies and answers 200,
 * which is a harmless no-op for a client that has none. What actually ends a
 * bearer session is discarding the pair, so that happens here — before the
 * request, so a network failure cannot leave the app holding a credential it
 * has decided to abandon.
 */
export async function logout(): Promise<void> {
    await clearTokens();
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
}

// ─── Session / Email Verification API ─────────────────────────────────────────

/**
 * POST /api/auth/browser/refresh
 * Proactively issues a fresh access_token cookie from the refresh_token cookie.
 * Browser clients rarely need this (requireAuth silently refreshes), but it lets
 * a client refresh ahead of expiry. Bearer-only callers cannot use it.
 */
export async function browserRefresh(): Promise<BrowserRefreshResponse> {
    return apiFetch<BrowserRefreshResponse>("/api/auth/browser/refresh", {
        method: "POST",
    });
}

/**
 * POST /api/auth/send-email-verification
 * Sends a verification link to the email on the caller's current role entity.
 * userId + role are read from the JWT — no body required.
 *
 * ⚠ **Nothing in this app calls this yet — it is kept deliberately, not dead.**
 * The flow it drives is the normal path rather than an edge case: a customer
 * registered through the bot always has `email_verified = false`, even when the
 * bot captured their address, so every customer with an email needs this send at
 * least once. What is missing is a resend surface in the account UI, not this
 * function — deleting it would only mean rewriting it when that screen lands.
 *
 * It is also one of the two routes that can answer `502 MAIL_ALL_PROVIDERS_FAILED`
 * (the other is `PATCH /api/me/email`). Whoever wires it up must translate that
 * code and leave the person on the page to press the button again — see the code's
 * entry in `backend-error-codes.ts`.
 */
export async function sendEmailVerification(): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/auth/send-email-verification", {
        method: "POST",
    });
}

/**
 * Confirm a registration email address from the token in the verification link.
 *
 * Public — the link is opened in a mail client, which is routinely not the
 * browser that registered and often not the same device. This marks
 * `email_verified` on the role profile; it mints no session and signs nobody in.
 *
 * ── 🔴 POST first, GET only as a fallback — and the order is the point ───────
 *
 * `POST /api/auth/verify-email` is the endpoint this flow wants, for the reason
 * `PasswordResetService` and the email-*change* confirm both spell out: mail
 * clients, link scanners and corporate relays **prefetch** URLs to build preview
 * cards, so a `GET` that mutates is spent before the person ever taps it. The
 * older `GET /api/auth/verify-email?token=` still exists and still works, so
 * links already sitting in inboxes keep resolving.
 *
 * The fallback fires only on 404/405 — "this deployment has no POST route" — and
 * is safe precisely because those statuses mean nothing was spent. Any other
 * failure (an invalid token, an expired one) is the real answer and propagates.
 *
 * ⚠ **Delete the fallback once every environment is on a backend that serves the
 * POST.** It exists to bridge the rollout, not as a permanent second path.
 */
export async function verifyEmail(token: string): Promise<MessageResponse> {
    try {
        return await apiFetch<MessageResponse>("/api/auth/verify-email", {
            method: "POST",
            body: JSON.stringify({ token }),
        });
    } catch (error) {
        const status = error instanceof AuthError ? error.statusCode : undefined;
        if (status !== 404 && status !== 405) throw error;

        return apiFetch<MessageResponse>(
            `/api/auth/verify-email?token=${encodeURIComponent(token)}`
        );
    }
}

/**
 * POST /api/auth/forgot-password
 *
 * ⚠️ **Always answers 200**, whether or not the identifier matches an account.
 * Never branch the UI on the response: a different message for "no such account"
 * turns this endpoint into an account-enumeration oracle, which is exactly what
 * the flat 200 exists to prevent. Show the same "check your messages" screen
 * every time.
 *
 * `identifier` is an email **or** an E.164 phone — WhatsApp is the primary
 * channel for this audience, and `phone` is the required registration field
 * while email is not. Rate-limited by the `/api/auth` bucket (20/min/IP).
 */
export async function forgotPassword(identifier: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier }),
    });
}

/**
 * POST /api/auth/reset-password
 *
 * Single-use, short-lived token. `AUTH_RESET_TOKEN_INVALID` (400) covers unknown,
 * already-used and expired alike — send the user back to request a fresh link.
 *
 * ⚠️ `newPassword` must satisfy the **strong** rule: 8+ characters with an
 * upper, a lower, a digit and a symbol. That is deliberately stricter than
 * registration, which still accepts 6 characters with no complexity rule — so a
 * password that would have been fine at sign-up is rejected here.
 *
 * On success the backend stamps `password_changed_at`, which the password-epoch
 * check turns into a global session revocation: every other device is signed
 * out. That is intended, and worth telling the user.
 */
export async function resetPassword(
    token: string,
    newPassword: string
): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
    });
}

// ─── Passwordless customer sign-in ───────────────────────────────────────────
// A customer holds a system-generated password that is disclosed to nobody, so
// `POST /auth/login` can never work for one. They send `/login` to the WhatsApp
// or Telegram bot and get two credentials for the same session — a link to tap
// and a code to type. See api-doc/auth/customer-auth.md.
//
// ⚠️ **THE APP DEPENDS ON A BACKEND ROUTE THAT DOES NOT EXIST YET.**
//
// Both endpoints below are cookie-only today. `messaging-login.controller.ts`
// calls `setAuthCookies` and its own docblock puts bearer clients out of scope:
// "if the customer app needs this it needs an `/api/auth/mobile/magic/*` twin
// returning `data.tokens`, exactly as the mobile namespace does elsewhere."
//
// Since this is the ONLY way a customer authenticates, the app cannot sign
// anyone in until that twin ships. The prefix below is written against the
// agreed contract, so the flow starts working the moment it lands — no
// frontend change. Until then these calls answer 404 on the native build.
const MAGIC_NS = USES_BEARER_AUTH ? "/api/auth/mobile/magic" : "/api/auth/magic";

/**
 * POST /api/auth/magic/link — redeem the token from a bot-issued magic link.
 *
 * ⚠️ **It is a POST, and it must stay one.** The link points at *our* page
 * (`/login/magic?t=…`), not at the API, because WhatsApp and Telegram fetch
 * URLs to build preview cards: a GET that signs you in is spent by the crawler
 * before the user ever taps it — a dead link, every time, for every user
 * (api-doc/auth/magic-login.md).
 *
 * Sets the same two HttpOnly cookies a password login does; no tokens in the
 * body. `MAGIC_LINK_INVALID` / `MAGIC_LINK_EXPIRED` are both 401 and both mean
 * the same thing to the user: ask the bot for a new one. Never retry the token.
 */
export async function magicLinkSignIn(token: string): Promise<MagicSignInResponse> {
    const res = await apiFetch<MagicSignInResponse>(`${MAGIC_NS}/link`, {
        method: "POST",
        body: JSON.stringify({ token }),
    });
    await saveFromResponse(res as { tokens?: { accessToken?: string; refreshToken?: string } });
    return res;
}

/**
 * POST /api/auth/magic/code — redeem the 8-character code the bot replied with,
 * paired with the account's phone number or email.
 *
 * ⚠️ **Send `code` exactly as the user typed it.** The server is already
 * forgiving about case, spacing and dashes, and reads `O` as `0` and `I`/`L` as
 * `1`; normalising client-side only introduces a second opinion that can
 * disagree with the first (api-doc/auth/magic-login.md).
 *
 * `MAGIC_CODE_INVALID` covers a wrong code, an unknown identifier, a spent code
 * and a code belonging to another account — one code for all four, deliberately,
 * so the endpoint cannot be used to learn who shops here. **Never write copy
 * that says "no account with that number".**
 */
export async function magicCodeSignIn(
    identifier: string,
    code: string
): Promise<MagicSignInResponse> {
    const res = await apiFetch<MagicSignInResponse>(`${MAGIC_NS}/code`, {
        method: "POST",
        body: JSON.stringify({ identifier, code }),
    });
    await saveFromResponse(res as { tokens?: { accessToken?: string; refreshToken?: string } });
    return res;
}
