import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Footer from "@/components/layout/Footer";
import { ShopProviders } from "@/components/shop/providers";
import { ShopChromeProvider } from "@/components/shop/ShopChrome";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopBottomNav } from "@/components/shop/ShopBottomNav";
import { ShopScrollArea } from "@/components/shop/ShopScrollArea";
import { PushBridge } from "@/components/shop/PushBridge";
import { isLocale } from "@/i18n/routing";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * A default title for the shell, and **no canonical**.
 *
 * The `/shop` self-reference used to live here because `page.tsx` was a client
 * component; it is a server component now and owns its own canonical. Nothing
 * else under this layout should inherit one — a canonical set on a layout claims
 * that every route beneath it *is* that URL, which is wrong for `/shop/cart`,
 * `/shop/saved` and `/shop/account` and only went unnoticed because robots.txt
 * blocks all three. Product and store pages set their own.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return {
    title: "Shop — Wi-Mall",
    description:
      "Browse products from verified African vendors on Wi-Mall — fashion, home, digital courses, e-books and services. Shop from your WhatsApp.",
  };
}

/**
 * On a phone this is an app shell, not a page: the header and the tab bar are
 * flex items that never move because the middle pane is the only thing that
 * scrolls. Above `md` the same markup is an ordinary column and the window
 * scrolls as before. See `.shop-shell` in globals.css.
 */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ShopProviders>
      <PushBridge />
      {/*
        Wraps the header AND the pane, because the header names the page below
        it: the title, and whether there is a back arrow, are facts about the
        route that both halves have to agree on. See `ShopChrome`.
      */}
      <ShopChromeProvider>
        <div className="shop-shell" style={{ background: "var(--bg-app)" }}>
          <ShopHeader />
          <ShopScrollArea>
            <main className="flex-1">{children}</main>
            {/*
              No marketing footer in the app.

              Every column of it — Vendors, Agencies, Agents, Customers, Blog,
              Pricing, FAQ — points at a route the app bundle does not contain, so
              all seven were client-side navigations to nothing. It is also the
              wrong shape for the medium: a sitemap-in-a-footer under a product
              grid, on a screen that already has a tab bar.

              The one link worth keeping reachable, Help & FAQ, is a row in the
              account menu that opens the real site in the in-app browser.
            */}
            {!IS_NATIVE_BUILD && <Footer />}
          </ShopScrollArea>
          <ShopBottomNav />
        </div>
      </ShopChromeProvider>
    </ShopProviders>
  );
}
