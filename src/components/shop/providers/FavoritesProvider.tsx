"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { isCustomerSession } from "@/lib/shop/customer-session";
import {
  listWishlist,
  saveProduct,
  savedAmongAll,
  unsaveProduct,
} from "@/lib/shop/saved.api";

interface FavoritesContextValue {
  favorites: Set<string>;
  isFavorite: (productId: string) => boolean;
  /**
   * Optimistic, and fire-and-forget by design — a heart must fill on the tap,
   * not a round trip later. A refused write is rolled back.
   */
  toggle: (productId: string) => void;
  count: number;
  /** True while the signed-in list is being read for the first time. */
  loading: boolean;
  /**
   * Hydrate hearts for one rendered grid in a single call.
   *
   * The contract provides `saved-among` for exactly this, and it is the reason
   * a grid does not need the whole wishlist in memory. A no-op when signed out,
   * where `localStorage` already holds every id.
   */
  syncGrid: (productIds: string[]) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);
const STORAGE_KEY = "wi-mall-shop-favorites";
/** The key from before the brand became `wi-mall`. Carried over once, then retired. */
const PRE_RENAME_STORAGE_KEY = "wimall-shop-favorites";

/** `?limit` ceiling on the wishlist read. */
const PAGE_LIMIT = 100;
/**
 * How many pages the provider will walk to build the heart set.
 *
 * The set exists to fill hearts, not to be the list — the saved page reads its
 * own paginated rows. Two pages is far beyond any real wishlist and bounds the
 * cost of a session opening on a slow connection.
 */
const MAX_PAGES = 2;

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}

function readLocal(): Set<string> {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const carried = localStorage.getItem(PRE_RENAME_STORAGE_KEY);
      if (carried) {
        localStorage.setItem(STORAGE_KEY, carried);
        localStorage.removeItem(PRE_RENAME_STORAGE_KEY);
        raw = carried;
      }
    }
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

/**
 * The shopper's saved products, anonymous or signed in.
 *
 * ── Why there are two stores and not one ─────────────────────────────────────
 *
 * The seven wishlist routes are all `requireRole(['customer'])`, so there is no
 * anonymous wishlist server-side — and unlike the cart, **there is no
 * `wishlist/merge`**. That single fact shapes everything here:
 *
 *   signed out   `localStorage` is the store, exactly as it always was
 *   signing in   the local ids are replayed through `POST /wishlist`, which is
 *                idempotent, so replaying needs no diff and cannot double
 *   signed in    the server is the store; nothing is written locally again
 *
 * ⚠ **The local key is deliberately never cleared.** It is the only copy an
 * anonymous shopper has, and a replay that silently failed would otherwise take
 * the list with it. It costs a few hundred bytes and it is the safety net.
 *
 * ── What this provider is, and is not ────────────────────────────────────────
 *
 * It holds a set of **ids**, which is what a heart needs. It is not the saved
 * list: `/shop/saved` reads its own rows from the server, because those carry
 * pagination and the degraded `product: null` entries that a set cannot
 * represent.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { status, role } = useAuth();
  // A customer session, not any session: the wishlist routes are customer-only,
  // so a vendor's hearts would otherwise fill and then silently roll back. For
  // that session this is the signed-out store; see `isCustomerSession`.
  const signedIn = isCustomerSession(status, role);

  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  /**
   * One replay per sign-in.
   *
   * Reset when the session ends so a second sign-in in the same tab replays
   * again — the shopper may have saved things while signed out.
   */
  const replayed = useRef(false);

  /** Grids already hydrated, so scrolling back up does not re-ask. */
  const syncedIds = useRef<Set<string>>(new Set());

  const persistLocal = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }, []);

  // Anonymous: the local set is the whole truth, read once on mount.
  useEffect(() => {
    if (signedIn) return;
    replayed.current = false;
    syncedIds.current = new Set();
    setFavorites(readLocal());
  }, [signedIn]);

  // Signed in: replay whatever the anonymous session saved, then read back.
  useEffect(() => {
    if (!signedIn || replayed.current) return;
    replayed.current = true;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const local = readLocal();

        /**
         * Replay first, read second — in that order, so the read reflects the
         * replay and the shopper never watches their local saves disappear and
         * come back.
         *
         * A `404` means the product is gone; the contract says drop it, and
         * `allSettled` does exactly that without taking the rest down with it.
         */
        if (local.size > 0) {
          await Promise.allSettled([...local].map((id) => saveProduct(id)));
        }

        const ids = new Set<string>();
        for (let page = 1; page <= MAX_PAGES; page += 1) {
          const { data, meta } = await listWishlist({ page, limit: PAGE_LIMIT });
          for (const entry of data) ids.add(entry.productId);
          if (page >= meta.pages || data.length === 0) break;
        }

        if (!cancelled) setFavorites(ids);
      } catch {
        /**
         * The read failed — a dropped request, a deploy blip. Fall back to the
         * local set rather than rendering every heart empty, which would read
         * as "my saves are gone". `replayed` stays true so this does not spin;
         * a reload retries.
         */
        if (!cancelled) setFavorites(readLocal());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const toggle = useCallback(
    (productId: string) => {
      const wasFavorite = favorites.has(productId);

      // Optimistic: the heart is the feedback, so it moves now.
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(productId);
        else next.add(productId);
        if (!signedIn) persistLocal(next);
        return next;
      });

      if (!signedIn) return;

      void (async () => {
        try {
          if (wasFavorite) await unsaveProduct(productId);
          else await saveProduct(productId);
        } catch {
          // Roll back. Saving is idempotent and removing a row that is not
          // there is a 404, so neither call can leave the server half-done —
          // only this optimistic set can be wrong.
          setFavorites((prev) => {
            const next = new Set(prev);
            if (wasFavorite) next.add(productId);
            else next.delete(productId);
            return next;
          });
        }
      })();
    },
    [favorites, persistLocal, signedIn],
  );

  const syncGrid = useCallback(
    (productIds: string[]) => {
      if (!signedIn) return;

      const unknown = productIds.filter((id) => !syncedIds.current.has(id));
      if (unknown.length === 0) return;
      for (const id of unknown) syncedIds.current.add(id);

      void (async () => {
        try {
          const saved = new Set(await savedAmongAll(unknown));
          setFavorites((prev) => {
            const next = new Set(prev);
            // Authoritative for this grid in both directions: an id the server
            // does not report is not saved, even if a stale optimistic write
            // put it in the set.
            for (const id of unknown) {
              if (saved.has(id)) next.add(id);
              else next.delete(id);
            }
            return next;
          });
        } catch {
          // Let these ids be asked about again on the next grid.
          for (const id of unknown) syncedIds.current.delete(id);
        }
      })();
    },
    [signedIn],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      isFavorite: (id: string) => favorites.has(id),
      toggle,
      count: favorites.size,
      loading,
      syncGrid,
    }),
    [favorites, toggle, loading, syncGrid],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
