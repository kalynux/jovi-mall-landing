"use client";

import { useTranslations } from "next-intl";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { installNavDepth, navDepth } from "@/lib/shop/nav-depth";
import {
  backIgnoresHistory,
  isShopTab,
  shopPageTitleKey,
  shopParentPath,
} from "@/lib/shop/shop.pages";
import { normalizePath } from "@/lib/shop/shop.routes";

/**
 * The state the shop's header bar needs and cannot work out on its own: what
 * this screen is called, and whether it has a way back.
 *
 * The title is answered from the route (see `shop.pages.ts`) so it is right on
 * the first paint, and a screen whose real title is live data — a product, a
 * store — replaces it through `useShopPageTitle` once it has loaded.
 */
interface ShopChromeValue {
  title: string;
  /** False on the four tab-bar roots; they are where back would go. */
  showBack: boolean;
  goBack: () => void;
  setTitleFor: (path: string, title: string) => void;
}

const ShopChromeContext = createContext<ShopChromeValue | null>(null);

export function ShopChromeProvider({ children }: { children: ReactNode }) {
  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();
  const pathname = usePathname();
  const router = useRouter();

  /**
   * Keyed by the path that set it, rather than cleared on navigation.
   *
   * A cleanup effect cannot do this job: child effects run before the parent's,
   * so the provider would wipe the incoming screen's title immediately after it
   * was set. Storing the path alongside makes a stale override simply stop
   * matching.
   */
  const [override, setOverride] = useState<{ path: string; title: string } | null>(null);

  useEffect(() => installNavDepth(), []);

  const setTitleFor = useCallback((path: string, title: string) => {
    setOverride((prev) =>
      prev && prev.path === path && prev.title === title ? prev : { path, title },
    );
  }, []);

  const goBack = useCallback(() => {
    if (!backIgnoresHistory(pathname) && navDepth() > 0) {
      router.back();
      return;
    }
    // Nothing behind us — rebuild the stack one level up instead of stranding
    // the shopper. `replace`, because this *is* the back step, not a new one.
    router.replace(shopParentPath(pathname));
  }, [pathname, router]);

  const value = useMemo<ShopChromeValue>(() => {
    const here = normalizePath(pathname);
    return {
      title: override?.path === here ? override.title : tKey(shopPageTitleKey(here)),
      showBack: !isShopTab(here),
      goBack,
      setTitleFor,
    };
  }, [pathname, override, goBack, setTitleFor, tKey]);

  return <ShopChromeContext.Provider value={value}>{children}</ShopChromeContext.Provider>;
}

export function useShopChrome(): ShopChromeValue {
  const ctx = useContext(ShopChromeContext);
  if (!ctx) throw new Error("useShopChrome must be used inside <ShopChromeProvider>");
  return ctx;
}

/**
 * Name this screen in the header bar.
 *
 * For screens whose title is data — the product page, the vendor store, a cart
 * that is holding a digital purchase. Everything with a fixed name is already
 * answered by the route map and does not need this.
 *
 * A no-op outside the provider, so a component that is also rendered somewhere
 * other than the shop shell does not have to care.
 */
export function useShopPageTitle(title: string | null | undefined) {
  const ctx = useContext(ShopChromeContext);
  const pathname = usePathname();
  const setTitleFor = ctx?.setTitleFor;

  useEffect(() => {
    if (!setTitleFor || !title) return;
    setTitleFor(normalizePath(pathname), title);
  }, [setTitleFor, pathname, title]);
}
