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
import { describeFetchError, fetchWithRetry } from "@/lib/build-fetch";

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
 * that list `null` always means unlimited. A field a role does not use is simply
 * absent from its list and never reaches the formatter.
 *
 * `key` resolves to `pages.plans.limits.<key>` for the label.
 */
export type LimitSpec = {
  key: string;
  field: keyof PublicPlan;
  format: "count" | "bytes" | "percent";
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
    { key: "storage", field: "max_storage_bytes", format: "bytes" },
    { key: "credits", field: "credit_allowance", format: "count" },
  ],
};

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

/* ─── Small helpers the pages need ────────────────────────────────────────── */

const GB = 1024 * 1024 * 1024;

export function bytesToGb(bytes: number): number {
  return Math.round(bytes / GB);
}

/** The tier a role's card grid should visually lead with. */
export function highlightCodeFor(plans: PublicPlan[]): string | undefined {
  const buyable = plans.filter((plan) => plan.is_active);
  // The cheapest paid tier if one is on sale — that is the upgrade the page is
  // arguing for. Otherwise the free tier, which is then the only thing to take.
  const cheapestPaid = buyable.filter((plan) => plan.price > 0)[0];
  return (cheapestPaid ?? buyable[0])?.code;
}
