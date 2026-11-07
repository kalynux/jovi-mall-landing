"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { PaymentHandsetStep } from "@/components/shop/PaymentSteps";
import { translateError } from "@/lib/auth/error-translator";
import { useAppResume } from "@/lib/native/useAppResume";
import { agreedPrice, openPriceProposal } from "@/lib/shop/booking-pricing";
import { formatMoney } from "@/lib/shop/format";
import { nextPollDelay, POLL_MS, readHandsetStep, type HandsetStep } from "@/lib/shop/mobile-money";
import { isSettledFailure, verifyPayment } from "@/lib/shop/payments.api";
import { bookingBalancePath, bookingPayPath } from "@/lib/shop/shop.routes";
import { getBooking, getBookingPaymentStatus, type Booking } from "@/lib/shop/bookings.api";

/**
 * The money part of a booking: pay it, or find out whether a payment landed.
 *
 * ── Why there is a "check" beside the "pay" ──────────────────────────────────
 *
 * The same reason the order screen has one (`OrderGroupDetail`'s
 * `GroupSummary`). Mobile money settles asynchronously, so between the prompt
 * being approved and the callback arriving this booking still reads `unpaid` or
 * `pending` — and a Pay button is then an invitation to pay twice. The check
 * answers the question that shopper actually has.
 *
 * ── How the check works ──────────────────────────────────────────────────────
 *
 * 1. `GET /api/bookings/:id/payment-status` names the transaction, which the
 *    order screen has to remember on the device. When one is open, `verify`
 *    re-asks the gateway rather than waiting for its callback.
 * 2. The booking is re-read either way. It is the authority: `verify` reports
 *    the transaction, the booking reports whether the money landed against it.
 *
 * The answer stays inline rather than flashing. "Not through yet" is a
 * sentence the shopper deliberately asked for and must still be reading when
 * their thumb is over the Pay button. Only success is a toast, because the
 * block this note lives in unmounts the moment the booking is paid.
 *
 * ── A price difference is a different payment ────────────────────────────────
 *
 * `pricing.topup` means a booking already paid owes more because the agreed price
 * went up. It reads `paid` throughout, and it goes through `pay-balance` rather
 * than `/pay`, so it gets its own block with its own door. Everything in it comes
 * from `pricing`. The deadline is said plainly: past it the booking is cancelled
 * and what was paid is refunded.
 *
 * ── A charge that named a payee ──────────────────────────────────────────────
 *
 * The pay screen keeps the dial/confirm step for the session, keyed on the
 * booking (`rememberHandsetStep` in `BookingPay`). A customer who leaves that
 * screen and opens the booking here must still see it: on some networks nothing
 * reaches the phone until they dial, and the merchant name is one they do not
 * know. So while the payment is in flight the step replaces the "under a minute"
 * sentence, and the panel re-reads the booking by itself, on the long poll,
 * because that wait can take minutes. Without a stored step nothing changes.
 * The step comes from sessionStorage only, never the URL: see `mobile-money.ts`.
 */
export function BookingPaymentPanel({
  booking,
  onRefreshed,
}: {
  booking: Booking;
  onRefreshed: (next: Booking) => void;
}) {
  const t = useTranslations("shop.bookings");
  const tProvider = useTranslations("shop.payProvider");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const { flash } = useToast();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<{ tone: "info" | "danger"; message: string } | null>(null);

  const b = booking;
  const amount = formatMoney(agreedPrice(b), b.currency);
  const inFlight = b.paymentStatus === "pending";
  const payable =
    b.requiresPayment && (b.paymentStatus === "unpaid" || b.paymentStatus === "failed");

  /**
   * What this tab was told when it started the charge. Read once: the panel
   * mounts only after the booking has loaded on the client, so there is no
   * server render for sessionStorage to disagree with.
   */
  const [storedHandset] = useState<HandsetStep | null>(() => readHandsetStep(b.id));
  const handset = inFlight ? storedHandset : null;

  /** The latest booking, for the background poll, which outlives renders. */
  const latest = useRef(b);
  useEffect(() => {
    latest.current = b;
  }, [b]);

  /**
   * Ask the gateway, then the booking. Returns the merged booking and whether
   * the transaction itself said no.
   */
  const reread = useCallback(async (): Promise<{ next: Booking; refused: boolean }> => {
    const current = latest.current;
    let refused = false;
    try {
      const state = await getBookingPaymentStatus(current.id);
      const tx = state.transaction;
      if (tx && !isSettledFailure(tx.status) && state.paymentStatus !== "paid") {
        refused = isSettledFailure((await verifyPayment(tx.id)).status);
      } else if (tx) {
        refused = isSettledFailure(tx.status);
      }
    } catch {
      // A verify that errors is not a failed payment — it may still be
      // settling, and the callback settles it without us. The re-read below
      // is what the shopper is shown.
    }

    const fresh = await getBooking(current.id);
    // Keep the parties if this read lacks them (an API older than the
    // 2026-10-26 read projection populates neither).
    const next: Booking = {
      ...current,
      ...fresh,
      product: fresh.product ?? current.product,
      vendor: fresh.vendor ?? current.vendor,
      store: fresh.store ?? current.store,
    };
    return { next, refused };
  }, []);

  /** Bumped when the app returns to the foreground, to restart the poll. */
  const [resumeNonce, setResumeNonce] = useState(0);
  const polling = handset !== null;
  useAppResume(() => {
    if (polling) setResumeNonce((n) => n + 1);
  });

  /**
   * The quiet poll, only while a payee step is on screen — which is what makes
   * "this page updates by itself" true here. Errors are not verdicts: the next
   * tick, or the shopper's own check, tries again. Stopping is not one either.
   */
  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const { next } = await reread();
        if (cancelled) return;
        onRefreshed(next);
        if (next.paymentStatus === "paid") {
          flash(t("paymentReceived"));
          return;
        }
        if (next.paymentStatus !== "pending") return;
      } catch {
        // As above.
      }
      const delay = nextPollDelay(attempts, true);
      if (delay !== null && !cancelled) timer = setTimeout(() => void tick(), delay);
    };

    timer = setTimeout(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `onRefreshed`, `flash` and `t` are read at tick time; restarting the poll
    // whenever their identity changes would reset its pace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, reread, resumeNonce]);

  const check = useCallback(async () => {
    setChecking(true);
    setChecked(null);
    try {
      const { next, refused } = await reread();
      onRefreshed(next);

      if (next.paymentStatus === "paid") {
        flash(t("paymentReceived"));
      } else if (next.paymentStatus === "pending") {
        setChecked({ tone: "info", message: t("detail.checkStillPending") });
      } else if (refused || next.paymentStatus === "failed") {
        setChecked({ tone: "danger", message: t("detail.checkRefused") });
      } else if (next.requiresPayment && next.paymentStatus === "unpaid") {
        setChecked({ tone: "info", message: t("detail.checkNotArrived") });
      }
    } catch (err) {
      setChecked({ tone: "danger", message: translateError(tErrors, err, t("detail.checkFailed")) });
    } finally {
      setChecking(false);
    }
  }, [reread, onRefreshed, flash, t, tErrors]);

  const topup = b.pricing?.topup ?? null;
  if (topup && !inFlight) {
    const owed = formatMoney(topup.amount, b.currency);
    return (
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-strong)" }}>
          {t("toPay", { amount: owed })}
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: "4px 0 0" }}>
          {t("topup.agreedAndPaid", {
            price: formatMoney(agreedPrice(b), b.currency),
            paid: formatMoney(b.pricing?.amountPaid ?? 0, b.currency),
          })}
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.55, fontWeight: 600, color: "var(--text-strong)", margin: "4px 0 12px" }}>
          {t("topup.dueBy", {
            time: format.dateTime(new Date(topup.dueAt), {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </p>
        <Button
          block
          elevated
          leadingIcon="wallet"
          onClick={() => router.push(bookingBalancePath(b.id))}
        >
          {t("payAmount", { amount: owed })}
        </Button>
      </div>
    );
  }

  // While a price waits for an answer, a Pay button that cannot be pressed only
  // stands between the customer and the question. The answer decides what to pay.
  if (openPriceProposal(b) && !inFlight) return null;

  if (!inFlight && !payable) return null;

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      {inFlight ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
          <Icon name="hourglass" size={18} style={{ color: "var(--info)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-strong)" }}>
              {t("detail.pendingTitle")}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: "4px 0 0" }}>
              {handset ? tProvider("handsetWaitBody") : t("detail.pendingBody", { amount })}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-strong)" }}>
            {t("toPay", { amount })}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: "4px 0 12px" }}>
            {b.paymentStatus === "failed"
              ? t("detail.lastPaymentFailed")
              : b.status === "confirmed"
                ? t("heldPayToKeep")
                : t("payAfterAccepted")}
          </p>
        </>
      )}

      {handset && (
        <div style={{ marginBottom: 12 }}>
          <PaymentHandsetStep step={handset} />
        </div>
      )}

      <div className="grid gap-2">
        {/* A booking is created `unpaid`, and a `pending` one waits for the
            seller — paying it then is refused, so the button says so by
            being disabled under `payAfterAccepted`. */}
        {payable && (
          <Button
            block
            elevated
            leadingIcon="wallet"
            disabled={checking || b.status !== "confirmed"}
            onClick={() => router.push(bookingPayPath(b.id))}
          >
            {t("payAmount", { amount })}
          </Button>
        )}

        {/* Secondary on an unpaid booking — noise to someone who has not paid,
            and what the one who has is looking for. Primary-weight content
            while a payment is in flight, because then it is the only action. */}
        {(inFlight || (payable && b.status === "confirmed")) && (
          <Button
            block
            variant="secondary"
            leadingIcon="refresh-cw"
            disabled={checking}
            onClick={() => void check()}
          >
            {checking ? t("detail.checking") : inFlight ? t("detail.checkAgain") : t("detail.alreadyPaidCheck")}
          </Button>
        )}
      </div>

      {checked && (
        <div
          role="status"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            marginTop: 10,
            border: `1px solid var(--${checked.tone === "danger" ? "danger-border" : "border"})`,
            background: checked.tone === "danger" ? "var(--danger-bg)" : "var(--surface-sunken)",
            borderRadius: "var(--radius-md)",
            padding: "11px 13px",
          }}
        >
          <Icon
            name={checked.tone === "danger" ? "triangle-alert" : "hourglass"}
            size={16}
            style={{
              color: checked.tone === "danger" ? "var(--danger)" : "var(--text-muted)",
              flexShrink: 0,
              marginTop: 1,
            }}
          />
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
            {checked.message}
          </p>
        </div>
      )}
    </div>
  );
}
