import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Footer from "@/components/layout/Footer";
import { ShopProviders } from "@/components/shop/providers";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopBottomNav } from "@/components/shop/ShopBottomNav";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale } from "@/i18n/routing";

// The canonical + hreflang set here is the self-reference for /shop, whose own
// page.tsx is a client component and so cannot export metadata. Product and
// store pages override it with their own; the cart/checkout/account routes
// inherit it but are blocked in robots.ts, so no crawler reads it there.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return {
    title: "Shop — WiMall",
    description:
      "Browse products from verified African vendors on WiMall — fashion, home, digital courses, e-books and services. Shop from your WhatsApp.",
    alternates: localeAlternates(locale, "/shop"),
  };
}

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <ShopProviders>
      <div className="flex min-h-[100svh] flex-col" style={{ background: "var(--bg-app)" }}>
        <ShopHeader />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <Footer />
        <ShopBottomNav />
      </div>
    </ShopProviders>
  );
}
