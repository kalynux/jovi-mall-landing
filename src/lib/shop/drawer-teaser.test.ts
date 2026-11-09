/**
 * The shop ⇄ listings drawers (lib/shop/drawer-teaser.ts).
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  listingTeaserItems,
  nextTeaserIndex,
  productTeaserItems,
  pullCommits,
  pullProgress,
} from "./drawer-teaser";
import type { PublicListingCard } from "./listings";
import type { ProductListItem } from "./shop.types";

test("a pull toward the inline start opens the drawer, the other way does nothing", () => {
  assert.equal(pullProgress(-100, 400, false), 0.25);
  assert.equal(pullProgress(100, 400, false), 0);
  assert.equal(pullProgress(-900, 400, false), 1);
  // Arabic: the drawer comes in from the left, so it is pulled to the right.
  assert.equal(pullProgress(100, 400, true), 0.25);
  assert.equal(pullProgress(-100, 400, true), 0);
  // A zero or unknown distance never divides.
  assert.equal(pullProgress(-100, 0, false), 0);
  assert.equal(pullProgress(-100, Number.NaN, false), 0);
});

test("only a real drag past a quarter opens it", () => {
  assert.equal(pullCommits(0.3, true), true);
  assert.equal(pullCommits(0.25, true), true);
  assert.equal(pullCommits(0.2, true), false);
  // A tap is handled by the click, never by the release.
  assert.equal(pullCommits(1, false), false);
});

test("the rotation wraps, and a single face stays put", () => {
  assert.equal(nextTeaserIndex(0, 3), 1);
  assert.equal(nextTeaserIndex(2, 3), 0);
  assert.equal(nextTeaserIndex(0, 1), 0);
  assert.equal(nextTeaserIndex(4, 0), 0);
});

test("a listing face names the business and its city, and skips a blank one", () => {
  const base = {
    id: "l1",
    slug: "plumbing",
    title: "Plumbing",
    companyName: "Test Pro",
    city: "Yaoundé",
    photo: null,
  } as unknown as PublicListingCard;
  const [face] = listingTeaserItems([base]);
  assert.equal(face.title, "Plumbing");
  assert.equal(face.subtitle, "Test Pro · Yaoundé");
  assert.equal(face.image, null);
  assert.match(face.href, /plumbing/);
  assert.equal(listingTeaserItems([{ ...base, city: " " }])[0].subtitle, "Test Pro");
});

test("a product face quotes the lowest price of a range", () => {
  const p = {
    id: "p1",
    slug: "water-bottle",
    title: "Water Bottle",
    price: 9000,
    priceRange: { min: 6500, max: 9000 },
    currency: "XAF",
    image: null,
    store: { slug: "ulrich-shop", name: "Ulrich Shop" },
  } as unknown as ProductListItem;
  const [face] = productTeaserItems([p]);
  assert.match(face.subtitle, /6[\s  ]?500/);
  assert.match(face.subtitle, /Ulrich Shop$/);
  assert.match(face.href, /ulrich-shop/);
});
