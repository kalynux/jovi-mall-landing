"use client";
/**
 * A submenu in the primary header nav.
 *
 * Built on the same recipe as `UserMenuDropdown` — `aria-haspopup="menu"`,
 * `role="menu"`/`menuitem`, Escape and outside-click to close, a `ChevronDown`
 * that rotates 180° — so the two dropdowns in the header behave identically.
 *
 * Two things this one adds, both because it sits in the *navigation*:
 *
 * - **It opens on hover as well as on click.** Hover alone would be unreachable
 *   by keyboard and unusable on touch, so the click/Enter path is the real one
 *   and hover is the shortcut. Closing is deferred by a moment so a cursor
 *   travelling diagonally from the trigger to the third item does not fall out
 *   of the gap between them and dismiss the menu on the way.
 * - **Arrow-key roving focus.** A menu of five links is a list; Down/Up/Home/End
 *   move through it, Escape returns focus to the trigger, Tab leaves.
 *
 * Positioning uses logical `start-0` rather than `left-0` so the panel hangs off
 * the correct edge of its trigger in Arabic.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isNodeActive, type MenuNode } from "@/lib/nav/menu";

/** Milliseconds the panel stays open after the pointer leaves it. */
const CLOSE_DELAY = 140;

interface NavDropdownProps {
  node: Extract<MenuNode, { kind: "menu" }>;
  /** Locale-stripped pathname, from `usePathname()` in `@/i18n/navigation`. */
  pathname: string;
  t: ReturnType<typeof useTranslations>;
}

export default function NavDropdown({ node, pathname, t }: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * True while the panel is open only because the pointer is over the trigger.
   *
   * Without this the two ways of opening fight each other: a press fires
   * `mouseenter` before `click`, so hover opens the panel and the click
   * immediately toggles it shut again. On a mouse that reads as a menu that
   * flickers; on a touch-capable device wide enough for the desktop nav it
   * means the menu can never be opened at all. So the first click after a hover
   * *claims* the open panel rather than toggling it, and the next one closes.
   */
  const openedByHover = useRef(false);

  const isActive = isNodeActive(node, pathname);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      openedByHover.current = false;
      setOpen(false);
    }, CLOSE_DELAY);
  }, [cancelClose]);

  function handleTriggerClick() {
    // The decision must happen *inside* the functional update. A press delivers
    // `mouseenter` and `click` in one burst with no render between them, so the
    // `open` captured by this closure is still the pre-hover value — reading it
    // here would toggle against a state that has already changed and close the
    // panel the hover just opened.
    const claimedFromHover = openedByHover.current;
    openedByHover.current = false;
    setOpen((wasOpen) => (wasOpen && claimedFromHover ? true : !wasOpen));
  }

  // A pending timer that fires after unmount would set state on a dead
  // component; clear it on the way out.
  useEffect(() => cancelClose, [cancelClose]);

  // Close on outside click. Each dropdown owns its own ref, so several can
  // coexist in the header without stealing each other's outside-click.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        openedByHover.current = false;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Close on Escape, and hand focus back to the trigger so the tab order does
  // not restart at the top of the page.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        openedByHover.current = false;
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus targets are read from the DOM rather than tracked in a ref array:
  // focus order is document order, so the panel itself is the source of truth
  // and there is no parallel list to keep in sync.
  const focusItem = useCallback((index: number) => {
    const items = containerRef.current?.querySelectorAll<HTMLAnchorElement>(
      '[role="menuitem"]'
    );
    if (!items || items.length === 0) return;
    items[(index + items.length) % items.length]?.focus();
  }, []);

  function openAndFocus(index: number) {
    cancelClose();
    openedByHover.current = false;
    setOpen(true);
    // The panel mounts on the next frame, so the focus target does not exist yet.
    requestAnimationFrame(() => focusItem(index));
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openAndFocus(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAndFocus(-1);
    }
  }

  function onItemKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(index + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(index - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(-1);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        // Reading `open` is safe here in a way it is not in the click handler:
        // `mouseenter` fires on the transition *into* the trigger, so this
        // render's value is still current. Only the click that follows in the
        // same burst sees a stale one.
        if (!open) openedByHover.current = true;
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={onTriggerKeyDown}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "relative flex items-center gap-1 text-sm font-medium transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-md",
          isActive
            ? "text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        )}
      >
        {t(node.key)}
        <ChevronDown
          className={cn("w-3 h-3 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
        {isActive && (
          <motion.span
            layoutId="nav-active"
            className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-primary-500"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={t(node.key)}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute start-0 mt-3 w-52 glass border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50 py-1"
          >
            {node.items.map((item, i) => {
              const itemActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    role="menuitem"
                    aria-current={itemActive ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    onKeyDown={(e) => onItemKeyDown(e, i)}
                    className={cn(
                      "block px-3.5 py-2.5 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:bg-[var(--accent-light)] focus-visible:text-primary-600",
                      itemActive
                        ? "text-primary-600 bg-[var(--accent-light)] font-medium"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)]"
                    )}
                  >
                    {t(item.key)}
                  </Link>
                  {node.dividerAfter === item.key && (
                    <div className="h-px bg-[var(--border-medium)] mx-2 my-1" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
