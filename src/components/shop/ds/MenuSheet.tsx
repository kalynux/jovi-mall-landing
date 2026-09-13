"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { Icon, type IconName } from "./Icon";
import { BottomSheet } from "./BottomSheet";

export interface MenuSheetItem {
  icon: IconName;
  label: string;
  /** Where it goes. Mutually exclusive with `onClick`. */
  href?: string;
  onClick?: () => void;
  /** Renders in the danger colour — irreversible, or close to it. */
  danger?: boolean;
  /** One line under the label. The sheet shows it; the dropdown does not. */
  description?: string;
}

/**
 * An overflow menu that is a dropdown on a desktop and a bottom sheet on a
 * phone — the house rule for this app, in one component so the two halves stay
 * in step.
 *
 * Both are always rendered and one is hidden by a media query, rather than
 * picking a shape from `matchMedia`. That is deliberate: a runtime measurement
 * has no answer during SSR, so the first paint would either be wrong or absent,
 * and this menu can be opened before hydration settles. CSS knows the viewport
 * on the first frame and never disagrees with itself.
 *
 * The dropdown positions itself against the nearest positioned ancestor, so the
 * caller must give the trigger a `position: relative` wrapper.
 */
export function MenuSheet({
  open,
  onClose,
  title,
  items,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the sheet, and is read out for the dropdown. */
  title: string;
  items: MenuSheetItem[];
}) {
  const dropRef = useRef<HTMLDivElement>(null);

  // Outside click / Escape — the dropdown half only. The sheet gets both from
  // BottomSheet (scrim click, Escape) and would close twice.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = dropRef.current;
      // The trigger is outside this ref, so a click on it would close here and
      // reopen on its own handler. Its wrapper is the offset parent — walking
      // up to it covers the button and nothing else.
      if (el && !el.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const row = (item: MenuSheetItem, variant: "sheet" | "drop") => {
    const color = item.danger ? "var(--danger)" : "var(--text-strong)";
    const body = (
      <>
        <Icon
          name={item.icon}
          size={variant === "sheet" ? 19 : 17}
          style={{ color: item.danger ? "var(--danger)" : "var(--text-muted)", flexShrink: 0 }}
        />
        <span style={{ flex: 1, minWidth: 0, textAlign: "start" }}>
          <span
            style={{
              display: "block",
              fontSize: variant === "sheet" ? 14.5 : 13.5,
              fontWeight: 600,
              color,
            }}
          >
            {item.label}
          </span>
          {variant === "sheet" && item.description && (
            <span className="muted" style={{ display: "block", fontSize: 12.5, marginTop: 2 }}>
              {item.description}
            </span>
          )}
        </span>
      </>
    );

    const style = {
      display: "flex",
      alignItems: "center",
      gap: 11,
      width: "100%",
      padding: variant === "sheet" ? "13px 4px" : "9px 11px",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      textDecoration: "none",
      textAlign: "start",
    } as const;

    if (item.href) {
      return (
        <Link key={item.label} href={item.href} style={style} onClick={onClose}>
          {body}
        </Link>
      );
    }
    return (
      <button
        key={item.label}
        type="button"
        style={style}
        onClick={() => {
          onClose();
          item.onClick?.();
        }}
      >
        {body}
      </button>
    );
  };

  return (
    <>
      {/* ── Phone: bottom sheet ─────────────────────────────────────────── */}
      <div className="sm:hidden">
        <BottomSheet open={open} onClose={onClose} title={title}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((i) => row(i, "sheet"))}
          </div>
        </BottomSheet>
      </div>

      {/* ── Desktop: dropdown ───────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={dropRef}
            role="menu"
            aria-label={title}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="hidden sm:block"
            style={{
              position: "absolute",
              insetInlineEnd: 0,
              top: "calc(100% + 6px)",
              zIndex: 60,
              minWidth: 210,
              padding: 5,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {items.map((i) => row(i, "drop"))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
