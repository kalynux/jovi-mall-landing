/**
 * Choosing a time for a service — the arithmetic behind the booking calendar.
 *
 * Pure functions over the availability read, so the panel and the reschedule
 * screen pick times by one set of rules and neither has to re-derive them.
 *
 * ── An appointment is a RUN of slots ─────────────────────────────────────────
 *
 * Since 2026-10-26 a customer may book several consecutive slots as one
 * appointment. "Consecutive" is exact: each slot starts at the instant the
 * previous one ends, and every one is bookable. A gap in the grid — a lunch
 * break, an appointment somebody else holds — ends the run, which is the same
 * rule the API applies (`BOOKING_INVALID_SLOT_ID` `not_contiguous`).
 *
 * ── Days are the DISPLAY time zone's days ────────────────────────────────────
 *
 * Every date on screen is formatted in next-intl's configured zone, so slots
 * are grouped by that zone's calendar day too. Grouping by the browser's own
 * day would file a 23:30 slot under one date and label it with the next.
 */
import type { Slot } from "./bookings.api";

/** `YYYY-MM-DD` of an instant, in `timeZone`. */
export function dayKeyOf(instant: string | Date, timeZone: string): string {
  // `en-CA` formats a date as YYYY-MM-DD; only the digits are read.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

/** Slots grouped by display day, each day's slots in time order. */
export function slotsByDay(slots: readonly Slot[], timeZone: string): Map<string, Slot[]> {
  const sorted = [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const map = new Map<string, Slot[]>();
  for (const slot of sorted) {
    const key = dayKeyOf(slot.start, timeZone);
    const list = map.get(key);
    if (list) list.push(slot);
    else map.set(key, [slot]);
  }
  return map;
}

/** `b` starts exactly where `a` ends. */
export function follows(a: Slot, b: Slot): boolean {
  return Date.parse(b.start) === Date.parse(a.end);
}

/**
 * Group-class slots carry a seat count; single-occupancy ones never do. A class
 * is booked one session at a time, so it caps a run at one slot.
 */
export function isGroupService(slots: readonly Slot[]): boolean {
  return slots.some((s) => s.spotsRemaining !== undefined);
}

/**
 * The run of exactly `count` bookable slots starting at `startId` within one
 * day's slots, or `null` when the day cannot supply it.
 */
export function runFrom(daySlots: readonly Slot[], startId: string, count: number): Slot[] | null {
  const at = daySlots.findIndex((s) => s.id === startId);
  if (at < 0 || count < 1) return null;
  const run: Slot[] = [];
  for (let i = at; i < daySlots.length && run.length < count; i++) {
    const slot = daySlots[i];
    if (!slot.available) return null;
    if (run.length > 0 && !follows(run[run.length - 1], slot)) return null;
    run.push(slot);
  }
  return run.length === count ? run : null;
}

/** How many slots a run starting at `startId` can reach, up to `cap`. */
export function longestRunFrom(daySlots: readonly Slot[], startId: string, cap: number): number {
  let n = 0;
  while (n < cap && runFrom(daySlots, startId, n + 1)) n++;
  return n;
}

/**
 * What a tap on `tapped` does to the current run.
 *
 * - With a fixed `count` (moving an appointment, which keeps its length): the
 *   run of that count starting at the tap, or the current run unchanged when
 *   the tap cannot start one.
 * - Otherwise, the run is shaped by taps: a later slot reachable without a gap
 *   EXTENDS it to that slot; a slot inside it SHORTENS it to end there (its
 *   first slot collapses it to one); anything else STARTS a new one-slot run.
 */
export function runAfterTap(
  daySlots: readonly Slot[],
  current: readonly string[],
  tapped: string,
  options: { maxSlots: number; count?: number },
): string[] {
  const { maxSlots, count } = options;
  if (count !== undefined) {
    const run = runFrom(daySlots, tapped, count);
    return run ? run.map((s) => s.id) : [...current];
  }

  const ids = daySlots.map((s) => s.id);
  const startAt = current.length > 0 ? ids.indexOf(current[0]) : -1;
  const tapAt = ids.indexOf(tapped);
  if (tapAt < 0) return [...current];

  if (startAt >= 0) {
    const inside = current.indexOf(tapped);
    if (inside === 0) return [tapped];
    if (inside > 0) return current.slice(0, inside + 1);

    const length = tapAt - startAt + 1;
    if (tapAt > startAt && length <= maxSlots) {
      const run = runFrom(daySlots, current[0], length);
      if (run) return run.map((s) => s.id);
    }
  }

  return daySlots[tapAt].available ? [tapped] : [...current];
}

/** Where a run of slot ids starts and ends, and how many slots it is — `null` for an empty run. */
export function runBounds(
  daySlots: readonly Slot[],
  run: readonly string[],
): { start: string; end: string; count: number } | null {
  if (run.length === 0) return null;
  const first = daySlots.find((s) => s.id === run[0]);
  const last = daySlots.find((s) => s.id === run[run.length - 1]);
  if (!first || !last) return null;
  return { start: first.start, end: last.end, count: run.length };
}

/** Whole minutes in a slot. */
export function slotMinutes(slot: Slot): number {
  return Math.round((Date.parse(slot.end) - Date.parse(slot.start)) / 60_000);
}

/**
 * A duration as the message key and values that say it — `1 h`, `45 min`,
 * `1 h 30 min`. The units are translated messages, never glued here.
 */
export function durationParts(minutes: number): {
  key: "durationMinutes" | "durationHours" | "durationHoursMinutes";
  values: { h: number; m: number };
} {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return {
    key: h === 0 ? "durationMinutes" : m === 0 ? "durationHours" : "durationHoursMinutes",
    values: { h, m },
  };
}
