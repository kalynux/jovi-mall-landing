"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { useCart, useFavorites } from "@/components/shop/providers";
import { Icon } from "@/components/shop/ds";
import WiMallMark from "@/components/brand/WiMallMark.generated";

function CountDot({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      style={{
        position: "absolute",
        top: -5,
        right: -6,
        background: "var(--danger)",
        color: "#fff",
        fontSize: 10,
        fontWeight: 800,
        minWidth: 17,
        height: 17,
        borderRadius: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 4px",
        border: "2px solid var(--surface)",
      }}
    >
      {n}
    </span>
  );
}

export function ShopHeader() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { count: cartCount } = useCart();
  const { count: favCount } = useFavorites();

  const iconLink = (href: string, icon: string, label: string, badge?: number) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        aria-label={label}
        className="relative inline-flex items-center justify-center rounded-[12px] transition-colors"
        style={{
          width: 40,
          height: 40,
          color: active ? "var(--brand-hover)" : "var(--text-body)",
          background: active ? "var(--brand-subtle)" : "transparent",
        }}
      >
        <Icon name={icon} size={22} />
        {typeof badge === "number" && <CountDot n={badge} />}
      </Link>
    );
  };

  return (
    <header
      className="sticky top-0 z-[200] border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="WiMall shop">
          <WiMallMark style={{ width: 22, height: 22 }} />
          <span
            className="font-display"
            style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.03em", color: "var(--text-strong)" }}
          >
            Wi<span style={{ color: "var(--brand)" }}>Mall</span>
          </span>
        </Link>

        <nav className="ml-3 hidden items-center gap-1 md:flex">
          <Link
            href="/shop"
            className="rounded-[10px] px-3 py-2 text-sm font-bold transition-colors"
            style={{
              color: pathname === "/shop" ? "var(--brand-hover)" : "var(--text-body)",
              background: pathname === "/shop" ? "var(--brand-subtle)" : "transparent",
            }}
          >
            Marketplace
          </Link>
          <Link
            href="/"
            className="rounded-[10px] px-3 py-2 text-sm font-bold transition-colors"
            style={{ color: "var(--text-body)" }}
          >
            Home
          </Link>
        </nav>

        <div className="flex-1" />

        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="inline-flex items-center justify-center rounded-[12px]"
          style={{ width: 40, height: 40, color: "var(--text-body)" }}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
        </button>
        {iconLink("/shop/saved", "heart", "Saved", favCount)}
        {iconLink("/shop/cart", "shopping-cart", "Cart", cartCount)}
        <Link
          href="/shop/account"
          aria-label="Account"
          className="hidden items-center justify-center rounded-[12px] md:inline-flex"
          style={{ width: 40, height: 40, color: pathname === "/shop/account" ? "var(--brand-hover)" : "var(--text-body)" }}
        >
          <Icon name="user" size={22} />
        </Link>
      </div>
    </header>
  );
}
