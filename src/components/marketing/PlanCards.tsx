import RoleCtaButton from "@/components/ui/RoleCtaButton";
import { cn } from "@/lib/utils";
import { bytesToGb } from "@/lib/marketing/format";
import {
  carriesCodPool,
  COD_POOL_CURRENCY,
  PLAN_LIMITS,
  type LimitSpec,
  type PublicPlan,
} from "@/lib/marketing/plans.api";

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
  /** The agent COD-pool line. A sentence around the amount, not a label after it. */
  codPool: (amount: string) => string;
  noCodPool: string;
};

/**
 * One limit line, or `null` when there is nothing true to say.
 *
 * Exported for the pricing page's structured data, which must describe a plan
 * exactly as its card does. A second formatter there is how a `null` COD pool
 * would come out as "unlimited".
 */
export function formatLimit(
  plan: PublicPlan,
  spec: LimitSpec,
  copy: PlanCopy,
  formatNumber: (value: number) => string,
  formatPrice: (value: number, currency: string) => string
): string | null {
  const raw = plan[spec.field];

  // Before the generic null check, never after it: this is the one limit where
  // `null` means none rather than unbounded.
  if (spec.format === "codPool") return formatCodPool(raw, copy, formatPrice);

  const label = copy.limitLabels[spec.key] ?? spec.key;
  const value = typeof raw === "number" ? raw : null;

  // Safe here, and only here: this field is on its own role's list, so an absent
  // value can only mean unbounded.
  if (value === null) return `${copy.unlimited} ${label}`;

  switch (spec.format) {
    case "bytes":
      return `${formatNumber(bytesToGb(value))} GB ${label}`;
    case "percent":
      return `${value}% ${label}`;
    default:
      return `${formatNumber(value)} ${label}`;
  }
}

/**
 * Deliberately not `formatLimit`'s null handling — api-doc/public/FRONTEND-
 * CHANGELOG-cod-pool.md says not to share one. `null` is no cash on delivery,
 * and so is `0`: the backend reads an unset pool as a zero ceiling.
 */
function formatCodPool(
  raw: PublicPlan[keyof PublicPlan] | undefined,
  copy: PlanCopy,
  formatPrice: (value: number, currency: string) => string
): string | null {
  // An API from before 2026-09-21 does not send the key. Saying nothing is
  // true there; "no cash on delivery" would not be.
  if (raw === undefined) return null;
  if (typeof raw !== "number" || raw <= 0) return copy.noCodPool;
  return copy.codPool(formatPrice(raw, COD_POOL_CURRENCY));
}

export function PlanCard({
  plan,
  copy,
  formatNumber,
  formatPrice,
  highlight = false,
}: {
  plan: PublicPlan;
  copy: PlanCopy;
  formatNumber: (value: number) => string;
  formatPrice: (value: number, currency: string) => string;
  highlight?: boolean;
}) {
  const isFree = plan.price === 0;
  const limits = PLAN_LIMITS[plan.role].flatMap((spec) => {
    const text = formatLimit(plan, spec, copy, formatNumber, formatPrice);
    return text === null ? [] : [{ spec, text }];
  });
  // The footnote under the agent grid ("once your identity is verified")
  // qualifies the amount, so only a stated amount carries its marker.
  const codPoolMarked = carriesCodPool(plan);

  return (
    <div
      className={cn(
        "card relative flex flex-col p-6 transition-all duration-300",
        highlight
          ? "border-2 border-role-soft shadow-lg lg:scale-[1.03]"
          : "hover:-translate-y-1 hover:border-role-soft hover:shadow-md",
        // A tier the catalog will not sell reads as struck out before the badge
        // is: desaturated, with a hatched overlay. See .plan-unavailable in
        // globals.css — it also explains why the filter there is safe only
        // while these cards carry no CTA.
        !plan.is_active && "plan-unavailable"
      )}
      aria-disabled={!plan.is_active || undefined}
    >
      {highlight && (
        // The one tier that gets to shout: a brand-gradient crown strip over the
        // top edge, so the recommended plan is the peak of the row.
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400"
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">{plan.name}</h3>
        {!plan.is_active && <span className="tag tag-muted shrink-0">{copy.unavailable}</span>}
      </div>

      <p
        className={cn(
          "mt-4 font-display font-bold text-[var(--text-primary)]",
          highlight ? "text-4xl" : "text-3xl"
        )}
      >
        {isFree ? (
          <span
            className={cn(
              highlight && "bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent"
            )}
          >
            {copy.free}
          </span>
        ) : (
          <>
            <span
              className={cn(
                highlight && "bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-transparent"
              )}
            >
              {formatPrice(plan.price, plan.currency)}
            </span>
            {plan.term_days !== null && (
              <span className="ms-1 align-middle text-sm font-medium text-[var(--text-muted)]">
                {copy.perTerm(plan.term_days)}
              </span>
            )}
          </>
        )}
      </p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {limits.map(({ spec, text }) => (
          <li
            key={spec.key}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--text-secondary)]"
          >
            <span
              aria-hidden="true"
              className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-role"
            />
            <span>
              {text}
              {spec.format === "codPool" && codPoolMarked && <span aria-hidden="true">*</span>}
            </span>
          </li>
        ))}
      </ul>

      {plan.is_active && (
        // `plan.role` is already the role this card sells, so the button can
        // resolve itself: a signed-in vendor reading the vendor plans gets
        // their dashboard rather than a second registration.
        <RoleCtaButton
          role={plan.role}
          fallbackLabel={copy.cta}
          variant={highlight ? "primary" : "secondary"}
          size="sm"
          className="mt-7"
          dataAttrs={{ "data-plan-role": plan.role, "data-plan-code": plan.code }}
        />
      )}
    </div>
  );
}

export function PlanGrid({
  plans,
  copy,
  formatNumber,
  formatPrice,
  highlightCode,
}: {
  plans: PublicPlan[];
  copy: PlanCopy;
  formatNumber: (value: number) => string;
  formatPrice: (value: number, currency: string) => string;
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
          highlight={plan.code === highlightCode}
        />
      ))}
    </div>
  );
}
