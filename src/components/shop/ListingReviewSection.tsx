"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@/components/shop/ds";
import { ListingReviews } from "@/components/shop/ProductReviews";
import { ReviewForm } from "@/components/shop/account/ReviewForm";
import { useAuth } from "@/lib/auth/useAuth";
import { isCustomerSession } from "@/lib/shop/customer-session";
import { checkReviewEligibility, type ReviewEligibility } from "@/lib/shop/reviews.api";
import type { PublicListingDetail } from "@/lib/shop/listings";

/**
 * A listing's reviews: what customers said, and the way to add one
 * (api-doc/public/FRONTEND-CHANGELOG-listing-reviews.md,
 * api-doc/customer/FRONTEND-CHANGELOG-listing-reviews-saves.md § 2).
 *
 * - Everyone sees the published reviews. No author, and no reply slot: the
 *   business cannot answer (owner RS-8).
 * - "Rate this business" is drawn only when the eligibility check says
 *   `eligible`, which means this customer unlocked at least one contact
 *   (owner L-27). `revealCount` re-asks after an unlock on this page, so the
 *   button appears without a reload.
 * - Not eligible yet: one quiet line saying how to become eligible. Already
 *   reviewed: say so. Signed out: nothing here, the contact panel already
 *   asks them to sign in.
 */
export function ListingReviewSection({
  listing,
  revealCount,
}: {
  listing: PublicListingDetail;
  /** Bumped by the contact panel on every successful unlock. */
  revealCount: number;
}) {
  const t = useTranslations("shop.listings.reviews");
  const { status, role } = useAuth();
  const customer = isCustomerSession(status, role);
  const business = listing.companyName || listing.title;

  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [writing, setWriting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!customer) return;
    let cancelled = false;
    checkReviewEligibility("listing", listing.id).then((result) => {
      if (!cancelled) setEligibility(result);
    });
    return () => {
      cancelled = true;
    };
  }, [customer, listing.id, revealCount, reloadKey]);

  const kind = customer ? eligibility?.kind : undefined;

  return (
    <section
      id="listing-reviews"
      aria-labelledby="listing-reviews-heading"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        scrollMarginTop: 80,
      }}
    >
      <h2
        id="listing-reviews-heading"
        style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: "var(--text-strong)" }}
      >
        {t("title")}
      </h2>

      {writing ? (
        <div className="listing-consent" style={{ marginTop: 0, marginBottom: 16 }}>
          <ReviewForm
            subjectType="listing"
            subjectId={listing.id}
            label={business}
            onDone={() => setReloadKey((k) => k + 1)}
          />
        </div>
      ) : kind === "eligible" ? (
        <div style={{ marginBottom: 16 }}>
          <Button variant="secondary" leadingIcon="star" onClick={() => setWriting(true)}>
            {t("rate")}
          </Button>
        </div>
      ) : kind === "already" ? (
        <p className="muted" style={{ display: "flex", gap: 6, alignItems: "center", margin: "0 0 14px", fontSize: 13.5 }}>
          <Icon name="circle-check-big" size={15} style={{ color: "var(--success)", flexShrink: 0 }} />
          {t("already")}
        </p>
      ) : kind === "notYet" ? (
        <p className="muted" style={{ display: "flex", gap: 6, alignItems: "center", margin: "0 0 14px", fontSize: 13.5 }}>
          <Icon name="lock" size={14} style={{ flexShrink: 0 }} />
          {t("unlockFirst")}
        </p>
      ) : null}

      <ListingReviews listingId={listing.id} rating={listing.rating} reloadKey={reloadKey} />
    </section>
  );
}
