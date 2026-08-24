/**
 * Saved products and recently viewed — `/api/customer/{wishlist,recently-viewed}`.
 *
 * Seven routes, all behind `requireAuth` + `requireRole(['customer'])`. The owner
 * is resolved from `req.auth.role_entity._id` server-side, so there is no path
 * segment or body field naming a customer anywhere below — nothing to pass, and
 * nothing to get wrong.
 *
 * Both lists return the **same entry shape**, and the `product` inside it is
 * byte-identical to a `GET /api/public/products` row because the same builder
 * produces both. That is deliberate: the storefront never grows a second product
 * shape, and everything in `public/catalog.md` about that card applies here —
 * including that `inStock` is a boolean and never a count.
 *
 * See api-doc/customer/saved-and-viewed.md.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { ListMeta, ProductListItem } from "./shop.types";

/**
 * One row of either list.
 *
 * 🔴 **`product` is nullable and that is a feature, not an error.** Nothing
 * cascades into these collections — a vendor can archive a listing, an agency
 * can suspend one over unpaid storage, an administrator can take one down — so
 * a row outlives its product and the read degrades it rather than dropping it.
 * `productId` and `at` survive; `product` becomes `null`.
 *
 * The list therefore **does not shrink**: a customer who saved twelve things
 * sees twelve rows and `meta.total` matches what is rendered. Dropping
 * unresolvable rows was the rejected alternative, precisely because the totals
 * stop matching.
 *
 * Deleted and merely-suspended are deliberately indistinguishable — telling them
 * apart would leak a vendor's catalogue state to anyone who once saved a
 * product.
 */
export interface CustomerCatalogEntry {
  /** Always present, even when the product is gone. */
  productId: string;
  /** Wishlist: saved at. Recently viewed: last opened at. */
  at: string;
  /** A `/api/public/products` card, or `null` — see the note above. */
  product: ProductListItem | null;
}

/** `?page` (>= 1, default 1) and `?limit` (1–100, default 20) on both lists. */
export interface CatalogListQuery {
  page?: number;
  limit?: number;
}

function listQuery(query: CatalogListQuery = {}): string {
  const qs = new URLSearchParams();
  if (query.page !== undefined) qs.set("page", String(query.page));
  if (query.limit !== undefined) qs.set("limit", String(query.limit));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/* ── Wishlist ─────────────────────────────────────────────────────────────── */

/** GET /api/customer/wishlist — newest save first. */
export async function listWishlist(
  query: CatalogListQuery = {},
): Promise<{ data: CustomerCatalogEntry[]; meta: ListMeta }> {
  return apiFetchList<CustomerCatalogEntry>(`/api/customer/wishlist${listQuery(query)}`);
}

/**
 * POST /api/customer/wishlist — save a product.
 *
 * **Answers `200`, not `201`, and is idempotent.** Saving something already
 * saved returns the same entry rather than a `409`: from the customer's side
 * "it is saved" was already true, and a double-tap must not surface as a
 * failure for an operation that succeeded. That idempotency is a unique index
 * on `(customer_id, product_id)`, not a check-then-write, so two racing taps
 * cannot leave the same product twice.
 *
 * Saving does **not** require the product to be in stock or its store to be
 * open. The one gate is publishability: a product the caller could never have
 * been shown answers `404 CATALOG_PRODUCT_NOT_FOUND`.
 */
export async function saveProduct(productId: string): Promise<CustomerCatalogEntry> {
  return apiFetch<CustomerCatalogEntry>("/api/customer/wishlist", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
}

/**
 * POST /api/customer/wishlist/saved-among — which of these are saved.
 *
 * **One call per rendered grid, not one per card** — that is the whole reason it
 * exists. It is a `POST` because 100 ids is ~2.5 KB of query string; it reads
 * and writes nothing, so the verb is transport rather than semantics.
 *
 * Accepts 1–100 ids. Callers holding more must chunk; `savedAmongAll` does.
 */
export async function savedAmong(productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return [];
  const data = await apiFetch<{ savedProductIds?: string[] }>(
    "/api/customer/wishlist/saved-among",
    { method: "POST", body: JSON.stringify({ productIds }) },
  );
  return Array.isArray(data?.savedProductIds) ? data.savedProductIds : [];
}

/** The validator's ceiling. More than this in one body is a `400`. */
const SAVED_AMONG_MAX_IDS = 100;

/**
 * `savedAmong` for any number of ids, chunked to the validator's limit.
 *
 * A grid never renders 100 cards, but the sign-in replay walks the whole local
 * wishlist and a long-lived anonymous list can exceed it.
 */
export async function savedAmongAll(productIds: string[]): Promise<string[]> {
  const unique = [...new Set(productIds)];
  const out: string[] = [];
  for (let i = 0; i < unique.length; i += SAVED_AMONG_MAX_IDS) {
    out.push(...(await savedAmong(unique.slice(i, i + SAVED_AMONG_MAX_IDS))));
  }
  return out;
}

/**
 * DELETE /api/customer/wishlist/:productId
 *
 * `404 WISHLIST_ITEM_NOT_FOUND` when it is not on the list — **and that is also
 * the answer for another customer's row.** Every query is scoped by
 * `customer_id`, so the delete simply matches nothing; a `403` would confirm the
 * row exists.
 */
export async function unsaveProduct(productId: string): Promise<void> {
  await apiFetch<unknown>(`/api/customer/wishlist/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
}

/* ── Recently viewed ──────────────────────────────────────────────────────── */

/** GET /api/customer/recently-viewed — most recently opened first. */
export async function listRecentlyViewed(
  query: CatalogListQuery = {},
): Promise<{ data: CustomerCatalogEntry[]; meta: ListMeta }> {
  return apiFetchList<CustomerCatalogEntry>(
    `/api/customer/recently-viewed${listQuery(query)}`,
  );
}

/**
 * POST /api/customer/recently-viewed — record that a product was opened.
 *
 * ⚠ **Carries no timestamp, and cannot be made to.** The list is ordered *and
 * capped* by that value, so a client-supplied "viewed at" would be a
 * client-chosen position in a bounded list — a caller could pin an entry at the
 * head forever, or evict every real entry by claiming a time in the future. The
 * server clock is the only source.
 *
 * **Re-viewing moves an entry to the head; it does not duplicate it.** This is
 * the one behavioural difference from the wishlist: a wishlist keeps its
 * original timestamp because tapping save twice is not a new decision, whereas a
 * history is ordered by when you last looked.
 *
 * Same publishability gate as the wishlist — an unpublishable product is a
 * `404`. Recording is best-effort telemetry from the UI's point of view, so
 * callers should not surface a failure here; see `recordView`.
 */
export async function recordRecentlyViewed(productId: string): Promise<CustomerCatalogEntry> {
  return apiFetch<CustomerCatalogEntry>("/api/customer/recently-viewed", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
}

/**
 * Record a view and swallow every failure.
 *
 * Opening a product page must never fail because the history write did. The
 * cases are all benign: a `404` for a product that just became unpublishable, a
 * `403` for a session that ended between render and effect, or no network at
 * all.
 */
export async function recordView(productId: string): Promise<void> {
  try {
    await recordRecentlyViewed(productId);
  } catch {
    /* history is not worth an error surface */
  }
}

/**
 * DELETE /api/customer/recently-viewed — forget everything.
 *
 * Also clears the legacy `Customer.recent_product_code` server-side: leaving
 * that set would make the profile still answer "the last thing you looked at"
 * after the person asked for exactly that to be forgotten.
 *
 * @returns how many rows were removed
 */
export async function clearRecentlyViewed(): Promise<number> {
  const data = await apiFetch<{ removed?: number }>("/api/customer/recently-viewed", {
    method: "DELETE",
  });
  return typeof data?.removed === "number" ? data.removed : 0;
}

/**
 * 🔴 The cap is the entire retention policy.
 *
 * `CUSTOMER_RECENTLY_VIEWED_CAP`, default 20, enforced on write by evicting the
 * oldest. **There is no TTL and no age-based pruning** — a cap rather than a
 * time window is deliberate, because a TTL prunes on Mongo's own schedule and a
 * customer browsing quickly would see a list that is sometimes 20 long and
 * sometimes 200.
 *
 * ⚠ **A cap is not a page size.** `?limit` is how many rows you fetch; this is
 * how many rows exist. Asking for `?limit=100` returns at most 20.
 */
export const RECENTLY_VIEWED_CAP = 20;
