/**
 * The customer half of service listings: unlocking a contact, and the
 * "may this business message me" answers. Contract:
 * `api-doc/customer/service-listings.md` §§ 2–3.
 *
 * All three routes take a **customer** session only. A vendor or agency
 * session on the same account unlocks nothing (the shop treats a business
 * session as "switch to your customer account" before it ever calls these).
 *
 * The public reads are in `catalog.api.ts`, on the public transport.
 */
import { apiFetch } from "@/lib/api/client";
import type { ListingConsent, ListingContactField, RevealResult } from "./listings";

/**
 * `POST /api/me/listings/:listingId/reveal { field }`.
 *
 * Refusals arrive as `ApiError` with one of `LISTING_UNREACHABLE`,
 * `LISTING_REVEAL_DAILY_LIMIT`, `LISTING_FIELD_UNAVAILABLE`,
 * `LISTING_VIDEO_UNAVAILABLE` (422) or `LISTING_NOT_FOUND` (404). Each has a
 * plain sentence under `errors.*`.
 *
 * ⛔ The answer is held in the calling component's state and nowhere else.
 */
export function revealListingContact(listingId: string, field: ListingContactField): Promise<RevealResult> {
  return apiFetch<RevealResult>(`/api/me/listings/${encodeURIComponent(listingId)}/reveal`, {
    method: "POST",
    body: JSON.stringify({ field }),
  });
}

/** `GET /api/me/listing-consents` — every business asked about, newest change first. */
export async function listListingConsents(): Promise<ListingConsent[]> {
  const rows = await apiFetch<ListingConsent[]>("/api/me/listing-consents");
  return Array.isArray(rows) ? rows : [];
}

/**
 * `PUT /api/me/listing-consents/:vendorId { granted }` — grant, refuse or
 * withdraw. Only toward a business this customer unlocked a contact from
 * (`404 LISTING_LEAD_NOT_FOUND` otherwise). Answers the updated row.
 */
export function setListingConsent(vendorId: string, granted: boolean): Promise<ListingConsent> {
  return apiFetch<ListingConsent>(`/api/me/listing-consents/${encodeURIComponent(vendorId)}`, {
    method: "PUT",
    body: JSON.stringify({ granted }),
  });
}
