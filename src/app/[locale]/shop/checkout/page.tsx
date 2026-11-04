"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, Icon, Skeleton } from "@/components/shop/ds";
import { useCart } from "@/components/shop/providers";
import {
  COD,
  OnlinePaymentUnavailable,
  OptionsLoadFailed,
  PaymentMethodPicker,
  chargeRequest,
  paymentReady,
} from "@/components/shop/PaymentMethodPicker";
import { usePaymentOptions } from "@/components/shop/usePaymentOptions";
import { useSavedPayment } from "@/components/shop/useSavedPayment";
import { useChargeRefusal } from "@/components/shop/useChargeRefusal";
import { PaymentLimitNote } from "@/components/shop/PaymentSteps";
import { CodUnavailableNotice } from "@/components/shop/CodUnavailableNotice";
import {
  PartialAmountField,
  PartialPaymentNotice,
  useRefusedAmount,
} from "@/components/shop/PartialPayment";
import { DeliveryMinimumNotice, fromShop } from "@/components/shop/DeliveryMinimumNotice";
import { DeliveryQuoteLines } from "@/components/shop/DeliveryQuoteLines";
import { RegionPicker } from "@/components/shop/RegionPicker";
import { LegalAgreement } from "@/components/legal/LegalLink";
import { ProtectionLine } from "@/components/shop/ProtectionLine";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { ApiError } from "@/lib/auth/auth.types";
import { isNetworkError } from "@/lib/errors/is-network-error";
import { lookupMessage, translateError } from "@/lib/auth/error-translator";
import { useTranslations } from "next-intl";
import { quoteCart } from "@/lib/shop/cart.api";
import { codRefusalFromError, codRefusalOf, type CodRefusal } from "@/lib/shop/cash-on-delivery";
import { checkout } from "@/lib/shop/orders.api";
import {
  isAlreadyPaid,
  parsePartialAmount,
  partialOfferOf,
  partialRefusalFromError,
  partialRefusalOf,
  type PartialRefusalReason,
} from "@/lib/shop/partial-payment";
import { updateAddress } from "@/lib/shop/addresses.api";
import { regionInvalidDetails, withRegion } from "@/lib/shop/address-region";
import { getProfile } from "@/lib/shop/profile.api";
import {
  getPaymentOptions,
  initiatePayment,
  isSettledFailure,
  nextPaymentStep,
} from "@/lib/shop/payments.api";
import { cardPagePath } from "@/lib/shop/pay-link.api";
import { rememberPaymentAttempt } from "@/lib/shop/payment-attempts";
import { amountOutsideLimits, handsetStepOf, rememberHandsetStep } from "@/lib/shop/mobile-money";
import { formatMoney } from "@/lib/shop/format";
import type { CartLine } from "@/lib/shop/shop.types";
import type {
  AddressRegionInvalidDetails,
  CartQuote,
  DeliveryMinimumErrorDetails,
  SavedAddress,
} from "@/lib/shop/customer.types";

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
 * ── What can be paid with is asked, not assumed ──────────────────────────────
 *
 * The online rows are `GET /api/payments/options`, read when the page opens
 * and read AGAIN just before the orders are created. Checkout is the one pay
 * screen where the orders exist before the charge does, so a provider switched
 * off in between must be caught while the form still exists — after step 1
 * there is no cart left to keep. An empty list is "online payment is
 * unavailable", and cash on delivery stays where the cart allows it.
 *
 * Cash on delivery is asked too. Every quote carries `cashOnDelivery` — would
 * checkout accept this basket, for this account, as cash on delivery? While it
 * says no the row is not offered and `CodUnavailableNotice` says why. Checkout
 * can still refuse (`422 COD_*`) when something changed in between: nothing was
 * created, so the basket stays, the form falls back to the online rows and the
 * same notice appears. It is never retried.
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
 *
 * ── The delivery minimum (ADR-A07) ───────────────────────────────────────────
 *
 * The vendor pays the delivery fee, so checkout refuses a shop's items that are
 * too small to carry it (`ORDER_BELOW_DELIVERY_MINIMUM`). The quote predicts it
 * for the payment method passed — and cash on delivery is stricter (checked per
 * agency, with the COD fee), so the quote re-runs when the method changes and
 * the pay button waits while `meetsDeliveryMinimum` is false.
 *
 * ── The address's region (2026-10-02) ────────────────────────────────────────
 *
 * Checkout refuses a saved address whose `geo` names no region of its country
 * (`400 ADDRESS_REGION_INVALID`) — agency coverage is matched by region, so it
 * could never be delivered. The quote does NOT check this; only checkout does.
 * The body here carries `deliveryAddressId`, not an address, so the fix is an
 * edit of that saved address (`PATCH /addresses/:id` with the picked region's
 * key in `geo.components.region`) and then the same checkout again.
 *
 * ── Customer-paid delivery (ADR-A11, 2026-10-04) ─────────────────────────────
 *
 * A shop may now charge delivery, and the quote's `total` includes it — the
 * summary draws one delivery line per shop and that `total`, and adds nothing up
 * itself. The fee's out-of-region part depends on the address, which is one more
 * reason the quote re-runs when the address changes.
 *
 * Where every carrying company accepts it, an online checkout may pay the items
 * now and hand the delivery fee to the rider in cash (`deliveryFeeCash` on the
 * quote, `deliveryFeePayment: "cash_to_rider"` on checkout). Both amounts are the
 * quote's. The field is sent only when chosen, so an API that predates it never
 * sees a key it does not know.
 *
 * ── Pay part now (2026-11-01) ────────────────────────────────────────────────
 *
 * Off until every shop in the basket opts in, and then a row of its own on an
 * online method: a provider is what takes the part paid now. Each quote says
 * whether it is on offer (`partialPayment`), whatever method was sent. While it
 * is chosen the order is priced as cash on delivery, so the quote is asked as
 * that and the screen uses `partialPayment.total`.
 *
 * The orders are placed as `cash_on_delivery` with `partialPayment: true`, and
 * `initiate` then carries one `amount` for the whole checkout. From there a failed
 * charge leaves real orders waiting for their online part, so the shopper retries
 * from the order, with a different amount if they want. `409 PAYMENT_ORDER_ALREADY_PAID`
 * means the part went through.
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
  /* This screen's own copy, and the frozen shared vocabulary. */
  const t = useTranslations("shop.checkout");
  const tKey = useTranslations();
  const tMinimum = useTranslations("shop.deliveryMinimum");
  const tDelivery = useTranslations("shop.delivery");
  const tProvider = useTranslations("shop.payProvider");
  const tPartial = useTranslations("shop.partialPayment");

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  /** A checkout refused with `ADDRESS_REGION_INVALID`, and the saved address to fix. */
  const [regionFix, setRegionFix] = useState<{
    details: AddressRegionInvalidDetails;
    addressId: string;
  } | null>(null);
  const [fixingRegion, setFixingRegion] = useState(false);
  /** The shopper chose to hand the delivery fee to the rider in cash. */
  const [cashToRider, setCashToRider] = useState(false);
  /** The shopper chose "pay part now". Kept through a change of row; in effect on an online one. */
  const [partChosen, setPartChosen] = useState(false);
  /** What the amount field holds. `null` until edited, so it follows the quote's maximum. */
  const [partInput, setPartInput] = useState<string | null>(null);
  /**
   * A checkout refused as partial. Unlike cash on delivery's this outlives the
   * re-quote, because the option would otherwise come straight back into the same
   * refusal; choosing another address is what can change the answer.
   */
  const [partRefused, setPartRefused] = useState<PartialRefusalReason | null>(null);
  /** Bumped to re-quote when checkout refuses what the last quote offered. */
  const [quoteNonce, setQuoteNonce] = useState(0);
  /** A checkout refused as cash on delivery. Held until a quote gives its own verdict. */
  const [refusedAtCheckout, setRefusedAtCheckout] = useState<CodRefusal | null>(null);
  /**
   * Set when a refused checkout triggers its own re-quote: that quote answering
   * must not clear the refusal the shopper is still reading.
   */
  const keepError = useRef(false);

  const isDigital = productType === "digital";
  const online = usePaymentOptions(status === "authenticated");
  const refusal = useChargeRefusal(online.applyOffered);
  /**
   * Why cash on delivery is not on offer, or `null` while it is. The quote's
   * verdict first; a stale quote that still says yes does not outrank a
   * checkout that has just said no.
   */
  const codRefused = codRefusalOf(quote) ?? refusedAtCheckout;
  const codOffered = !isDigital && codRefused === null;
  /**
   * What `/options` lists, then cash on delivery — which is dropped for a
   * digital cart: there is nothing to hand over, and the backend refuses it
   * with `COD_NOT_AVAILABLE_FOR_DIGITAL` — and while `codRefused`. `null`
   * until `/options` answers — unless it failed outright, when cash on
   * delivery needs no answer from it.
   *
   * Memoised because the picker takes it as an effect dependency — a fresh
   * array literal every render would re-run the operator auto-select on every
   * keystroke, for a list that changes only with its inputs.
   */
  const payOptions = useMemo(() => {
    if (online.options === null) return online.failed && codOffered ? [COD] : null;
    return codOffered ? [...online.options, COD] : online.options;
  }, [online.options, online.failed, codOffered]);
  const onlineUnavailable = online.options?.length === 0;
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
  const isCod = option?.isCod === true;
  /** Read from any quote: this verdict does not depend on the method the quote was asked for. */
  const partOffer = useMemo(() => (partRefused ? null : partialOfferOf(quote)), [partRefused, quote]);
  const payPart = partChosen && !isCod && partOffer !== null;
  /** The amount to charge, or `null` while what is typed cannot be. */
  const partAmount = useMemo(
    () => (payPart && partOffer ? parsePartialAmount(partInput ?? String(partOffer.maximumAmount), partOffer) : null),
    [payPart, partOffer, partInput]
  );
  /** Said once, to a shopper who had chosen it and lost it. See `PartialPaymentNotice`. */
  const partGone = partChosen && !isCod && !partOffer ? (partRefused ?? partialRefusalOf(quote)) : null;
  /** What the order will be placed as: a partial order is cash on delivery with a prepaid part. */
  const orderMethod = isCod || payPart ? "cash_on_delivery" : "online";
  const refusedAmount = useRefusedAmount(quote?.currency ?? "XAF");

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

  /* ── Quote, re-run whenever the address or the payment method changes ──── */

  useEffect(() => {
    if (status !== "authenticated" || count === 0) return;
    let cancelled = false;

    // Cleared in the handlers rather than here: a synchronous setState in an
    // effect body is a cascading render, and the previous error is still true
    // until the new quote answers.
    quoteCart(
      needsAddress && addressId ? addressId : undefined,
      orderMethod
    )
      .then((result) => {
        if (cancelled) return;
        setQuote(result);
        // The server's current word replaces what a refused checkout said.
        if (result.cashOnDelivery) setRefusedAtCheckout(null);
        if (keepError.current) keepError.current = false;
        else setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        keepError.current = false;
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
  }, [status, addressId, count, needsAddress, orderMethod, tCheckout, quoteNonce]);

  /**
   * The cash-for-delivery offer, from a quote for the method on screen. Priced
   * on the online method, so it is read only while online is picked — a quote
   * still in flight for COD must not offer it.
   */
  const cashOffer =
    !isCod && quote?.paymentMethod === "online" && quote.deliveryFeeCash?.available
      ? quote.deliveryFeeCash
      : null;
  /** What is actually being asked for: the choice, while it is still on offer. */
  const payDeliveryInCash = cashToRider && cashOffer !== null;

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
    if (!option) return;
    if (payPart && partAmount === null) return;
    const charge = chargeRequest(option, phone);
    setError(null);
    setRegionFix(null);
    setPlacing(true);

    // Is the chosen provider still offered? Asked here, before any order
    // exists, because this is the last moment the refusal can leave the form
    // intact. A failed read is not a "no" — the charge's own refusal still
    // guards the other side.
    if (charge) {
      const fresh = await getPaymentOptions().catch(() => null);
      if (fresh && !fresh.some((entry) => entry.provider === charge.provider)) {
        online.applyOffered(fresh.map((entry) => entry.provider));
        setError(fresh.length === 0 ? tProvider("onlineUnavailable") : tProvider("providerSwitchedOff"));
        setPlacing(false);
        return;
      }
    }

    /** Set once the orders exist: from then on a failure has an order to point at. */
    let placedGroup: string | null = null;

    try {
      const result = await checkout({
        paymentMethod: orderMethod,
        ...(needsAddress && addressId ? { deliveryAddressId: addressId } : {}),
        ...(payDeliveryInCash ? { deliveryFeePayment: "cash_to_rider" as const } : {}),
        ...(payPart ? { partialPayment: true } : {}),
      });

      // The cart is cleared server-side on success; drop the local mirror so the
      // header badge does not keep showing a basket that no longer exists.
      placedGroup = result.cartId;
      await clear().catch(() => undefined);

      if (isCod || !charge) {
        router.push(`/shop/checkout/success?group=${encodeURIComponent(result.cartId)}&cod=1`);
        return;
      }

      const payment = await initiatePayment({
        cartId: result.cartId,
        ...charge,
        ...(payPart && partAmount !== null ? { amount: partAmount } : {}),
      });

      // The one moment this id is knowable — nothing on the order side ever
      // returns it. The order screen's "Check payment" reads it back to force a
      // gateway re-check; see `payment-attempts`.
      await rememberPaymentAttempt(result.cartId, payment.transactionId);

      const params = new URLSearchParams({
        group: result.cartId,
        transaction: payment.transactionId,
      });
      // The delivery fee is still to hand over in cash; the success screen
      // says so, and the order carries the amount and the delivery code.
      if (payDeliveryInCash) params.set("rider", "1");
      // And so is the rest of a partial order.
      if (payPart) params.set("partial", "1");
      // The answer decides the next screen — never which company carries the
      // money. A card goes to the hosted page that confirms it; a code step or
      // a page to open is shown by the success screen, which also polls.
      const step = nextPaymentStep(payment.instructions);
      if (!isSettledFailure(payment.status) && step.kind === "card") {
        router.push(await cardPagePath(payment.transactionId));
        return;
      }
      if (step.kind === "otp") params.set("otp", "1");
      if (step.kind === "redirect") params.set("redirect", step.url);
      if (payment.instructions?.ussdCode) params.set("ussd", payment.instructions.ussdCode);
      // What the charge actually told us to tell the shopper. It varies per
      // network and per aggregator — a push to the handset often answers with
      // NO ussd — so discarding it for our own fixed sentence would guess at a
      // step that varies.
      if (payment.instructions?.message) params.set("note", payment.instructions.message);
      rememberHandsetStep(
        payment.transactionId,
        handsetStepOf(payment.instructions, payment.provider ?? charge.provider),
      );
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
      // The orders exist and only the charge failed. The cart is already gone,
      // so there is no form to go back to: say why on the success screen's
      // failed view, whose button opens the order — payable there, with a
      // fresh `/options`. (Staying here fell through to the empty-cart
      // redirect and dropped the shopper on /shop/cart with nothing said.)
      if (placedGroup) {
        if (payPart && isAlreadyPaid(err)) {
          router.push(`/shop/checkout/success?${new URLSearchParams({ group: placedGroup, paid: "1", partial: "1" })}`);
          return;
        }
        const params = new URLSearchParams({ group: placedGroup, failed: "1" });
        if (payDeliveryInCash) params.set("rider", "1");
        if (payPart) params.set("partial", "1");
        // A refused amount is our rule, not something the provider said.
        const amountProblem = payPart ? refusedAmount(err) : null;
        if (amountProblem) params.set("ours", "1");
        params.set("reason", amountProblem ?? refusal(err) ?? translateError(tErrors, err, tCheckout("GENERIC")));
        router.push(`/shop/checkout/success?${params}`);
        return;
      }
      setPlacing(false);
      // Checkout is atomic, so nothing was created — but the cart may have
      // changed server-side, so re-read it rather than leaving a stale view.
      void refresh();
      // Refused as a partial order: nothing was created and the row goes, so it is
      // said as that, even where the code is one of cash on delivery's.
      const partRefusal = payPart ? partialRefusalFromError(err) : null;
      if (partRefusal) setPartRefused(partRefusal);
      setError(
        partRefusal
          ? tCheckout("PARTIAL_PAYMENT_NOT_AVAILABLE")
          : checkoutError(tCheckout, tErrors, err, tMinimum, lines)
      );
      // A carrying company stopped taking the fee in cash since the quote (or
      // the basket changed). Nothing was created: fall back to paying delivery
      // with the order, and re-quote so the screen shows what is on offer now.
      const feeCashGone = err instanceof ApiError && err.code === "DELIVERY_FEE_CASH_NOT_AVAILABLE";
      if (feeCashGone) setCashToRider(false);
      // Refused as cash on delivery — the account, a shop or a delivery company
      // changed since the quote. Nothing was created and a retry cannot pass:
      // the row goes, the form falls back to the online ones, the basket stays.
      const codRefusal = codRefusalFromError(err);
      if (codRefusal) setRefusedAtCheckout(codRefusal);
      if (feeCashGone || codRefusal || partRefusal) {
        keepError.current = true;
        setQuoteNonce((n) => n + 1);
      }
      // The backend names the saved address it checked — the chosen one, or the
      // default it fell back to — so `addressId` is the selection only as a guard.
      const region = regionInvalidDetails(err);
      const culprit = region?.addressId ?? addressId;
      if (region && culprit) setRegionFix({ details: region, addressId: culprit });
    }
  }, [
    online,
    tProvider,
    refusal,
    isCod,
    orderMethod,
    payPart,
    partAmount,
    refusedAmount,
    payDeliveryInCash,
    needsAddress,
    addressId,
    lines,
    tMinimum,
    clear,
    option,
    phone,
    router,
    refresh,
    tCheckout,
    tErrors,
  ]);

  /**
   * Save the picked region on the refused saved address, then place the order
   * again. A saved address with no `geo` is never region-checked, so `geo` is
   * there in practice; without it the only way out is the addresses page.
   */
  const fixRegionAndRetry = async (regionKey: string) => {
    if (!regionFix) return;
    const target = addresses.find((a) => a._id === regionFix.addressId);
    if (!target?.geo) {
      router.push("/shop/account/addresses");
      return;
    }
    setFixingRegion(true);
    try {
      const profile = await updateAddress(target._id, { geo: withRegion(target.geo, regionKey) });
      // Shown as returned — the server writes the canonical name ("Centre").
      setAddresses(profile.savedAddresses ?? []);
      setRegionFix(null);
      setFixingRegion(false);
      await placeOrder();
    } catch (err: unknown) {
      setFixingRegion(false);
      setError(translateError(tErrors, err, tCheckout("GENERIC")));
      const region = regionInvalidDetails(err);
      if (region) setRegionFix({ details: region, addressId: target._id });
    }
  };

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
    (status === "authenticated" && (loadingProfile || (!payForm.ready && !online.failed)))
  ) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6">
        <h1 className="sr-only">{tKey("shop.nav.titles.checkout")}</h1>
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
  // A partial order is priced as cash on delivery, and the offer carries that price.
  const total = (payPart && partOffer ? partOffer.total : quote?.total) ?? lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  /**
   * Without a quote a physical cart's delivery is unknown, so the local sum is
   * only a total BEFORE delivery — labelled as one, and kept off the pay button,
   * which must name the figure that will actually be charged.
   */
  const totalKnown = quote !== null || isDigital;
  /** What the pay button charges now: the items only when the fee goes to the rider. */
  const dueNow =
    payPart && partOffer
      ? (partAmount ?? partOffer.maximumAmount)
      : payDeliveryInCash && cashOffer
        ? cashOffer.amountDueOnline
        : total;
  const phoneOk = option !== null && paymentReady(option, phone);
  const addressOk = !needsAddress || Boolean(addressId);
  // Only a quote for the method on screen counts: a switch to COD re-quotes,
  // and until it answers the online verdict must not unblock the button.
  const shortOfMinimum =
    quote !== null &&
    quote.paymentMethod === orderMethod &&
    quote.meetsDeliveryMinimum === false;
  // The amount can be charged, and the delivery lines above it are priced as what is being placed.
  const partOk = !payPart || (partAmount !== null && quote?.paymentMethod === "cash_on_delivery");
  // `totalKnown` joins the gate since delivery can cost something: an order is
  // never placed against a total the screen did not show.
  // Asked before the order exists: a charge refused after it leaves an order
  // this route could never take payment for.
  const outsideLimits = totalKnown && amountOutsideLimits(dueNow, currency, option?.limits);
  const canPay = phoneOk && addressOk && totalKnown && !shortOfMinimum && partOk && !outsideLimits && !placing;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      {/* Title and back arrow are both the header bar's now. It steps through
          real history first, so a digital buy-now — which never passed through
          the cart page — still returns to the product it came from rather than
          to a screen the shopper has not seen. */}
      <h1 className="sr-only">{tKey("shop.nav.titles.checkout")}</h1>

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

      {regionFix && (
        <RegionPicker
          details={regionFix.details}
          confirmLabel={t("regionFixCta")}
          busy={fixingRegion || placing}
          onConfirm={(key) => void fixRegionAndRetry(key)}
        >
          <button
            type="button"
            onClick={() => router.push("/shop/account/addresses")}
            style={{
              border: "none",
              background: "none",
              color: "var(--brand-hover)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            {t("manageAddresses")}
          </button>
        </RegionPicker>
      )}

      {/* Address */}
      {needsAddress && (
        <>
          <p className="ds-overline" style={{ marginBottom: 8 }}>
            {t("deliveryAddress")}
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
                {t("noAddress")}
              </p>
              <Button variant="secondary" onClick={() => router.push("/shop/account/addresses")}>
                {t("addAddress")}
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {addresses.map((address) => (
                <button
                  key={address._id}
                  onClick={() => {
                    setAddressId(address._id);
                    // A refusal as a partial order was about the previous drop-off too.
                    setPartRefused(null);
                    // The region refusal was about the previous choice.
                    if (regionFix && regionFix.addressId !== address._id) setRegionFix(null);
                  }}
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
                      {address.label ?? t("addressFallback")}
                      {address.is_default && (
                        <span style={{ marginLeft: 6 }}>
                          <Badge tone="neutral" size="sm">
                            {t("defaultAddress")}
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
                {t("manageAddresses")}
              </button>
            </div>
          )}
        </>
      )}

      {/* Payment */}
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("paymentMethod")}
      </p>
      {online.failed ? (
        <OptionsLoadFailed onRetry={online.reload} />
      ) : (
        onlineUnavailable && <OnlinePaymentUnavailable withCod={codOffered} />
      )}
      {!isDigital && codRefused && <CodUnavailableNotice refused={codRefused} lines={lines} />}
      {option && payOptions && payOptions.length > 0 && (
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
      )}

      {outsideLimits && option?.limits && (
        <PaymentLimitNote limits={option.limits} style={{ margin: "0 0 20px" }} />
      )}

      {option?.provider === "CARD" && (
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 20, lineHeight: 1.5 }}>
          {t("cardNote")}
        </p>
      )}

      {isCod && (
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 20, lineHeight: 1.5 }}>
          {t("codNote")}
        </p>
      )}

      {partGone && <PartialPaymentNotice reason={partGone} />}

      {/* Part online now, the rest in cash at the door — offered only while the
          quote says every shop accepts it, and on an online row, because a provider
          takes the part paid now. Choosing it rules out cash for the delivery fee. */}
      {partOffer && option && !isCod && (
        <div
          style={{
            padding: 13,
            marginBottom: 20,
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: payPart ? "1.5px solid var(--brand)" : "1.5px solid var(--border)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 11,
              cursor: placing ? "default" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={payPart}
              disabled={placing}
              onChange={(e) => {
                setPartChosen(e.target.checked);
                if (e.target.checked) setCashToRider(false);
              }}
              style={{ marginTop: 3, accentColor: "var(--brand)", width: 16, height: 16, flexShrink: 0 }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>
                {tPartial("optionTitle")}
              </span>
              <span className="muted" style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, marginTop: 2 }}>
                {tPartial("optionBody", {
                  min: formatMoney(partOffer.minimumAmount, currency),
                  max: formatMoney(partOffer.maximumAmount, currency),
                })}
              </span>
            </span>
          </label>
          {payPart && (
            <div style={{ marginTop: 12 }}>
              <PartialAmountField
                limits={partOffer}
                value={partInput ?? String(partOffer.maximumAmount)}
                onChange={setPartInput}
                currency={currency}
                disabled={placing}
              />
            </div>
          )}
        </div>
      )}

      {/* Items online now, the delivery fee in cash to the rider — offered only
          while the quote says every carrying company accepts it. */}
      {cashOffer && (
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 11,
            padding: 13,
            marginBottom: 20,
            borderRadius: "var(--radius-md)",
            cursor: placing ? "default" : "pointer",
            background: "var(--surface)",
            border: payDeliveryInCash ? "1.5px solid var(--brand)" : "1.5px solid var(--border)",
          }}
        >
          <input
            type="checkbox"
            checked={payDeliveryInCash}
            disabled={placing}
            onChange={(e) => setCashToRider(e.target.checked)}
            style={{ marginTop: 3, accentColor: "var(--brand)", width: 16, height: 16, flexShrink: 0 }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>
              {tDelivery("cashToRider")}
            </span>
            <span className="muted" style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, marginTop: 2 }}>
              {tDelivery("cashToRiderBody", {
                online: formatMoney(cashOffer.amountDueOnline, currency),
                cash: formatMoney(cashOffer.amountDueToRider, currency),
              })}
            </span>
          </span>
        </label>
      )}

      {/* Summary */}
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("orderSummary")}
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
              {t("lineQty", { qty: line.qty, title: line.title })}
              {line.storeName && (
                <span className="muted">{t("lineStore", { store: line.storeName })}</span>
              )}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {formatMoney(line.price * line.qty, line.currency)}
            </span>
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 8, paddingTop: 8 }}>
          <SummaryRow label={t("subtotal")} value={formatMoney(quote?.subtotal ?? total, currency)} />
          {/* One line per shop, already inside the quote's `total`. */}
          {!isDigital &&
            (quote ? (
              <DeliveryQuoteLines quote={quote} lines={lines} compact />
            ) : (
              <SummaryRow
                label={t("delivery")}
                value={<span className="muted">{tDelivery("calculating")}</span>}
              />
            ))}
          <SummaryRow
            label={totalKnown ? t("total") : tDelivery("totalBeforeDelivery")}
            value={formatMoney(total, currency)}
            strong
          />
          {payDeliveryInCash && cashOffer && (
            <>
              <SummaryRow label={tDelivery("payNow")} value={formatMoney(cashOffer.amountDueOnline, currency)} />
              <SummaryRow label={tDelivery("cashForRider")} value={formatMoney(cashOffer.amountDueToRider, currency)} />
            </>
          )}
          {payPart && partAmount !== null && (
            <>
              <SummaryRow label={tDelivery("payNow")} value={formatMoney(partAmount, currency)} />
              <SummaryRow label={tPartial("cashAtDelivery")} value={formatMoney(total - partAmount, currency)} />
            </>
          )}
        </div>
      </div>

      {quote && quote.perVendor.length > 1 && (
        <div style={{ display: "flex", gap: 7, marginTop: 8, marginBottom: 20 }}>
          <Icon name="shield-check" size={16} style={{ color: "var(--brand)", marginTop: 1 }} />
          <span className="muted" style={{ fontSize: 12.5 }}>
            {t("multiVendorNote", { n: quote.perVendor.length })}
          </span>
        </div>
      )}

      {shortOfMinimum && <DeliveryMinimumNotice quote={quote} lines={lines} />}

      <div
        style={{ flexDirection: "column", alignItems: "stretch", gap: 8, position: "sticky", bottom: 0 }}
        className="stickybar rounded-t-2xl"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
              {payDeliveryInCash || payPart ? tDelivery("payNow") : totalKnown ? t("total") : tDelivery("totalBeforeDelivery")}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {formatMoney(dueNow, currency)}
            </div>
          </div>
          {option && (
          <Button
            size="lg"
            elevated
            leadingIcon={isCod ? "banknote" : "lock"}
            disabled={!canPay}
            title={
              !addressOk
                ? t("chooseAddress")
                : !phoneOk
                  ? t("enterValidNumber")
                  : shortOfMinimum
                    ? tMinimum("buttonHint")
                    : payPart && partOffer && partAmount === null
                      ? tPartial("amountHint", {
                          min: formatMoney(partOffer.minimumAmount, currency),
                          max: formatMoney(partOffer.maximumAmount, currency),
                        })
                    : !totalKnown
                      ? tDelivery("calculating")
                      : undefined
            }
            onClick={() => void placeOrder()}
          >
            {placing
              ? t("placing")
              : isCod || !totalKnown
                ? t("placeOrder")
                : t("payAmount", { amount: formatMoney(dueNow, currency) })}
          </Button>
          )}
        </div>
        {/* Under the pay button, as the order is what the Terms bind. */}
        <LegalAgreement kind="checkout" />
        {/* And what the order comes with: the time to report a problem. A cart
            holds goods and downloads — a service is booked and paid elsewhere. */}
        <ProtectionLine className="mt-1.5 text-center text-xs leading-relaxed text-[var(--text-muted)]" />
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
function addressProblem(tCheckout: Translator, error: ApiError): string {
  const reason = (error.details as { reason?: string } | undefined)?.reason;
  return reason === "selected_address_not_geocoded"
    ? tCheckout("ADDRESS_NOT_GEOCODED")
    : tCheckout("ORDER_DELIVERY_ADDRESS_REQUIRED");
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
function checkoutError(
  tCheckout: Translator,
  tErrors: Translator,
  error: unknown,
  tMinimum: Translator,
  lines: CartLine[]
): string {
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

  if (error.code === "ORDER_BELOW_DELIVERY_MINIMUM") {
    return deliveryMinimumProblem(tCheckout, tMinimum, error, lines);
  }

  // The shop has switched cash on delivery off, so retrying COD will never pass.
  // Naming the shop is what lets the shopper keep COD for everyone else's items.
  if (error.code === "COD_VENDOR_NOT_ACCEPTED") {
    const vendorId = (error.details as { vendorId?: string } | undefined)?.vendorId;
    const from = vendorId ? fromShop(tMinimum, vendorId, lines) : tMinimum("fromThisSeller");
    return tCheckout("COD_VENDOR_NOT_ACCEPTED", { from });
  }

  const scoped = lookupMessage(tCheckout, error.code);
  if (scoped) return scoped;

  return translateError(tErrors, error, tCheckout("GENERIC"));
}

/**
 * Checkout refused one shop's items as too small to carry their delivery.
 *
 * `details` is the first failing unit. It names the shop by `vendorId`, so the
 * sentence can say WHICH shop to add to — items from another shop become a
 * separate order and do not help. `minimumSubtotal: null` means no basket size
 * passes; for cash on delivery that is "pay online", not "add more".
 */
function deliveryMinimumProblem(
  tCheckout: Translator,
  tMinimum: Translator,
  error: ApiError,
  lines: CartLine[]
): string {
  const details = error.details as Partial<DeliveryMinimumErrorDetails> | undefined;
  const from = details?.vendorId ? fromShop(tMinimum, details.vendorId, lines) : tMinimum("fromThisSeller");

  if (details?.minimumSubtotal === null) {
    return details.scope === "shipment"
      ? tCheckout("ORDER_BELOW_DELIVERY_MINIMUM_COD_UNREACHABLE", { from })
      : tCheckout("ORDER_BELOW_DELIVERY_MINIMUM_UNREACHABLE", { from });
  }
  if (typeof details?.shortfall === "number" && details.shortfall > 0) {
    return tCheckout("ORDER_BELOW_DELIVERY_MINIMUM", {
      from,
      amount: formatMoney(details.shortfall, details.currency ?? "XAF"),
    });
  }
  return tCheckout("ORDER_BELOW_DELIVERY_MINIMUM_UNKNOWN", { from });
}
