/**
 * The browse URL ⇄ API query translation, in one place.
 *
 * `/shop` reads its state from `searchParams` and `ShopBrowser` writes it back
 * there, so the two must agree exactly on what a URL means. Keeping the parse
 * and the serialise beside each other is what makes that checkable: every key
 * this file reads, it also writes.
 *
 * Two rules the shapes below encode:
 *
 *  - **A parameter the API does not support is dropped, not approximated.** The
 *    old filter panel offered a minimum rating, a "delivery available" toggle
 *    and a `popularity` sort. None of the three has a query parameter behind it
 *    (there is no review system, `freeDelivery` is not filterable, and nothing
 *    tracks sales — `sort=popularity` is a `400`). Silently ignoring them would
 *    have shown a shopper an active filter that changed nothing.
 *  - **Defaults are omitted from the URL.** `?page=1&sort=newest` and `/shop`
 *    describe the same page, and only one of them should exist.
 */
import { isSortKey, type ProductListQuery, type ProductType, type SortKey } from "./shop.types";

export const DEFAULT_SORT: SortKey = "newest";
export const PAGE_SIZE = 24;

const PRODUCT_TYPES: readonly ProductType[] = ["physical", "digital", "service"];

/** Sort values are a wire contract; these are what a shopper reads instead. */
export const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "relevance", label: "Best match" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveInt(value: string | string[] | undefined): number | undefined {
  const raw = one(value);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function types(value: string | string[] | undefined): ProductType[] | undefined {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const flat = raw
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v): v is ProductType => (PRODUCT_TYPES as readonly string[]).includes(v));
  return flat.length ? Array.from(new Set(flat)) : undefined;
}

/**
 * Read a browse query out of a URL.
 *
 * Every value is validated rather than passed through: these params reach an
 * unauthenticated aggregation, and while the API validates them too, a bad value
 * should render a sensible page here rather than surface a 400 to a shopper who
 * only edited a URL. `relevance` without a `q` is downgraded to the default —
 * there is nothing to rank by, and the API would be sorting on an absent score.
 */
export function parseProductSearchParams(params: SearchParams): ProductListQuery {
  const q = one(params.q);
  const sortRaw = one(params.sort);
  const sort = isSortKey(sortRaw) ? sortRaw : DEFAULT_SORT;

  const minPrice = positiveInt(params.minPrice);
  const maxPrice = positiveInt(params.maxPrice);

  return {
    ...(q ? { q } : {}),
    ...(one(params.category) ? { category: one(params.category) } : {}),
    ...(types(params.type) ? { type: types(params.type) } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    // A reversed band is a 400 at the API. Dropping the upper bound keeps the
    // page rendering and leaves the lower one, which is the half the shopper
    // most likely meant.
    ...(maxPrice !== undefined && (minPrice === undefined || minPrice <= maxPrice) ? { maxPrice } : {}),
    ...(one(params.inStock) === "true" ? { inStock: true } : {}),
    sort: sort === "relevance" && !q ? DEFAULT_SORT : sort,
    page: Math.max(1, positiveInt(params.page) ?? 1),
    limit: PAGE_SIZE,
  };
}

/**
 * Write a browse query back into a URL, defaults omitted.
 *
 * `limit` is never serialised — it is ours, not the shopper's, and a hand-edited
 * one would only widen a page nobody asked to widen.
 */
export function buildProductSearchParams(query: ProductListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.type?.length) params.set("type", query.type.join(","));
  if (typeof query.minPrice === "number") params.set("minPrice", String(query.minPrice));
  if (typeof query.maxPrice === "number") params.set("maxPrice", String(query.maxPrice));
  if (query.inStock) params.set("inStock", "true");
  if (query.sort && query.sort !== DEFAULT_SORT) params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params.toString();
}

/** How many filters are on, for the "Filters (3)" affordance. */
export function activeFilterCount(query: ProductListQuery): number {
  return (
    (query.type?.length ?? 0) +
    (query.inStock ? 1 : 0) +
    (typeof query.minPrice === "number" ? 1 : 0) +
    (typeof query.maxPrice === "number" ? 1 : 0)
  );
}
