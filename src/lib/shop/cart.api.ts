/**
 * The server cart. Contract: `api-doc/customer/cart.md`.
 *
 * Cookie-authenticated and `requireRole(['customer'])`, so every call here is
 * for a signed-in shopper. The anonymous half lives in `CartProvider`, which
 * holds a localStorage cart and hands it over once via `mergeCart` at sign-in.
 *
 * ── Two path shapes that look like typos and are not ─────────────────────────
 *
 *   DELETE /items/variant/:variantId   removes ONE line
 *   DELETE /items/:productId           removes EVERY variant of a product
 *
 * They are separate paths rather than one `/items/:id` because a single route
 * taking either kind of id cannot tell them apart — a client sending a productId
 * where a variantId was meant would get a silent mass-delete instead of an
 * error. A cart row calls the first one.
 *
 * And `POST /items` **increments**; `PATCH /items/:variantId` sets an absolute
 * quantity. Both exist and mean different things: `POST` is "add to cart" from a
 * product page, `PATCH` is the stepper saying "I want exactly this many".
 */
import { apiFetch, apiFetchWithMeta } from "@/lib/api/client";
import type {
  CartQuote,
  CartDroppedLine,
  MergeCartResult,
  ServerCart,
} from "./customer.types";

/** `GET /api/customer/cart`. An empty cart is a 200 with `items: []`, never a 404. */
export async function getCart(): Promise<ServerCart> {
  return apiFetch<ServerCart>("/api/customer/cart");
}

export interface AddCartItemPayload {
  productId: string;
  variantId: string;
  quantity?: number;
  currency?: string;
}

/** `POST /api/customer/cart/items` — adds, or **increments** an existing line. */
export async function addCartItem(payload: AddCartItemPayload): Promise<ServerCart> {
  return apiFetch<ServerCart>("/api/customer/cart/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * `PATCH /api/customer/cart/items/:variantId` — the stepper.
 *
 * Absolute, not a delta, and `0` is refused: removing is a different intention
 * and has its own call. Note the snapshot price is deliberately *not* refreshed
 * here — it is re-resolved at checkout, which is the moment that binds.
 */
export async function setCartItemQuantity(variantId: string, quantity: number): Promise<ServerCart> {
  return apiFetch<ServerCart>(`/api/customer/cart/items/${encodeURIComponent(variantId)}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

/** `DELETE /api/customer/cart/items/variant/:variantId` — remove one line. */
export async function removeCartVariant(variantId: string): Promise<ServerCart> {
  return apiFetch<ServerCart>(`/api/customer/cart/items/variant/${encodeURIComponent(variantId)}`, {
    method: "DELETE",
  });
}

/**
 * `DELETE /api/customer/cart/items/:productId` — remove **every** variant of a
 * product. Kept for the "remove all sizes" affordance; a cart row wants
 * `removeCartVariant`.
 */
export async function removeCartProduct(productId: string): Promise<ServerCart> {
  return apiFetch<ServerCart>(`/api/customer/cart/items/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
}

/**
 * `DELETE /api/customer/cart`.
 *
 * One of the three endpoints that answer `{ success, message }` with **no
 * `data`** key, so `apiFetch` returns the whole body rather than unwrapping it.
 * Nothing here needs it, hence `void`.
 */
export async function clearCart(): Promise<void> {
  await apiFetch<{ success: boolean; message?: string }>("/api/customer/cart", { method: "DELETE" });
}

export interface MergeCartLine {
  productId: string;
  variantId: string;
  quantity: number;
}

export type MergeStrategy = "sum" | "replace" | "keep_server";

/**
 * `POST /api/customer/cart/merge` — the sign-in handover, once.
 *
 * Unusable lines are **reported, not thrown**: a merge is a batch the shopper
 * never itemised, so failing the whole basket to explain one bad line would lose
 * the thing this endpoint exists to save. The dropped lines come back in
 * `meta.dropped[]` and must be shown.
 *
 * No `price` is accepted in the body and none is sent — every line is re-priced
 * from the catalogue, because a localStorage cart is client-controlled data.
 *
 * This is the one cart call that uses `apiFetchWithMeta`: the response puts the
 * cart in `data` and the dropped lines in `meta`, and plain `apiFetch` unwraps
 * to `data` and discards the half that matters.
 */
export async function mergeCart(
  items: MergeCartLine[],
  strategy: MergeStrategy = "sum"
): Promise<MergeCartResult> {
  const { data, meta } = await apiFetchWithMeta<ServerCart, { dropped: CartDroppedLine[] }>(
    "/api/customer/cart/merge",
    { method: "POST", body: JSON.stringify({ items, strategy }) }
  );

  return { cart: data, dropped: meta.dropped ?? [] };
}

/**
 * `POST /api/customer/cart/quote` — what this cart will cost.
 *
 * Send `deliveryAddressId` whenever one is chosen. It is optional and no figure
 * depends on it yet, but it is **validated** with the same rule checkout
 * applies, so an address typed by hand rather than picked from
 * `GET /api/geo/search` fails here (`422 ORDER_DELIVERY_ADDRESS_REQUIRED`,
 * `details.reason: "selected_address_not_geocoded"`) instead of at the pay
 * button. That is the main reason the parameter exists.
 */
export async function quoteCart(deliveryAddressId?: string): Promise<CartQuote> {
  return apiFetch<CartQuote>("/api/customer/cart/quote", {
    method: "POST",
    body: JSON.stringify(deliveryAddressId ? { deliveryAddressId } : {}),
  });
}
