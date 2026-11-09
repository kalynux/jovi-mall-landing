"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/shop/ds";
import type { TeaserItem } from "@/lib/shop/drawer-teaser";
import {
  DrawerOverlay,
  PullChevrons,
  RAIL_WIDTH,
  TONE,
  TeaserAvatar,
  TeaserLines,
  type DrawerTone,
} from "./TeaserParts";
import { usePullDrawer, useTeaserRotation } from "./usePullDrawer";

/** The shop header's height, for the rail to stick just under it. */
function useHeaderHeight(fallback = 64): number {
  const [height, setHeight] = useState(fallback);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".shop-header");
    if (!header) return;
    const publish = () => setHeight(header.offsetHeight);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return height;
}

/**
 * The desktop way across: the other side of the shop, previewed down the
 * screen's inline-end edge, with a lid that pulls it open.
 *
 * Listings beside the products on /shop, products beside the listings on
 * /shop/listings. The featured card at the top rotates like the phone tab; the
 * rows under it open their own pages. Dragging the lid toward the inline start
 * (or clicking it, or "See all") grows the other page out of the rail.
 *
 * Shown from `lg`; the page lays it out as the second column of a flex row
 * (see `DrawerColumns`). Renders nothing without items.
 */
export function SideRail({
  href,
  tone,
  heading,
  lead,
  lidLabel,
  ariaLabel,
  seeAllLabel,
  items,
  preview,
}: {
  href: string;
  tone: DrawerTone;
  heading: string;
  lead: string;
  /** The word written up the lid. */
  lidLabel: string;
  ariaLabel: string;
  seeAllLabel: string;
  items: readonly TeaserItem[];
  preview: ReactNode;
}) {
  const t = TONE[tone];
  const railRef = useRef<HTMLElement>(null);
  const top = useHeaderHeight();
  const measure = useCallback(() => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return window.innerWidth;
    const rtl = document.documentElement.dir === "rtl";
    return rtl ? window.innerWidth - rect.right : rect.left;
  }, []);
  const drawer = usePullDrawer(href, measure);
  const index = useTeaserRotation(items.length, drawer.phase !== "idle");
  if (items.length === 0) return null;
  const featured = items[index];

  return (
    <aside
      ref={railRef}
      aria-label={heading}
      className="hidden lg:flex"
      style={{
        position: "sticky",
        top,
        height: `calc(100vh - ${top}px)`,
        width: RAIL_WIDTH,
        flexShrink: 0,
        alignSelf: "flex-start",
        flexDirection: "column",
        background: `color-mix(in srgb, ${t.soft} 70%, var(--bg-app))`,
        borderInlineStart: `1px solid color-mix(in srgb, ${t.accent} 18%, var(--border))`,
      }}
    >
      {/* The lid: centred on the rail's inner edge, poking out of it. */}
      <div style={{ position: "absolute", top: "50%", insetInlineStart: -34, transform: "translateY(-50%)", zIndex: 1 }}>
        <Link
          href={href}
          aria-label={ariaLabel}
          className="pull-nudge"
          data-dragging={drawer.phase === "dragging" ? "true" : undefined}
          draggable={false}
          {...drawer.handlers}
          style={{
            width: 34,
            height: 168,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 0",
            borderStartStartRadius: 14,
            borderEndStartRadius: 14,
            background: t.accent,
            color: "#fff",
            boxShadow: `-6px 0 18px color-mix(in srgb, ${t.accent} 28%, transparent)`,
            textDecoration: "none",
            cursor: drawer.phase === "dragging" ? "grabbing" : "grab",
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <PullChevrons color="#fff" vertical />
          <span
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {lidLabel}
          </span>
          <span aria-hidden="true" style={{ width: 4, height: 22, borderRadius: 4, background: "rgba(255, 255, 255, 0.55)" }} />
        </Link>
      </div>

      <div style={{ padding: "22px 20px 10px" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-strong)" }}>
          <Icon name={t.icon} size={18} strokeWidth={2.2} style={{ color: t.accent }} />
          {heading}
        </h2>
        <p className="muted" style={{ margin: "3px 0 0", fontSize: 12.5 }}>
          {lead}
        </p>
      </div>

      {/* The featured face: the one the rotation is on, linked to its page. */}
      <Link
        href={featured.href}
        style={{
          display: "block",
          margin: "6px 20px 12px",
          background: "var(--surface)",
          border: `1px solid color-mix(in srgb, ${t.accent} 18%, var(--border))`,
          borderRadius: 16,
          overflow: "hidden",
          color: "inherit",
          textDecoration: "none",
        }}
      >
        <span style={{ position: "relative", display: "block", height: 150 }}>
          <TeaserAvatar items={items} index={index} tone={tone} size="fill" shape="box" />
          {items.length > 1 && (
            <span aria-hidden="true" style={{ position: "absolute", bottom: 9, insetInlineEnd: 10, display: "flex", gap: 4 }}>
              {items.map((item, i) => (
                <span
                  key={item.id}
                  style={{
                    width: i === index ? 16 : 6,
                    height: 6,
                    borderRadius: 6,
                    background: "#fff",
                    opacity: i === index ? 1 : 0.6,
                    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.12)",
                    transition: "width .3s ease, opacity .3s ease",
                  }}
                />
              ))}
            </span>
          )}
        </span>
        <span style={{ display: "block", padding: "10px 14px 12px" }}>
          <TeaserLines items={items} index={index} />
        </span>
      </Link>

      <ul style={{ flex: 1, minHeight: 0, overflowY: "auto", scrollbarWidth: "thin", listStyle: "none", margin: 0, padding: "0 20px" }}>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "9px 0",
                borderBottom: `1px solid color-mix(in srgb, ${t.accent} 12%, var(--border))`,
                color: "inherit",
                textDecoration: "none",
              }}
            >
              <TeaserAvatar items={[item]} index={0} tone={tone} size={40} shape={tone === "listing" ? "circle" : "square"} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.title}
                </span>
                <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.subtitle}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div style={{ padding: "12px 20px 18px" }}>
        <Link
          href={href}
          onClick={drawer.handlers.onClick}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 44,
            borderRadius: 12,
            border: `1.5px solid ${t.accent}`,
            background: "var(--surface)",
            color: t.accent,
            fontSize: 13.5,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          <Icon name="chevron-left" size={16} className="rtl-flip" />
          {seeAllLabel}
        </Link>
      </div>
      <DrawerOverlay drawer={drawer} fade>
        {preview}
      </DrawerOverlay>
    </aside>
  );
}

/**
 * The page and its rail, side by side from `lg`. Below it the rail is hidden
 * and this is a plain block. `drawer-main` narrows the product grid by a
 * column to make room (globals.css), so pass `rail={null}` when there is
 * nothing to advertise and the grid keeps its full width.
 */
export function DrawerColumns({ rail, children }: { rail: ReactNode | null; children: ReactNode }) {
  return (
    <div className="lg:flex">
      <div className={rail ? "drawer-main min-w-0 flex-1" : "min-w-0 flex-1"}>{children}</div>
      {rail}
    </div>
  );
}
