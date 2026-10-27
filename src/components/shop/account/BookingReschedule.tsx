"use client";

import { useFormatter, useTimeZone, useTranslations } from "next-intl";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { BookingCalendar } from "@/components/shop/BookingCalendar";
import { useSlotHolds } from "@/components/shop/useSlotHolds";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { ApiError } from "@/lib/auth/auth.types";
import { bookingPath } from "@/lib/shop/shop.routes";
import {
  durationParts,
  runAfterTap,
  runBounds,
  slotMinutes,
  slotsByDay,
} from "@/lib/shop/booking-slots";
import {
  getAvailability,
  getBooking,
  openProposal,
  rescheduleBooking,
  type Slot,
} from "@/lib/shop/bookings.api";

const WINDOW_DAYS = 28;

/**
 * Move a booking to another time.
 *
 * ── The new time is held first, exactly as when booking ──────────────────────
 *
 * `PATCH .../reschedule` expects every slot of the new time to be held by the
 * caller — the same rule, and the same reason, as creating a booking: without
 * the hold two people can be moved onto one slot. `useSlotHolds` does that.
 *
 * ── The appointment keeps its length ─────────────────────────────────────────
 *
 * Since 2026-10-26 a booking can span several consecutive slots, and the API
 * refuses a move that changes the length (`BOOKING_INVALID_SLOT_ID`,
 * `length_changed`) — a shorter time would be less than was paid for, a longer
 * one more. So the calendar picks a run of the SAME number of slots: a tap
 * chooses where it starts, and the end follows. When the appointment's length
 * is no longer a whole number of the service's slots (the shop changed the
 * slot length since), no run can match, and the shop is the one to move it.
 *
 * Only `pending` and `confirmed` bookings can move; anything else is
 * `409 BOOKING_NOT_RESCHEDULABLE`, which is why the entry point is only offered
 * for those two.
 */
export function BookingReschedule({ bookingId }: { bookingId: string }) {
  // Bound above the guards below: this component renders a skeleton, then a
  // "cannot be moved" branch, then the picker, so a hook called after an early
  // return would change the hook order between renders.
  const t = useTranslations("shop.bookings");
  const tMove = useTranslations("shop.bookings.reschedule");
  const tBook = useTranslations("shop.product.booking");
  // Root-scoped, for the screen title Phase 1 put in `shop.nav`.
  const tKey = useTranslations();
  // Dates are never translated — they are formatted, against the app's locale
  // and display zone rather than the browser's. See LOCALISATION.md §6.
  const format = useFormatter();
  const timeZone = useTimeZone() ?? "Africa/Douala";
  const router = useRouter();
  const { flash } = useToast();
  const { status } = useAuthGuard();

  const booking = useApiResource(() => getBooking(bookingId), [bookingId, status]);

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [run, setRun] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  /*
     🔴 An id string, never the `productId` object. The deployed read populated
     `productId` as `{ id, title, type }`; this page built the availability URL
     from it (`/products/[object Object]/availability`), swallowed the 404, and
     told every customer there was no time available. `getBooking` now
     normalises it, and `product.id` is the fallback. */
  const productId = booking.data?.productId || booking.data?.product?.id || null;
  const holds = useSlotHolds(productId);

  const range = useMemo(() => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000) };
  }, []);

  const reload = useCallback(() => {
    if (!productId) return;
    getAvailability(productId, range.from, range.to)
      .then(setSlots)
      .catch(() => setSlots((s) => s ?? []));
  }, [productId, range]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    getAvailability(productId, range.from, range.to)
      .then((found) => {
        if (!cancelled) setSlots(found);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, range]);

  const byDay = useMemo(() => slotsByDay(slots ?? [], timeZone), [slots, timeZone]);
  const daySlots = useMemo(() => (day ? (byDay.get(day) ?? []) : []), [byDay, day]);

  /** How many of the service's slots the appointment spans — `null` when not a whole number. */
  const b = booking.data;
  const slotLength = slots && slots[0] ? slotMinutes(slots[0]) : 0;
  const lengthMinutes = b ? Math.round((Date.parse(b.endAt) - Date.parse(b.startAt)) / 60_000) : 0;
  const count =
    slotLength > 0 && lengthMinutes > 0 && lengthMinutes % slotLength === 0
      ? lengthMinutes / slotLength
      : null;

  const choose = useCallback(
    async (next: string[]) => {
      setBusy(true);
      try {
        const { run: held, refusal } = await holds.holdRun(next);
        // A move needs the whole length: a partly held run is no run at all.
        if (held.length !== next.length) {
          await holds.holdRun([]);
          setRun([]);
        } else {
          setRun(held);
        }
        if (refusal) {
          flash(refusal === "BOOKING_SLOT_LOCKED" ? t("slotLocked") : t("holdFailed"));
          reload();
        }
      } finally {
        setBusy(false);
      }
    },
    [holds, flash, t, reload],
  );

  const changeDay = useCallback(
    (next: string | null) => {
      setDay(next);
      if (run.length > 0) void choose([]);
    },
    [run.length, choose],
  );

  const tap = useCallback(
    (slot: Slot) => {
      if (count === null) return;
      const next = runAfterTap(daySlots, run, slot.id, { maxSlots: count, count });
      if (next.join() === run.join()) {
        // The tap could not start a run of the right length here.
        if (!run.includes(slot.id)) flash(tMove("notEnoughTime"));
        return;
      }
      void choose(next);
    },
    [daySlots, run, count, choose, flash, tMove],
  );

  const commit = useCallback(async () => {
    if (run.length === 0) return;
    setBusy(true);
    try {
      const after = await rescheduleBooking(bookingId, run);
      holds.forget();
      setRun([]);
      // On a service the vendor approves by hand this only REQUESTS the time:
      // the booking comes back unchanged with the customer's open proposal.
      // Nothing has moved, so it must not say so.
      const requested = openProposal(after)?.proposedBy === "customer";
      flash(requested ? tMove("requested") : t("moved"));
      router.push(bookingPath(bookingId));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const reason = err instanceof ApiError ? err.details?.reason : undefined;
      /*
         `BOOKING_SLOT_FULL` and `BOOKING_SLOT_UNAVAILABLE` are not the same
         refusal. A capacity service — a group class — answers `SLOT_FULL` when
         the seats are gone, because a class with other people already in it is
         not "taken"; `SLOT_UNAVAILABLE` is the single-occupancy answer and
         genuinely means somebody else has that interval. */
      flash(
        code === "BOOKING_NOT_RESCHEDULABLE"
          ? t("notReschedulable")
          : code === "BOOKING_SLOT_FULL"
            ? t("slotFull")
            : code === "BOOKING_SLOT_UNAVAILABLE"
              ? t("slotTaken")
              : code === "BOOKING_PROPOSAL_PENDING"
                ? tMove("proposalPending")
                : code === "BOOKING_INVALID_SLOT_ID" && reason === "length_changed"
                ? tMove("lengthChanged")
                : code === "VALIDATION_ERROR" && run.length > 1
                  ? tMove("longerUnavailable")
                  : t("moveFailed"),
      );
      await holds.holdRun([]);
      setRun([]);
      reload();
    } finally {
      setBusy(false);
    }
  }, [run, bookingId, holds, flash, t, tMove, router, reload]);

  if (status === "loading" || booking.status === "loading" || (productId && slots === null)) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
        <Skeleton height={320} />
      </div>
    );
  }

  // A new time already waiting for an answer — the vendor's or the customer's
  // own — must be settled on the booking page first (`409 BOOKING_PROPOSAL_PENDING`).
  const pending = b ? openProposal(b) : null;
  if (!b || (b.status !== "pending" && b.status !== "confirmed") || pending) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
        <p style={{ fontSize: 14.5 }}>
          {pending ? tMove("proposalPending") : t("notReschedulable")}
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(bookingPath(bookingId))}
        >
          {t("backToBooking")}
        </Button>
      </div>
    );
  }

  const bounds = runBounds(daySlots, run);
  const lengthLabel = (() => {
    const d = durationParts(lengthMinutes);
    return tBook(d.key, d.values);
  })();

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.bookingReschedule")}</h1>

      <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
        {t("currently", {
          when: format.dateTimeRange(new Date(b.startAt), new Date(b.endAt), {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
        })}
      </p>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        {tMove("keepsLength", { duration: lengthLabel })}
      </p>

      {!slots || !slots.some((s) => s.available) ? (
        <p style={{ fontSize: 14 }}>{t("noOtherTimes")}</p>
      ) : count === null ? (
        <p style={{ fontSize: 14 }}>{tMove("lengthMismatch")}</p>
      ) : (
        <BookingCalendar
          byDay={byDay}
          range={range}
          day={day}
          onDayChange={changeDay}
          run={run}
          onTap={tap}
          maxSlots={count}
          count={count}
          busy={busy}
        />
      )}

      {bounds && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <div className="ds-overline">{tMove("newTime")}</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginTop: 2,
                fontVariantNumeric: "tabular-nums",
                overflowWrap: "anywhere",
              }}
            >
              {format.dateTimeRange(new Date(bounds.start), new Date(bounds.end), {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button disabled={busy} onClick={() => void commit()}>
              {busy ? t("moving") : t("moveMyBooking")}
            </Button>
            <Button variant="ghost" onClick={() => router.push(bookingPath(bookingId))}>
              {tKey("shop.common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
