"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Badge, EmptyState, Icon, Rating, Skeleton } from "@/components/shop/ds";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { listMyReviews, type Review } from "@/lib/shop/reviews.api";
import { listListingsByIds, listProductsByIds } from "@/lib/shop/catalog.api";
import { listingPath, productPathFor } from "@/lib/shop/shop.routes";

/** What a review is about, as this page can name it. */
type Subject = { title: string; href: string; kind: "product" | "listing" };

/**
 * The customer's own reviews.
 *
 * `GET /api/customer/reviews` returns both statuses: `published`, and
 * `unpublished` when an administrator took one down (the author sees only that,
 * never why). Since 2026-10-05 nothing is ever "waiting to be checked".
 *
 * Each row names what it reviewed. The rows carry only ids, so the titles come
 * from one `by-ids` read per kind (products, and since 2026-11-08 service
 * listings), as the changelog asks. A subject that no longer resolves keeps its
 * review row, unnamed.
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
  const [subjects, setSubjects] = useState<Map<string, Subject>>(new Map());

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    listMyReviews({ limit: 50 })
      .then(async ({ data }) => {
        if (cancelled) return;
        setReviews(data);
        // Names are a nicety: a failed lookup leaves the rows as they are.
        const productIds = data.filter((r) => r.subjectType === "product").map((r) => r.subjectId);
        const listingIds = data.filter((r) => r.subjectType === "listing").map((r) => r.subjectId);
        const [products, listings] = await Promise.all([
          productIds.length ? listProductsByIds(productIds).catch(() => null) : null,
          listingIds.length ? listListingsByIds(listingIds).catch(() => null) : null,
        ]);
        const map = new Map<string, Subject>();
        for (const p of products?.products ?? []) {
          map.set(`product:${p.id}`, { title: p.title, href: productPathFor(p), kind: "product" });
        }
        for (const l of listings?.listings ?? []) {
          map.set(`listing:${l.id}`, { title: l.title, href: listingPath(l.slug), kind: "listing" });
        }
        if (!cancelled) setSubjects(map);
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

              <SubjectLine review={review} subject={subjects.get(`${review.subjectType}:${review.subjectId}`)} />

              {review.title && (
                <div className="ds-ugc" style={{ fontWeight: 700, fontSize: 14.5 }}>{review.title}</div>
              )}
              {review.body && (
                <p className="ds-ugc" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5 }}>{review.body}</p>
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

  // `unpublished`: an administrator took it down. No reason is shown, by
  // owner decision; the author only learns it is no longer public.
  return (
    <Badge size="sm" tone="neutral" icon="circle-slash">
      {t("notPublished")}
    </Badge>
  );
}

/** "Product · Blue shirt", linked; or just the kind while the name loads or is gone. */
function SubjectLine({ review, subject }: { review: Review; subject: Subject | undefined }) {
  const t = useTranslations("shop.reviews");
  if (review.subjectType === "delivery") return null;
  const kindLabel = review.subjectType === "listing" ? t("subjectListing") : t("subjectProduct");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 13, minWidth: 0 }}>
      <Icon
        name={review.subjectType === "listing" ? "megaphone" : "package"}
        size={14}
        style={{ color: review.subjectType === "listing" ? "var(--type-listing)" : "var(--text-muted)", flexShrink: 0 }}
      />
      {subject ? (
        <Link
          href={subject.href}
          className="ds-ugc"
          aria-label={t("subjectAria", { kind: kindLabel, title: subject.title })}
          style={{ fontWeight: 600, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {subject.title}
        </Link>
      ) : (
        <span className="muted">{kindLabel}</span>
      )}
    </div>
  );
}
