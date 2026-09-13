/**
 * Storefront catalog types — the wire shapes of `/api/public/*`.
 *
 * Contract: `api-doc/public/catalog.md`. These describe what the API actually
 * sends, so there is no translation layer between fetch and render; where the
 * wire omits a key rather than nulling it, the type says `?:`, and where it
 * sends an explicit `null` because absent is a state the UI draws, it says
 * `| null`. That distinction is deliberate on the backend's side and copying it
 * here is what keeps "not discounted" separable from "we forgot to send it".
 *
 * ── What is NOT here, and why ────────────────────────────────────────────────
 *
 * The previous version of this file carried `rating`, `reviews`, `sales` and a
 * `delivery` label marked `// MOCK`. Nothing tracks sales and delivery has no
 * per-product label, so those stay deleted rather than sit here as optional
 * fields that would quietly invite a component to render a zero.
 *
 * `rating` is back, and it is real this time — the review system shipped in
 * backend Phase 6 · 6.E.4, so every product row and detail body carries it. It
 * is `null` when nobody has reviewed the product and **never a zero-count
 * object**, which is the property the JSON-LD depends on.
 *
 * There is also no stock **count**. `inStock` is a boolean everywhere, because a
 * precise count on a page cached for five minutes is wrong the moment it is
 * read. See catalog.md decision 3.
 */
import type { ListMeta } from "@/lib/api/client";

export type { ListMeta };

export type ProductType = "physical" | "digital" | "service";

/**
 * How a stored file may be read (api-doc/files/private-files.md § 1).
 *
 * `public` carries a URL anything can fetch. `authorized` carries **no URL at
 * all** — the bytes are reachable only through a route that checks who is
 * asking, which for a customer is the digital-download token flow.
 *
 * 🔴 **`quota_blocked` is a third value, and it is not about privacy.** The
 * file's *owner* — a vendor or an agency — is over their plan's storage cap, so
 * this file is one of the ones being held back. `url` is `null` exactly as for
 * `authorized`, but no authorized route will serve it either: nothing is wrong
 * with the caller's permissions.
 *
 * Two things follow, and both are easy to get wrong:
 *
 *  - **It reaches PUBLIC trees.** The quota check and the tree classification are
 *    independent, so an ordinary product photo in `images/` can come back
 *    blocked. A client that only expects `null` on the digital surface shows
 *    holes on product cards.
 *  - **It is tested FIRST**, before the private-tree check, so a blocked file
 *    inside a private tree reports `quota_blocked` rather than `authorized`.
 *
 * Nothing was deleted — the row, the bytes and the owner's used-storage total all
 * survive, and an upgrade restores the same file. Never say "deleted" or
 * "missing" for one; see {@link fileUnavailableReason}.
 */
export type FileAccess = "public" | "authorized" | "quota_blocked";

/**
 * A file resolved by the backend's file service.
 *
 * ⚠ **`url` is `string | null`, and it used to always be a string.**
 * Since Phase 4 the `digital/` and `shipments/` trees are served from a guarded
 * mount, so their files resolve with no URL. `url` and `access` derive from the
 * same predicate server-side and can never disagree:
 *
 * ```ts
 * url    = isPrivate ? null : storage.getPublicUrl(file.key)
 * access = isPrivate ? 'authorized' : 'public'
 * ```
 *
 * The backend chose a *type* change over a differently-shaped string on purpose:
 * an authorized path looks exactly like a public one, so a client keeping
 * `<img src={url}>` would have rendered nothing for signed-out visitors and
 * failed silently. `null` fails at the point of use instead.
 *
 * 🔴 **`url === null` does not mean "no file".** `id`, `key`, `mimeType`, `size`
 * and `originalName` are all still populated — render a name and a download
 * action, never an empty slot. Use {@link publicUrl} rather than reading `url`.
 *
 * For this app the practical impact is narrow: product imagery, avatars, store
 * logos and banners are **public and unchanged**. Digital product assets and
 * delivery-proof photos are not.
 */
export interface FileDetail {
  id: string;
  key?: string;
  /**
   * A string **iff** `access === "public"`. `null` for both of the other two,
   * which mean different things — see {@link fileUnavailableReason}.
   */
  url: string | null;
  /**
   * Always present on the wire. Branch on this, never on `url`.
   *
   * Required rather than optional on purpose: it was `access?` while the union
   * had two members, and an optional field is exactly how a client stops
   * noticing that the server grew a third.
   */
  access: FileAccess;
  mimeType?: string;
  size?: number;
  originalName?: string;
}

/**
 * The URL to put in an `<img>` or an `<a href>`, or `null` if there isn't one.
 *
 * **An allowlist, not a denylist.** It returns a URL only for `access: "public"`,
 * so a value this build has never heard of — the way `quota_blocked` arrived —
 * resolves to `null` rather than to a path the client then fails to fetch. The
 * previous shape excluded `"authorized"` by name and would have handed a caller
 * the `url` of anything added after it was written.
 *
 * Accepts `null`/`undefined` so callers can pass an optional file straight
 * through without a guard of their own. **Never read `file.url` directly.**
 */
export function publicUrl(file: FileDetail | null | undefined): string | null {
  if (!file || file.access !== "public") return null;
  return file.url ?? null;
}

/**
 * Why {@link publicUrl} gave you nothing — for the screens whose copy differs.
 *
 * `null` means there was no file at all, which is the ordinary empty state.
 * The other two are a file that **exists** and cannot be shown here, and they
 * need different sentences:
 *
 *  - `"authorized"` — private tree. Fetch it through the route that checks who
 *    is asking (for a customer, the digital-download token flow).
 *  - `"blocked"` — the owner is over their storage plan. Say *"locked — over the
 *    storage limit"*. **Never "deleted" or "missing"**: nothing was removed, and
 *    an upgrade brings it straight back.
 *
 * On the public storefront neither distinction is worth showing a shopper — a
 * blocked product photo gets the same placeholder as a product with no photo,
 * because a vendor's billing state is not a customer's business. It matters on
 * the account screens, where the file is the point: a ticket attachment, a
 * digital asset the customer paid for.
 */
export function fileUnavailableReason(
  file: FileDetail | null | undefined,
): "authorized" | "blocked" | null {
  if (!file || file.access === "public") return null;
  return file.access === "quota_blocked" ? "blocked" : "authorized";
}


export interface PriceRange {
  min: number;
  max: number;
}

/**
 * The published-review aggregate for a product.
 *
 * 🔴 **`null`, never a zero-count object.** A product nobody has reviewed
 * carries `rating: null`, exactly as one with no rating data at all would. That
 * is deliberate on the backend's side and it is what makes the JSON-LD rule
 * unmissable: emit `aggregateRating` if and only if this is non-null.
 * Synthesising `ratingValue: 0` / `reviewCount: 0` from a null is a Google
 * review-snippet spam-policy violation that earns a manual action.
 *
 * `average` is carried to **two decimals**, not one — the same number feeds the
 * agent trust composite, not just a star widget.
 */
export interface ProductRating {
  average: number;
  count: number;
  /**
   * The 1–5 histogram. **Detail bodies only** — a list row carries
   * `{ average, count }` and no distribution, because a grid has nowhere to
   * draw one.
   */
  distribution?: Record<"1" | "2" | "3" | "4" | "5", number>;
}

/** The seller as a product row carries them. Never a `vendorId` — see catalog.md. */
export interface ProductStoreRef {
  slug: string;
  name: string;
  /** Vendor vacation mode. Does **not** hide the product; it is a flag to render. */
  isOpen: boolean;
}

/** One row of `GET /api/public/products`. */
export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  type: ProductType;
  category: string;
  tags: string[];

  /** Resolved from the default variant — a product itself has no price. */
  price: number;
  /** `null` when not discounted. */
  compareAtPrice: number | null;
  currency: string;
  /** **Omitted** when every sellable variant costs the same. */
  priceRange?: PriceRange;
  inStock: boolean;

  /** Thumbnail only. `null` when the product has no usable image. */
  image: FileDetail | null;

  /**
   * `{ average, count }` — no distribution on a row. `null` when unreviewed;
   * the key is always present.
   */
  rating: ProductRating | null;

  store: ProductStoreRef;

  freeDelivery: boolean;
  /** Real `lastModified` for the sitemap. */
  updatedAt: string;
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export interface OptionValue {
  id: string;
  value: string;
}

export interface ProductOption {
  id: string;
  name: string;
  position: number;
  values: OptionValue[];
}

/** A variant's selection, pre-joined by the API so no client joins anything. */
export interface VariantOption {
  optionId: string;
  optionName: string;
  valueId: string;
  value: string;
}

/** Digital terms of sale. Never the asset itself. */
export interface DigitalTerms {
  maxDownloads: number | null;
  expiresAfterDays: number | null;
}

/**
 * Service terms.
 *
 * ⚠️ `Variant.price` on a service is a **unit rate**, not a total: the price per
 * `durationMinutes`, prorated by actual duration and surcharged at peak hours.
 * Render `priceFrom` with `priceUnit`, never the bare price.
 */
export interface ServiceTerms {
  durationMinutes: number;
  bookingMode: "calendar" | "manual" | "capacity";
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  /** An English convenience label ("per 1 h 30 min"). Not localized. */
  priceUnit: string;
  priceFrom: number;
}

export interface Variant {
  id: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  inStock: boolean;

  /**
   * ⚠️ **The selection key.** Match a variant on this set — never on a signature
   * rebuilt from displayed option text. Renaming an option value is a documented
   * safe operation that deliberately does not rewrite the stored signature, so a
   * client matching on text fails to find a variant that exists. The API does not
   * publish `optionSignature` at all.
   */
  optionValueIds: string[];
  options: VariantOption[];

  /** Variant media. **Omitted** when it has none — the product gallery applies. */
  images?: FileDetail[];
  digital?: DigitalTerms;
  service?: ServiceTerms;
}

/** The buyer-facing half of a vendor's return policy. Structured, not prose. */
export interface ReturnPolicy {
  eligible: boolean;
  windowDays: number;
  refundType: "full" | "partial" | "none";
  refundPercentage: number | null;
  returnShippingPayer: "vendor" | "customer" | "customer_reimbursed_if_defect";
  refundProcessingDays: number;
  conditionNotes: string | null;
}

export interface CancellationPolicy {
  cancellable: boolean;
  deadline: string | null;
  deadlineDays: number | null;
  feeType: string | null;
  feeValue: number | null;
  lateRefundType: string | null;
  lateRefundValue: number | null;
}

/** The seller card on a product page — richer than the list's. */
export interface ProductStore extends ProductStoreRef {
  logo: FileDetail | null;
  /** `kyc_details.legit_verified`. Never the document behind it. */
  verified: boolean;
  /** The only address component published — the rest is a private address. */
  city: string | null;
  country: string | null;
  supportWhatsapp: string | null;
  policies: {
    returnPolicy: ReturnPolicy | null;
    cancellationPolicy: CancellationPolicy | null;
  };
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ProductType;
  category: string;
  tags: string[];
  /** **Omitted** when the vendor set neither field. */
  seo?: { title?: string; description?: string };

  /**
   * Which language the vendor wrote this product's text in.
   *
   * There is no `Accept-Language` handling on any catalog read and no
   * translation system: product text is vendor-authored in one language, and
   * this says which, so a five-locale storefront can label it honestly rather
   * than present French copy as though it were the Portuguese translation.
   */
  contentLanguage: string;

  /**
   * Carries the 1–5 `distribution` as well as the average and count, so the
   * reviews panel renders its histogram without a second request. `null` when
   * nobody has reviewed it.
   */
  rating: ProductRating | null;

  /** Full gallery, thumbnail first. */
  images: FileDetail[];
  /** Empty on a simple-mode product — skip the picker entirely. */
  options: ProductOption[];
  variants: Variant[];
  /** `null` when no sellable variant is the default. */
  defaultVariantId: string | null;

  store: ProductStore;
  freeDelivery: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Stores ──────────────────────────────────────────────────────────────────

/** `GET /api/public/stores` row and `GET /api/public/stores/:slug` body. */
export interface Store {
  slug: string;
  name: string;
  description: string;
  logo: FileDetail | null;
  banner: FileDetail | null;
  /** Vacation mode. A closed store still lists and still sells. */
  isOpen: boolean;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWhatsapp: string | null;
  country: string | null;
  city: string | null;
  verified: boolean;
  productCount: number;
  /** `store.created_at`. */
  memberSince: string;
}

export interface CategoryCount {
  name: string;
  productCount: number;
}

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * The wire sort values.
 *
 * These are sent verbatim as `?sort=`; they are not display strings. **There is
 * no `popularity`** — nothing tracks sales, and the API answers `400` rather
 * than accepting it and silently returning some other order.
 */
export type SortKey = "newest" | "price_asc" | "price_desc" | "relevance";

export const SORT_KEYS: readonly SortKey[] = [
  "newest",
  "price_asc",
  "price_desc",
  "relevance",
] as const;

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && (SORT_KEYS as readonly string[]).includes(value);
}

export const PRODUCT_TYPES: readonly ProductType[] = ["physical", "digital", "service"] as const;

/**
 * Beside `isSortKey`, and for the same reason: `?type=` arrives as a string
 * from a URL and the API answers 400 for anything outside this set, so it is
 * validated at the boundary rather than cast through it.
 */
export function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && (PRODUCT_TYPES as readonly string[]).includes(value);
}

export interface ProductListQuery {
  /**
   * A MongoDB `$text` search: **whole words only**. `dres` does not match
   * "dress". Debounce on a complete word rather than per keystroke.
   */
  q?: string;
  category?: string;
  type?: ProductType[];
  storeSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Only `true` narrows; `false` means "do not filter". */
  inStock?: boolean;
  sort?: SortKey;
  page?: number;
  /** 1–100, default 20. */
  limit?: number;
}

export interface ProductListResponse {
  data: ProductListItem[];
  meta: ListMeta;
}

export interface StoreListQuery {
  q?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export interface StoreListResponse {
  data: Store[];
  meta: ListMeta;
}

// ─── Cart (client-side shape) ────────────────────────────────────────────────

/**
 * One line of the shopper's cart, as the browser holds it.
 *
 * ⚠️ **There is one cart, not one per product type.** `CartSchema.userId` is
 * uniquely indexed server-side, so a customer has exactly one cart row carrying
 * one `productType`; mixing answers `409 CART_MIXED_PRODUCT_TYPES`. The
 * two-basket shape this file used to carry (`Carts = { physical, digital }`)
 * had no server behind it.
 *
 * The snapshot fields exist so an anonymous cart renders without a catalog
 * round-trip per line. They are display-only — every price is re-resolved from
 * the catalogue at merge and again at checkout, and a `price` sent in a merge
 * body is rejected outright.
 */
export interface CartLine {
  productId: string;
  variantId: string;
  qty: number;
  /** Display snapshot. Never trusted for money. */
  title: string;
  variantName: string;
  price: number;
  currency: string;
  image: string | null;
  productSlug: string;
  storeSlug: string;
  storeName: string;
  /**
   * True when `price` is a number the customer **agreed in chat**, not the shelf
   * price. Purely a label: the amount is already in `price`.
   *
   * Only ever set from a server line — an anonymous cart cannot hold one, which
   * is also why signing in with one drops the agreement. See
   * `ServerCartItem.negotiatedUnitPrice`.
   */
  negotiated?: boolean;
}

/** `null` on an empty cart — the type is only known once something is in it. */
export type CartProductType = "physical" | "digital" | null;

export interface LocalCart {
  productType: CartProductType;
  lines: CartLine[];
}
