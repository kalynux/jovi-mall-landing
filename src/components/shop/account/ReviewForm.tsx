"use client";

import { useTranslations } from "next-intl";

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
 * Write a review of a product, a delivery, or a service listing.
 *
 * ── Public at once ───────────────────────────────────────────────────────────
 *
 * Since 2026-10-05 every review publishes the moment it is sent, text included
 * (owner decision), so the form says so BEFORE sending, always, not only once
 * the customer starts typing. (It used to say text was "checked first", which
 * stopped being true that day.) A delivery review never publishes; it is an
 * internal signal.
 *
 * A listing can be reviewed once the customer unlocked one of its contacts.
 * `refreshKey` re-asks eligibility, so unlocking a contact on the same page
 * makes the form appear without a reload.
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
  refreshKey,
}: {
  subjectType: ReviewSubjectType;
  /** Product id for `product`; **shipment** id for `delivery`; listing id for `listing`. */
  subjectId: string;
  /** What is being rated, for the heading. Never an agent's name. */
  label: string;
  onDone?: () => void;
  /** Changing it re-checks eligibility (a listing after a contact unlock). */
  refreshKey?: number;
}) {
  // Bound before the branches below — this component returns early five
  // different ways, so a hook further down would change the hook order.
  const t = useTranslations("shop.reviews");
  // Root-scoped, for the shared verbs in `shop.common`.
  const tKey = useTranslations();
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"sent" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await checkReviewEligibility(subjectType, subjectId);
      if (!cancelled) setEligibility(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectType, subjectId, refreshKey]);

  const submit = useCallback(async () => {
    if (rating < 1) return;
    setBusy(true);
    setError(null);
    try {
      await submitReview({ subjectType, subjectId, rating, title, body });
      setOutcome("sent");
      onDone?.();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "REVIEW_ALREADY_EXISTS") {
        // Terminal — there is no edit. Reflect it rather than inviting a retry.
        setEligibility({ kind: "already", existingReviewId: null });
      } else {
        setError(t("submitFailed"));
      }
    } finally {
      setBusy(false);
    }
  }, [rating, title, body, subjectType, subjectId, onDone, t]);

  if (outcome) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {subjectType === "delivery" ? t("thanksDelivery") : t("thanksPublished")}
      </p>
    );
  }

  // Still asking, or the subject is not ours to know about. Both render nothing.
  if (!eligibility || eligibility.kind === "notFound" || eligibility.kind === "unknown") return null;
  if (eligibility.kind === "roleNotAllowed") return null;
  // A listing its business archived takes no new reviews; there is nothing to
  // explain to someone who may not even know that happened.
  if (eligibility.kind === "notReviewable" && subjectType === "listing") return null;

  if (eligibility.kind === "already") {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {t("alreadyReviewed")}
      </p>
    );
  }

  if (eligibility.kind === "notYet" || eligibility.kind === "notReviewable") {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        {subjectType === "product"
          ? t("notYetProduct")
          : subjectType === "listing"
            ? t("notYetListing")
            : t("notYetDelivery")}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 14.5 }}>
        {subjectType === "delivery" ? t("rateDelivery") : t("rateProduct", { label })}
      </div>

      {/* Integer 1–5. There is no half-star: the trust composite reads this
          number and a half is not a value it accepts. */}
      <div role="radiogroup" aria-label={t("ratingLabel")} style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("starLabel", { n })}
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
        className="field"
        placeholder={t("titlePlaceholder")}
        maxLength={MAX_TITLE}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="field"
        placeholder={t("bodyPlaceholder")}
        maxLength={MAX_BODY}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      {/* Said before they send, always: it is public the moment it is sent. */}
      <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45 }}>
        {subjectType === "delivery" ? t("deliveryPrivateNote") : t("publicNote")}
      </p>

      {error && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>{error}</p>
      )}

      <div>
        <Button size="sm" disabled={rating < 1 || busy} onClick={() => void submit()}>
          {busy ? tKey("shop.common.sending") : tKey("shop.common.submit")}
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
  onDone,
  refreshKey,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  label: string;
  onDone?: () => void;
  refreshKey?: number;
}) {
  const t = useTranslations("shop.reviews");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="ghost" size="sm" leadingIcon="star" onClick={() => setOpen(true)}>
        {subjectType === "product"
          ? t("rateThis")
          : subjectType === "listing"
            ? t("rateThisBusiness")
            : t("rateTheDelivery")}
      </Button>
    );
  }

  return (
    <ReviewForm
      subjectType={subjectType}
      subjectId={subjectId}
      label={label}
      onDone={onDone}
      refreshKey={refreshKey}
    />
  );
}
