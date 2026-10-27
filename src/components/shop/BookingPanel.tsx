"use client";

import { useFormatter, useTimeZone, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Icon, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { BookingCalendar } from "@/components/shop/BookingCalendar";
import { useSlotHolds } from "@/components/shop/useSlotHolds";
import { useAuth } from "@/lib/auth/useAuth";
import { ApiError } from "@/lib/auth/auth.types";
import { isCustomerSession } from "@/lib/shop/customer-session";
import { openApp } from "@/lib/native/links";
import { selectionFeedback } from "@/lib/native/haptics";
import { formatMoney } from "@/lib/shop/format";
import { bookingPath } from "@/lib/shop/shop.routes";
import {
  durationParts,
  isGroupService,
  longestRunFrom,
  runAfterTap,
  runBounds,
  runFrom,
  slotMinutes,
  slotsByDay,
} from "@/lib/shop/booking-slots";
import { createBooking, getAvailability, type Slot } from "@/lib/shop/bookings.api";
import { getProfile } from "@/lib/shop/profile.api";
import type { SavedAddress } from "@/lib/shop/customer.types";
import type { Product } from "@/lib/shop/shop.types";

/** How far ahead to ask for slots — four whole weeks of calendar. */
const WINDOW_DAYS = 28;

/** The API's cap on the customer's note. */
const NOTES_MAX = 500;

/**
 * The most consecutive slots one booking may span. The API's own bound is
 * `BOOKING_MAX_SLOTS_PER_BOOKING` (24 by default); this stays under it.
 */
const MAX_RUN = 12;

/**
 * Book a service.
 *
 * ── Date, then time, then how long ───────────────────────────────────────────
 *
 * The customer picks a day, then a start time on that day's timeline. The end
 * is set one slot later; tapping a later time — or "+" — makes the appointment
 * longer, a slot at a time, for as long as the slots run on without a gap. So
 * the length is always a whole number of the service's own slots, which is the
 * only shape the API books (see `lib/shop/booking-slots.ts`). A group class is
 * one session at a time.
 *
 * ── Every slot is held before it is booked ───────────────────────────────────
 *
 * A slot is *locked* before it is *booked*, and by the same user — booking
 * without one is `409 BOOKING_SLOT_NOT_LOCKED`. The hold is what stops two
 * shoppers paying for the same appointment, and it lasts 15 minutes. Each slot
 * of the run is held on its own as it joins (`useSlotHolds`), given back as it
 * leaves, and given back on the way out. A signed-out shopper can still look
 * around and choose; holding starts at sign-in, which is where "Book" sends them.
 *
 * ── Slot ids are opaque ──────────────────────────────────────────────────────
 *
 * `slot_{startMs}_{endMs}_{hash}`, passed through verbatim and never rebuilt.
 *
 * ── Times belong to the vendor ───────────────────────────────────────────────
 *
 * Availability is computed in the **vendor's** timezone, and everything on the
 * wire is UTC. They render in the app's display zone (next-intl's `timeZone`),
 * and the days are that zone's days too.
 *
 * ── The vendor comes to the customer ─────────────────────────────────────────
 *
 * When the service's `locationKind` is `customer_address` the customer picks
 * one of their saved addresses and it goes out as `addressId`. 🔴 Nothing is
 * pre-selected, not even the default: the vendor travels to whatever is sent,
 * so it must be a choice the customer made. No saved address sends them to
 * add one first.
 */
export function BookingPanel({ product }: { product: Product }) {
  const t = useTranslations("shop.product.booking");
  const tDs = useTranslations("shop.ds");
  const format = useFormatter();
  const timeZone = useTimeZone() ?? "Africa/Douala";
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
  const [day, setDay] = useState<string | null>(null);
  const [run, setRun] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const holds = useSlotHolds(signedIn ? product.id : null);

  // The variant the API books: the default one.
  const variant =
    product.variants.find((v) => v.id === product.defaultVariantId) ?? product.variants[0];
  const comesToYou = variant?.service?.locationKind === "customer_address";
  /** `null` while loading (or not needed). */
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);

  const loadAddresses = useCallback(
    () =>
      getProfile()
        .then((profile) => setAddresses(profile.savedAddresses ?? []))
        .catch(() => setAddresses((a) => a ?? [])),
    [],
  );

  useEffect(() => {
    if (signedIn && comesToYou) void loadAddresses();
  }, [signedIn, comesToYou, loadAddresses]);

  const range = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }, []);

  const reload = useCallback(
    () =>
      getAvailability(product.id, range.from, range.to)
        .then(setSlots)
        .catch(() => setSlots((s) => s ?? [])),
    [product.id, range],
  );

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

  const byDay = useMemo(() => slotsByDay(slots ?? [], timeZone), [slots, timeZone]);
  const daySlots = useMemo(() => (day ? (byDay.get(day) ?? []) : []), [byDay, day]);
  const maxSlots = slots && isGroupService(slots) ? 1 : MAX_RUN;

  /** Hold `next` (when signed in) and show what was actually held. */
  const choose = useCallback(
    async (next: string[]) => {
      if (!signedIn) {
        setRun(next);
        return;
      }
      setBusy(true);
      try {
        const { run: held, refusal } = await holds.holdRun(next);
        setRun(held);
        if (refusal) {
          flash(refusal === "BOOKING_SLOT_LOCKED" ? t("slotLocked") : t("holdFailed"));
          // Somebody else has it — re-read so the timeline is truthful.
          void reload();
        }
      } finally {
        setBusy(false);
      }
    },
    [signedIn, holds, flash, t, reload],
  );

  const changeDay = useCallback(
    (next: string | null) => {
      setDay(next);
      // A run belongs to its day: a new day starts from nothing, and gives the
      // old day's holds back.
      if (run.length > 0) void choose([]);
    },
    [run.length, choose],
  );

  const tap = useCallback(
    (slot: Slot) => {
      const next = runAfterTap(daySlots, run, slot.id, { maxSlots });
      if (next.join() !== run.join()) void choose(next);
    },
    [daySlots, run, maxSlots, choose],
  );

  const bounds = runBounds(daySlots, run);
  const slotLength = daySlots[0] ? slotMinutes(daySlots[0]) : 0;
  const canGrow =
    bounds !== null && bounds.count < longestRunFrom(daySlots, run[0], maxSlots);

  const book = useCallback(async () => {
    if (!bounds) return;
    if (!signedIn) {
      router.push(`/login?return=${encodeURIComponent(window.location.pathname)}&role=customer`);
      return;
    }
    if (comesToYou && !addressId) {
      flash(t("chooseAddressFirst"));
      return;
    }
    setBusy(true);
    try {
      const note = notes.trim().slice(0, NOTES_MAX);
      const { booking } = await createBooking(product.id, run, {
        metadata: note ? { notes: note } : undefined,
        addressId: comesToYou && addressId ? addressId : undefined,
      });
      // The booking released the holds itself, so nothing to give back.
      holds.forget();
      /*
         Belt and braces for a run: `createBooking` never sends `slotId` beside
         `slotIds`, so an API too old for runs answers 400 rather than booking
         the first slot alone. Should one ever book a shorter interval anyway,
         say so before the customer pays for something they did not choose. */
      if (Date.parse(booking.endAt) !== Date.parse(bounds.end)) flash(t("bookedShorter"));
      router.push(bookingPath(booking.id));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : (err as { code?: string })?.code;
      /*
         The address refusals are about the address, not the time: nothing was
         booked and the holds still stand, so keep the chosen time and let the
         customer pick again. */
      if (code === "BOOKING_ADDRESS_REQUIRED" || code === "BOOKING_ADDRESS_NOT_FOUND") {
        flash(code === "BOOKING_ADDRESS_REQUIRED" ? t("chooseAddressFirst") : t("addressGone"));
        setAddressId(null);
        void loadAddresses();
        setBusy(false);
        return;
      }
      flash(
        code === "BOOKING_SLOT_FULL"
          ? t("slotFull")
          : code === "BOOKING_SLOT_NOT_LOCKED"
            ? t("holdExpired")
            : code === "BOOKING_SLOT_UNAVAILABLE"
              ? t("slotTaken")
              : code === "BOOKING_MULTI_SLOT_NOT_SUPPORTED"
                ? t("oneSessionOnly")
                : code === "BOOKING_LOCATION_UNAVAILABLE"
                  ? t("locationUnavailable")
                  : code === "VALIDATION_ERROR" && run.length > 1
                    ? t("longerUnavailable")
                    : t("bookFailed"),
      );
      // Any of these means the holds may be gone; start the time over on a fresh read.
      await holds.holdRun([]);
      setRun([]);
      void reload();
    } finally {
      setBusy(false);
    }
  }, [
    bounds,
    signedIn,
    router,
    product.id,
    run,
    notes,
    comesToYou,
    addressId,
    loadAddresses,
    holds,
    flash,
    t,
    reload,
  ]);

  if (slots === null) {
    return <Skeleton height={320} />;
  }

  if (!slots.some((s) => s.available)) {
    return <NoSlots store={product.store} />;
  }

  // The variant's price is one slot's; the API prorates by length, so a run
  // is that price per slot. A peak-hours surcharge can still add to it, which
  // the note under the button says.
  const total = variant && bounds ? variant.price * bounds.count : null;
  const say = (minutes: number) => {
    const d = durationParts(minutes);
    return t(d.key, d.values);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <BookingCalendar
        byDay={byDay}
        range={range}
        day={day}
        onDayChange={changeDay}
        run={run}
        onTap={tap}
        maxSlots={maxSlots}
        busy={busy}
      />

      {bounds && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px 14px",
              padding: 14,
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--surface)",
            }}
          >
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <div className="ds-overline">{t("yourAppointment")}</div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "var(--text-strong)",
                  fontVariantNumeric: "tabular-nums",
                  marginTop: 2,
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
              {variant && bounds.count > 1 && (
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                  {t("slotsTimesPrice", {
                    n: bounds.count,
                    price: formatMoney(variant.price, variant.currency),
                  })}
                </div>
              )}
            </div>

            {maxSlots > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="ds-overline">{t("duration")}</span>
                <LengthStepper
                  label={say(bounds.count * slotLength)}
                  canShrink={bounds.count > 1 && !busy}
                  canGrow={canGrow && !busy}
                  stepLabel={say(slotLength)}
                  onShrink={() => void choose(run.slice(0, -1))}
                  onGrow={() => {
                    const next = runFrom(daySlots, run[0], run.length + 1);
                    if (next) void choose(next.map((s) => s.id));
                  }}
                />
              </div>
            )}
          </div>

          {/* Keyed by the expiry: a run that grows or restarts has a new
              earliest hold, and the countdown starts over from it. */}
          {holds.expiresAt && <HoldTimer key={holds.expiresAt} expiresAt={holds.expiresAt} />}

          {comesToYou &&
            (signedIn ? (
              <AddressChoice
                addresses={addresses}
                chosen={addressId}
                onChoose={setAddressId}
                onManage={() => router.push("/shop/account/addresses")}
              />
            ) : (
              <p className="muted" style={{ fontSize: 13, margin: 0, display: "flex", gap: 6 }}>
                <Icon name="navigation" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                {t("comesToYouSignedOut")}
              </p>
            ))}

          <div style={{ display: "grid", gap: 4 }}>
            <textarea
              className="field"
              rows={2}
              maxLength={NOTES_MAX}
              placeholder={t("notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
            />
            {/* Only near the cap: a counter from the first keystroke is noise. */}
            {notes.length >= NOTES_MAX - 100 && (
              <span className="muted" style={{ fontSize: 12, textAlign: "end" }}>
                {t("notesCount", { n: notes.length, max: NOTES_MAX })}
              </span>
            )}
          </div>

          <Button
            block
            size="lg"
            elevated
            disabled={busy || (comesToYou && signedIn && !addressId)}
            onClick={() => void book()}
          >
            {busy
              ? t("booking")
              : total !== null && variant
                ? t("bookPrice", { price: formatMoney(total, variant.currency) })
                : tDs("book")}
          </Button>

          {/* The price is a unit rate prorated by length, plus any peak
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

/**
 * Which saved address the vendor comes to. Radio semantics, nothing chosen to
 * begin with — see the note on the panel.
 */
function AddressChoice({
  addresses,
  chosen,
  onChoose,
  onManage,
}: {
  addresses: SavedAddress[] | null;
  chosen: string | null;
  onChoose: (id: string) => void;
  onManage: () => void;
}) {
  const t = useTranslations("shop.product.booking");

  if (addresses === null) return <Skeleton height={64} />;

  if (addresses.length === 0) {
    return (
      <div
        style={{
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 14,
          display: "grid",
          gap: 10,
        }}
      >
        <div className="ds-overline">{t("whereComeTitle")}</div>
        <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
          {t("noAddressYet")}
        </p>
        <Button variant="secondary" leadingIcon="map-pin" onClick={onManage}>
          {t("addAddress")}
        </Button>
      </div>
    );
  }

  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8, minWidth: 0 }}>
      <legend className="ds-overline" style={{ marginBottom: 6, padding: 0 }}>
        {t("whereComeTitle")}
      </legend>
      {addresses.map((a) => {
        const on = chosen === a._id;
        const line = [a.address_line1, a.address_line2, a.city, a.state].filter(Boolean).join(", ");
        return (
          <label
            key={a._id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: 12,
              minHeight: 44,
              borderRadius: "var(--radius-md)",
              border: on ? "1.5px solid var(--brand)" : "1.5px solid var(--border)",
              background: "var(--surface)",
              cursor: "pointer",
              minWidth: 0,
            }}
          >
            <input
              type="radio"
              name="booking-address"
              checked={on}
              onChange={() => onChoose(a._id)}
              style={{ marginTop: 3, accentColor: "var(--brand)", flexShrink: 0 }}
            />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 14, overflowWrap: "anywhere" }}>
                {a.label || t("addressFallback")}
              </span>
              <span
                className="muted ds-ugc"
                style={{ display: "block", fontSize: 13, marginTop: 2, overflowWrap: "anywhere" }}
              >
                {line}
              </span>
            </span>
          </label>
        );
      })}
      {!chosen && (
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          {t("chooseAddressHint")}
        </p>
      )}
      <button
        type="button"
        onClick={onManage}
        style={{
          border: "none",
          background: "none",
          color: "var(--brand-hover)",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          justifySelf: "start",
          minHeight: 44,
          padding: 0,
        }}
      >
        {t("manageAddresses")}
      </button>
    </fieldset>
  );
}

/** − 1 h 30 min + : the appointment's length, a slot at a time. */
function LengthStepper({
  label,
  stepLabel,
  canShrink,
  canGrow,
  onShrink,
  onGrow,
}: {
  label: string;
  stepLabel: string;
  canShrink: boolean;
  canGrow: boolean;
  onShrink: () => void;
  onGrow: () => void;
}) {
  const t = useTranslations("shop.product.booking");
  const btn = (icon: "minus" | "plus", enabled: boolean, onClick: () => void, aria: string) => (
    <button
      type="button"
      aria-label={aria}
      disabled={!enabled}
      onClick={() => {
        void selectionFeedback();
        onClick();
      }}
      style={{
        width: 44,
        height: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        color: enabled ? "var(--text-strong)" : "var(--text-subtle)",
        cursor: enabled ? "pointer" : "not-allowed",
      }}
    >
      <Icon name={icon} size={18} />
    </button>
  );
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      {btn("minus", canShrink, onShrink, t("shorterBy", { duration: stepLabel }))}
      <span
        aria-live="polite"
        style={{
          minWidth: 76,
          textAlign: "center",
          fontWeight: 800,
          fontSize: 14,
          fontVariantNumeric: "tabular-nums",
          color: "var(--text-strong)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {btn("plus", canGrow, onGrow, t("longerBy", { duration: stepLabel }))}
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
    <p className="muted" style={{ fontSize: 12.5, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
      <Icon name="clock" size={14} />
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
