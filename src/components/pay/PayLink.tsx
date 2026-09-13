"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button, Icon, Skeleton, type IconName } from "@/components/shop/ds";
import { ApiError } from "@/lib/auth/auth.types";
import { formatMoney } from "@/lib/shop/format";
import {
  getPayLinkSession,
  isPayLinkToken,
  type PayLinkPaidFor,
  type PayLinkSession,
} from "@/lib/shop/pay-link.api";
import { verifyPayment } from "@/lib/shop/payments.api";

/**
 * The hosted card page — `/pay/:token`.
 *
 * ── It must work with NO session, and that is the whole feature ──────────────
 *
 * A mother places an order; her son gets the link in a chat and pays. He has no
 * account and never will. Every other owner-scoped screen in this app lives
 * under `/shop/account`, which the middleware gates on a session — build this
 * one there and you lock out the only person it is for. So it sits at the top
 * level, beside `(auth)` and `(marketing)`, and reads through
 * `GET /api/payments/session/:token`, which is unauthenticated by design.
 *
 * ── The three behaviours the backend asks this page to honour ────────────────
 *
 * 1. **The token is opaque and expiring**, deliberately not the transaction id —
 *    an unauthenticated read keyed on ids is a record any caller can walk by
 *    incrementing. Nothing in this flow builds a URL out of an id.
 * 2. **A settled payment answers `settled`, not `expired`.** Render "this is
 *    already paid" and nothing else. Showing an expiry to somebody who paid an
 *    hour ago invites a second payment, which is the one thing a payment page
 *    must never invite. The server checks status before expiry for exactly this
 *    reason; the page must not undo it by re-deriving the state from
 *    `expiresAt`.
 * 3. **A fresh mint replaces the previous link.** An old link going dead is
 *    correct behaviour, not a bug — it is how "the customer lost the message" is
 *    answered safely. So a 404 says "ask for a new one", never "something went
 *    wrong".
 *
 * ── Why the whole page is one client component ───────────────────────────────
 *
 * Stripe.js only runs in a browser, and it must be fetched from Stripe's own
 * origin — self-hosting it is a violation of their terms and breaks fraud
 * signalling. So there is nothing to render on the server that is worth the
 * round trip, and the route above is a thin `noindex` wrapper.
 */
export function PayLink({ token }: { token: string }) {
  const t = useTranslations("shop.pay.link");
  const tCommon = useTranslations("shop.common");
  const [session, setSession] = useState<PayLinkSession | null>(null);
  const [error, setError] = useState<"not-found" | "failed" | null>(null);

  /*
   * Shape-checked here as well as server-side, and it costs nothing.
   *
   * A chat client that wrapped or truncated the link is the common way one
   * arrives broken, and the backend answers the same 404 for a malformed token
   * as for an unknown one — deliberately, since any difference between them
   * tells a caller whether their guess had the right shape. Nothing is disclosed
   * by failing early, and the reader gets their answer without a round trip.
   *
   * Derived during render rather than pushed into state by the effect below: it
   * is a pure function of the prop, and a state write would be a second render
   * that says what the first already knew.
   */
  const malformed = !isPayLinkToken(token);

  const load = useCallback(() => {
    if (malformed) return;

    getPayLinkSession(token)
      .then((next) => {
        setSession(next);
        setError(null);
      })
      .catch((err: unknown) => {
        /*
         * `PAYMENT_LINK_NOT_FOUND` is the ordinary end of a link's life —
         * replaced by a newer mint, or never real — and it is read by code
         * rather than by status, so that a 404 from somewhere else on the way
         * (a misconfigured API base, a proxy) does not tell a reader to go and
         * ask for a link that is in fact perfectly good. The status is the
         * fallback for a body that arrived without the structured contract.
         *
         * Everything else — including the 503 this route answers during a
         * maintenance window — is this request failing, and gets a retry.
         */
        const missing =
          err instanceof ApiError &&
          (err.code === "PAYMENT_LINK_NOT_FOUND" || err.statusCode === 404);
        setError(missing ? "not-found" : "failed");
      });
  }, [token, malformed]);

  useEffect(load, [load]);

  if (malformed || error === "not-found") {
    return (
      <Outcome icon="link-2-off" title={t("invalidTitle")} tone="neutral">
        {t("invalidBody")}
      </Outcome>
    );
  }

  if (error === "failed") {
    return (
      <Outcome icon="triangle-alert" title={t("failedTitle")} tone="danger">
        <p style={{ margin: "0 0 12px" }}>{t("failedBody")}</p>
        <Button
          leadingIcon="refresh-cw"
          onClick={() => {
            // Back to the skeleton while it retries. An event handler, so this
            // write is not the cascading-render problem the same call would be
            // inside the effect above.
            setError(null);
            load();
          }}
        >
          {tCommon("tryAgain")}
        </Button>
      </Outcome>
    );
  }

  if (!session) return <PayLinkSkeleton />;

  return <PaySession session={session} onReload={load} />;
}

/** The four states a resolved session can be in, and only one of them takes money. */
function PaySession({
  session,
  onReload,
}: {
  session: PayLinkSession;
  onReload: () => void;
}) {
  const t = useTranslations("shop.pay.link");

  if (session.state === "settled") {
    return (
      <Outcome icon="circle-check-big" title={t("settledTitle")} tone="success">
        <Amount session={session} />
        <p style={{ margin: "12px 0 0" }}>{t("settledBody")}</p>
      </Outcome>
    );
  }

  if (session.state === "closed") {
    return (
      <Outcome icon="circle-slash" title={t("closedTitle")} tone="neutral">
        <Amount session={session} />
        <p style={{ margin: "12px 0 0" }}>{t("closedBody")}</p>
      </Outcome>
    );
  }

  if (session.state === "expired") {
    return (
      <Outcome icon="hourglass" title={t("expiredTitle")} tone="neutral">
        <Amount session={session} />
        <p style={{ margin: "12px 0 0" }}>{t("expiredBody")}</p>
      </Outcome>
    );
  }

  return <PayableSession session={session} onReload={onReload} />;
}

/**
 * A payable session: mount Stripe and take the card.
 *
 * ⚠ **`clientSecret` and `publishableKey` travel only while `state` is
 * `payable`** — `payLinkDisclosesSecret` is the single predicate that decides it
 * server-side, and both are `null` in every other state. So this branch is the
 * only place that may assume them, and it still checks: a deployment taking only
 * mobile money legitimately has no Stripe key configured, and the backend also
 * withholds the key when the variable it was given holds a **secret** key by
 * mistake. Both arrive here as `null`, and both mean the same thing to the
 * reader — this page cannot take a card right now.
 */
function PayableSession({
  session,
  onReload,
}: {
  session: PayLinkSession;
  onReload: () => void;
}) {
  const t = useTranslations("shop.pay.link");

  /*
   * The server's key wins.
   *
   * It is read off the same account that minted the client secret, so the two
   * are guaranteed to agree. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the
   * fallback for a build talking to an API that has not been given one — it
   * keeps the page working in development, and a mismatch between the two would
   * surface as Stripe refusing the secret rather than as a silent wrong charge.
   */
  const publishableKey =
    session.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;

  /*
   * `loadStripe` is memoised on the key rather than called at module scope.
   *
   * At module scope it fires on every page of the app that so much as imports
   * this file, and the key is not known until the session resolves anyway. The
   * promise is cached by Stripe internally, so re-renders cost nothing.
   */
  const stripe = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (!session.clientSecret || !stripe) {
    return (
      <Outcome icon="credit-card" title={t("noCardTitle")} tone="neutral">
        <Amount session={session} />
        <p style={{ margin: "12px 0 0" }}>{t("noCardBody")}</p>
      </Outcome>
    );
  }

  return (
    <div>
      <Amount session={session} />
      <Expiry at={session.expiresAt} />

      <Elements
        stripe={stripe}
        options={{
          clientSecret: session.clientSecret,
          appearance: { theme: "flat", variables: { borderRadius: "10px" } },
        }}
      >
        <CardForm session={session} onReload={onReload} />
      </Elements>
    </div>
  );
}

/**
 * The card form itself.
 *
 * ── Confirming, and then asking the API rather than believing the browser ────
 *
 * `confirmPayment` with `redirect: "if_required"` keeps the customer on this
 * page for a card that needs no 3-D Secure step, and hands off to the bank's own
 * page for one that does — `return_url` is where the bank sends them back, and
 * it has to be this same URL so they land on a page that can read the outcome.
 *
 * When it comes back succeeded, this still calls `POST /api/payments/verify`
 * before saying so. Stripe's answer describes the *PaymentIntent*; the platform's
 * order is only settled once this API has seen it, and the webhook that normally
 * does that is asynchronous. Verifying makes the page's "paid" and the seller's
 * "paid" the same event rather than two that usually coincide.
 */
function CardForm({
  session,
  onReload,
}: {
  session: PayLinkSession;
  onReload: () => void;
}) {
  const t = useTranslations("shop.pay.link");
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /** Set on unmount so a resolved promise cannot write into a dead component. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!stripe || !elements) return;

      setBusy(true);
      setMessage(null);

      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });

      if (!alive.current) return;

      if (result.error) {
        /*
         * Stripe's own message, not ours.
         *
         * "Your card was declined" and "your card has insufficient funds" are
         * different instructions to the person holding it, and flattening them
         * into one sentence is how somebody re-enters the same card five times.
         * `card_error` and `validation_error` are the two the SDK documents as
         * safe to show; anything else is an integration fault and gets a generic
         * line rather than an internal string.
         */
        const shown =
          result.error.type === "card_error" || result.error.type === "validation_error"
            ? result.error.message
            : null;
        setMessage(shown ?? t("declined"));
        setBusy(false);
        return;
      }

      /*
       * Stripe says it is done. The platform has not necessarily heard yet.
       *
       * A verify that throws is NOT a failed payment — the transaction may still
       * be settling and the gateway's callback settles it without us — so this
       * reports success either way and lets the reload below correct the page if
       * the server disagrees.
       */
      try {
        await verifyPayment(session.transactionId);
      } catch {
        // Deliberately swallowed; see above.
      }

      if (!alive.current) return;
      setDone(true);
      setBusy(false);
      // Re-read the session so the page settles onto its `settled` state from
      // the server's answer rather than from this component's own optimism.
      onReload();
    },
    [stripe, elements, session.transactionId, onReload, t],
  );

  if (done) {
    return (
      <div
        role="status"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          marginTop: 16,
          border: "1px solid var(--border)",
          background: "var(--surface-sunken)",
          borderRadius: "var(--radius-md)",
          padding: "13px 15px",
        }}
      >
        <Icon
          name="circle-check-big"
          size={18}
          style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }}
        />
        <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
          {t("received")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 16 }}>
      <PaymentElement />

      {message && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            marginTop: 12,
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
            borderRadius: "var(--radius-md)",
            padding: "11px 13px",
          }}
        >
          <Icon
            name="triangle-alert"
            size={16}
            style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }}
          />
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
            {message}
          </p>
        </div>
      )}

      <Button
        type="submit"
        block
        size="lg"
        elevated
        leadingIcon="lock"
        disabled={busy || !stripe || !elements}
        style={{ marginTop: 16 }}
      >
        {busy
          ? t("paying")
          : t("payAmount", {
              amount: chargedLabel(session) ?? formatMoney(session.amount, session.currency),
            })}
      </Button>

      <p className="muted" style={{ fontSize: 11.5, textAlign: "center", marginTop: 10 }}>
        <Icon name="lock" size={11} style={{ verticalAlign: "-1px" }} /> {t("secureNote")}
      </p>
    </form>
  );
}

/**
 * What is being paid, in both currencies when they differ.
 *
 * ⚠ **`amount` and `chargedAmount` are not the same number and both must be
 * shown when they differ.** The catalogue is priced in XAF while the Stripe
 * account settles in USD, so the figure the Payment Element renders is
 * `chargedAmount` — showing only the catalogue price contradicts the card
 * statement, and showing only the charge contradicts the order. The backend
 * sends both for exactly this reason.
 */
function Amount({ session }: { session: PayLinkSession }) {
  const t = useTranslations("shop.pay.link");
  const charged = chargedLabel(session);

  return (
    <div style={{ textAlign: "center" }}>
      <p className="ds-overline" style={{ marginBottom: 6 }}>
        {t("amountDue")}
      </p>
      <div style={{ fontSize: 30, fontWeight: 800, color: "var(--text-strong)", lineHeight: 1.1 }}>
        {formatMoney(session.amount, session.currency)}
      </div>
      {charged && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
          {t("cardCharged", { amount: charged })}
        </p>
      )}
      {session.paidFor && <PaidFor paidFor={session.paidFor} />}
    </div>
  );
}

/**
 * What the money is for, composed here from the server's facts.
 *
 * ── Why the page writes the sentence ────────────────────────────────────────
 *
 * The storefront asked for a rendered `description` and was declined, for a
 * reason specific to this screen: the holder of a pay link has no account and no
 * `preferred_language`, so a sentence composed server-side would arrive in
 * English on a page otherwise translated into five languages. The locale is in
 * the URL this page was opened with. Facts from the server, sentence from here.
 *
 * Three shapes, and the differences are all contractual:
 *
 *  - **A booking** carries no seller and no item count — `sellers` is `[]` on
 *    purpose, because a service provider's name is frequently the sensitive fact
 *    itself. It gets its reference and nothing more.
 *  - **A multi-vendor basket** is one payment settling several orders, so it
 *    reads as "order X and N others" rather than listing them — which is why the
 *    server sends `reference` plus `orderCount` and not an array.
 *  - **`reference` can be `null`** on a row predating the field, so every line
 *    here has to hold up without it.
 */
function PaidFor({ paidFor }: { paidFor: PayLinkPaidFor }) {
  const t = useTranslations("shop.pay.link");
  const { kind, reference, orderCount, itemCount, sellers } = paidFor;

  const n = typeof itemCount === "number" && itemCount > 0 ? itemCount : null;
  /* Seller names are vendor-written data — joined, never translated. */
  const from = sellers.length > 0 ? sellers.join(", ") : null;

  /*
   * "3 items from Boutique Ndogbong", or whichever half survives — composed by
   * ICU rather than by concatenation, because the two halves do not join in the
   * same order in every language.
   */
  const what =
    n !== null && from
      ? t("itemsFrom", { n, sellers: from })
      : n !== null
        ? t("items", { n })
        : (from ?? (kind === "booking" ? t("booking") : t("order")));

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 13.5, color: "var(--text-body)", margin: 0 }}>{what}</p>
      {reference && (
        <p
          className="muted"
          style={{ fontSize: 12, marginTop: 3, fontVariantNumeric: "tabular-nums" }}
        >
          {orderCount > 1
            ? t("referenceAndOthers", { reference, n: orderCount - 1 })
            : reference}
        </p>
      )}
    </div>
  );
}

/**
 * The charge, when it is genuinely a different figure.
 *
 * Returns null when the presentment currency matches the catalogue's — printing
 * "your card will be charged 12 000 FCFA" under "12 000 FCFA" is noise, and the
 * pair only carries information when they disagree. Stripe lower-cases its
 * currency codes (`"usd"`), so the comparison is case-insensitive; a
 * case-sensitive one would print the line for every payment.
 *
 * ⚠ **Not `formatMoney`.** That formatter rounds to whole units, which is right
 * for a catalogue priced in XAF — a currency with no minor unit — and wrong for
 * the card charge, which the backend sends in major units with its decimals
 * intact (`fromMinorUnit`, so `1234` cents arrives as `12.34`). Rounding it
 * would print a figure that does not match the customer's statement, on the one
 * line whose entire job is to match it.
 */
function chargedLabel(session: PayLinkSession): string | null {
  const { chargedAmount: amount, chargedCurrency: currency } = session;
  if (amount == null || !currency) return null;
  if (currency.toUpperCase() === session.currency.toUpperCase()) return null;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    // An unknown or malformed code makes `Intl` throw rather than degrade. The
    // number still has to reach the reader, so it degrades here instead.
    return `${amount} ${currency.toUpperCase()}`;
  }
}

/**
 * When the link lapses — an absolute time, not a countdown.
 *
 * ── Why not "about 20 minutes left" ─────────────────────────────────────────
 *
 * That reading needs the current instant, and reading the clock during render is
 * impure: the same props produce a different number every time React happens to
 * re-render, and on a page that also renders on the server it is a hydration
 * mismatch waiting for the first slow request. A wall-clock time is a fact about
 * the link, derived from the one field the server sent, and it survives the page
 * being left open — which a number frozen at mount does not.
 *
 * A ticking clock would also be pressure applied to somebody entering card
 * details, over a consequence that is mild: the link is replaced, nothing is
 * charged, nothing is lost.
 *
 * ⚠ **This page never re-derives `expired` from this timestamp.** The server
 * checks status before expiry deliberately, so that a payment which succeeded an
 * hour ago reads as *paid* rather than as *lapsed*. Re-deriving the state here
 * from a clock comparison would undo that and invite a second payment.
 */
function Expiry({ at }: { at: string }) {
  const t = useTranslations("shop.pay.link");
  const format = useFormatter();
  const on = new Date(at);
  if (Number.isNaN(on.getTime())) return null;

  return (
    <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 8 }}>
      <Icon name="hourglass" size={12} style={{ verticalAlign: "-1px" }} />{" "}
      {t("worksUntil", {
        time: format.dateTime(on, { hour: "2-digit", minute: "2-digit" }),
      })}
    </p>
  );
}

/** Every terminal answer this page can give, in one frame. */
function Outcome({
  icon,
  title,
  tone,
  children,
}: {
  icon: IconName;
  title: string;
  tone: "success" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const color =
    tone === "success" ? "var(--success)" : tone === "danger" ? "var(--danger)" : "var(--text-muted)";

  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "var(--surface-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Icon name={icon} size={30} style={{ color }} />
      </span>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-strong)", margin: "0 0 8px" }}>
        {title}
      </h2>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--text-body)",
          maxWidth: 380,
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PayLinkSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <Skeleton width={120} height={12} />
      <Skeleton width={180} height={32} />
      <Skeleton width="100%" height={180} />
      <Skeleton width="100%" height={46} />
    </div>
  );
}
