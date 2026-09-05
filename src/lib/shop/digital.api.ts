/**
 * Digital product delivery — `/api/digital`.
 *
 * Entitlements are granted automatically after payment; this surface only reads
 * the resulting library and mints download links for it.
 */
import { API_BASE, apiFetch } from "@/lib/api/client";
import type { DigitalEntitlement, DownloadLink } from "./customer.types";

/** GET /api/digital/my-products — every digital product the customer has bought. */
export async function getMyDigitalProducts(): Promise<DigitalEntitlement[]> {
  const data = await apiFetch<DigitalEntitlement[]>("/api/digital/my-products");
  return Array.isArray(data) ? data : [];
}

/**
 * Turn the backend's `url` into one a browser can actually be sent to.
 *
 * 🔴 The backend returns a **path**, not a URL — `/api/digital/download/<token>`
 * (api-doc/customer/digital-products.md: "`url` is relative — prefix with the
 * API base"). Every other response is consumed through `apiFetch`, which adds
 * `API_BASE` itself, so this is the one place in the app where a backend path
 * escapes into `location.href` / `Browser.open` unprefixed — and there it
 * resolves against *this* origin. The download button therefore navigated to
 * `http://localhost:3000/api/digital/download/…`, which no Next route serves
 * (there is no `app/api`, and no rewrite proxies `/api`), so the click ended on
 * a 404 and the file never arrived.
 *
 * It also masks itself: the counter moves on **execute**, not on link creation,
 * so a click that never reaches the API consumes nothing. The entitlement keeps
 * reporting the full `downloadsRemaining` and the button just looks dead.
 *
 * Absolute URLs pass through untouched, so the day the backend starts handing
 * out pre-signed storage URLs this keeps working rather than mangling them.
 */
function absoluteDownloadUrl(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  return `${API_BASE.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

/**
 * POST /api/digital/download-links
 *
 * The returned `url` is **single-use** — the token in it is the authentication
 * and is consumed on first use, incrementing the download counter before any
 * bytes are written. Mint a fresh link per click; never cache one.
 *
 * Resolved to an absolute URL before it is returned: callers hand it to the
 * browser or to the platform download manager, neither of which knows where the
 * API lives. See {@link absoluteDownloadUrl}.
 */
export async function createDownloadLink(
  entitlementId: string,
): Promise<DownloadLink> {
  const link = await apiFetch<DownloadLink>("/api/digital/download-links", {
    method: "POST",
    body: JSON.stringify({ entitlementId }),
  });

  return { ...link, url: absoluteDownloadUrl(link.url) };
}
