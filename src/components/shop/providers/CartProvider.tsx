"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CartItem, CartKey, Carts, Product, Variant } from "@/lib/shop/shop.types";

/**
 * A localStorage cart, not the server cart — and the two do not have the same
 * shape, which is worth knowing before anyone tries a quick swap.
 *
 * `/api/customer/cart` exists and is documented, but it cannot be used yet:
 * `POST /cart/items` takes a real `productId` + `variantId`, and the catalogue
 * on screen is `catalog.mock` (ids `p1`, `v1`). Cart is downstream of the
 * missing catalog API, not independently blocked.
 *
 * Three differences to reconcile when it is wired:
 *
 *  1. **One cart, one type.** This provider holds `physical` and `digital`
 *     lists simultaneously. The server allows a single `productType` per cart
 *     and answers `409 CART_MIXED_PRODUCT_TYPES` otherwise, so the two lists
 *     have to become one — or two carts the user switches between.
 *  2. **No quantity update, no per-variant delete.** The server offers add
 *     (which only ever *increments*), delete-by-`productId` (which drops every
 *     variant of that product) and clear. `setQty` and a per-line `removeItem`
 *     below have no endpoint behind them — see B5 in the integration plan.
 *  3. **Digital is capped.** Quantity must be 1, and only one digital product
 *     may be in the cart at a time.
 */

interface CartContextValue {
  carts: Carts;
  addToCart: (product: Product, variant: Variant, qty?: number) => void;
  setQty: (key: CartKey, variantId: string, qty: number) => void;
  removeItem: (key: CartKey, variantId: string) => void;
  clearCarts: () => void;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "wimall-shop-carts";
const EMPTY: Carts = { physical: [], digital: [] };

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [carts, setCarts] = useState<Carts>(EMPTY);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Carts>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCarts({ physical: parsed.physical ?? [], digital: parsed.digital ?? [] });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: Carts) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback(
    (updater: (prev: Carts) => Carts) => {
      setCarts((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const addToCart = useCallback(
    (product: Product, variant: Variant, qty = 1) => {
      if (product.type === "service") return; // services are book-only
      const key = product.type as CartKey;
      update((prev) => {
        const list = [...prev[key]];
        const i = list.findIndex((x) => x.variantId === variant.id);
        if (i >= 0) list[i] = { ...list[i], qty: list[i].qty + qty };
        else list.push({ productId: product.id, variantId: variant.id, qty });
        return { ...prev, [key]: list };
      });
    },
    [update],
  );

  const setQty = useCallback(
    (key: CartKey, variantId: string, qty: number) => {
      update((prev) => ({
        ...prev,
        [key]: prev[key].map((x: CartItem) => (x.variantId === variantId ? { ...x, qty } : x)),
      }));
    },
    [update],
  );

  const removeItem = useCallback(
    (key: CartKey, variantId: string) => {
      update((prev) => ({ ...prev, [key]: prev[key].filter((x: CartItem) => x.variantId !== variantId) }));
    },
    [update],
  );

  const clearCarts = useCallback(() => update(() => EMPTY), [update]);

  const count = useMemo(
    () =>
      carts.physical.reduce((a, x) => a + x.qty, 0) + carts.digital.reduce((a, x) => a + x.qty, 0),
    [carts],
  );

  const value = useMemo<CartContextValue>(
    () => ({ carts, addToCart, setQty, removeItem, clearCarts, count }),
    [carts, addToCart, setQty, removeItem, clearCarts, count],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
