"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Rating } from "./Rating";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useBargain } from "@/components/shop/BargainButton";
import { Link } from "@/i18n/navigation";
import type { PriceRange, ProductType } from "@/lib/shop/shop.types";
import { unavailableLabelKey } from "@/lib/shop/availability";
import { BARGAIN_ENABLED } from "@/lib/shop/bargain";
import { getProductById } from "@/lib/shop/catalog.api";
import { discountPct } from "@/lib/shop/format";
import { defaultVariant } from "@/lib/shop/quick-add";
import { useReducedMotionSafe } from "@/lib/reduced-motion";
import { Badge } from "./Badge";
import { Icon, type IconName } from "./Icon";
import { PriceDisplay } from "./PriceDisplay";
import { VerifiedBadge } from "./VerifiedBadge";

/** Shipped in `public/`, for products the vendor listed without a usable image. */
const NO_IMAGE = "/no_product_image.png";

export interface ProductCardProps {
  layout?: "grid" | "list";
  title: string;
  /** `null` when the product has no usable image — the API says so explicitly. */
  image: string | null;
  type: ProductType;
  price: number;
  compareAt?: number | null;
  currency?: string;
  /** Present only when the product's variants differ in price. */
  priceRange?: PriceRange;
  vendorName?: string;
  /** The store's `verified` flag. Drawn only beside a shown vendor name. */
  vendorVerified?: boolean;
  showVendor?: boolean;
  /**
   * The published-review aggregate, or `null` when nobody has reviewed it.
   *
   * The API sends `null` rather than a zero-count object, so there is no
   * "0.0 (0)" state to suppress — absent means absent. This card carried an
   * invented rating once; the difference now is that the number is real.
   */
  rating?: { average: number; count: number } | null;
  /**
   * A real backend field, unlike the free-text delivery label this card used to
   * take. It is a boolean promise about this product, not a description.
   */
  freeDelivery?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  /** Boolean by design — the API publishes no stock count. */
  inStock?: boolean;
  /**
   * The default variant's price is open to haggling. The corner button then
   * turns into a handshake that opens two actions — the quick action and
   * Bargain — and Bargain haggles over that default variant. Drawn only while
   * the web bargain feature is switched on (`lib/shop/bargain.ts`), and only
   * with `productId`, which the bot link is built from.
   */
  negotiable?: boolean;
  productId?: string;
  onQuickAdd?: () => void;
  /**
   * The product's URL.
   *
   * **Prefer this over `onClick`.** The card used to be a `div` with a click
   * handler, which meant the grid contained no links at all: a crawler could
   * read the titles and had no way to reach a product, and a shopper could not
   * middle-click, open in a new tab, or copy a link. Server-rendering the grid
   * only pays off if what it renders is navigable.
   */
  href?: string;
  onClick?: () => void;
}

/**
 * What the corner button does, per type — and it is three different things, so
 * it says three different things. Digital is a buy-now: it goes to checkout
 * rather than into a cart, and a "+" over that is a lie about where the tap
 * lands.
 */
const quickAction: Record<ProductType, { icon: IconName; labelKey: string }> = {
  physical: { icon: "plus", labelKey: "quickAdd" },
  digital: { icon: "zap", labelKey: "buyNow" },
  service: { icon: "calendar-clock", labelKey: "book" },
};

function FavButton({ favorite, onToggleFavorite }: Pick<ProductCardProps, "favorite" | "onToggleFavorite">) {
  const t = useTranslations("shop.ds");

  return (
    <button
      type="button"
      aria-label={t(favorite ? "removeFromFavorites" : "saveToFavorites")}
      aria-pressed={favorite}
      className="ds-pop"
      onClick={(e) => {
        // `preventDefault` as well as `stopPropagation`: the card is a link now,
        // and without it saving a product also navigates to it.
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite?.();
      }}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFFFFF",
        color: favorite ? "var(--danger)" : "var(--gray-600)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Icon name="heart" size={17} style={favorite ? { fill: "currentColor" } : undefined} />
    </button>
  );
}

/**
 * One round button in the image's corner. `preventDefault` as well as
 * `stopPropagation`, for the reason `FavButton` gives: the card is a link.
 */
function CornerButton({
  label,
  icon,
  onPress,
  size = 34,
  tone = "brand",
  expanded,
  disabled,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  size?: number;
  /** `brand` is the primary action; `light` the secondary one beside it. */
  tone?: "brand" | "light";
  /** Set on a toggle only. */
  expanded?: boolean;
  /**
   * `aria-disabled`, not `disabled`: a disabled button gets no click event, so
   * its handler could not stop the tap from opening the product behind it.
   */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-disabled={disabled || undefined}
      title={label}
      className="ds-pop"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onPress();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "none",
        cursor: disabled ? "progress" : "pointer",
        opacity: disabled ? 0.75 : 1,
        background: tone === "brand" ? "var(--brand)" : "#FFFFFF",
        color: tone === "brand" ? "#fff" : "var(--brand)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.53)} className={disabled ? "animate-spin" : undefined} />
    </button>
  );
}

/**
 * The corner of a card whose price can be haggled: a handshake where the "+"
 * would be, which opens upward into the quick action and Bargain.
 *
 * The handshake is the signal — a card without one has a plain "+" — so the
 * separate "negotiable" marker this card used to draw is gone. A card with no
 * quick action (the product page's own rows) opens onto Bargain alone.
 *
 * It opens upward on a grid card and leftward on a list card: the list image
 * is 118px square, and a column there lands Bargain on the Save heart.
 *
 * ── Which variant Bargain names ─────────────────────────────────────────────
 * A list row has no variant ids, and the contract
 * (`api-doc/public/bargain-deep-link.md`) wants one named for any product with
 * more than one. So opening the menu fetches the product — the same request
 * quick-add makes — and Bargain haggles over its default variant, the one the
 * row's `negotiable` describes. Bargain waits, disabled, until that answers:
 * the fetch cannot wait for the tap instead, because a `window.open` after an
 * `await` is a popup the browser blocks. If the lookup fails, or the default
 * variant turns out not negotiable or sold out, Bargain is not offered.
 */
function BargainCorner({
  productId,
  type,
  onQuickAdd,
  direction,
}: {
  productId: string;
  type: ProductType;
  onQuickAdd?: () => void;
  direction: "up" | "left";
}) {
  const t = useTranslations("shop.ds");
  const reduceMotion = useReducedMotionSafe();
  const [open, setOpen] = useState(false);
  const [lookup, setLookup] = useState<
    | { state: "idle" | "loading" | "none" }
    | { state: "ready"; variantId: string; label: string }
  >({ state: "idle" });
  const root = useRef<HTMLDivElement>(null);

  const { start, sheet } = useBargain({
    productId,
    variantId: lookup.state === "ready" ? lookup.variantId : undefined,
    itemLabel: lookup.state === "ready" ? lookup.label : "",
  });

  const resolveVariant = () => {
    // A failed lookup ("none") is retried on the next open; a found one is kept.
    if (lookup.state === "loading" || lookup.state === "ready") return;
    setLookup({ state: "loading" });
    getProductById(productId)
      .then((product) => {
        const variant = product && defaultVariant(product);
        if (!product || !variant?.negotiable || !variant.inStock) {
          setLookup({ state: "none" });
          return;
        }
        setLookup({
          state: "ready",
          variantId: variant.id,
          label: product.variants.length > 1 ? `${product.title} — ${variant.name}` : product.title,
        });
      })
      .catch(() => setLookup({ state: "none" }));
  };

  // A tap anywhere else, or Escape, folds the menu back.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const actions: {
    key: string;
    label: string;
    icon: IconName;
    tone: "brand" | "light";
    run: (() => void) | null;
  }[] = [];
  if (lookup.state !== "none") {
    actions.push({
      key: "bargain",
      label: t("bargain"),
      icon: start ? "handshake" : "loader",
      tone: "light",
      run: start,
    });
  }
  if (onQuickAdd) {
    actions.push({
      key: "quick",
      label: t(quickAction[type].labelKey),
      icon: quickAction[type].icon,
      tone: "brand",
      run: onQuickAdd,
    });
  }

  // 30px actions with a 6px gap: the row (34 + 2 × 36 + 8) fits inside the
  // 118px image of the list layout.
  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.6, ...(direction === "up" ? { y: 12 } : { x: 12 }) };

  return (
    <div
      ref={root}
      style={{
        position: "absolute",
        bottom: 8,
        right: 8,
        display: "flex",
        flexDirection: direction === "up" ? "column" : "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <AnimatePresence>
        {open &&
          actions.map((a, i) => (
            <motion.div
              key={a.key}
              initial={hidden}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={hidden}
              transition={{ duration: 0.16, delay: reduceMotion ? 0 : (actions.length - 1 - i) * 0.04 }}
            >
              <CornerButton
                label={a.label}
                icon={a.icon}
                tone={a.tone}
                size={30}
                disabled={!a.run}
                onPress={() => {
                            setOpen(false);
                  a.run?.();
                }}
              />
            </motion.div>
          ))}
      </AnimatePresence>
      <CornerButton
        label={t(open ? "closeActions" : "moreActions")}
        icon={open ? "x" : "handshake"}
        expanded={open}
        onPress={() => {
          if (!open) resolveVariant();
          setOpen(!open);
        }}
      />
      {sheet}
    </div>
  );
}

export function ProductCard(props: ProductCardProps) {
  const t = useTranslations("shop.ds");
  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();
  const {
    layout = "grid",
    title,
    image,
    type,
    price,
    compareAt,
    currency = "XAF",
    priceRange,
    vendorName,
    vendorVerified,
    showVendor,
    rating,
    freeDelivery,
    favorite,
    onToggleFavorite,
    inStock = true,
    negotiable,
    productId,
    onQuickAdd,
    href,
    onClick,
  } = props;

  // Suppressed on a price band: the compare-at belongs to the default variant,
  // so a "-20%" badge over "from 24 000" claims a discount on prices it does
  // not describe.
  const pct = priceRange ? null : discountPct(price, compareAt);

  const titleEl = (
    <div
      // `ds-ugc` — the vendor wrote this string and it can be in any script; see
      // globals.css. Without it, `Téléviseur LED 32"` renders on /ar with the
      // inch mark moved to the front.
      className="ds-ugc"
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: "var(--text-strong)",
        lineHeight: 1.3,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {title}
    </div>
  );

  const meta = (
    <>
      {showVendor && vendorName && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--text-muted)",
            fontWeight: 600,
            marginBottom: 3,
          }}
        >
          {/* The name truncates and the badge does not — a long store name
              must never push the verification mark off the card. */}
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {vendorName}
          </span>
          {vendorVerified && <VerifiedBadge kind="vendor" size={13} />}
        </div>
      )}

      {rating && (
        <div style={{ marginBottom: 3 }}>
          <Rating value={rating.average} count={rating.count} size={12} />
        </div>
      )}
      {titleEl}
      <div style={{ marginTop: 6 }}>
        <PriceDisplay amount={price} compareAt={compareAt} currency={currency} range={priceRange} size="sm" />
      </div>
      {freeDelivery && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
          <Icon name="truck" size={13} />
          {t("freeDelivery")}
        </div>
      )}
    </>
  );

  const imageBox = (dim: { width: string | number; aspect?: string; height?: number }) => (
    <div
      className="ds-media"
      style={{
        position: "relative",
        width: dim.width,
        aspectRatio: dim.aspect,
        height: dim.height,
        background: "var(--surface-2)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image ?? NO_IMAGE}
        alt={title}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: inStock ? 1 : 0.6 }}
        
      />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 5 }}>
        <Badge productType={type} variant="solid" size="sm">
          {t(`productType.${type}`)}
        </Badge>
        {pct && (
          <Badge tone="danger" variant="solid" size="sm">
            -{pct}%
          </Badge>
        )}
      </div>
      <div style={{ position: "absolute", top: 8, right: 8 }}>
        <FavButton favorite={favorite} onToggleFavorite={onToggleFavorite} />
      </div>
      {!inStock && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(26,25,21,0.35)",
          }}
        >
          <span
            style={{
              background: "var(--surface)",
              color: "var(--text-strong)",
              fontSize: 12,
              fontWeight: 800,
              padding: "5px 10px",
              borderRadius: "var(--radius-pill)",
            }}
          >
            {tKey(unavailableLabelKey(type))}
          </span>
        </div>
      )}
      {inStock && negotiable && BARGAIN_ENABLED && productId ? (
        <BargainCorner
          productId={productId}
          type={type}
          onQuickAdd={onQuickAdd}
          direction={layout === "list" ? "left" : "up"}
        />
      ) : (
        inStock &&
        onQuickAdd && (
          <div style={{ position: "absolute", bottom: 8, right: 8 }}>
            <CornerButton
              label={t(quickAction[type].labelKey)}
              icon={quickAction[type].icon}
              onPress={onQuickAdd}
            />
          </div>
        )
      )}
    </div>
  );

  const listShell: CSSProperties = {
    display: "flex",
    gap: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "var(--shadow-card)",
    textDecoration: "none",
    color: "inherit",
  };

  const gridShell: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "var(--shadow-card)",
    textDecoration: "none",
    color: "inherit",
  };

  const body =
    layout === "list" ? (
      <>
        {imageBox({ width: 118, height: 118 })}
        <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 0" }}>{meta}</div>
      </>
    ) : (
      <>
        {imageBox({ width: "100%", aspect: "1 / 1" })}
        <div style={{ padding: "10px 12px 12px" }}>{meta}</div>
      </>
    );

  return (
    <CardShell
      href={href}
      onClick={onClick}
      className={layout === "list" ? "ds-card lift" : "fadein lift ds-card"}
      style={layout === "list" ? listShell : gridShell}
    >
      {body}
    </CardShell>
  );
}

/**
 * A real `<a>` when there is somewhere to go, and the old click-handled `div`
 * only where there is not.
 *
 * The fallback exists because a couple of surfaces navigate imperatively rather
 * than to a fixed URL; everything with a product behind it should pass `href`.
 */
function CardShell({
  href,
  onClick,
  className,
  style,
  children,
}: {
  href?: string;
  onClick?: () => void;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}
