"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CartItem, CartKey, Carts, Product, Variant } from "@/lib/shop/shop.types";

interface CartContextValue {
  carts: Carts;
  addToCart: (product: Product, variant: Variant, qty?: number) => void;
  setQty: (key: CartKey, variantId: string, qty: number) => void;
  removeItem: (key: CartKey, variantId: string) => void;
  clearCarts: () => void;
  count: number;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "jovi-shop-carts";
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
