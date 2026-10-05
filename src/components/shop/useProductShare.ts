"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import { useToast } from "@/components/shop/providers";
import { shareLink } from "@/lib/native/share";
import { productShareUrl } from "@/lib/shop/shop.routes";

/**
 * Share one product: the share sheet on a phone, a copy on the web.
 *
 * The toast is worded from what actually happened — "copied" only when
 * something was copied, silence when the shopper dismissed the sheet — the
 * contract `lib/native/share.ts` explains. One hook so the product page's
 * button and the card's press-and-hold menu cannot drift apart.
 *
 * Call it from the tap itself, not after an `await`: the web clipboard wants
 * the user gesture to still be fresh.
 */
export function useProductShare(): (product: {
  title: string;
  slug: string;
  store: { slug: string };
}) => void {
  const t = useTranslations("shop.product");
  const locale = useLocale();
  const { flash } = useToast();

  return useCallback(
    (product) => {
      void shareLink({
        title: product.title,
        url: productShareUrl(locale, product),
        dialogTitle: t("shareDialogTitle", { product: product.title }),
      }).then((outcome) => {
        if (outcome === "copied") flash(t("linkCopied"));
        else if (outcome === "failed") flash(t("shareFailed"));
      });
    },
    [flash, locale, t],
  );
}
