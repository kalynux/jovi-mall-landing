"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import {
  declinedPriceWaivesPolicy,
  openPriceProposal,
  priceDropRefunds,
  type BookingPriceProposal,
} from "@/lib/shop/booking-pricing";
import {
  answerPriceProposal,
  answerProposal,
  getBooking,
  withdrawProposal,
  type Booking,
  type RescheduleProposal,
} from "@/lib/shop/bookings.api";
import { formatMoney } from "@/lib/shop/format";
import { AccountCard } from "./AccountShell";

/**
 * A new time one side asked for — `rescheduleProposal` (2026-10-26) — and a new
 * price the vendor asked for — `pricing.proposal` (2026-11-03).
 *
 * ── A price is only ever the vendor's to propose ─────────────────────────────
 *
 * So there is no field to type one in. The customer sees both prices and the
 * deadline, and answers. A new time can carry a new price too
 * (`rescheduleProposal.price`), and then one answer covers both, so the screen
 * shows both before asking.
 *
 * ── Two directions, two vocabularies ─────────────────────────────────────────
 *
 * `proposedBy: "vendor"` — the vendor wants to move it. The customer sees both
 * times and answers Accept / Decline. Next to Decline it says that declining
 * lets them cancel with a full refund: that is what makes declining a real
 * choice rather than a dead end, and the API honours it (the next cancel
 * skips the vendor's policy).
 *
 * `proposedBy: "customer"` — the customer's own move on a service the vendor
 * approves by hand. 🔴 Nothing has moved: the booking keeps its time until the
 * vendor accepts, so this says "waiting for the vendor", never "moved", and
 * offers Withdraw.
 *
 * ── What stays after an answer ───────────────────────────────────────────────
 *
 * Only the two outcomes the customer needs to know about: they declined the
 * vendor's time (so the full-refund cancel is open), or the vendor declined
 * theirs (so the old time stands). `accepted` shows in the booking's own time,
 * `withdrawn` was the customer's doing, and `lapsed` needs nothing.
 */
export function BookingProposalPanel({
  booking,
  onChanged,
}: {
  booking: Booking;
  onChanged: (next: Booking) => void;
}) {
  const p = booking.rescheduleProposal;
  const live = booking.status === "pending" || booking.status === "confirmed";
  if (!p || !live) return null;

  if (p.status === "open") {
    return p.proposedBy === "vendor" ? (
      <VendorProposal booking={booking} proposal={p} onChanged={onChanged} />
    ) : (
      <OwnRequest booking={booking} proposal={p} onChanged={onChanged} />
    );
  }
  if (p.status === "declined") return <DeclinedNote proposal={p} />;
  return null;
}

/**
 * The vendor's proposed price, while the booking waits for their approval.
 * Draws nothing unless one is open, or was declined and the vendor has not
 * confirmed since.
 */
export function BookingPriceProposalPanel({
  booking,
  onChanged,
}: {
  booking: Booking;
  onChanged: (next: Booking) => void;
}) {
  const open = openPriceProposal(booking);
  if (open) return <VendorPrice booking={booking} proposal={open} onChanged={onChanged} />;
  if (declinedPriceWaivesPolicy(booking)) return <PriceDeclinedNote />;
  return null;
}

const RANGE = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
} as const;

/** Shared answer handling: a lapsed or vanished proposal re-reads the booking. */
function useAnswer(bookingId: string, onChanged: (next: Booking) => void) {
  const t = useTranslations("shop.bookings.proposal");
  const { flash } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (which: string, action: () => Promise<Booking>, done: string) => {
      setBusy(which);
      try {
        onChanged(await action());
        flash(done);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        if (code === "BOOKING_PROPOSAL_NOT_FOUND" || code === "BOOKING_PRICE_PROPOSAL_NOT_FOUND") {
          flash(t("noLongerOpen"));
          getBooking(bookingId).then(onChanged).catch(() => {});
        } else if (code === "PAYMENT_BOOKING_IN_PROGRESS") {
          // A price cannot move under a charge still in flight. Nothing was answered.
          flash(t("paymentInFlight"));
        } else {
          flash(t("answerFailed"));
        }
      } finally {
        setBusy(null);
      }
    },
    [bookingId, onChanged, flash, t],
  );

  return { busy, run };
}

function TimeLine({ label, start, end, strong }: { label: string; start: string; end?: string | null; strong?: boolean }) {
  const format = useFormatter();
  const when = end
    ? format.dateTimeRange(new Date(start), new Date(end), RANGE)
    : format.dateTime(new Date(start), RANGE);
  return (
    <div style={{ display: "grid", gap: 1 }}>
      <span className="ds-overline">{label}</span>
      <span
        style={{
          fontSize: strong ? 15.5 : 14,
          fontWeight: strong ? 800 : 500,
          color: strong ? "var(--text-strong)" : "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
          overflowWrap: "anywhere",
        }}
      >
        {when}
      </span>
    </div>
  );
}

function PriceLine({ label, amount, strong }: { label: string; amount: string; strong?: boolean }) {
  return (
    <div style={{ display: "grid", gap: 1 }}>
      <span className="ds-overline">{label}</span>
      <span
        style={{
          fontSize: strong ? 15.5 : 14,
          fontWeight: strong ? 800 : 500,
          color: strong ? "var(--text-strong)" : "var(--text-muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {amount}
      </span>
    </div>
  );
}

function VendorPrice({
  booking,
  proposal,
  onChanged,
}: {
  booking: Booking;
  proposal: BookingPriceProposal;
  onChanged: (next: Booking) => void;
}) {
  const t = useTranslations("shop.bookings.proposal");
  const format = useFormatter();
  const { busy, run } = useAnswer(booking.id, onChanged);

  const amount = formatMoney(proposal.amount, booking.currency);

  return (
    <AccountCard style={{ padding: 16, borderColor: "var(--warning-border)" }}>
      <section aria-labelledby="booking-price-heading" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="banknote" size={17} style={{ color: "var(--warning)", flexShrink: 0 }} />
          <h2
            id="booking-price-heading"
            style={{ fontSize: 15.5, fontWeight: 800, margin: 0, color: "var(--text-strong)" }}
          >
            {t("priceTitle")}
          </h2>
        </div>

        <PriceLine
          label={t("currentPrice")}
          amount={formatMoney(proposal.previousAmount, booking.currency)}
        />
        <PriceLine label={t("proposedPrice")} amount={amount} strong />

        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          {t("priceAnswerBy", { time: format.dateTime(new Date(proposal.expiresAt), RANGE) })}
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          <Button
            block
            leadingIcon="check"
            disabled={busy !== null}
            onClick={() =>
              void run(
                "accept",
                () => answerPriceProposal(booking.id, "accept"),
                t("priceAccepted", { amount }),
              )
            }
          >
            {busy === "accept" ? t("accepting") : t("priceAccept")}
          </Button>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            {t("priceAcceptNote")}
          </p>
          <Button
            block
            variant="secondary"
            disabled={busy !== null}
            onClick={() =>
              void run(
                "decline",
                () => answerPriceProposal(booking.id, "decline"),
                t("priceDeclined"),
              )
            }
          >
            {busy === "decline" ? t("declining") : t("decline")}
          </Button>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            {t("priceDeclineNote")}
          </p>
        </div>
      </section>
    </AccountCard>
  );
}

function PriceDeclinedNote() {
  const t = useTranslations("shop.bookings.proposal");
  return (
    <p
      className="muted"
      style={{ margin: 0, fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start" }}
    >
      <Icon name="info" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{t("youDeclinedPrice")}</span>
    </p>
  );
}

function VendorProposal({
  booking,
  proposal,
  onChanged,
}: {
  booking: Booking;
  proposal: RescheduleProposal;
  onChanged: (next: Booking) => void;
}) {
  const t = useTranslations("shop.bookings.proposal");
  const format = useFormatter();
  const { busy, run } = useAnswer(booking.id, onChanged);

  // Not null: one answer covers the new time and the new price.
  const price = proposal.price ?? null;

  return (
    <AccountCard style={{ padding: 16, borderColor: "var(--warning-border)" }}>
      <section aria-labelledby="booking-proposal-heading" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="calendar-clock" size={17} style={{ color: "var(--warning)", flexShrink: 0 }} />
          <h2
            id="booking-proposal-heading"
            style={{ fontSize: 15.5, fontWeight: 800, margin: 0, color: "var(--text-strong)" }}
          >
            {t(price !== null ? "vendorPricedTitle" : "vendorTitle")}
          </h2>
        </div>

        <TimeLine
          label={t("currentTime")}
          start={proposal.previousStartAt}
          end={proposal.previousEndAt ?? booking.endAt}
        />
        <TimeLine label={t("proposedTime")} start={proposal.startAt} end={proposal.endAt} strong />

        {price !== null && (
          <>
            {proposal.previousPrice != null && (
              <PriceLine
                label={t("currentPrice")}
                amount={formatMoney(proposal.previousPrice, booking.currency)}
              />
            )}
            <PriceLine
              label={t("proposedPrice")}
              amount={formatMoney(price, booking.currency)}
              strong
            />
            {priceDropRefunds(booking, price) && (
              <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                {t("priceDropNote")}
              </p>
            )}
          </>
        )}

        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          {t(price !== null ? "answerByPriced" : "answerBy", {
            time: format.dateTime(new Date(proposal.expiresAt), RANGE),
          })}
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          <Button
            block
            leadingIcon="calendar-check"
            disabled={busy !== null}
            onClick={() =>
              void run(
                "accept",
                () => answerProposal(booking.id, "accept"),
                t(price !== null ? "acceptedPriced" : "accepted"),
              )
            }
          >
            {busy === "accept"
              ? t("accepting")
              : t(price !== null ? "acceptPriced" : "accept")}
          </Button>
          <Button
            block
            variant="secondary"
            disabled={busy !== null}
            onClick={() =>
              void run(
                "decline",
                () => answerProposal(booking.id, "decline"),
                t(price !== null ? "declinedPriced" : "declined"),
              )
            }
          >
            {busy === "decline" ? t("declining") : t("decline")}
          </Button>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            {t(price !== null ? "declineNotePriced" : "declineNote")}
          </p>
        </div>
      </section>
    </AccountCard>
  );
}

function OwnRequest({
  booking,
  proposal,
  onChanged,
}: {
  booking: Booking;
  proposal: RescheduleProposal;
  onChanged: (next: Booking) => void;
}) {
  const t = useTranslations("shop.bookings.proposal");
  const { busy, run } = useAnswer(booking.id, onChanged);

  return (
    <AccountCard style={{ padding: 16 }}>
      <section aria-labelledby="booking-proposal-heading" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="hourglass" size={17} style={{ color: "var(--info)", flexShrink: 0 }} />
          <h2
            id="booking-proposal-heading"
            style={{ fontSize: 15.5, fontWeight: 800, margin: 0, color: "var(--text-strong)" }}
          >
            {t("waitingTitle")}
          </h2>
        </div>
        <TimeLine label={t("requestedTime")} start={proposal.startAt} end={proposal.endAt} strong />
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {t("waitingBody")}
        </p>
        <Button
          block
          variant="ghost"
          leadingIcon="undo-2"
          disabled={busy !== null}
          onClick={() => void run("withdraw", () => withdrawProposal(booking.id), t("withdrawn"))}
        >
          {busy === "withdraw" ? t("withdrawing") : t("withdraw")}
        </Button>
      </section>
    </AccountCard>
  );
}

function DeclinedNote({ proposal }: { proposal: RescheduleProposal }) {
  const t = useTranslations("shop.bookings.proposal");
  return (
    <p
      className="muted"
      style={{ margin: 0, fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start" }}
    >
      <Icon name="info" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{proposal.proposedBy === "vendor" ? t("youDeclined") : t("vendorDeclined")}</span>
    </p>
  );
}
