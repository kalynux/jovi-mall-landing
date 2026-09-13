"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge, EmptyState, Rating, Skeleton } from "@/components/shop/ds";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { listMyReviews, type Review } from "@/lib/shop/reviews.api";

/**
 * The customer's own reviews.
 *
 * `GET /api/customer/reviews` returns **every status**, including `pending` rows
 * that are not yet visible to anyone else — which is the entire reason this page
 * can exist. A shopper who wrote a review and cannot find it on the product page
 * would otherwise have no way to learn it is simply waiting to be checked.
 *
 * Delivery reviews appear here too. They are **never published** — they are an
 * internal quality signal — so their row says so rather than showing a status
 * that implies it is queued for a page it will never reach.
 */
export default function MyReviewsPage() {
  const t = useTranslations("shop.reviews");
  // Root-scoped: both the screen title and the "My orders" action already exist
  // in `shop.nav`, which Phase 1 froze.
  const tKey = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { status } = useAuthGuard();
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    listMyReviews({ limit: 50 })
      .then(({ data }) => {
        if (!cancelled) setReviews(data);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading" || reviews === null) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
        <Skeleton height={72} style={{ marginBottom: 10 }} />
        <Skeleton height={72} style={{ marginBottom: 10 }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.reviews")}</h1>

      {reviews.length === 0 ? (
        <EmptyState
          icon="star"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actionLabel={tKey("shop.nav.titles.orders")}
          onAction={() => router.push("/shop/account/orders")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reviews.map((review) => (
            <div
              key={review.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Rating value={review.rating} showValue={false} size={14} />
                <StatusBadge review={review} />
                <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
                  {format.dateTime(new Date(review.createdAt), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              {review.title && (
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{review.title}</div>
              )}
              {review.body && (
                <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5 }}>{review.body}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ review }: { review: Review }) {
  const t = useTranslations("shop.reviews");

  // A delivery review is an internal signal and never publishes, so "pending"
  // would be a promise the platform has no intention of keeping.
  if (review.subjectType === "delivery") {
    return (
      <Badge size="sm" tone="neutral" icon="truck">
        {t("deliveryFeedback")}
      </Badge>
    );
  }

  if (review.status === "published") {
    return (
      <Badge size="sm" tone="success" icon="circle-check-big">
        {t("published")}
      </Badge>
    );
  }

  if (review.status === "rejected") {
    return (
      <Badge size="sm" tone="danger" icon="circle-x">
        {t("notPublished")}
      </Badge>
    );
  }

  return (
    <Badge size="sm" tone="warning" icon="clock">
      {t("beingChecked")}
    </Badge>
  );
}
