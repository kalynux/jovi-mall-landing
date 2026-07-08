"use client";

import type { ReactNode } from "react";
import { CartProvider } from "./CartProvider";
import { FavoritesProvider } from "./FavoritesProvider";
import { ToastProvider } from "./ToastProvider";

export { useCart } from "./CartProvider";
export { useFavorites } from "./FavoritesProvider";
export { useToast } from "./ToastProvider";

/** All shop-scoped client providers in one wrapper. */
export function ShopProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <FavoritesProvider>
        <CartProvider>{children}</CartProvider>
      </FavoritesProvider>
    </ToastProvider>
  );
}
