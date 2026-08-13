/**
 * Shop catalog data access — endpoint-shaped async accessors.
 *
 * **This is the seam.** Everything that reads catalogue data goes through here,
 * and this is the only module allowed to import `catalog.mock`. When the public
 * catalog endpoints land, the bodies below become `apiFetch` calls (the pattern
 * is `src/lib/auth/auth.api.ts` and `src/lib/shop/orders.api.ts`) and no page
 * changes — that is the entire point of routing even the synchronous lookups
 * through this file rather than letting components import the fixtures.
 *
 * The endpoints these functions are waiting on:
 *   listProducts        → GET /api/public/products?q&category&type&sort&page&limit
 *   getProductBySlug    → GET /api/public/products/:idOrSlug
 *   getVendorBySlug     → GET /api/public/stores/:slug
 *   listVendorProducts  → GET /api/public/stores/:slug/products
 *   getCategories       → GET /api/public/categories
 *   getRelatedProducts  → (no endpoint sketched; see B13 in the plan)
 *
 * Until they exist, `CATALOG_IS_MOCK` is true and the UI says so.
 */
import { categories, products, sorts, vendors } from "./catalog.mock";
import type {
  Product,
  ProductListQuery,
  ProductListResponse,
  SortKey,
  Vendor,
} from "./shop.types";

/**
 * Whether the catalogue on screen is invented.
 *
 * Read by `/shop` to show the demo banner and by `sitemap.ts` to keep fake
 * product and store URLs out of the index. Flip to `false` in the same commit
 * that wires the real endpoints — a real catalogue behind a "demo data" notice
 * is as wrong as a fake one without it.
 */
export const CATALOG_IS_MOCK = true;

function applyQuery(list: Product[], q: ProductListQuery): Product[] {
  let items = list.slice();
  if (q.category && q.category !== "All") items = items.filter((p) => p.category === q.category);
  if (q.q) {
    const needle = q.q.toLowerCase();
    items = items.filter((p) => {
      const vendor = vendors.find((v) => v.id === p.vendorId);
      return (p.title + " " + p.category + " " + (vendor?.name ?? "")).toLowerCase().includes(needle);
    });
  }
  if (q.types && q.types.length) items = items.filter((p) => q.types!.includes(p.type));
  if (q.delivery) items = items.filter((p) => Boolean(p.delivery));
  if (q.inStock) items = items.filter((p) => p.inStock);
  if (typeof q.priceMax === "number") items = items.filter((p) => p.price <= q.priceMax!);
  if (typeof q.minRating === "number") items = items.filter((p) => p.rating >= q.minRating!);

  switch (q.sort as SortKey | undefined) {
    case "Price: low to high":
      items.sort((a, b) => a.price - b.price);
      break;
    case "Price: high to low":
      items.sort((a, b) => b.price - a.price);
      break;
    case "Popularity":
      items.sort((a, b) => b.sales - a.sales);
      break;
    default:
      break;
  }
  return items;
}

/** List/browse products with filters, search and sort. */
export async function listProducts(query: ProductListQuery = {}): Promise<ProductListResponse> {
  const data = applyQuery(products, query);
  return {
    data,
    meta: { total: data.length, page: 1, limit: data.length, pages: 1 },
  };
}

/** Fetch a single product by its descriptive slug (id fallback). */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  return products.find((p) => p.slug === slug || p.id === slug) ?? null;
}

/** Fetch a vendor by its descriptive slug (id fallback). */
export async function getVendorBySlug(slug: string): Promise<Vendor | null> {
  return vendors.find((v) => v.slug === slug || v.id === slug) ?? null;
}

export async function getVendorById(id: string): Promise<Vendor | null> {
  return vendors.find((v) => v.id === id) ?? null;
}

/** Products belonging to a vendor. */
export async function listVendorProducts(vendorId: string): Promise<Product[]> {
  return products.filter((p) => p.vendorId === vendorId);
}

/** Related products: same vendor first, then others. */
export async function getRelatedProducts(product: Product, limit = 5): Promise<Product[]> {
  const sameVendor = products.filter((p) => p.vendorId === product.vendorId && p.id !== product.id);
  const others = products.filter((p) => p.vendorId !== product.vendorId);
  return sameVendor.concat(others).slice(0, limit);
}

export async function getCategories(): Promise<string[]> {
  return categories;
}

export async function getSorts(): Promise<SortKey[]> {
  return sorts;
}

export async function getVendors(): Promise<Vendor[]> {
  return vendors;
}

// ─── Synchronous accessors ───────────────────────────────────────────────────
// Client components render from data they already hold, so these stay sync.
// They exist here rather than as fixture imports so the mock has exactly one
// consumer: when the catalogue goes real these become lookups into whatever the
// page already fetched, and the call sites keep their shape.

export function findProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function findVendorById(id: string): Vendor | undefined {
  return vendors.find((v) => v.id === id);
}

/** Every product, unfiltered — for client pages that filter locally. */
export function allProducts(): Product[] {
  return products;
}

/** The category chips. Free text server-side; there is no taxonomy entity. */
export function allCategories(): string[] {
  return categories;
}

/** The sort options the browse toolbar offers. */
export function allSorts(): SortKey[] {
  return sorts;
}
