/**
 * The notification resolver on the WEB build.
 *
 * `deep-link.test.ts` covers the app. This file exists because the table both
 * doors share gained rows for the app's sake, and the website's inbox has to
 * keep answering exactly as it did: every address the backend's catalogue
 * sends, in both vintages, lands on the page it always landed on.
 *
 * A separate file rather than a second block in that one: the build target is
 * read once, when `shop.routes.ts` is first evaluated, and `node --test` gives
 * each file its own process.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

delete process.env.NEXT_PUBLIC_APP_TARGET;
const { resolveNotificationDestination, matchStorefrontPath } = await import("./notification-routing");

const ID = "6ab0d1fe865937d254d5cba7";

test("the backend's six addresses resolve to the web pages they name", () => {
  const cases: [string, string][] = [
    [`shop/account/bookings/${ID}`, `/shop/account/bookings/${ID}`],
    [`shop/account/bookings/${ID}/balance`, `/shop/account/bookings/${ID}/balance`],
    [`shop/account/support/${ID}`, `/shop/account/support/${ID}`],
    [`shop/account/orders/detail/${ID}`, `/shop/account/orders/detail/${ID}`],
    [`shop/account/orders/detail/${ID}/tracking`, `/shop/account/orders/detail/${ID}/tracking`],
    ["pay/tok_123", "/pay/tok_123"],
  ];
  for (const [actionPath, expected] of cases) {
    assert.equal(resolveNotificationDestination(actionPath), expected, actionPath);
  }
});

test("the pre-2026-09-07 bare nouns still resolve", () => {
  const cases: [string, string][] = [
    [`orders/${ID}`, `/shop/account/orders/detail/${ID}`],
    [`orders/${ID}/tracking`, `/shop/account/orders/detail/${ID}/tracking`],
    [`bookings/${ID}`, `/shop/account/bookings/${ID}`],
    [`bookings/${ID}/pay-balance`, `/shop/account/bookings/${ID}/balance`],
    [`support/${ID}`, `/shop/account/support/${ID}`],
  ];
  for (const [actionPath, expected] of cases) {
    assert.equal(resolveNotificationDestination(actionPath), expected, actionPath);
  }
});

test("fallbacks are unchanged", () => {
  assert.equal(resolveNotificationDestination(undefined), "/shop/account/notifications");
  assert.equal(resolveNotificationDestination("something/else"), "/shop/account/notifications");
  assert.equal(
    resolveNotificationDestination("", { type: "order", id: ID }),
    `/shop/account/orders/detail/${ID}`,
  );
  assert.equal(
    resolveNotificationDestination("", { type: "booking", id: ID }),
    `/shop/account/bookings/${ID}`,
  );
});

test("`support/new` is the new-ticket form, as the App Router resolves it", () => {
  assert.equal(matchStorefrontPath("shop/account/support/new"), "/shop/account/support/new");
});

test("the catalogue rows answer with the web's own nested shapes", () => {
  assert.equal(matchStorefrontPath("shop/stores/a/products/b"), "/shop/stores/a/products/b");
  assert.equal(matchStorefrontPath("shop/stores/a"), "/shop/stores/a");
  assert.equal(matchStorefrontPath(`shop/p/${ID}`), `/shop/p/${ID}`);
});
