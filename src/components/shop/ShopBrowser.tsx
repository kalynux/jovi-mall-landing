"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { isNetworkError } from "@/lib/errors/is-network-error";
import { useRouter } from "@/i18n/navigation";
import {
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  ProductCard,
  SearchBar,
  Select,
  VendorCard,
} from "@/components/shop/ds";
import { ShopSearchRow } from "@/components/shop/ShopSearch";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { CART_OFFLINE_MESSAGE } from "@/lib/shop/cart-errors";
import { formatXAF } from "@/lib/shop/format";
import { productPathFor, storePath } from "@/lib/shop/shop.routes";
import { resolveQuickAdd } from "@/lib/shop/quick-add";
import { rememberSearch } from "@/lib/shop/recent-searches";
import {
  activeFilterCount,
  buildProductSearchParams,
  SORT_OPTIONS,
} from "@/lib/shop/shop.query";
import type {
  CategoryCount,
  ListMeta,
  ProductListItem,
  ProductListQuery,
  ProductType,
  SortKey,
} from "@/lib/shop/shop.types";
import { publicUrl } from "@/lib/shop/shop.types";

/**
 * The browse controls. Rendering happens on the server; this owns the inputs.
 *
 * **The URL is the state.** Every control writes a query string and navigates;
 * nothing here filters the array it was given. That is what makes a filtered
 * view shareable, the back button meaningful, and the grid something a crawler
 * sees — and it is why there is no `useMemo` full of `.filter()` calls any more.
 *
 * The only local state is genuinely local: which way the results are laid out,
 * whether the filter sheet is open, and the search box's in-progress text.
 *
 * ── Two toolbars, one set of controls ────────────────────────────────────────
 *
 * From `sm` up this is the screen it has always been: a heading, a search box,
 * a category rail and a toolbar carrying sort, filters, layout and Grouped/All.
 *
 * On a phone that toolbar did not fit. Its five controls measured ~418px
 * against 358 available, so it wrapped onto a second line — and above it sat a
 * two-line heading and a two-line subtitle, which together pushed the first
 * product most of a screen down. The phone layout therefore redistributes the
 * same controls rather than shrinking them:
 *
 *   - the heading and subtitle collapse to one line;
 *   - filters and layout move inline with the search field, which is what they
 *     act on (ShopSearch.tsx);
 *   - sort moves into the filter sheet, since it is the same kind of decision
 *     and is made about as often;
 *   - Grouped/All moves to the head of the category rail, pinned outside the
 *     scroller so it cannot be scrolled away from.
 *
 * The rail briefly had a trailing arrow into the sheet's category list too. It
 * is gone: the Filters button beside the search field already opens that sheet,
 * and a second entry point to the same list — sitting at the far end of a
 * horizontal scroller, where it reads as "more chips" rather than "open a
 * dialog" — cost a control to say something the row could not say clearly.
 *
 * Both layouts are always rendered and one is hidden by a media query. Picking
 * with `matchMedia` would have no answer during SSR, and this component is
 * server-rendered on the web — the whole reason the grid is crawlable.
 */

const PRICE_CEILING = 100_000;

interface Props {
  products: ProductListItem[];
  meta: ListMeta;
  categories: CategoryCount[];
  /** Already parsed and validated by `parseProductSearchParams`. */
  query: ProductListQuery;
}

export function ShopBrowser({ products, meta, categories, query }: Props) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isFavorite, toggle, syncGrid } = useFavorites();
  const { flash } = useToast();

  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Lifted out of the filter body so the category rail's trailing button can
  // open the sheet *and* the list inside it in one tap.
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [draft, setDraft] = useState<ProductListQuery>(query);
  const [search, setSearch] = useState(query.q ?? "");

  /**
   * Fill the hearts for this page of results.
   *
   * One `saved-among` call for the whole grid — the endpoint exists for exactly
   * this, and it is why a card does not have to ask on its own. Keyed on the
   * rendered ids so paging or refiltering re-asks and scrolling does not.
   */
  const renderedIds = products.map((p) => p.id).join(",");
  useEffect(() => {
    if (renderedIds) syncGrid(renderedIds.split(","));
  }, [renderedIds, syncGrid]);

  // The URL is authoritative: a back/forward step or a link with different
  // params must move the controls, not just the grid.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(query);
    setSearch(query.q ?? "");
  }, [query]);

  /** Any navigation resets to page 1 — page 3 of the old filter is not page 3 of the new one. */
  const go = useCallback(
    (next: Partial<ProductListQuery>, keepPage = false) => {
      const merged: ProductListQuery = { ...query, ...next, ...(keepPage ? {} : { page: 1 }) };
      const qs = buildProductSearchParams(merged);
      startTransition(() => router.push(qs ? `/shop?${qs}` : "/shop"));
    },
    [query, router]
  );

  /**
   * Run a search, and remember it on this device.
   *
   * Submitted rather than live: the backend search is a `$text` index that
   * matches whole words, so firing a request per keystroke would spend a round
   * trip on every prefix that cannot match anything.
   */
  const applySearch = useCallback(
    (raw: string) => {
      const q = raw.trim();
      // Only real queries are remembered — clearing the box is not a search.
      if (q) void rememberSearch(q);
      go({
        q: q || undefined,
        // `relevance` has nothing to rank by without a query, and the parser
        // would downgrade it anyway — do it here so the URL never carries a
        // dead sort.
        sort: q ? query.sort : query.sort === "relevance" ? "newest" : query.sort,
      });
    },
    [go, query.sort]
  );

  const clearSearch = useCallback(() => {
    setSearch("");
    go({ q: undefined, sort: query.sort === "relevance" ? "newest" : query.sort });
  }, [go, query.sort]);

  const filterCount = activeFilterCount(query);
  const busy = pending;

  /* ── Actions on a card ───────────────────────────────────────────────────── */

  /**
   * A list row has no variant, so this resolves the product before it can add
   * anything. Anything with a choice to make goes to the product page instead of
   * guessing which size the shopper meant.
   */
  const quickAdd = useCallback(
    async (product: ProductListItem) => {
      try {
        const resolved = await resolveQuickAdd(product.id);

        if (resolved.kind === "unavailable") {
          flash("That product is no longer available.");
          return;
        }
        if (resolved.kind === "choose") {
          router.push(productPathFor(product));
          return;
        }

        const outcome = await addItem(resolved.product, resolved.variant);
        switch (outcome.kind) {
          case "added":
            // Digital is a buy-now, not an add — one product, quantity one,
            // nothing to deliver — so it goes where the card's ⚡ promises it
            // goes: payment.
            if (resolved.product.type === "digital") {
              router.push("/shop/checkout");
              break;
            }
            flash(`Added to cart · ${resolved.product.title}`);
            break;
          case "type_conflict":
            // The replace prompt belongs on the product page, where the shopper
            // can see what they are about to lose.
            router.push(productPathFor(product));
            break;
          case "digital_limit":
            flash("Your cart already holds a digital product. Pay for that one first.");
            break;
          case "service_not_allowed":
            router.push(productPathFor(product));
            break;
          case "offline":
            flash(CART_OFFLINE_MESSAGE);
            break;
          case "error":
            flash(outcome.message);
            break;
        }
      } catch (err) {
        /**
         * This catch covers `resolveQuickAdd` — a catalogue read — and NOT the
         * add itself, which returns its failures. Both can fail with no signal
         * and both must say so, which is why the sentence is shared with the
         * `offline` case above rather than living only here.
         *
         * The distinction is not academic: the resolve is usually served from
         * the HTTP cache, so on a dead connection this branch tends not to fire
         * while the add behind it does. That is why an offline add went on
         * reporting a raw engine string long after this looked fixed.
         */
        flash(
          isNetworkError(err) ? CART_OFFLINE_MESSAGE : "Could not add that to your cart. Please try again."
        );
      }
    },
    [addItem, flash, router]
  );

  const card = (product: ProductListItem, showVendor: boolean) => (
    <ProductCard
      key={product.id}
      layout={list ? "list" : "grid"}
      title={product.title}
      image={publicUrl(product.image)}
      type={product.type}
      price={product.price}
      compareAt={product.compareAtPrice}
      currency={product.currency}
      priceRange={product.priceRange}
      vendorName={product.store.name}
      showVendor={showVendor}
      freeDelivery={product.freeDelivery}
      favorite={isFavorite(product.id)}
      onToggleFavorite={() => toggle(product.id)}
      inStock={product.inStock}
      onQuickAdd={() => void quickAdd(product)}
      href={productPathFor(product)}
    />
  );

  /** Groups the current page only — the API paginates, so this is a layout, not a filter. */
  const byStore = useMemo(() => {
    const map = new Map<string, { name: string; isOpen: boolean; items: ProductListItem[] }>();
    for (const p of products) {
      const entry = map.get(p.store.slug) ?? {
        name: p.store.name,
        isOpen: p.store.isOpen,
        items: [],
      };
      entry.items.push(p);
      map.set(p.store.slug, entry);
    }
    return map;
  }, [products]);

  const categoryChips = (
    <>
      <Chip selected={!query.category} onClick={() => go({ category: undefined })}>
        All
      </Chip>
      {categories.map((c) => (
        <Chip
          key={c.name}
          selected={query.category === c.name}
          onClick={() => go({ category: c.name })}
        >
          {c.name} · {c.productCount}
        </Chip>
      ))}
    </>
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* ── Heading ─────────────────────────────────────────────────────────
          The phone gets one line at the weight of body text — enough to say
          what this place is, not enough to cost a screenful. The full heading
          block returns at `sm`, where there is room for it above the fold. */}
      <p
        className="sm:hidden"
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--text-body)",
        }}
      >
        Verified African vendors · pay with mobile money
      </p>

      <div className="mb-5 hidden sm:block">
        <p className="ds-overline" style={{ marginBottom: 6 }}>
          Marketplace
        </p>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
            margin: 0,
          }}
        >
          Shop from verified African vendors
        </h1>
        <p className="muted" style={{ fontSize: 14.5, marginTop: 6 }}>
          Fashion, home, digital courses, e-books &amp; services — pay with mobile money, delivered
          nationwide.
        </p>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────────
          Phone: the field plus the two controls that act on its results, and a
          panel on focus. Desktop: the field alone, with the toolbar below. */}
      <div className="mb-3 sm:hidden">
        <ShopSearchRow
          value={search}
          onChange={setSearch}
          onSubmit={applySearch}
          onClear={clearSearch}
          filterCount={filterCount}
          onOpenFilters={() => setFiltersOpen(true)}
          list={list}
          onToggleLayout={() => setList(!list)}
          placeholder="Search products, stores, SKU…"
        />
      </div>

      <form
        className="mb-3 hidden max-w-2xl sm:block"
        onSubmit={(e) => {
          e.preventDefault();
          applySearch(search);
        }}
      >
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={clearSearch}
          filled
          placeholder="Search products, stores, SKU…"
        />
      </form>

      {/* ── Category rail ───────────────────────────────────────────────────
          Phone: Grouped/All pinned at the head, the chips scrolling between it
          and the button that opens the full list. Both ends are outside the
          scroller, so neither can be scrolled out of reach. */}
      <div className="mb-3 flex items-center gap-2 sm:hidden">
        <div style={{ flexShrink: 0 }}>
          <GroupedToggle grouped={grouped} onChange={setGrouped} />
        </div>
        <div className="row-chips" style={{ flex: 1, minWidth: 0 }}>
          {categoryChips}
        </div>
      </div>

      <div className="row-chips mb-3 hidden sm:flex">{categoryChips}</div>

      {/* ── Toolbar — desktop only. See the note at the top of the file. ──── */}
      <div className="mb-3 hidden flex-wrap items-center gap-2 sm:flex">
        <GroupedToggle grouped={grouped} onChange={setGrouped} />
        <div className="ms-auto flex min-w-0 items-center gap-2">
          <span className="muted hidden sm:inline" style={{ fontSize: 12.5 }}>
            {meta.total} result{meta.total === 1 ? "" : "s"}
          </span>
          <Select
            size="sm"
            value={query.sort ?? "newest"}
            onChange={(e) => go({ sort: e.target.value as SortKey })}
            leadingIcon="arrow-up-down"
            // Offered only with a query behind it: without one there is no
            // relevance score, and the API would be ranking on nothing.
            options={SORT_OPTIONS.filter((o) => o.value !== "relevance" || Boolean(query.q))}
            aria-label="Sort products"
          />
          <IconButton
            icon="sliders-horizontal"
            variant="surface"
            label={filterCount ? `Filters (${filterCount})` : "Filters"}
            onClick={() => setFiltersOpen(true)}
            style={filterCount ? { borderColor: "var(--brand)", color: "var(--brand-hover)" } : undefined}
          />
          <IconButton
            icon={list ? "layout-grid" : "list"}
            variant="surface"
            label="Toggle layout"
            onClick={() => setList(!list)}
          />
        </div>
      </div>

      {/* Active filters */}
      {filterCount > 0 && (
        <div className="row-chips mb-4">
          {query.type?.map((t) => (
            <Chip
              key={t}
              selected
              solid
              size="sm"
              removable
              onRemove={() => go({ type: query.type?.filter((x) => x !== t) })}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </Chip>
          ))}
          {query.inStock && (
            <Chip selected solid size="sm" removable onRemove={() => go({ inStock: undefined })}>
              In stock
            </Chip>
          )}
          {typeof query.minPrice === "number" && (
            <Chip selected solid size="sm" removable onRemove={() => go({ minPrice: undefined })}>
              ≥ {formatXAF(query.minPrice)}
            </Chip>
          )}
          {typeof query.maxPrice === "number" && (
            <Chip selected solid size="sm" removable onRemove={() => go({ maxPrice: undefined })}>
              ≤ {formatXAF(query.maxPrice)}
            </Chip>
          )}
        </div>
      )}

      {/* Results */}
      <div style={{ opacity: busy ? 0.55 : 1, transition: "opacity .15s" }}>
        {products.length === 0 ? (
          <EmptyState
            icon="search-x"
            title="No products found"
            description={
              query.q
                ? `Nothing matches “${query.q}”. Search matches whole words, so try a complete one — or clear a filter.`
                : "Try clearing a filter or searching something else."
            }
            actionLabel="Clear all"
            onAction={() => {
              setSearch("");
              startTransition(() => router.push("/shop"));
            }}
          />
        ) : grouped ? (
          Array.from(byStore.entries()).map(([slug, store]) => (
            <div key={slug} className="mb-8">
              <div className="mb-3">
                <VendorCard
                  name={store.name}
                  productCount={store.items.length}
                  isOpen={store.isOpen}
                  href={storePath(slug)}
                />
              </div>
              <div className={list ? "plist" : "pgrid"}>
                {store.items.map((p) => card(p, false))}
              </div>
            </div>
          ))
        ) : (
          <div className={list ? "plist" : "pgrid"}>{products.map((p) => card(p, true))}</div>
        )}
      </div>

      <Pagination meta={meta} onGo={(page) => go({ page }, true)} busy={busy} />

      <BottomSheet
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
          setCategorySheetOpen(false);
        }}
        title="Filters"
        footer={
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft({
                  ...query,
                  type: undefined,
                  inStock: undefined,
                  minPrice: undefined,
                  maxPrice: undefined,
                  // The category is a filter like any other, and on a phone it
                  // is a control inside this very sheet — leaving it set while
                  // everything around it clears would read as a bug.
                  category: undefined,
                });
              }}
            >
              Reset
            </Button>
            <Button
              block
              onClick={() => {
                setFiltersOpen(false);
                setCategorySheetOpen(false);
                go({
                  type: draft.type,
                  inStock: draft.inStock,
                  minPrice: draft.minPrice,
                  maxPrice: draft.maxPrice,
                  category: draft.category,
                  sort: draft.sort,
                });
              }}
            >
              Apply
            </Button>
          </div>
        }
      >
        <FilterBody
          draft={draft}
          setDraft={setDraft}
          categories={categories}
          hasQuery={Boolean(query.q)}
          categorySheetOpen={categorySheetOpen}
          setCategorySheetOpen={setCategorySheetOpen}
        />
      </BottomSheet>
    </div>
  );
}

/* ─── Grouped / All ───────────────────────────────────────────────────────── */

/**
 * How the results are arranged, not which ones they are — which is why it is
 * not in the filter sheet with sort. On a phone it heads the category rail; on
 * a desktop it heads the toolbar. Same control, two homes.
 *
 * ── One button, two labels ───────────────────────────────────────────────────
 *
 * It looks like a segmented control and behaves like a switch: a tap anywhere
 * on it flips to the other mode. It was two buttons, which meant tapping the
 * half that was already lit did nothing — on a rail of 12.5px labels that is a
 * dead zone covering half the control, and the shopper's read of it ("I pressed
 * it and nothing happened") is correct.
 *
 * There are only ever two states, so "the other one" is unambiguous and a
 * switch is the honest widget. The segmented look is kept because it is what
 * says which mode is on; `role="switch"` is what says it can be flipped.
 */
function GroupedToggle({
  grouped,
  onChange,
}: {
  grouped: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={grouped}
      aria-label="Group results by store"
      onClick={() => onChange(!grouped)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--surface-2)",
        border: "none",
        borderRadius: 999,
        padding: 3,
        cursor: "pointer",
      }}
    >
      {(
        [
          ["Grouped", true],
          ["All", false],
        ] as const
      ).map(([label, g]) => (
        <span
          key={label}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 999,
            background: grouped === g ? "var(--surface)" : "transparent",
            color: grouped === g ? "var(--brand-hover)" : "var(--text-muted)",
            boxShadow: grouped === g ? "var(--shadow-xs)" : "none",
            transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
          }}
        >
          {label}
        </span>
      ))}
    </button>
  );
}

/* ─── Pagination ──────────────────────────────────────────────────────────── */

function Pagination({
  meta,
  onGo,
  busy,
}: {
  meta: ListMeta;
  onGo: (page: number) => void;
  busy: boolean;
}) {
  if (meta.pages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 24 }}
    >
      <Button
        variant="ghost"
        disabled={busy || meta.page <= 1}
        onClick={() => onGo(meta.page - 1)}
      >
        Previous
      </Button>
      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
        Page {meta.page} of {meta.pages}
      </span>
      <Button
        variant="ghost"
        disabled={busy || meta.page >= meta.pages}
        onClick={() => onGo(meta.page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}

/* ─── Filter sheet ────────────────────────────────────────────────────────── */

/**
 * Every control here maps to a real query parameter.
 *
 * The sheet used to also offer a minimum star rating, a "delivery available"
 * toggle and a popularity sort. None of the three has anything behind it — there
 * is no review system, `freeDelivery` is not a filterable field, and nothing
 * tracks sales — so they are gone rather than left on screen doing nothing.
 *
 * Sort is phone-only. On a desktop it is already a dropdown in the toolbar, and
 * duplicating it here would give one setting two controls that can disagree
 * about which of them the shopper last touched. Category is shown at every
 * width: the chip rail is a shortcut to the popular few, this is the whole list.
 */
function FilterBody({
  draft,
  setDraft,
  categories,
  hasQuery,
  categorySheetOpen,
  setCategorySheetOpen,
}: {
  draft: ProductListQuery;
  setDraft: React.Dispatch<React.SetStateAction<ProductListQuery>>;
  categories: CategoryCount[];
  hasQuery: boolean;
  categorySheetOpen: boolean;
  setCategorySheetOpen: (open: boolean) => void;
}) {
  const toggleType = (t: ProductType) =>
    setDraft((f) => {
      const current = f.type ?? [];
      const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
      return { ...f, type: next.length ? next : undefined };
    });

  return (
    <div>
      <Section title="Category">
        <CategoryField
          categories={categories}
          value={draft.category}
          onChange={(category) => setDraft((f) => ({ ...f, category }))}
          sheetOpen={categorySheetOpen}
          setSheetOpen={setCategorySheetOpen}
        />
      </Section>

      <div className="sm:hidden">
        <Section title="Sort by">
          <Select
            value={draft.sort ?? "newest"}
            onChange={(e) => setDraft((f) => ({ ...f, sort: e.target.value as SortKey }))}
            leadingIcon="arrow-up-down"
            options={SORT_OPTIONS.filter((o) => o.value !== "relevance" || hasQuery)}
            aria-label="Sort products"
          />
        </Section>
      </div>

      <Section title="Product type">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(
            [
              ["physical", "package", "Physical"],
              ["digital", "download", "Digital"],
              ["service", "calendar-clock", "Service"],
            ] as const
          ).map(([t, icon, label]) => (
            <Chip key={t} icon={icon} selected={draft.type?.includes(t) ?? false} onClick={() => toggleType(t)}>
              {label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title={`Max price · ${draft.maxPrice ? formatXAF(draft.maxPrice) : "Any"}`}>
        <input
          type="range"
          min={0}
          max={PRICE_CEILING}
          step={1000}
          value={draft.maxPrice ?? PRICE_CEILING}
          onChange={(e) => {
            const value = Number(e.target.value);
            // The ceiling means "no upper bound" — sending it would filter out a
            // product priced above it for no reason the shopper asked for.
            setDraft((f) => ({ ...f, maxPrice: value >= PRICE_CEILING ? undefined : value }));
          }}
          style={{ width: "100%", accentColor: "var(--brand)" }}
        />
      </Section>

      <Section title="Availability">
        <ToggleRow
          label="In stock only"
          icon="package-check"
          on={Boolean(draft.inStock)}
          onChange={(v) => setDraft((f) => ({ ...f, inStock: v ? true : undefined }))}
        />
      </Section>
    </div>
  );
}

/* ─── Category ────────────────────────────────────────────────────────────── */

const ANY_CATEGORY = "";

/**
 * One category, chosen two ways.
 *
 * It is a single-select because the API is: `ProductListQuery.category` is one
 * string and `buildProductSearchParams` writes one `?category=`. A multi-select
 * here would let a shopper pick three and silently apply one.
 *
 * A desktop gets a native `<select>` — the platform's own popup, keyboard
 * behaviour and type-ahead included. A phone gets a sheet with one category per
 * row, because a native select on a small screen is a cramped wheel and because
 * these rows carry a product count that a `<select>` renders as flat text.
 */
function CategoryField({
  categories,
  value,
  onChange,
  sheetOpen,
  setSheetOpen,
}: {
  categories: CategoryCount[];
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
}) {
  const current = categories.find((c) => c.name === value);
  const label = current ? `${current.name} · ${current.productCount}` : "All categories";

  return (
    <>
      {/* Desktop — the platform's own select. */}
      <div className="hidden sm:block">
        <Select
          value={value ?? ANY_CATEGORY}
          onChange={(e) => onChange(e.target.value || undefined)}
          leadingIcon="layers"
          aria-label="Category"
          options={[
            { value: ANY_CATEGORY, label: "All categories" },
            ...categories.map((c) => ({
              value: c.name,
              label: `${c.name} · ${c.productCount}`,
            })),
          ]}
        />
      </div>

      {/* Phone — a row that opens a sheet of rows. */}
      <button
        type="button"
        className="sm:hidden"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          width: "100%",
          height: 46,
          padding: "0 12px",
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius-input)",
          cursor: "pointer",
        }}
      >
        <Icon name="layers" size={17} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "start",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-strong)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <Icon name="chevron-down" size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      </button>

      {/* Stacked above the filter sheet it opens from — see BottomSheet's
          `layer` prop for why DOM order alone is not enough. */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Category"
        layer="top"
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <CategoryRow
            label="All categories"
            selected={!value}
            onClick={() => {
              onChange(undefined);
              setSheetOpen(false);
            }}
          />
          {categories.map((c) => (
            <CategoryRow
              key={c.name}
              label={c.name}
              count={c.productCount}
              selected={value === c.name}
              onClick={() => {
                onChange(c.name);
                setSheetOpen(false);
              }}
            />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

function CategoryRow({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "13px 4px",
        border: "none",
        borderBottom: "1px solid var(--border-subtle)",
        background: "transparent",
        cursor: "pointer",
        textAlign: "start",
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14.5,
          fontWeight: selected ? 800 : 600,
          color: selected ? "var(--brand-hover)" : "var(--text-strong)",
        }}
      >
        {label}
      </span>
      {typeof count === "number" && (
        <span className="muted" style={{ fontSize: 12.5 }}>
          {count}
        </span>
      )}
      {selected && <Icon name="check" size={18} style={{ color: "var(--brand)" }} />}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p className="ds-overline" style={{ marginBottom: 10 }}>
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
        type="button"
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
