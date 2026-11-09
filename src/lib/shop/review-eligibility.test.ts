/**
 * The review eligibility answer. Run with `npm test`.
 *
 * The regression this exists for: the endpoint answers a refusal with a 200
 * (`eligible: false`), and the client read every 200 as "eligible", so the
 * form was offered to customers who could not review.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { eligibilityFrom, eligibilityFromCode } from "./review-eligibility";

test("only `eligible: true` is eligible", () => {
  assert.deepEqual(eligibilityFrom({ eligible: true, reason: null, existingReviewId: null }), { kind: "eligible" });
  assert.notDeepEqual(eligibilityFrom({ eligible: false, reason: null, existingReviewId: null }), { kind: "eligible" });
  assert.deepEqual(eligibilityFrom(null), { kind: "unknown" });
  assert.deepEqual(eligibilityFrom({}), { kind: "unknown" });
});

test("a 200 refusal is read from its reason", () => {
  assert.deepEqual(eligibilityFrom({ eligible: false, reason: "REVIEW_NOT_ELIGIBLE" }), { kind: "notYet" });
  assert.deepEqual(eligibilityFrom({ eligible: false, reason: "REVIEW_SUBJECT_NOT_REVIEWABLE" }), {
    kind: "notReviewable",
  });
  assert.deepEqual(eligibilityFrom({ eligible: false, reason: "REVIEW_ROLE_NOT_ALLOWED" }), { kind: "roleNotAllowed" });
});

test("an existing review keeps its id", () => {
  assert.deepEqual(eligibilityFrom({ eligible: false, reason: "REVIEW_ALREADY_EXISTS", existingReviewId: "r1" }), {
    kind: "already",
    existingReviewId: "r1",
  });
});

test("a thrown 404 and an unknown code", () => {
  assert.deepEqual(eligibilityFromCode("REVIEW_SUBJECT_NOT_FOUND", null), { kind: "notFound" });
  assert.deepEqual(eligibilityFromCode("SOMETHING_NEW", null), { kind: "unknown" });
  assert.deepEqual(eligibilityFromCode(undefined, null), { kind: "unknown" });
});
