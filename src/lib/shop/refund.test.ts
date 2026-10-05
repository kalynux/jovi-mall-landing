/**
 * The `refund` block, against `api-doc/customer/orders.md` → The `refund` block.
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REFUND_CHIP, refundHasFee, refundStatusOf, type CustomerRefund } from "./refund";

const MOMO: CustomerRefund = {
  status: "sending",
  grossAmount: 5000,
  feeAmount: 100,
  feePercent: 2,
  netAmount: 4900,
  currency: "XAF",
  channel: "payout",
  destinationMasked: "+•••••••••512",
  waitingForCash: false,
  completedAt: null,
};

const CARD: CustomerRefund = {
  ...MOMO,
  status: "completed",
  feeAmount: 0,
  feePercent: 0,
  netAmount: 5000,
  channel: "card_refund",
  destinationMasked: null,
  completedAt: "2026-10-05T10:00:00.000Z",
};

test("the six documented statuses render as themselves", () => {
  for (const s of Object.keys(REFUND_CHIP) as CustomerRefund["status"][]) {
    assert.equal(refundStatusOf({ ...MOMO, status: s }), s);
  }
});

test('"failed" — or anything undocumented — never reaches the screen', () => {
  for (const s of ["failed", "approved", "", "FAILED"]) {
    assert.equal(refundStatusOf({ ...MOMO, status: s as CustomerRefund["status"] }), "in_progress");
  }
});

test("a mobile-money refund with a fee shows the fee line", () => {
  assert.equal(refundHasFee(MOMO), true);
});

test("a card refund never mentions a fee", () => {
  assert.equal(refundHasFee(CARD), false);
  // Even if a card row ever carried a non-zero fee, the channel wins.
  assert.equal(refundHasFee({ ...CARD, feeAmount: 100 }), false);
});

test("no fee line when the API says the fee is zero", () => {
  assert.equal(refundHasFee({ ...MOMO, feeAmount: 0, feePercent: 0, netAmount: 5000 }), false);
});
