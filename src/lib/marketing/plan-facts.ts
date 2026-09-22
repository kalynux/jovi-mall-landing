/**
 * The catalogue figures marketing sentences quote, turned into phrases.
 *
 * This replaced `copy-claims.ts`. The prose used to hold its numbers itself
 * ("Starter lets you publish 15 products…") and a build-time assertion refused
 * to render /pricing when the catalogue disagreed. That kept the page honest by
 * freezing it: on 2026-09-22 an admin raised Starter to 75 products, the API
 * served 75 within minutes, and /pricing kept printing 15, because every
 * regeneration threw and Next went on serving the last page that had rendered.
 * The other pages quoting the same numbers were never checked at all.
 *
 * Now the sentences carry placeholders and these phrases fill them, so an admin
 * edit reaches every sentence on the same revalidation as the cards.
 *
 * ── Why phrases, not bare numbers ────────────────────────────────────────────
 *
 * `{starterProducts}` is "75 products", not "75". The noun has to agree with
 * the count, and Arabic has six plural categories (1, 2, 3–10, 11–99, 100+
 * and 0), so the noun is written once per language in `pages.facts.*` with its
 * plural forms and the sentence only positions the result. A bare number would
 * put that agreement in fifteen sentences × five languages.
 *
 * The same goes for "unlimited": an unbounded limit arrives as `null`, and the
 * phrase says "unlimited products" rather than the sentence needing a branch.
 *
 * ── What can still fail ──────────────────────────────────────────────────────
 *
 * A plan the prose names being **deleted** (or its code renamed): there is no
 * number to put in "Growth is … per 30 days" when Growth is gone, so that throws
 * `PlanFactsError`. It fails the build loudly and, at runtime, keeps the last
 * good page, as before. Changing any figure never does.
 *
 * **Adding a number to marketing copy means adding a fact here** and using its
 * placeholder, never typing the digits. `plan-facts.test.ts` fails on a digit
 * in any of the converted sentences.
 */
import type { Locale } from "@/i18n/routing";
import type { CreditCatalog, PublicPlan } from "./plans.api";
import { bytesToGb, formatNumber, formatPrice } from "./format";

/**
 * The plans the prose names by role. The free-tier codes are fixed backend-side
 * (`freePlanCode(role)`); `growth` and `business` are the paid vendor tiers.
 */
const CODES = {
  starter: "starter",
  growth: "growth",
  business: "business",
  agencyFree: "agency_free",
  agentFree: "agent_free",
} as const;

/**
 * The month of paid orders in the pricing lead's worked example. An
 * illustration rather than a catalogue figure, so it lives beside the
 * arithmetic that uses it instead of in the copy.
 */
export const EXAMPLE_MONTHLY_SALES = 400_000;

/** A `pages.facts.*` message, e.g. next-intl's `t` for that namespace. */
export type FactPhrase = (key: string, values?: Record<string, string | number>) => string;

/** Placeholder name → the text that replaces it. */
export type PlanFacts = Record<string, string>;

export class PlanFactsError extends Error {
  constructor(problem: string) {
    super(
      `${problem}. The marketing sentences that describe it have nothing to say ` +
        `until they are rewritten. See src/lib/marketing/plan-facts.ts.`
    );
    this.name = "PlanFactsError";
  }
}

export function buildPlanFacts({
  plans,
  credits,
  locale,
  phrase,
}: {
  plans: PublicPlan[];
  credits: CreditCatalog;
  locale: Locale;
  phrase: FactPhrase;
}): PlanFacts {
  const plan = (code: string): PublicPlan => {
    const found = plans.find((candidate) => candidate.code === code);
    if (!found) throw new PlanFactsError(`Plan "${code}" is no longer in the catalogue`);
    return found;
  };

  const starter = plan(CODES.starter);
  const growth = plan(CODES.growth);
  const business = plan(CODES.business);
  const agencyFree = plan(CODES.agencyFree);
  const agentFree = plan(CODES.agentFree);

  const num = (value: number) => formatNumber(locale, value);
  const money = (value: number, currency: string) => formatPrice(locale, value, currency);

  /** A count and its noun, or the "unlimited" phrase when the limit is unbounded. */
  const counted = (key: string, value: number | null, unlimitedKey: string) =>
    value === null ? phrase(unlimitedKey) : phrase(key, { count: value, n: num(value) });

  const media = (bytes: number | null) =>
    bytes === null ? phrase("mediaUnlimited") : phrase("media", { n: num(bytesToGb(bytes)) });

  // The backend charges a `null` commission as 0 (entitlement.service.ts), so
  // that is what the sentence says too.
  const percent = (value: number | null) => phrase("percent", { n: num(value ?? 0) });

  const credited = (value: number) => phrase("credits", { count: value, n: num(value) });
  const days = (value: number) => phrase("days", { count: value, n: num(value) });
  const per = (p: PublicPlan) =>
    p.term_days === null ? phrase("noTerm") : phrase("perTerm", { days: days(p.term_days) });

  // "Vendor plans from …" is the cheapest paid tier on sale, falling back to the
  // cheapest paid tier at all, then to Growth, which the prose names anyway.
  const vendorPlans = plans.filter((p) => p.role === "vendor");
  const paidVendor = vendorPlans.filter((p) => p.price > 0);
  const paidOnSale = paidVendor.filter((p) => p.is_active);
  const from = [...(paidOnSale.length ? paidOnSale : paidVendor)].sort((a, b) => a.price - b.price)[0] ?? growth;

  const onSaleVendor = vendorPlans.filter((p) => p.is_active);
  const commissions = (onSaleVendor.length ? onSaleVendor : vendorPlans).map((p) => p.commission_percent ?? 0);
  const commissionMin = Math.min(...commissions);
  const commissionMax = Math.max(...commissions);

  // The worked example only makes an argument while Growth charges less
  // commission than Starter. If an edit ever flips that, the sentence switches
  // to its neutral branch rather than claiming a saving of nothing.
  const saving = Math.round(
    (EXAMPLE_MONTHLY_SALES * ((starter.commission_percent ?? 0) - (growth.commission_percent ?? 0))) / 100
  );

  // One term for every paid plan on sale, or a phrase that sends the reader to
  // the cards when the tiers disagree.
  const paid = plans.filter((p) => p.price > 0);
  const paidPool = paid.some((p) => p.is_active) ? paid.filter((p) => p.is_active) : paid;
  const terms = new Set(paidPool.map((p) => p.term_days));
  const [onlyTerm] = [...terms];
  const paidTerm = terms.size === 1 && typeof onlyTerm === "number" ? days(onlyTerm) : phrase("termVaries");

  const packs = [...credits.packs].sort((a, b) => a.credits - b.credits);
  const cheapestPack = [...credits.packs].sort((a, b) => a.price - b.price)[0];
  if (!cheapestPack) throw new PlanFactsError("The catalogue has no credit packs");
  // "The larger the pack, the less each credit costs": only while that holds.
  const packDiscount =
    packs.length > 1 &&
    packs.every((pack, i) => i === 0 || pack.price / pack.credits < packs[i - 1].price / packs[i - 1].credits);

  const { vectorisation, whatsappTemplate } = credits.actionCosts;
  if (typeof vectorisation !== "number" || typeof whatsappTemplate !== "number") {
    throw new PlanFactsError("The catalogue no longer prices both metered actions");
  }

  return {
    starterName: starter.name,
    growthName: growth.name,
    businessName: business.name,

    starterProducts: counted("products", starter.max_active_products, "productsUnlimited"),
    growthProducts: counted("products", growth.max_active_products, "productsUnlimited"),
    businessProducts: counted("products", business.max_active_products, "productsUnlimited"),

    starterMedia: media(starter.max_storage_bytes),
    growthMedia: media(growth.max_storage_bytes),
    businessMedia: media(business.max_storage_bytes),
    agencyMedia: media(agencyFree.max_storage_bytes),

    starterCommission: percent(starter.commission_percent),
    growthCommission: percent(growth.commission_percent),
    businessCommission: percent(business.commission_percent),
    vendorCommissionMin: percent(commissionMin),
    vendorCommissionMax: percent(commissionMax),
    vendorCommissionSpread: commissionMin === commissionMax ? "same" : "range",

    growthPrice: money(growth.price, growth.currency),
    growthPer: per(growth),
    businessPrice: money(business.price, business.currency),
    businessPer: per(business),
    vendorFromPrice: money(from.price, from.currency),
    vendorFromPer: per(from),

    exampleSales: money(EXAMPLE_MONTHLY_SALES, growth.currency),
    growthSaving: money(Math.max(saving, 0), growth.currency),
    growthSaves: saving > 0 ? "yes" : "no",

    starterCredits: credited(starter.credit_allowance),
    businessCredits: credited(business.credit_allowance),
    vectorisationCost: credited(vectorisation),
    whatsappTemplateCost: credited(whatsappTemplate),
    cheapestPackPrice: money(cheapestPack.price, cheapestPack.currency),
    cheapestPackCredits: credited(cheapestPack.credits),
    packDiscount: packDiscount ? "yes" : "no",

    agencyShipments: counted("openShipments", agencyFree.max_unterminated_shipments, "openShipmentsUnlimited"),
    agentDeliveries: counted("deliveries", agentFree.max_unterminated_shipments, "deliveriesUnlimited"),

    paidTerm,
  };
}
