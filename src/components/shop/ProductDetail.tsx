"use client";

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
} from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { CART_OFFLINE_MESSAGE } from "@/lib/shop/cart-errors";
import { useShopPageTitle } from "@/components/shop/ShopChrome";
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
  /** Same-store products, fetched server-side. Not a recommender — there isn't one. */
  moreFromStore?: ProductListItem[];
}

/** Order-insensitive set equality — a variant's selection is a set, not a list. */
function sameSelection(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export function ProductDetail({ product: p, locale, moreFromStore = [] }: Props) {
  const router = useRouter();
  const { addItem, productType, count } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const { flash } = useToast();

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
              flash(`Added to cart · ${variant.name}`);
            }
            break;
          case "type_conflict":
            if (replace) {
              // The retry conflicted too, which the server should not do —
              // report it rather than failing silently.
              flash("Could not replace your cart. Please empty it and try again.");
            } else {
              setConflict({ current: outcome.current });
            }
            break;
          case "digital_limit":
            flash("Your cart already holds a digital product. Pay for that one first.");
            break;
          case "service_not_allowed":
            flash("Services are booked, not added to a cart.");
            break;
          case "offline":
            flash(CART_OFFLINE_MESSAGE);
            break;
          case "error":
            flash(outcome.message);
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
    [addItem, p, variant, lineQty, buyNow, router, flash]
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
  const heldPlural = count === 1 ? "" : "s";

  const conflictNote =
    held === "digital"
      ? "Your cart holds a digital product you have not paid for yet. Adding this removes it — a cart holds one kind at a time."
      : held === "physical"
        ? `Your cart holds ${count} physical item${heldPlural}. Buying this now empties it — digital products are paid for on their own.`
        : null;

  const tabs = [
    { value: "desc", label: "Description" },
    { value: "specs", label: isDigital ? "What’s included" : "Specifications" },
    { value: "policies", label: "Returns & cancellation" },
    { value: "reviews", label: "Reviews", count: p.rating?.count || undefined },
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
        <Icon name="arrow-left" size={16} /> Back to shop
      </button>

      {store.isOpen === false && (
        <Notice tone="warning" icon="palmtree">
          <strong>{store.name} is on holiday.</strong> You can still order — the seller will
          dispatch when they reopen.
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
              src={image?.url ?? "/no_product_image.png"}
              alt={image?.originalName ?? p.title}
              style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
              
            />
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
              <Badge productType={p.type} variant="solid">
                {p.type[0].toUpperCase() + p.type.slice(1)}
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
                  aria-label={`Image ${i + 1}`}
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
            <Avatar name={store.name} src={store.logo?.url} size={24} />
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

          <h1
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
                  {variant.service.priceUnit} · charged for the time actually booked
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
                You’re buying: <strong>{variant.name}</strong>
              </span>
              {/* A boolean, because that is what the API publishes. */}
              <span
                style={{
                  marginLeft: "auto",
                  fontWeight: 700,
                  color: variant.inStock ? "var(--success)" : "var(--danger)",
                }}
              >
                {variant.inStock ? "In stock" : "Out of stock"}
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
              label="Save"
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
                    ? "Out of stock"
                    : working
                      ? "Working…"
                      : buyNow
                        ? `Buy now · ${formatMoney(unitPrice, currency)}`
                        : `Add to cart · ${formatMoney(unitPrice * lineQty, currency)}`}
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
              Straight to payment — nothing to deliver, so there is no cart step.
            </p>
          )}

          {/* Type-specific facts, all from the API */}
          <div style={{ marginTop: 18 }}>
            {p.type === "physical" && (
              <InfoCard title="Delivery" icon="truck">
                <InfoRow
                  icon="coins"
                  label="Delivery"
                  value={
                    p.freeDelivery
                      ? "Free delivery on this item"
                      : "Included — the seller covers delivery"
                  }
                />
                <InfoRow icon="package-check" label="Ships from" value={store.city ?? "Cameroon"} />
              </InfoCard>
            )}
            {isDigital && variant?.digital && (
              <InfoCard title="Digital delivery" icon="download">
                <InfoRow icon="file-down" label="Download" value="Available after payment" />
                <InfoRow
                  icon="repeat"
                  label="Download limit"
                  value={
                    variant.digital.maxDownloads === null
                      ? "Unlimited downloads"
                      : `${variant.digital.maxDownloads} downloads`
                  }
                />
                <InfoRow
                  icon="clock"
                  label="Access"
                  value={
                    variant.digital.expiresAfterDays === null
                      ? "No expiry"
                      : `${variant.digital.expiresAfterDays} days after purchase`
                  }
                />
              </InfoCard>
            )}
            {isService && variant?.service && (
              <InfoCard title="Booking" icon="calendar-clock">
                <InfoRow icon="clock" label="Session length" value={`${variant.service.durationMinutes} minutes`} />
                <InfoRow icon="coins" label="Rate" value={`${formatMoney(variant.service.priceFrom, currency)} ${variant.service.priceUnit}`} />
                {variant.service.bufferAfterMinutes > 0 && (
                  <InfoRow icon="hourglass" label="Buffer after" value={`${variant.service.bufferAfterMinutes} minutes`} />
                )}
                <InfoRow icon="info" label="Note" value="Services are booked with the seller, not added to a cart." />
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
              <InfoRow icon="dot" label="Category" value={p.category} />
              <InfoRow icon="dot" label="Sold by" value={store.name} />
              {variant && <InfoRow icon="dot" label="SKU" value={variant.sku} />}
              {p.options.map((o) => (
                <InfoRow key={o.id} icon="dot" label={o.name} value={o.values.map((v) => v.value).join(", ")} />
              ))}
              {p.tags.length > 0 && <InfoRow icon="dot" label="Tags" value={p.tags.join(", ")} />}
            </div>
          )}
          {tab === "policies" && <PolicyBlock store={store} />}
          {tab === "reviews" && <ProductReviews productId={p.id} rating={p.rating} />}
        </div>
      </div>

      {/* More from this store — a real query, not a recommender. */}
      {moreFromStore.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <p className="ds-overline" style={{ marginBottom: 12 }}>
            More from {store.name}
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
        title={conflict?.current === "digital" ? "Replace your cart?" : "This empties your cart"}
        tone="warning"
        icon="triangle-alert"
        busy={working}
        confirmLabel={buyNow ? "Empty cart & buy now" : "Replace cart"}
        cancelLabel="Keep my cart"
        onCancel={() => setConflict(null)}
        onConfirm={() => void commit(true)}
        alternative={
          // Losing an unpaid digital item is avoidable: it is one product and one
          // payment away from being finished, so offer that instead of the swap.
          conflict?.current === "digital"
            ? {
                label: "Pay for the digital item first",
                icon: "arrow-right",
                onClick: () => router.push("/shop/checkout"),
              }
            : undefined
        }
      >
        {conflict?.current === "digital" ? (
          <>
            Your cart holds a <strong>digital product</strong> you have not paid for yet, and a cart
            holds one kind at a time. Adding <strong>{p.title}</strong> removes it. Nothing has been
            charged either way.
          </>
        ) : (
          <>
            Your cart holds{" "}
            <strong>
              {count} physical item{heldPlural}
            </strong>
            . <strong>{p.title}</strong> is digital — paid for on its own, with nothing to deliver —
            so it cannot share a cart with them. Continuing removes what is in your cart now.
            Nothing has been charged.
          </>
        )}
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
      title="Product text is written by the seller and is not translated."
    >
      <Icon name="languages" size={13} /> Written in {name}
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
  const { returnPolicy, cancellationPolicy } = store.policies;

  if (!returnPolicy && !cancellationPolicy) {
    return (
      <EmptyState
        icon="file-text"
        title="No published policy"
        description={`${store.name} has not published return or cancellation terms. Message the seller before ordering if this matters to you.`}
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
  const payer: Record<ReturnPolicy["returnShippingPayer"], string> = {
    vendor: "The seller pays return shipping",
    customer: "You pay return shipping",
    customer_reimbursed_if_defect: "You pay return shipping, refunded if the item is faulty",
  };

  const refund =
    policy.refundType === "full"
      ? "Full refund"
      : policy.refundType === "partial"
        ? `Partial refund${policy.refundPercentage !== null ? ` (${policy.refundPercentage}%)` : ""}`
        : "No refund";

  return (
    <div style={{ marginBottom: 22 }}>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        Returns
      </p>
      {policy.eligible ? (
        <>
          <InfoRow icon="calendar-days" label="Return window" value={`${policy.windowDays} days from delivery`} />
          <InfoRow icon="banknote" label="Refund" value={refund} />
          <InfoRow icon="truck" label="Return shipping" value={payer[policy.returnShippingPayer]} />
          <InfoRow icon="clock" label="Refund processed in" value={`${policy.refundProcessingDays} days`} />
          {policy.conditionNotes && <InfoRow icon="info" label="Condition" value={policy.conditionNotes} />}
        </>
      ) : (
        <InfoRow icon="circle-slash" label="Returns" value="This seller does not accept returns" />
      )}
    </div>
  );
}

function CancellationTerms({ policy }: { policy: CancellationPolicy }) {
  const deadline =
    policy.deadline === "before_vendor_confirmation"
      ? "Until the seller confirms the order"
      : policy.deadlineDays !== null
        ? `Up to ${policy.deadlineDays} days after ordering`
        : (policy.deadline ?? "See seller terms");

  return (
    <div>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        Cancellation
      </p>
      {policy.cancellable ? (
        <>
          <InfoRow icon="calendar-x" label="Cancel by" value={deadline} />
          {policy.feeType && policy.feeValue !== null && (
            <InfoRow
              icon="banknote"
              label="Cancellation fee"
              value={policy.feeType === "percentage" ? `${policy.feeValue}%` : formatMoney(policy.feeValue, "XAF")}
            />
          )}
        </>
      ) : (
        <InfoRow icon="circle-slash" label="Cancellation" value="This order cannot be cancelled once placed" />
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
  icon: string;
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

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
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

function InfoCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
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

