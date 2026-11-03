import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agreedPrice,
  changedFromPrice,
  declinedPriceWaivesPolicy,
  openPriceProposal,
  priceDropRefunds,
  settledBalanceOwed,
  type BookingPricing,
  type BookingPriceProposalStatus,
} from "./booking-pricing";

const proposal = (status: BookingPriceProposalStatus) => ({
  status,
  amount: 7000,
  previousAmount: 5000,
  expiresAt: "2026-11-10T09:00:00.000Z",
});

const pricing = (over: Partial<BookingPricing> = {}): BookingPricing => ({
  originalPrice: 5000,
  currentPrice: 5000,
  amountPaid: 0,
  proposal: null,
  topup: null,
  ...over,
});

const booking = (over: Partial<BookingPricing> | null, status = "pending", priceSnapshot = 5000) => ({
  status,
  priceSnapshot,
  pricing: over === null ? undefined : pricing(over),
});

test("the price is the block's, and the snapshot only stands in for an older API", () => {
  assert.equal(agreedPrice(booking({ currentPrice: 7000 }, "confirmed", 1)), 7000);
  assert.equal(agreedPrice(booking(null, "confirmed", 5000)), 5000);
});

test("the booked price shows only when it differs from the agreed one", () => {
  assert.equal(changedFromPrice(booking({})), null);
  assert.equal(changedFromPrice(booking(null)), null);
  assert.equal(changedFromPrice(booking({ currentPrice: 7000 })), 5000);
});

test("only an open proposal asks for an answer", () => {
  assert.equal(openPriceProposal(booking({ proposal: proposal("open") }))?.amount, 7000);
  for (const status of ["accepted", "declined", "withdrawn", "lapsed"] as const) {
    assert.equal(openPriceProposal(booking({ proposal: proposal(status) })), null, status);
  }
  assert.equal(openPriceProposal(booking(null)), null);
});

test("a declined price waives the policy only until the vendor confirms", () => {
  const declined = { proposal: proposal("declined") };
  assert.equal(declinedPriceWaivesPolicy(booking(declined, "pending")), true);
  assert.equal(declinedPriceWaivesPolicy(booking(declined, "confirmed")), false);
  assert.equal(declinedPriceWaivesPolicy(booking({ proposal: proposal("open") }, "pending")), false);
  assert.equal(declinedPriceWaivesPolicy(booking(null, "pending")), false);
});

test("a new price refunds only when it is below what was paid", () => {
  assert.equal(priceDropRefunds(booking({ amountPaid: 7000 }), 6000), true);
  assert.equal(priceDropRefunds(booking({ amountPaid: 7000 }), 7000), false);
  assert.equal(priceDropRefunds(booking({ amountPaid: 5000 }), 6000), false);
  // Unpaid: nothing to send back, whatever the new price is.
  assert.equal(priceDropRefunds(booking({ amountPaid: 0 }), 6000), false);
  assert.equal(priceDropRefunds(booking(null), 6000), false);
});

test("a price difference never reads as a settled balance", () => {
  assert.equal(settledBalanceOwed({ outstanding: 2000, topupDue: 2000 }), 0);
  assert.equal(settledBalanceOwed({ outstanding: 9500, topupDue: 2000 }), 7500);
  assert.equal(settledBalanceOwed({ outstanding: 7500, topupDue: 0 }), 7500);
  // An API older than the field.
  assert.equal(settledBalanceOwed({ outstanding: 7500 }), 7500);
  assert.equal(settledBalanceOwed({ outstanding: 0, topupDue: 2000 }), 0);
});
