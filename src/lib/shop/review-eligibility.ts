/**
 * The eligibility answer, as a result the review form can branch on. Pure, so
 * it is tested (review-eligibility.test.ts); `reviews.api.ts` does the request.
 *
 * 🔴 `GET /api/customer/reviews/eligibility` answers a refusal with a **200**:
 * `{ eligible: false, reason, existingReviewId }`, `reason` being the code the
 * write would have raised. Only a subject that does not exist still throws
 * (`404 REVIEW_SUBJECT_NOT_FOUND`). Treating every 200 as "eligible" offered
 * the form to customers who could not review, until 2026-11-09.
 */

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
  | { kind: "already"; existingReviewId: string | null }
  /** The subject can no longer take reviews (e.g. a listing its business archived). */
  | { kind: "notReviewable" }
  | { kind: "roleNotAllowed" }
  | { kind: "unknown" };

/** The error codes the eligibility read answers with. */
const ELIGIBILITY_CODES: Record<string, ReviewEligibility["kind"]> = {
  REVIEW_SUBJECT_NOT_FOUND: "notFound",
  REVIEW_NOT_ELIGIBLE: "notYet",
  REVIEW_SUBJECT_NOT_REVIEWABLE: "notReviewable",
  REVIEW_ALREADY_EXISTS: "already",
  REVIEW_ROLE_NOT_ALLOWED: "roleNotAllowed",
};

/** The 200 answer, as a result. */
export function eligibilityFrom(verdict: {
  eligible?: boolean;
  reason?: string | null;
  existingReviewId?: string | null;
} | null | undefined): ReviewEligibility {
  if (verdict?.eligible === true) return { kind: "eligible" };
  return eligibilityFromCode(verdict?.reason ?? undefined, verdict?.existingReviewId ?? null);
}

/** A code (a thrown one, or a 200's `reason`), as a result. */
export function eligibilityFromCode(code: string | undefined, existingReviewId: string | null): ReviewEligibility {
  const kind = code ? ELIGIBILITY_CODES[code] : undefined;
  if (kind === "already") return { kind: "already", existingReviewId };
  if (kind) return { kind } as ReviewEligibility;
  return { kind: "unknown" };
}

