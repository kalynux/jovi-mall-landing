"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Icon, IconButton, type IconName } from "@/components/shop/ds";
import {
  clearRecentSearches,
  forgetSearch,
  readRecentSearches,
} from "@/lib/shop/recent-searches";

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** Run the search. Called with the text already trimmed and non-empty. */
  onSubmit: (query: string) => void;
  onClear: () => void;
  filterCount: number;
  onOpenFilters: () => void;
  list: boolean;
  onToggleLayout: () => void;
  placeholder: string;
  /**
   * The two seams this panel exists to leave open.
   *
   * Neither has an endpoint behind it yet — there is no suggest route, and
   * nothing tracks what is popular — so both default to empty and their
   * sections do not render. When the API arrives, the panel already has the
   * shape, the styling and the keyboard behaviour; only these two props change.
   *
   * Deliberately NOT faked in the meantime: a "recommended" row filled with
   * whatever happened to be on page one teaches shoppers to ignore the panel.
   */
  suggestions?: string[];
  recommended?: string[];
}

/**
 * The phone's search row: the field, the two controls that belong to it, and
 * the panel that opens underneath on focus.
 *
 * ── Why the icons are in the row ────────────────────────────────────────────
 *
 * Filters and layout used to sit on a second line below, in a toolbar with the
 * sort dropdown and the Grouped/All switch — five controls that measured wider
 * than a phone and wrapped, spending two rows on chrome before the first
 * product. They act on the result set, which is what the search field produces,
 * so they belong beside it and nowhere else. Sort went into the filter sheet;
 * Grouped/All went to the head of the category row.
 *
 * ── Why focus opens a panel ─────────────────────────────────────────────────
 *
 * The backend search is a `$text` index over whole words, so there is nothing
 * useful to show *per keystroke* and the query is submitted, not live. That
 * leaves the moment of focus as the one time this component knows something the
 * shopper does not have on screen: what they searched for last time.
 */
export function ShopSearchRow({
  value,
  onChange,
  onSubmit,
  onClear,
  filterCount,
  onOpenFilters,
  list,
  onToggleLayout,
  placeholder,
  suggestions = [],
  recommended = [],
}: Props) {
  const t = useTranslations("shop.chrome.search");
  // Root-scoped, for the shared vocabulary in `shop.common`.
  const tKey = useTranslations();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Read on open rather than on mount: the list changes as the shopper
  // searches, and this way it is never stale when it is actually on screen.
  useEffect(() => {
    if (!open) return;
    let live = true;
    void readRecentSearches().then((r) => live && setRecent(r));
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = useCallback(
    (query: string) => {
      const q = query.trim();
      setOpen(false);
      inputRef.current?.blur();
      if (!q) return;
      onSubmit(q);
    },
    [onSubmit]
  );

  const pick = (query: string) => {
    onChange(query);
    submit(query);
  };

  const hasPanelContent = recent.length > 0 || suggestions.length > 0 || recommended.length > 0;

  return (
    <div ref={rowRef} style={{ position: "relative", zIndex: open ? 60 : "auto" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        {/* The field. Its own element rather than the shared SearchBar: this one
            needs a ref, a focus handler and a submit, and pushing all three
            through SearchBar would have made every other caller carry them. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flex: 1,
            minWidth: 0,
            height: 46,
            padding: "0 12px",
            background: "var(--surface-2)",
            border: `1.5px solid ${open ? "var(--brand)" : "var(--border)"}`,
            borderRadius: "var(--radius-input)",
            transition: "border-color var(--dur-fast) var(--ease-out)",
          }}
        >
          <Icon name="search" size={19} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            type="search"
            enterKeyHint="search"
            className="no-native-clear"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--text-strong)",
            }}
          />
          {value && (
            <button
              type="button"
              aria-label={t("clear")}
              onClick={() => {
                onChange("");
                onClear();
                inputRef.current?.focus();
              }}
              style={{
                display: "inline-flex",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--text-muted)",
              }}
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        {/* Filters — with its count, because a filter you cannot see is a
            result set you cannot explain. */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <IconButton
            icon="sliders-horizontal"
            variant="surface"
            label={
              filterCount
                ? t("filtersWithCount", { n: filterCount })
                : tKey("shop.common.filters")
            }
            onClick={onOpenFilters}
            style={
              filterCount
                ? { borderColor: "var(--brand)", color: "var(--brand-hover)" }
                : undefined
            }
          />
          {filterCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -5,
                insetInlineEnd: -5,
                minWidth: 17,
                height: 17,
                padding: "0 4px",
                borderRadius: 9,
                background: "var(--brand)",
                border: "2px solid var(--bg-app)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {filterCount}
            </span>
          )}
        </div>

        <IconButton
          icon={list ? "layout-grid" : "list"}
          variant="surface"
          label={t("toggleLayout")}
          onClick={onToggleLayout}
          style={{ flexShrink: 0 }}
        />
      </form>

      <AnimatePresence>
        {open && (
          <>
            {/* Catches the tap that dismisses. Fixed rather than absolute so it
                covers the grid regardless of how far the pane has scrolled. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onMouseDown={() => setOpen(false)}
              onTouchStart={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: -1, background: "var(--scrim)" }}
              aria-hidden="true"
            />

            <motion.div
              id={listboxId}
              role="listbox"
              aria-label={t("suggestionsLabel")}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                insetInlineStart: 0,
                insetInlineEnd: 0,
                maxHeight: "52vh",
                overflowY: "auto",
                padding: 6,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {hasPanelContent ? (
                <>
                  {recent.length > 0 && (
                    <Section
                      title={t("recent")}
                      action={{
                        label: tKey("shop.common.clearAll"),
                        onClick: () => void clearRecentSearches().then(setRecent),
                      }}
                    >
                      {recent.map((q) => (
                        <Row
                          key={q}
                          icon="clock"
                          label={q}
                          onClick={() => pick(q)}
                          onRemove={() => void forgetSearch(q).then(setRecent)}
                        />
                      ))}
                    </Section>
                  )}

                  {/* Both of these stay dark until the API exists — see the
                      note on the props. */}
                  {suggestions.length > 0 && (
                    <Section title={t("suggestions")}>
                      {suggestions.map((q) => (
                        <Row key={q} icon="search" label={q} onClick={() => pick(q)} />
                      ))}
                    </Section>
                  )}

                  {recommended.length > 0 && (
                    <Section title={t("popular")}>
                      {recommended.map((q) => (
                        <Row key={q} icon="sparkles" label={q} onClick={() => pick(q)} />
                      ))}
                    </Section>
                  )}
                </>
              ) : (
                <p
                  className="muted"
                  style={{ padding: "14px 10px", fontSize: 13, textAlign: "center" }}
                >
                  {t("wholeWords")}
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px 4px",
        }}
      >
        <span className="ds-overline" style={{ flex: 1 }}>
          {title}
        </span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--brand-hover)",
            }}
          >
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({
  icon,
  label,
  onClick,
  onRemove,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  onRemove?: () => void;
}) {
  // `label` is what the shopper typed — their words, interpolated, never
  // translated.
  const t = useTranslations("shop.chrome.search");

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <button
        type="button"
        role="option"
        aria-selected={false}
        onClick={onClick}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          borderRadius: "var(--radius-sm)",
          textAlign: "start",
        }}
      >
        <Icon name={icon} size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-strong)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={t("forget", { query: label })}
          onClick={onRemove}
          style={{
            flexShrink: 0,
            display: "inline-flex",
            padding: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-subtle)",
          }}
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
}
