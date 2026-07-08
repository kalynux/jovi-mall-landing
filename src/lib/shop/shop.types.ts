/**
 * Shop domain types.
 *
 * Shapes mirror the jovi-mall backend's serialized catalog model:
 *  - product `type` ∈ physical | digital | service
 *  - price / stock / compareAt / sku live on VARIANTS, not the product
 *  - `category` is free-text (no taxonomy)
 *
 * Fields marked `MOCK` do NOT exist in the backend today (no reviews/ratings/
 * sales/delivery-label). They are kept isolated so a real API swap is clean.
 */

export type ProductType = "physical" | "digital" | "service";

export interface Vendor {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  products: number;
  verified: boolean;
  isOpen: boolean;
  banner: string;
  desc: string;
  agency: string | null;
  whatsapp: string;
  rating: number; // MOCK
  reviews: number; // MOCK
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface Variant {
  id: string;
  name: string;
  price: number;
  compareAt?: number | null;
  stock: number;
  sku: string;
  format?: string; // digital: e.g. "PDF · 32 MB"
}

export interface DigitalConfig {
  license: string;
  access: string;
  downloads: number;
  platforms: string;
}

export interface ServiceConfig {
  duration: number; // minutes
  mode: string; // calendar | manual | capacity
  location: string;
  buffer: number; // minutes
}

export interface Product {
  id: string;
  slug: string;
  vendorId: string;
  type: ProductType;
  category: string;
  title: string;
  desc: string;
  images: string[];
  price: number; // headline price (from default variant)
  compareAt?: number | null;
  inStock: boolean;
  options: ProductOption[];
  variants: Variant[];
  delivery?: string; // physical, MOCK label
  digital?: DigitalConfig;
  service?: ServiceConfig;
  rating: number; // MOCK
  reviews: number; // MOCK
  sales: number; // MOCK
}

export type SortKey =
  | "Relevance"
  | "Popularity"
  | "Newest"
  | "Price: low to high"
  | "Price: high to low";

export interface ProductListQuery {
  category?: string;
  q?: string;
  types?: ProductType[];
  delivery?: boolean;
  inStock?: boolean;
  priceMax?: number;
  minRating?: number;
  sort?: SortKey;
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ProductListResponse {
  data: Product[];
  meta: ListMeta;
}

export type CartKey = "physical" | "digital";

export interface CartItem {
  productId: string;
  variantId: string;
  qty: number;
}

export type Carts = Record<CartKey, CartItem[]>;
