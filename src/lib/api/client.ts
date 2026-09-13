/**
 * Shared backend HTTP client.
 *
 * Extracted verbatim from `src/lib/auth/auth.api.ts`, where it lived as a
 * module-private helper until the shop needed it too. Behaviour is unchanged —
 * `auth.api.ts` now imports from here.
 *
 * Everything the backend exposes goes through this: cookie-first auth
 * (`credentials: "include"`), the `{ success, data, meta }` success envelope, and
 * the structured `{ success: false, requestId, error: {...} }` error contract.
 * See api-doc/README.md § "The response envelope".
 */
import { AuthError, ApiError } from "@/lib/auth/auth.types";
import type { ApiErrorBody } from "@/lib/auth/auth.types";
import { isErrorCategory } from "@/lib/auth/error-categories";
import { OfflineError } from "@/lib/errors/is-network-error";
import * as tokens from "@/lib/auth/token-store";
import type { TokenPair } from "@/lib/auth/token-store";

export const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8022";

/** The `meta` block on any paginated list response (api-doc/README.md § Pagination). */
export interface ListMeta {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

/**
 * `Retry-After` as a number of seconds, or `undefined`.
 *
 * Only the delta-seconds form is read. The HTTP-date form is legal and this
 * service does not send it; parsing it would mean trusting the client clock
 * against the server's, which on a phone with a wrong date yields a cooldown of
 * hours or of nothing. A missing value is the safer answer — callers already
 * have to hold a sane default for the case where no header arrives at all.
 */
function retryAfterOf(res: Response): number | undefined {
    const raw = res.headers.get("retry-after");
    if (!raw) return undefined;
    const seconds = Number(raw.trim());
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/**
 * Throws the structured error contract, or an `AuthError` when the body is not
 * one the backend produced (proxy, network layer, gateway).
 */
function throwResponseError(res: Response, body: Record<string, unknown>): never {
    // Try to conform to the structured backend error contract first.
    // See: api-doc/errors/README.md
    const structured = body as Partial<ApiErrorBody>;
    if (structured?.error?.code) {
        throw new ApiError(
            structured.error.message,
            structured.error.statusCode ?? res.status,
            structured.error.code,
            structured.error.details,
            structured.requestId,  // propagate request trace ID for support display
            // Validated rather than cast: the contract says `category` is
            // always present, but a body from a proxy or a pre-Phase-16
            // deploy has none, and consumers must see `undefined` rather
            // than an unchecked string that fails an === comparison later.
            isErrorCategory(structured.error.category)
                ? structured.error.category
                : undefined,
            retryAfterOf(res)
        );
    }

    // Fallback for non-structured responses (network layer, proxies, etc.)
    throw new AuthError(
        (body?.message as string) ||
        (body?.error as string) ||
        `Request failed (${res.status})`,
        res.status
    );
}

/** Where a bearer client rotates its pair. See `lib/auth/token-store.ts`. */
const MOBILE_REFRESH_PATH = "/api/auth/mobile/refresh";

/**
 * How long one round trip may take before it is abandoned.
 *
 * There was no deadline here at all, and on a phone that is not a small gap.
 * `fetch` rejects promptly when a host *refuses* a connection, but a network
 * that silently drops packets — a dead cell, a captive portal, a VPN that is
 * installed but not routing — produces no rejection: the request simply never
 * settles. `AuthProvider` holds `status: "loading"` until `GET /auth/me`
 * answers, and `NativeShell` holds the splash until that status moves, so the
 * app sat on its own logo indefinitely with nothing on screen to say why.
 * That is how this was found — a device with Wi-Fi off and the API on a
 * tailnet — but a dead zone reproduces it exactly.
 *
 * 20s rather than something tighter: the target market is 3G, and a slow
 * request that would have succeeded must not be cut off. This is a deadline
 * for "never", not a latency budget.
 */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * The abort signal for one request: the deadline, the caller's, or both.
 *
 * Guarded rather than assumed. This is a safety net, and a safety net must not
 * itself be load-bearing — on a WebView old enough to lack either constructor,
 * a throw here would take out every request in the app, which is a worse
 * failure than the hang it prevents. No caller passes a signal today; the
 * merge is here so that the first one to do so does not silently lose the
 * deadline.
 */
function requestSignal(caller?: AbortSignal | null): AbortSignal | undefined {
    if (typeof AbortSignal?.timeout !== "function") return caller ?? undefined;

    const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    if (!caller) return deadline;

    return typeof AbortSignal.any === "function"
        ? AbortSignal.any([caller, deadline])
        : caller;
}

/**
 * One round trip, with the bearer attached if this build has one.
 *
 * `credentials: "include"` stays on unconditionally, for both targets. On the
 * web it is the whole authentication; on a device there is no cookie jar to
 * draw from, so it costs nothing — and if a native HTTP layer ever does present
 * a stale cookie, the API's `extractToken` prefers the bearer over it anyway.
 */
async function send(
    path: string,
    options: RequestInit,
    accessToken?: string
): Promise<{ res: Response; body: Record<string, unknown> }> {
    /**
     * `FormData` must NOT carry an explicit content type.
     *
     * A multipart body is only parseable with the boundary token the browser
     * generates, and it puts that in the header it writes itself. Setting
     * `Content-Type: multipart/form-data` by hand omits the boundary and the
     * server rejects the body as malformed — so the header is dropped entirely
     * here rather than guessed at.
     */
    const isMultipart = options.body instanceof FormData;

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: requestSignal(options.signal),
        credentials: "include", // always send both cookies
        headers: {
            ...(isMultipart ? {} : { "Content-Type": "application/json" }),
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(options.headers ?? {}),
        },
    });

    let body: Record<string, unknown> = {};
    try {
        body = await res.json();
    } catch {
        // empty body — fall through to generic error below
    }

    return { res, body };
}

/**
 * Why a rotation did not produce a pair — and the distinction is the whole point.
 *
 * These two used to be one `null`, and collapsing them is what made a shopper
 * with a perfectly good 30-day refresh token get sent back to the sign-in
 * screen. They call for opposite handling:
 *
 *   `refused`     the server looked at the credential and said no — spent, past
 *                 the 90-day cap, password changed, account suspended. Nothing
 *                 we hold can fix it, so the pair is dropped and the session is
 *                 genuinely over.
 *   `unavailable` we never got an answer, or got one that says nothing about the
 *                 credential — the request timed out, the phone dropped off the
 *                 network mid-request, the API answered 502 during a deploy.
 *                 The session is untouched; only THIS request failed.
 *
 * On the target market's connections `unavailable` is ordinary, not exceptional,
 * which is why treating it as `refused` presented as "the app logs me out every
 * few minutes".
 */
type RotationOutcome =
    | { kind: "rotated"; pair: TokenPair }
    | { kind: "refused" }
    | { kind: "unavailable" };

/**
 * The in-flight rotation, shared by every caller that hits a 401 at once.
 *
 * Without this, a screen that loads four resources in parallel answers four
 * 401s and fires four rotations. One rotation, awaited by all — which also
 * means all four learn the same outcome, rather than one of them concluding
 * "signed out" on its own.
 */
let rotation: Promise<RotationOutcome> | null = null;

function rotate(refreshToken: string): Promise<RotationOutcome> {
    rotation ??= exchangeRefreshToken(refreshToken).finally(() => {
        rotation = null;
    });
    return rotation;
}

/**
 * Trade a refresh token for a fresh pair.
 *
 * Deliberately bypasses `request` — a 401 here must not re-enter the retry it
 * exists to serve. It also reads the envelope by hand rather than through
 * `apiFetch`, so the failure paths below can distinguish a refusal from an
 * outage, which `apiFetch` would flatten into one thrown error.
 */
async function exchangeRefreshToken(refreshToken: string): Promise<RotationOutcome> {
    let res: Response;
    let body: Record<string, unknown> = {};

    try {
        ({ res, body } = await send(MOBILE_REFRESH_PATH, {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
        }));
    } catch {
        // The network is down, not the session. Keep the pair: clearing it here
        // would sign a shopper out every time they walked into a lift.
        return { kind: "unavailable" };
    }

    /**
     * Only a 401 or a 403 is a verdict ON THE CREDENTIAL.
     *
     * This used to drop the pair for any `!res.ok`, which swept in every status
     * that says nothing about it: a 502 from a restarting API, a 500, a 429, the
     * 404 a half-deployed backend answers before the mobile namespace exists.
     * Each of those permanently signed the shopper out — and a customer holds no
     * password, so "signed out" means going back to the bot for a fresh code.
     * A deploy blip cost every open app its session.
     *
     * The refusal codes the API actually answers here all arrive as one of these
     * two: `AUTH_SESSION_EXPIRED`, `AUTH_REFRESH_TOKEN_INVALID`,
     * `AUTH_SESSION_CAP_REACHED` and `AUTH_PASSWORD_CHANGED` at 401,
     * `AUTH_ACCOUNT_SUSPENDED` / `AUTH_ACCOUNT_CLOSED` / `AUTH_ROLE_NOT_FOUND`
     * at 403. See `AuthService.rotateRefreshToken`.
     */
    if (res.status === 401 || res.status === 403) {
        await tokens.clear();
        return { kind: "refused" };
    }

    const envelope = body as { data?: { tokens?: Partial<TokenPair> }; tokens?: Partial<TokenPair> };
    const pair = envelope?.data?.tokens ?? envelope?.tokens;

    // Any other failure, and a 200 whose body is not a pair (a proxy's error
    // page, a truncated response). We learned nothing about the credential, so
    // it stays where it is and only this request fails.
    if (!res.ok || !pair?.accessToken || !pair?.refreshToken) {
        return { kind: "unavailable" };
    }

    const next: TokenPair = { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
    await tokens.save(next);
    return { kind: "rotated", pair: next };
}

/**
 * Fetch, and on a 401 rotate the bearer once and try again.
 *
 * ── Why only the bearer path retries ─────────────────────────────────────────
 *
 * A browser never reaches the retry, because `tokens.read()` answers `null` on
 * the web build and the first `if` falls straight through. It does not need it:
 * `requireAuth` refreshes the access cookie silently from the refresh cookie
 * and the browser never sees the 401 at all. A bearer client gets no such
 * courtesy — nothing on the server can rewrite a header — so rotating is our
 * job, and this is the single place it happens.
 *
 * One retry, never a loop: if the second attempt also answers 401 the pair has
 * already been cleared by `exchangeRefreshToken` and the error is thrown for
 * `restoreSession` to read as "signed out".
 *
 * ── A rotation we could not perform is NOT a 401 ─────────────────────────────
 *
 * When the rotation comes back `unavailable`, this used to fall through and
 * rethrow the original `401 AUTH_TOKEN_EXPIRED` — so a dropped packet on the
 * refresh call was reported to the caller in the same words as a dead session,
 * and `restoreSession` had no way to tell them apart. It signed the shopper out.
 * Now that case throws `OfflineError` instead: the credential is still in the
 * store, the caller sees a connectivity failure, and nothing sends anyone to the
 * sign-in page.
 */
async function request(
    path: string,
    options: RequestInit
): Promise<{ res: Response; body: Record<string, unknown> }> {
    const pair = await tokens.read();

    let { res, body } = await send(path, options, pair?.accessToken);

    if (res.status === 401 && pair && path !== MOBILE_REFRESH_PATH) {
        const outcome = await rotate(pair.refreshToken);

        if (outcome.kind === "rotated") {
            ({ res, body } = await send(path, options, outcome.pair.accessToken));
        } else if (outcome.kind === "unavailable") {
            throw new OfflineError("Could not refresh the session");
        }
        // "refused" falls through to the 401 below, which is exactly right: the
        // session really is over and the caller must treat it as such.
    }

    if (!res.ok) throwResponseError(res, body);

    return { res, body };
}

/**
 * Fetch and return the unwrapped payload.
 *
 * ── Success envelope unwrap ──────────────────────────────────────────────
 * Breaking change (api-doc/README.md, 2026-07-17): every endpoint now wraps
 * its payload in `{ success, data, meta }`. Callers want `data`, not the
 * envelope. We stay defensive: only unwrap when the standard envelope is
 * actually present (`success === true` and a `data` key exists — `data` may
 * legitimately be `null`, e.g. logout). Anything else is returned as-is.
 *
 * That defensiveness is load-bearing for three real endpoint families, which
 * the backend builds by hand rather than through a response interceptor:
 *   - `/api/payments/*` answers flat — `{ success, transactionId, status }` and
 *     `{ success, transaction }`, with no `data` key.
 *   - `DELETE /api/customer/cart` and `DELETE /api/me/payment-methods/:id`
 *     answer `{ success, message }` — also no `data`.
 *   - provider webhooks keep their provider-specific bodies.
 * All of them fall through and are returned whole, so callers of those routes
 * must type `T` as the full body, not as a payload.
 */
export async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const { body } = await request(path, options);

    const envelope = body as { success?: boolean; data?: unknown };
    if (
        envelope &&
        typeof envelope === "object" &&
        envelope.success === true &&
        "data" in envelope
    ) {
        return envelope.data as T;
    }

    return body as T;
}

/**
 * Fetch a single payload and keep the `meta` block beside it.
 *
 * `apiFetch` unwraps to `data` and drops `meta`; `apiFetchList` keeps `meta` but
 * forces `data` to an array. This is the third case: an **object** payload whose
 * `meta` is load-bearing rather than pagination.
 *
 * It exists for `POST /api/customer/cart/merge`, where `data` is the merged cart
 * and `meta.dropped[]` names every line that could not be carried over. Dropping
 * that block would silently lose exactly the information the endpoint was built
 * to return — a shopper's basket losing a line with no explanation is the bug it
 * prevents.
 */
export async function apiFetchWithMeta<T, M = Record<string, unknown>>(
    path: string,
    options: RequestInit = {}
): Promise<{ data: T; meta: Partial<M> }> {
    const { body } = await request(path, options);

    const envelope = body as { success?: boolean; data?: unknown; meta?: unknown };
    const hasEnvelope =
        envelope && typeof envelope === "object" && envelope.success === true && "data" in envelope;

    return {
        data: (hasEnvelope ? envelope.data : body) as T,
        meta: (envelope?.meta ?? {}) as Partial<M>,
    };
}

/**
 * Fetch a paginated list and keep the `meta` block.
 *
 * `apiFetch` unwraps to `data` and drops `meta`, which is where every list
 * endpoint puts its pagination — and where the customer notification inbox puts
 * `unreadCount`. Use this whenever the caller needs page counts or those extra
 * summary fields; `M` widens `meta` for them.
 *
 * A response with no `meta` (some endpoints return a bare array) yields a
 * synthesised single-page block, so callers never have to null-check it.
 *
 * ── `pagination` is the same block under a different key ─────────────────────
 *
 * Three endpoints name it `pagination` rather than `meta`: `GET
 * /api/customer/tickets` and the two `tickets/reference/{orders,products}`
 * lookups (api-doc/README.md § 4). The fields inside — `total`, `page`,
 * `limit`, `pages` — are identical; only the key differs, and the backend has
 * declined to unify them because it would break the vendor and agency apps that
 * already read `pagination`.
 *
 * Reading both here rather than at the three call sites means a caller never has
 * to know which of the two its endpoint happens to use, and a fourth endpoint
 * adopting either key needs no change. `meta` wins when both are somehow
 * present, since it is the documented default.
 *
 * ── `totalPages` is the same number under a different name ──────────────────
 *
 * The page count is `pages` on most endpoints and **`totalPages`** on reviews
 * and bookings — the reviews controller says so in its own source comment
 * ("`pages` at the repository layer, `totalPages` on the wire"). Reading only
 * `pages` therefore fell to the `?? 1` default on those, which does not throw
 * and does not look wrong: it silently means "one page". `ProductReviews` set
 * its page count from it, so a product with sixty reviews rendered the first ten
 * and no way to reach the rest.
 *
 * Both names are accepted for the same reason both envelope keys are: which one
 * an endpoint uses is not something a call site should have to know.
 */
export async function apiFetchList<T, M = Record<string, unknown>>(
    path: string,
    options: RequestInit = {}
): Promise<{ data: T[]; meta: ListMeta & M }> {
    const { body } = await request(path, options);

    const envelope = body as {
        success?: boolean;
        data?: unknown;
        meta?: unknown;
        pagination?: unknown;
    };
    const data = (Array.isArray(envelope?.data) ? envelope.data : []) as T[];
    const meta = (envelope?.meta ?? envelope?.pagination ?? {}) as Partial<ListMeta> &
        M & { totalPages?: number };

    return {
        data,
        meta: {
            ...meta,
            total: meta.total ?? data.length,
            page: meta.page ?? 1,
            limit: meta.limit ?? data.length,
            pages: meta.pages ?? meta.totalPages ?? 1,
        } as ListMeta & M,
    };
}
