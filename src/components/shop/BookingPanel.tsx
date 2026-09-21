"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Chip, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuth } from "@/lib/auth/useAuth";
import { isCustomerSession } from "@/lib/shop/customer-session";
import { openApp } from "@/lib/native/links";
import { formatMoney } from "@/lib/shop/format";
import { bookingPath } from "@/lib/shop/shop.routes";
import {
  createBooking,
  getAvailability,
  lockSlot,
  releaseSlot,
  type Slot,
} from "@/lib/shop/bookings.api";
import type { Product } from "@/lib/shop/shop.types";

/** How far ahead to ask for slots. */
const WINDOW_DAYS = 21;

/**
 * Book a service.
 *
 * ── The three steps are not collapsible ──────────────────────────────────────
 *
 * A slot is *locked* before it is *booked*, and by the same user — the user id
 * is the lock owner, so booking without one is `409 BOOKING_SLOT_NOT_LOCKED`.
 * The lock is what stops two shoppers paying for the same appointment, and it
 * lasts 15 minutes. Creating the booking releases it; leaving the page releases
 * it explicitly, because 15 minutes of a held slot is 15 minutes nobody else can
 * take it.
 *
 * ── Slot ids are opaque ──────────────────────────────────────────────────────
 *
 * `slot_{startMs}_{endMs}_{hash}`. The hash is what the server verifies, so ids
 * are passed through verbatim and never rebuilt from the `start`/`end` beside
 * them.
 *
 * ── Times belong to the vendor ───────────────────────────────────────────────
 *
 * Availability is computed in the **vendor's** timezone, and everything on the
 * wire is UTC. These render in the shopper's own locale, which is the honest
 * thing to show — "3pm your time" is what they need to turn up.
 */
export function BookingPanel({ product }: { product: Product }) {
  const t = useTranslations("shop.product.booking");
  const tDs = useTranslations("shop.ds");
  // Slot times are rendered in the *shopper's* locale, not the browser's —
  // see LOCALISATION.md §6.
  const format = useFormatter();
  const router = useRouter();
  const { flash } = useToast();
  const { status, role } = useAuth();
  /*
     A customer session, not any session. Lock and book are only `requireAuth`
     server-side, so a vendor could hold a slot and create a booking — then be
     sent to a booking screen under `/shop/account`, which is customer-only and
     would only tell them so. Sending that session to the customer sign-in
     instead asks the right question before anything is created. */
  const signedIn = isCustomerSession(status, role);

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [held, setHeld] = useState<{ slotId: string; expiresAt: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getAvailability(product.id, range.from, range.to)
      .then((found) => {
        if (!cancelled) setSlots(found);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, range]);

  // Give the slot back on the way out. `unlock` is idempotent, so this is safe
  // whether or not a lock is actually held.
  useEffect(() => {
    return () => {
      if (held) void releaseSlot(product.id, held.slotId);
    };
  }, [held, product.id]);

  /** Group by calendar day, which is how a person picks a time. */
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const key = new Date(slot.start).toDateString();
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [slots]);

  const choose = useCallback(
    async (slot: Slot) => {
      if (!signedIn) {
        router.push(`/login?return=${encodeURIComponent(window.location.pathname)}&role=customer`);
        return;
      }

      setBusy(true);
      try {
        // Release whatever was held before moving the hold to the new slot.
        if (held && held.slotId !== slot.id) await releaseSlot(product.id, held.slotId);

        const lock = await lockSlot(product.id, slot.id);
        setHeld({ slotId: slot.id, expiresAt: lock.expiresAt });
        setSelected(slot);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        flash(code === "BOOKING_SLOT_LOCKED" ? t("slotLocked") : t("holdFailed"));
      } finally {
        setBusy(false);
      }
    },
    [signedIn, router, held, product.id, flash, t],
  );

  const book = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const { booking } = await createBooking(
        product.id,
        selected.id,
        notes.trim() ? { notes: notes.trim() } : undefined,
      );
      // The lock is released by the booking itself, so nothing to give back.
      setHeld(null);
      router.push(bookingPath(booking.id));
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message =
        code === "BOOKING_SLOT_FULL"
          ? t("slotFull")
          : code === "BOOKING_SLOT_NOT_LOCKED"
            ? t("holdExpired")
            : code === "BOOKING_SLOT_UNAVAILABLE"
              ? t("slotTaken")
              : t("bookFailed");
      flash(message);
      // Any of these means the hold is gone; re-read so the grid is truthful.
      setHeld(null);
      setSelected(null);
      getAvailability(product.id, range.from, range.to)
        .then(setSlots)
        .catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }, [selected, product.id, notes, router, flash, range, t]);

  if (slots === null) {
    return <Skeleton height={140} />;
  }

  if (slots.length === 0) {
    return <NoSlots store={product.store} />;
  }

  const variant =
    product.variants.find((v) => v.id === product.defaultVariantId) ?? product.variants[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto" }}>
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
              {daySlots.map((slot) => {
                // The time and its capacity are one message, not a time with a
                // translated tail glued on — see LOCALISATION.md §4.
                const time = format.dateTime(new Date(slot.start), {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <Chip
                    key={slot.id}
                    // A full capacity slot is still returned, so it renders as
                    // "Full" rather than quietly disappearing from the day.
                    selected={selected?.id === slot.id}
                    disabled={!slot.available || busy}
                    onClick={() => void choose(slot)}
                  >
                    {slot.spotsRemaining === undefined
                      ? time
                      : slot.available
                        ? t("slotWithSpots", { time, n: slot.spotsRemaining })
                        : t("slotSoldOut", { time })}
                  </Chip>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <>
          {held && <HoldTimer expiresAt={held.expiresAt} />}

          <textarea
            className="field"
            rows={2}
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button block size="lg" elevated disabled={busy} onClick={() => void book()}>
            {busy
              ? t("booking")
              : variant
                ? t("bookPrice", { price: formatMoney(variant.price, variant.currency) })
                : tDs("book")}
          </Button>

          {/* The price is a unit rate prorated by slot length, plus any peak
              surcharge — and the vendor may recompute it if the appointment
              runs long. Saying so beats a total that later changes. */}
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {t("payAfterNote")}
          </p>
        </>
      )}
    </div>
  );
}

/** Counts down the 15-minute hold, so an expiry is not a surprise. */
function HoldTimer({ expiresAt }: { expiresAt: string }) {
  const t = useTranslations("shop.product.booking");
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (left <= 0) {
    return (
      <p style={{ fontSize: 12.5, margin: 0, color: "var(--danger)" }}>{t("holdExpiredNote")}</p>
    );
  }

  // The clock is assembled here and handed over whole: a countdown split across
  // JSX children could only ever come out in English word order.
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const clock = `${minutes}:${String(seconds).padStart(2, "0")}`;
  return (
    <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
      {t("heldFor", { time: clock })}
    </p>
  );
}

/**
 * No bookable slots.
 *
 * The seller's own WhatsApp is the honest fallback and the store record actually
 * carries it — this is what the whole panel used to be, before the booking API
 * was wired.
 */
function NoSlots({ store }: { store: Product["store"] }) {
  const t = useTranslations("shop.product.booking");

  if (!store.supportWhatsapp) {
    return (
      <Button block size="lg" disabled leadingIcon="calendar-clock">
        {t("noTimesButton")}
      </Button>
    );
  }

  const href = `https://wa.me/${store.supportWhatsapp.replace(/[^\d]/g, "")}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        {t("noTimesNote")}
      </p>
      <Button
        block
        size="lg"
        elevated
        leadingIcon="message-circle"
        // `openApp`, not `openExternal`: a `wa.me` link belongs to WhatsApp, and
        // routing it through the in-app browser would open WhatsApp Web inside
        // our app instead of the WhatsApp on the shopper's phone.
        onClick={() => void openApp(href)}
      >
        {t("askStore", { store: store.name })}
      </Button>
    </div>
  );
}
