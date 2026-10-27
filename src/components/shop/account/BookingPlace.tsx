"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Icon, type IconName } from "@/components/shop/ds";
import { openExternal } from "@/lib/native/links";
import { bookingPayPath } from "@/lib/shop/shop.routes";
import {
  getBooking,
  type Booking,
  type BookingAccess,
  type BookingLocation,
  type ServiceLocationKind,
} from "@/lib/shop/bookings.api";
import { AccountCard } from "./AccountShell";

/**
 * Where an appointment happens, and the way in — `location` and `access` on
 * the booking read (2026-10-26).
 *
 * ── The address is the vendor's to reveal ────────────────────────────────────
 *
 * A `vendor_address` booking carries no address lines until the vendor
 * accepts it (`addressVisible: false` while `pending`), so the row says when it
 * will appear rather than drawing an empty line. The customer's own address
 * (`customer_address`) is always there.
 *
 * ── The link is never read from a locked block ───────────────────────────────
 *
 * `meetingUrl` and `instructions` are sent ONLY when `access.state` is `open`.
 * While locked they are absent, and `hasMeetingUrl` / `hasInstructions` say
 * what is coming. Nothing pushes the link at `opensAt`: the server decides on
 * each read, so `too_early` counts down and then re-reads the booking.
 */

const KIND_ICON: Record<ServiceLocationKind, IconName> = {
  vendor_address: "store",
  customer_address: "navigation",
  online: "monitor-smartphone",
};

export function locationIcon(location: BookingLocation): IconName {
  return KIND_ICON[location.kind] ?? "map-pin";
}

function addressText(location: BookingLocation): string | null {
  if (location.formattedAddress) return location.formattedAddress;
  const parts = [location.addressLine1, location.addressLine2, location.city, location.state]
    .filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(", ") : null;
}

/** The "Where" row's value: what kind of place, then the address and a map link. */
export function BookingPlaceValue({ location }: { location: BookingLocation }) {
  const t = useTranslations("shop.bookings.place");

  if (location.kind === "online") return <>{t("online")}</>;

  const address = location.addressVisible ? addressText(location) : null;
  // GeoJSON order is [longitude, latitude]; the maps query wants lat,lng.
  const coords = location.addressVisible ? location.coordinates : null;
  const mapHref =
    coords && coords.length === 2
      ? `https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`
      : address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
        : null;

  return (
    <span style={{ display: "grid", gap: 2 }}>
      <span>{t(location.kind === "customer_address" ? "atYourAddress" : "atTheShop")}</span>
      {location.label && address && <span style={{ fontWeight: 700 }}>{location.label}</span>}
      {address ? (
        <span className="ds-ugc">{address}</span>
      ) : (
        location.kind === "vendor_address" && (
          <span className="muted" style={{ fontSize: 13 }}>
            {t("addressAfterConfirm")}
          </span>
        )
      )}
      {mapHref && (
        <button
          type="button"
          onClick={() => void openExternal(mapHref)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            minHeight: 44,
            padding: 0,
            border: "none",
            background: "none",
            color: "var(--brand-hover)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            justifySelf: "start",
          }}
        >
          <Icon name="map-pin" size={14} />
          {t("openMap")}
        </button>
      )}
    </span>
  );
}

/**
 * The meeting link and the vendor's instructions.
 *
 * Draws nothing for `closed` (ended or cancelled), for a `locked` block whose
 * reason is `ended`, and when the vendor set neither (`access: null`).
 */
export function BookingAccessPanel({
  booking,
  onRefreshed,
}: {
  booking: Booking;
  onRefreshed: (next: Booking) => void;
}) {
  const access = booking.access;
  if (!access || access.state === "closed" || access.reason === "ended") return null;
  if (access.state === "open") return <OpenAccess access={access} />;
  return <LockedAccess booking={booking} access={access} onRefreshed={onRefreshed} />;
}

function OpenAccess({ access }: { access: BookingAccess }) {
  const t = useTranslations("shop.bookings.access");
  const url = access.meetingUrl ?? null;
  const instructions = access.instructions ?? null;
  if (!url && !instructions) return null;

  return (
    <AccountCard style={{ padding: 16, borderColor: "var(--success-border)" }}>
      <section aria-labelledby="booking-access-heading" style={{ display: "grid", gap: 12 }}>
        <h2
          id="booking-access-heading"
          style={{ fontSize: 15.5, fontWeight: 800, margin: 0, color: "var(--text-strong)" }}
        >
          {url ? t("openTitle") : t("instructionsTitle")}
        </h2>
        {url && (
          <Button
            block
            size="lg"
            elevated
            trailingIcon="external-link"
            onClick={() => void openExternal(url)}
          >
            {t("join")}
          </Button>
        )}
        {instructions && (
          <div>
            {url && <div className="ds-overline" style={{ marginBottom: 4 }}>{t("instructionsTitle")}</div>}
            {/* The vendor's own words: kept as typed, line breaks and all. */}
            <p
              className="ds-ugc"
              style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {instructions}
            </p>
          </div>
        )}
      </section>
    </AccountCard>
  );
}

function LockedAccess({
  booking,
  access,
  onRefreshed,
}: {
  booking: Booking;
  access: BookingAccess;
  onRefreshed: (next: Booking) => void;
}) {
  const t = useTranslations("shop.bookings.access");
  const format = useFormatter();
  const router = useRouter();

  const coming =
    access.hasMeetingUrl && access.hasInstructions
      ? "comingBoth"
      : access.hasMeetingUrl
        ? "comingLink"
        : access.hasInstructions
          ? "comingInstructions"
          : null;

  let body: ReactNode;
  if (access.reason === "too_early" && access.opensAt) {
    body = (
      <>
        <p style={{ margin: 0, fontSize: 14 }}>
          {t(access.hasMeetingUrl || !access.hasInstructions ? "opensAtLink" : "opensAtInstructions", {
            time: format.dateTime(new Date(access.opensAt), {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </p>
        <Countdown
          key={access.opensAt}
          opensAt={access.opensAt}
          bookingId={booking.id}
          onRefreshed={onRefreshed}
          access={access}
        />
      </>
    );
  } else if (access.reason === "not_paid") {
    const payable =
      booking.requiresPayment &&
      (booking.paymentStatus === "unpaid" || booking.paymentStatus === "failed");
    body = payable ? (
      <Button block leadingIcon="wallet" onClick={() => router.push(bookingPayPath(booking.id))}>
        {t("payToUnlock")}
      </Button>
    ) : (
      <p style={{ margin: 0, fontSize: 14 }}>
        {booking.paymentStatus === "pending" ? t("unlocksWhenPaymentLands") : t("unlocksWhenVendorRecordsPayment")}
      </p>
    );
  } else {
    // `not_confirmed`, and any reason this build has never seen.
    body = <p style={{ margin: 0, fontSize: 14 }}>{t("afterVendorConfirms")}</p>;
  }

  return (
    <AccountCard style={{ padding: 16 }}>
      <section aria-labelledby="booking-access-heading" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="lock" size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <h2
            id="booking-access-heading"
            style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "var(--text-strong)" }}
          >
            {access.reason === "not_paid" ? t("payToUnlockTitle") : t("lockedTitle")}
          </h2>
        </div>
        {coming && (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {t(coming)}
          </p>
        )}
        {body}
      </section>
    </AccountCard>
  );
}

/** The largest delay `setTimeout` honours; anything longer fires at once. */
const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * Counts down to `opensAt`, then re-reads the booking. If the server still
 * says `too_early` (its clock and the phone's disagree), the new `access`
 * object re-runs the effect and it tries again 15 seconds later.
 */
function Countdown({
  opensAt,
  bookingId,
  access,
  onRefreshed,
}: {
  opensAt: string;
  bookingId: string;
  access: BookingAccess;
  onRefreshed: (next: Booking) => void;
}) {
  const t = useTranslations("shop.bookings.access");
  const format = useFormatter();
  const target = Date.parse(opensAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const due = target - Date.now();
    const delay = due > 0 ? Math.min(due + 1000, MAX_TIMEOUT) : 15_000;
    const id = setTimeout(() => {
      getBooking(bookingId)
        .then(onRefreshed)
        .catch(() => {
          /* the next tick, or a reload, tries again */
        });
    }, delay);
    return () => clearTimeout(id);
  }, [target, bookingId, onRefreshed, access]);

  const left = Math.max(0, target - now);
  if (left === 0) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {t("opening")}
      </p>
    );
  }

  // Under a day: a ticking clock. Further out: the locale's own "in 3 days",
  // which already carries its preposition — so a second message, not "in {x}".
  let label: string;
  if (left < 24 * 60 * 60 * 1000) {
    const total = Math.floor(left / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    label = t("opensIn", { countdown: h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}` });
  } else {
    label = t("opensRelative", { when: format.relativeTime(new Date(target), new Date(now)) });
  }

  return (
    <p
      className="muted"
      aria-live="off"
      style={{ margin: 0, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
    >
      <Icon name="clock" size={14} />
      <span>{label}</span>
    </p>
  );
}
