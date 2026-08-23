/**
 * The bearer pair, for clients that cannot hold a cookie.
 *
 * ── Why the app needs this at all ────────────────────────────────────────────
 *
 * The backend authenticates browsers with two HttpOnly cookies. A Capacitor
 * WebView can use neither: its origin is `https://localhost` (Android) or
 * `capacitor://localhost` (iOS), which makes our cookie third-party and blocked
 * by default, and `Set-Cookie` is a forbidden response-header name in the Fetch
 * standard, so JavaScript cannot scrape the token out either. The backend's
 * answer is `/api/auth/mobile/*`, which returns the same pair from the same
 * issuer in `data.tokens` and sets no cookie. This module is where that pair
 * lives on our side.
 *
 * ── The pair is a credential, and is treated like one ────────────────────────
 *
 * `Preferences` is `SharedPreferences` / `UserDefaults` — not encrypted at rest.
 * That is an accepted trade for a shopping session today, and it is the reason
 * this module is the only thing that touches the storage keys: swapping it for
 * an encrypted store later is a change inside this file. Do not read the keys
 * from anywhere else.
 *
 * ── Sync and async, and why both exist ───────────────────────────────────────
 *
 * Native storage is async, but `apiFetch` needs the access token on every call
 * and cannot afford a plugin round-trip per request. So the pair is cached in
 * memory after the first read: `hydrate()` runs once at app start, `peek()` is
 * the hot path, and `read()` is the safe one that hydrates if it has to.
 */
import { IS_NATIVE_BUILD } from "@/lib/platform";
import * as storage from "@/lib/platform/storage";

/**
 * Whether this build authenticates with a bearer token instead of cookies.
 *
 * Deliberately keyed to the **build**, not to `isNative()`. The native bundle is
 * also what a developer runs in a browser via `next dev`, and there the cookie
 * path would quietly work — `localhost:3000` and `localhost:8022` are same-site,
 * so Lax cookies are sent. That would mean developing the app against an auth
 * flow the device never takes, and finding out on the device. Keying to the
 * build makes the browser dev loop exercise exactly what ships.
 *
 * Sending both is harmless in any case: `extractToken` in the API's auth
 * middleware prefers the bearer over the cookie, specifically so a stale cookie
 * cannot beat a freshly refreshed token.
 */
export const USES_BEARER_AUTH = IS_NATIVE_BUILD;

const ACCESS_KEY = "wi-mall-access-token";
const REFRESH_KEY = "wi-mall-refresh-token";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** In-memory mirror of what is on disk. `null` means "no session". */
let cached: TokenPair | null = null;
let hydrated = false;

/**
 * Read the stored pair into memory. Call once, before the first API request —
 * `AuthProvider` does this ahead of `restoreSession()`.
 *
 * Idempotent, and a no-op on the web build, where there is nothing to hydrate.
 */
export async function hydrate(): Promise<void> {
  if (hydrated || !USES_BEARER_AUTH) {
    hydrated = true;
    return;
  }

  const [accessToken, refreshToken] = await Promise.all([
    storage.get(ACCESS_KEY),
    storage.get(REFRESH_KEY),
  ]);

  // Half a pair is not a session: without a refresh token an expired access
  // token is unrecoverable, and without an access token there is nothing to
  // send. Either way the user has to sign in again, so treat it as signed out.
  cached = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  hydrated = true;
}

/**
 * The cached pair, without touching storage.
 *
 * Answers `null` before `hydrate()` has run, which is why `apiFetch` awaits
 * `read()` rather than calling this — a request that fires before hydration
 * would otherwise go out unauthenticated and 401 for no reason.
 */
export function peek(): TokenPair | null {
  return USES_BEARER_AUTH ? cached : null;
}

/** The pair, hydrating first if nobody has yet. */
export async function read(): Promise<TokenPair | null> {
  if (!USES_BEARER_AUTH) return null;
  if (!hydrated) await hydrate();
  return cached;
}

/** Persist a freshly issued pair. Called after sign-in and after each rotation. */
export async function save(pair: TokenPair): Promise<void> {
  cached = pair;
  hydrated = true;
  if (!USES_BEARER_AUTH) return;

  await Promise.all([
    storage.set(ACCESS_KEY, pair.accessToken),
    storage.set(REFRESH_KEY, pair.refreshToken),
  ]);
}

/**
 * Forget the session. Called on sign-out, and whenever a refresh is refused —
 * a refresh token the server will not rotate is spent, and keeping it only
 * buys a second 401.
 */
export async function clear(): Promise<void> {
  cached = null;
  hydrated = true;
  if (!USES_BEARER_AUTH) return;

  await Promise.all([storage.remove(ACCESS_KEY), storage.remove(REFRESH_KEY)]);
}

/**
 * The shape `/api/auth/mobile/*` returns its pair in.
 *
 * `tokenEnvelope` on the backend also reports the access token's lifetime; we
 * do not use it. Expiry is discovered by the 401 that `apiFetch` retries, which
 * is one source of truth instead of two that can disagree across a clock skew.
 */
export interface TokenEnvelope {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  tokenType?: string;
}

/**
 * Store the pair out of any `data.tokens` block, if there is one.
 *
 * Every mobile auth response carries one and every browser response carries
 * none, so this is safe to call on both and is what lets the auth service stay
 * a single code path instead of branching per target.
 */
export async function saveFromResponse(body: {
  tokens?: Partial<TokenEnvelope> | null;
}): Promise<void> {
  const tokens = body?.tokens;
  if (!tokens?.accessToken || !tokens?.refreshToken) return;

  await save({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
}
