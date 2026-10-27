"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import {
  answerProposal,
  getBooking,
  withdrawProposal,
  type Booking,
  type RescheduleProposal,
} from "@/lib/shop/bookings.api";
import { AccountCard } from "./AccountShell";

/**
 * A new time one side asked for — `rescheduleProposal` (2026-10-26).
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
        if (code === "BOOKING_PROPOSAL_NOT_FOUND") {
          flash(t("noLongerOpen"));
          getBooking(bookingId).then(onChanged).catch(() => {});
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

  return (
    <AccountCard style={{ padding: 16, borderColor: "var(--warning-border)" }}>
      <section aria-labelledby="booking-proposal-heading" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="calendar-clock" size={17} style={{ color: "var(--warning)", flexShrink: 0 }} />
          <h2
            id="booking-proposal-heading"
            style={{ fontSize: 15.5, fontWeight: 800, margin: 0, color: "var(--text-strong)" }}
          >
            {t("vendorTitle")}
          </h2>
        </div>

        <TimeLine
          label={t("currentTime")}
          start={proposal.previousStartAt}
          end={proposal.previousEndAt ?? booking.endAt}
        />
        <TimeLine label={t("proposedTime")} start={proposal.startAt} end={proposal.endAt} strong />

        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          {t("answerBy", { time: format.dateTime(new Date(proposal.expiresAt), RANGE) })}
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          <Button
            block
            leadingIcon="calendar-check"
            disabled={busy !== null}
            onClick={() =>
              void run("accept", () => answerProposal(booking.id, "accept"), t("accepted"))
            }
          >
            {busy === "accept" ? t("accepting") : t("accept")}
          </Button>
          <Button
            block
            variant="secondary"
            disabled={busy !== null}
            onClick={() =>
              void run("decline", () => answerProposal(booking.id, "decline"), t("declined"))
            }
          >
            {busy === "decline" ? t("declining") : t("decline")}
          </Button>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            {t("declineNote")}
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
