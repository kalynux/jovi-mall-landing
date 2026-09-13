"use client";

import { useTranslations } from "next-intl";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, ConfirmDialog, EmptyState, ProductCard, Skeleton, Tabs } from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { CART_OFFLINE_MESSAGE_KEY } from "@/lib/shop/cart-errors";
import { listProductsByIds } from "@/lib/shop/catalog.api";
import {
  clearRecentlyViewed,
  listRecentlyViewed,
  listWishlist,
  type CustomerCatalogEntry,
} from "@/lib/shop/saved.api";
import { resolveQuickAdd } from "@/lib/shop/quick-add";
import { productPathFor } from "@/lib/shop/shop.routes";
import { useAuth } from "@/lib/auth/useAuth";
import { publicUrl, type ProductListItem } from "@/lib/shop/shop.types";

type Tab = "saved" | "viewed";

/**
 * Saved products, and recently viewed.
 *
 * ── Both lists live on the server now ────────────────────────────────────────
 *
 * Saved used to be a set of ids in `localStorage`, resolved one `GET` per id,
 * which meant it did not survive a device change, a cleared browser or a sign-in
 * on a phone. `GET /api/customer/wishlist` returns the rows directly — one
 * request for the page instead of N, already ordered newest-save-first.
 * Recently viewed had no implementation at all.
 *
 * A signed-out shopper still gets the local saved list, because the wishlist
 * routes are customer-only and there is no anonymous wishlist server-side. That
 * path is unchanged, including its one-`GET`-per-id resolution, and
 * `FavoritesProvider` replays those ids to the server on sign-in. Recently
 * viewed has no local equivalent, so it asks the visitor to sign in rather than
 * inventing one.
 *
 * ── 🔴 A row can outlive its product ─────────────────────────────────────────
 *
 * Nothing cascades into either collection: a vendor can archive a listing, an
 * agency can suspend one over unpaid storage, an administrator can take one
 * down. The read degrades those rows rather than dropping them — `productId` and
 * `at` survive and `product` is `null` — and the list deliberately **does not
 * shrink**, so `meta.total` matches what is rendered.
 *
 * So a `null` product renders a tombstone with a working remove button, not an
 * empty slot and not a filtered-out row. It is also why this page no longer
 * un-saves anything on its own: the old version dropped ids that failed to
 * resolve, which under these semantics would silently delete a save for a
 * product that was merely suspended and is coming back.
 */
export default function SavedPage() {
  const t = useTranslations("shop.saved");
  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`), and the
  // two tab labels are the frozen `shop.nav` ones the header bar already uses.
  const tKey = useTranslations();
  const router = useRouter();
  const { status } = useAuth();
  const signedIn = status === "authenticated";
  const { favorites, toggle } = useFavorites();

  /*
     `toggle` closes over the favourites set, so its identity changes whenever
     that set does — including when a grid sync rebuilds it with the same
     members. Depending on it directly would re-run the hydration effect for a
     list that did not change. The ref gives the effect the current function
     without making it a trigger. */
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  const { addItem } = useCart();
  const { flash } = useToast();

  const [tab, setTab] = useState<Tab>("saved");

  const [saved, setSaved] = useState<CustomerCatalogEntry[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  const [viewed, setViewed] = useState<CustomerCatalogEntry[]>([]);
  const [viewedLoading, setViewedLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // `favorites` is a Set and a new instance each render, so the anonymous
  // effect keys on a stable string of its contents rather than the set itself.
  const localIds = Array.from(favorites).sort().join(",");

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;

    (async () => {
      setSavedLoading(true);

      if (signedIn) {
        try {
          const { data } = await listWishlist({ limit: 100 });
          if (!cancelled) setSaved(data);
        } catch {
          if (!cancelled) setSaved([]);
        } finally {
          if (!cancelled) setSavedLoading(false);
        }
        return;
      }

      // Signed out: the local ids are all there is, and they need hydrating.
      const list = localIds ? localIds.split(",") : [];
      if (list.length === 0) {
        if (!cancelled) {
          setSaved([]);
          setSavedLoading(false);
        }
        return;
      }

      /*
         One request, not one per id.

         This was `Promise.all(list.map(getProductById))` — a favourites list of
         forty products opened forty connections and pulled forty full product
         documents, variants and all, to render forty cards. `by-ids` answers the
         browse-grid row, which is exactly what the card takes, and it preserves
         the order the ids were sent in, so the shopper's own ordering survives
         with no re-sorting here.

         `missing` is the other half of why this route is better. An id the
         shopper saved months ago may name a product that has since been
         archived, suspended or deleted, and the per-id version could not tell
         that apart from a failed request — so a withdrawn product sat in the
         list forever as an empty card. Now it is named, and pruned. */
      const { products, missing } = await listProductsByIds(list, { fresh: true });
      if (cancelled) return;

      const byId = new Map(products.map((product) => [product.id, product]));
      const gone = new Set(missing);

      /*
         Prune what the server says is no longer publishable, through the
         provider rather than behind its back — `toggle` is what keeps the heart
         state and the stored ids in step.

         Deliberately only `missing`: an id that merely failed to hydrate stays
         saved, because a dropped connection must never silently empty somebody's
         favourites. Removing an id changes `localIds` and so re-runs this
         effect once more with a shorter list, which then finds nothing missing
         and settles. One extra request, only when something was actually
         withdrawn. */
      for (const id of gone) toggleRef.current(id);

      const resolved = list
        .filter((id) => !gone.has(id))
        .map(
          (id) =>
            ({
              productId: id,
              at: "",
              product: byId.get(id) ?? null,
            }) satisfies CustomerCatalogEntry,
        );

      if (!cancelled) {
        setSaved(resolved);
        setSavedLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, status, localIds]);

  // Recently viewed is fetched when its tab is first opened — it is the
  // secondary list, and the cap means there is never more than one page of it.
  useEffect(() => {
    if (tab !== "viewed" || !signedIn) return;

    let cancelled = false;
    (async () => {
      setViewedLoading(true);
      try {
        const { data } = await listRecentlyViewed({ limit: 100 });
        if (!cancelled) setViewed(data);
      } catch {
        if (!cancelled) setViewed([]);
      } finally {
        if (!cancelled) setViewedLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, signedIn]);

  const quickAdd = useCallback(
    async (productId: string) => {
      try {
        const outcome = await resolveQuickAdd(productId);

        if (outcome.kind === "unavailable") {
          flash(t("unavailable"));
          return;
        }
        if (outcome.kind === "choose") {
          router.push(productPathFor(outcome.product));
          return;
        }

        const added = await addItem(outcome.product, outcome.variant);
        if (added.kind === "added") flash(t("addedToCart"));
        // Before the `else`, which sends the shopper to the product page to make
        // a choice. A dead connection is not a choice to make, and routing them
        // there would answer a connectivity failure with a page that cannot load
        // either.
        else if (added.kind === "offline") flash(tKey(CART_OFFLINE_MESSAGE_KEY));
        // The server's own sentence when it wrote one, our key when it did not.
        else if (added.kind === "error") flash(added.message ?? tKey(added.messageKey));
        else router.push(productPathFor(outcome.product));
      } catch {
        flash(t("addFailed"));
      }
    },
    [addItem, flash, router, t, tKey],
  );

  const removeSaved = useCallback(
    (productId: string) => {
      toggle(productId);
      setSaved((prev) => prev.filter((e) => e.productId !== productId));
    },
    [toggle],
  );

  const clearHistory = useCallback(async () => {
    setConfirmClear(false);
    const previous = viewed;
    setViewed([]);
    try {
      await clearRecentlyViewed();
    } catch {
      setViewed(previous);
      flash(t("clearFailed"));
    }
  }, [viewed, flash, t]);

  const entries = tab === "saved" ? saved : viewed;
  const loading = tab === "saved" ? savedLoading : viewedLoading;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* The visible title is the header bar's, on every shop screen. */}
      <h1 className="sr-only">{tKey("shop.nav.tabs.saved")}</h1>

      <div style={{ marginBottom: 14 }}>
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          tabs={[
            {
              value: "saved",
              label: tKey("shop.nav.tabs.saved"),
              count: saved.length || undefined,
            },
            { value: "viewed", label: t("recentlyViewed") },
          ]}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {!loading && (
          <p className="muted" style={{ margin: 0 }}>
            {t("itemCount", { n: entries.length })}
          </p>
        )}
        {tab === "viewed" && signedIn && entries.length > 0 && !loading && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            {t("clearHistory")}
          </Button>
        )}
      </div>

      {/* Recently viewed is customer-only and has no anonymous equivalent, so
          this asks rather than pretending the list is empty. */}
      {tab === "viewed" && !signedIn && status !== "loading" ? (
        <EmptyState
          icon="clock"
          title={t("signInTitle")}
          description={t("signInDescription")}
          actionLabel={tKey("shop.common.signIn")}
          onAction={() => router.push("/login")}
        />
      ) : loading ? (
        <div className="pgrid">
          {Array.from({ length: Math.min(4, favorites.size || 2) }).map((_, i) => (
            <Skeleton key={i} height={280} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        tab === "saved" ? (
          <EmptyState
            icon="heart"
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actionLabel={t("browseProducts")}
            onAction={() => router.push("/shop")}
          />
        ) : (
          <EmptyState
            icon="clock"
            title={t("viewedEmptyTitle")}
            description={t("viewedEmptyDescription")}
            actionLabel={t("browseProducts")}
            onAction={() => router.push("/shop")}
          />
        )
      ) : (
        <div className="pgrid">
          {entries.map((entry) =>
            entry.product ? (
              <ProductCard
                key={entry.productId}
                title={entry.product.title}
                image={publicUrl(entry.product.image)}
                rating={entry.product.rating}
                type={entry.product.type}
                price={entry.product.price}
                compareAt={entry.product.compareAtPrice}
                currency={entry.product.currency}
                priceRange={entry.product.priceRange}
                vendorName={entry.product.store.name}
                showVendor
                freeDelivery={entry.product.freeDelivery}
                inStock={entry.product.inStock}
                favorite={tab === "saved" || favorites.has(entry.productId)}
                onToggleFavorite={
                  tab === "saved" ? () => removeSaved(entry.productId) : () => toggle(entry.productId)
                }
                onQuickAdd={() => void quickAdd(entry.productId)}
                href={productPathFor(entry.product)}
              />
            ) : (
              <UnavailableEntry
                key={entry.productId}
                // A viewed row is history: there is nothing to un-save, and the
                // only way to remove one is to clear the whole list.
                onRemove={tab === "saved" ? () => removeSaved(entry.productId) : undefined}
              />
            ),
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title={t("clearTitle")}
        tone="danger"
        icon="clock"
        confirmLabel={t("clearHistory")}
        onConfirm={() => void clearHistory()}
        onCancel={() => setConfirmClear(false)}
      >
        {t("clearBody")}
      </ConfirmDialog>
    </div>
  );
}

/**
 * A row whose product no longer resolves.
 *
 * Deliberately says nothing about *why*. Deleted and merely-suspended are
 * indistinguishable in the response on purpose — telling them apart would leak a
 * vendor's catalogue state to anyone who once saved one of their products, the
 * same oracle the public catalogue refuses to be when it answers 404 rather
 * than 403.
 */
function UnavailableEntry({ onRemove }: { onRemove?: () => void }) {
  const t = useTranslations("shop.saved");
  const tKey = useTranslations();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
        minHeight: 280,
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 14,
        background: "var(--surface-2, transparent)",
        textAlign: "center",
      }}
    >
      <p className="muted" style={{ margin: 0 }}>
        {t("itemUnavailable")}
      </p>
      {onRemove && (
        <Button variant="secondary" size="sm" onClick={onRemove}>
          {tKey("shop.common.remove")}
        </Button>
      )}
    </div>
  );
}
