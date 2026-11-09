/**
 * The pure rules behind service listings (lib/shop/listings.ts).
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  drawableFields,
  mapHref,
  parseListingSearchParams,
  phoneNumbers,
  placeParts,
  safeHttpUrl,
  listingTeaserQuery,
  sortedHours,
  telHref,
  todayIn,
  whatsappHref,
} from "./listings";

test("a business-typed link is followed only when it is http(s)", () => {
  assert.equal(safeHttpUrl("https://akwa-plumbers.cm/"), "https://akwa-plumbers.cm/");
  assert.equal(safeHttpUrl(" http://example.cm "), "http://example.cm/");
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,<b>x</b>"), null);
  assert.equal(safeHttpUrl("not a url"), null);
  assert.equal(safeHttpUrl(null), null);
});

test("buttons are drawn for known fields only, in the backend's order", () => {
  assert.deepEqual(drawableFields(["location", "whatsapp", "fax", "phone"]), ["whatsapp", "phone", "location"]);
  assert.deepEqual(drawableFields(null), []);
});

test("the WhatsApp link falls back to wa.me when the API's link is unusable", () => {
  assert.equal(whatsappHref({ number: "+237671234531", link: "https://wa.me/237671234531" }), "https://wa.me/237671234531");
  assert.equal(whatsappHref({ number: "+237 671 23 45 31", link: "javascript:x" }), "https://wa.me/237671234531");
  assert.equal(whatsappHref({ number: "", link: "" }), null);
});

test("an unlocked phone shows every number the business gave", () => {
  assert.deepEqual(
    phoneNumbers({ number: "+237671234531", numbers: ["+237671234531", "+237699000111"] }),
    ["+237671234531", "+237699000111"]
  );
  // An API from before 2026-11-08 sends `number` alone.
  assert.deepEqual(phoneNumbers({ number: "+237671234531" }), ["+237671234531"]);
  assert.deepEqual(phoneNumbers({ number: "+237671234531", numbers: [] }), ["+237671234531"]);
  // Blanks and the same line written twice are drawn once.
  assert.deepEqual(
    phoneNumbers({ number: "+237 671 23 45 31", numbers: ["+237 671 23 45 31", " ", "+237671234531"] }),
    ["+237 671 23 45 31"]
  );
});

test("a dialler link keeps the + and the digits", () => {
  assert.equal(telHref("+237 671-23-45-31"), "tel:+237671234531");
});

test("the map link prefers the API's and falls back to the pin", () => {
  const pin = { address: "Akwa", latitude: 4.05, longitude: 9.7, mapUrl: null };
  assert.equal(mapHref({ ...pin, mapUrl: "https://maps.example/x" }), "https://maps.example/x");
  assert.equal(mapHref(pin), "https://www.google.com/maps/search/?api=1&query=4.05,9.7");
  assert.equal(mapHref({ ...pin, latitude: null, longitude: null }), null);
});

test("the place line uses whichever of area and city exist", () => {
  assert.deepEqual(placeParts({ area: "Akwa", city: "Douala" }), ["Akwa", "Douala"]);
  assert.deepEqual(placeParts({ area: " ", city: "Douala" }), ["Douala"]);
  assert.deepEqual(placeParts({ area: "", city: "" }), []);
});

test("the teaser follows the search or category on screen, else the newest", () => {
  assert.deepEqual(listingTeaserQuery({}), { q: undefined, category: undefined, limit: 10 });
  assert.deepEqual(listingTeaserQuery({ q: "plombier" }), { q: "plombier", category: undefined, limit: 10 });
  assert.deepEqual(listingTeaserQuery({ category: "plumbing" }), { q: undefined, category: "plumbing", limit: 10 });
});

test("the See-all page bounds what it reads off the URL", () => {
  assert.deepEqual(parseListingSearchParams({ q: "  imprimeur ", page: "3" }), { q: "imprimeur", category: undefined, page: 3 });
  assert.equal(parseListingSearchParams({ page: "-1" }).page, 1);
  assert.equal(parseListingSearchParams({ page: "abc" }).page, 1);
  assert.equal(parseListingSearchParams({ q: "x".repeat(300) }).q?.length, 200);
  assert.equal(parseListingSearchParams({ q: ["a", "b"] }).q, "a");
});

test("hours sort Monday first, and today is the Douala weekday", () => {
  const rows = sortedHours([
    { day: "sunday", openTime: "10:00", closeTime: "14:00", isClosed: false },
    { day: "monday", openTime: "08:00", closeTime: "18:00", isClosed: false },
  ]);
  assert.deepEqual(rows.map((r) => r.day), ["monday", "sunday"]);
  assert.deepEqual(sortedHours(null), []);
  // 2026-11-08 23:30 UTC is already Monday 00:30 in Douala (UTC+1).
  assert.equal(todayIn("Africa/Douala", new Date("2026-11-08T23:30:00Z")), "monday");
});
