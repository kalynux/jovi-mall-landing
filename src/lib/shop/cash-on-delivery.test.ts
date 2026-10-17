/**
 * The cash-on-delivery verdict, against `api-doc/customer/cart.md`
 * § `cashOnDelivery` and `api-doc/customer/FRONTEND-CHANGELOG-cod-restrictions.md`.
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { codRefusalFromError, codRefusalOf, codRemovableShops } from "./cash-on-delivery";

const SHOP_A = "507f1f77bcf86cd799439aaa";
const SHOP_B = "507f1f77bcf86cd799439bbb";

test("on offer, or no verdict at all: nothing is refused", () => {
  assert.equal(codRefusalOf(null), null);
  // An API that predates the field.
  assert.equal(codRefusalOf({}), null);
  assert.equal(codRefusalOf({ cashOnDelivery: { available: true, reason: null, vendorIds: [] } }), null);
});

test("a restricted account: refused, and no shop is ever named", () => {
  assert.deepEqual(
    codRefusalOf({ cashOnDelivery: { available: false, reason: "customer_restricted", vendorIds: [] } }),
    { reason: "customer_restricted", vendorIds: [] },
  );
  // The contract says `vendorIds` is empty; a stray id must still not become basket advice.
  assert.deepEqual(
    codRefusalOf({ cashOnDelivery: { available: false, reason: "customer_restricted", vendorIds: [SHOP_A] } }),
    { reason: "customer_restricted", vendorIds: [] },
  );
});

test("a shop or its delivery company refuses: the shops are kept", () => {
  for (const reason of ["vendor_not_accepted", "agency_not_supported", "order_amount_exceeds_limit"] as const) {
    assert.deepEqual(codRefusalOf({ cashOnDelivery: { available: false, reason, vendorIds: [SHOP_A] } }), {
      reason,
      vendorIds: [SHOP_A],
    });
  }
});

test("an unchecked or unknown reason is still unavailable, without basket advice", () => {
  assert.deepEqual(codRefusalOf({ cashOnDelivery: { available: false, reason: null, vendorIds: [] } }), {
    reason: "unknown",
    vendorIds: [],
  });
  assert.deepEqual(
    codRefusalOf({ cashOnDelivery: { available: false, reason: "region_restricted", vendorIds: [SHOP_A] } }),
    { reason: "unknown", vendorIds: [] },
  );
});

test("checkout's 422s map back to the same reasons", () => {
  assert.deepEqual(codRefusalFromError({ code: "COD_CUSTOMER_RESTRICTED" }), {
    reason: "customer_restricted",
    vendorIds: [],
  });
  assert.deepEqual(codRefusalFromError({ code: "COD_VENDOR_NOT_ACCEPTED", details: { vendorId: SHOP_A } }), {
    reason: "vendor_not_accepted",
    vendorIds: [SHOP_A],
  });
  // A restricted delivery company answers the existing code, and names an agency, not a shop.
  assert.deepEqual(
    codRefusalFromError({ code: "COD_AGENCY_NOT_SUPPORTED", details: { agencyId: "66ag01", agencyName: "Speedy" } }),
    { reason: "agency_not_supported", vendorIds: [] },
  );
  assert.equal(codRefusalFromError({ code: "CATALOG_INSUFFICIENT_STOCK" }), null);
  assert.equal(codRefusalFromError(new Error("offline")), null);
  assert.equal(codRefusalFromError(null), null);
});

test("removing a shop's items is only advice while another shop stays", () => {
  const refused = { reason: "vendor_not_accepted" as const, vendorIds: [SHOP_A] };
  assert.deepEqual(codRemovableShops(refused, [SHOP_A, SHOP_A, SHOP_B]), [SHOP_A]);
  // The only shop in the basket: taking its items out leaves nothing to pay for.
  assert.deepEqual(codRemovableShops(refused, [SHOP_A, SHOP_A]), []);
  // Every shop refuses.
  assert.deepEqual(codRemovableShops({ ...refused, vendorIds: [SHOP_A, SHOP_B] }, [SHOP_A, SHOP_B]), []);
  // A line restored without its seller cannot be matched.
  assert.deepEqual(codRemovableShops(refused, [undefined, SHOP_B]), []);
  assert.deepEqual(codRemovableShops({ reason: "customer_restricted", vendorIds: [] }, [SHOP_A, SHOP_B]), []);
});
