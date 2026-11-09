/**
 * The referral page's decisions, against api-doc/me/referrals.md and the state
 * table in api-doc/FRONTEND-CHANGELOG-referrals.md.
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balanceRows,
  cleanReferralCode,
  knownCategory,
  maskedPayout,
  payoutProviderName,
  payoutStatusOf,
  referralCodeToSend,
  referralView,
  referredState,
  rewardShownAmount,
  rewardStatusOf,
  shareIntents,
  withdrawBlocker,
  type ReferralBalances,
  type ReferralLookup,
  type ReferralOverview,
  type ReferralReward,
  type ReferredAccount,
} from "./referral";

const PROGRAM = { enabled: true, minPayoutAmount: 500, rewardWaitDays: 9 };
const BALANCES: ReferralBalances = {
  pending: 630,
  available: 2100,
  reserve: 0,
  requested: 0,
  clawback: 0,
  currency: "XAF",
};
const MOMO = {
  method: "mobile_money" as const,
  mobile_money: { provider: "mtn", phone_number_masked: "••••5831", account_name: "Carine N" },
  bank: null,
  card: null,
};
const PARTNER: ReferralOverview = {
  program: PROGRAM,
  status: "active",
  canApply: false,
  statusReason: null,
  code: "ULRICH123",
  codeActive: true,
  links: { registerUrl: "https://wi-mall.com/register?ref=ULRICH123", whatsappUrl: null, telegramUrl: null },
  terms: { vendor: { ratePercent: 2, durationMonths: 4 } },
  balances: BALANCES,
  balanceFrozen: false,
  canWithdraw: true,
  payoutDestination: { source: null, editableHere: true, method: MOMO },
};

const lookup = (over: Partial<ReferralLookup>): ReferralLookup => ({
  valid: true,
  code: "ULRICH123",
  registerUrl: null,
  whatsappUrl: null,
  telegramUrl: null,
  ...over,
});

test("a code is tidied like the backend's, and anything it would not read is dropped", () => {
  assert.equal(cleanReferralCode(" ulrich123 "), "ULRICH123");
  assert.equal(cleanReferralCode(null), null);
  assert.equal(cleanReferralCode("abc"), null);
  assert.equal(cleanReferralCode("has space"), null);
  // Past the API's 40-character cap, sending it would fail the whole registration.
  assert.equal(cleanReferralCode("A".repeat(41)), null);
});

test("only an explicit valid:false stops a form sending the code", () => {
  assert.equal(referralCodeToSend("ULRICH123", null), "ULRICH123");
  assert.equal(referralCodeToSend("ULRICH123", lookup({})), "ULRICH123");
  assert.equal(referralCodeToSend("ULRICH123", lookup({ valid: false, code: null })), null);
  assert.equal(referralCodeToSend(null, null), null);
});

test("never applied, program open: the pitch and the form", () => {
  const v = referralView({ program: PROGRAM, status: "none", canApply: true });
  assert.equal(v.form, true);
  assert.equal(v.closed, false);
  assert.equal(v.money, false);
});

test("program off: the page says so and offers nothing", () => {
  const v = referralView({
    program: { ...PROGRAM, enabled: false },
    status: "none",
    canApply: false,
  });
  assert.equal(v.closed, true);
  assert.equal(v.form, false);
  assert.equal(v.share, false);
});

test("pending shows the review line and no money", () => {
  const v = referralView({ program: PROGRAM, status: "pending", canApply: false });
  assert.equal(v.reviewing, true);
  assert.equal(v.money, false);
  assert.equal(v.form, false);
});

test("active shares and shows money; off-program it says the link stopped counting", () => {
  const v = referralView(PARTNER);
  assert.equal(v.share, true);
  assert.equal(v.terms, true);
  assert.equal(v.money, true);
  assert.equal(v.destination, true);
  assert.equal(v.paused, false);
  assert.equal(referralView({ ...PARTNER, program: { ...PROGRAM, enabled: false } }).paused, true);
});

test("suspended and terminated keep the code, money and history, but nothing to share", () => {
  for (const status of ["suspended", "terminated"] as const) {
    const v = referralView({ ...PARTNER, status, codeActive: false, canWithdraw: false });
    assert.equal(v.notice, status);
    assert.equal(v.share, false);
    assert.equal(v.deadCode, true);
    assert.equal(v.money, true);
    assert.equal(v.destination, true);
  }
});

test("the form returns for rejected and terminated only when canApply", () => {
  const rejected: ReferralOverview = { ...PARTNER, status: "rejected", code: null, links: null };
  assert.equal(referralView({ ...rejected, canApply: false }).form, false);
  assert.equal(referralView({ ...rejected, canApply: true }).form, true);
  assert.equal(referralView(rejected).money, true);
  assert.equal(referralView(rejected).destination, false);
  assert.equal(referralView({ ...PARTNER, status: "terminated", canApply: true }).form, true);
  assert.equal(referralView({ ...PARTNER, status: "suspended", canApply: true }).form, false);
});

test("a withdraw hint only explains an absent button", () => {
  const blocked = (over: Partial<ReferralOverview>, balances: Partial<ReferralBalances> = {}) =>
    withdrawBlocker({
      ...PARTNER,
      canWithdraw: false,
      ...over,
      balances: { ...BALANCES, ...balances },
    });

  assert.equal(withdrawBlocker(PARTNER), null);
  assert.equal(blocked({ balanceFrozen: true }), "frozen");
  assert.equal(blocked({}, { requested: 100 }), "inProgress");
  assert.equal(blocked({}, { clawback: 100, available: 0 }), "owes");
  assert.equal(blocked({}, { available: 499 }), "belowMinimum");
  assert.equal(
    blocked({ payoutDestination: { source: null, editableHere: true, method: null } }),
    "noDestination",
  );
});

test("clawback is never one of the balances", () => {
  const keys = balanceRows({ ...BALANCES, clawback: 900 }).map((r) => r.key);
  assert.deepEqual(keys, ["available", "pending"]);
  assert.deepEqual(
    balanceRows({ ...BALANCES, requested: 1, reserve: 1 }).map((r) => r.key),
    ["available", "pending", "requested", "reserve"],
  );
});

test("a referred account's line comes from expiresAt and earning", () => {
  const row: ReferredAccount = {
    id: "1",
    name: "C***** N*****",
    category: "customer",
    registeredAt: "2026-11-02T10:00:00.000Z",
    expiresAt: "2027-05-01T23:00:00.000Z",
    earning: true,
    totalEarned: 420,
  };
  assert.equal(referredState(row), "earning");
  assert.equal(referredState({ ...row, earning: false }), "ended");
  assert.equal(referredState({ ...row, category: "agent", expiresAt: null, earning: false }), "neverEarns");
});

test("a reversed reward shows as 0", () => {
  const row: ReferralReward = {
    id: "1",
    name: "C*****",
    category: "customer",
    amount: 120,
    currency: "XAF",
    status: "reversed",
    earnedAt: "",
    availableFrom: "",
    adjusted: true,
  };
  assert.equal(rewardShownAmount(row), 0);
  assert.equal(rewardShownAmount({ ...row, status: "released" }), 120);
});

test("an unknown status never reads as a verdict", () => {
  assert.equal(rewardStatusOf("something_new"), "held");
  assert.equal(payoutStatusOf("something_new"), "pending");
  assert.equal(payoutStatusOf("paid"), "paid");
});

test("a destination reads the same from any kind and any app's provider string", () => {
  assert.equal(payoutProviderName("mtn"), "MTN Mobile Money");
  assert.equal(payoutProviderName("MTN Mobile Money"), "MTN Mobile Money");
  assert.equal(payoutProviderName("ORANGE"), "Orange Money");
  assert.equal(payoutProviderName("Wave"), "Wave");
  assert.deepEqual(maskedPayout(MOMO), {
    name: "MTN Mobile Money",
    number: "••••5831",
    holder: "Carine N",
  });
  assert.equal(maskedPayout(null), null);
});

test("share intents go to a contact, not to the bot", () => {
  const { whatsapp, telegram } = shareIntents("https://wi-mall.com/register?ref=A1B2", "Join:");
  assert.equal(whatsapp, "https://wa.me/?text=Join%3A%20https%3A%2F%2Fwi-mall.com%2Fregister%3Fref%3DA1B2");
  assert.ok(telegram.startsWith("https://t.me/share/url?url=https%3A%2F%2Fwi-mall.com"));
});

test("a referred service provider has a label, an unknown category none", () => {
  assert.equal(knownCategory("provider"), "provider");
  assert.equal(knownCategory("vendor"), "vendor");
  assert.equal(knownCategory("something_new"), null);
});
