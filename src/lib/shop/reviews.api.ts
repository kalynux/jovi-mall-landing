/**
 * Reviews — `/api/customer/reviews`, `/api/public/products/:id/reviews` and
 * `/api/public/listings/:id/reviews`.
 *
 * A customer reviews three different things: a **product** they bought, a
 * **delivery** they received, and (since 2026-11-08) a **service listing** whose
 * contact they unlocked. Products and listings publish; a delivery never does.
 *
 * ⚠ **Since 2026-10-05 every review publishes the moment it is written, text
 * included** (owner decision). There is no held state: statuses are
 * `published` and `unpublished` (an administrator took it down afterwards).
 *
 * See api-doc/customer/reviews.md and api-doc/reviews.md.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { ListMeta, ProductRating } from "./shop.types";
import { eligibilityFrom, eligibilityFromCode, type ReviewEligibility } from "./review-eligibility";

export type { ReviewEligibility } from "./review-eligibility";

/**
 * What is being reviewed.
 *
 * 🔴 **A delivery review names an agent the customer never sees.** The customer
 * rates *the delivery*; the platform knows whose it was, and attribution happens
 * server-side. This endpoint never discloses the agent, and a review form must
 * not name one from the shipment payload — that the order-detail page shows a
 * carrying agent under ADR-A06 is a separate, deliberate disclosure with its own
 * `visibleFrom` gate, and it neither undoes nor extends this rule.
 *
 * A delivery rating also moves real money: it feeds the agent's trust composite,
 * which scales their COD cash limit.
 */
export type ReviewSubjectType = "product" | "delivery" | "listing";

/**
 * `product` → the product id. `delivery` → the **shipment** id, not the order.
 * `listing` → the listing id.
 *
 * `unpublished`: an administrator took it down. The author sees only that, never
 * why (owner decision). It counts for nothing and blocks a second review.
 */
export type ReviewStatus = "published" | "unpublished";

export interface Review {
  id: string;
  subjectType: ReviewSubjectType;
  subjectId: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  publishedAt: string | null;
  createdAt: string;
}

/** One published product review as the public route serves it. */
export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  publishedAt: string;
}

export interface SubmitReviewInput {
  subjectType: ReviewSubjectType;
  subjectId: string;
  /** Integer 1–5. There is no half-star — the trust composite reads this. */
  rating: number;
  /** Optional, 1–120 chars. Public at once. */
  title?: string;
  /** Optional, 1–2000 chars. Public at once. */
  body?: string;
}

/**
 * POST /api/customer/reviews
 *
 * **Public the moment it is written, text included** (since 2026-10-05), so the
 * form must say so BEFORE the customer sends it. No author name is published.
 *
 * A second review of the same subject is `409 REVIEW_ALREADY_EXISTS`, enforced
 * by a unique index rather than a pre-check, so a double-tap cannot create two.
 * There is no edit — the 409 is terminal.
 *
 * The body is `.strict()`; empty optional fields are omitted rather than sent as
 * `""`, since sending an empty string would be an unknown-shaped value for a
 * field whose *presence* is the signal.
 */
export async function submitReview(input: SubmitReviewInput): Promise<Review> {
  const body: Record<string, unknown> = {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    rating: input.rating,
  };
  const title = input.title?.trim();
  const text = input.body?.trim();
  if (title) body.title = title;
  if (text) body.body = text;

  return apiFetch<Review>("/api/customer/reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * GET /api/customer/reviews/eligibility
 *
 * 🔴 **A refusal is a `200`, not a thrown error:** `{ eligible: false, reason }`,
 * `reason` being the code the write would have raised. Until 2026-11-09 this
 * function returned "eligible" for every `200`, so the form was offered to
 * customers who could not review and their submit then failed. Only a subject
 * that does not exist still arrives as a thrown `404 REVIEW_SUBJECT_NOT_FOUND`.
 *
 * A **listing** is eligible once the customer unlocked at least one of its
 * contacts (owner L-27); saving or viewing it earns nothing.
 *
 * **Call this before rendering a review form.** Eligibility for a product means
 * a *completed* order of this customer containing it — completion being
 * `completion.confirmed_at`, which the customer confirming delivery, the COD
 * cash handover and the auto-confirm sweep all converge on. The order need not
 * be the most recent. For a delivery it means a shipment of theirs that reached
 * `delivered`.
 *
 * Refusals arrive as thrown `ApiError`s, and the distinction between them is the
 * whole point of the call, so they are mapped to a result rather than rethrown.
 */
export async function checkReviewEligibility(
  subjectType: ReviewSubjectType,
  subjectId: string,
): Promise<ReviewEligibility> {
  const qs = new URLSearchParams({ subjectType, subjectId });
  try {
    const verdict = await apiFetch<{ eligible?: boolean; reason?: string | null; existingReviewId?: string | null }>(
      `/api/customer/reviews/eligibility?${qs}`,
    );
    return eligibilityFrom(verdict);
  } catch (err) {
    return eligibilityFromCode((err as { code?: string })?.code, null);
  }
}

/**
 * GET /api/customer/reviews — this customer's own reviews, both statuses,
 * including one an administrator hid (`unpublished`). Since 2026-11-08 it has
 * `subjectType: "listing"` rows too.
 */
export async function listMyReviews(
  query: { page?: number; limit?: number; status?: ReviewStatus } = {},
): Promise<{ data: Review[]; meta: ListMeta }> {
  const qs = new URLSearchParams();
  if (query.page !== undefined) qs.set("page", String(query.page));
  if (query.limit !== undefined) qs.set("limit", String(query.limit));
  if (query.status) qs.set("status", query.status);
  const s = qs.toString();
  return apiFetchList<Review>(`/api/customer/reviews${s ? `?${s}` : ""}`);
}

/**
 * GET /api/public/products/:productId/reviews — unauthenticated.
 *
 * Published **product** reviews, newest first. ⚠ **Never add `subjectType` to
 * this route.** It serves product reviews only; delivery reviews are an internal
 * signal naming an agent, and only their aggregate ever leaves the platform.
 *
 * No author identity is published — no name, no id, no initial. A "verified
 * purchase" badge is implicit: eligibility means every published review is one.
 *
 * An unknown or unpublished product answers an **empty page, not a 404** — a 404
 * would make the route an existence oracle for draft products.
 *
 * `meta.rating` is the same aggregate the product body carries, and is `null`
 * when nothing is published.
 *
 * ⚠ **This route's paging limits are its own.** `limit` defaults to **10** and
 * is capped at **50**, not the 20/100 used everywhere else on the platform, so
 * passing the house default gets a `400` rather than a bigger page. Its page
 * count also arrives as `meta.totalPages` rather than `meta.pages`;
 * `apiFetchList` normalises the two, and before it did, this list reported one
 * page however many reviews a product had.
 *
 * ⚠ **Both review query schemas are `.strict()`** — an unknown query parameter
 * is a `400`, not something ignored. Never append a cache-buster or an
 * analytics parameter to these URLs.
 */
export async function listProductReviews(
  productId: string,
  query: { page?: number; limit?: number } = {},
): Promise<{ data: PublicReview[]; meta: ListMeta; rating: ProductRating | null }> {
  const qs = new URLSearchParams();
  if (query.page !== undefined) qs.set("page", String(query.page));
  if (query.limit !== undefined) qs.set("limit", String(query.limit));
  const s = qs.toString();

  const { data, meta } = await apiFetchList<PublicReview, { rating?: ProductRating | null }>(
    `/api/public/products/${encodeURIComponent(productId)}/reviews${s ? `?${s}` : ""}`,
  );

  return { data, meta, rating: meta.rating ?? null };
}

/**
 * GET /api/public/listings/:listingId/reviews — unauthenticated, 2026-11-08.
 *
 * The same body and rules as the product route above: no author identity, the
 * 10/50 paging, `totalPages`, `meta.rating` (with its distribution) or `null`.
 * A listing the public cannot see answers an empty page, not a 404. There is no
 * reply from the business (owner RS-8), so there is nothing to draw for one.
 */
export async function listListingReviews(
  listingId: string,
  query: { page?: number; limit?: number } = {},
): Promise<{ data: PublicReview[]; meta: ListMeta; rating: ProductRating | null }> {
  const qs = new URLSearchParams();
  if (query.page !== undefined) qs.set("page", String(query.page));
  if (query.limit !== undefined) qs.set("limit", String(query.limit));
  const s = qs.toString();

  const { data, meta } = await apiFetchList<PublicReview, { rating?: ProductRating | null }>(
    `/api/public/listings/${encodeURIComponent(listingId)}/reviews${s ? `?${s}` : ""}`,
  );

  return { data, meta, rating: meta.rating ?? null };
}
