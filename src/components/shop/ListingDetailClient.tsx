"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Skeleton } from "@/components/shop/ds";
import { ResourceError } from "@/components/shop/account/AccountShell";
import { getListing } from "@/lib/shop/catalog.api";
import type { PublicListingDetail } from "@/lib/shop/listings";
import { ListingDetail } from "./ListingDetail";

/**
 * `/shop/listing?s=<slug>` — the app's listing page, resolved in the browser.
 *
 * The packaged app is static files with no server, so the nested web route
 * cannot exist in it (`build-native.mjs` leaves it out). Same pattern and same
 * reasons as `VendorStoreClient`: loading is derived from a token rather than
 * set in an effect, and a missing `?s=` is answered in render.
 */
export function ListingDetailClient() {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <ListingResolver />
    </Suspense>
  );
}

function ListingResolver() {
  const t = useTranslations("shop.listings");
  const slug = useSearchParams().get("s");

  type Settled =
    | { status: "error"; error: unknown }
    | { status: "missing" }
    | { status: "ready"; listing: PublicListingDetail };

  const [nonce, setNonce] = useState(0);
  const token = `${slug ?? ""}#${nonce}`;
  const [settled, setSettled] = useState<{ token: string; value: Settled } | null>(null);

  const state: { status: "loading" } | Settled = !slug
    ? { status: "missing" }
    : settled?.token === token
      ? settled.value
      : { status: "loading" };

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    getListing(slug)
      .then((listing) => {
        if (!cancelled) {
          setSettled({ token, value: listing ? { status: "ready", listing } : { status: "missing" } });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setSettled({ token, value: { status: "error", error } });
      });
    return () => {
      cancelled = true;
    };
    // `slug` is folded into `token`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state.status === "loading") return <ListingSkeleton />;
  if (state.status === "error") {
    return <ResourceError error={state.error} onRetry={() => setNonce((n) => n + 1)} fallback={t("loadFailed")} />;
  }
  if (state.status === "missing") {
    return <EmptyState icon="megaphone" title={t("unavailableTitle")} description={t("unavailableDescription")} />;
  }
  return <ListingDetail listing={state.listing} />;
}

function ListingSkeleton() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton height={220} radius={16} />
      <Skeleton height={28} width="70%" radius={8} />
      <Skeleton height={18} width="45%" radius={8} />
      <Skeleton height={56} radius={12} />
      <Skeleton height={56} radius={12} />
    </div>
  );
}
