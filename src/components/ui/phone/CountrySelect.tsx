"use client";
/**
 * CountrySelect — the calling-code selector that sits at the start of every
 * PhoneField. Not exported outside this folder; PhoneField is the public API.
 *
 * Two things drive the implementation:
 *
 * 1. **The popup is portalled.** The auth card (AuthSplitShell) and several
 *    shop surfaces clip their children with `overflow-hidden`, and the sticky
 *    checkout bar sits above them in the stacking order. A popup rendered in
 *    flow would be cut off on exactly the screens that matter, so it renders
 *    into `document.body` at a fixed position measured from the trigger, and
 *    flips above the field when there is no room below.
 *
 * 2. **Keyboard first.** 245 countries is unusable without search, and search
 *    is unusable without arrow-key navigation. Follows the APG combobox +
 *    listbox pattern: the trigger owns `aria-expanded`, the search input owns
 *    `aria-activedescendant`, and the option list is a real `listbox`.
 */
import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
    flagEmoji,
    getCountryMeta,
    searchCountries,
    type CountryCode,
    type CountryMeta,
} from "@/lib/phone";
import { useCountryNames } from "@/lib/phone/useCountryNames";

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 320;
const VIEWPORT_MARGIN = 8;

interface PanelPosition {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "above" | "below";
}

export interface CountrySelectProps {
    value: CountryCode;
    onChange: (country: CountryCode) => void;
    disabled?: boolean;
    /** Ties the trigger to the field's error text for screen readers. */
    describedBy?: string;
    /**
     * Trigger classes. PhoneField owns these because the flag/code has to sit
     * on the same baseline as the number, and that baseline differs between
     * the floating and stacked variants.
     */
    buttonClassName?: string;
}

export default function CountrySelect({
    value,
    onChange,
    disabled,
    describedBy,
    buttonClassName,
}: CountrySelectProps) {
    const t = useTranslations("phone");
    const localisedNames = useCountryNames();

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [position, setPosition] = useState<PanelPosition | null>(null);
    const [mounted, setMounted] = useState(false);

    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const listboxId = useId();
    const optionId = (index: number) => `${listboxId}-opt-${index}`;

    // Portals need a DOM; render nothing server-side.
    useEffect(() => setMounted(true), []);

    const selected = getCountryMeta(value);
    const nameOf = useCallback(
        (c: CountryMeta) => localisedNames[c.iso2] ?? c.name,
        [localisedNames]
    );

    const results = useMemo(
        () => searchCountries(query, localisedNames),
        [query, localisedNames]
    );

    // ── Positioning ─────────────────────────────────────────────────────────
    const measure = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
        const spaceAbove = rect.top - VIEWPORT_MARGIN;
        const placement: "above" | "below" =
            spaceBelow < 220 && spaceAbove > spaceBelow ? "above" : "below";

        const maxHeight = Math.max(
            160,
            Math.min(PANEL_MAX_HEIGHT, placement === "below" ? spaceBelow : spaceAbove)
        );
        const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
        const left = Math.min(
            Math.max(VIEWPORT_MARGIN, rect.left),
            window.innerWidth - width - VIEWPORT_MARGIN
        );

        setPosition({
            top: placement === "below" ? rect.bottom + 6 : rect.top - maxHeight - 6,
            left,
            width,
            maxHeight,
            placement,
        });
    }, []);

    useLayoutEffect(() => {
        if (!open) return;
        measure();

        // `true` — capture phase, so the panel also follows ancestors that
        // scroll (the auth card, the shop page body), not just the window.
        window.addEventListener("scroll", measure, true);
        window.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("scroll", measure, true);
            window.removeEventListener("resize", measure);
        };
    }, [open, measure]);

    // ── Open / close ────────────────────────────────────────────────────────
    const openPanel = useCallback(() => {
        if (disabled) return;
        setQuery("");
        const index = results.findIndex((c) => c.iso2 === value);
        setActiveIndex(index >= 0 ? index : 0);
        setOpen(true);
    }, [disabled, results, value]);

    const closePanel = useCallback((refocus = true) => {
        setOpen(false);
        setQuery("");
        if (refocus) triggerRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            if (panelRef.current?.contains(target)) return;
            if (triggerRef.current?.contains(target)) return;
            closePanel(false);
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
        };
    }, [open, closePanel]);

    // Move focus into the search box once the panel exists.
    useEffect(() => {
        if (open) searchRef.current?.focus();
    }, [open]);

    // Keep the active option visible while arrowing through the list.
    useEffect(() => {
        if (!open) return;
        listRef.current
            ?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)
            ?.scrollIntoView({ block: "nearest" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, open, results.length]);

    const select = useCallback(
        (country: CountryCode) => {
            onChange(country);
            closePanel();
        },
        [onChange, closePanel]
    );

    const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
                break;
            case "ArrowUp":
                event.preventDefault();
                setActiveIndex((i) =>
                    results.length ? (i - 1 + results.length) % results.length : 0
                );
                break;
            case "Home":
                event.preventDefault();
                setActiveIndex(0);
                break;
            case "End":
                event.preventDefault();
                setActiveIndex(Math.max(0, results.length - 1));
                break;
            case "Enter": {
                event.preventDefault();
                const choice = results[activeIndex];
                if (choice) select(choice.iso2);
                break;
            }
            case "Escape":
                event.preventDefault();
                closePanel();
                break;
            case "Tab":
                closePanel(false);
                break;
        }
    };

    const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPanel();
        }
    };

    const triggerLabel = selected
        ? t("countrySelectorLabel", {
              country: nameOf(selected),
              code: `+${selected.callingCode}`,
          })
        : t("countrySelectorEmptyLabel");

    // ── Panel ───────────────────────────────────────────────────────────────
    const panel =
        open && position && mounted
            ? createPortal(
                  <div
                      ref={panelRef}
                      style={{
                          position: "fixed",
                          top: position.top,
                          left: position.left,
                          width: position.width,
                          maxHeight: position.maxHeight,
                      }}
                      className={cn(
                          "z-[100] flex flex-col overflow-hidden rounded-2xl",
                          "border border-[var(--border)] bg-[var(--surface)]",
                          "shadow-[var(--shadow-xl,0_20px_50px_rgba(0,0,0,0.25))]"
                      )}
                  >
                      {/* Search */}
                      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
                          <Search
                              className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                              aria-hidden="true"
                          />
                          <input
                              ref={searchRef}
                              type="text"
                              role="combobox"
                              value={query}
                              onChange={(e) => {
                                  setQuery(e.target.value);
                                  setActiveIndex(0);
                              }}
                              onKeyDown={onSearchKeyDown}
                              placeholder={t("searchCountryPlaceholder")}
                              aria-label={t("searchCountryLabel")}
                              aria-expanded="true"
                              aria-controls={listboxId}
                              aria-autocomplete="list"
                              aria-activedescendant={
                                  results.length ? optionId(activeIndex) : undefined
                              }
                              autoComplete="off"
                              className={cn(
                                  "w-full bg-transparent text-sm text-[var(--text-primary)] outline-none",
                                  "placeholder:text-[var(--text-muted)]"
                              )}
                          />
                      </div>

                      {/* Options */}
                      {results.length === 0 ? (
                          <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
                              {t("noCountryMatch")}
                          </p>
                      ) : (
                          <ul
                              ref={listRef}
                              id={listboxId}
                              role="listbox"
                              aria-label={t("countryListLabel")}
                              className="flex-1 overflow-y-auto overscroll-contain py-1"
                          >
                              {results.map((country, index) => {
                                  const isSelected = country.iso2 === value;
                                  const isActive = index === activeIndex;
                                  return (
                                      <li
                                          key={country.iso2}
                                          id={optionId(index)}
                                          role="option"
                                          aria-selected={isSelected}
                                          onMouseEnter={() => setActiveIndex(index)}
                                          onClick={() => select(country.iso2)}
                                          className={cn(
                                              "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm",
                                              "text-[var(--text-primary)] transition-colors duration-100",
                                              isActive && "bg-[var(--accent-light)]",
                                              isSelected && "font-medium"
                                          )}
                                      >
                                          <span
                                              className="w-6 shrink-0 text-base leading-none"
                                              aria-hidden="true"
                                          >
                                              {flagEmoji(country.iso2)}
                                          </span>
                                          <span className="flex-1 truncate">
                                              {nameOf(country)}
                                          </span>
                                          <span
                                              dir="ltr"
                                              className="shrink-0 tabular-nums text-[var(--text-muted)]"
                                          >
                                              +{country.callingCode}
                                          </span>
                                          {isSelected && (
                                              <Check
                                                  className="h-4 w-4 shrink-0 text-primary-600"
                                                  aria-hidden="true"
                                              />
                                          )}
                                      </li>
                                  );
                              })}
                          </ul>
                      )}
                  </div>,
                  document.body
              )
            : null;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => (open ? closePanel() : openPanel())}
                onKeyDown={onTriggerKeyDown}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-label={triggerLabel}
                aria-describedby={describedBy}
                className={cn(
                    "flex shrink-0 gap-1.5 px-3",
                    "text-sm text-[var(--text-primary)] transition-colors duration-150",
                    "hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-60",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500",
                    buttonClassName
                )}
            >
                <span className="text-base leading-none" aria-hidden="true">
                    {selected ? flagEmoji(selected.iso2) : "🌐"}
                </span>
                <span dir="ltr" className="tabular-nums" aria-hidden="true">
                    +{selected?.callingCode ?? "—"}
                </span>
                <ChevronDown
                    className={cn(
                        "h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-150",
                        open && "rotate-180"
                    )}
                    aria-hidden="true"
                />
            </button>
            {panel}
        </>
    );
}
