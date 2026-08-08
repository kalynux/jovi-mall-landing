import type { Metadata } from "next";
import type { ReactNode } from "react";
import Footer from "@/components/layout/Footer";
import { ShopProviders } from "@/components/shop/providers";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopBottomNav } from "@/components/shop/ShopBottomNav";

export const metadata: Metadata = {
  title: "Shop — WiMall",
  description:
    "Browse products from verified African vendors on WiMall — fashion, home, digital courses, e-books and services. Shop from your WhatsApp.",
};

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
