"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  IconButton,
  Icon,
  ProductCard,
  SearchBar,
  Select,
  VendorCard,
} from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { categories, products, sorts } from "@/lib/shop/shop.fixtures";
import { findVendorById } from "@/lib/shop/shop.api";
import { formatXAF } from "@/lib/shop/format";
import type { Product, ProductType, SortKey } from "@/lib/shop/shop.types";

interface Filters {
  types: ProductType[];
  delivery: boolean;
  inStock: boolean;
  priceMax: number;
  minRating: number;
}

const DEFAULT_FILTERS: Filters = { types: [], delivery: false, inStock: false, priceMax: 20000, minRating: 0 };

export default function CatalogPage() {
  const router = useRouter();
  const { addToCart } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const { flash } = useToast();

  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("Relevance");
  const [grouped, setGrouped] = useState(true);
  const [list, setList] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Hydrate initial state from the URL after mount (kept in an effect so the
  // server and first client render match — avoids a hydration mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("category")) setCat(p.get("category")!);
    if (p.get("q")) setQ(p.get("q")!);
    if (p.get("sort")) setSort(p.get("sort") as SortKey);
    const type = p.get("type") as ProductType | null;
    if (type) setFilters((f) => ({ ...f, types: [type] }));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reflect key state back into the URL.
  useEffect(() => {
    const p = new URLSearchParams();
    if (cat !== "All") p.set("category", cat);
    if (q) p.set("q", q);
    if (sort !== "Relevance") p.set("sort", sort);
    if (filters.types.length === 1) p.set("type", filters.types[0]);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `/shop?${qs}` : "/shop");
  }, [cat, q, sort, filters.types]);

  const items = useMemo(() => {
    let out = products.filter((p) => cat === "All" || p.category === cat);
    if (q) {
      const needle = q.toLowerCase();
      out = out.filter((p) =>
        (p.title + p.category + (findVendorById(p.vendorId)?.name ?? "")).toLowerCase().includes(needle),
      );
    }
    if (filters.types.length) out = out.filter((p) => filters.types.includes(p.type));
    if (filters.delivery) out = out.filter((p) => Boolean(p.delivery));
    if (filters.inStock) out = out.filter((p) => p.inStock);
    out = out.filter((p) => p.price <= filters.priceMax && p.rating >= filters.minRating);
    if (sort === "Price: low to high") out = [...out].sort((a, b) => a.price - b.price);
    else if (sort === "Price: high to low") out = [...out].sort((a, b) => b.price - a.price);
    else if (sort === "Popularity") out = [...out].sort((a, b) => b.sales - a.sales);
    return out;
  }, [cat, q, sort, filters]);

  const activeFilterCount =
    filters.types.length +
    (filters.delivery ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.minRating ? 1 : 0) +
    (filters.priceMax < 20000 ? 1 : 0);

  const byVendor = useMemo(() => {
    const map: Record<string, Product[]> = {};
    items.forEach((p) => {
      (map[p.vendorId] = map[p.vendorId] || []).push(p);
    });
    return map;
  }, [items]);

  const openProduct = (p: Product) => router.push(`/shop/products/${p.slug}`);
  const quickAdd = (p: Product) => {
    if (p.type === "service") {
      openProduct(p);
    } else {
      addToCart(p, p.variants[0]);
      flash(`Added to cart · ${p.variants[0].name}`);
    }
  };
  const onFav = (p: Product) => toggle(p.id);

  const card = (p: Product, showVendor: boolean) => (
    <ProductCard
      key={p.id}
      layout={list ? "list" : "grid"}
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
      favorite={isFavorite(p.id)}
      onToggleFavorite={() => onFav(p)}
      inStock={p.inStock}
      onQuickAdd={() => quickAdd(p)}
      onClick={() => openProduct(p)}
    />
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="mb-5">
        <p className="overline" style={{ marginBottom: 6 }}>
          Marketplace
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-strong)", margin: 0 }}>
          Shop from verified African vendors
        </h1>
        <p className="muted" style={{ fontSize: 14.5, marginTop: 6 }}>
          Fashion, home, digital courses, e-books & services — pay with mobile money, delivered nationwide.
        </p>
      </div>

      {/* Search */}
      <div className="mb-3 max-w-2xl">
        <SearchBar
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
          filled
          placeholder="Search products, vendors, SKU…"
        />
      </div>

      {/* Category chips */}
      <div className="row-chips mb-3">
        {categories.map((c) => (
          <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <div style={{ display: "inline-flex", background: "var(--surface-2)", borderRadius: 999, padding: 3 }}>
          {([["Grouped", true], ["All", false]] as const).map(([lb, g]) => (
            <button
              key={lb}
              onClick={() => setGrouped(g)}
              style={{
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 12.5,
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: 999,
                background: grouped === g ? "var(--surface)" : "transparent",
                color: grouped === g ? "var(--brand-hover)" : "var(--text-muted)",
                boxShadow: grouped === g ? "var(--shadow-xs)" : "none",
              }}
            >
              {lb}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="muted hidden sm:inline" style={{ fontSize: 12.5 }}>
          {items.length} result{items.length === 1 ? "" : "s"}
        </span>
        <Select
          size="sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          leadingIcon="arrow-up-down"
          options={sorts}
          aria-label="Sort products"
        />
        <IconButton
          icon="sliders-horizontal"
          variant="surface"
          label="Filters"
          onClick={() => setFiltersOpen(true)}
          style={activeFilterCount ? { borderColor: "var(--brand)", color: "var(--brand-hover)" } : undefined}
        />
        <IconButton
          icon={list ? "layout-grid" : "list"}
          variant="surface"
          label="Toggle layout"
          onClick={() => setList(!list)}
        />
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="row-chips mb-4">
          {filters.types.map((t) => (
            <Chip
              key={t}
              selected
              solid
              size="sm"
              removable
              onRemove={() => setFilters((f) => ({ ...f, types: f.types.filter((x) => x !== t) }))}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </Chip>
          ))}
          {filters.delivery && (
            <Chip selected solid size="sm" removable onRemove={() => setFilters((f) => ({ ...f, delivery: false }))}>
              Delivery
            </Chip>
          )}
          {filters.inStock && (
            <Chip selected solid size="sm" removable onRemove={() => setFilters((f) => ({ ...f, inStock: false }))}>
              In stock
            </Chip>
          )}
          {filters.minRating > 0 && (
            <Chip selected solid size="sm" removable onRemove={() => setFilters((f) => ({ ...f, minRating: 0 }))}>
              {filters.minRating}★ & up
            </Chip>
          )}
          {filters.priceMax < 20000 && (
            <Chip selected solid size="sm" removable onRemove={() => setFilters((f) => ({ ...f, priceMax: 20000 }))}>
              ≤ {formatXAF(filters.priceMax)}
            </Chip>
          )}
        </div>
      )}

      {/* Results */}
      {items.length === 0 ? (
        <EmptyState
          icon="search-x"
          title="No products found"
          description="Try clearing a filter or searching something else."
          actionLabel="Clear filters"
          onAction={() => {
            setFilters(DEFAULT_FILTERS);
            setQ("");
            setCat("All");
          }}
        />
      ) : grouped ? (
        Object.keys(byVendor).map((vid) => {
          const v = findVendorById(vid)!;
          return (
            <div key={vid} className="mb-8">
              <div className="mb-3">
                <VendorCard
                  name={v.name}
                  rating={v.rating}
                  reviewCount={v.reviews}
                  productCount={byVendor[vid].length}
                  city={v.city}
                  verified={v.verified}
                  isOpen={v.isOpen}
                  onView={() => router.push(`/shop/stores/${v.slug}`)}
                />
              </div>
              <div className={list ? "plist" : "pgrid"}>{byVendor[vid].map((p) => card(p, false))}</div>
            </div>
          );
        })
      ) : (
        <div className={list ? "plist" : "pgrid"}>{items.map((p) => card(p, true))}</div>
      )}

      {/* Filters sheet */}
      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Reset
            </Button>
            <Button block onClick={() => setFiltersOpen(false)}>
              Show {items.length} results
            </Button>
          </div>
        }
      >
        <FilterBody filters={filters} setFilters={setFilters} />
      </BottomSheet>
    </div>
  );
}

function FilterBody({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}) {
  const toggleType = (t: ProductType) =>
    setFilters((f) => ({
      ...f,
      types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t],
    }));

  return (
    <div>
      <Section title="Product type">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(
            [
              ["physical", "package", "Physical"],
              ["digital", "download", "Digital"],
              ["service", "calendar-clock", "Service"],
            ] as const
          ).map(([t, ic, lb]) => (
            <Chip key={t} icon={ic} selected={filters.types.includes(t)} onClick={() => toggleType(t)}>
              {lb}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title={`Max price · ${formatXAF(filters.priceMax)}`}>
        <input
          type="range"
          min={3000}
          max={20000}
          step={500}
          value={filters.priceMax}
          onChange={(e) => setFilters((f) => ({ ...f, priceMax: Number(e.target.value) }))}
          style={{ width: "100%", accentColor: "var(--brand)" }}
        />
      </Section>

      <Section title="Rating">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[0, 3, 4, 4.5].map((r) => (
            <Chip key={r} selected={filters.minRating === r} onClick={() => setFilters((f) => ({ ...f, minRating: r }))}>
              {r === 0 ? "Any" : `${r}★ & up`}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Availability">
        <ToggleRow
          label="Delivery available"
          icon="truck"
          on={filters.delivery}
          onChange={(v) => setFilters((f) => ({ ...f, delivery: v }))}
        />
        <ToggleRow
          label="In stock only"
          icon="package-check"
          on={filters.inStock}
          onChange={(v) => setFilters((f) => ({ ...f, inStock: v }))}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p className="overline" style={{ marginBottom: 10 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  icon,
  on,
  onChange,
}: {
  label: string;
  icon: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0" }}>
      <Icon name={icon} size={19} style={{ color: "var(--text-muted)" }} />
      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text-body)" }}>{label}</span>
      <button
        onClick={() => onChange(!on)}
        aria-pressed={on}
        aria-label={label}
        style={{
          width: 44,
          height: 26,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: on ? "var(--brand)" : "var(--gray-300)",
          position: "relative",
          transition: "background .15s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: on ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .15s",
            boxShadow: "var(--shadow-sm)",
          }}
        />
      </button>
    </div>
  );
}
