"use client";

import { useCallback, useState } from "react";
import { isNetworkError } from "@/lib/errors/is-network-error";
import { useRouter } from "@/i18n/navigation";
import { Avatar, Badge, Button, EmptyState, Icon, ProductCard, Tabs } from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { CART_OFFLINE_MESSAGE } from "@/lib/shop/cart-errors";
import { useShopPageTitle } from "@/components/shop/ShopChrome";
import { resolveQuickAdd } from "@/lib/shop/quick-add";
import { productPathFor, storePath } from "@/lib/shop/shop.routes";
import { openApp } from "@/lib/native/links";
import { shareLink } from "@/lib/native/share";
import type { ListMeta, ProductListItem, ProductType, Store } from "@/lib/shop/shop.types";
import { publicUrl } from "@/lib/shop/shop.types";

/**
 * A store page.
 *
 * The grid is fetched server-side from `GET /api/public/stores/:slug/products`
 * and passed in. It used to filter the whole in-memory catalogue by `vendorId`,
 * which is not a thing that can be done against a paginated API — and the type
 * tabs below now navigate (`?type=`) rather than re-slicing an array, so the
 * counts are the API's and the tab state survives a reload.
 *
 * Gone with the mock: the star rating, the review count and the "Reviews" tab
 * that printed both. There is no review model in the backend, and a store page
 * is precisely where an invented 4.8 reads as a fact about a real business.
 */

interface Props {
  store: Store;
  products: ProductListItem[];
  meta: ListMeta;
  /** The `?type=` the grid was fetched with, so the tab matches the URL on load. */
  activeType?: ProductType;
}

const TYPE_TABS: { value: string; label: string; type?: ProductType }[] = [
  { value: "all", label: "All" },
  { value: "physical", label: "Products", type: "physical" },
  { value: "digital", label: "Digital", type: "digital" },
  { value: "service", label: "Services", type: "service" },
];

export function VendorStore({ store, products, meta, activeType }: Props) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const { flash } = useToast();

  // Names the seller in the header bar; the route alone only knows "Store".
  useShopPageTitle(store.name);

  // The grid is the point of the page, so it opens on the grid; "About" is a
  // deliberate detour. The initial value comes from the URL so a shared
  // `?type=digital` link opens on that tab rather than snapping back to All.
  const [tab, setTab] = useState<string>(activeType ?? "all");

  const goType = useCallback(
    (value: string) => {
      const type = TYPE_TABS.find((t) => t.value === value)?.type;
      router.push(type ? `${storePath(store.slug)}?type=${type}` : storePath(store.slug));
    },
    [router, store.slug]
  );

  const quickAdd = useCallback(
    async (item: ProductListItem) => {
      try {
        const resolved = await resolveQuickAdd(item.id);
        if (resolved.kind === "unavailable") {
          flash("That product is no longer available.");
          return;
        }
        if (resolved.kind === "choose") {
          router.push(productPathFor(item));
          return;
        }
        const outcome = await addItem(resolved.product, resolved.variant);
        if (outcome.kind === "added") {
          // Digital skips the cart — see `ProductDetail`. The card's ⚡ says so.
          if (resolved.product.type === "digital") router.push("/shop/checkout");
          else flash(`Added to cart · ${resolved.product.title}`);
        } else if (outcome.kind === "offline") flash(CART_OFFLINE_MESSAGE);
        else if (outcome.kind === "error") flash(outcome.message);
        else router.push(productPathFor(item));
      } catch (err) {
        /**
         * This catch covers `resolveQuickAdd` — a catalogue read — and NOT the
         * add itself, which returns its failures. Both can fail with no signal
         * and both must say so, which is why the sentence is shared with the
         * `offline` outcome above rather than living only here.
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

  const card = (item: ProductListItem) => (
    <ProductCard
      key={item.id}
      title={item.title}
      image={item.image?.url ?? null}
      type={item.type}
      price={item.price}
      compareAt={item.compareAtPrice}
      currency={item.currency}
      priceRange={item.priceRange}
      freeDelivery={item.freeDelivery}
      inStock={item.inStock}
      favorite={isFavorite(item.id)}
      onToggleFavorite={() => toggle(item.id)}
      onQuickAdd={() => void quickAdd(item)}
      href={productPathFor(item)}
    />
  );

  const where = [store.city, store.country].filter(Boolean).join(", ");

  return (
    <div>
      {/* Banner. Nullable — a store with none gets a flat brand panel rather
          than a broken image. */}
      <div style={{ position: "relative" }}>
        {publicUrl(store.banner) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicUrl(store.banner) ?? undefined}
            alt=""
            style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
            
          />
        ) : (
          <div style={{ width: "100%", height: 200, background: "var(--brand-subtle)" }} />
        )}
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6" style={{ position: "relative" }}>
          <div style={{ position: "absolute", bottom: -34, left: 16 }}>
            <Avatar
              name={store.name}
              src={store.logo?.url}
              size={80}
              shape="squircle"
              ring
              status={store.isOpen ? "open" : "closed"}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div style={{ padding: "44px 4px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--text-strong)",
                margin: 0,
              }}
            >
              {store.name}
            </h1>
            {store.verified && <Icon name="badge-check" size={18} style={{ color: "var(--brand)" }} />}
            {!store.isOpen && (
              <Badge tone="warning" size="sm">
                On vacation
              </Badge>
            )}
          </div>

          {/* Facts separated by spacing, not by a literal "·". The dots used to
              be baked into the strings, which reads fine on one line and badly
              on a phone: the row wraps, and every separator that lands at a
              wrap point dangles at the start of the next line. */}
          <div style={{ display: "flex", alignItems: "center", columnGap: 12, rowGap: 4, marginTop: 8, flexWrap: "wrap" }}>
            <span className="muted">
              {store.productCount} product{store.productCount === 1 ? "" : "s"}
            </span>
            {where && (
              <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Icon name="map-pin" size={13} />
                {where}
              </span>
            )}
            <span className="muted">Selling since {new Date(store.memberSince).getFullYear()}</span>
          </div>

          {store.description && (
            <p style={{ fontSize: 14.5, color: "var(--text-body)", lineHeight: 1.55, margin: "12px 0 0", maxWidth: 640 }}>
              {store.description}
            </p>
          )}

          {!store.isOpen && (
            <p className="muted" style={{ fontSize: 13, marginTop: 10, maxWidth: 640 }}>
              This seller is on holiday. Orders are still accepted and will be dispatched when they
              reopen.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {store.supportWhatsapp && (
              <Button
                variant="whatsapp"
                leadingIcon="message-circle"
                onClick={() =>
                  // The seller's WhatsApp belongs to WhatsApp — `openApp`, so the
                  // OS hands it to the installed client rather than rendering
                  // WhatsApp Web inside our own shell.
                  void openApp(
                    `https://wa.me/${store.supportWhatsapp!.replace(/[^\d]/g, "")}`
                  )
                }
              >
                Contact seller
              </Button>
            )}
            <Button
              variant="secondary"
              leadingIcon="share-2"
              /**
               * The toast has to be written from what actually happened.
               *
               * On the web this copies and says "Store link copied", which is
               * true. On a phone it opens the system share sheet, after which
               * "copied" is simply false — nothing was copied, and the shopper
               * has already sent the link to someone. And a share sheet the
               * shopper backs out of deserves silence, not a success message
               * for something they cancelled.
               */
              onClick={() => {
                void shareLink({
                  title: store.name,
                  url: window.location.href,
                  dialogTitle: `Share ${store.name}`,
                }).then((outcome) => {
                  if (outcome === "copied") flash("Store link copied");
                  else if (outcome === "failed") flash("Could not share the link");
                });
              }}
            >
              Share
            </Button>
          </div>
        </div>

        {/* Type filter. Navigates, so the grid comes from the API rather than a
            client-side slice of one page of it. */}
        <div style={{ marginTop: 16 }}>
          <Tabs
            value={tab}
            onChange={(value) => {
              setTab(value);
              if (value !== "about") goType(value);
            }}
            tabs={[...TYPE_TABS, { value: "about", label: "About" }]}
          />
        </div>

        {tab !== "about" ? (
          <div className="pgrid" style={{ paddingTop: 18 }}>
            {products.length ? (
              products.map(card)
            ) : (
              <div style={{ gridColumn: "1/-1" }}>
                <EmptyState
                  icon="package-open"
                  title="Nothing for sale right now"
                  description={`${store.name} has no listings matching this filter.`}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "18px 0", maxWidth: 560 }}>
            {where && <AboutRow icon="map-pin" label="Location" value={where} />}
            <AboutRow
              icon="badge-check"
              label="Verification"
              value={store.verified ? "Verified seller" : "Not yet verified"}
            />
            {store.supportWhatsapp && <AboutRow icon="phone" label="WhatsApp" value={store.supportWhatsapp} />}
            {store.supportEmail && <AboutRow icon="mail" label="Email" value={store.supportEmail} />}
            <AboutRow
              icon="calendar"
              label="Selling since"
              value={new Date(store.memberSince).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
              })}
            />
            <AboutRow icon="clock" label="Status" value={store.isOpen ? "Open now" : "On vacation"} />
          </div>
        )}

        {meta.pages > 1 && tab !== "about" && (
          <p className="muted" style={{ textAlign: "center", padding: "18px 0 24px", fontSize: 13 }}>
            Showing {products.length} of {meta.total}
          </p>
        )}

        <div style={{ height: 24 }} />
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
