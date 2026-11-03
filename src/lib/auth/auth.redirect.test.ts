import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRoleUrl, resolvePostLoginUrl } from "./auth.redirect";

function readingIn(lang: string) {
  (globalThis as { document?: unknown }).document = { documentElement: { lang } };
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

describe("getRoleUrl for a customer", () => {
  it("is the shop, not the marketing home", () => {
    readingIn("en");
    assert.equal(getRoleUrl("customer"), "/shop");
  });

  it("keeps the language being read", () => {
    readingIn("fr");
    assert.equal(getRoleUrl("customer"), "/fr/shop");
  });

  it("is the shop after a sign-in with nowhere to return to", () => {
    readingIn("en");
    assert.equal(resolvePostLoginUrl("customer", null), "/shop");
  });

  it("still honours a valid return over the shop", () => {
    readingIn("en");
    assert.equal(resolvePostLoginUrl("customer", "/shop/cart"), "/shop/cart");
  });
});

describe("getRoleUrl for the other roles", () => {
  it("still leaves for their own host", () => {
    readingIn("en");
    assert.equal(getRoleUrl("vendor"), "https://vendor.wi-mall.com");
    assert.equal(getRoleUrl("agency"), "https://agency.wi-mall.com");
  });
});
