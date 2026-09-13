"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, Icon, Skeleton } from "@/components/shop/ds";
import { useCart } from "@/components/shop/providers";
import {
  CHECKOUT_OPTIONS,
  PaymentMethodPicker,
  paymentChannel,
  paymentReady,
} from "@/components/shop/PaymentMethodPicker";
import { useSavedPayment } from "@/components/shop/useSavedPayment";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { ApiError } from "@/lib/auth/auth.types";
import { isNetworkError } from "@/lib/errors/is-network-error";
import { lookupMessage, translateError } from "@/lib/auth/error-translator";
import { useTranslations } from "next-intl";
import { quoteCart } from "@/lib/shop/cart.api";
import { checkout } from "@/lib/shop/orders.api";
import { getProfile } from "@/lib/shop/profile.api";
import { initiatePayment, isSettledFailure } from "@/lib/shop/payments.api";
import { rememberPaymentAttempt } from "@/lib/shop/payment-attempts";
import { formatMoney } from "@/lib/shop/format";
import type { CartQuote, SavedAddress } from "@/lib/shop/customer.types";

/**
 * Checkout — real orders, real money.
 *
 * This page used to take nothing and create nothing; it now runs the actual
 * two-step flow:
 *
 *   1. `POST /api/customer/orders/checkout` → one order per vendor, all sharing
 *      one `cartId`. Atomic: if any order fails, none are created and the cart
 *      is left intact. Stock is held here for 30 minutes — a cart reserves
 *      nothing.
 *   2. `POST /api/payments/initiate` with that `cartId` → one transaction for
 *      the whole group. Cash on delivery skips this entirely.
 *
 * ── Two failures worth catching early ────────────────────────────────────────
 *
 * `POST /cart/quote` is called with the chosen `deliveryAddressId` **before** the
 * pay button, because it validates the address with the same rule checkout
 * applies. An address typed by hand rather than picked from `GET /api/geo/search`
 * has no coordinates and checkout refuses it — much better learned here.
 *
 * And `CATALOG_INSUFFICIENT_STOCK` names the line in `details`, so it is
 * surfaced as "that size just went" with the number that is actually available,
 * not as a generic failure.
 */

function addressLine(address: SavedAddress): string {
  return [address.address_line1, address.address_line2, address.city, address.state]
    .filter(Boolean)
    .join(", ");
}

export default function CheckoutPage() {
  const router = useRouter();
  // Checkout is `requireRole(['customer'])` server-side and `/shop/checkout` is
  // in `PROTECTED_PREFIXES`, so this only re-checks and surfaces the WA gate.
  const { status } = useAuthGuard();
  const { lines, productType, count, hydrated, clear, refresh } = useCart();

  /*
     Two namespaces, and the order between them is the point.

     `checkout.errors` holds this screen's own copy, every line of which carries
     the one fact the shared catalogue cannot: checkout is atomic, so a refusal
     means nothing was ordered and nothing was charged. `errors` is the shared
     ladder every other screen uses, and it catches the codes this screen has no
     special framing for -- including any the backend adds tomorrow, which is
     what the hardcoded switch this replaced could never do. */
  const tCheckout = useTranslations("checkout.errors");
  const tErrors = useTranslations("errors");

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const isDigital = productType === "digital";
  /**
   * Cash on delivery is dropped for a digital cart: there is nothing to hand
   * over, and the backend refuses it with `COD_NOT_AVAILABLE_FOR_DIGITAL`.
   *
   * Memoised because the picker takes it as an effect dependency — a fresh
   * array literal every render would re-run the operator auto-select on every
   * keystroke, for a list that changes only with the cart's type.
   */
  const payOptions = useMemo(
    () => CHECKOUT_OPTIONS.filter((o) => !(o.isCod && isDigital)),
    [isDigital]
  );
  // Digital orders have nothing to deliver, so the backend ignores the address
  // entirely for them — asking would be a step with no purpose.
  const needsAddress = !isDigital;

  /**
   * The payment form, preloaded with whatever the shopper has saved.
   *
   * Preselecting their default is the whole reason the account page calls these
   * "saved for faster checkout" — until this existed nothing on any pay screen
   * had ever read them, so every checkout started on MTN with an empty field no
   * matter what was saved.
   */
  const payForm = useSavedPayment(payOptions, status === "authenticated");
  const { option, phone } = payForm;
  const isCod = option.isCod === true;

  /* ── Saved addresses ───────────────────────────────────────────────────── */

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    getProfile()
      .then((profile) => {
        if (cancelled) return;
        const saved = profile.savedAddresses ?? [];
        setAddresses(saved);
        // The backend falls back to the default address when none is sent, so
        // preselecting it makes the screen match what would happen anyway.
        const preferred = saved.find((a) => a.is_default) ?? saved[0];
        setAddressId(preferred?._id ?? null);
        setLoadingProfile(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  /* ── Quote, re-run whenever the address changes ────────────────────────── */

  useEffect(() => {
    if (status !== "authenticated" || count === 0) return;
    let cancelled = false;

    // Cleared in the handlers rather than here: a synchronous setState in an
    // effect body is a cascading render, and the previous error is still true
    // until the new quote answers.
    quoteCart(needsAddress && addressId ? addressId : undefined)
      .then((result) => {
        if (cancelled) return;
        setQuote(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setQuote(null);
        // The one error worth reporting from a quote: the address cannot be
        // routed to. Everything else is a soft failure — checkout re-quotes.
        if (err instanceof ApiError && err.code === "ORDER_DELIVERY_ADDRESS_REQUIRED") {
          setError(addressProblem(tCheckout, err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, addressId, count, needsAddress, tCheckout]);

  /* ── Empty cart ────────────────────────────────────────────────────────── */

  /**
   * ⚠ `hydrated` is what makes this correct, and it is not optional.
   *
   * Without it the guard fired on every deep link into checkout: `status` flips
   * to `"authenticated"` as soon as `/auth/me` answers, while the server cart is
   * fetched in a later effect — so `count` was still 0 on that render and a
   * shopper with a full basket was bounced to `/shop/cart`. Arriving from the
   * cart's own button hid it, because the cart was already read by then; a push
   * notification, a bookmark or the app resuming here did not.
   */
  useEffect(() => {
    if (!hydrated) return;
    if (status === "authenticated" && count === 0 && !placing) router.replace("/shop/cart");
  }, [hydrated, status, count, placing, router]);

  /* ── Place the order ───────────────────────────────────────────────────── */

  const placeOrder = useCallback(async () => {
    setError(null);
    setPlacing(true);

    try {
      const result = await checkout({
        paymentMethod: isCod ? "cash_on_delivery" : "online",
        ...(needsAddress && addressId ? { deliveryAddressId: addressId } : {}),
      });

      // The cart is cleared server-side on success; drop the local mirror so the
      // header badge does not keep showing a basket that no longer exists.
      await clear().catch(() => undefined);

      if (isCod) {
        router.push(`/shop/checkout/success?group=${encodeURIComponent(result.cartId)}&cod=1`);
        return;
      }

      const payment = await initiatePayment({
        cartId: result.cartId,
        gateway: option.gateway,
        channel: paymentChannel(option, phone),
      });

      // The one moment this id is knowable — nothing on the order side ever
      // returns it. The order screen's "Check payment" reads it back to force a
      // gateway re-check; see `payment-attempts`.
      await rememberPaymentAttempt(result.cartId, payment.transactionId);

      const params = new URLSearchParams({
        group: result.cartId,
        transaction: payment.transactionId,
      });
      if (payment.instructions?.ussdCode) params.set("ussd", payment.instructions.ussdCode);
      // What the gateway actually told us to tell the shopper. NotchPay writes
      // this per `action` — a `cm.mtn` charge answers "confirm" with NO ussd,
      // and the operator pushes a prompt instead — so discarding it and showing
      // our own fixed sentence guesses at a step that varies.
      if (payment.instructions?.message) params.set("note", payment.instructions.message);
      // The gateway refused on this very response — there is nothing to wait
      // for, so say so instead of spending a minute of polling to find out.
      // The orders still exist and are still payable; that is what the failed
      // view says, and what the order screen now offers.
      //
      // The refusal's own reason rides along separately from `note`: on a
      // refusal the provider writes it to the top-level `message` and sends no
      // `instructions` at all, so reusing `note` would carry nothing. "Your
      // operator declined this" is worth far more than a generic apology.
      if (isSettledFailure(payment.status)) {
        params.set("failed", "1");
        if (payment.message) params.set("reason", payment.message);
      }
      router.push(`/shop/checkout/success?${params}`);
    } catch (err: unknown) {
      setPlacing(false);
      // The orders were not created (checkout is atomic) or payment failed after
      // they were. Either way the cart may have changed server-side, so re-read
      // it rather than leaving a stale view.
      void refresh();
      setError(checkoutError(tCheckout, tErrors, err));
    }
  }, [
    isCod,
    needsAddress,
    addressId,
    clear,
    option,
    phone,
    router,
    refresh,
    tCheckout,
    tErrors,
  ]);

  // `payForm.ready` joins the gate rather than getting a spinner of its own: the
  // picker must not mount before the saved wallet has landed in the field, or
  // the number arrives as an edit and the operator detection overrides the rail
  // the shopper themselves declared. See `useSavedPayment`.
  // `!hydrated` joins this list because the redirect above now waits for it: the
  // cart being unread is a loading state, and without it this screen fell
  // through to the `return null` below and rendered a blank page until the cart
  // arrived.
  if (
    status === "loading" ||
    !hydrated ||
    (status === "authenticated" && (loadingProfile || !payForm.ready))
  ) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6">
        <h1 className="sr-only">Checkout</h1>
        <Skeleton height={28} width="40%" />
        <div style={{ height: 16 }} />
        <Skeleton height={120} />
        <div style={{ height: 12 }} />
        <Skeleton height={200} />
      </div>
    );
  }

  // Reached only once the cart is known: signed out, or genuinely empty and
  // about to be redirected by the effect above.
  if (status !== "authenticated" || count === 0) return null;

  const currency = quote?.currency ?? lines[0]?.currency ?? "XAF";
  const total = quote?.total ?? lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const phoneOk = paymentReady(option, phone);
  const addressOk = !needsAddress || Boolean(addressId);
  const canPay = phoneOk && addressOk && !placing;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      {/* Title and back arrow are both the header bar's now. It steps through
          real history first, so a digital buy-now — which never passed through
          the cart page — still returns to the product it came from rather than
          to a screen the shopper has not seen. */}
      <h1 className="sr-only">Checkout</h1>

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
            borderRadius: "var(--radius-md)",
            padding: "11px 13px",
            marginBottom: 18,
          }}
        >
          <Icon name="triangle-alert" size={17} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Address */}
      {needsAddress && (
        <>
          <p className="ds-overline" style={{ marginBottom: 8 }}>
            Delivery address
          </p>
          {addresses.length === 0 ? (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              <p className="muted" style={{ fontSize: 13.5, margin: "0 0 12px" }}>
                You have no saved address. Add one — search for it rather than typing it, or we
                cannot route a delivery to it.
              </p>
              <Button variant="secondary" onClick={() => router.push("/shop/account/addresses")}>
                Add an address
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {addresses.map((address) => (
                <button
                  key={address._id}
                  onClick={() => setAddressId(address._id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    padding: 13,
                    borderRadius: "var(--radius-md)",
                    cursor: "pointer",
                    textAlign: "left",
                    background: "var(--surface)",
                    border:
                      addressId === address._id ? "1.5px solid var(--brand)" : "1.5px solid var(--border)",
                  }}
                >
                  <Icon name="map-pin" size={20} style={{ color: "var(--brand)", marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {address.label ?? "Address"}
                      {address.is_default && (
                        <span style={{ marginLeft: 6 }}>
                          <Badge tone="neutral" size="sm">
                            Default
                          </Badge>
                        </span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                      {addressLine(address)}
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => router.push("/shop/account/addresses")}
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--brand-hover)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  alignSelf: "flex-start",
                  padding: "4px 0",
                }}
              >
                Manage addresses
              </button>
            </div>
          )}
        </>
      )}

      {/* Payment */}
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        Payment method
      </p>
      <PaymentMethodPicker
        key={payForm.formKey}
        options={payOptions}
        value={option}
        onChange={payForm.setOption}
        phone={phone}
        onPhoneChange={payForm.setPhone}
        disabled={placing}
        saved={payForm}
      />

      {option.id === "card" && (
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 20, lineHeight: 1.5 }}>
          You will be asked for your card details on the next step, on the payment provider’s own
          secure form.
        </p>
      )}

      {isCod && (
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 20, lineHeight: 1.5 }}>
          You pay the courier on delivery. We send you a delivery code — give it to the courier
          only once you have your parcel.
        </p>
      )}

      {/* Summary */}
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        Order summary
      </p>
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 8 }}>
        {lines.map((line) => (
          <div
            key={line.variantId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "var(--text-body)",
              padding: "3px 0",
              gap: 12,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {line.qty}× {line.title}
              {line.storeName && <span className="muted"> · {line.storeName}</span>}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {formatMoney(line.price * line.qty, line.currency)}
            </span>
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 8, paddingTop: 8 }}>
          <SummaryRow label="Subtotal" value={formatMoney(quote?.subtotal ?? total, currency)} />
          {!isDigital && (
            <SummaryRow
              label="Delivery"
              value={<span style={{ color: "var(--success)", fontWeight: 700 }}>Included</span>}
            />
          )}
          <SummaryRow label="Total" value={formatMoney(total, currency)} strong />
        </div>
      </div>

      {quote?.absorbedByVendor ? (
        <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Your seller covers {formatMoney(quote.absorbedByVendor, currency)} of delivery on this
          order.
        </p>
      ) : null}

      {quote && quote.perVendor.length > 1 && (
        <div style={{ display: "flex", gap: 7, marginTop: 8, marginBottom: 20 }}>
          <Icon name="shield-check" size={16} style={{ color: "var(--brand)", marginTop: 1 }} />
          <span className="muted" style={{ fontSize: 12.5 }}>
            This becomes {quote.perVendor.length} orders — one per seller, each shipping
            independently. You are charged once for the group.
          </span>
        </div>
      )}

      <div
        style={{ display: "flex", alignItems: "center", gap: 12, position: "sticky", bottom: 0 }}
        className="stickybar rounded-t-2xl"
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {formatMoney(total, currency)}
          </div>
        </div>
        <Button
          size="lg"
          elevated
          leadingIcon={isCod ? "banknote" : "lock"}
          disabled={!canPay}
          title={
            !addressOk
              ? "Choose a delivery address"
              : !phoneOk
                ? "Enter a valid mobile money number"
                : undefined
          }
          onClick={() => void placeOrder()}
        >
          {placing ? "Placing…" : isCod ? "Place order" : `Pay ${formatMoney(total, currency)}`}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: strong ? 14 : 13,
        fontWeight: strong ? 800 : 400,
        padding: "3px 0",
        color: strong ? "var(--text-strong)" : "var(--text-body)",
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

type Translator = (key: string, values?: Record<string, string>) => string;

/**
 * Why a delivery address was refused.
 *
 * `details.reason` separates "you have not chosen one" from "the one you chose
 * has no coordinates", and the second needs a different instruction: a
 * hand-typed address looks complete and cannot be delivered to, so telling the
 * shopper to pick one is advice they have already followed.
 */
function addressProblem(t: Translator, error: ApiError): string {
  const reason = (error.details as { reason?: string } | undefined)?.reason;
  return reason === "selected_address_not_geocoded"
    ? t("ADDRESS_NOT_GEOCODED")
    : t("ORDER_DELIVERY_ADDRESS_REQUIRED");
}

/**
 * Checkout's copy for a failed order, localised.
 *
 * This was a hardcoded English `switch` over seven codes -- the one screen on
 * the shop outside the shared `translateError` ladder, so a French, Spanish,
 * Portuguese or Arabic shopper met English at the pay button and nowhere else.
 *
 * The resolution order, and why it is not simply `translateError`:
 *
 *  1. **Network first**, before the `ApiError` check. A request that never
 *     arrived has no status, no code and no body, so it would otherwise fall to
 *     the generic line -- and it is both the likeliest failure here and the only
 *     one the shopper can act on.
 *  2. **`checkout.errors.<CODE>`**, this screen's own framing. Every line there
 *     says nothing was charged, which the shared catalogue's wording cannot,
 *     because it is only true of an atomic checkout.
 *  3. **The shared ladder**, for everything else -- so a code the backend adds
 *     tomorrow gets its ordinary translated copy instead of the raw envelope,
 *     which is exactly what the switch's `default` could not do.
 *
 * The two interpolated branches are handled ahead of the lookup because they
 * need `details`, which a plain code-to-string map has no way to reach.
 */
function checkoutError(tCheckout: Translator, tErrors: Translator, error: unknown): string {
  if (isNetworkError(error)) return tCheckout("NETWORK");
  if (!(error instanceof ApiError)) return tCheckout("GENERIC");

  if (error.code === "CATALOG_INSUFFICIENT_STOCK") {
    // `available` is what the shopper can actually buy -- stock minus what other
    // in-flight checkouts are holding -- so it is a real, actionable number.
    const details = error.details as
      | { sku?: string; requested?: number; available?: number }
      | undefined;
    const item = details?.sku ? `\u201C${details.sku}\u201D` : tCheckout("ITEM_FALLBACK");
    return typeof details?.available === "number"
      ? tCheckout("CATALOG_INSUFFICIENT_STOCK", {
          item,
          available: String(details.available),
          requested: String(details.requested ?? ""),
        })
      : tCheckout("CATALOG_INSUFFICIENT_STOCK_UNKNOWN", { item });
  }

  if (error.code === "ORDER_DELIVERY_ADDRESS_REQUIRED") return addressProblem(tCheckout, error);

  const scoped = lookupMessage(tCheckout, error.code);
  if (scoped) return scoped;

  return translateError(tErrors, error, tCheckout("GENERIC"));
}
