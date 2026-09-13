"use client";

import { useTranslations } from "next-intl";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  Avatar,
  Badge,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  PriceDisplay,
  ProductCard,
  QtyStepper,
  Rating,
  Tabs,
  type IconName,
} from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { CART_OFFLINE_MESSAGE_KEY } from "@/lib/shop/cart-errors";
import { useShopPageTitle } from "@/components/shop/ShopChrome";
import { availabilityLabelKey, unavailableLabelKey } from "@/lib/shop/availability";
import { discountPct, formatMoney } from "@/lib/shop/format";
import { tapFeedback } from "@/lib/native/haptics";
import { productPathFor, storePath } from "@/lib/shop/shop.routes";
import { recordView } from "@/lib/shop/saved.api";
import { ProductReviews } from "@/components/shop/ProductReviews";
import { BookingPanel } from "@/components/shop/BookingPanel";
import type {
  CancellationPolicy,
  Product,
  ProductListItem,
  ReturnPolicy,
} from "@/lib/shop/shop.types";
import { publicUrl } from "@/lib/shop/shop.types";

/**
 * The product page.
 *
 * ── Variants are selected on ids, never on displayed text ────────────────────
 *
 * Each variant carries `optionValueIds` and a pre-joined `options[]`, and the
 * selection is a **set of value ids**. That is not incidental: the API
 * deliberately does not publish `optionSignature`, because renaming an option
 * value is a documented safe operation that does not rewrite the stored
 * signature — so a client that rebuilds `"size:large|color:red"` from what is on
 * screen fails to find a variant that exists the moment a vendor renames "Red"
 * to "Crimson".
 *
 * ── What this page no longer claims ──────────────────────────────────────────
 *
 * No star rating, no review count, no "512 sold", and no "Only 3 left". The
 * first three had no backend at all; the last is a number the API refuses to
 * publish, because availability on a five-minute-cached page is wrong the moment
 * it is read. Availability is a boolean, per variant.
 *
 * ── Digital is bought, not carted ────────────────────────────────────────────
 *
 * A digital order is capped at **one product, quantity one, one vendor**, needs
 * no address and ships nothing. Every screen a cart exists to serve — quantities,
 * a second line, delivery, a per-seller split — is empty for it, so the cart step
 * is a page the shopper clicks through to reach the only thing left: paying. The
 * button therefore says "Buy now" and goes straight to checkout.
 *
 * The cart row still exists (there is exactly one cart server-side, and this is
 * it), so an abandoned checkout is still recoverable from `/shop/cart`. It is
 * just not a step anyone is walked through.
 */

interface Props {
  product: Product;
  locale: string;
  /** Same-store products, fetched server-side. A plain query, not a recommender. */
  moreFromStore?: ProductListItem[];
  /** The platform's recommender strip. */
  related?: ProductListItem[] | { product: ProductListItem; orders: number | null }[];
  /**
   * 🔴 Which signal produced `related`, and therefore what the heading may
   * claim. `co_purchase` is genuinely behavioural; `same_category` is the
   * fallback and is the common case on a young catalogue. Heading a
   * category-recency list "customers also bought" is a claim about other
   * shoppers that is not true, which is why the backend publishes this rather
   * than letting a client assume.
   */
  relatedSource?: "co_purchase" | "same_category";
}

/** Order-insensitive set equality — a variant's selection is a set, not a list. */
function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export function ProductDetail({
  product: p,
  locale,
  moreFromStore = [],
  related = [],
  relatedSource = "same_category",
}: Props) {
  const router = useRouter();
  const { addItem, productType, count } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const { flash } = useToast();
  const t = useTranslations("shop.product");
  const tDs = useTranslations("shop.ds");
  const tCommon = useTranslations("shop.common");
  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();

  // The header bar says which product this is, so a shopper who has scrolled
  // past the <h1> still knows. Route-derived it could only say "Product".
  useShopPageTitle(p.title);

  /**
   * Record that this product was opened.
   *
   * `POST /api/customer/recently-viewed` carries no timestamp and cannot be made
   * to — the server clock is the only source, because the list is ordered *and*
   * capped by that value and a client-supplied one would be a client-chosen
   * position in a bounded list.
   *
   * Re-viewing moves the entry to the head rather than duplicating it, so firing
   * this on every open is correct and needs no de-duplication here. It is
   * best-effort: `recordView` swallows the 403 a signed-out visitor gets and the
   * 404 for a product that just became unpublishable, because opening a page
   * must not fail on a history write.
   */
  useEffect(() => {
    void recordView(p.id);
  }, [p.id]);

  /**
   * The endpoint returns `{ product, orders }` rows; a caller may also pass bare
   * rows. `orders` is deliberately not rendered — it is drawn from a bounded
   * sample of recent orders, so it is evidence of a pattern rather than an
   * audited total, and a precise-looking count invites being read as one.
   */
  const relatedItems = useMemo<ProductListItem[]>(
    () =>
      related.map((entry) =>
        "product" in entry ? entry.product : entry,
      ),
    [related],
  );

  const store = p.store;
  const isService = p.type === "service";
  const isDigital = p.type === "digital";

  /**
   * The default is only reported when it points at something buyable, so it is
   * trustworthy where present; the first variant covers a product whose default
   * was archived.
   */
  const initialVariant = useMemo(
    () => p.variants.find((v) => v.id === p.defaultVariantId) ?? p.variants[0],
    [p.variants, p.defaultVariantId]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>(initialVariant?.optionValueIds ?? []);
  const [imgIndex, setImgIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("desc");
  /** The cart holds the other product type; set while the shopper decides. */
  const [conflict, setConflict] = useState<{ current: "physical" | "digital" } | null>(null);
  const [working, setWorking] = useState(false);

  const variant = useMemo(
    () => p.variants.find((v) => sameSelection(v.optionValueIds, selectedIds)) ?? initialVariant,
    [p.variants, selectedIds, initialVariant]
  );

  /**
   * Choosing a value swaps it for the one already selected on that option, then
   * keeps the rest — so picking "L" on a size/colour product holds the colour.
   * If that exact combination is not a real variant, the nearest one carrying
   * the clicked value wins, which is better than leaving the picker pointing at
   * nothing.
   */
  const chooseValue = useCallback(
    (optionId: string, valueId: string) => {
      const option = p.options.find((o) => o.id === optionId);
      const siblings = new Set(option?.values.map((v) => v.id) ?? []);
      const next = [...selectedIds.filter((id) => !siblings.has(id)), valueId];

      const exact = p.variants.find((v) => sameSelection(v.optionValueIds, next));
      if (exact) {
        setSelectedIds(next);
      } else {
        const nearest = p.variants.find((v) => v.optionValueIds.includes(valueId));
        if (nearest) setSelectedIds(nearest.optionValueIds);
      }
      setQty(1);
    },
    [p.options, p.variants, selectedIds]
  );

  // Variant media replaces the product gallery rather than merging with it —
  // that is the rule the API's own image resolver applies, so following it here
  // keeps the two consistent.
  const gallery = variant?.images?.length ? variant.images : p.images;
  const image = gallery[Math.min(imgIndex, Math.max(0, gallery.length - 1))];

  const buyable = Boolean(variant?.inStock) && !isService;
  const unitPrice = variant?.price ?? p.variants[0]?.price ?? 0;
  const currency = variant?.currency ?? "XAF";
  const pct = discountPct(unitPrice, variant?.compareAtPrice);
  const lineQty = p.type === "physical" ? qty : 1;

  /** Digital skips the cart entirely — see the note at the top of this file. */
  const buyNow = isDigital;

  /**
   * One attempt at the cart.
   *
   * `replace: false` is the shopper pressing the button; `replace: true` is them
   * answering the dialog. The two are the same call because the server holds one
   * cart with one product type, and swapping type is a real deletion — so it is
   * announced before it happens rather than resolved silently, which is the whole
   * reason `addItem` reports `type_conflict` instead of just doing it.
   */
  const commit = useCallback(
    async (replace: boolean) => {
      if (!variant) return;
      setWorking(true);

      try {
        const outcome = await addItem(p, variant, { qty: lineQty, replace });

        // Anything but a fresh conflict closes the dialog — including a failure,
        // which must not leave the shopper staring at a question already asked.
        if (!(outcome.kind === "type_conflict" && !replace)) setConflict(null);

        switch (outcome.kind) {
          case "added":
            if (buyNow) {
              // Straight to payment. No toast: the navigation is the feedback,
              // and a "added to cart" flash would describe a step that is not
              // happening.
              router.push("/shop/checkout");
            } else {
              // The toast is the message; the tap is the confirmation you feel
              // without reading. Fire-and-forget, and silent on the web.
              void tapFeedback();
              flash(t("addedToCart", { variant: variant.name }));
            }
            break;
          case "type_conflict":
            if (replace) {
              // The retry conflicted too, which the server should not do —
              // report it rather than failing silently.
              flash(t("replaceFailed"));
            } else {
              setConflict({ current: outcome.current });
            }
            break;
          case "digital_limit":
            flash(t("digitalLimit"));
            break;
          case "service_not_allowed":
            flash(t("serviceNotCarted"));
            break;
          case "offline":
            flash(tKey(CART_OFFLINE_MESSAGE_KEY));
            break;
          case "error":
            flash(outcome.message ?? tKey(outcome.messageKey));
            break;
          default:
            // Exhaustive: a new outcome must choose what the shopper is told.
            // Without this an unhandled `kind` falls out of the switch and the
            // button simply does nothing, which is the failure mode this screen
            // can least afford — it is the main "Add to cart".
            outcome satisfies never;
        }
      } finally {
        setWorking(false);
      }
    },
    [addItem, p, variant, lineQty, buyNow, router, flash, tKey, t]
  );

  /**
   * The cart's type when it disagrees with this product's.
   *
   * Non-null means pressing the button destroys something, and the same two facts
   * — what is held, and what the button does to it — write both the note under
   * the button and the dialog body. A service is excluded: it is never carted, so
   * it never conflicts.
   */
  const held = !isService && productType && productType !== p.type ? productType : null;

  // The count lives inside the message, not beside it: "1 item"/"2 items" is a
  // plural rule, and it is not the same rule in Arabic. See LOCALISATION.md §4.
  const conflictNote =
    held === "digital"
      ? t("conflictNoteDigital")
      : held === "physical"
        ? t("conflictNotePhysical", { n: count })
        : null;

  const tabs = [
    { value: "desc", label: t("tabDescription") },
    { value: "specs", label: isDigital ? t("tabIncluded") : t("tabSpecs") },
    { value: "policies", label: t("tabPolicies") },
    { value: "reviews", label: t("tabReviews"), count: p.rating?.count || undefined },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <button
        onClick={() => router.push("/shop")}
        className="mb-4 inline-flex items-center gap-1.5"
        style={{
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Icon name="arrow-left" size={16} /> {t("backToShop")}
      </button>

      {store.isOpen === false && (
        <Notice tone="warning" icon="palmtree">
          {t.rich("holidayNotice", {
            store: store.name,
            b: (chunks) => <strong>{chunks}</strong>,
          })}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div
            style={{
              position: "relative",
              background: "var(--surface-2)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={publicUrl(image) ?? "/no_product_image.png"}
              alt={image?.originalName ?? p.title}
              style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
              
            />
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
              <Badge productType={p.type} variant="solid">
                {tDs(`productType.${p.type}`)}
              </Badge>
              {pct && (
                <Badge tone="danger" variant="solid">
                  -{pct}%
                </Badge>
              )}
            </div>
          </div>
          {gallery.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", scrollbarWidth: "none" }}>
              {gallery.map((im, i) => (
                <button
                  key={im.id}
                  onClick={() => setImgIndex(i)}
                  style={{
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    border: imgIndex === i ? "2px solid var(--brand)" : "1.5px solid var(--border)",
                    padding: 0,
                    cursor: "pointer",
                    background: "none",
                  }}
                  aria-label={t("imageAria", { n: i + 1 })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicUrl(im) ?? "/no_product_image.png"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info + buy box */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <button
            onClick={() => router.push(storePath(store.slug))}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: 0,
              marginBottom: 10,
            }}
          >
            <Avatar name={store.name} src={publicUrl(store.logo)} size={24} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>{store.name}</span>
            {store.verified && <Icon name="badge-check" size={14} style={{ color: "var(--brand)" }} />}
            <Icon name="chevron-right" size={14} style={{ color: "var(--text-subtle)" }} />
          </button>

          {/* Only when the API sent an aggregate. It is null (never a
              zero-count) for a product nobody has reviewed, so there is no
              "0.0 (0)" to render and nothing to suppress. */}
          {p.rating && (
            <button
              type="button"
              onClick={() => setTab("reviews")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: "none",
                background: "none",
                padding: 0,
                marginBottom: 8,
                cursor: "pointer",
              }}
            >
              <Rating value={p.rating.average} count={p.rating.count} />
            </button>
          )}

          {/* `ds-ugc`: a vendor-written title, in a page that may be RTL. */}
          <h1
            className="ds-ugc"
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              margin: "0 0 10px",
              color: "var(--text-strong)",
            }}
          >
            {p.title}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Badge tone="neutral" variant="outline" size="sm">
              {p.category}
            </Badge>
            {store.city && (
              <span className="muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Icon name="map-pin" size={13} /> {store.city}
              </span>
            )}
            <LanguageNote contentLanguage={p.contentLanguage} locale={locale} />
          </div>

          <div style={{ marginTop: 14 }}>
            {isService && variant?.service ? (
              <div>
                <PriceDisplay
                  amount={variant.service.priceFrom}
                  currency={currency}
                  range={{ min: variant.service.priceFrom, max: variant.service.priceFrom }}
                  size="lg"
                />
                <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  {t("serviceRateNote", { unit: variant.service.priceUnit })}
                </p>
              </div>
            ) : (
              <PriceDisplay
                amount={unitPrice}
                compareAt={variant?.compareAtPrice}
                currency={currency}
                size="lg"
              />
            )}
          </div>

          {/* Option pickers. A simple-mode product has none and skips this. */}
          {p.options.length > 0 && (
            <div style={{ marginTop: 18 }}>
              {p.options.map((option) => (
                <div key={option.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text-strong)" }}>
                      {option.name}
                    </span>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {variant?.options.find((o) => o.optionId === option.id)?.value ?? "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {option.values.map((value) => {
                      // A value with no sellable variant behind it is disabled
                      // rather than hidden: the vendor lists the option, and
                      // hiding it would make the range look smaller than it is.
                      const exists = p.variants.some((v) => v.optionValueIds.includes(value.id));
                      return (
                        <Chip
                          key={value.id}
                          selected={selectedIds.includes(value.id)}
                          disabled={!exists}
                          onClick={() => chooseValue(option.id, value.id)}
                        >
                          {value.value}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {variant && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                // A variant name is vendor-authored and is often an unbroken SKU
                // ("WLEC-6A6A89B612F99CB833AA1059"), which is wider than a phone
                // and has no space to break at. Wrap the row, and let the name
                // itself break anywhere rather than push the page sideways.
                flexWrap: "wrap",
                gap: 8,
                fontSize: 13,
                color: "var(--text-body)",
                background: "var(--brand-subtle)",
                border: "1px solid var(--success-border)",
                borderRadius: "var(--radius-md)",
                padding: "9px 12px",
              }}
            >
              <Icon name="check" size={16} style={{ color: "var(--brand)", flexShrink: 0 }} />
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                {t.rich("buyingVariant", {
                  variant: variant.name,
                  b: (chunks) => <strong>{chunks}</strong>,
                })}
              </span>
              {/* A boolean, because that is what the API publishes. */}
              <span
                style={{
                  marginLeft: "auto",
                  fontWeight: 700,
                  color: variant.inStock ? "var(--success)" : "var(--danger)",
                }}
              >
                {tKey(availabilityLabelKey(p.type, variant.inStock))}
              </span>
            </div>
          )}

          {/* Buy actions.
              Stepper, call to action and save button measured ~440px against a
              phone's 358 — the spill was the widest single cause of the shop
              panning sideways. They wrap below `sm`: stepper and save share the
              first line, the call to action takes a full-width second one. The
              `order` classes put them back in the original left-to-right order
              from `sm` up. */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!isService && p.type === "physical" && (
              <QtyStepper value={qty} onChange={setQty} max={99} />
            )}
            <IconButton
              icon="heart"
              variant="fav"
              active={isFavorite(p.id)}
              onClick={() => toggle(p.id)}
              label={tDs("saveToFavorites")}
              className="order-1 sm:order-3"
            />
            <div className="order-2 w-full min-w-0 sm:w-auto sm:flex-1">
              {isService ? (
                <BookingPanel product={p} />
              ) : (
                <Button
                  block
                  size="lg"
                  elevated
                  leadingIcon={buyNow ? "zap" : "shopping-cart"}
                  disabled={!buyable || working}
                  onClick={() => void commit(false)}
                >
                  {!buyable
                    ? tKey(unavailableLabelKey(p.type))
                    : working
                      ? tDs("working")
                      : buyNow
                        ? t("buyNowPrice", { price: formatMoney(unitPrice, currency) })
                        : t("addToCartPrice", {
                            price: formatMoney(unitPrice * lineQty, currency),
                          })}
                </Button>
              )}
            </div>
          </div>

          {conflictNote && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {conflictNote}
            </p>
          )}

          {buyNow && !conflictNote && (
            <p
              className="muted"
              style={{ fontSize: 12, marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}
            >
              <Icon name="zap" size={13} style={{ color: "var(--brand)", flexShrink: 0 }} />
              {t("buyNowNote")}
            </p>
          )}

          {/* Type-specific facts, all from the API */}
          <div style={{ marginTop: 18 }}>
            {p.type === "physical" && (
              <InfoCard title={tCommon("delivery")} icon="truck">
                <InfoRow
                  icon="coins"
                  label={tCommon("delivery")}
                  value={p.freeDelivery ? t("deliveryFree") : t("deliveryIncluded")}
                />
                <InfoRow
                  icon="package-check"
                  label={t("shipsFrom")}
                  value={store.city ?? t("defaultOrigin")}
                />
              </InfoCard>
            )}
            {isDigital && variant?.digital && (
              <InfoCard title={t("digitalDelivery")} icon="download">
                <InfoRow
                  icon="file-down"
                  label={tCommon("download")}
                  value={t("downloadAvailable")}
                />
                <InfoRow
                  icon="repeat"
                  label={t("downloadLimit")}
                  value={
                    variant.digital.maxDownloads === null
                      ? t("downloadsUnlimited")
                      : t("downloadsCount", { n: variant.digital.maxDownloads })
                  }
                />
                <InfoRow
                  icon="clock"
                  label={t("access")}
                  value={
                    variant.digital.expiresAfterDays === null
                      ? t("noExpiry")
                      : t("expiryDays", { n: variant.digital.expiresAfterDays })
                  }
                />
              </InfoCard>
            )}
            {isService && variant?.service && (
              <InfoCard title={t("bookingCard")} icon="calendar-clock">
                <InfoRow
                  icon="clock"
                  label={t("sessionLength")}
                  value={t("minutes", { n: variant.service.durationMinutes })}
                />
                <InfoRow
                  icon="coins"
                  label={t("rate")}
                  value={t("ratePerUnit", {
                    price: formatMoney(variant.service.priceFrom, currency),
                    unit: variant.service.priceUnit,
                  })}
                />
                {variant.service.bufferAfterMinutes > 0 && (
                  <InfoRow
                    icon="hourglass"
                    label={t("bufferAfter")}
                    value={t("minutes", { n: variant.service.bufferAfterMinutes })}
                  />
                )}
                <InfoRow icon="info" label={t("note")} value={t("serviceNote")} />
              </InfoCard>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 32 }} className="max-w-3xl">
        <Tabs variant="pill" value={tab} onChange={setTab} tabs={tabs} />
        <div style={{ padding: "16px 2px 0", minHeight: 60 }}>
          {tab === "desc" && (
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-body)", margin: 0, whiteSpace: "pre-wrap" }}>
              {p.description}
            </p>
          )}
          {tab === "specs" && (
            <div>
              <InfoRow icon="dot" label={t("specCategory")} value={p.category} />
              <InfoRow icon="dot" label={t("specSoldBy")} value={store.name} />
              {variant && <InfoRow icon="dot" label={t("specSku")} value={variant.sku} />}
              {p.options.map((o) => (
                <InfoRow key={o.id} icon="dot" label={o.name} value={o.values.map((v) => v.value).join(", ")} />
              ))}
              {p.tags.length > 0 && (
                <InfoRow icon="dot" label={t("specTags")} value={p.tags.join(", ")} />
              )}
            </div>
          )}
          {tab === "policies" && <PolicyBlock store={store} />}
          {tab === "reviews" && <ProductReviews productId={p.id} rating={p.rating} />}
        </div>
      </div>

      {/* The recommender. Its heading is decided by `meta.source`, never by us. */}
      {relatedItems.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p className="ds-overline" style={{ marginBottom: 12 }}>
            {relatedSource === "co_purchase"
              ? t("relatedCoPurchase")
              : t("relatedSameCategory")}
          </p>
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {relatedItems.map((item) => (
              <div key={item.id} style={{ width: 190, flexShrink: 0 }}>
                <ProductCard
                  title={item.title}
                  image={publicUrl(item.image)}
                  rating={item.rating}
                  type={item.type}
                  price={item.price}
                  compareAt={item.compareAtPrice}
                  currency={item.currency}
                  priceRange={item.priceRange}
                  vendorName={item.store.name}
                  showVendor
                  favorite={isFavorite(item.id)}
                  onToggleFavorite={() => toggle(item.id)}
                  inStock={item.inStock}
                  href={productPathFor(item)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* More from this store — a real query, not a recommender. */}
      {moreFromStore.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p className="ds-overline" style={{ marginBottom: 12 }}>
            {t("moreFromStore", { store: store.name })}
          </p>
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
            {moreFromStore.map((item) => (
              <div key={item.id} style={{ width: 190, flexShrink: 0 }}>
                <ProductCard
                  title={item.title}
                  image={publicUrl(item.image)}
                  rating={item.rating}
                  type={item.type}
                  price={item.price}
                  compareAt={item.compareAtPrice}
                  currency={item.currency}
                  priceRange={item.priceRange}
                  favorite={isFavorite(item.id)}
                  onToggleFavorite={() => toggle(item.id)}
                  inStock={item.inStock}
                  href={productPathFor(item)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The swap is announced here, in the shop's own dialog. It replaced a
          `window.confirm`, which is a browser-chrome box headed with the origin
          and cannot label its own buttons — "OK" is a poor last word before a
          cart is deleted. */}
      <ConfirmDialog
        open={conflict !== null}
        title={conflict?.current === "digital" ? t("replaceCartTitle") : t("emptyCartTitle")}
        tone="warning"
        icon="triangle-alert"
        busy={working}
        confirmLabel={buyNow ? t("emptyCartAndBuy") : t("replaceCart")}
        cancelLabel={t("keepCart")}
        onCancel={() => setConflict(null)}
        onConfirm={() => void commit(true)}
        alternative={
          // Losing an unpaid digital item is avoidable: it is one product and one
          // payment away from being finished, so offer that instead of the swap.
          conflict?.current === "digital"
            ? {
                label: t("payDigitalFirst"),
                icon: "arrow-right",
                onClick: () => router.push("/shop/checkout"),
              }
            : undefined
        }
      >
        {conflict?.current === "digital"
          ? t.rich("conflictBodyDigital", {
              product: p.title,
              b: (chunks) => <strong>{chunks}</strong>,
            })
          : t.rich("conflictBodyPhysical", {
              n: count,
              product: p.title,
              b: (chunks) => <strong>{chunks}</strong>,
            })}
      </ConfirmDialog>
    </div>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────────────────── */

/**
 * Product text is vendor-authored in **one** language.
 *
 * There is no `Accept-Language` handling on any catalog read and no translation
 * system; `contentLanguage` says which language the vendor wrote in. Saying so
 * when it differs from the reader's is the honest alternative to presenting
 * French copy as though it were the Portuguese translation.
 */
function LanguageNote({ contentLanguage, locale }: { contentLanguage: string; locale: string }) {
  const t = useTranslations("shop.product");

  if (!contentLanguage) return null;

  const base = contentLanguage.split("-")[0].toLowerCase();
  if (base === locale.split("-")[0].toLowerCase()) return null;

  let name = base.toUpperCase();
  try {
    name = new Intl.DisplayNames([locale], { type: "language" }).of(base) ?? name;
  } catch {
    /* an unknown tag keeps the raw code — better than hiding the notice */
  }

  return (
    <span
      className="muted"
      style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 3 }}
      title={t("languageNoteTitle")}
    >
      <Icon name="languages" size={13} /> {t("writtenIn", { language: name })}
    </span>
  );
}

/**
 * Policies ship as structured terms, not prose.
 *
 * `IVendorReturnPolicy` is a structured document and there is no prose field
 * anywhere to render, so the API sends the facts rather than generating a
 * sentence server-side in one language for a five-locale storefront. `null`
 * means the vendor configured none — no defaults are invented, here or there.
 */
function PolicyBlock({ store }: { store: Product["store"] }) {
  const t = useTranslations("shop.product");
  const { returnPolicy, cancellationPolicy } = store.policies;

  if (!returnPolicy && !cancellationPolicy) {
    return (
      <EmptyState
        icon="file-text"
        title={t("noPolicyTitle")}
        description={t("noPolicyDescription", { store: store.name })}
      />
    );
  }

  return (
    <div>
      {returnPolicy && <ReturnTerms policy={returnPolicy} />}
      {cancellationPolicy && <CancellationTerms policy={cancellationPolicy} />}
    </div>
  );
}

function ReturnTerms({ policy }: { policy: ReturnPolicy }) {
  const t = useTranslations("shop.product");

  const payer: Record<ReturnPolicy["returnShippingPayer"], string> = {
    vendor: t("returnShippingVendor"),
    customer: t("returnShippingCustomer"),
    customer_reimbursed_if_defect: t("returnShippingCustomerReimbursed"),
  };

  // The percentage is inside the message rather than appended to it — a
  // parenthesised suffix is not punctuation every language shares.
  const refund =
    policy.refundType === "full"
      ? t("refundFull")
      : policy.refundType === "partial"
        ? policy.refundPercentage !== null
          ? t("refundPartialPct", { pct: policy.refundPercentage })
          : t("refundPartial")
        : t("refundNone");

  return (
    <div style={{ marginBottom: 22 }}>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("returnsHeading")}
      </p>
      {policy.eligible ? (
        <>
          <InfoRow
            icon="calendar-days"
            label={t("returnWindow")}
            value={t("returnWindowDays", { n: policy.windowDays })}
          />
          <InfoRow icon="banknote" label={t("refundLabel")} value={refund} />
          <InfoRow
            icon="truck"
            label={t("returnShippingLabel")}
            value={payer[policy.returnShippingPayer]}
          />
          <InfoRow
            icon="clock"
            label={t("refundProcessedIn")}
            value={t("refundProcessingDays", { n: policy.refundProcessingDays })}
          />
          {policy.conditionNotes && (
            <InfoRow icon="info" label={t("conditionLabel")} value={policy.conditionNotes} />
          )}
        </>
      ) : (
        <InfoRow
          icon="circle-slash"
          label={t("returnsHeading")}
          value={t("noReturnsValue")}
        />
      )}
    </div>
  );
}

function CancellationTerms({ policy }: { policy: CancellationPolicy }) {
  const t = useTranslations("shop.product");

  const deadline =
    policy.deadline === "before_vendor_confirmation"
      ? t("cancelUntilConfirmed")
      : policy.deadlineDays !== null
        ? t("cancelUpToDays", { n: policy.deadlineDays })
        : // A raw `deadline` is a wire value the API invented; it is not ours to
          // translate, and the fallback covers it being absent entirely.
          (policy.deadline ?? t("cancelSeeTerms"));

  return (
    <div>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("cancellationHeading")}
      </p>
      {policy.cancellable ? (
        <>
          <InfoRow icon="calendar-x" label={t("cancelBy")} value={deadline} />
          {policy.feeType && policy.feeValue !== null && (
            <InfoRow
              icon="banknote"
              label={t("cancellationFee")}
              value={policy.feeType === "percentage" ? `${policy.feeValue}%` : formatMoney(policy.feeValue, "XAF")}
            />
          )}
        </>
      ) : (
        <InfoRow
          icon="circle-slash"
          label={t("cancellationHeading")}
          value={t("noCancellationValue")}
        />
      )}
    </div>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "warning" | "info";
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <div
      role="note"
      className="mb-4"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        border: `1px solid var(--${tone}-border)`,
        background: `var(--${tone}-bg)`,
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
      }}
    >
      <Icon name={icon} size={17} style={{ color: `var(--${tone})`, flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>{children}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <Icon name={icon} size={19} style={{ color: "var(--brand)", marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 14.5, color: "var(--text-strong)", fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 13px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Icon name={icon} size={17} style={{ color: "var(--brand)" }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}>{title}</span>
      </div>
      <div style={{ padding: "2px 13px 6px" }}>{children}</div>
    </div>
  );
}

