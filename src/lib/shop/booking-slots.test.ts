import { test } from "node:test";
import assert from "node:assert/strict";
import { runAfterFreeTap, runAfterTap } from "./booking-slots";
import type { Slot } from "./bookings.api";

/** 15-minute slots from 09:00 to 12:00 UTC, ids by their start ("0930"). */
function day(taken: string[] = []): Slot[] {
  const slots: Slot[] = [];
  for (let m = 9 * 60; m < 12 * 60; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const endM = m + 15;
    const eh = String(Math.floor(endM / 60)).padStart(2, "0");
    const em = String(endM % 60).padStart(2, "0");
    const id = `${hh}${mm}`;
    slots.push({
      id,
      start: `2026-11-10T${hh}:${mm}:00Z`,
      end: `2026-11-10T${eh}:${em}:00Z`,
      available: !taken.includes(id),
    });
  }
  return slots;
}

/** 09:30 → 11:00, the run in the request: six slots, the last one starting 10:45. */
const NINE_THIRTY_TO_ELEVEN = ["0930", "0945", "1000", "1015", "1030", "1045"];
const MAX = 24;

test("the owner's case: 9:30–11:00, tap 10:00, tap 10:00 again → 10:00–11:00", () => {
  const slots = day();
  const first = runAfterFreeTap(slots, NINE_THIRTY_TO_ELEVEN, "1000", MAX);
  assert.deepEqual(first.run, ["0930", "0945", "1000"]);
  assert.deepEqual(first.remembered, NINE_THIRTY_TO_ELEVEN);

  const second = runAfterFreeTap(slots, first.run, "1000", MAX, first.remembered);
  assert.deepEqual(second.run, ["1000", "1015", "1030", "1045"]);
  assert.equal(second.remembered, null);
});

test("a later time extends the end", () => {
  const { run } = runAfterFreeTap(day(), ["0930"], "1000", MAX);
  assert.deepEqual(run, ["0930", "0945", "1000"]);
});

test("an earlier time moves the start and keeps the end", () => {
  const { run } = runAfterFreeTap(day(), ["1000", "1015"], "0930", MAX);
  assert.deepEqual(run, ["0930", "0945", "1000", "1015"]);
});

test("a taken slot in between starts a fresh run at the tap, either way", () => {
  const slots = day(["0945"]);
  assert.deepEqual(runAfterFreeTap(slots, ["1000", "1015"], "0930", MAX).run, ["0930"]);
  assert.deepEqual(runAfterFreeTap(slots, ["0900", "0915"], "1000", MAX).run, ["1000"]);
});

test("the cap holds both ways", () => {
  assert.deepEqual(runAfterFreeTap(day(), ["0930"], "1000", 2).run, ["1000"]);
  assert.deepEqual(runAfterFreeTap(day(), ["1000"], "0930", 2).run, ["0930"]);
});

test("the end tapped with nothing remembered becomes a one-slot run there", () => {
  const { run } = runAfterFreeTap(day(), ["0930", "0945", "1000"], "1000", MAX);
  assert.deepEqual(run, ["1000"]);
});

test("shortening twice still remembers the original end", () => {
  const slots = day();
  const a = runAfterFreeTap(slots, NINE_THIRTY_TO_ELEVEN, "1030", MAX);
  const b = runAfterFreeTap(slots, a.run, "1000", MAX, a.remembered);
  assert.deepEqual(b.remembered, NINE_THIRTY_TO_ELEVEN);
  const c = runAfterFreeTap(slots, b.run, "1000", MAX, b.remembered);
  assert.deepEqual(c.run, ["1000", "1015", "1030", "1045"]);
});

test("a slot taken since the shortening falls back to a one-slot run", () => {
  const first = runAfterFreeTap(day(), NINE_THIRTY_TO_ELEVEN, "1000", MAX);
  const second = runAfterFreeTap(day(["1030"]), first.run, "1000", MAX, first.remembered);
  assert.deepEqual(second.run, ["1000"]);
});

test("the first slot of a longer run collapses it to that slot", () => {
  const { run } = runAfterFreeTap(day(), ["0930", "0945", "1000"], "0930", MAX);
  assert.deepEqual(run, ["0930"]);
});

test("the only chosen slot, tapped again, is let go", () => {
  assert.deepEqual(runAfterFreeTap(day(), ["0930"], "0930", MAX).run, []);
  // A group class allows one slot at a time; the same tap lets it go too.
  assert.deepEqual(runAfterFreeTap(day(), ["0930"], "0930", 1).run, []);
});

test("nothing chosen: a tap chooses that slot, a taken one is ignored", () => {
  assert.deepEqual(runAfterFreeTap(day(), [], "1000", MAX).run, ["1000"]);
  assert.deepEqual(runAfterFreeTap(day(["1000"]), [], "1000", MAX).run, []);
});

test("a fixed length (moving an appointment) is unchanged", () => {
  assert.deepEqual(runAfterTap(day(), ["0930", "0945"], "1100", { maxSlots: 2, count: 2 }), ["1100", "1115"]);
  assert.deepEqual(runAfterTap(day(), ["0930", "0945"], "1145", { maxSlots: 2, count: 2 }), ["0930", "0945"]);
});
