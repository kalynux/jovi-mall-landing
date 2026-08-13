"use client";

import { useRouter } from "@/i18n/navigation";
import { Badge, Button, EmptyState, Icon, IconButton, ProductCard, QtyStepper } from "@/components/shop/ds";
import { useCart } from "@/components/shop/providers";
import { allProducts, findProductById, findVendorById } from "@/lib/shop/shop.api";
import { formatXAF } from "@/lib/shop/format";
import type { CartItem } from "@/lib/shop/shop.types";

function line(item: CartItem) {
  const p = findProductById(item.productId)!;
  const vr = p.variants.find((x) => x.id === item.variantId)!;
  return { p, vr };
}

export default function CartPage() {
  const router = useRouter();
  const { carts, setQty, removeItem } = useCart();

  const groups = (
    [
      ["physical", "Physical products", "package"],
      ["digital", "Digital products", "download"],
    ] as const
  )
    .map(([key, label, icon]) => ({ key, label, icon, items: carts[key] }))
    .filter((g) => g.items.length);

  // Items only. No delivery fee is added because the backend adds none:
  // `price_breakdown.total` is `base + 0 tax - 0 discount`, and delivery is
  // settled between the platform and the agency rather than quoted here. The
  // flat 1 000 FCFA this page used to add was invented and would not have
  // matched the charge. A real figure needs a server-side quote — see B9/B10.
  const grandTotal = groups.reduce(
    (sum, g) => sum + g.items.reduce((s, it) => s + line(it).vr.price * it.qty, 0),
    0,
  );

  if (groups.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", marginBottom: 8 }}>Cart</h1>
        <EmptyState
          icon="shopping-cart"
          title="Your cart is empty"
          description="Let’s fix that — browse the market and add something you love."
          actionLabel="Continue shopping"
          actionIcon="arrow-left"
          onAction={() => router.push("/shop")}
        />
        {/* Relabelled from "Recently viewed": nothing here tracks what the
            visitor looked at, and there is no endpoint that could — the
            backend's `recent_product_code` is a lone unused field. This is
            simply the top of the catalogue, so it says so. */}
        <p className="overline" style={{ marginBottom: 12, marginTop: 8 }}>
          From the marketplace
        </p>
        <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, scrollbarWidth: "none" }}>
          {allProducts().slice(0, 5).map((p) => (
            <div key={p.id} style={{ width: 190, flexShrink: 0 }}>
              <ProductCard
                title={p.title}
                image={p.images[0]}
                type={p.type}
                price={p.price}
                compareAt={p.compareAt}
                rating={p.rating}
                reviewCount={p.reviews}
                vendorName={findVendorById(p.vendorId)?.name}
                showVendor
                inStock={p.inStock}
                onClick={() => router.push(`/shop/products/${p.slug}`)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", marginBottom: 6 }}>Cart</h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <Icon name="info" size={15} style={{ color: "var(--text-muted)" }} />
        <span className="muted" style={{ fontSize: 12.5 }}>
          Physical and digital items check out as separate orders — you pay once.
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {groups.map((g) => {
            const sub = g.items.reduce((s, it) => s + line(it).vr.price * it.qty, 0);
            return (
              <div
                key={g.key}
                style={{
                  marginBottom: 16,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  background: "var(--surface)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "11px 13px",
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <Badge productType={g.key} size="sm">
                    {g.label}
                  </Badge>
                  <span className="muted" style={{ marginLeft: "auto", fontSize: 12.5 }}>
                    {g.items.length} item{g.items.length > 1 ? "s" : ""}
                  </span>
                </div>
                {g.items.map((it) => {
                  const { p, vr } = line(it);
                  return (
                    <div
                      key={it.variantId}
                      style={{ display: "flex", gap: 12, padding: 13, borderBottom: "1px solid var(--border-subtle)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.images[0]}
                        alt=""
                        style={{ width: 68, height: 68, borderRadius: "var(--radius-md)", objectFit: "cover", flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button
                          onClick={() => router.push(`/shop/products/${p.slug}`)}
                          style={{ border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", lineHeight: 1.3 }}>
                            {p.title}
                          </div>
                        </button>
                        <div className="muted" style={{ fontSize: 12.5, margin: "2px 0 8px" }}>
                          {findVendorById(p.vendorId)?.name} · {vr.name}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          {g.key === "digital" ? (
                            <span className="muted" style={{ fontSize: 12.5 }}>
                              Qty 1
                            </span>
                          ) : (
                            <QtyStepper
                              size="sm"
                              value={it.qty}
                              max={vr.stock || 10}
                              onChange={(q) => setQty(g.key, it.variantId, q)}
                            />
                          )}
                          <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--text-strong)" }}>
                            {formatXAF(vr.price * it.qty)}
                          </span>
                        </div>
                      </div>
                      <IconButton
                        icon="trash-2"
                        variant="plain"
                        size="sm"
                        label="Remove"
                        onClick={() => removeItem(g.key, it.variantId)}
                      />
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 13px", fontSize: 13.5 }}>
                  <span className="muted">Subtotal</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatXAF(sub)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, background: "var(--surface)" }}>
            <p className="overline" style={{ marginBottom: 12 }}>
              Order summary
            </p>
            {carts.physical.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "5px 0", color: "var(--text-body)" }}>
                <span>Delivery</span>
                <span className="muted">Confirmed at checkout</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderTop: "1px solid var(--border)",
                marginTop: 8,
                paddingTop: 12,
              }}
            >
              <span style={{ fontSize: 13.5, color: "var(--text-muted)", fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--text-strong)" }}>
                {formatXAF(grandTotal)}
              </span>
            </div>
            <div style={{ marginTop: 14 }}>
              <Button
                block
                size="lg"
                elevated
                trailingIcon="arrow-right"
                onClick={() => router.push(`/shop/checkout?total=${grandTotal}`)}
              >
                Place order
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
