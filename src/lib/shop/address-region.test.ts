/**
 * `ADDRESS_REGION_INVALID`, against `api-doc/customer/profile.md` → Region.
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { regionInvalidDetails, regionLabel, regionOptions, withRegion } from "./address-region";
import type { GeoAddress } from "./customer.types";

const DETAILS = {
  region: "Mars",
  city: "Nowhere",
  countryCode: "CM",
  addressId: "664addr",
  allowedRegions: [
    { key: "far_north", name: { en: "Far North", fr: "Extrême-Nord" } },
    { key: "centre", name: { en: "Centre", fr: "Centre" } },
  ],
};

test("the refusal's details are read from { code, details }", () => {
  const d = regionInvalidDetails({ code: "ADDRESS_REGION_INVALID", details: DETAILS });
  assert.deepEqual(d, DETAILS);
});

test("addressId is optional: a POST of a new address has none", () => {
  const { addressId: _omit, ...rest } = DETAILS;
  void _omit;
  const d = regionInvalidDetails({ code: "ADDRESS_REGION_INVALID", details: rest });
  assert.equal(d?.addressId, undefined);
  assert.equal("addressId" in (d ?? {}), false);
});

test("another code, or no region list, is not a picker", () => {
  assert.equal(regionInvalidDetails({ code: "VALIDATION_ERROR", details: DETAILS }), null);
  assert.equal(regionInvalidDetails({ code: "ADDRESS_REGION_INVALID" }), null);
  assert.equal(
    regionInvalidDetails({ code: "ADDRESS_REGION_INVALID", details: { ...DETAILS, allowedRegions: [] } }),
    null,
  );
  assert.equal(regionInvalidDetails(new Error("x")), null);
  assert.equal(regionInvalidDetails(null), null);
});

test("labels follow the locale; es/pt/ar fall back to English", () => {
  const farNorth = DETAILS.allowedRegions[0];
  assert.equal(regionLabel(farNorth, "fr"), "Extrême-Nord");
  assert.equal(regionLabel(farNorth, "en"), "Far North");
  assert.equal(regionLabel(farNorth, "ar"), "Far North");
  assert.equal(regionLabel({ key: "x", name: {} as never }, "fr"), "x");
});

test("options carry the key as the value", () => {
  const [centre, farNorth] = [DETAILS.allowedRegions[1], DETAILS.allowedRegions[0]];
  assert.deepEqual(
    regionOptions(DETAILS.allowedRegions, "fr").map((o) => [o.value, o.label]),
    [
      [centre.key, centre.name.fr],
      [farNorth.key, farNorth.name.fr],
    ],
  );
});

test("withRegion sets components.region and drops the server-assigned resolved_at", () => {
  const geo: GeoAddress = {
    formatted_address: "Somewhere",
    coordinates: { type: "Point", coordinates: [11.5, 3.8] },
    provider: "nominatim",
    provider_place_id: null,
    components: {
      street: null,
      neighbourhood: null,
      city: "Nowhere",
      region: "Mars",
      country: "Cameroon",
      country_code: "CM",
      postal_code: null,
    },
    raw_input: "somewhere",
    resolved_at: "2026-10-02T00:00:00.000Z",
  };
  const next = withRegion(geo, "centre");
  assert.equal(next.components.region, "centre");
  assert.equal(next.components.city, "Nowhere");
  assert.equal("resolved_at" in next, false);
  assert.equal(geo.components.region, "Mars", "the input is not mutated");
});
