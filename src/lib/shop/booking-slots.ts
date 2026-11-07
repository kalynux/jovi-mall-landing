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
 * What a tap on `tapped` does to the current run, when the run's length is
 * the customer's to choose. `remembered` is what the previous tap returned.
 *
 *   1. A LATER time: the run ends there, when every slot between is free.
 *   2. An EARLIER time: the run starts there and keeps its end, likewise.
 *   3. A time INSIDE the run: the run ends there (its first slot collapses it
 *      to that one slot).
 *   4. The run's END tapped again: the run starts there instead, and ends
 *      where it ended before rule 3 shortened it. So 9:30–11:00, tap 10:00 →
 *      9:30–10:15, tap 10:00 again → 10:00–11:00. With nothing remembered, it
 *      becomes a one-slot run.
 *   5. The only slot of a one-slot run: nothing is chosen any more.
 *
 * Rules 1 and 2 fall back to a new one-slot run at the tap when the slots in
 * between are not all free, or the run would pass `maxSlots`.
 *
 * Double-tapping was considered for rule 4 and rejected: phones do not report
 * it reliably, waiting for a second tap delays every single one, and nobody
 * would find it. The calendar's hint names the time to tap instead.
 *
 * `remembered` is the run as it was before rule 3 last shortened it, kept
 * across further shortenings of the same run, and dropped by anything else.
 */
export function runAfterFreeTap(
  daySlots: readonly Slot[],
  current: readonly string[],
  tapped: string,
  maxSlots: number,
  remembered: readonly string[] | null = null,
): { run: string[]; remembered: string[] | null } {
  const ids = daySlots.map((s) => s.id);
  const tapAt = ids.indexOf(tapped);
  if (tapAt < 0) return { run: [...current], remembered: remembered ? [...remembered] : null };

  /** The run from slot index `from` to slot index `to`, when it is bookable as one. */
  const span = (from: number, to: number): string[] | null => {
    const length = to - from + 1;
    if (length < 1 || length > maxSlots) return null;
    const run = runFrom(daySlots, ids[from], length);
    return run ? run.map((s) => s.id) : null;
  };
  const single = (): { run: string[]; remembered: null } => ({
    run: daySlots[tapAt].available ? [tapped] : [...current],
    remembered: null,
  });

  const startAt = current.length > 0 ? ids.indexOf(current[0]) : -1;
  const endAt = current.length > 0 ? ids.indexOf(current[current.length - 1]) : -1;
  if (startAt < 0 || endAt < 0) return single();

  // 5. The one chosen slot, tapped again.
  if (current.length === 1 && tapAt === startAt) return { run: [], remembered: null };

  // 4. The end, tapped again.
  if (tapAt === endAt) {
    const before = remembered ? ids.indexOf(remembered[remembered.length - 1]) : -1;
    const restored = before > tapAt ? span(tapAt, before) : null;
    return { run: restored ?? [tapped], remembered: null };
  }

  // 3. Inside the run.
  if (tapAt >= startAt && tapAt < endAt) {
    if (tapAt === startAt) return { run: [tapped], remembered: null };
    // Shortening an already-shortened run keeps the longer original.
    const keep =
      remembered && remembered[0] === current[0] && remembered.length > current.length
        ? [...remembered]
        : [...current];
    return { run: current.slice(0, tapAt - startAt + 1), remembered: keep };
  }

  // 1. Later.
  if (tapAt > endAt) {
    const run = span(startAt, tapAt);
    return run ? { run, remembered: null } : single();
  }

  // 2. Earlier.
  const run = span(tapAt, endAt);
  return run ? { run, remembered: null } : single();
}

/**
 * What a tap on `tapped` does to the current run.
 *
 * - With a fixed `count` (moving an appointment, which keeps its length): the
 *   run of that count starting at the tap, or the current run unchanged when
 *   the tap cannot start one.
 * - Otherwise, {@link runAfterFreeTap} with nothing remembered.
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
  return runAfterFreeTap(daySlots, current, tapped, maxSlots).run;
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
