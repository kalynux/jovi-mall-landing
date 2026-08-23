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
  type PaymentOption,
} from "@/components/shop/PaymentMethodPicker";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { ApiError } from "@/lib/auth/auth.types";
import { isNetworkError } from "@/lib/errors/is-network-error";
import { quoteCart } from "@/lib/shop/cart.api";
import { checkout } from "@/lib/shop/orders.api";
import { getProfile } from "@/lib/shop/profile.api";
import { initiatePayment, isSettledFailure } from "@/lib/shop/payments.api";
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
  const { lines, productType, count, clear, refresh } = useCart();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [option, setOption] = useState<PaymentOption>(CHECKOUT_OPTIONS[0]);
  const [phone, setPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const isCod = option.isCod === true;
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
          setError(addressProblem(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, addressId, count, needsAddress]);

  /* ── Empty cart ────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (status === "authenticated" && count === 0 && !placing) router.replace("/shop/cart");
  }, [status, count, placing, router]);

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
      setError(checkoutError(err));
    }
  }, [isCod, needsAddress, addressId, clear, option, phone, router, refresh]);

  if (status === "loading" || (status === "authenticated" && loadingProfile)) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6">
        <Skeleton height={28} width="40%" />
        <div style={{ height: 16 }} />
        <Skeleton height={120} />
        <div style={{ height: 12 }} />
        <Skeleton height={200} />
      </div>
    );
  }

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
        options={payOptions}
        value={option}
        onChange={setOption}
        phone={phone}
        onPhoneChange={setPhone}
        disabled={placing}
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

/**
 * `details.reason` distinguishes two situations that need different fixes, and
 * telling them apart is the whole reason the backend reports it.
 */
function addressProblem(error: ApiError): string {
  const reason = (error.details as { reason?: string } | undefined)?.reason;
  return reason === "selected_address_not_geocoded"
    ? "We cannot locate the address you chose. Open it in your addresses and re-pick it from the search results — a typed address has no coordinates to deliver to."
    : "Choose a delivery address before paying.";
}

function checkoutError(error: unknown): string {
  /**
   * Before the `ApiError` check, because a request that never arrived is not
   * one — it has no status, no code and no body, so it fell through to the
   * generic line below and told a shopper who had walked into a lift that
   * something unexpected had happened. It is the likeliest failure on this
   * page and the only one they can do anything about.
   *
   * Bespoke copy rather than `errors.NETWORK_ERROR`, for the same reason every
   * other branch here is bespoke: on the pay button, "nothing was charged" is
   * the half of the message that matters. Checkout is atomic — no orders are
   * created unless all of them are — so this is a promise the API keeps.
   */
  if (isNetworkError(error)) {
    return "We can't reach Wi-Mall right now. Nothing was charged — check your connection and try again.";
  }

  if (!(error instanceof ApiError)) {
    return "Something went wrong placing your order. Nothing was charged — please try again.";
  }

  switch (error.code) {
    case "CATALOG_INSUFFICIENT_STOCK": {
      // `available` is what the shopper can actually buy — stock minus what other
      // in-flight checkouts are holding — so it is a real, actionable number.
      const details = error.details as
        | { sku?: string; requested?: number; available?: number }
        | undefined;
      const item = details?.sku ? `“${details.sku}”` : "one of your items";
      return typeof details?.available === "number"
        ? `Not enough stock for ${item} — ${details.available} left, you asked for ${details.requested}. Lower the quantity and try again.`
        : `${item} just went out of stock. Adjust your cart and try again.`;
    }
    case "ORDER_DELIVERY_ADDRESS_REQUIRED":
      return addressProblem(error);
    case "ORDER_CART_EMPTY":
      return "Your cart is empty.";
    case "COD_NOT_AVAILABLE_FOR_DIGITAL":
      return "Cash on delivery is not available for digital products. Choose another payment method.";
    case "COD_ORDER_AMOUNT_EXCEEDS_LIMIT":
      return "This order is too large for cash on delivery. Please pay online instead.";
    case "COD_AGENCY_NOT_SUPPORTED":
      return "The courier for this order does not handle cash on delivery. Please pay online instead.";
    case "ORDER_NO_DELIVERY_AGENCY":
      return "One of these items has no delivery service available right now. Remove it and try again.";
    default:
      return error.message || "Something went wrong placing your order. Please try again.";
  }
}
