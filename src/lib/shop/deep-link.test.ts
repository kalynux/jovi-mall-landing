/**
 * The app build's handling of links that arrive from outside it:
 * `toInAppPath` (what survives the hop) and `resolveDeepLink` (where it opens).
 *
 * Run with `npm test`. Node's own runner, no framework — see
 * `scripts/test-resolve.mjs` for the one thing it needs help with.
 *
 * These assert the NATIVE shapes. `shop.routes.ts` reads the build target when
 * it is first evaluated, so the target is set before anything is imported —
 * hence the dynamic imports below rather than static ones.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_APP_TARGET = "native";
const { resolveDeepLink, toInAppPath } = await import("./deep-link");
const { resolveNotificationDestination } = await import("./notification-routing");

/** The whole journey: the intent's URL in, the router's argument out. */
function open(url: string): string | null {
  const path = toInAppPath(url);
  return path === null ? null : resolveDeepLink(path);
}

const ID = "6ab0d1fe865937d254d5cba7";
const SITE = "https://wi-mall.com";

// ── The defect, verbatim ─────────────────────────────────────────────────────

test("the reported link: 'View request' opens the app's ticket screen", () => {
  assert.equal(open(`${SITE}/shop/account/support/${ID}`), `/shop/account/ticket?id=${ID}`);
});

// ── Every nested web route the static export addresses by query ─────────────

const TRANSLATED: [web: string, app: string][] = [
  [`/shop/account/support/${ID}`, `/shop/account/ticket?id=${ID}`],
  [`/shop/account/orders/detail/${ID}`, `/shop/account/order/detail?id=${ID}`],
  [`/shop/account/orders/${ID}`, `/shop/account/order?id=${ID}`],
  [`/shop/account/orders/detail/${ID}/tracking`, `/shop/account/order/tracking?id=${ID}`],
  [`/shop/account/bookings/${ID}`, `/shop/account/booking?id=${ID}`],
  [`/shop/account/bookings/${ID}/balance`, `/shop/account/booking/balance?id=${ID}`],
  [`/shop/account/bookings/${ID}/pay`, `/shop/account/booking/pay?id=${ID}`],
  [`/shop/account/bookings/${ID}/reschedule`, `/shop/account/booking/reschedule?id=${ID}`],
  [
    "/shop/stores/boutique-ndogbong/products/blue-shirt",
    "/shop/p?store=boutique-ndogbong&slug=blue-shirt",
  ],
  ["/shop/stores/boutique-ndogbong", "/shop/store?s=boutique-ndogbong"],
  [`/shop/p/${ID}`, `/shop/p?id=${ID}`],
];

for (const [web, app] of TRANSLATED) {
  test(`translates ${web}`, () => {
    assert.equal(open(`${SITE}${web}`), app);
  });
}

test("both claimed hosts, and a trailing slash, resolve the same", () => {
  assert.equal(
    open(`https://www.wi-mall.com/shop/account/support/${ID}`),
    `/shop/account/ticket?id=${ID}`,
  );
  assert.equal(open(`${SITE}/shop/account/support/${ID}/`), `/shop/account/ticket?id=${ID}`);
});

test("the custom scheme's absolute form resolves the same", () => {
  assert.equal(
    open(`wimall:///shop/account/orders/detail/${ID}`),
    `/shop/account/order/detail?id=${ID}`,
  );
});

test("the host never steers: only the path is read", () => {
  assert.equal(
    open(`https://evil.example/shop/account/support/${ID}`),
    `/shop/account/ticket?id=${ID}`,
  );
});

// ── A locale in the link ─────────────────────────────────────────────────────

test("a leading locale is dropped, so the router does not double it", () => {
  assert.equal(open(`${SITE}/fr/shop/account/support/${ID}`), `/shop/account/ticket?id=${ID}`);
  assert.equal(
    open(`${SITE}/ar/shop/account/orders/detail/${ID}/tracking`),
    `/shop/account/order/tracking?id=${ID}`,
  );
  assert.equal(open(`${SITE}/pt/shop/cart`), "/shop/cart");
  assert.equal(open(`${SITE}/es/login/magic?t=abc.def`), "/login/magic?t=abc.def");
  assert.equal(open(`${SITE}/en/shop?q=rice`), "/shop?q=rice");
});

test("a bare locale, or the bare site, opens the storefront (the landing page is not in the app)", () => {
  assert.equal(open(`${SITE}/fr`), "/shop");
  assert.equal(open(`${SITE}/fr/`), "/shop");
  assert.equal(open("wimall:///"), "/shop");
  assert.equal(open("wimall:///?q=rice"), "/shop?q=rice");
});

test("a word that merely starts like a locale is not one", () => {
  assert.equal(open(`${SITE}/frshop/x`), "/frshop/x");
});

// ── The query string ─────────────────────────────────────────────────────────

test("a translated link keeps its query — the store page reads ?type= on both targets", () => {
  assert.equal(
    open(`${SITE}/shop/stores/boutique?type=service`),
    "/shop/store?s=boutique&type=service",
  );
  assert.equal(
    open(`${SITE}/shop/account/support/${ID}?utm_source=whatsapp`),
    `/shop/account/ticket?id=${ID}&utm_source=whatsapp`,
  );
});

test("the path's id wins over a same-named query parameter", () => {
  assert.equal(
    open(`${SITE}/shop/account/support/${ID}?id=someone-else`),
    `/shop/account/ticket?id=${ID}`,
  );
  assert.equal(
    open(`${SITE}/shop/stores/a/products/b?store=x&slug=y&ref=chat`),
    "/shop/p?store=a&slug=b&ref=chat",
  );
});

test("an encoded segment is encoded once, not twice", () => {
  assert.equal(open(`${SITE}/shop/stores/caf%C3%A9`), "/shop/store?s=caf%C3%A9");
});

// ── What the app already serves passes through untouched ─────────────────────

const UNCHANGED = [
  "/shop",
  "/shop/",
  "/shop/cart",
  "/shop/saved",
  "/shop/account",
  "/shop/account/orders",
  "/shop/account/bookings",
  "/shop/account/support",
  "/shop/account/support/new",
  "/shop/account/notifications/settings",
  "/shop/checkout/success",
  "/shop?q=shoes&page=2",
  "/shop/p?store=a&slug=b",
  `/shop/account/ticket?id=${ID}`,
  `/shop/account/order/detail?id=${ID}`,
  `/shop/account/booking/pay?id=${ID}`,
  "/shop/store?s=boutique&type=service",
  "/login/magic?t=abc.def",
  "/login",
];

for (const path of UNCHANGED) {
  test(`passes through unchanged: ${path}`, () => {
    assert.equal(resolveDeepLink(path), path);
    assert.equal(open(`${SITE}${path}`), path);
  });
}

// ── Unknown paths below a known screen ───────────────────────────────────────

test("an unrecognised path below a recognised screen opens that screen", () => {
  assert.equal(
    open(`${SITE}/shop/account/bookings/${ID}/receipt`),
    `/shop/account/booking?id=${ID}`,
  );
  assert.equal(
    open(`${SITE}/shop/account/orders/detail/${ID}/invoice/2`),
    `/shop/account/order/detail?id=${ID}`,
  );
  assert.equal(open(`${SITE}/shop/stores/boutique/products`), "/shop/store?s=boutique");
  assert.equal(
    open(`${SITE}/fr/shop/account/support/${ID}/attachments?x=1`),
    `/shop/account/ticket?id=${ID}`,
  );
});

// ── Refusals ─────────────────────────────────────────────────────────────────

test("toInAppPath still refuses what it refused", () => {
  assert.equal(toInAppPath("//evil.com"), null); // not a URL at all without a base
  assert.equal(toInAppPath("//evil.com/shop"), null);
  assert.equal(toInAppPath(`${SITE}//evil.com/shop`), null); // the path opens with //
  assert.equal(toInAppPath("wimall:////evil.com"), null);
  assert.equal(toInAppPath("wimall:shop/cart"), null); // not an absolute path
  assert.equal(toInAppPath("not a url"), null);
});

test("dropping a locale can never manufacture a protocol-relative path", () => {
  const urls = [
    `${SITE}/fr//evil.com`,
    `${SITE}/fr//evil.com/shop?x=1`,
    `${SITE}/fr/\\evil.com`,
    `${SITE}/fr///evil.com`,
  ];
  for (const url of urls) {
    const result = open(url);
    assert.ok(
      result !== null && result.startsWith("/") && !result.startsWith("//"),
      `${url} → ${result}`,
    );
  }
});

// ── The inbox and push taps share the table: same answers as before ─────────

test("notification paths resolve as they did, current and legacy", () => {
  const cases: [string, string][] = [
    [`shop/account/orders/detail/${ID}`, `/shop/account/order/detail?id=${ID}`],
    [`shop/account/orders/detail/${ID}/tracking`, `/shop/account/order/tracking?id=${ID}`],
    [`shop/account/orders/${ID}`, `/shop/account/order?id=${ID}`],
    [`shop/account/bookings/${ID}`, `/shop/account/booking?id=${ID}`],
    [`shop/account/bookings/${ID}/balance`, `/shop/account/booking/balance?id=${ID}`],
    [`shop/account/support/${ID}`, `/shop/account/ticket?id=${ID}`],
    ["pay/tok_123", "/pay/tok_123"],
    [`orders/${ID}`, `/shop/account/order/detail?id=${ID}`],
    [`orders/${ID}/tracking`, `/shop/account/order/tracking?id=${ID}`],
    [`bookings/${ID}`, `/shop/account/booking?id=${ID}`],
    [`bookings/${ID}/pay-balance`, `/shop/account/booking/balance?id=${ID}`],
    [`support/${ID}`, `/shop/account/ticket?id=${ID}`],
  ];
  for (const [actionPath, expected] of cases) {
    assert.equal(resolveNotificationDestination(actionPath), expected, actionPath);
  }
  assert.equal(resolveNotificationDestination("something/else"), "/shop/account/notifications");
  assert.equal(
    resolveNotificationDestination(undefined, { type: "order", id: ID }),
    `/shop/account/order/detail?id=${ID}`,
  );
});
