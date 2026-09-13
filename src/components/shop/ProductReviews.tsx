"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button, Rating, Skeleton } from "@/components/shop/ds";
import { listProductReviews, type PublicReview } from "@/lib/shop/reviews.api";
import type { ProductRating } from "@/lib/shop/shop.types";

const PAGE_SIZE = 10;

/**
 * The published reviews of one product.
 *
 * ── What is deliberately not here ────────────────────────────────────────────
 *
 * **No author.** No name, no id, no initial — the public route publishes none.
 * This platform's customers are largely passwordless accounts created from a
 * phone number, so the only available display name is frequently derived from
 * it, and publishing a shopper's name beside their purchase history is a
 * decision nobody has taken.
 *
 * **No "verified purchase" badge**, because it would be noise: eligibility is
 * enforced server-side, so *every* published review is one. A badge that is
 * always present tells a reader nothing.
 *
 * The histogram comes from the product body's `rating.distribution`, which the
 * detail response already carries — hence the `rating` prop rather than a second
 * request for the same numbers.
 */
export function ProductReviews({
  productId,
  rating,
}: {
  productId: string;
  /** The aggregate from the product detail body. `null` when unreviewed. */
  rating: ProductRating | null;
}) {
  const t = useTranslations("shop.product.reviews");
  const tCommon = useTranslations("shop.common");
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (next: number) => {
      setLoading(true);
      try {
        const { data, meta } = await listProductReviews(productId, {
          page: next,
          limit: PAGE_SIZE,
        });
        setReviews((prev) => (next === 1 ? data : [...prev, ...data]));
        setPages(meta.pages);
        setPage(next);
      } catch {
        // A failed read leaves whatever is already rendered. The aggregate above
        // still stands — it came with the product body, not from here.
      } finally {
        setLoading(false);
      }
    },
    [productId],
  );

  // Only worth asking when the aggregate says something is published. An
  // unreviewed product answers an empty page rather than a 404, so this is an
  // optimisation, not a guard.
  useEffect(() => {
    if (rating && rating.count > 0) void load(1);
  }, [rating, load]);

  if (!rating || rating.count === 0) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        {t("none")}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Summary rating={rating} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {reviews.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}

        {loading && reviews.length === 0 && (
          <>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </>
        )}
      </div>

      {page < pages && (
        <div>
          <Button variant="secondary" size="sm" disabled={loading} onClick={() => void load(page + 1)}>
            {loading ? tCommon("loading") : t("showMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** The average, the count, and the 1–5 histogram when the detail body carried one. */
function Summary({ rating }: { rating: ProductRating }) {
  const t = useTranslations("shop.product.reviews");
  const distribution = rating.distribution;

  return (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
      <div>
        {/* Two decimals is what the API sends and what the trust composite
            reads; `toFixed(1)` is the display convention for a star widget. */}
        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>
          {rating.average.toFixed(1)}
        </div>
        <Rating value={rating.average} showValue={false} size={16} />
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {t("count", { n: rating.count })}
        </div>
      </div>

      {distribution && (
        <div style={{ flex: "1 1 220px", minWidth: 200, display: "grid", gap: 4 }}>
          {(["5", "4", "3", "2", "1"] as const).map((star) => {
            const n = distribution[star] ?? 0;
            const pct = rating.count > 0 ? (n / rating.count) * 100 : 0;
            return (
              <div key={star} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, width: 12, textAlign: "right" }}>{star}</span>
                <div
                  aria-hidden
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    background: "var(--star-empty)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--star)" }} />
                </div>
                <span className="muted" style={{ fontSize: 12, width: 24 }}>
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewRow({ review }: { review: PublicReview }) {
  // The shopper's locale, not the browser's — see LOCALISATION.md §6.
  const format = useFormatter();

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Rating value={review.rating} showValue={false} size={13} />
        {review.title && (
          <span style={{ fontWeight: 600, fontSize: 14.5 }}>{review.title}</span>
        )}
      </div>
      {review.body && (
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5 }}>{review.body}</p>
      )}
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        {format.dateTime(new Date(review.publishedAt), { dateStyle: "medium" })}
      </div>
    </div>
  );
}
