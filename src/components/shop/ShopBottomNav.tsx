"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart, useFavorites } from "@/components/shop/providers";
import { Icon } from "@/components/shop/ds";

const items = [
  { href: "/shop", icon: "store", label: "Shop" },
  { href: "/shop/saved", icon: "heart", label: "Saved" },
  { href: "/shop/cart", icon: "shopping-cart", label: "Cart" },
  { href: "/shop/account", icon: "user", label: "Account" },
];

/** Mobile-only bottom tab bar — the responsive echo of the design's bottom nav. */
export function ShopBottomNav() {
  const pathname = usePathname();
  const { count: cartCount } = useCart();
  const { count: favCount } = useFavorites();

  const badgeFor = (href: string) =>
    href === "/shop/cart" ? cartCount : href === "/shop/saved" ? favCount : 0;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[200] flex md:hidden"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        padding: "6px 6px calc(6px + env(safe-area-inset-bottom))",
      }}
    >
      {items.map((it) => {
        const active = it.href === "/shop" ? pathname === "/shop" : pathname.startsWith(it.href);
        const badge = badgeFor(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className="relative flex flex-1 flex-col items-center gap-1 py-1.5"
            style={{ color: active ? "var(--brand-hover)" : "var(--text-muted)", fontSize: 10.5, fontWeight: 700 }}
          >
            <span className="relative">
              <Icon
                name={it.icon}
                size={22}
                strokeWidth={active ? 2.4 : 2}
                style={active && it.icon === "heart" ? { fill: "currentColor" } : undefined}
              />
              {badge > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -8,
                    background: "var(--danger)",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 800,
                    minWidth: 15,
                    height: 15,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    border: "2px solid var(--surface)",
                  }}
                >
                  {badge}
                </span>
              )}
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
