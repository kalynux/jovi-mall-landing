/**
 * The saved list's rows. Run with `npm test`.
 *
 * The regression this exists for: the list holds listings since 2026-11-08,
 * and reading `productId` off every row put `undefined` into the heart set.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseWishlistEntry } from "./wishlist-entry";

test("rows branch on kind", () => {
  const product = normaliseWishlistEntry({ kind: "product", productId: "p1", at: "2026-11-08", product: null });
  assert.equal(product?.kind, "product");
  assert.equal(product?.kind === "product" && product.productId, "p1");

  const listing = normaliseWishlistEntry({ kind: "listing", listingId: "l1", at: "2026-11-08", listing: null });
  assert.deepEqual(listing, { kind: "listing", listingId: "l1", at: "2026-11-08", listing: null });
});

test("a row from an API before 2026-11-08 has no kind and is a product", () => {
  const row = normaliseWishlistEntry({ productId: "p2", at: "x", product: null });
  assert.equal(row?.kind, "product");
});

test("a row that cannot be drawn is dropped, not drawn empty", () => {
  assert.equal(normaliseWishlistEntry({ kind: "listing", at: "x" }), null);
  assert.equal(normaliseWishlistEntry({ kind: "bundle", bundleId: "b1" }), null);
  assert.equal(normaliseWishlistEntry({ kind: "product" }), null);
});

test("a listing that is no longer visible keeps its row, with listing null", () => {
  const row = normaliseWishlistEntry({ kind: "listing", listingId: "l9", at: "x" });
  assert.equal(row?.kind === "listing" && row.listing, null);
});
