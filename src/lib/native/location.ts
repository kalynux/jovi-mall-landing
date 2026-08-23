"use client";

import { isNative, isAndroid } from "@/lib/platform";
import { reverseGeocode } from "@/lib/shop/addresses.api";
import type { GeoCandidate } from "@/lib/shop/customer.types";

/**
 * "Use my current location" — the one native capability that removes a real
 * checkout failure rather than polishing one.
 *
 * ── Why this is worth a permission ───────────────────────────────────────────
 *
 * Checkout **refuses** a delivery address that has no coordinates:
 * `422 ORDER_DELIVERY_ADDRESS_REQUIRED` with
 * `details.reason: "selected_address_not_geocoded"`. The only way to get them
 * today is to type into `GET /api/geo/search` and pick a candidate from the
 * list — which assumes the shopper can name where they live in terms the
 * geocoder recognises. In Douala and Yaoundé that assumption fails often: a lot
 * of real addresses are landmarks and quartier names, not street numbers, and a
 * shopper who cannot produce a match cannot check out at all.
 *
 * A coordinate from the handset skips the naming problem entirely. It is fed to
 * `GET /api/geo/reverse`, which returns the same `GeoCandidate` shape the search
 * picker already produces — so the address that results is stored, validated and
 * priced by exactly the same code path, with no special case anywhere
 * downstream.
 *
 * ── The permission is requested here, at the tap, and nowhere else ───────────
 *
 * Never at launch. This runs when the shopper presses "Use my current location",
 * which is the only moment the request is explicable — and it is the moment both
 * app stores expect it.
 */

/**
 * What happened, in terms a caller can write a message from.
 *
 * Every failure is named rather than collapsed, because the remedies genuinely
 * differ: `denied` can be retried, `blocked` cannot be and needs Settings,
 * `no-address` means the GPS worked and the geocoder had nothing there.
 */
export type LocationOutcome =
  | { status: "ok"; candidate: GeoCandidate }
  /** Refused this time. Asking again is allowed. */
  | { status: "denied" }
  /** Refused permanently, or blocked by device policy — only Settings can undo it. */
  | { status: "blocked" }
  /** Location services are switched off, or the fix timed out. */
  | { status: "unavailable" }
  /** A real fix, but the geocoder has no address for it. */
  | { status: "no-address" }
  /** Not a device, so there is nothing to ask. */
  | { status: "unsupported" };

/**
 * Ten seconds, and a coarse fix is accepted.
 *
 * `enableHighAccuracy` is deliberately off: it wakes the GPS radio and can take
 * 30+ seconds under cloud or indoors, and the answer is being handed to a
 * geocoder that resolves to a street or a quartier anyway. Network location is
 * accurate to well within that and returns in about a second.
 */
/**
 * ── The timeout is 30s because a coarse fix is slow, not because we are ─────
 *
 * This was 10s, and on a real handset that is not enough: the plugin answered
 * "Could not obtain location in time. Try with a higher timeout." every single
 * time, which the caller reported as "we could not get a location fix" — a
 * message that sent the shopper to check a setting that was already on.
 *
 * `enableHighAccuracy: false` asks Android for the NETWORK provider rather than
 * GPS. That is the right choice for a delivery address — it works indoors and
 * costs almost no battery — but a cold network fix routinely takes 15s or more,
 * especially on cellular, which is the connection this product targets. The two
 * settings have to be consistent: asking for the slow provider and then giving
 * it a fast deadline is asking for the failure we shipped.
 *
 * `maximumAge` is what keeps the common case instant — a fix from the last
 * minute is reused and the timeout never comes into it.
 */
const FIX_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 30_000,
  maximumAge: 60_000,
} as const;

export async function resolveCurrentAddress(): Promise<LocationOutcome> {
  if (!isNative()) return { status: "unsupported" };

  let coords: { latitude: number; longitude: number };

  try {
    const { Geolocation } = await import("@capacitor/geolocation");

    /**
     * Asked for explicitly rather than relying on `getCurrentPosition` to
     * prompt, so a refusal is distinguishable from a timeout — the two need
     * different messages and one of them is not the user's fault.
     *
     * ── It must be `coarseLocation`, and that is not a detail ─────────────
     *
     * This asked for `"location"` — the FINE permission — and then checked
     * `permission.location`. The manifest deliberately declares only
     * `ACCESS_COARSE_LOCATION` (a shop needs a neighbourhood, not a doorstep),
     * so Android can never grant the fine one: it answers
     *
     *     { coarseLocation: "granted", location: "denied" }
     *
     * even when the shopper has just tapped Allow. The check therefore read a
     * permanent "denied" every time and **"Use my current location" could not
     * succeed on Android at all** — verified on a device, where the plugin
     * returned a perfectly good fix the moment it was asked directly.
     *
     * The two settings have to agree. `FIX_OPTIONS` already sets
     * `enableHighAccuracy: false`, which is the same decision expressed at the
     * other end; this is the half that was out of step.
     */
    const permission = await Geolocation.requestPermissions({ permissions: ["coarseLocation"] });

    if (permission.coarseLocation === "denied") {
      /**
       * Android reports `denied` for both "not now" and "never ask again", and
       * gives no way to tell them apart from here; iOS reports `denied` only
       * once the choice is permanent. So Android is reported as retryable and
       * iOS as needing Settings — which is right far more often than either
       * answer applied to both.
       */
      return { status: isAndroid() ? "denied" : "blocked" };
    }

    const position = await Geolocation.getCurrentPosition(FIX_OPTIONS);
    coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    // Location services off at the OS level, no fix within the timeout, or a
    // bridge that refused. All three mean "we could not get a position", and
    // all three are retryable.
    return { status: "unavailable" };
  }

  const candidate = await reverseGeocode(coords.latitude, coords.longitude);
  return candidate ? { status: "ok", candidate } : { status: "no-address" };
}
