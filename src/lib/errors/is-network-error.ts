/**
 * Did this throw come from the request never reaching the server?
 *
 * `fetch` rejects with a bare `TypeError` when the host is unreachable — the
 * backend being down, DNS failing, the phone losing signal, a proxy refusing
 * the connection. There is no status code and no body to read a code out of, so
 * without this check every one of those becomes `UNKNOWN_ERROR` and the visitor
 * is told "an unexpected error occurred" when the accurate and actionable
 * message is "we can't reach Wi-Mall — check your connection".
 *
 * The message strings differ per engine and are matched loosely on purpose:
 *
 *   Chrome/Edge   TypeError: Failed to fetch
 *   Firefox       TypeError: NetworkError when attempting to fetch resource.
 *   Safari        TypeError: Load failed / The network connection was lost.
 *   Node (undici) TypeError: fetch failed
 *
 * A false negative just falls back to the generic message, so the matching errs
 * toward being narrow rather than claiming an outage for an unrelated
 * `TypeError`.
 */

const NETWORK_MESSAGES =
  /failed to fetch|networkerror|network request failed|fetch failed|load failed|network connection was lost|connection refused|err_(internet_disconnected|connection|network|name_not_resolved)/i;

/**
 * "We could not ask the server", raised by us rather than by `fetch`.
 *
 * `lib/api/client.ts` throws this when a bearer rotation fails for a reason
 * that is not a refusal — the request never arrived, or the API answered 5xx.
 * Without it that case reaches the caller as the ORIGINAL `401`, which reads as
 * "your session is over" and sends a shopper to the sign-in page holding a
 * refresh token that is good for another month. That was the bug; this class is
 * how the distinction survives the trip back up.
 *
 * It is a network error in every sense the UI cares about, so `isNetworkError`
 * below claims it and the shopper gets "check your connection" rather than
 * "an unexpected error occurred".
 */
export class OfflineError extends Error {
  constructor(message = "The request did not reach the server") {
    super(message);
    this.name = "OfflineError";
  }
}

/**
 * An authority on connectivity better than `navigator.onLine`, if one exists.
 *
 * On a device it does: `lib/native/network.ts` registers one backed by the OS's
 * own connectivity manager. `navigator.onLine` in an Android WebView reports
 * `true` for a Wi-Fi network with no internet behind it and for a mobile
 * connection out of data, both of which are ordinary here — so believing it
 * turns "check your connection" into "an unexpected error occurred".
 *
 * Injected rather than imported so this module stays free of Capacitor: it is
 * reachable from server components, and the native package must not be.
 * Unset on the web, where `navigator.onLine` is already correct.
 */
let offlineProbe: (() => boolean) | null = null;

export function setOfflineProbe(probe: () => boolean): void {
  offlineProbe = probe;
}

export function isNetworkError(error: unknown): boolean {
  // The platform is certain it has no connection — believe it before inspecting
  // anything else.
  if (offlineProbe?.() === true) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;

  if (!(error instanceof Error)) return false;

  // Our own deadline in `lib/api/client.ts` fired, meaning nothing came back at
  // all. `AbortSignal.timeout` rejects with a DOMException named "TimeoutError"
  // rather than a TypeError, so without this it falls through the check below
  // and is reported as "an unexpected error occurred" — which is precisely the
  // outage this function exists to name.
  //
  // Deliberately not "AbortError": that is a request somebody cancelled on
  // purpose, and telling them their connection is down would be a lie.
  if (error.name === "TimeoutError") return true;

  // Our own "could not ask" marker — see `OfflineError` above. Matched by name
  // rather than `instanceof` so a duplicated module instance (two bundles, a
  // hot reload) cannot quietly turn this back into "an unexpected error".
  if (error.name === "OfflineError") return true;

  // Only fetch's own rejection type. A `TypeError` raised inside our own
  // response handling would otherwise be misreported as an outage.
  if (error.name !== "TypeError") return false;

  // undici nests the real reason (ECONNREFUSED, ENOTFOUND) under `cause`.
  const cause = (error as { cause?: unknown }).cause;
  const causeMessage = cause instanceof Error ? cause.message : "";

  return (
    NETWORK_MESSAGES.test(error.message) ||
    NETWORK_MESSAGES.test(causeMessage) ||
    /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET/i.test(causeMessage)
  );
}
