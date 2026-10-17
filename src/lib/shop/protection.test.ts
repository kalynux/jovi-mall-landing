/**
 * The `protection` block, against
 * `api-doc/customer/FRONTEND-CHANGELOG-wi-mall-protection.md`.
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TICKET_TYPE,
  heldPurchaseOf,
  PROBLEM_TICKET_TYPES,
  protectionViewOf,
  ticketPrefillOf,
  type CustomerProtection,
} from "./protection";
import { reportProblemPath } from "./shop.routes";

const STARTS = "2026-10-10T09:12:00.000Z";
const ENDS = "2026-10-13T09:12:00.000Z";

const ACTIVE: CustomerProtection = {
  days: 3,
  startsAt: STARTS,
  endsAt: ENDS,
  status: "active",
  onHold: false,
  problemReported: false,
};

test("not delivered yet: nothing to show", () => {
  assert.deepEqual(
    protectionViewOf({ ...ACTIVE, startsAt: null, endsAt: null, status: "not_started" }),
    { kind: "none" },
  );
});

test("delivered, inside the window: the deadline is `endsAt`, verbatim", () => {
  assert.deepEqual(protectionViewOf(ACTIVE), { kind: "active", endsAt: ENDS });
});

test("the customer's own report: on hold, and no deadline", () => {
  assert.deepEqual(
    protectionViewOf({ ...ACTIVE, endsAt: null, onHold: true, problemReported: true }),
    { kind: "on_hold" },
  );
});

test("on hold for another reason (a refund, a card dispute): nothing special", () => {
  assert.deepEqual(
    protectionViewOf({ ...ACTIVE, endsAt: null, onHold: true, problemReported: false }),
    { kind: "none" },
  );
});

test("the window is over: the after-protection notice, with its date", () => {
  assert.deepEqual(protectionViewOf({ ...ACTIVE, status: "ended" }), {
    kind: "ended",
    endsAt: ENDS,
  });
});

test("an older API, or a booking completed before 2026-10-10: nothing", () => {
  assert.deepEqual(protectionViewOf(undefined), { kind: "none" });
  assert.deepEqual(protectionViewOf(null), { kind: "none" });
  assert.deepEqual(
    protectionViewOf({ ...ACTIVE, startsAt: null, endsAt: null, status: "not_started" }),
    { kind: "none" },
  );
});

test("a notice is never drawn without the date its sentence needs", () => {
  assert.deepEqual(protectionViewOf({ ...ACTIVE, status: "ended", endsAt: null }), {
    kind: "none",
  });
  assert.deepEqual(
    protectionViewOf({ ...ACTIVE, status: "paused" as CustomerProtection["status"] }),
    { kind: "none" },
  );
});

test("every default ticket type is a problem type — a complaint holds the payment", () => {
  for (const type of Object.values(DEFAULT_TICKET_TYPE)) {
    assert.ok(PROBLEM_TICKET_TYPES.includes(type), type);
  }
  assert.equal(DEFAULT_TICKET_TYPE.ORDER, "ORDER_ISSUE");
  assert.equal(DEFAULT_TICKET_TYPE.BOOKING, "BOOKING_ISSUE");
});

test("the types that hold nothing are not problem types", () => {
  for (const type of ["INVOICE_REQUEST", "ADDRESS_CHANGE", "BOOKING_RESCHEDULE", "POLICY_QUESTION"]) {
    assert.ok(!(PROBLEM_TICKET_TYPES as readonly string[]).includes(type), type);
  }
});

test("the report link round-trips through the form's query string", () => {
  for (const [about, id] of [
    ["ORDER", "664ord0000000000000000aa"],
    ["BOOKING", "664bkg0000000000000000bb"],
  ] as const) {
    const query = reportProblemPath(about, id).split("?")[1];
    assert.deepEqual(ticketPrefillOf(new URLSearchParams(query)), {
      entityType: about,
      entityId: id,
    });
  }
});

test("a form opened on its own, or with a subject it cannot prefill, starts empty", () => {
  assert.equal(ticketPrefillOf(new URLSearchParams("")), null);
  assert.equal(ticketPrefillOf(new URLSearchParams("about=ORDER")), null);
  assert.equal(ticketPrefillOf(new URLSearchParams("about=ORDER&id=%20")), null);
  assert.equal(ticketPrefillOf(new URLSearchParams("about=VENDOR&id=abc")), null);
});

test("a parcel's ticket speaks of the order; a booking's of the booking", () => {
  assert.equal(heldPurchaseOf("ORDER"), "order");
  assert.equal(heldPurchaseOf("SHIPMENT"), "order");
  assert.equal(heldPurchaseOf("BOOKING"), "booking");
});
