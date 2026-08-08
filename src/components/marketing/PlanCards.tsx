import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { bytesToGb, PLAN_LIMITS, type PublicPlan, type PlanRole } from "@/lib/marketing/plans.api";

/**
 * One role's tier cards, rendered straight from the public catalog.
 *
 * Two rules carry the weight here.
 *
 * Which limits appear, and what `null` means in them, both come from
 * `PLAN_LIMITS` — see its comment. The projection is flat, so a role that does
 * not use a field still carries it as `null`, and reading that as "unlimited"
 * would print "unlimited commission" on every agency card.
 *
 * A tier with `is_active: false` renders without a buy link and with a neutral
 * "not available yet" badge. The flag means both "not launched" and "withdrawn
 * from sale" and the catalog does not distinguish them, so the copy says the one
 * thing that is true either way: you cannot buy it here.
 */

export type PlanCopy = {
  /** Localized label per limit key, e.g. `products` → "active products". */
  limitLabels: Record<string, string>;
  free: string;
  /**
   * A function rather than a string: `term_days` is per-plan, and languages
   * whose plural rules depend on the count (Arabic has six categories) need the
   * real ICU message, not a token swapped into a fixed sentence.
   */
  perTerm: (days: number) => string;
  unavailable: string;
  cta: string;
  unlimited: string;
};

function formatLimit(
  plan: PublicPlan,
  spec: (typeof PLAN_LIMITS)[PlanRole][number],
  copy: PlanCopy,
  formatNumber: (value: number) => string
): string {
  const label = copy.limitLabels[spec.key] ?? spec.key;
  const raw = plan[spec.field];
  const value = typeof raw === "number" ? raw : null;

  // Safe here, and only here: this field is on its own role's list, so an absent
  // value can only mean unbounded.
  if (value === null) return `${copy.unlimited} ${label}`;

  switch (spec.format) {
    case "bytes":
      return `${bytesToGb(value)} GB ${label}`;
    case "percent":
      return `${value}% ${label}`;
    default:
      return `${formatNumber(value)} ${label}`;
  }
}

export function PlanCard({
  plan,
  copy,
  formatNumber,
  formatPrice,
  registerHref,
  highlight = false,
}: {
  plan: PublicPlan;
  copy: PlanCopy;
  formatNumber: (value: number) => string;
  formatPrice: (value: number, currency: string) => string;
  registerHref: string;
  highlight?: boolean;
}) {
  const isFree = plan.price === 0;
  const limits = PLAN_LIMITS[plan.role];

  return (
    <div
      className={cn(
        "card flex flex-col p-6",
        highlight && "ring-role border-role-soft",
        !plan.is_active && "opacity-90"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">{plan.name}</h3>
        {!plan.is_active && (
          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {copy.unavailable}
          </span>
        )}
      </div>

      <p className="mt-4 font-display text-3xl font-bold text-[var(--text-primary)]">
        {isFree ? (
          copy.free
        ) : (
          <>
            {formatPrice(plan.price, plan.currency)}
            {plan.term_days !== null && (
              <span className="ms-1 align-middle text-sm font-medium text-[var(--text-muted)]">
                {copy.perTerm(plan.term_days)}
              </span>
            )}
          </>
        )}
      </p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {limits.map((spec) => (
          <li
            key={spec.key}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--text-secondary)]"
          >
            <span
              aria-hidden="true"
              className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-role"
            />
            {formatLimit(plan, spec, copy, formatNumber)}
          </li>
        ))}
      </ul>

      {plan.is_active && (
        <Link
          href={registerHref}
          className={cn(
            "mt-7 inline-flex items-center justify-center rounded-xl px-5 py-2.5 font-display text-sm font-semibold transition-all",
            highlight
              ? "bg-gradient-to-r from-primary-700 to-primary-500 text-white shadow-[0_0_20px_rgba(13,160,107,0.35)] hover:shadow-[0_0_30px_rgba(13,160,107,0.55)]"
              : "border border-[var(--border)] bg-[var(--surface-glass)] text-[var(--text-primary)] hover:border-primary-400 hover:bg-[var(--accent-light)]"
          )}
          aria-label={`${copy.cta} — ${plan.name}`}
          data-plan-role={plan.role}
          data-plan-code={plan.code}
        >
          {copy.cta}
        </Link>
      )}
    </div>
  );
}

export function PlanGrid({
  plans,
  copy,
  formatNumber,
  formatPrice,
  registerHref,
  highlightCode,
}: {
  plans: PublicPlan[];
  copy: PlanCopy;
  formatNumber: (value: number) => string;
  formatPrice: (value: number, currency: string) => string;
  registerHref: string;
  highlightCode?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-5",
        plans.length === 1 && "max-w-sm",
        plans.length === 2 && "sm:grid-cols-2",
        plans.length >= 3 && "lg:grid-cols-3"
      )}
    >
      {plans.map((plan) => (
        <PlanCard
          key={plan.code}
          plan={plan}
          copy={copy}
          formatNumber={formatNumber}
          formatPrice={formatPrice}
          registerHref={registerHref}
          highlight={plan.code === highlightCode}
        />
      ))}
    </div>
  );
}
