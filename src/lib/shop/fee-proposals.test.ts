/**
 * The customer's own fee proposal, against `api-doc/customer/delivery-fee-changes.md`
 * § Propose your own delivery fee (ADR-A12).
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canProposeFee,
  ownProposalStage,
  parseWholeAmount,
  proposalLimitReached,
  reasonIsValid,
  type FeeShipment,
} from "./fee-proposals";
import type { DeliveryFeeProposal } from "./customer.types";

const PARCEL: FeeShipment = {
  shipmentId: "s1",
  status: "assigned",
  deliveryPayer: "customer",
  fee: 1500,
  customerFee: 1500,
  pendingProposalId: null,
};

const MINE: DeliveryFeeProposal = {
  id: "p1",
  shipmentId: "s1",
  orderId: "o1",
  raisedBy: "you",
  origin: "payer",
  acceptedByDeliveryCompany: false,
  direction: "decrease",
  currency: "XAF",
  feeBefore: 1500,
  proposedFee: 1000,
  reason: "Two streets from the depot",
  status: "pending",
  version: 1,
  topup: null,
  availableActions: ["withdraw", "edit"],
  respondedAt: null,
  createdAt: "2026-10-14T10:00:00.000Z",
};

test("the button shows on a customer-paid parcel, free, before pickup", () => {
  assert.equal(canProposeFee(PARCEL), true);
  assert.equal(canProposeFee({ ...PARCEL, status: "handing_over" }), true);
});

test("never on a parcel the shop pays for (422 …_NOT_PAYER)", () => {
  assert.equal(canProposeFee({ ...PARCEL, deliveryPayer: "vendor" }), false);
});

test("never while another fee change waits on the parcel", () => {
  assert.equal(canProposeFee({ ...PARCEL, pendingProposalId: "p0" }), false);
});

test("never outside the window — not yet with a company, or picked up", () => {
  for (const status of ["pending", "picked_up", "in_transit", "delivered", "cancelled"]) {
    assert.equal(canProposeFee({ ...PARCEL, status }), false, status);
  }
});

test("own unanswered proposal is `waiting`", () => {
  assert.equal(ownProposalStage(MINE), "waiting");
});

test("accepted, higher, online: `pay` — from topup + availableActions", () => {
  const accepted: DeliveryFeeProposal = {
    ...MINE,
    direction: "increase",
    proposedFee: 2500,
    acceptedByDeliveryCompany: true,
    topup: { amount: 1000, status: "awaiting_payment", paidAt: null },
    availableActions: ["pay", "reject"],
  };
  assert.equal(ownProposalStage(accepted), "pay");
});

test("answered, applied or withdrawn: `closed`", () => {
  for (const status of ["approved", "rejected", "withdrawn"] as const) {
    assert.equal(ownProposalStage({ ...MINE, status, availableActions: [] }), "closed", status);
  }
  // Paid already — the topup is no longer awaiting, so no pay button.
  assert.equal(
    ownProposalStage({
      ...MINE,
      status: "approved",
      topup: { amount: 1000, status: "paid", paidAt: "2026-10-14T11:00:00.000Z" },
      availableActions: [],
    }),
    "closed",
  );
});

test("someone else's proposal is not the customer's to edit", () => {
  assert.equal(ownProposalStage({ ...MINE, raisedBy: "delivery_company", origin: "agency" }), null);
  assert.equal(ownProposalStage({ ...MINE, raisedBy: "platform", origin: "change_agency" }), null);
});

test("two proposals per parcel; withdrawn ones do not count", () => {
  const declined = { ...MINE, id: "a", status: "rejected" as const, availableActions: [] };
  const accepted = { ...MINE, id: "b", status: "approved" as const, availableActions: [] };
  const withdrawn = { ...MINE, id: "c", status: "withdrawn" as const, availableActions: [] };
  assert.equal(proposalLimitReached([declined], "s1"), false);
  assert.equal(proposalLimitReached([declined, withdrawn, withdrawn], "s1"), false);
  assert.equal(proposalLimitReached([declined, accepted], "s1"), true);
  assert.equal(proposalLimitReached([declined, MINE], "s1"), true);
  // Another parcel's, or the delivery company's, are not the customer's to count.
  assert.equal(proposalLimitReached([declined, { ...accepted, shipmentId: "s2" }], "s1"), false);
  assert.equal(proposalLimitReached([declined, { ...accepted, raisedBy: "delivery_company", origin: "agency" }], "s1"), false);
});

test("amounts: whole numbers, with the separators people type", () => {
  assert.equal(parseWholeAmount("1000"), 1000);
  assert.equal(parseWholeAmount(" 1 000 "), 1000);
  assert.equal(parseWholeAmount("1.000"), 1000);
  assert.equal(parseWholeAmount("1,000"), 1000);
  assert.equal(parseWholeAmount("12 500"), 12500);
  assert.equal(parseWholeAmount("0"), 0);
});

test("amounts: anything that is not a whole amount reads as nothing", () => {
  for (const input of ["", " ", "12.5", "1,50", "-3", "1e3", "abc", "1 00", "10 000 0", "1234567890"]) {
    assert.equal(parseWholeAmount(input), null, JSON.stringify(input));
  }
});

test("reason: 3–500 characters once trimmed", () => {
  assert.equal(reasonIsValid("  ab  "), false);
  assert.equal(reasonIsValid("abc"), true);
  assert.equal(reasonIsValid("x".repeat(500)), true);
  assert.equal(reasonIsValid("x".repeat(501)), false);
});
