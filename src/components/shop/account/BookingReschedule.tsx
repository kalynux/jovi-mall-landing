"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Chip, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { ApiError } from "@/lib/auth/auth.types";
import { bookingPath } from "@/lib/shop/shop.routes";
import {
  getAvailability,
  getBooking,
  lockSlot,
  releaseSlot,
  rescheduleBooking,
  type Slot,
} from "@/lib/shop/bookings.api";

const WINDOW_DAYS = 21;

/**
 * Move a booking to another time.
 *
 * ── The new slot is locked first, exactly as when booking ────────────────────
 *
 * `PATCH .../reschedule` takes a `newSlotId` and expects it to be held by the
 * caller — the same rule, and the same reason, as creating a booking: without
 * the lock two people can be moved onto one slot. So this repeats the
 * lock-then-commit dance rather than sending a slot id straight from the
 * availability read.
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
  // Root-scoped, for the screen title Phase 1 put in `shop.nav`.
  const tKey = useTranslations();
  // Dates are never translated — they are formatted, against the app's locale
  // rather than the browser's. See LOCALISATION.md §6.
  const format = useFormatter();
  const router = useRouter();
  const { flash } = useToast();
  const { status } = useAuthGuard();

  const booking = useApiResource(() => getBooking(bookingId), [bookingId, status]);

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const productId = booking.data?.productId ?? null;

  const range = useMemo(() => {
    const from = new Date();
    return { from, to: new Date(from.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000) };
  }, []);

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

  // Give back a hold that was never spent.
  useEffect(() => {
    return () => {
      if (held && productId) void releaseSlot(productId, held);
    };
  }, [held, productId]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const key = new Date(slot.start).toDateString();
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return [...map.entries()];
  }, [slots]);

  const choose = useCallback(
    async (slot: Slot) => {
      if (!productId) return;
      setBusy(true);
      try {
        if (held && held !== slot.id) await releaseSlot(productId, held);
        await lockSlot(productId, slot.id);
        setHeld(slot.id);
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        flash(code === "BOOKING_SLOT_LOCKED" ? t("slotLocked") : t("holdFailed"));
      } finally {
        setBusy(false);
      }
    },
    [productId, held, flash, t],
  );

  const commit = useCallback(async () => {
    if (!held) return;
    setBusy(true);
    try {
      await rescheduleBooking(bookingId, held);
      setHeld(null);
      flash(t("moved"));
      router.push(bookingPath(bookingId));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      /*
         `BOOKING_SLOT_FULL` and `BOOKING_SLOT_UNAVAILABLE` are not the same
         refusal, and only one of them was handled here.

         A capacity service — a group class — answers `SLOT_FULL` when the seats
         are gone, because a class with other people already in it is not
         "taken"; moving into a 3-of-8 class succeeds and makes it 4 of 8.
         `SLOT_UNAVAILABLE` is the single-occupancy answer and genuinely does
         mean somebody else has that interval. Reporting a full class as a clash
         tells the customer to pick another time when what they need to know is
         that this one is full.

         Worth noting why this went unnoticed: until 2026-09-06 rescheduling a
         capacity booking failed with `BOOKING_SLOT_NOT_LOCKED` however correct
         the request was — the reschedule looked for the hold under a different
         key from the one the lock endpoint writes — so the seat-count branch
         was unreachable. It works now. */
      flash(
        code === "BOOKING_NOT_RESCHEDULABLE"
          ? t("notReschedulable")
          : code === "BOOKING_SLOT_FULL"
            ? t("slotFull")
            : code === "BOOKING_SLOT_UNAVAILABLE"
              ? t("slotTaken")
              : t("moveFailed"),
      );
      setHeld(null);
    } finally {
      setBusy(false);
    }
  }, [held, bookingId, router, flash, t]);

  if (status === "loading" || booking.status === "loading" || slots === null) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <Skeleton height={220} />
      </div>
    );
  }

  const b = booking.data;
  if (!b || (b.status !== "pending" && b.status !== "confirmed")) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <p style={{ fontSize: 14.5 }}>{t("notReschedulable")}</p>
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

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.bookingReschedule")}</h1>

      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {t("currently", {
          when: format.dateTime(new Date(b.startAt), {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
        })}
      </p>

      {slots.length === 0 ? (
        <p style={{ fontSize: 14 }}>{t("noOtherTimes")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 360, overflowY: "auto" }}>
          {byDay.map(([day, daySlots]) => (
            <div key={day}>
              <div className="ds-overline" style={{ marginBottom: 6 }}>
                {format.dateTime(new Date(daySlots[0].start), {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {daySlots.map((slot) => (
                  <Chip
                    key={slot.id}
                    selected={held === slot.id}
                    disabled={!slot.available || busy}
                    onClick={() => void choose(slot)}
                  >
                    {format.dateTime(new Date(slot.start), {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {slot.spotsRemaining !== undefined &&
                      ` · ${
                        slot.available ? t("spotsLeft", { n: slot.spotsRemaining }) : t("full")
                      }`}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {held && (
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <Button disabled={busy} onClick={() => void commit()}>
            {busy ? t("moving") : t("moveMyBooking")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push(bookingPath(bookingId))}
          >
            {tKey("shop.common.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
}
