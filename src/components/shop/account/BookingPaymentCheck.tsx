"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Icon, type IconName } from "@/components/shop/ds";
import { PaymentOtpStep, PaymentRedirectPrompt } from "@/components/shop/PaymentSteps";
import { useAppResume } from "@/lib/native/useAppResume";
import { BOOKING_LIST, bookingPath } from "@/lib/shop/shop.routes";
import type { PaymentInstructions } from "@/lib/shop/payments.api";

/** The same window as checkout's success screen: four seconds, one minute. */
const POLL_MS = 4_000;
const POLL_LIMIT = 15;

/**
 * What one check found.
 *
 * `moved` is a payment that settled into something this screen does not
 * describe — refunded, disputed, waiting on a refund — so the booking, which
 * does, is the place to send the customer.
 */
export type PaymentVerdict = "paid" | "failed" | "pending" | "moved";

type Phase = "code" | "checking" | "slow" | "paid" | "failed";

export interface BookingPaymentCheckProps {
  /** A first payment, or the balance of a completed appointment. Decides the copy. */
  kind: "booking" | "balance";
  bookingId: string;
  /** Formatted with `formatMoney` — it carries its own bidi isolation. */
  amount: string;
  /** The service's title, as the vendor wrote it. */
  title: string;
  /** The appointment, already formatted against the app's locale. */
  when?: string | null;
  reference?: string | null;
  /** The number the prompt went to, when this screen started the charge. */
  phone?: string | null;
  ussd?: string | null;
  note?: string | null;
  redirectUrl?: string | null;
  /** A transaction waiting for the SMS code. Polling holds until it is in. */
  otpFor?: string | null;
  /** `paid` and `failed` arrive already settled and never poll. */
  initialPhase?: "checking" | "paid" | "failed";
  /** Why the gateway refused, in the provider's own words. */
  initialReason?: string | null;
  /** One check. Throwing counts as "still pending" — a lost read is not a failed payment. */
  check: () => Promise<PaymentVerdict>;
  /** Back to the payment form for a fresh attempt. */
  onRetry: () => void;
}

/**
 * The wait after a booking payment is started — and its three possible endings.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The booking screens used to wait behind two lines of muted text: no amount, no
 * sign anything was happening, no way to ask again. A minute later they bounced
 * back to the booking without a word. Checkout's success screen had always done
 * this properly, and this is that screen's visual language for a booking.
 *
 * ── Why it asks the gateway, not just the booking ────────────────────────────
 *
 * `GET /api/bookings/:id/payment-status` only reports what the webhook already
 * wrote. The caller's `check` is expected to `POST /api/payments/verify` first —
 * that asks the gateway and settles the booking when the money is there — and
 * only then read the booking, so a missed or late webhook cannot leave the
 * customer watching a payment that cleared.
 *
 * ── Giving up is not an ending ───────────────────────────────────────────────
 *
 * After one minute the screen stops polling and says so — "still checking" — with
 * a button to check again. Mobile money often lands later than that, and saying
 * "failed" about a payment nobody has refused would be wrong.
 */
export function BookingPaymentCheck({
  kind,
  bookingId,
  amount,
  title,
  when,
  reference,
  phone,
  ussd: initialUssd,
  note: initialNote,
  redirectUrl,
  otpFor,
  initialPhase = "checking",
  initialReason = null,
  check,
  onRetry,
}: BookingPaymentCheckProps) {
  const t = useTranslations("shop.bookings.payCheck");
  const router = useRouter();

  const [codeFor, setCodeFor] = useState<string | null>(otpFor ?? null);
  const [phase, setPhase] = useState<Exclude<Phase, "code">>(initialPhase);
  const [reason, setReason] = useState<string | null>(initialReason);
  const [ussd, setUssd] = useState<string | null>(initialUssd ?? null);
  const [note, setNote] = useState<string | null>(initialNote ?? null);
  /** Bumped to start a fresh polling window: "check again", or an app resume. */
  const [round, setRound] = useState(0);

  // The newest `check`, without restarting the poll each time the caller
  // re-renders and hands over a new closure.
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });

  const polling = phase === "checking" && !codeFor;

  useEffect(() => {
    if (!polling) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      attempts += 1;
      let verdict: PaymentVerdict = "pending";
      try {
        verdict = await checkRef.current();
      } catch {
        /* a lost read is not a failed payment */
      }
      if (cancelled) return;

      if (verdict === "moved") {
        router.push(bookingPath(bookingId));
        return;
      }
      if (verdict === "paid" || verdict === "failed") {
        setPhase(verdict);
        return;
      }
      if (attempts >= POLL_LIMIT) {
        setPhase("slow");
        return;
      }
      timer = setTimeout(() => void tick(), POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [polling, round, bookingId, router]);

  const checkAgain = () => {
    setPhase("checking");
    setRound((n) => n + 1);
  };

  // A phone spends this minute in the dialer, where a backgrounded WebView's
  // timers stop. Coming back restarts the window rather than showing a screen
  // that gave up while nobody was looking. See `useAppResume`.
  useAppResume(() => {
    if (!codeFor && (phase === "checking" || phase === "slow")) checkAgain();
  });

  const shown: Phase = codeFor ? "code" : phase;
  const view = VIEWS[shown];
  // The number goes in whole inside a LEFT-TO-RIGHT isolate (LRI…PDI). Not FSI:
  // a phone number has no strong characters, so FSI resolves to the paragraph's
  // direction and an Arabic sentence moves the `+` to the wrong end.
  const isolatedPhone = phone ? `\u2066${phone}\u2069` : null;

  const body =
    shown === "checking"
      ? isolatedPhone
        ? t("checkingBody", { phone: isolatedPhone })
        : t("checkingBodyNoPhone")
      : shown === "paid"
        ? t(kind === "balance" ? "balancePaidBody" : "paidBody")
        : shown === "failed"
          ? t(kind === "balance" ? "balanceFailedBody" : "failedBody")
          : t(view.bodyKey);

  let instruction: ReactNode = null;
  if (shown === "code" && codeFor) {
    instruction = (
      <PaymentOtpStep
        transactionId={codeFor}
        onAuthorized={(instructions: PaymentInstructions | undefined, message?: string) => {
          // The code went through; the shopper now approves on the handset.
          setUssd(instructions?.ussdCode ?? null);
          setNote(instructions?.message ?? message ?? null);
          setCodeFor(null);
        }}
        onRestart={(why) => {
          // Too many wrong codes failed the transaction. Only a new one helps.
          setCodeFor(null);
          setReason(why);
          setPhase("failed");
        }}
      />
    );
  } else if (shown === "checking" && redirectUrl) {
    instruction = <PaymentRedirectPrompt url={redirectUrl} />;
  } else if ((shown === "checking" || shown === "slow") && (ussd || note)) {
    // What the charge said to do. A push to the handset often carries NO ussd,
    // so the written instruction is the fallback, never a made-up "dial this".
    instruction = (
      <div
        style={{
          border: "1px solid var(--brand)",
          background: "var(--brand-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "13px 15px",
          textAlign: "start",
        }}
      >
        <p className="ds-overline" style={{ marginBottom: 6 }}>
          {ussd ? t("dialToApprove") : t("whatToDo")}
        </p>
        {ussd ? (
          <p dir="ltr" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.02em", margin: 0, textAlign: "start" }}>
            {ussd}
          </p>
        ) : (
          <p style={{ fontSize: 13.5, lineHeight: 1.55, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
            {note}
          </p>
        )}
      </div>
    );
  } else if (shown === "failed" && reason) {
    instruction = (
      <div
        style={{
          border: "1px solid var(--danger-border)",
          background: "var(--danger-bg)",
          borderRadius: "var(--radius-md)",
          padding: "13px 15px",
          textAlign: "start",
        }}
      >
        <p className="ds-overline" style={{ marginBottom: 6 }}>
          {t("providerSaid")}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>{reason}</p>
      </div>
    );
  }

  const openBooking = () => router.push(bookingPath(bookingId));

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-10 pt-8 md:px-6 md:pt-12 lg:max-w-[1000px] lg:pt-16">
      <style href="booking-pay-check" precedence="default">
        {CSS}
      </style>

      <div
        className={[
          "flex flex-col gap-5",
          // Tablet: the whole wait sits in one card, so it reads as a screen
          // rather than a few lines lost at the top of a wide page.
          "md:gap-6 md:rounded-[var(--radius-xl)] md:border md:border-[var(--border)] md:bg-[var(--surface)] md:p-8 md:shadow-[var(--shadow-md)]",
          // Desktop: status and actions on the left, what is being paid on the
          // right — the same card, split.
          "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:grid-rows-[auto_auto_auto_1fr] lg:gap-x-12 lg:gap-y-6 lg:p-10",
          "lg:[grid-template-areas:'hero_summary'_'instr_summary'_'actions_summary'_'note_summary']",
        ].join(" ")}
      >
        {/* ── Status ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-start lg:[grid-area:hero]">
          <div
            className="pay-check-badge fadein"
            style={{ background: `var(--${view.tone}-bg)`, color: `var(--${view.tone})` }}
          >
            {shown === "checking" && <span aria-hidden className="pay-check-ring" />}
            <Icon name={view.icon} size={40} />
          </div>

          <div aria-live="polite" aria-atomic="true">
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                margin: "18px 0 8px",
                color: "var(--text-strong)",
              }}
            >
              {t(view.titleKey)}
            </h1>
            <p className="muted" style={{ maxWidth: 420, lineHeight: 1.55, margin: 0, fontSize: 14.5 }}>
              {body}
            </p>
          </div>

          {shown === "checking" && (
            <div className="mt-5 flex w-full max-w-[300px] flex-col items-center gap-2 lg:items-start">
              <div className="pay-check-track" aria-hidden>
                <span className="pay-check-bar" />
              </div>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                {t("checkingLive")}
              </p>
            </div>
          )}
        </div>

        {/* ── What to do on the handset ──────────────────────────────────── */}
        {instruction && <div className="w-full lg:[grid-area:instr]">{instruction}</div>}

        {/* ── Actions ────────────────────────────────────────────────────── */}
        {/* Ahead of the summary, so on a phone the next step is never below
            the fold. Desktop places both by grid area. */}
        <div className="flex w-full flex-col gap-2.5 md:flex-row md:[&>*]:flex-1 lg:[grid-area:actions]">
          {shown === "checking" && (
            <>
              <Button block size="lg" variant="secondary" leadingIcon="refresh-cw" onClick={checkAgain}>
                {t("checkNow")}
              </Button>
              <Button block size="lg" variant="ghost" onClick={openBooking}>
                {t("viewBooking")}
              </Button>
            </>
          )}
          {shown === "code" && (
            <Button block size="lg" variant="ghost" onClick={openBooking}>
              {t("viewBooking")}
            </Button>
          )}
          {shown === "slow" && (
            <>
              <Button block size="lg" elevated leadingIcon="refresh-cw" onClick={checkAgain}>
                {t("checkAgain")}
              </Button>
              <Button block size="lg" variant="secondary" onClick={openBooking}>
                {t("viewBooking")}
              </Button>
            </>
          )}
          {shown === "paid" && (
            <>
              <Button block size="lg" elevated leadingIcon="calendar-check" onClick={openBooking}>
                {t("viewBooking")}
              </Button>
              <Button block size="lg" variant="ghost" onClick={() => router.push(BOOKING_LIST)}>
                {t("allBookings")}
              </Button>
            </>
          )}
          {shown === "failed" && (
            <>
              <Button block size="lg" elevated leadingIcon="refresh-cw" onClick={onRetry}>
                {t("tryAgain")}
              </Button>
              <Button block size="lg" variant="secondary" onClick={openBooking}>
                {t("viewBooking")}
              </Button>
            </>
          )}
        </div>

        {/* ── What is being paid ─────────────────────────────────────────── */}
        <section
          aria-label={t(kind === "balance" ? "balanceFor" : "payingFor")}
          className="w-full lg:self-start lg:[grid-area:summary]"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface-2)",
            padding: "16px 16px 6px",
          }}
        >
          <p className="ds-overline" style={{ marginBottom: 6 }}>
            {t(kind === "balance" ? "balanceFor" : "payingFor")}
          </p>
          <p
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              lineHeight: 1.35,
              color: "var(--text-strong)",
              margin: 0,
              overflowWrap: "anywhere",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </p>
          {when && (
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
              {when}
            </p>
          )}

          <dl style={{ margin: "12px 0 0", borderTop: "1px solid var(--border-subtle)" }}>
            <SummaryRow label={t("amount")}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-strong)" }}>{amount}</span>
            </SummaryRow>
            {phone && (
              <SummaryRow label={t("promptSentTo")}>
                <span dir="ltr">{phone}</span>
              </SummaryRow>
            )}
            {reference && (
              <SummaryRow label={t("reference")}>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{reference}</span>
              </SummaryRow>
            )}
          </dl>
        </section>

        {(shown === "checking" || shown === "slow" || shown === "code") && (
          <div
            className="w-full lg:[grid-area:note]"
            style={{ display: "flex", gap: 10, alignItems: "flex-start", textAlign: "start" }}
          >
            <Icon name="info" size={16} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
              {t(kind === "balance" ? "balanceLeaveNote" : "leaveNote")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        fontSize: 13.5,
      }}
      // A class, not an inline style, so `last:` can drop the final rule.
      className="border-b border-[var(--border-subtle)] last:border-b-0"
    >
      <dt className="muted" style={{ flexShrink: 0 }}>
        {label}
      </dt>
      <dd style={{ margin: 0, textAlign: "end", minWidth: 0, overflowWrap: "anywhere" }}>{children}</dd>
    </div>
  );
}

/**
 * The five faces of the wait. Keys are relative to `shop.bookings.payCheck`;
 * the bodies of `checking`, `paid` and `failed` are chosen in render, because
 * they depend on the phone and on what is being paid.
 */
const VIEWS: Record<Phase, { icon: IconName; tone: string; titleKey: string; bodyKey: string }> = {
  code: { icon: "key-round", tone: "info", titleKey: "codeTitle", bodyKey: "codeBody" },
  checking: { icon: "hourglass", tone: "warning", titleKey: "checkingTitle", bodyKey: "checkingBodyNoPhone" },
  slow: { icon: "clock", tone: "info", titleKey: "slowTitle", bodyKey: "slowBody" },
  paid: { icon: "check", tone: "success", titleKey: "paidTitle", bodyKey: "paidBody" },
  failed: { icon: "triangle-alert", tone: "danger", titleKey: "failedTitle", bodyKey: "failedBody" },
};

/*
 * Two small motions, both off under reduced motion: a ring breathing out of the
 * badge, and an indeterminate bar. Hoisted and de-duplicated by React (`href`
 * + `precedence`), so the shared globals.css stays untouched.
 */
const CSS = `
.pay-check-badge {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pay-check-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid currentColor;
  opacity: 0;
  animation: pay-check-ring 2.2s ease-out infinite;
}
@keyframes pay-check-ring {
  0% { opacity: 0.45; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.55); }
}
.pay-check-track {
  position: relative;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: var(--surface-sunken);
  overflow: hidden;
}
.pay-check-bar {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 40%;
  border-radius: 999px;
  background: var(--brand);
  animation: pay-check-bar 1.5s ease-in-out infinite;
}
@keyframes pay-check-bar {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
}
@media (prefers-reduced-motion: reduce) {
  .pay-check-ring { animation: none; }
  .pay-check-bar { animation: none; width: 100%; opacity: 0.5; }
}
`;
