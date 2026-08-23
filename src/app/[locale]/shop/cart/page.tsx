"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, ConfirmDialog, EmptyState, Icon, IconButton, QtyStepper } from "@/components/shop/ds";
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

const DROP_REASON: Record<CartDropReason, string> = {
  PRODUCT_UNAVAILABLE: "no longer on sale",
  PRODUCT_TYPE_CONFLICT: "a different product type to the cart you already had",
  DIGITAL_LIMIT_REACHED: "a second digital product — only one fits in a cart",
  SERVICE_NOT_ALLOWED: "a service, which is booked rather than carted",
  SERVER_CART_KEPT: "already replaced by the cart on your account",
};

export default function CartPage() {
  const router = useRouter();
  const { status } = useAuth();
  const { lines, productType, count, busy, dropped, dismissDropped, setQty, removeLine } = useCart();
  const { flashError } = useToast();
  const t = useTranslations("errors");

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
      void op.catch((err: unknown) => flashError(translateError(t, err, failed)));
    },
    [flashError, t],
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
  useShopPageTitle(isDigital ? "Your purchase" : null);

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

  if (count === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <h1 className="sr-only">Cart</h1>
        {dropped.length > 0 && <DroppedNotice dropped={dropped} onDismiss={dismissDropped} />}
        <EmptyState
          icon="shopping-cart"
          title="Your cart is empty"
          description="Let’s fix that — browse the market and add something you love."
          actionLabel="Continue shopping"
          actionIcon="arrow-left"
          onAction={() => router.push("/shop")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* The visible title is the header bar's. */}
      <h1 className="sr-only">{isDigital ? "Your purchase" : "Cart"}</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <Icon name={isDigital ? "zap" : "info"} size={15} style={{ color: "var(--text-muted)" }} />
        <span className="muted" style={{ fontSize: 12.5 }}>
          {isDigital
            ? "One digital product, paid for on its own. Nothing to deliver."
            : "Items from different sellers become separate orders — you pay once."}
        </span>
      </div>

      {dropped.length > 0 && <DroppedNotice dropped={dropped} onDismiss={dismissDropped} />}

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
                {productType === "digital" ? "Digital products" : "Physical products"}
              </Badge>
            )}
            <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
              {lines.length} line{lines.length === 1 ? "" : "s"}
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
                      Qty 1
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
                      onChange={(q) => write(setQty(line.variantId, q), "We couldn't change that quantity.")}
                    />
                  )}
                  <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--text-strong)" }}>
                    {formatMoney(line.price * line.qty, line.currency)}
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
                label="Remove"
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
              Order summary
            </p>

            <Row label="Subtotal" value={formatMoney(subtotal, currency)} />

            {!isDigital && (
              <Row
                label="Delivery"
                value={<span style={{ color: "var(--success)", fontWeight: 700 }}>Included</span>}
              />
            )}

            {/* Informational only, and never added to the total. */}
            {quote?.absorbedByVendor ? (
              <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, margin: "2px 0 6px" }}>
                Your seller covers {formatMoney(quote.absorbedByVendor, currency)} of delivery on
                this order.
              </p>
            ) : null}

            {/* Pinned zeros server-side — shown only if either ever becomes real,
                so the receipt does not change shape the day one does. */}
            {quote && quote.discount > 0 && (
              <Row label="Discount" value={`− ${formatMoney(quote.discount, currency)}`} />
            )}
            {quote && quote.tax > 0 && <Row label="Tax" value={formatMoney(quote.tax, currency)} />}

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
              <span style={{ fontSize: 13.5, color: "var(--text-muted)", fontWeight: 600 }}>Total</span>
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
                    ? "Continue to payment"
                    : "Checkout"
                  : isDigital
                    ? "Sign in to pay"
                    : "Sign in to check out"}
              </Button>
            </div>

            {!signedIn && (
              <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 10 }}>
                Your cart moves with you when you sign in.
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove this item?"
        tone="danger"
        icon="trash-2"
        confirmLabel="Remove"
        cancelLabel="Keep it"
        busy={busy}
        onConfirm={() => {
          const line = pendingRemoval;
          if (!line) return;
          // Closes either way: `removeLine` re-throws a failed DELETE, and a
          // dialog left open over a cart that did not change is worse than the
          // line simply still being there. The failure is not silent, though —
          // `write` puts it in a toast, so a removal that did not happen says
          // why instead of just not happening.
          write(removeLine(line.variantId), "We couldn't remove that item.");
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      >
        <strong>{pendingRemoval?.title}</strong> comes out of your cart. You can add it again from
        its page.
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
function DroppedNotice({
  dropped,
  onDismiss,
}: {
  dropped: { variantId: string; reason: CartDropReason }[];
  onDismiss: () => void;
}) {
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
          <strong>
            {dropped.length} item{dropped.length === 1 ? "" : "s"} could not be added to your
            account cart.
          </strong>
        </p>
        <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12, color: "var(--text-muted)" }}>
          {dropped.map((line) => (
            <li key={line.variantId}>{DROP_REASON[line.reason] ?? "unavailable"}</li>
          ))}
        </ul>
      </div>
      <IconButton icon="x" variant="plain" size="sm" label="Dismiss" onClick={onDismiss} />
    </div>
  );
}
