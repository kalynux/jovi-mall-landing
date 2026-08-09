/**
 * Did this throw come from the request never reaching the server?
 *
 * `fetch` rejects with a bare `TypeError` when the host is unreachable — the
 * backend being down, DNS failing, the phone losing signal, a proxy refusing
 * the connection. There is no status code and no body to read a code out of, so
 * without this check every one of those becomes `UNKNOWN_ERROR` and the visitor
 * is told "an unexpected error occurred" when the accurate and actionable
 * message is "we can't reach WiMall — check your connection".
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

export function isNetworkError(error: unknown): boolean {
  // The browser is certain it has no connection — believe it before inspecting
  // anything else.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;

  if (!(error instanceof Error)) return false;

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
