"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Megaphone, Store } from "lucide-react";
import type { VendorKind } from "@/lib/marketing/plans.api";
import { cn } from "@/lib/utils";

/**
 * "Sell products" | "Advertise a service" over the vendor plans on /pricing.
 *
 * The API returns seller and provider plans in one vendor list
 * (api-doc/FRONTEND-CHANGELOG-service-listings.md, O-19). They are different
 * businesses on different terms: a seller pays commission per order, while a
 * provider takes no orders and pays credits per unlocked contact. So they never
 * share a grid. The page renders this only when provider plans are on sale, so
 * until they are, sellers see exactly the page they saw before.
 *
 * **Both panels are in the HTML**, the inactive one `hidden`. The prices are
 * server-rendered for search engines, and a tab that fetched its content would
 * hide one kind's prices from them.
 *
 * `#service-businesses` in the URL opens on the provider tab, so a link from
 * anywhere else lands on the right prices.
 */
export const PROVIDER_PLANS_HASH = "service-businesses";

const KINDS: VendorKind[] = ["seller", "provider"];

export default function VendorKindTabs({
  labels,
  hints,
  groupLabel,
  panels,
}: {
  labels: Record<VendorKind, string>;
  /** One short line under each label, e.g. "Commission per order". */
  hints: Record<VendorKind, string>;
  groupLabel: string;
  panels: Record<VendorKind, ReactNode>;
}) {
  const [kind, setKind] = useState<VendorKind>("seller");
  const baseId = useId();
  const refs = useRef<Partial<Record<VendorKind, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === `#${PROVIDER_PLANS_HASH}`) setKind("provider");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const select = (next: VendorKind, focus = false) => {
    setKind(next);
    if (focus) refs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={groupLabel}
        className="mb-6 grid w-full grid-cols-2 gap-1 rounded-2xl bg-[var(--bg-subtle)] p-1 sm:max-w-xl"
        onKeyDown={(e) => {
          // Two tabs, so every arrow means "the other one", in either direction.
          if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) {
            e.preventDefault();
            select(kind === "seller" ? "provider" : "seller", true);
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            select(e.key === "Home" ? "seller" : "provider", true);
          }
        }}
      >
        {KINDS.map((option) => {
          const selected = option === kind;
          const Icon = option === "seller" ? Store : Megaphone;
          return (
            <button
              key={option}
              ref={(node) => {
                refs.current[option] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${option}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${option}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(option)}
              className={cn(
                // 56px: a thumb-reached control on a phone.
                "flex min-h-14 min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-start",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                selected
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg min-[380px]:flex",
                  selected ? "bg-role-soft text-role" : "bg-[var(--surface)]/60"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{labels[option]}</span>
                {/* Phones get the label only: two hints side by side wrap to
                    three lines each at 390px. The panel below explains. */}
                <span className="mt-0.5 hidden text-xs leading-snug text-[var(--text-muted)] sm:block">
                  {hints[option]}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {KINDS.map((option) => (
        <div
          key={option}
          role="tabpanel"
          id={`${baseId}-panel-${option}`}
          aria-labelledby={`${baseId}-tab-${option}`}
          hidden={option !== kind}
        >
          {panels[option]}
        </div>
      ))}
    </div>
  );
}
