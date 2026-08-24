"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Icon } from "@/components/shop/ds";
import {
  checkReviewEligibility,
  submitReview,
  type ReviewEligibility,
  type ReviewSubjectType,
} from "@/lib/shop/reviews.api";

const MAX_TITLE = 120;
const MAX_BODY = 2000;

/**
 * Write a review of a product or a delivery.
 *
 * ── Eligibility is checked before anything is drawn ──────────────────────────
 *
 * The contract asks for this explicitly, and the refusals are kept apart rather
 * than flattened, because the 404-vs-422 split is load-bearing:
 *
 *  - `notFound` (404) means the subject does not exist **or is not yours**, and
 *    those are deliberately the same answer so that probing ids cannot confirm
 *    which. So this renders **nothing at all** — not an error, and not a message
 *    naming the subject.
 *  - `notYet` (422) is only ever returned to somebody who already knows the
 *    subject exists, so it is safe to explain.
 *
 * ── 🔴 A delivery review must not name the agent ─────────────────────────────
 *
 * The customer rates *the delivery*; attribution to an agent happens
 * server-side and this endpoint never discloses one. That the order-detail page
 * shows a carrying agent under ADR-A06 is a separate disclosure with its own
 * gate — it does not license naming them here, and a delivery rating moves real
 * money, since it feeds the trust composite that scales an agent's COD limit.
 */
export function ReviewForm({
  subjectType,
  subjectId,
  label,
  onDone,
}: {
  subjectType: ReviewSubjectType;
  /** Product id for `product`; **shipment** id for `delivery`. */
  subjectId: string;
  /** What is being rated, for the heading. Never an agent's name. */
  label: string;
  onDone?: () => void;
}) {
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"published" | "pending" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await checkReviewEligibility(subjectType, subjectId);
      if (!cancelled) setEligibility(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectType, subjectId]);

  const submit = useCallback(async () => {
    if (rating < 1) return;
    setBusy(true);
    setError(null);
    try {
      const review = await submitReview({ subjectType, subjectId, rating, title, body });
      /**
       * 🔴 Branch on the returned `status`, not on what we sent.
       *
       * Text present holds the review for moderation; a bare rating publishes at
       * once. Saying "your review is live" in both cases is wrong half the time,
       * and the response is the only thing that actually knows.
       */
      setOutcome(review.status === "published" ? "published" : "pending");
      onDone?.();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "REVIEW_ALREADY_EXISTS") {
        // Terminal — there is no edit. Reflect it rather than inviting a retry.
        setEligibility({ kind: "already" });
      } else {
        setError("Could not send your review. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }, [rating, title, body, subjectType, subjectId, onDone]);

  if (outcome) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {outcome === "published"
          ? "Thanks — your rating is live."
          : "Thanks — your review will appear once it has been checked."}
      </p>
    );
  }

  // Still asking, or the subject is not ours to know about. Both render nothing.
  if (!eligibility || eligibility.kind === "notFound" || eligibility.kind === "unknown") return null;
  if (eligibility.kind === "roleNotAllowed") return null;

  if (eligibility.kind === "already") {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        You have already reviewed this.
      </p>
    );
  }

  if (eligibility.kind === "notYet") {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {subjectType === "product"
          ? "You can review this once your order is complete."
          : "You can rate this delivery once it has arrived."}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 14.5 }}>
        {subjectType === "product" ? `Rate ${label}` : "Rate this delivery"}
      </div>

      {/* Integer 1–5. There is no half-star: the trust composite reads this
          number and a half is not a value it accepts. */}
      <div role="radiogroup" aria-label="Rating" style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            style={{ background: "none", border: "none", padding: 2, cursor: "pointer" }}
          >
            <Icon
              name="star"
              size={26}
              style={{
                color: n <= rating ? "var(--star)" : "var(--star-empty)",
                fill: n <= rating ? "var(--star)" : "transparent",
              }}
            />
          </button>
        ))}
      </div>

      <input
        className="input"
        placeholder="Title (optional)"
        maxLength={MAX_TITLE}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input"
        placeholder="Tell others about it (optional)"
        maxLength={MAX_BODY}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      {/* Said before they write, not after: whether text is attached is what
          decides between publishing now and waiting for moderation. */}
      {(title.trim() || body.trim()) && (
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Reviews with text are checked before they appear.
        </p>
      )}

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>{error}</p>
      )}

      <div>
        <Button size="sm" disabled={rating < 1 || busy} onClick={() => void submit()}>
          {busy ? "Sending…" : "Submit"}
        </Button>
      </div>
    </div>
  );
}

/**
 * A "Rate this" button that expands into a {@link ReviewForm}.
 *
 * The eligibility read only happens once the form mounts, which is what makes
 * this safe to place on every line of an order: a five-item order costs zero
 * requests until somebody actually wants to rate something.
 */
export function ReviewDisclosure({
  subjectType,
  subjectId,
  label,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" leadingIcon="star" onClick={() => setOpen(true)}>
        {subjectType === "product" ? "Rate this" : "Rate the delivery"}
      </Button>
    );
  }

  return <ReviewForm subjectType={subjectType} subjectId={subjectId} label={label} />;
}
