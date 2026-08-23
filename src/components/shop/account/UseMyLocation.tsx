"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/shop/ds";
import { resolveCurrentAddress } from "@/lib/native/location";
import type { GeoCandidate } from "@/lib/shop/customer.types";

/**
 * "Use my current location", and an honest sentence for every way it can fail.
 *
 * ── Why each outcome gets its own message ────────────────────────────────────
 *
 * The remedies genuinely differ, and a single "couldn't get your location"
 * sends people to the wrong one. A refusal this time can simply be asked again;
 * a permanent refusal cannot, and only Settings will undo it; location services
 * being off is a switch the shopper owns; and a geocoder with no address for a
 * real fix is not a failure of permission at all — it means "type it instead",
 * which is the one case where pointing at the search box is the right advice.
 *
 * ── The permission is requested here and only here ───────────────────────────
 *
 * Not at launch, not on mount — on the press. That is the only moment the
 * request explains itself, and it is what both app stores expect to see.
 */
export function UseMyLocation({
  onResolved,
}: {
  /** Handed the candidate, which is the same shape a picked search result is. */
  onResolved: (candidate: GeoCandidate) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const locate = useCallback(async () => {
    setBusy(true);
    setNote(null);

    const outcome = await resolveCurrentAddress();

    switch (outcome.status) {
      case "ok":
        onResolved(outcome.candidate);
        break;
      case "denied":
        setNote("Location access was declined. Tap again to allow it, or type your address above.");
        break;
      case "blocked":
        setNote(
          "Location is blocked for Wi-Mall. Turn it on in your phone's Settings, or type your address above.",
        );
        break;
      case "unavailable":
        setNote("We couldn't get a location fix. Check that location is switched on, or type your address above.");
        break;
      case "no-address":
        setNote("We found you, but there's no known address at that spot. Please type it above.");
        break;
      case "unsupported":
        // Only reachable by rendering this outside the app — the caller gates
        // on the build target, so in practice nobody sees it.
        setNote("Location isn't available here.");
        break;
    }

    setBusy(false);
  }, [onResolved]);

  return (
    <div style={{ marginTop: 8 }}>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon="locate-fixed"
        onClick={() => void locate()}
        disabled={busy}
      >
        {busy ? "Finding you…" : "Use my current location"}
      </Button>

      {note && (
        <p className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
          {note}
        </p>
      )}
    </div>
  );
}
