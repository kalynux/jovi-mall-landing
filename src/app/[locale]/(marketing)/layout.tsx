import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import MarketingChrome from "@/components/marketing/MarketingChrome";
import Footer from "@/components/layout/Footer";
import { isLocale } from "@/i18n/routing";

/**
 * Frame for the standalone, indexable marketing pages.
 *
 * A route group, so it adds chrome without adding a URL segment: /pricing stays
 * /pricing. It carries no `metadata` of its own — metadata is inherited, and a
 * canonical declared here would tell a crawler that every page under it is the
 * same document. Each page declares its own via `localeAlternates()`.
 *
 * The landing page's ambient layers (aurora, network, orbital, grain) are
 * deliberately absent: they are four always-animating client components, and
 * these pages are read on the cheap phones and thin connections the product is
 * built for.
 */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Keeps this subtree statically rendered; without it every page that reads a
  // translation falls back to dynamic rendering.
  setRequestLocale(locale);

  return (
    <div className="flex min-h-[100svh] flex-col">
      <MarketingChrome />
      {/* Navbar is fixed, so the document starts below it. */}
      <main id="main-content" className="flex-1 pt-16 lg:pt-[4.5rem]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
