/**
 * Digital product delivery — `/api/digital`.
 *
 * Entitlements are granted automatically after payment; this surface only reads
 * the resulting library and mints download links for it.
 */
import { apiFetch } from "@/lib/api/client";
import type { DigitalEntitlement, DownloadLink } from "./customer.types";

/** GET /api/digital/my-products — every digital product the customer has bought. */
export async function getMyDigitalProducts(): Promise<DigitalEntitlement[]> {
  const data = await apiFetch<DigitalEntitlement[]>("/api/digital/my-products");
  return Array.isArray(data) ? data : [];
}

/**
 * POST /api/digital/download-links
 *
 * The returned `url` is **single-use** — the token in it is the authentication
 * and is consumed on first use, incrementing the download counter before any
 * bytes are written. Mint a fresh link per click; never cache one.
 */
export async function createDownloadLink(
  entitlementId: string,
): Promise<DownloadLink> {
  return apiFetch<DownloadLink>("/api/digital/download-links", {
    method: "POST",
    body: JSON.stringify({ entitlementId }),
  });
}
