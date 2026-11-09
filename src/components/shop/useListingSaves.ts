"use client";

import { useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useFavorites, useToast } from "@/components/shop/providers";

/**
 * Hearts for a set of rendered listings: one `saved-among` call for the grid,
 * and a toggle that says what saving does.
 *
 * The toast on save is the changelog's "say what saving does, and nothing
 * more" (api-doc/customer/FRONTEND-CHANGELOG-listing-reviews-saves.md § 1.3):
 * it keeps the listing for later, and **the business is never told** (RS-2).
 * Nothing here suggests a contact was unlocked or that anything costs money.
 */
export function useListingSaves(listingIds: readonly string[]) {
  const t = useTranslations("shop.listings");
  const { isListingSaved, toggleListing, syncListings } = useFavorites();
  const { flash } = useToast();

  const key = listingIds.join(",");
  useEffect(() => {
    if (key) syncListings(key.split(","));
  }, [key, syncListings]);

  const toggle = useCallback(
    (listingId: string) => {
      const wasSaved = isListingSaved(listingId);
      toggleListing(listingId);
      flash(wasSaved ? t("unsaved") : t("savedToast"));
    },
    [isListingSaved, toggleListing, flash, t],
  );

  return {
    isSaved: isListingSaved,
    toggle,
    /** Spread onto a `ListingCard`. */
    cardProps: (listingId: string) => ({
      saved: isListingSaved(listingId),
      onToggleSave: () => toggle(listingId),
    }),
  };
}
