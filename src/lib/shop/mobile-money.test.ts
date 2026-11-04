import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountOutsideLimits,
  dialHref,
  handsetStepOf,
  nextPollDelay,
  readHandsetStep,
  rememberHandsetStep,
} from "./mobile-money";

const ORANGE_ANSWER = {
  ussdCode: "#150*50#",
  payeeName: "Moon SARL",
  message: "server_sentence",
};

test("no payee means no step, so every other gateway's screen stays as it is", () => {
  assert.equal(handsetStepOf(undefined, "ORANGE"), null);
  assert.equal(handsetStepOf(null, "ORANGE"), null);
  assert.equal(handsetStepOf({ ussdCode: "*126#", message: "server_sentence" }, "MTN"), null);
  assert.equal(handsetStepOf({ ussdCode: "*126#", payeeName: "  " }, "MTN"), null);
});

test("Orange has to dial, and MTN gets a prompt", () => {
  assert.equal(handsetStepOf(ORANGE_ANSWER, "ORANGE")?.mode, "dial");
  assert.equal(handsetStepOf({ ...ORANGE_ANSWER, ussdCode: "*126#" }, "MTN")?.mode, "prompt");
});

test("the name and the code are whatever the answer says", () => {
  const step = handsetStepOf({ ussdCode: "*999#", payeeName: "Another Payee" }, "ORANGE");
  assert.equal(step?.payeeName, "Another Payee");
  assert.equal(step?.ussdCode, "*999#");
});

test("an attempt with no known provider falls back to the server's own sentence", () => {
  const step = handsetStepOf(ORANGE_ANSWER, null);
  assert.equal(step?.mode, "unknown");
  assert.equal(step?.message, ORANGE_ANSWER.message);
});

test("Orange with nothing to dial is not told to dial", () => {
  assert.equal(handsetStepOf({ payeeName: "Moon SARL" }, "ORANGE")?.mode, "unknown");
});

test("# travels as %23 in the dial link", () => {
  assert.equal(dialHref("#150*50#"), "tel:%23150*50%23");
  assert.equal(dialHref("*126#"), "tel:*126%23");
});

test("only a USSD code becomes a dial link", () => {
  assert.equal(dialHref("*126# for MTN or #150*50# for ORANGE"), null);
  assert.equal(dialHref("javascript:alert(1)"), null);
  assert.equal(dialHref(""), null);
});

test("without a payee the wait is the same one minute it always was", () => {
  assert.equal(nextPollDelay(0, false), 4_000);
  assert.equal(nextPollDelay(14, false), 4_000);
  assert.equal(nextPollDelay(15, false), null);
});

test("with a payee the wait runs for half an hour, then stops", () => {
  assert.equal(nextPollDelay(14, true), 4_000);
  assert.equal(nextPollDelay(15, true), 10_000);

  let attempts = 0;
  let elapsed = 0;
  for (let delay = nextPollDelay(attempts, true); delay !== null; delay = nextPollDelay(attempts, true)) {
    elapsed += delay;
    attempts += 1;
  }
  assert.equal(elapsed, 30 * 60_000);
});

test("limits are read as given, and only against XAF", () => {
  const limits = { min: 301, max: 500_000 };
  assert.equal(amountOutsideLimits(300, "XAF", limits), true);
  assert.equal(amountOutsideLimits(301, "XAF", limits), false);
  assert.equal(amountOutsideLimits(500_000, "XAF", limits), false);
  assert.equal(amountOutsideLimits(500_001, "XAF", limits), true);
  assert.equal(amountOutsideLimits(300, "EUR", limits), false);
  assert.equal(amountOutsideLimits(1, "XAF", undefined), false);
});

test("a step is kept by key, and a new attempt without a payee clears it", () => {
  const step = handsetStepOf(ORANGE_ANSWER, "ORANGE");
  rememberHandsetStep("tx-1", step);
  assert.deepEqual(readHandsetStep("tx-1"), step);
  assert.equal(readHandsetStep("tx-2"), null);

  rememberHandsetStep("tx-1", null);
  assert.equal(readHandsetStep("tx-1"), null);
});
