"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Icon } from "@/components/shop/ds";
import { useShopPageTitle } from "@/components/shop/ShopChrome";
import { verifyPayment } from "@/lib/shop/payments.api";
import { orderGroupPath } from "@/lib/shop/shop.routes";
import { useAppResume } from "@/lib/native/useAppResume";
import { enablePush } from "@/lib/native/push";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * The end of checkout.
 *
 * ── Why this verifies rather than congratulates ──────────────────────────────
 *
 * Mobile money is asynchronous: `POST /payments/initiate` returns once the
 * prompt has been *sent*, not once the money has moved. A screen that says
 * "Payment received" at that moment is guessing, and it guesses wrong every time
 * a shopper declines the prompt or lets it time out. So this polls
 * `POST /payments/verify` — idempotent, safe to call repeatedly — and reports
 * what the transaction actually says.
 *
 * The orders exist either way. `checkout` created them before any payment call,
 * in `AWAITING_PAYMENT`, so a failed payment leaves a real order the shopper can
 * pay for from their order history rather than a basket that vanished.
 *
 * COD skips all of this — there is no transaction, and the order is already
 * fulfillable.
 */

/** Long enough for a shopper to find their handset and approve, then stop. */
const POLL_INTERVAL_MS = 4000;
const POLL_ATTEMPTS = 15;

type Phase = "pending" | "paid" | "failed" | "cod";

export default function SuccessPage() {
  const router = useRouter();
  const [group, setGroup] = useState<string | null>(null);
  const [ussd, setUssd] = useState<string | null>(null);
  /** The gateway's own instruction, carried from `initiate`. */
  const [note, setNote] = useState<string | null>(null);
  /**
   * Why the gateway refused, in the provider's own words.
   *
   * Separate from `note` because the two never arrive together: a refusal is a
   * `200` carrying `status: "FAILED"` and its reason in the top-level
   * `message`, with no `instructions` object at all.
   */
  const [reason, setReason] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("pending");
  /** Bumped when the app returns to the foreground, to restart the poll. */
  const [resumeNonce, setResumeNonce] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cartId = params.get("group");
    const transactionId = params.get("transaction");

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroup(cartId);
    setUssd(params.get("ussd"));
    setNote(params.get("note"));
    setReason(params.get("reason"));

    if (params.get("cod") === "1") {
      setPhase("cod");
      return;
    }
    // The gateway already refused, on the `initiate` response itself. Polling
    // `verify` fifteen times would reach the same answer a minute later while
    // showing "Waiting for your payment" — which is not what happened.
    if (params.get("failed") === "1") {
      setPhase("failed");
      return;
    }
    if (!transactionId) return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const result = await verifyPayment(transactionId);
        if (cancelled) return;

        if (result.status === "SUCCEEDED") {
          setPhase("paid");
          return;
        }
        if (result.status === "FAILED" || result.status === "CANCELLED") {
          setPhase("failed");
          return;
        }
      } catch {
        // A verify that errors is not a failed payment — the transaction may
        // still settle. Keep polling until the attempts run out, then leave the
        // shopper on "pending", which is the honest state.
      }

      if (attempts < POLL_ATTEMPTS) setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [resumeNonce]);

  /**
   * Poll again when the app comes back to the foreground.
   *
   * The window above is one minute — fifteen attempts, four seconds apart — and
   * on a phone the shopper spends most of it in their dialer approving the
   * mobile-money prompt, where a backgrounded WebView's timers are throttled and
   * then stopped. Without this they return to a screen that gave up on a payment
   * that succeeded while they were away.
   *
   * Only from `pending`: a resume must not restart polling on a transaction that
   * already settled, and cash on delivery never had one.
   */
  useAppResume(() => {
    if (phase === "pending") setResumeNonce((n) => n + 1);
  });

  /**
   * Ask for push permission HERE, and nowhere else in the app.
   *
   * This is the one moment the request can be honest: the shopper has just
   * placed an order, so "we'll tell you when it ships" is a thing they want
   * rather than a thing we want. Asked at launch it is a system dialog in front
   * of a stranger — and on Android 13+ the OS shows it exactly once, so a
   * reflexive "no" at launch is a permanent one.
   *
   * Fires on `cod` as well as `paid`: a cash-on-delivery order is an order,
   * and it is the one most likely to want a delivery notification. Never on
   * `pending` or `failed` — there may yet be no order to follow.
   *
   * Safe to reach on a second order: `enablePush` checks the permission before
   * requesting, so an earlier grant re-registers the token (which is how a
   * rotated one is picked up) and an earlier denial does nothing at all.
   */
  useEffect(() => {
    if (!IS_NATIVE_BUILD) return;
    if (phase !== "paid" && phase !== "cod") return;

    void enablePush();
  }, [phase]);

  const view = VIEWS[phase];

  // A payment that failed is not an "order confirmed", which is what the route
  // alone would put in the header bar. The body headline is the honest one.
  useShopPageTitle(view.title);

  return (
    <div className="mx-auto flex max-w-[520px] flex-col items-center px-4 py-16 text-center sm:px-6">
      <div
        className="fadein"
        style={{
          width: 92,
          height: 92,
          borderRadius: "50%",
          background: `var(--${view.tone}-bg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <Icon name={view.icon} size={44} style={{ color: `var(--${view.tone})` }} />
      </div>

      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        {view.title}
      </h1>
      <p className="muted" style={{ maxWidth: 380, lineHeight: 1.55, margin: 0 }}>
        {view.body}
      </p>

      {/* What the gateway said to do, which is not always the same thing.
          NotchPay answers a `cm.mtn` charge with `action: "confirm"` and NO
          ussd — the operator pushes the prompt to the handset and there is
          nothing to dial — so a screen hard-coded to "dial this code" would be
          wrong for the commonest case. The code, when there is one, still gets
          the prominent treatment; the written instruction is the fallback. */}
      {/* What the gateway said when it said no. A shopper who is told "your
          balance is insufficient" knows what to do next; one told only that
          something went wrong retries the identical failure. */}
      {phase === "failed" && reason && (
        <div
          style={{
            width: "100%",
            maxWidth: 360,
            marginTop: 18,
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
            borderRadius: "var(--radius-md)",
            padding: "13px 15px",
            textAlign: "left",
          }}
        >
          <p className="ds-overline" style={{ marginBottom: 6 }}>
            What your provider said
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
            {reason}
          </p>
        </div>
      )}

      {phase === "pending" && (ussd || note) && (
        <div
          style={{
            width: "100%",
            maxWidth: 360,
            marginTop: 18,
            border: "1px solid var(--brand)",
            background: "var(--brand-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "13px 15px",
          }}
        >
          <p className="ds-overline" style={{ marginBottom: 6 }}>
            {ussd ? "Dial to approve" : "What to do now"}
          </p>
          {ussd ? (
            <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.02em", margin: 0 }}>
              {ussd}
            </p>
          ) : (
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                fontWeight: 600,
                color: "var(--text-strong)",
                margin: 0,
              }}
            >
              {note}
            </p>
          )}
        </div>
      )}

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          marginTop: 20,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "13px 15px",
          textAlign: "left",
          display: "flex",
          gap: 10,
        }}
      >
        <Icon name="info" size={17} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
          {phase === "cod" ? (
            <>
              Your delivery code is on your order. Give it to the courier{" "}
              <strong>only once you have your parcel</strong> — it is what records your payment.
            </>
          ) : (
            <>
              Your orders are under <strong>My orders</strong>, with their delivery progress and
              tracking.
            </>
          )}
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          marginTop: 22,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Button
          block
          size="lg"
          leadingIcon="receipt-text"
          onClick={() => router.push(group ? orderGroupPath(group) : "/shop/account/orders")}
        >
          {phase === "failed" ? "Pay for this order" : "View my order"}
        </Button>
        <Button block variant="ghost" onClick={() => router.push("/shop")}>
          Continue shopping
        </Button>
      </div>
    </div>
  );
}

const VIEWS: Record<Phase, { icon: string; tone: string; title: string; body: string }> = {
  pending: {
    icon: "hourglass",
    tone: "warning",
    title: "Waiting for your payment",
    body: "Approve the prompt on your phone. Your order is placed and held — this page updates by itself once the payment clears.",
  },
  paid: {
    icon: "check",
    tone: "success",
    title: "Payment received",
    body: "Your order is confirmed and the seller has been notified. You can follow its delivery from your orders.",
  },
  failed: {
    icon: "triangle-alert",
    tone: "danger",
    title: "Payment did not go through",
    body: "Your order is still there, unpaid — nothing was lost. Open it from your orders to try paying again.",
  },
  cod: {
    icon: "banknote",
    tone: "success",
    title: "Order placed",
    body: "You pay the courier on delivery. The seller has been notified and will start preparing your parcel.",
  },
};
