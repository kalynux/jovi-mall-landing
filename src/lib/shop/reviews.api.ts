/**
 * Reviews — `/api/customer/reviews` and `/api/public/products/:id/reviews`.
 *
 * A customer reviews two different things and they behave differently: a
 * **product** they bought, and a **delivery** they received. Only the first is
 * ever published.
 *
 * See api-doc/customer/reviews.md and api-doc/reviews.md.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { ListMeta, ProductRating } from "./shop.types";

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
export type ReviewSubjectType = "product" | "delivery";

/** `product` → the product id. `delivery` → the **shipment** id, not the order. */
export type ReviewStatus = "pending" | "published" | "rejected";

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
  /** Optional, 1–120 chars. **Its presence holds the review for moderation.** */
  title?: string;
  /** Optional, 1–2000 chars. **Its presence holds the review for moderation.** */
  body?: string;
}

/**
 * POST /api/customer/reviews
 *
 * 🔴 **Whether you send text decides whether it publishes immediately.**
 *
 * ```
 * title or body present  ->  status: "pending"    (held for moderation)
 * neither present        ->  status: "published"  (live now)
 * ```
 *
 * The response says which happened, in `status`. **Branch on it** — a bare five
 * stars appears on the product page at once; the same five stars with a sentence
 * attached does not, and a UI that says "your review is live" in both cases is
 * wrong half the time.
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
 * Why a review form should not be shown.
 *
 * The 404-vs-422 split is load-bearing, so these are kept apart rather than
 * flattened into "cannot review":
 *
 * `notFound`  — the subject does not exist **or** it is not yours. Deliberately
 *               the same answer for both, so probing ids cannot confirm which.
 *               Show nothing, and no message naming the subject.
 * `notYet`    — it *is* yours but has not reached a reviewable state. Safe to be
 *               specific about: it tells the caller nothing they did not know.
 * `already`   — there is already a review; show it instead of a form.
 */
export type ReviewEligibility =
  | { kind: "eligible" }
  | { kind: "notFound" }
  | { kind: "notYet" }
  | { kind: "already" }
  | { kind: "roleNotAllowed" }
  | { kind: "unknown" };

/** The error codes the eligibility read answers with. */
const ELIGIBILITY_CODES: Record<string, ReviewEligibility["kind"]> = {
  REVIEW_SUBJECT_NOT_FOUND: "notFound",
  REVIEW_NOT_ELIGIBLE: "notYet",
  REVIEW_SUBJECT_NOT_REVIEWABLE: "notYet",
  REVIEW_ALREADY_EXISTS: "already",
  REVIEW_ROLE_NOT_ALLOWED: "roleNotAllowed",
};

/**
 * GET /api/customer/reviews/eligibility
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
    await apiFetch<unknown>(`/api/customer/reviews/eligibility?${qs}`);
    return { kind: "eligible" };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code && code in ELIGIBILITY_CODES) return { kind: ELIGIBILITY_CODES[code] };
    return { kind: "unknown" };
  }
}

/**
 * GET /api/customer/reviews — this customer's own reviews, **every status**.
 *
 * Including `pending` rows not yet visible to anyone else, which is what lets an
 * account page show "awaiting moderation".
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
