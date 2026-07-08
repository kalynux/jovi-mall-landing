/**
 * Shop data access — endpoint-shaped async accessors.
 *
 * Reads from the mock fixtures today. The bodies are structured so each can
 * later become a real `apiFetch` call against a public catalog endpoint
 * (mirroring the pattern in src/lib/auth/auth.api.ts: NEXT_PUBLIC_API_URL,
 * credentials: "include", structured errors) with the same return shapes.
 */
import { categories, products, sorts, vendors } from "./shop.fixtures";
import type {
  Product,
  ProductListQuery,
  ProductListResponse,
  SortKey,
  Vendor,
} from "./shop.types";

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

// Synchronous helpers for client components that already hold the fixtures.
export function findProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function findVendorById(id: string): Vendor | undefined {
  return vendors.find((v) => v.id === id);
}
