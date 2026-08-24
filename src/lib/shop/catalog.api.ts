/**
 * The storefront's read side. Contract: `api-doc/public/catalog.md`.
 *
 * This is the entire public-catalog integration surface — browse, search,
 * product detail, categories and stores. It replaced `catalog.mock.ts`, which
 * existed only because there was no endpoint a shopper could call to read a
 * product; there now is.
 *
 * ── Why this does not use `src/lib/api/client.ts` ────────────────────────────
 *
 * `apiFetch` hardcodes `credentials: "include"` and sets no cache policy, which
 * is right for the authenticated half of the shop and wrong here twice over:
 * these routes carry no auth guard and want no cookies, and they send
 * `Cache-Control: public, max-age=300`, which Next can only honour if we ask it
 * to. So this module has its own transport, matching `lib/blog/blog.api.ts` and
 * `lib/marketing/plans.api.ts` — the two other public readers in this app.
 *
 * ── Why this is NOT `server-only` ────────────────────────────────────────────
 *
 * `blog.api.ts` guards itself with `import "server-only"` because an article
 * fetched in the browser is an article a crawler never reads. Half of this
 * module has the same requirement — the grid, the product page and the store
 * page are server-rendered for exactly that reason — but `/shop/cart` and
 * `/shop/saved` are client components that must resolve products too, and they
 * are `Disallow`ed in robots.txt, so there is nothing to lose by fetching them
 * in the browser. The endpoints are public and `ALLOWED_ORIGINS` includes the
 * storefront origin, so a browser call works. `next: { revalidate }` is simply
 * ignored client-side.
 */
import { API_BASE, type ListMeta } from "@/lib/api/client";
import type {
  CategoryCount,
  Product,
  ProductListItem,
  ProductListQuery,
  ProductListResponse,
  Store,
  StoreListQuery,
  StoreListResponse,
} from "./shop.types";

/** Matches the endpoints' own `Cache-Control: public, max-age=300`. */
export const CATALOG_REVALIDATE_SECONDS = 300;

/**
 * Opt out of the five-minute cache for one render.
 *
 * The vendor dashboard embeds the store and product pages in a preview iframe,
 * and a vendor who saves an edit and immediately previews it must see the edit —
 * not a page that is right for shoppers and up to five minutes stale for them.
 * Reloading cannot fix it from the outside: the data cache is keyed by the API
 * URL, so the same page URL with a cache-buster still hits the same entry.
 *
 * This is a **read-freshness flag only**. It grants no access: an unpublished
 * product still 404s, because the API refuses it, not because we cached it. So
 * it needs no token and cannot leak anything — the worst a stranger can do with
 * `?preview=1` is cost us an uncached read.
 */
export interface CatalogReadOptions {
  fresh?: boolean;
}

/** Reads `?preview=1` off a page's `searchParams`. */
export function isPreviewRequest(
  searchParams: Record<string, string | string[] | undefined> | undefined
): boolean {
  const raw = searchParams?.preview;
  return (Array.isArray(raw) ? raw[0] : raw) === "1";
}

/**
 * The list endpoints' ceiling, and ours whenever we need the whole set rather
 * than a page of it — the sitemap, mainly.
 */
export const CATALOG_MAX_LIMIT = 100;

type ApiError = {
  code: string;
  statusCode: number;
  message?: string;
  details?: Record<string, unknown>;
};

/**
 * A build that cannot reach the catalog fails, rather than publishing an empty
 * shop.
 *
 * Same reasoning as `BlogApiError`: an outage and "this vendor has nothing for
 * sale" render identically, so a soft failure would ship a storefront with no
 * products in it and no signal that anything went wrong.
 */
class CatalogApiError extends Error {
  constructor(url: string, cause: string) {
    super(
      `Could not read the catalog API at ${url}: ${cause}. The shop pages have ` +
        `no fallback content — a build that cannot reach the API must fail rather ` +
        `than publish an empty storefront, which is indistinguishable from one no ` +
        `vendor has listed in yet. Check NEXT_PUBLIC_API_URL and that the API is ` +
        `reachable.`
    );
    this.name = "CatalogApiError";
  }
}

type Envelope<T> = {
  success?: boolean;
  data?: T;
  meta?: Partial<ListMeta>;
  error?: ApiError;
};

type Result<T> =
  | { ok: true; data: T; meta?: Partial<ListMeta> }
  | { ok: false; error: ApiError };

async function request<T>(path: string, options: CatalogReadOptions = {}): Promise<Result<T>> {
  const url = `${API_BASE}${path}`;
  let res: Response;

  try {
    res = await fetch(url, {
      // `cache` and `next.revalidate` are mutually exclusive — passing both is a
      // Next build error, so this picks one.
      ...(options.fresh
        ? { cache: "no-store" as const }
        : { next: { revalidate: CATALOG_REVALIDATE_SECONDS } }),
      headers: { accept: "application/json" },
    });
  } catch (error) {
    throw new CatalogApiError(url, error instanceof Error ? error.message : "network error");
  }

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new CatalogApiError(url, `HTTP ${res.status} with a non-JSON body`);
  }

  if (body.success === true && body.data !== undefined) {
    return { ok: true, data: body.data, meta: body.meta };
  }
  if (body.success === false && body.error) return { ok: false, error: body.error };

  throw new CatalogApiError(url, `HTTP ${res.status}: response was not a { success, data } envelope`);
}

/** For reads where any error is a broken build, not a routing outcome. */
async function getJson<T>(path: string): Promise<T> {
  const result = await request<T>(path);
  if (!result.ok) {
    throw new CatalogApiError(`${API_BASE}${path}`, `${result.error.code} (${result.error.statusCode})`);
  }
  return result.data;
}

/**
 * For the two reads where "not found" is a page, not a failure.
 *
 * A 404 here means draft, archived, suspended, soft-deleted, a suspended vendor,
 * or simply a wrong URL — the API deliberately refuses to distinguish them, so
 * that a competitor cannot enumerate a vendor's unreleased catalogue. All of
 * them are one `notFound()` on our side. A 400 is a malformed slug or id, which
 * is also just a bad URL.
 */
async function getJsonOrNull<T>(path: string, options?: CatalogReadOptions): Promise<T | null> {
  const result = await request<T>(path, options);
  if (result.ok) return result.data;
  if (result.error.statusCode === 404 || result.error.statusCode === 400) return null;
  throw new CatalogApiError(`${API_BASE}${path}`, `${result.error.code} (${result.error.statusCode})`);
}

async function getList<T>(
  path: string,
  options?: CatalogReadOptions
): Promise<{ data: T[]; meta: ListMeta }> {
  const result = await request<T[]>(path, options);
  if (!result.ok) {
    throw new CatalogApiError(`${API_BASE}${path}`, `${result.error.code} (${result.error.statusCode})`);
  }
  const data = Array.isArray(result.data) ? result.data : [];
  const meta = result.meta ?? {};
  return {
    data,
    meta: {
      total: meta.total ?? data.length,
      page: meta.page ?? 1,
      limit: meta.limit ?? data.length,
      pages: meta.pages ?? 1,
    },
  };
}

/* ─── Query building ──────────────────────────────────────────────────────── */

/**
 * `type` goes over the wire comma-separated. The API accepts a repeated param
 * too; one key is tidier in a shareable URL, which is where these end up.
 */
function productQuery(query: ProductListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.type?.length) params.set("type", query.type.join(","));
  if (query.storeSlug) params.set("storeSlug", query.storeSlug);
  if (typeof query.minPrice === "number") params.set("minPrice", String(query.minPrice));
  if (typeof query.maxPrice === "number") params.set("maxPrice", String(query.maxPrice));
  // Only `true` narrows — `?inStock=false` means "don't filter", so sending it
  // would be noise in the URL.
  if (query.inStock) params.set("inStock", "true");
  if (query.sort) params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function storeQuery(query: StoreListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.city) params.set("city", query.city);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/* ─── Products ────────────────────────────────────────────────────────────── */

/** `GET /api/public/products` — the browse grid, search, filters and sort. */
export async function listProducts(query: ProductListQuery = {}): Promise<ProductListResponse> {
  return getList(`/api/public/products${productQuery(query)}`);
}

/**
 * `GET /api/public/stores/:storeSlug/products/:productSlug` — **the canonical
 * product read.**
 *
 * It takes two slugs because `Product.slug` is unique per vendor, not globally:
 * two sellers may both own `blue-shirt`. Resolving the store first also makes
 * the lookup an exact hit on the existing `{ vendorId, slug }` index.
 */
export async function getProduct(
  storeSlug: string,
  productSlug: string,
  options?: CatalogReadOptions
): Promise<Product | null> {
  return getJsonOrNull<Product>(
    `/api/public/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug)}`,
    options
  );
}

/**
 * `GET /api/public/products/:productId` — the same product, by ObjectId.
 *
 * A fallback, not an alternative: use it where we hold an id and not a slug (a
 * link out of an order, a notification, a share sheet, a saved favourite). It
 * returns an identical body, so `/shop/p/:id` can redirect to the canonical URL.
 */
export async function getProductById(
  productId: string,
  options?: CatalogReadOptions
): Promise<Product | null> {
  return getJsonOrNull<Product>(`/api/public/products/${encodeURIComponent(productId)}`, options);
}

/* ─── Categories ──────────────────────────────────────────────────────────── */

/**
 * `GET /api/public/categories` — the chip list, with counts.
 *
 * A bare array with no `meta`: `Product.category` is free text with no taxonomy
 * collection anywhere, so this is derived over the same filter as the browse
 * grid. A category whose every product is a draft does not appear.
 */
export async function listCategories(): Promise<CategoryCount[]> {
  const data = await getJson<CategoryCount[]>("/api/public/categories");
  return Array.isArray(data) ? data : [];
}

/* ─── Stores ──────────────────────────────────────────────────────────────── */

/**
 * `GET /api/public/stores` — the directory, and the sitemap's store feed.
 *
 * Stores with nothing publishable are excluded here (an empty storefront is a
 * soft-404 to a crawler). `getStore` does **not** apply that rule, so a shopper
 * following a link from an order reads "nothing for sale right now" instead of
 * hitting a dead page.
 */
export async function listStores(query: StoreListQuery = {}): Promise<StoreListResponse> {
  return getList(`/api/public/stores${storeQuery(query)}`);
}

/** `GET /api/public/stores/:slug`. `null` when unknown or the vendor is suspended. */
export async function getStore(
  slug: string,
  options?: CatalogReadOptions
): Promise<Store | null> {
  return getJsonOrNull<Store>(`/api/public/stores/${encodeURIComponent(slug)}`, options);
}

/**
 * `GET /api/public/stores/:slug/products` — one store's grid.
 *
 * Same query contract as `listProducts` minus `storeSlug`, which is the path.
 * Throws rather than returning an empty page when the store is not public: the
 * API 404s that case on purpose, because an empty grid would say "this seller
 * has nothing" about a suspended vendor. Callers that render a store page should
 * resolve the store first and `notFound()` on a null there.
 */
export async function listStoreProducts(
  slug: string,
  query: Omit<ProductListQuery, "storeSlug"> = {},
  options?: CatalogReadOptions
): Promise<ProductListResponse> {
  return getList(
    `/api/public/stores/${encodeURIComponent(slug)}/products${productQuery(query)}`,
    options
  );
}

/* ─── Enumeration helpers ─────────────────────────────────────────────────── */

/**
 * Every publishable product, walked page by page — for `sitemap.ts`.
 *
 * `cap` is a real limit, not a formality: this runs at build time against an
 * unauthenticated endpoint, and a catalogue that grows past it needs a sitemap
 * index rather than a bigger number here. Callers should log when it bites.
 */
export async function listAllProducts(cap = 5000): Promise<ProductListResponse["data"]> {
  const all: ProductListResponse["data"] = [];
  let page = 1;
  let pages = 1;

  do {
    const { data, meta } = await listProducts({ page, limit: CATALOG_MAX_LIMIT, sort: "newest" });
    all.push(...data);
    pages = meta.pages;
    page += 1;
  } while (page <= pages && all.length < cap);

  return all.slice(0, cap);
}

/** Every publishable store, walked page by page — for `sitemap.ts`. */
export async function listAllStores(cap = 2000): Promise<Store[]> {
  const all: Store[] = [];
  let page = 1;
  let pages = 1;

  do {
    const { data, meta } = await listStores({ page, limit: CATALOG_MAX_LIMIT });
    all.push(...data);
    pages = meta.pages;
    page += 1;
  } while (page <= pages && all.length < cap);

  return all.slice(0, cap);
}

/**
 * One entry of the related-products strip.
 *
 * `orders` is the number of **distinct past orders** containing both this
 * product and the subject — buying three of something in one order is one piece
 * of evidence, not three. It is `null` whenever the list came from the
 * `same_category` fallback.
 *
 * ⚠ It is computed from a **bounded sample** (the most recent 500 paid orders
 * within a year), so it is evidence of a pattern rather than an audited total.
 * "Bought together 14 times" is fine; "14 customers" is not.
 */
export interface RelatedProduct {
  product: ProductListItem;
  orders: number | null;
}

/**
 * Which signal produced a related strip.
 *
 * 🔴 **This is part of the contract, not diagnostics, and the heading must
 * follow it.** A strip headed "customers also bought" that is really ordered by
 * category recency is a claim about other shoppers that is not true — which is
 * exactly why the backend publishes the label rather than keeping it to itself.
 * It will not make the claim on your behalf, and it will not let you make it by
 * accident.
 *
 * `same_category` is the common case on a young catalogue: most products have
 * never been bought alongside anything yet.
 */
export type RelatedSource = "co_purchase" | "same_category";

/**
 * GET /api/public/products/:productId/related — unauthenticated.
 *
 * An empty `data` is a **`200`**, never a 404: "nothing is related to this yet"
 * is a successful answer. The subject never appears in its own strip, and —
 * unlike a wishlist entry — an unavailable product is **dropped, not degraded**,
 * because nobody chose this list and a card that cannot be bought is just
 * broken.
 *
 * The ranking is cached for six hours but the cards are not, so price, stock and
 * store state are always live.
 */
export async function listRelatedProducts(
  productId: string,
): Promise<{ items: RelatedProduct[]; source: RelatedSource }> {
  const result = await request<RelatedProduct[]>(
    `/api/public/products/${encodeURIComponent(productId)}/related`,
  );

  // A strip is an enhancement, not the page. A subject that has gone off sale
  // answers 404 here, and that must not take down a product page that rendered
  // fine from its own read.
  if (!result.ok) return { items: [], source: "same_category" };

  const meta = result.meta as (Partial<ListMeta> & { source?: RelatedSource }) | undefined;

  // Default to the fallback label: claiming co-purchase without being told so is
  // the one mistake this field exists to prevent.
  return {
    items: Array.isArray(result.data) ? result.data : [],
    source: meta?.source === "co_purchase" ? "co_purchase" : "same_category",
  };
}
