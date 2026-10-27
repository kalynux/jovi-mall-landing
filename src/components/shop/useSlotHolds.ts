"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/auth/auth.types";
import { lockSlot, releaseSlot } from "@/lib/shop/bookings.api";

/**
 * Keeps the server-side holds in step with the run of slots on screen.
 *
 * ── Every slot of a run is held on its own ───────────────────────────────────
 *
 * A hold is per slot (`POST .../slots/:slotId/lock`, 15 minutes), and the API
 * asserts each slot of a run is held by the caller before it books or moves
 * anything. So growing a run holds the new slots, shrinking it gives the
 * dropped ones back, and starting a new run gives back all of the old one —
 * a slot this screen is not offering must not stay closed to other shoppers.
 *
 * When a slot cannot be held, the run is cut back to the part that is: its
 * longest held prefix. Holding the slots AFTER a gap would describe a run the
 * API refuses, and dropping the whole run would throw away a start time the
 * customer still has.
 *
 * `release` is idempotent server-side, so giving back on unmount is safe
 * whether or not anything is still held.
 */
export function useSlotHolds(productId: string | null) {
  /**
   * slot id → hold expiry (ISO). Mirrored in a ref, written beside every state
   * update, for the unmount cleanup and for a call that follows another before
   * React has re-rendered.
   */
  const [held, setHeld] = useState<ReadonlyMap<string, string>>(() => new Map());
  const heldRef = useRef<ReadonlyMap<string, string>>(held);

  useEffect(() => {
    return () => {
      if (!productId) return;
      for (const id of heldRef.current.keys()) void releaseSlot(productId, id);
    };
  }, [productId]);

  /**
   * Hold exactly `next`. Resolves to the run actually held — `next` itself, or
   * its longest held prefix — plus the refusal code when one slot was refused.
   */
  const holdRun = useCallback(
    async (next: readonly string[]): Promise<{ run: string[]; refusal?: string }> => {
      if (!productId) return { run: [] };
      const before = heldRef.current;
      const wanted = new Set(next);

      await Promise.all(
        [...before.keys()].filter((id) => !wanted.has(id)).map((id) => releaseSlot(productId, id)),
      );

      const after = new Map([...before].filter(([id]) => wanted.has(id)));
      let refusal: string | undefined;
      const results = await Promise.allSettled(
        next.filter((id) => !after.has(id)).map(async (id) => {
          const lock = await lockSlot(productId, id);
          return { id, expiresAt: lock.expiresAt };
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled") after.set(r.value.id, r.value.expiresAt);
        else refusal ??= r.reason instanceof ApiError ? r.reason.code : "HOLD_FAILED";
      }

      let run = [...next];
      const gap = run.findIndex((id) => !after.has(id));
      if (gap >= 0) {
        run = run.slice(0, gap);
        const kept = new Set(run);
        for (const id of [...after.keys()]) {
          if (!kept.has(id)) {
            void releaseSlot(productId, id);
            after.delete(id);
          }
        }
      }

      heldRef.current = after;
      setHeld(after);
      return { run, refusal };
    },
    [productId],
  );

  /** The booking (or move) consumed the holds — nothing to give back. */
  const forget = useCallback(() => {
    heldRef.current = new Map();
    setHeld(new Map());
  }, []);

  /** The earliest expiry across the run: the run lapses when its first hold does. */
  const expiresAt =
    held.size === 0
      ? null
      : [...held.values()].reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));

  return { held, expiresAt, holdRun, forget };
}
