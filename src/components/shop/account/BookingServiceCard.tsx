"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, Icon } from "@/components/shop/ds";
import { productIdPath, productPath, storePath } from "@/lib/shop/shop.routes";
import { publicUrl } from "@/lib/shop/shop.types";
import type { Booking } from "@/lib/shop/bookings.api";
import { AccountCard } from "./AccountShell";

/**
 * The service a booking is for: its pictures, its name, the shop, and the way
 * back to its page.
 *
 * ── Why the link prefers the nested path ─────────────────────────────────────
 *
 * `productPath(store, slug)` is the page's real address. `productIdPath` is a
 * redirect stub that resolves the same page from an id, and is only the
 * fallback for a read that lacks a slug (an API older than 2026-10-26).
 *
 * ── `product: null` is a real state ──────────────────────────────────────────
 *
 * A vendor can delete a service after it was booked. The appointment still
 * stands, so the card keeps its place and says the listing is gone rather
 * than linking to a 404.
 */
/** What both the card and the phone row draw from, derived once. */
function serviceView(booking: Booking, fallbackTitle: string) {
  const product = booking.product ?? null;
  const store = booking.store ?? null;
  // Renderable pictures only — `publicUrl` is the allowlist, never `file.url`.
  const urls = (product?.images?.length ? product.images : product?.image ? [product.image] : [])
    .map((f) => publicUrl(f))
    .filter((u): u is string => !!u);
  const href = product
    ? store?.slug && product.slug
      ? productPath(store.slug, product.slug)
      : productIdPath(product.id)
    : null;
  return {
    store,
    urls,
    href,
    title: product?.title || fallbackTitle,
    vendorName: booking.vendor?.name ?? store?.name ?? null,
  };
}

/**
 * The phone's answer to "what did I book?" — a single tappable row at the top
 * of the status card, so the first screen names the service. From 768px the
 * full card sits beside the status and this row is not drawn.
 */
export function BookingServiceRow({ booking }: { booking: Booking }) {
  const t = useTranslations("shop.bookings");
  const { urls, href, title, vendorName } = serviceView(booking, t("serviceFallback"));

  const body = (
    <>
      {urls[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urls[0]}
          alt=""
          style={{
            width: 64,
            height: 64,
            borderRadius: "var(--radius-md)",
            objectFit: "cover",
            flexShrink: 0,
            background: "var(--surface-2)",
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            width: 64,
            height: 64,
            borderRadius: "var(--radius-md)",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-2)",
            color: "var(--text-muted)",
          }}
        >
          <Icon name="calendar-clock" size={24} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.3,
            color: "var(--text-strong)",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </span>
        {vendorName && (
          <span
            className="muted"
            style={{
              display: "block",
              fontSize: 12.5,
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {t("withVendor", { vendor: vendorName })}
          </span>
        )}
      </span>
      {href && (
        <Icon
          name="chevron-right"
          size={18}
          className="rtl:rotate-180"
          style={{ color: "var(--text-muted)", flexShrink: 0 }}
        />
      )}
    </>
  );

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottom: "1px solid var(--border-subtle)",
  } as const;

  return href ? (
    <Link href={href} style={rowStyle}>
      {body}
    </Link>
  ) : (
    <div style={rowStyle}>{body}</div>
  );
}

export function BookingServiceCard({ booking }: { booking: Booking }) {
  const t = useTranslations("shop.bookings");
  const router = useRouter();
  const { store, urls, href, title, vendorName } = serviceView(booking, t("serviceFallback"));
  const [active, setActive] = useState(0);
  const shown = urls[Math.min(active, urls.length - 1)] ?? null;

  return (
    <AccountCard style={{ padding: 0, overflow: "hidden" }}>
      <section aria-label={t("detail.serviceHeading")}>
        <div style={{ position: "relative", background: "var(--surface-2)" }}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt={title}
              className="block aspect-[16/10] w-full object-cover md:aspect-[4/3]"
            />
          ) : (
            <div
              className="flex aspect-[16/10] w-full items-center justify-center md:aspect-[4/3]"
              style={{ color: "var(--text-muted)" }}
            >
              <Icon name="calendar-clock" size={40} />
            </div>
          )}
        </div>

        {urls.length > 1 && (
          <div
            role="group"
            aria-label={t("detail.photos")}
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 14px 0",
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {urls.map((url, i) => (
              <button
                key={url}
                type="button"
                aria-label={t("detail.photoOf", { n: i + 1, total: urls.length })}
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                className="h-12 w-12 shrink-0 md:h-14 md:w-14"
                style={{
                  padding: 0,
                  borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                  border: `2px solid ${i === active ? "var(--brand)" : "transparent"}`,
                  background: "var(--surface-2)",
                  cursor: "pointer",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="block h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: 14 }}>
          <div className="ds-overline" style={{ marginBottom: 4 }}>
            {t("detail.serviceHeading")}
          </div>
          {href ? (
            <Link
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                minHeight: 44,
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1.3,
                color: "var(--text-strong)",
                overflowWrap: "anywhere",
              }}
            >
              {title}
            </Link>
          ) : (
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1.3,
                color: "var(--text-strong)",
                overflowWrap: "anywhere",
              }}
            >
              {title}
            </div>
          )}

          {vendorName && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, minHeight: 44 }}>
              <Icon name="store" size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              {store?.slug ? (
                <Link
                  href={storePath(store.slug)}
                  className="muted"
                  // The row is the 44px target, not the 13px line of text.
                  style={{
                    fontSize: 13.5,
                    overflowWrap: "anywhere",
                    minHeight: 44,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {t("withVendor", { vendor: vendorName })}
                </Link>
              ) : (
                <span className="muted" style={{ fontSize: 13.5, overflowWrap: "anywhere" }}>
                  {t("withVendor", { vendor: vendorName })}
                </span>
              )}
            </div>
          )}

          {href ? (
            <Button
              block
              variant="secondary"
              trailingIcon="chevron-right"
              style={{ marginTop: 6 }}
              onClick={() => router.push(href)}
            >
              {t("detail.viewService")}
            </Button>
          ) : (
            <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>
              {t("detail.serviceUnavailable")}
            </p>
          )}
        </div>
      </section>
    </AccountCard>
  );
}
