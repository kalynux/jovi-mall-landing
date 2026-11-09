"use client";

import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/shop/ds";
import type { TeaserItem } from "@/lib/shop/drawer-teaser";
import { useHydrated } from "@/lib/use-hydrated";
import { DRAWER_MS, type PullDrawer } from "./usePullDrawer";

/** Which side the drawer leads to: blue for listings, brand green for products. */
export type DrawerTone = "listing" | "product";

export const TONE: Record<DrawerTone, { accent: string; soft: string; icon: IconName }> = {
  listing: { accent: "var(--type-listing)", soft: "var(--type-listing-bg)", icon: "megaphone" },
  product: { accent: "var(--brand)", soft: "var(--brand-subtle)", icon: "package" },
};

/** The desktop rail's width. The drawer previews keep a strip this wide too. */
export const RAIL_WIDTH = 320;

/**
 * The incoming page, sliding in from the inline end over a dimming scrim.
 *
 * Portalled to `<body>`: the tab sits inside the shop's scroll pane, and a
 * fixed element inside a transformed or scrolling ancestor is fixed to that
 * ancestor, not to the screen. It stops under the header and above the tab
 * bar, so the shell around the page stays put while the page changes.
 *
 * `fade` is the desktop rail's drawer: it starts at the rail's inner edge, on
 * top of the rail, so it fades in over the first stretch of the pull instead of
 * appearing as a hard-edged sheet over the preview.
 */
export function DrawerOverlay({ drawer, fade = false, children }: { drawer: PullDrawer; fade?: boolean; children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated || drawer.phase === "idle") return null;

  const { progress, rest, top, rtl, phase } = drawer;
  const moving = phase === "dragging";
  const x = (rtl ? -1 : 1) * (1 - progress) * rest;
  const box: CSSProperties = { position: "fixed", insetInline: 0, top, bottom: "var(--tabbar-h, 0px)", pointerEvents: "none" };

  return createPortal(
    <>
      <div
        aria-hidden="true"
        style={{
          ...box,
          zIndex: 150,
          background: "#1A1915",
          opacity: progress * 0.18,
          transition: moving ? "none" : `opacity ${DRAWER_MS}ms ease`,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          ...box,
          zIndex: 151,
          overflow: "hidden",
          background: "var(--bg-app)",
          transform: `translateX(${x}px)`,
          opacity: fade ? Math.min(1, progress * 5) : 1,
          boxShadow: progress > 0 ? `${rtl ? 14 : -14}px 0 36px rgba(26, 25, 21, 0.2)` : "none",
          transition: moving
            ? "none"
            : `transform ${DRAWER_MS}ms cubic-bezier(.22,.8,.24,1), opacity ${fade ? 160 : DRAWER_MS}ms ease`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

/**
 * One photo per face, stacked, the current one opaque. Every face is in the
 * DOM so the change is a crossfade, not an image popping in.
 */
export function TeaserAvatar({
  items,
  index,
  tone,
  size,
  shape,
}: {
  items: readonly TeaserItem[];
  index: number;
  tone: DrawerTone;
  size: number | "fill";
  shape: "circle" | "square" | "box";
}) {
  const t = TONE[tone];
  const radius = shape === "circle" ? "50%" : shape === "square" ? 14 : 0;
  const outer: CSSProperties =
    size === "fill"
      ? { position: "absolute", inset: 0 }
      : { position: "relative", width: size, height: size, flexShrink: 0 };
  const ring: CSSProperties =
    shape === "box" ? {} : { boxShadow: `0 0 0 2px var(--surface), 0 0 0 3.5px ${t.accent}` };

  return (
    <span aria-hidden="true" style={{ ...outer, borderRadius: radius, ...ring }}>
      {items.map((item, i) => (
        <span
          key={item.id}
          className="teaser-face"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            overflow: "hidden",
            background: t.soft,
            color: t.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: i === index ? 1 : 0,
          }}
        >
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- a CDN thumbnail, sized by its box
            <img
              src={item.image}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Icon name={t.icon} size={typeof size === "number" ? Math.round(size * 0.46) : 44} strokeWidth={1.8} />
          )}
        </span>
      ))}
    </span>
  );
}

/** The current face's name and its subtitle, crossfading with the avatar. */
export function TeaserLines({
  items,
  index,
  titleSize = 14.5,
}: {
  items: readonly TeaserItem[];
  index: number;
  titleSize?: number;
}) {
  const titleH = Math.round(titleSize * 1.32);
  const line: CSSProperties = {
    position: "absolute",
    inset: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  return (
    <>
      <span style={{ position: "relative", display: "block", height: titleH }}>
        {items.map((item, i) => (
          <span
            key={item.id}
            className="teaser-face"
            aria-hidden={i === index ? undefined : true}
            style={{ ...line, fontSize: titleSize, lineHeight: `${titleH}px`, fontWeight: 800, color: "var(--text-strong)", opacity: i === index ? 1 : 0 }}
          >
            {item.title}
          </span>
        ))}
      </span>
      <span style={{ position: "relative", display: "block", height: 17 }}>
        {items.map((item, i) => (
          <span
            key={item.id}
            className="teaser-face"
            aria-hidden={i === index ? undefined : true}
            style={{ ...line, fontSize: 12, lineHeight: "17px", color: "var(--text-muted)", opacity: i === index ? 1 : 0 }}
          >
            {item.subtitle}
          </span>
        ))}
      </span>
    </>
  );
}

/** Three chevrons lighting up toward the inline start: "this way". */
export function PullChevrons({ color, vertical = false }: { color: string; vertical?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", color, flexShrink: 0 }}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="pull-chev" style={{ display: "inline-flex", margin: vertical ? "-3px 0" : "0 -4px" }}>
          <Icon name="chevron-left" size={17} strokeWidth={2.6} className="rtl-flip" />
        </span>
      ))}
    </span>
  );
}

/**
 * What the phone tab looks like, without its behaviour: the tab draws it inside
 * its link, and the drawer previews draw it inert, so the incoming page already
 * has its tab where the real one will be.
 */
export function TabFace({
  items,
  index,
  tone,
  label,
}: {
  items: readonly TeaserItem[];
  index: number;
  tone: DrawerTone;
  label: string;
}) {
  const t = TONE[tone];
  return (
    <>
      <span
        aria-hidden="true"
        style={{ width: 4, height: 30, borderRadius: 4, flexShrink: 0, background: `color-mix(in srgb, ${t.accent} 35%, transparent)` }}
      />
      <TeaserAvatar items={items} index={index} tone={tone} size={48} shape={tone === "listing" ? "circle" : "square"} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: t.accent }}>
          {label}
        </span>
        <TeaserLines items={items} index={index} />
      </span>
      <PullChevrons color={t.accent} />
    </>
  );
}

/** The tab's own box: flush with the screen's inline end, rounded on the start side. */
export function tabShellStyle(tone: DrawerTone): CSSProperties {
  const t = TONE[tone];
  return {
    display: "flex",
    alignItems: "center",
    gap: 11,
    minHeight: 72,
    paddingBlock: 10,
    paddingInlineStart: 8,
    paddingInlineEnd: 16,
    background: "var(--surface)",
    border: `1.5px solid color-mix(in srgb, ${t.accent} 35%, transparent)`,
    borderInlineEnd: "none",
    borderStartStartRadius: 18,
    borderEndStartRadius: 18,
    boxShadow: `0 6px 18px color-mix(in srgb, ${t.accent} 14%, transparent)`,
    color: "inherit",
    textDecoration: "none",
  };
}
