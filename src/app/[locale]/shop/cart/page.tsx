"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  QtyStepper,
  Skeleton,
} from "@/components/shop/ds";
import { useShopPageTitle } from "@/components/shop/ShopChrome";
import { useCart, useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import { useAuth } from "@/lib/auth/useAuth";
import { quoteCart } from "@/lib/shop/cart.api";
import { formatMoney } from "@/lib/shop/format";
import { productPath } from "@/lib/shop/shop.routes";
import type { CartQuote, CartDropReason } from "@/lib/shop/customer.types";

/**
 * The cart.
 *
 * ── The customer is not charged for delivery ─────────────────────────────────
 *
 * `POST /cart/quote` returns `delivery: 0` and `total === subtotal`, and that is
 * the truth rather than a placeholder: the agency's fee is real and *is* charged,
 * but to the **vendor** — `splitOrder` computes
 * `vendorNet = gross − commission − deliveryTotal`. Adding it to the shopper's
 * total would collect it twice. So this page says "Delivery included" and uses
 * `absorbedByVendor` only to say the seller covers it. Never add that number to
 * a total.
 *
 * The flat 1 000 FCFA delivery fee and 2% "service fee" this page used to invent
 * are gone for the same reason they were removed before the API existed: showing
 * a total nobody will be charged is worse than showing the subtotal alone.
 *
 * ── One cart ─────────────────────────────────────────────────────────────────
 *
 * There are no longer two baskets. The server keeps one cart per customer with
 * one `productType`, so the physical/digital split this page used to render had
 * nothing behind it.
 */

/**
 * Keys into `shop.cart.dropReason`, never sentences — this is a module-level
 * constant, so there is no render and no locale to read here. `DroppedNotice`
 * resolves them. Renamed from `DROP_REASON` so a call site that still expects a
 * finished string cannot compile.
 */
const DROP_REASON_KEY: Record<CartDropReason, string> = {
  PRODUCT_UNAVAILABLE: "dropReason.PRODUCT_UNAVAILABLE",
  PRODUCT_TYPE_CONFLICT: "dropReason.PRODUCT_TYPE_CONFLICT",
  DIGITAL_LIMIT_REACHED: "dropReason.DIGITAL_LIMIT_REACHED",
  SERVICE_NOT_ALLOWED: "dropReason.SERVICE_NOT_ALLOWED",
  SERVER_CART_KEPT: "dropReason.SERVER_CART_KEPT",
};

export default function CartPage() {
  const router = useRouter();
  const { status } = useAuth();
  const {
    lines,
    productType,
    count,
    busy,
    hydrated,
    dropped,
    dismissDropped,
    negotiationLapsed,
    dismissNegotiationLapsed,
    setQty,
    removeLine,
  } = useCart();
  const { flashError } = useToast();
  const t = useTranslations("shop.cart");
  /* The shared backend-code ladder, and the frozen shared vocabulary. */
  const tErrors = useTranslations("errors");
  const tKey = useTranslations();

  /**
   * Run a cart write and SAY SO if it fails.
   *
   * Both of these reject rather than returning an outcome the way `addItem`
   * does, and both rejections used to be dropped on the floor — `void setQty()`
   * with no catch at all, and `removeLine().catch(() => undefined)`. On a dead
   * connection that is the worst of the three possible behaviours: the stepper
   * springs back, the row stays put, and the shopper is told nothing whatsoever,
   * so the only reading available is that the app is broken.
   *
   * `translateError` resolves an unreachable server to `errors.NETWORK_ERROR`
   * — "check your connection" — before it ever reaches the fallback, which is
   * the same ladder every other screen in the shop uses and the reason the
   * fallback names the operation rather than being a generic apology.
   */
  const write = useCallback(
    (op: Promise<void>, failed: string) => {
      void op.catch((err: unknown) => flashError(translateError(tErrors, err, failed)));
    },
    [flashError, tErrors],
  );

  const [quote, setQuote] = useState<CartQuote | null>(null);
  /** The line the shopper has asked to remove, held until they say so twice. */
  const [pendingRemoval, setPendingRemoval] = useState<{ variantId: string; title: string } | null>(
    null,
  );
  const signedIn = status === "authenticated";
  const isDigital = productType === "digital";

  /* A digital cart is one product from one seller with nothing to deliver, so it
     is not a basket being assembled — it is a purchase waiting to be paid for.
     The header bar says so; everything else here is named by the route. */
  useShopPageTitle(isDigital ? t("purchaseTitle") : null);

  /**
   * The quote is a server computation over the *server* cart, so it is only
   * meaningful once signed in. Signed out, the subtotal below is computed from
   * the local lines — which is the same arithmetic, because there is nothing
   * else in the total.
   */
  useEffect(() => {
    if (!signedIn || count === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      return;
    }

    let cancelled = false;
    quoteCart()
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch(() => {
        // A failed quote is not a broken cart: the subtotal is still correct,
        // and checkout re-quotes anyway. Fall back rather than blocking.
        if (!cancelled) setQuote(null);
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, count, lines]);

  const localSubtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const currency = quote?.currency ?? lines[0]?.currency ?? "XAF";
  const subtotal = quote?.subtotal ?? localSubtotal;
  const total = quote?.total ?? localSubtotal;

  const open = useCallback(
    (line: (typeof lines)[number]) => {
      // A line restored from the server carries no slugs — nothing to link to,
      // so the title simply is not a link in that case.
      if (line.storeSlug && line.productSlug) {
        router.push(productPath(line.storeSlug, line.productSlug));
      }
    },
    [router]
  );

  /**
   * ⚠ Before the empty state, not after it.
   *
   * `count === 0` is ambiguous until the cart has actually been read, and this
   * page answered the ambiguous case with a definitive sentence: a signed-in
   * shopper holding two lines was told "Your cart is empty" for about three
   * seconds and offered a button back to browsing. On a slow connection that is
   * however long the request takes. A skeleton says "loading"; an empty state
   * says "gone", and only one of those is honest here.
   */
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <h1 className="sr-only">{tKey("shop.nav.tabs.cart")}</h1>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={92} radius="var(--radius-card)" />
          ))}
        </div>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <h1 className="sr-only">{tKey("shop.nav.tabs.cart")}</h1>
        {dropped.length > 0 && <DroppedNotice dropped={dropped} onDismiss={dismissDropped} />}
        {negotiationLapsed.length > 0 && (
          <NegotiationLapsedNotice
            titles={negotiationLapsed}
            onDismiss={dismissNegotiationLapsed}
          />
        )}
        <EmptyState
          icon="shopping-cart"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actionLabel={t("continueShopping")}
          actionIcon="arrow-left"
          onAction={() => router.push("/shop")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* The visible title is the header bar's. */}
      <h1 className="sr-only">{isDigital ? t("purchaseTitle") : tKey("shop.nav.tabs.cart")}</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <Icon name={isDigital ? "zap" : "info"} size={15} style={{ color: "var(--text-muted)" }} />
        <span className="muted" style={{ fontSize: 12.5 }}>
          {isDigital ? t("digitalNote") : t("multiVendorNote")}
        </span>
      </div>

      {dropped.length > 0 && <DroppedNotice dropped={dropped} onDismiss={dismissDropped} />}
        {negotiationLapsed.length > 0 && (
          <NegotiationLapsedNotice
            titles={negotiationLapsed}
            onDismiss={dismissNegotiationLapsed}
          />
        )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            background: "var(--surface)",
            alignSelf: "start",
          }}
        >
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
            {productType && (
              <Badge productType={productType} size="sm">
                {productType === "digital" ? t("digitalProducts") : t("physicalProducts")}
              </Badge>
            )}
            <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
              {t("lineCount", { n: lines.length })}
            </span>
          </div>

          {lines.map((line) => (
            <div
              key={line.variantId}
              style={{ display: "flex", gap: 12, padding: 13, borderBottom: "1px solid var(--border-subtle)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={line.image ?? "/no_product_image.png"}
                alt=""
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "var(--radius-md)",
                  objectFit: "cover",
                  flexShrink: 0,
                  background: "var(--surface-2)",
                }}
                
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  onClick={() => open(line)}
                  disabled={!line.storeSlug}
                  style={{
                    border: "none",
                    background: "none",
                    padding: 0,
                    cursor: line.storeSlug ? "pointer" : "default",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.3 }}>
                    {line.title}
                  </div>
                </button>
                <div className="muted" style={{ fontSize: 12.5, margin: "2px 0 8px" }}>
                  {[line.storeName, line.variantName].filter(Boolean).join(" · ")}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  {productType === "digital" ? (
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {t("qtyOne")}
                    </span>
                  ) : (
                    /* The stepper can go *down* now. `POST /items` only ever
                       increments; this is `PATCH /items/:variantId`, which sets an
                       absolute quantity — the endpoint that made the control
                       implementable at all. */
                    <QtyStepper
                      size="sm"
                      value={line.qty}
                      max={99}
                      onChange={(q) => write(setQty(line.variantId, q), t("qtyFailed"))}
                    />
                  )}
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--text-strong)" }}>
                      {formatMoney(line.price * line.qty, line.currency)}
                    </span>
                    {/* A price haggled in chat. The number is already `price` —
                        this only says whose number it is, because "24 000" with
                        no label is indistinguishable from the shelf price the
                        shopper negotiated away from. */}
                    {line.negotiated && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--success)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t("agreedPrice")}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {/* `DELETE /items/variant/:variantId` — removes THIS line. The
                  product-keyed route would drop every size of a T-shirt.

                  It asks first: this is a 34-pixel target sitting beside a
                  quantity stepper, and the cart is the last place a mis-tap
                  should silently undo the work of finding something. */}
              <IconButton
                icon="trash-2"
                variant="plain"
                size="sm"
                label={tKey("shop.common.remove")}
                disabled={busy}
                onClick={() =>
                  setPendingRemoval({ variantId: line.variantId, title: line.title })
                }
              />
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 16,
              background: "var(--surface)",
            }}
          >
            <p className="ds-overline" style={{ marginBottom: 12 }}>
              {t("orderSummary")}
            </p>

            <Row label={t("subtotal")} value={formatMoney(subtotal, currency)} />

            {!isDigital && (
              <Row
                label={t("delivery")}
                value={
                  <span style={{ color: "var(--success)", fontWeight: 700 }}>
                    {t("deliveryIncluded")}
                  </span>
                }
              />
            )}

            {/* Informational only, and never added to the total. */}
            {quote?.absorbedByVendor ? (
              <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, margin: "2px 0 6px" }}>
                {t("vendorCoversDelivery", {
                  amount: formatMoney(quote.absorbedByVendor, currency),
                })}
              </p>
            ) : null}

            {/* Pinned zeros server-side — shown only if either ever becomes real,
                so the receipt does not change shape the day one does. */}
            {quote && quote.discount > 0 && (
              <Row
                label={t("discount")}
                value={t("discountAmount", { amount: formatMoney(quote.discount, currency) })}
              />
            )}
            {quote && quote.tax > 0 && (
              <Row label={t("tax")} value={formatMoney(quote.tax, currency)} />
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderTop: "1px solid var(--border)",
                marginTop: 8,
                paddingTop: 12,
              }}
            >
              <span style={{ fontSize: 13.5, color: "var(--text-muted)", fontWeight: 600 }}>
                {t("total")}
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text-strong)",
                }}
              >
                {formatMoney(total, currency)}
              </span>
            </div>

            <div style={{ marginTop: 14 }}>
              <Button
                block
                size="lg"
                elevated
                disabled={busy}
                trailingIcon="arrow-right"
                onClick={() => router.push("/shop/checkout")}
              >
                {signedIn
                  ? isDigital
                    ? t("continueToPayment")
                    : t("checkout")
                  : isDigital
                    ? t("signInToPay")
                    : t("signInToCheckout")}
              </Button>
            </div>

            {!signedIn && (
              <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 10 }}>
                {t("cartFollowsYou")}
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t("removeTitle")}
        tone="danger"
        icon="trash-2"
        confirmLabel={tKey("shop.common.remove")}
        cancelLabel={t("keepIt")}
        busy={busy}
        onConfirm={() => {
          const line = pendingRemoval;
          if (!line) return;
          // Closes either way: `removeLine` re-throws a failed DELETE, and a
          // dialog left open over a cart that did not change is worse than the
          // line simply still being there. The failure is not silent, though —
          // `write` puts it in a toast, so a removal that did not happen says
          // why instead of just not happening.
          write(removeLine(line.variantId), t("removeFailed"));
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      >
        {t.rich("removeBody", {
          title: pendingRemoval?.title ?? "",
          b: (chunks) => <strong>{chunks}</strong>,
        })}
      </ConfirmDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13.5,
        padding: "5px 0",
        color: "var(--text-body)",
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

/**
 * What the sign-in merge could not carry over.
 *
 * The endpoint reports dropped lines instead of throwing precisely so this can
 * be shown — silently losing a line is the thing `POST /cart/merge` exists to
 * prevent, and swallowing `meta.dropped[]` would reintroduce it.
 */
/**
 * A price agreed in chat that this cart no longer has.
 *
 * Changing a line's quantity and signing in with an anonymous cart both revert
 * a negotiated line to the shelf price, and both answer a valid 200 with no
 * field saying so. Without this the shopper sees only a total that moved.
 *
 * Deliberately not phrased as an error: nothing failed, and the backend's
 * reasoning is sound — a lock is bound to a quantity, so a different quantity
 * is a different deal. What the shopper needs is the fact and the way back,
 * which is the same chat they haggled in.
 */
function NegotiationLapsedNotice({
  titles,
  onDismiss,
}: {
  titles: string[];
  onDismiss: () => void;
}) {
  const t = useTranslations("shop.cart");
  const tKey = useTranslations();

  return (
    <div
      role="status"
      className="mb-4"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        border: "1px solid var(--warning-border)",
        background: "var(--warning-bg)",
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
      }}
    >
      <Icon name="triangle-alert" size={17} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
          {t.rich("negotiationLapsed", {
            n: titles.length,
            b: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--text-muted)" }}>
          {titles.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      </div>
      <IconButton
        icon="x"
        variant="plain"
        size="sm"
        label={tKey("shop.common.dismiss")}
        onClick={onDismiss}
      />
    </div>
  );
}

function DroppedNotice({
  dropped,
  onDismiss,
}: {
  dropped: { variantId: string; reason: CartDropReason }[];
  onDismiss: () => void;
}) {
  const t = useTranslations("shop.cart");
  const tKey = useTranslations();

  return (
    <div
      role="status"
      className="mb-4"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        border: "1px solid var(--warning-border)",
        background: "var(--warning-bg)",
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
      }}
    >
      <Icon name="triangle-alert" size={17} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
          <strong>{t("dropped", { n: dropped.length })}</strong>
        </p>
        <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--text-muted)" }}>
          {dropped.map((line) => (
            <li key={line.variantId}>
              {t(DROP_REASON_KEY[line.reason] ?? "dropReason.unknown")}
            </li>
          ))}
        </ul>
      </div>
      <IconButton
        icon="x"
        variant="plain"
        size="sm"
        label={tKey("shop.common.dismiss")}
        onClick={onDismiss}
      />
    </div>
  );
}
