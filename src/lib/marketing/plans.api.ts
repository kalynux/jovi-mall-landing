/**
 * The plan catalog and credit catalog, read from the backend's public endpoints.
 *
 * This replaced a hand-copied mirror of `seed-pricing-plans.ts` and
 * `credit.config.ts`. Nothing here restates a price: if a number appears on
 * /pricing it came off the wire on the last revalidation.
 *
 * Fetched **server-side only** (RSC), so the numbers land in the prerendered
 * HTML where search engines read them, and no CORS is involved. Importing this
 * from a client component is a mistake the `server-only` guard will catch at
 * build time rather than at runtime in someone's browser.
 */
import "server-only";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { describeFetchError, fetchWithRetry } from "@/lib/build-fetch";
import { buildPlanFacts, type PlanFacts } from "./plan-facts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8022";

/**
 * Matches the endpoint's own `Cache-Control: public, max-age=300`.
 *
 * Consequence worth stating out loud: a price edited in the admin catalog is
 * invisible here for up to five minutes plus however long the CDN holds the
 * prerendered page. That is fine for a marketing page and must not be described
 * to anyone as instant.
 */
export const PLAN_REVALIDATE_SECONDS = 300;

export type PlanRole = "vendor" | "agency" | "agent";

/**
 * The public projection — not the raw plan document. `_id` is `id`, and the
 * mongo bookkeeping fields are gone. A field added to the plan model backend-side
 * does not appear here until someone deliberately publishes it, so this type can
 * be exhaustive rather than defensive.
 */
export type PublicPlan = {
  id: string;
  role: PlanRole;
  /** Stable identifier. Key copy and tests off this — never off `name`. */
  code: string;
  /** Admin-editable and unlocalized. Display only. */
  name: string;
  price: number;
  currency: string;
  term_days: number | null;
  credit_allowance: number;
  max_active_products: number | null;
  max_storage_bytes: number | null;
  commission_percent: number | null;
  max_unterminated_shipments: number | null;
  /**
   * Agent plans only: the cash-on-delivery money, in XAF, an agent on this tier
   * may carry once their identity is verified. ⚠ `null` means **no** COD, the
   * opposite of every other limit here. See `PLAN_LIMITS`.
   *
   * Optional because it was published on 2026-09-21, and an API older than that
   * omits the key entirely. Absent means "not told", never "none".
   */
  max_cod_pool?: number | null;
  live_tracking_enabled: boolean;
  is_active: boolean;
  sort_order: number;
};

export type CreditPack = {
  code: string;
  credits: number;
  price: number;
  currency: string;
};

export type CreditCatalog = {
  packs: CreditPack[];
  /** Credits charged per metered action. Env-overridable backend-side. */
  actionCosts: { vectorisation: number; whatsappTemplate: number };
};

/* ─── Which limits belong to which role ───────────────────────────────────── */

/**
 * **This table is the null-disambiguation.** The projection is flat — every plan
 * carries every limit field, with `null` in the ones its role does not use — so
 * `null` alone cannot tell you whether a limit is absent or unbounded:
 *
 *   agency_free.commission_percent === null          → agencies pay no commission
 *   agency_scale.max_unterminated_shipments === null → unlimited shipments
 *   business.max_active_products === null            → unlimited products
 *
 * Reading `null` as "unlimited" everywhere would print "unlimited commission" on
 * every agency card. So a role renders only the fields listed here, and within
 * that list `null` means unlimited. A field a role does not use is simply absent
 * from its list and never reaches the formatter.
 *
 * ⚠ **Except the COD pool, which fails closed.** An agent plan with
 * `max_cod_pool: null` carries no cash at all, because it is cash. So it has
 * its own `format`, and the card formats it without ever reaching the
 * "unlimited" branch.
 *
 * `key` resolves to `pages.plans.limits.<key>` for the label, except `codPool`,
 * whose line is a whole sentence (`pages.plans.codPool`).
 */
export type LimitSpec = {
  key: string;
  field: keyof PublicPlan;
  format: "count" | "bytes" | "percent" | "codPool";
};

export const PLAN_LIMITS: Record<PlanRole, LimitSpec[]> = {
  vendor: [
    { key: "products", field: "max_active_products", format: "count" },
    { key: "storage", field: "max_storage_bytes", format: "bytes" },
    { key: "commission", field: "commission_percent", format: "percent" },
    { key: "credits", field: "credit_allowance", format: "count" },
  ],
  agency: [
    { key: "openShipments", field: "max_unterminated_shipments", format: "count" },
    { key: "storage", field: "max_storage_bytes", format: "bytes" },
    { key: "credits", field: "credit_allowance", format: "count" },
  ],
  agent: [
    { key: "concurrentDeliveries", field: "max_unterminated_shipments", format: "count" },
    // Beside the delivery cap, as api-doc/public/FRONTEND-CHANGELOG-cod-pool.md asks.
    { key: "codPool", field: "max_cod_pool", format: "codPool" },
    { key: "storage", field: "max_storage_bytes", format: "bytes" },
    { key: "credits", field: "credit_allowance", format: "count" },
  ],
};

/**
 * The pool is XAF by contract, not in the plan's `currency`. That field prices
 * the plan; a plan priced in another currency would still cap cash in XAF.
 */
export const COD_POOL_CURRENCY = "XAF";

/**
 * Whether a card states a COD amount, and so whether the identity-verification
 * footnote has anything to qualify. Gated on the role's own list, so a stray
 * number on a vendor plan cannot put the footnote under the vendor cards.
 */
export function carriesCodPool(plan: PublicPlan): boolean {
  return (
    PLAN_LIMITS[plan.role].some((spec) => spec.format === "codPool") &&
    typeof plan.max_cod_pool === "number" &&
    plan.max_cod_pool > 0
  );
}

/* ─── Fetching ────────────────────────────────────────────────────────────── */

class PlanCatalogError extends Error {
  constructor(url: string, cause: string) {
    super(
      `Could not read the public plan catalog from ${url}: ${cause}. ` +
        `/pricing renders real prices and has no fallback copy — a build that ` +
        `cannot reach the catalog must fail rather than publish a page with no ` +
        `prices on it. Check NEXT_PUBLIC_API_URL and that the API is reachable.`
    );
    this.name = "PlanCatalogError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`;
  let res: Response;

  try {
    res = await fetchWithRetry(url, { next: { revalidate: PLAN_REVALIDATE_SECONDS } });
  } catch (error) {
    throw new PlanCatalogError(url, describeFetchError(error));
  }

  if (!res.ok) throw new PlanCatalogError(url, `HTTP ${res.status}`);

  const body = (await res.json()) as { success?: boolean; data?: T };
  if (body?.success !== true || body.data === undefined) {
    throw new PlanCatalogError(url, "response was not a { success, data } envelope");
  }

  return body.data;
}

/**
 * Active tiers by default. `includeInactive` also returns the tiers that are
 * priced in the catalog but not on sale — which is what lets /pricing show them
 * without keeping a second, drifting list of "coming soon" prices in the repo.
 */
export async function fetchPlans(options?: {
  role?: PlanRole;
  includeInactive?: boolean;
}): Promise<PublicPlan[]> {
  const params = new URLSearchParams();
  if (options?.role) params.set("role", options.role);
  if (options?.includeInactive) params.set("includeInactive", "true");
  const query = params.toString();

  const plans = await getJson<PublicPlan[]>(`/api/public/plans${query ? `?${query}` : ""}`);

  return [...plans].sort((a, b) => a.sort_order - b.sort_order);
}

/** Every role's tiers including the unsold ones, grouped and ordered for display. */
export async function fetchPlansByRole(): Promise<Record<PlanRole, PublicPlan[]>> {
  const [vendor, agency, agent] = await Promise.all([
    fetchPlans({ role: "vendor", includeInactive: true }),
    fetchPlans({ role: "agency", includeInactive: true }),
    fetchPlans({ role: "agent", includeInactive: true }),
  ]);

  return { vendor, agency, agent };
}

export async function fetchCreditCatalog(): Promise<CreditCatalog> {
  return getJson<CreditCatalog>("/api/public/credit-packs");
}

/**
 * Every catalogue figure the marketing sentences quote, as ready-to-print
 * phrases in `locale` ("75 products", "5,000 FCFA per 30 days").
 *
 * Pass the result as the values of any `t()` whose message carries one of its
 * placeholders. Those sentences hold no numbers of their own, so an admin edit
 * reaches them on the same five-minute revalidation as the cards. See
 * plan-facts.ts for what each placeholder means and what can still fail.
 *
 * `cache` so a page and its `generateMetadata` share one build per request.
 */
export const getPlanFacts = cache(async (locale: Locale): Promise<PlanFacts> => {
  const [plansByRole, credits, phrase] = await Promise.all([
    fetchPlansByRole(),
    fetchCreditCatalog(),
    getTranslations({ locale, namespace: "pages.facts" }),
  ]);

  const quoted = new Set(["vectorisation", "whatsappTemplate"]);
  for (const action of Object.keys(credits.actionCosts)) {
    // The credits prose names two metered actions. A third is not a wrong
    // number, so it must not stop the page; it is a sentence to write.
    if (!quoted.has(action)) console.warn(`[plan-facts] "${action}" is metered but no sentence describes it`);
  }

  return buildPlanFacts({
    plans: Object.values(plansByRole).flat(),
    credits,
    locale,
    phrase: (key, values) => phrase(key, values),
  });
});

/* ─── Small helpers the pages need ────────────────────────────────────────── */

/** The tier a role's card grid should visually lead with. */
export function highlightCodeFor(plans: PublicPlan[]): string | undefined {
  const buyable = plans.filter((plan) => plan.is_active);
  // The cheapest paid tier if one is on sale — that is the upgrade the page is
  // arguing for. Otherwise the free tier, which is then the only thing to take.
  const cheapestPaid = buyable.filter((plan) => plan.price > 0)[0];
  return (cheapestPaid ?? buyable[0])?.code;
}
