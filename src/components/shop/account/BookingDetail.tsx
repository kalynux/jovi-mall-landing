"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, ConfirmDialog, Icon, Skeleton, type IconName } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { formatMoney } from "@/lib/shop/format";
import { ApiError } from "@/lib/auth/auth.types";
import {
  BOOKING_PAYMENT_LABEL,
  BOOKING_STATUS_LABEL,
  cancelBooking,
  getBooking,
  getBookingBalance,
  openProposal,
  type Booking,
  type BookingBalance,
} from "@/lib/shop/bookings.api";
import {
  BOOKING_LIST,
  bookingBalancePath,
  bookingReschedulePath,
} from "@/lib/shop/shop.routes";
import { AccountCard } from "./AccountShell";
import { BookingPaymentPanel } from "./BookingPaymentPanel";
import { BookingAccessPanel, BookingPlaceValue, locationIcon } from "./BookingPlace";
import { BookingProposalPanel } from "./BookingProposalPanel";
import { BookingServiceCard, BookingServiceRow } from "./BookingServiceCard";
import { ProtectionNotice } from "./ProtectionNotice";
import { RefundPanel } from "./RefundPanel";
import { ReviewDisclosure } from "./ReviewForm";

/**
 * One appointment.
 *
 * ── Layout, phone first ──────────────────────────────────────────────────────
 *
 * Four blocks, in the DOM in phone order: the status (with the money), the
 * service, the after-the-fact panels (refund, protection, balance), and the
 * actions. From 768px the service takes the left column for the whole height
 * of the page and the other three stack on the right — which is a CSS grid
 * placement, not a second DOM order, so a screen reader and a phone read the
 * same sequence.
 *
 * ── The balance is the part worth getting right ──────────────────────────────
 *
 * A service can run longer, or cost more, than the slot booked, and when the
 * provider settles above what was paid the difference becomes a balance that is
 * **never charged automatically** — the customer agreed to the quoted price, not
 * to whatever is settled afterwards. So it is shown as something to act on, not
 * as a debt already taken.
 *
 * The mirror case is `creditDue`: the provider settled *below* what was paid.
 * That is **recorded, not refunded** — usually a goodwill discount they intend
 * to hand back themselves — so it says so rather than implying money is coming.
 */
export function BookingDetail({ bookingId }: { bookingId: string }) {
  // ⚠ BOTH TRANSLATORS ARE BOUND HERE, ABOVE THE GUARDS BELOW, AND THAT
  //   POSITION IS THE POINT.
  //   `tKey` used to sit after the early returns, which is a real rules-of-hooks
  //   violation rather than a style one: this component renders a skeleton while
  //   loading, then a "not found" branch, then the full view — so the number of
  //   hooks React saw CHANGED between renders as the data arrived. React matches
  //   hooks by call order, so the first render after loading finishes can read
  //   another hook's state, and the symptom is a crash or wrong state on a
  //   screen that worked a moment earlier.
  //
  //   `tKey` is root-scoped, for the absolute keys the lib modules emit
  //   (`shop.status.booking.…`) and the screen title in `shop.nav`.
  const t = useTranslations("shop.bookings");
  const tKey = useTranslations();
  // Dates are formatted against the app's locale, never the browser's. §6.
  const format = useFormatter();
  const router = useRouter();
  const { flash } = useToast();
  const { status: authStatus } = useAuthGuard();

  const booking = useApiResource(() => getBooking(bookingId), [bookingId, authStatus]);

  // `409 BOOKING_NOT_COMPLETED` until the appointment is settled, which is the
  // normal case — so a failure here is silence, not an error.
  const balance = useApiResource<BookingBalance | null>(
    () => getBookingBalance(bookingId).catch(() => null),
    [bookingId, authStatus],
  );

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const cancel = useCallback(async () => {
    setConfirmCancel(false);
    setBusy(true);
    try {
      // The cancel answers with the booking and its `refund` block, so the
      // refund status renders straight from the response. Merged over the
      // detail read rather than replacing it, so the service card keeps its
      // pictures even against an API whose cancel answer lacks them.
      const cancelled = await cancelBooking(bookingId);
      const current = booking.data;
      booking.set(
        current
          ? {
              ...current,
              ...cancelled,
              product: cancelled.product ?? current.product,
              vendor: cancelled.vendor ?? current.vendor,
              store: cancelled.store ?? current.store,
            }
          : cancelled,
      );
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      flash(
        code === "CANCELLATION_NOT_ALLOWED"
          ? t("cancelWindowPassed")
          : code === "BOOKING_NOT_CANCELLABLE"
            ? t("notCancellable")
            : code === "BOOKING_ALREADY_CANCELLED"
              ? t("alreadyCancelled")
              : t("cancelFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, booking, flash, t]);

  if (authStatus === "loading" || booking.status === "loading") {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Skeleton height={220} />
          <Skeleton height={320} />
        </div>
      </div>
    );
  }

  const b = booking.data;
  if (!b) {
    return (
      <div className="mx-auto w-full max-w-[680px] px-4 py-6 sm:px-6">
        <p className="muted">{t("notFound")}</p>
        <Button variant="secondary" onClick={() => router.push(BOOKING_LIST)}>
          {t("backToList")}
        </Button>
      </div>
    );
  }

  const state = BOOKING_STATUS_LABEL[b.status];
  const pay = BOOKING_PAYMENT_LABEL[b.paymentStatus];
  // A free booking is created `unpaid` and stays so — "Unpaid" on it would
  // read as a debt.
  const showPayBadge = b.requiresPayment || b.paymentStatus !== "unpaid";
  const cancellable = b.status === "pending" || b.status === "confirmed";
  // A second move while one waits for an answer is `409 BOOKING_PROPOSAL_PENDING`.
  const movable = cancellable && !openProposal(b);
  // Declining the vendor's new time opens a full-refund cancel, whatever the policy.
  const fullRefundCancel =
    b.rescheduleProposal?.status === "declined" && b.rescheduleProposal.proposedBy === "vendor";
  const bal = balance.data;
  const headline = headlineFor(b);
  const note = typeof b.metadata?.notes === "string" && b.metadata.notes ? b.metadata.notes : null;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="sr-only">{tKey("shop.nav.titles.booking")}</h1>

      {/* `grid-cols-1` is `minmax(0, 1fr)`, not the implicit `auto` column:
          the phone row's one-line vendor name is `nowrap`, and an `auto`
          column grows to its min-content and pushes the cards past 320px. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:grid-rows-[auto_auto_auto_1fr] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
        {/* ── Status and money, then what needs an answer or opens soon ─── */}
        <div className="grid gap-4 md:col-start-2 md:row-start-1">
          <AccountCard style={{ padding: 16 }}>
            <section aria-labelledby="booking-status-heading">
              {/* Phones only: the first screen must say WHAT was booked, and the
                  full card is a scroll away there. From 768px it sits beside. */}
              <div className="md:hidden">
                <BookingServiceRow booking={b} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: `var(--${headline.tone}-bg)`,
                    color: `var(--${headline.tone})`,
                    border: `1px solid var(--${headline.tone}-border)`,
                  }}
                >
                  <Icon name={headline.icon} size={19} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2
                    id="booking-status-heading"
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      lineHeight: 1.3,
                      color: "var(--text-strong)",
                      margin: 0,
                    }}
                  >
                    {t(headline.key)}
                  </h2>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {state && (
                      <Badge size="sm" tone={state.tone}>
                        {tKey(state.labelKey)}
                      </Badge>
                    )}
                    {pay && showPayBadge && (
                      <Badge size="sm" tone={pay.tone}>
                        {tKey(pay.labelKey)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <dl style={{ margin: "16px 0 0", display: "grid", gap: 10 }}>
                {/* `dateTimeRange` rather than two formatted dates glued with a
                    dash: it collapses a same-day appointment the way each locale
                    does it, and the separator is not ours to hard-code. */}
                <Row
                  icon="calendar-days"
                  label={t("when")}
                  value={format.dateTimeRange(new Date(b.startAt), new Date(b.endAt), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                />
                <Row
                  icon="clock"
                  label={t("detail.duration")}
                  value={durationOf(b, format, t)}
                />
                {/* `null` on bookings made before 2026-10-26: no row, not a guess. */}
                {b.location && (
                  <Row
                    icon={locationIcon(b.location)}
                    label={t("place.label")}
                    value={<BookingPlaceValue location={b.location} />}
                  />
                )}
                <Row
                  icon="banknote"
                  label={t("price")}
                  value={formatMoney(b.priceSnapshot, b.currency)}
                />
                {/* The reference to quote — the vendor's handle for this booking
                    too. Omitted when null: bookings predate the field, and "#"
                    on its own tells nobody anything. */}
                {b.bookingNumber && (
                  <Row
                    icon="receipt-text"
                    label={t("detail.reference")}
                    value={
                      <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {b.bookingNumber}
                      </span>
                    }
                  />
                )}
                {note && <Row icon="message-square" label={t("yourNote")} value={note} />}
              </dl>

              {/* Unpaid → pay, or check a payment already made; in flight →
                  check again. Draws nothing once the money is settled. */}
              <BookingPaymentPanel booking={b} onRefreshed={booking.set} />
            </section>
          </AccountCard>

          {/* Both draw nothing when there is nothing to say. */}
          <BookingProposalPanel booking={b} onChanged={booking.set} />
          <BookingAccessPanel booking={b} onRefreshed={booking.set} />
        </div>

        {/* ── The service ──────────────────────────────────────────────── */}
        <div className="md:col-start-1 md:row-span-4 md:row-start-1">
          <BookingServiceCard booking={b} />
        </div>

        {/* ── What happened to the money afterwards ────────────────────── */}
        <div className="grid gap-3 empty:hidden md:col-start-2">
          {/* From the booking's `refund` block alone. It is on the cancel
              response too, so it shows the moment a paid booking is cancelled
              rather than after a reload. */}
          {b.refund && <RefundPanel refund={b.refund} />}

          {/* Wi-Mall Protection, from `protection` alone. A booking's window
              opens when the seller marks the service completed; one completed
              before 2026-10-10 can read `not_started` with no dates, and then
              this draws nothing. */}
          <ProtectionNotice protection={b.protection} about="BOOKING" id={b.id} />

          {bal && bal.outstanding > 0 && (
            <AccountCard>
              {/* The amounts go through `formatMoney` and into the message as
                  VALUES. They carry bidi isolate marks, so they survive an
                  Arabic paragraph — which rebuilding the sentence from
                  fragments would not. */}
              <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
                {t("stillToPay", { amount: formatMoney(bal.outstanding, bal.currency) })}
              </div>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
                {t("settledAbove", {
                  final: formatMoney(bal.finalPrice, bal.currency),
                  quoted: formatMoney(bal.quotedPrice, bal.currency),
                })}
              </p>
              <Button block leadingIcon="wallet" onClick={() => router.push(bookingBalancePath(bookingId))}>
                {t("payBalance")}
              </Button>
            </AccountCard>
          )}

          {/* Recorded, not refunded — no automatic payout is issued, so this
              must not read as money on its way back. */}
          {bal && bal.creditDue > 0 && (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {t("creditRecorded", { amount: formatMoney(bal.creditDue, bal.currency) })}
            </p>
          )}
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="grid gap-2 md:col-start-2">
          {movable && (
            <Button
              block
              variant="secondary"
              leadingIcon="calendar-clock"
              onClick={() => router.push(bookingReschedulePath(bookingId))}
            >
              {t("moveToAnotherTime")}
            </Button>
          )}
          {cancellable && (
            <Button
              block
              variant="ghost"
              leadingIcon="calendar-x"
              disabled={busy}
              style={{ color: "var(--danger)" }}
              onClick={() => setConfirmCancel(true)}
            >
              {t("cancelBooking")}
            </Button>
          )}
          <Button block variant="ghost" leadingIcon="list" onClick={() => router.push(BOOKING_LIST)}>
            {t("allBookings")}
          </Button>
        </div>
      </div>

      {/* A completed appointment is a product the customer received. The
          eligibility read inside decides whether the form actually draws. */}
      {b.status === "completed" && b.product?.id && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <ReviewDisclosure
            subjectType="product"
            subjectId={b.product.id}
            label={b.product.title}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title={t("confirmCancelTitle")}
        tone="danger"
        icon="calendar-clock"
        confirmLabel={t("confirmCancelAction")}
        cancelLabel={t("keepIt")}
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmCancel(false)}
      >
        {b.paymentStatus === "paid"
          ? fullRefundCancel
            ? t("confirmCancelFullRefund")
            : t("confirmCancelPaid")
          : t("confirmCancelUnpaid")}
      </ConfirmDialog>
    </div>
  );
}

type Tone = "info" | "success" | "warning" | "danger";

/**
 * The one sentence at the top: where this appointment stands, in the
 * customer's terms. The two badges under it are the raw states; this is what
 * they add up to. Keys are under `shop.bookings.detail.headline`.
 */
function headlineFor(b: Booking): { key: string; icon: IconName; tone: Tone } {
  switch (b.status) {
    case "cancelled":
      return { key: "detail.headline.cancelled", icon: "calendar-x", tone: "danger" };
    case "completed":
      return { key: "detail.headline.completed", icon: "calendar-check", tone: "success" };
    case "no-show":
      return { key: "detail.headline.noShow", icon: "circle-x", tone: "danger" };
    case "pending":
      return { key: "detail.headline.awaitingSeller", icon: "hourglass", tone: "warning" };
  }
  if (b.paymentStatus === "pending") {
    return { key: "detail.headline.checkingPayment", icon: "hourglass", tone: "info" };
  }
  if (b.requiresPayment && (b.paymentStatus === "unpaid" || b.paymentStatus === "failed")) {
    return { key: "detail.headline.payToKeep", icon: "wallet", tone: "warning" };
  }
  return { key: "detail.headline.booked", icon: "calendar-check", tone: "success" };
}

/**
 * "1 hr 30 min" in the app's locale. Each part is an `Intl` unit, so the
 * abbreviation is the locale's; only their order is a message.
 */
function durationOf(
  b: Booking,
  format: ReturnType<typeof useFormatter>,
  t: ReturnType<typeof useTranslations<"shop.bookings">>,
): string {
  const total = Math.max(0, Math.round((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const h = format.number(hours, { style: "unit", unit: "hour", unitDisplay: "short" });
  const m = format.number(minutes, { style: "unit", unit: "minute", unitDisplay: "short" });
  if (hours === 0) return m;
  if (minutes === 0) return h;
  return t("detail.durationHoursMinutes", { hours: h, minutes: m });
}

function Row({ icon, label, value }: { icon: IconName; label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "flex-start" }}>
      <Icon name={icon} size={16} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
      <dt className="muted" style={{ minWidth: 84, flexShrink: 0 }}>
        {label}
      </dt>
      <dd style={{ margin: 0, minWidth: 0, color: "var(--text-strong)", overflowWrap: "anywhere" }}>
        {value}
      </dd>
    </div>
  );
}
