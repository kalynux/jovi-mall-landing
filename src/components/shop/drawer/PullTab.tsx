"use client";

import { useCallback, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { TeaserItem } from "@/lib/shop/drawer-teaser";
import { DrawerOverlay, TabFace, tabShellStyle, type DrawerTone } from "./TeaserParts";
import { usePullDrawer, useTeaserRotation } from "./usePullDrawer";

/**
 * The phone and tablet way across: a tab at the top of the page, flush with
 * the screen's inline end, that pulls out into the other page.
 *
 * It nudges toward the inline start every few seconds (the hint that it
 * moves), and its face rotates through the first few listings or products.
 * Pulled past a quarter, or tapped, the other page slides in over this one
 * from the inline end and the router takes over. Hidden from `lg`, where the
 * side rail does the same job.
 *
 * Renders nothing without items: a tab advertising nothing reads as broken.
 */
export function PullTab({
  href,
  tone,
  label,
  ariaLabel,
  items,
  preview,
}: {
  href: string;
  tone: DrawerTone;
  /** The overline: "View listings" / "View products". */
  label: string;
  ariaLabel: string;
  items: readonly TeaserItem[];
  /** The incoming page, drawn while it slides in. */
  preview: ReactNode;
}) {
  const measure = useCallback(() => window.innerWidth, []);
  const drawer = usePullDrawer(href, measure);
  const index = useTeaserRotation(items.length, drawer.phase !== "idle");
  if (items.length === 0) return null;

  return (
    // Bleeds through the page's inline-end gutter (px-4, sm:px-6) to the edge.
    <div className="-me-4 mb-3 sm:-me-6 lg:hidden">
      <Link
        href={href}
        aria-label={ariaLabel}
        className="pull-nudge"
        data-dragging={drawer.phase === "dragging" ? "true" : undefined}
        draggable={false}
        {...drawer.handlers}
        style={{
          ...tabShellStyle(tone),
          cursor: drawer.phase === "dragging" ? "grabbing" : "grab",
          // Vertical scrolling stays the browser's; sideways is the pull.
          touchAction: "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        <TabFace items={items} index={index} tone={tone} label={label} />
      </Link>
      <DrawerOverlay drawer={drawer}>{preview}</DrawerOverlay>
    </div>
  );
}
