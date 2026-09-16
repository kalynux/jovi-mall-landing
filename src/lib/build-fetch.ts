/**
 * `fetch` with bounded retry, for the reads a build cannot proceed without.
 *
 * ⚠ Deliberately NOT `server-only`, and the retry is deliberately server-only
 * anyway. `catalog.api.ts` is imported by five client components (ShopBrowser,
 * ProductDetailClient, VendorStoreClient, …) and cannot carry the guard, but a
 * six-attempt, two-minute retry in a browser would hang the shop on a handset
 * instead of failing it. `api/client.ts` already owns that path with a 20s
 * deadline and offline handling. So in the browser this is a plain `fetch`.
 *
 * `/pricing` and `/blog` both refuse to prerender without real data — that is
 * deliberate and stays. But it makes every one of their API reads a release
 * gate, and prerendering runs them from **eleven parallel workers** across ~280
 * pages. At that concurrency a single dropped connection fails the whole build.
 *
 * Observed 2026-09-16: two consecutive release builds died on `fetch failed`,
 * each on a *different* page (`/pt/pricing`, then `/fr/pricing` and `/ar/blog`),
 * while 24 concurrent curls to the same endpoints all returned 200 and the API
 * answered every endpoint individually in under 2.2s. A failure that moves
 * between pages on identical input is transport flake, not a broken endpoint,
 * and the correct response to it is to try again rather than to fail a release.
 *
 * Only thrown errors are retried — i.e. the request never completed. An HTTP
 * response, including a 5xx, is returned to the caller untouched: those mean the
 * API answered, and the callers already treat them as build-stopping. Retrying
 * them here would paper over a real outage.
 */

/**
 * The failure this is sized against is `UND_ERR_CONNECT_TIMEOUT` — undici's
 * **connect** timeout, 10s and not configurable through `fetch`. Eleven workers
 * opening TLS handshakes at once queue behind each other at the edge, and a
 * handshake that individually completes in under 2s can exceed 10s under that
 * burst. So an attempt is not cheap: a failed one costs the full 10s before the
 * backoff even starts.
 *
 * Six attempts therefore cover roughly two minutes of degraded connectivity,
 * which is long enough to ride out a burst without turning a genuinely
 * unreachable API into a five-minute build. `release.yml` preflights
 * reachability separately, so a truly dead API is named in seconds regardless.
 */
const ATTEMPTS = 6;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 6_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  // One attempt in the browser — see the header. Prerender is the only place
  // the eleven-worker handshake burst happens, and the only place a two-minute
  // wait is better than an error.
  const attempts = typeof window === "undefined" ? ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      // Exponential with jitter, capped: eleven workers that all blip at once
      // must not all come back at once either, and an uncapped curve would put
      // the last attempt minutes away for no extra benefit.
      const backoff = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
      await sleep(backoff + Math.random() * 400);
    }
  }

  throw lastError;
}

/**
 * The message an error wrapper should print.
 *
 * Node's `fetch` throws a bare `TypeError: fetch failed` and puts the useful
 * part — `ECONNRESET`, `UND_ERR_CONNECT_TIMEOUT`, a TLS error — in `.cause`. All
 * three catch sites (plans, blog, catalog) used `error.message` alone, so every
 * transport failure in the build log read "fetch failed" and named nothing; two
 * builds were spent guessing before this existed. Unwrap one level so the next
 * one is diagnosable straight from CI output.
 */
export function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return "network error";
  const cause = (error as { cause?: unknown }).cause;
  const detail =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : undefined;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code)
      : undefined;

  if (code && detail) return `${error.message} (${code}: ${detail})`;
  if (code) return `${error.message} (${code})`;
  if (detail) return `${error.message} (${detail})`;
  return error.message;
}
