"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Rating } from "./Rating";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useBargain } from "@/components/shop/BargainButton";
import { Link } from "@/i18n/navigation";
import type { DeliveryTerms, PriceRange, ProductType } from "@/lib/shop/shop.types";
import { unavailableLabelKey } from "@/lib/shop/availability";
import { BARGAIN_ENABLED } from "@/lib/shop/bargain";
import { getProductById } from "@/lib/shop/catalog.api";
import { promisesFreeDelivery } from "@/lib/shop/delivery";
import { discountPct, formatMoney } from "@/lib/shop/format";
import { defaultVariant } from "@/lib/shop/quick-add";
import { useReducedMotionSafe } from "@/lib/reduced-motion";
import { tapFeedback } from "@/lib/native/haptics";
import { useProductShare } from "@/components/shop/useProductShare";
import { Badge } from "./Badge";
import { ProductActionsSheet, type ProductAction } from "./ProductActionsSheet";
import { useLongPress, type LongPressSource } from "./useLongPress";
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
   * The primary category's name (`categories[0]`). Plain text, not a link: the
   * whole card is one, and a link inside a link is invalid. Omit it for a
   * product with no category.
   */
  category?: string;
  /**
   * The published-review aggregate, or `null` when nobody has reviewed it.
   *
   * The API sends `null` rather than a zero-count object, so there is no
   * "0.0 (0)" state to suppress — absent means absent. This card carried an
   * invented rating once; the difference now is that the number is real.
   */
  rating?: { average: number; count: number } | null;
  /**
   * The SHOP's free-delivery terms (ADR-A11) — pass `deliveryTermsOf(row)`.
   * `always` draws "Free delivery", `above` "Free delivery from X", and `never`
   * draws nothing: the fee depends on the basket and the address, so a card
   * never quotes one. Replaced the per-product `freeDelivery` boolean, which
   * cannot express "from X".
   */
  deliveryTerms?: DeliveryTerms | null;
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
  /**
   * The slugs the public link is built from — pass the product row itself.
   * Puts Share in the press-and-hold menu; without it the menu has no Share.
   * Not derived from `href`, which is the app's own path shape in the app build.
   */
  shareable?: { slug: string; store: { slug: string } };
}

/** The verb the hold menu leads with — "Add to cart", where the corner says "+". */
const menuQuickAction: Record<ProductType, { icon: IconName; labelKey: string }> = {
  physical: { icon: "shopping-cart", labelKey: "addToCart" },
  digital: { icon: "zap", labelKey: "buyNow" },
  service: { icon: "calendar-clock", labelKey: "book" },
};

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
  bargain,
  type,
  onQuickAdd,
  direction,
}: {
  bargain: CardBargain;
  type: ProductType;
  onQuickAdd?: () => void;
  direction: "up" | "left";
}) {
  const t = useTranslations("shop.ds");
  const reduceMotion = useReducedMotionSafe();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { start, offered, resolve: resolveVariant } = bargain;

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
  if (offered) {
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
    </div>
  );
}

/**
 * The card's Bargain, shared by the corner menu above and the press-and-hold
 * sheet — one lookup and one channel sheet per card, whichever opened it.
 *
 * `resolve` is the lookup the corner's note explains; call it when a menu
 * opens, never on the Bargain tap itself. `offered` is false once the lookup
 * has said no (or with the feature off); `start` is null until it has said yes.
 */
interface CardBargain {
  resolve: () => void;
  offered: boolean;
  start: (() => void) | null;
  sheet: ReactNode;
}

function useCardBargain(productId: string | undefined, enabled: boolean): CardBargain {
  const [lookup, setLookup] = useState<
    | { state: "idle" | "loading" | "none" }
    | { state: "ready"; variantId: string; label: string }
  >({ state: "idle" });

  const { start, sheet } = useBargain({
    productId: productId ?? "",
    variantId: enabled && lookup.state === "ready" ? lookup.variantId : undefined,
    itemLabel: lookup.state === "ready" ? lookup.label : "",
  });

  const resolve = () => {
    // A failed lookup ("none") is retried on the next open; a found one is kept.
    if (!enabled || !productId || lookup.state === "loading" || lookup.state === "ready") return;
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

  return { resolve, offered: enabled && lookup.state !== "none", start, sheet };
}

export function ProductCard(props: ProductCardProps) {
  const t = useTranslations("shop.ds");
  const tCommon = useTranslations("shop.common");
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
    category,
    rating,
    deliveryTerms = null,
    favorite,
    onToggleFavorite,
    inStock = true,
    negotiable,
    productId,
    onQuickAdd,
    href,
    onClick,
    shareable,
  } = props;

  const reduceMotion = useReducedMotionSafe();
  const shareProduct = useProductShare();
  const canBargain = Boolean(inStock && negotiable && BARGAIN_ENABLED && productId);
  const bargain = useCardBargain(productId, canBargain);

  /**
   * ── Press and hold: the card's action menu ──────────────────────────────────
   *
   * Add to cart, Bargain, Share and Save, in that order — each only when this
   * card can actually do it. Every one of them is also reachable without the
   * gesture (the corner button, the heart, the product page), which is what
   * makes a hidden gesture acceptable: it is a shortcut, never the only way.
   */
  const [actionsOpen, setActionsOpen] = useState(false);
  /**
   * The finger that opened the menu is still down when it appears, and on
   * some phones lifting it lands a tap on the scrim that just slid under it —
   * which closed the menu the moment it opened. So closing waits until that
   * finger is up, plus a beat for the click that follows.
   */
  const closeBlockedUntil = useRef(0);

  const openActions = (source: LongPressSource) => {
    if (source === "pointer") {
      closeBlockedUntil.current = Infinity;
      const released = () => {
        closeBlockedUntil.current = Date.now() + 350;
        window.removeEventListener("pointerup", released);
        window.removeEventListener("pointercancel", released);
      };
      window.addEventListener("pointerup", released);
      window.addEventListener("pointercancel", released);
    }
    bargain.resolve();
    void tapFeedback();
    setActionsOpen(true);
  };
  const closeActions = () => {
    if (Date.now() >= closeBlockedUntil.current) setActionsOpen(false);
  };

  /** Each row closes the menu first, then acts — synchronously, inside the tap. */
  const act = (run: () => void) => () => {
    setActionsOpen(false);
    run();
  };

  const menu: ProductAction[] = [];
  if (inStock && onQuickAdd) {
    menu.push({
      key: "quick",
      icon: menuQuickAction[type].icon,
      label: t(menuQuickAction[type].labelKey),
      onPress: act(onQuickAdd),
      primary: true,
    });
  }
  if (bargain.offered) {
    const startBargain = bargain.start;
    menu.push({
      key: "bargain",
      icon: "handshake",
      label: t("bargain"),
      onPress: startBargain ? act(startBargain) : null,
    });
  }
  if (shareable) {
    menu.push({
      key: "share",
      icon: "share-2",
      label: tCommon("share"),
      onPress: act(() => shareProduct({ title, ...shareable })),
    });
  }
  if (onToggleFavorite) {
    menu.push({
      key: "save",
      icon: "heart",
      label: t(favorite ? "removeFromFavorites" : "saveToFavorites"),
      onPress: act(() => {
        void tapFeedback();
        onToggleFavorite();
      }),
      active: favorite,
    });
  }

  const hold = useLongPress(menu.length > 0 ? openActions : null);

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

      {category && (
        // `ds-ugc`: the name is vendor- or admin-written and never translated.
        <div
          className="ds-ugc"
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {category}
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
      {promisesFreeDelivery(deliveryTerms) && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
          <Icon name="truck" size={13} />
          {deliveryTerms.mode === "always"
            ? t("freeDelivery")
            : t("freeDeliveryFrom", { amount: formatMoney(deliveryTerms.freeAboveAmount ?? 0, currency) })}
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
      {canBargain ? (
        <BargainCorner
          bargain={bargain}
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

  // The card sinks a little under a held finger — the cue that holding does
  // something, and that letting go now would not open the product.
  const pressedStyle: CSSProperties =
    hold.pressing && !reduceMotion
      ? { transform: "scale(0.97)", transition: "transform 300ms var(--ease-out)" }
      : {};

  return (
    <CardShell
      href={href}
      onClick={onClick}
      className={layout === "list" ? "ds-card lift" : "fadein lift ds-card"}
      style={{ ...(layout === "list" ? listShell : gridShell), ...hold.style, ...pressedStyle }}
      handlers={hold.handlers}
    >
      {body}
      {menu.length > 0 && (
        <ProductActionsSheet
          open={actionsOpen}
          onClose={closeActions}
          product={{ title, image, price, compareAt, currency, priceRange }}
          actions={menu}
        />
      )}
      {bargain.sheet}
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
  handlers,
  children,
}: {
  href?: string;
  onClick?: () => void;
  className: string;
  style: CSSProperties;
  handlers: ReturnType<typeof useLongPress>["handlers"];
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className} style={style} {...handlers}>
        {children}
      </Link>
    );
  }

  return (
    <div
      {...handlers}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        handlers.onKeyDown?.(e);
        if (e.key === "Enter") onClick?.();
      }}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}
