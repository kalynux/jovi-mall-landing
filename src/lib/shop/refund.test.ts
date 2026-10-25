/**
 * The `refund` block, against `api-doc/customer/orders.md` → The `refund` block.
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFUND_CHIP,
  refundHasFee,
  refundLines,
  refundStatusOf,
  type CustomerRefund,
} from "./refund";

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

// ── The fee lines (2026-10-22) — the changelog's own 10,000 examples ─────────

const line = (code: string, amount: number, percent: number | null = null) => ({
  code,
  label: code,
  amount,
  percent,
});

const LINED: Record<string, CustomerRefund> = {
  momo: {
    ...MOMO,
    grossAmount: 10000,
    feeAmount: 396,
    netAmount: 9604,
    feesPaidBy: "customer",
    lines: [
      line("refund_amount", 10000),
      line("payment_fee", -200, 2),
      line("transfer_fee", -196, 2),
      line("you_receive", 9604),
    ],
  },
  card: {
    ...CARD,
    grossAmount: 10000,
    feeAmount: 200,
    netAmount: 9800,
    feesPaidBy: "customer",
    lines: [line("refund_amount", 10000), line("payment_fee", -200, 2), line("you_receive", 9800)],
  },
  cod: {
    ...MOMO,
    grossAmount: 10000,
    feeAmount: 200,
    netAmount: 9800,
    feesPaidBy: "customer",
    lines: [line("refund_amount", 10000), line("transfer_fee", -200, 2), line("you_receive", 9800)],
  },
  seller: {
    ...MOMO,
    grossAmount: 10000,
    feeAmount: 0,
    netAmount: 10000,
    feesPaidBy: "seller",
    lines: [line("refund_amount", 10000), line("fees_paid_by_seller", 0), line("you_receive", 10000)],
  },
};

test("the lines are shown as sent, and they add up to what the customer receives", () => {
  for (const [name, refund] of Object.entries(LINED)) {
    const lines = refundLines(refund);
    assert.deepEqual(lines, refund.lines, name);
    const sum = lines!.filter((l) => l.code !== "you_receive").reduce((s, l) => s + l.amount, 0);
    assert.equal(sum, refund.netAmount, `${name}: refund − fees = you receive`);
    assert.equal(lines!.at(-1)!.amount, refund.netAmount, `${name}: last line is netAmount`);
  }
});

test("a card refund lists no transfer fee; cash on delivery lists no payment fee", () => {
  assert.ok(!refundLines(LINED.card)!.some((l) => l.code === "transfer_fee"));
  assert.ok(!refundLines(LINED.cod)!.some((l) => l.code === "payment_fee"));
});

test("a seller-paid refund lists the note and the full amount", () => {
  const lines = refundLines(LINED.seller)!;
  assert.ok(lines.some((l) => l.code === "fees_paid_by_seller"));
  assert.equal(lines.at(-1)!.amount, 10000);
});

test("lines replace the one-sentence fee line", () => {
  for (const refund of Object.values(LINED)) assert.equal(refundHasFee(refund), false);
});

test("no list when it would only repeat the amount, or when the API sends none", () => {
  const bare = { ...CARD, lines: [line("refund_amount", 5000), line("you_receive", 5000)] };
  assert.equal(refundLines(bare), null);
  assert.equal(refundLines(MOMO), null);
  assert.equal(refundLines({ ...MOMO, lines: [] }), null);
  // An API without `lines` still gets the old sentence.
  assert.equal(refundHasFee({ ...MOMO, lines: [] }), true);
});
