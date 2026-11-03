"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import { getBooking, sendBookingReminder, type Booking } from "@/lib/shop/bookings.api";

const WHEN = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
} as const;

/**
 * The customer's one reminder to the provider — the `reminder` block (2026-11-03).
 *
 * The button comes from `canSend` and nothing else; the rule is the server's.
 * There is no message box, deliberately: the platform writes the message. It can
 * be sent once and not taken back, so the line under the button says so.
 *
 * Separate from the automatic reminder about a day before, which neither spends
 * this one nor is limited by it. What the two sides sent stops mattering once
 * the appointment is over, so a finished booking draws nothing.
 */
export function BookingReminderPanel({
  booking,
  onChanged,
}: {
  booking: Booking;
  onChanged: (next: Booking) => void;
}) {
  const t = useTranslations("shop.bookings.reminder");
  const format = useFormatter();
  const { flash } = useToast();
  const [busy, setBusy] = useState(false);

  const send = useCallback(async () => {
    setBusy(true);
    try {
      const reminder = await sendBookingReminder(booking.id);
      onChanged({ ...booking, reminder });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "BOOKING_REMINDER_ALREADY_SENT" || code === "BOOKING_REMINDER_NOT_APPLICABLE") {
        // Another tab, or the booking changed since the page loaded.
        flash(t(code === "BOOKING_REMINDER_ALREADY_SENT" ? "alreadySent" : "notApplicable"));
        getBooking(booking.id).then(onChanged).catch(() => {});
      } else {
        flash(t("sendFailed"));
      }
    } finally {
      setBusy(false);
    }
  }, [booking, onChanged, flash, t]);

  const r = booking.reminder;
  const live = booking.status === "pending" || booking.status === "confirmed";
  if (!r || !live) return null;

  return (
    <>
      {r.receivedAt && (
        <Note icon="bell" title={t("received")} when={format.dateTime(new Date(r.receivedAt), WHEN)} />
      )}
      {r.sentAt ? (
        <Note icon="check" title={t("sent")} when={format.dateTime(new Date(r.sentAt), WHEN)} />
      ) : (
        r.canSend && (
          <div style={{ display: "grid", gap: 6 }}>
            <Button
              block
              variant="secondary"
              leadingIcon="bell"
              disabled={busy}
              onClick={() => void send()}
            >
              {busy ? t("sending") : t("send")}
            </Button>
            <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: "center" }}>
              {t("oneOnly")}
            </p>
          </div>
        )
      )}
    </>
  );
}

function Note({ icon, title, when }: { icon: "bell" | "check"; title: string; when: string }) {
  return (
    <p
      role="status"
      style={{ margin: 0, fontSize: 13.5, display: "flex", gap: 8, alignItems: "flex-start" }}
    >
      <Icon name={icon} size={15} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 3 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: "var(--text-strong)" }}>{title}</span>
        <span className="muted"> · {when}</span>
      </span>
    </p>
  );
}
