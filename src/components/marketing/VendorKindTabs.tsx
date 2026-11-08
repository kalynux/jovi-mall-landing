"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Megaphone, Store } from "lucide-react";
import type { VendorKind } from "@/lib/marketing/plans.api";
import { cn } from "@/lib/utils";

/**
 * "Sell products" | "Advertise a service", the first thing in the vendor
 * plans on /pricing.
 *
 * The API returns seller and provider plans in one vendor list
 * (api-doc/FRONTEND-CHANGELOG-service-listings.md, O-19). They are different
 * businesses on different terms: a seller takes orders and pays commission, a
 * provider takes no orders and pays credits per unlocked contact. So they never
 * share a grid. The page renders this only when provider plans are on sale, so
 * until they are, sellers see exactly the page they saw before.
 *
 * ── Why it is two big cards, not a pill switch ───────────────────────────────
 *
 * The first version was a grey segmented control under a paragraph about
 * commission. The section's own band is that same grey, so it all but vanished:
 * the owner looked at the page and did not see that a choice existed. A vendor
 * who only sells a service must notice, before reading any price, that there is
 * a way for them. So: a visible question, then two white cards that each say
 * what the choice means, the selected one carrying the vendor colour and a
 * check, and a "New" tag on the service option while it is new.
 *
 * **Both panels are in the HTML**, the inactive one `hidden`. The prices are
 * server-rendered for search engines, and a tab that fetched its content would
 * hide one kind's prices from them.
 *
 * `#service-businesses` in the URL opens on the provider tab, so a link from
 * anywhere else lands on the right prices.
 */
export const PROVIDER_PLANS_HASH = "service-businesses";

const KINDS: { kind: VendorKind; Icon: typeof Store }[] = [
  { kind: "seller", Icon: Store },
  { kind: "provider", Icon: Megaphone },
];

export default function VendorKindTabs({
  question,
  labels,
  hints,
  newLabel,
  panels,
}: {
  /** "What do you want to do on Wi-Mall?" — visible, and the tablist's name. */
  question: string;
  labels: Record<VendorKind, string>;
  /** One line under each label saying what the choice means. */
  hints: Record<VendorKind, string>;
  /** The "New" tag on the provider card. */
  newLabel: string;
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
      <p id={`${baseId}-question`} className="mb-3 font-display text-lg font-bold text-[var(--text-primary)]">
        {question}
      </p>

      <div
        role="tablist"
        aria-labelledby={`${baseId}-question`}
        className="role-vendor mb-10 grid max-w-3xl grid-cols-2 gap-3 sm:gap-4"
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
        {KINDS.map(({ kind: option, Icon }) => {
          const selected = option === kind;
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
                "relative flex min-w-0 flex-col items-start gap-3 rounded-2xl border-2 p-4 text-start sm:flex-row sm:items-center sm:gap-4 sm:p-5",
                "bg-[var(--surface)] transition-[border-color,box-shadow,transform] duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                selected
                  ? "border-role shadow-lg"
                  : "border-[var(--border)] shadow-sm hover:-translate-y-0.5 hover:border-role-soft hover:shadow-md motion-reduce:transform-none"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-colors sm:h-12 sm:w-12",
                  selected ? "bg-role text-white" : "bg-role-soft text-role"
                )}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-display text-[15px] font-bold leading-tight text-[var(--text-primary)] sm:text-lg">
                    {labels[option]}
                  </span>
                  {option === "provider" && <span className="tag">{newLabel}</span>}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-[var(--text-muted)] sm:text-sm">
                  {hints[option]}
                </span>
              </span>

              {/* The radio-style mark: filled with a check when chosen, an
                  empty ring otherwise, so "these are two options" reads at a
                  glance even before either is tapped. */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute end-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors sm:static sm:flex-shrink-0",
                  selected ? "border-role bg-role text-white" : "border-[var(--border-strong)] bg-[var(--surface)]"
                )}
              >
                {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      {KINDS.map(({ kind: option }) => (
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
