"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Icon, ProductCard, Rating, Tabs } from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { products } from "@/lib/shop/shop.fixtures";
import { findVendorById } from "@/lib/shop/shop.api";
import type { Product, Vendor } from "@/lib/shop/shop.types";

export function VendorStore({ vendor: v }: { vendor: Vendor }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const { flash } = useToast();
  const [tab, setTab] = useState("products");

  const vproducts = useMemo(() => products.filter((p) => p.vendorId === v.id), [v.id]);
  const counts = {
    products: vproducts.filter((p) => p.type === "physical").length,
    services: vproducts.filter((p) => p.type === "service").length,
    digital: vproducts.filter((p) => p.type === "digital").length,
  };
  const shown =
    tab === "services"
      ? vproducts.filter((p) => p.type === "service")
      : tab === "digital"
        ? vproducts.filter((p) => p.type === "digital")
        : vproducts.filter((p) => p.type === "physical");
  const recommended = products.filter((p) => p.vendorId !== v.id).slice(0, 6);

  const openProduct = (p: Product) => router.push(`/shop/products/${p.slug}`);
  const quickAdd = (p: Product) => (p.type === "service" ? openProduct(p) : (addToCart(p, p.variants[0]), flash(`Added to cart · ${p.variants[0].name}`)));

  const productCard = (p: Product, showVendor = false) => (
    <ProductCard
      key={p.id}
      title={p.title}
      image={p.images[0]}
      type={p.type}
      price={p.price}
      compareAt={p.compareAt}
      rating={p.rating}
      reviewCount={p.reviews}
      vendorName={findVendorById(p.vendorId)?.name}
      showVendor={showVendor}
      deliveryLabel={p.delivery}
      inStock={p.inStock}
      favorite={isFavorite(p.id)}
      onToggleFavorite={() => toggle(p.id)}
      onQuickAdd={() => quickAdd(p)}
      onClick={() => openProduct(p)}
    />
  );

  return (
    <div>
      {/* Banner */}
      <div style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.banner} alt="" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6" style={{ position: "relative" }}>
          <div style={{ position: "absolute", bottom: -34, left: 16 }}>
            <Avatar name={v.name} size={80} shape="squircle" ring status={v.isOpen ? "open" : "closed"} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div style={{ padding: "44px 4px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-strong)", margin: 0 }}>
              {v.name}
            </h1>
            {v.verified && <Icon name="badge-check" size={18} style={{ color: "var(--brand)" }} />}
            {!v.isOpen && (
              <Badge tone="warning" size="sm">
                On vacation
              </Badge>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <Rating value={v.rating} count={v.reviews} compact />
            <span className="muted">· {v.products} products</span>
            <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              · <Icon name="map-pin" size={13} />
              {v.city}, {v.country}
            </span>
          </div>
          <p style={{ fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.55, margin: "12px 0 0", maxWidth: 640 }}>
            {v.desc}
          </p>
          {v.agency && (
            <div style={{ marginTop: 12 }}>
              <Badge tone="brand" icon="truck">
                Ships with {v.agency}
              </Badge>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <Button variant="whatsapp" leadingIcon="message-circle" onClick={() => flash("Opening WhatsApp…")}>
              Contact vendor
            </Button>
            <Button variant="secondary" leadingIcon="share-2" onClick={() => flash("Store link copied")}>
              Share
            </Button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "products", label: "Products", count: counts.products },
              { value: "services", label: "Services", count: counts.services },
              { value: "digital", label: "Digital", count: counts.digital },
              { value: "reviews", label: "Reviews" },
              { value: "about", label: "About" },
            ]}
          />
        </div>

        {(tab === "products" || tab === "services" || tab === "digital") && (
          <div className="pgrid" style={{ paddingTop: 18 }}>
            {shown.length ? (
              shown.map((p) => productCard(p))
            ) : (
              <p className="muted" style={{ gridColumn: "1/-1", textAlign: "center", padding: 24 }}>
                Nothing here yet.
              </p>
            )}
          </div>
        )}

        {tab === "about" && (
          <div style={{ padding: "18px 0", maxWidth: 560 }}>
            <AboutRow icon="map-pin" label="Location" value={`${v.city}, ${v.country}`} />
            <AboutRow icon="truck" label="Delivery" value={v.agency || "Digital delivery"} />
            <AboutRow icon="phone" label="Support" value={v.whatsapp} />
            <AboutRow icon="clock" label="Status" value={v.isOpen ? "Open now" : "On vacation"} />
          </div>
        )}

        {tab === "reviews" && (
          <div style={{ padding: "18px 0", maxWidth: 560 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 0 14px" }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: "var(--text-strong)" }}>{v.rating.toFixed(1)}</div>
              <div>
                <Rating value={v.rating} showValue={false} />
                <div className="muted" style={{ marginTop: 3 }}>
                  {v.reviews} reviews
                </div>
              </div>
            </div>
            <p className="muted">Reviews are aggregated across this vendor’s orders.</p>
          </div>
        )}

        {/* Recommended */}
        <div style={{ padding: "24px 0 6px" }}>
          <p className="overline">Recommended for you</p>
        </div>
        <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 24, scrollbarWidth: "none" }}>
          {recommended.map((p) => (
            <div key={p.id} style={{ width: 190, flexShrink: 0 }}>
              {productCard(p, true)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <Icon name={icon} size={19} style={{ color: "var(--brand)", marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 14.5, color: "var(--text-strong)", fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}
