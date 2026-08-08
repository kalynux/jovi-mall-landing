import type { CreditCatalog, PublicPlan } from "./plans.api";

/**
 * Prose that quotes a catalog number, checked against the catalog at build time.
 *
 * Deleting `plans.ts` fixed the pricing *cards*, but it did not fix the sentences.
 * "Growth is 5,000 FCFA per 30 days: 150 products, 10 GB, and the commission
 * drops to 5%" is hand-written copy in five languages, and it goes stale exactly
 * as silently as the old mirror did — worse, because nobody thinks of message
 * catalogs as containing data.
 *
 * Interpolating every one of those numbers would work and would read badly:
 * "Twenty on the free tier" becomes "{n} on the free tier", and the Arabic and
 * French sentences have to be restructured around tokens they do not want. So
 * the prose stays prose, and this asserts it instead. If a price moves in the
 * admin catalog, the next build fails naming the message keys to rewrite rather
 * than quietly publishing a page that lies about the price.
 *
 * **Adding a number to the copy means adding a claim here.** That is the whole
 * contract; there is no way to derive it from the strings.
 */

type Claim = {
  /** Message keys whose text asserts this. Printed verbatim when it breaks. */
  keys: string[];
  /** Plan `code` — never `name`, which is admin-editable and unlocalized. */
  code: string;
  field: keyof PublicPlan;
  expected: number | null;
};

const PLAN_CLAIMS: Claim[] = [
  // Vendor tiers — quoted on /pricing, /vendors, /faq and every city page.
  { keys: ["pages.vendors.cost.p1", "pages.faq.q.vendorCost.a", "pages.city.sellingP2", "pages.vendors.cta.finePrint"], code: "starter", field: "max_active_products", expected: 15 },
  { keys: ["pages.vendors.cost.p1", "pages.faq.q.vendorCost.a", "pages.city.sellingP2", "pages.vendors.cta.finePrint"], code: "starter", field: "commission_percent", expected: 7 },
  { keys: ["pages.vendors.cost.p1", "pages.vendors.cta.finePrint", "pages.faq.q.vendorCost.a"], code: "starter", field: "max_storage_bytes", expected: 1073741824 },
  { keys: ["pages.pricing.credits.p2"], code: "starter", field: "credit_allowance", expected: 50 },

  { keys: ["pages.vendors.cost.p2", "pages.faq.q.vendorCost.a", "pages.pricing.vendor.lead"], code: "growth", field: "price", expected: 5000 },
  { keys: ["pages.vendors.cost.p2", "pages.faq.q.vendorCost.a"], code: "growth", field: "max_active_products", expected: 150 },
  { keys: ["pages.vendors.cost.p2", "pages.faq.q.vendorCost.a", "pages.pricing.howWeEarn.commission.body"], code: "growth", field: "commission_percent", expected: 5 },
  { keys: ["pages.vendors.cost.p2"], code: "growth", field: "max_storage_bytes", expected: 10737418240 },

  { keys: ["pages.vendors.cost.p2", "pages.faq.q.vendorCost.a"], code: "business", field: "price", expected: 25000 },
  // null = unlimited here; the copy says "unlimited products".
  { keys: ["pages.vendors.cost.p2", "pages.faq.q.vendorCost.a"], code: "business", field: "max_active_products", expected: null },
  { keys: ["pages.vendors.cost.p2", "pages.faq.q.vendorCost.a", "pages.pricing.howWeEarn.commission.body"], code: "business", field: "commission_percent", expected: 3 },
  { keys: ["pages.vendors.cost.p2"], code: "business", field: "max_storage_bytes", expected: 107374182400 },
  { keys: ["pages.pricing.credits.p2"], code: "business", field: "credit_allowance", expected: 4500 },

  // Agency free tier — the "thousand open deliveries" line appears in four places.
  { keys: ["pages.agencies.capacity.p1", "pages.agencies.cta.finePrint", "pages.city.opportunityBody"], code: "agency_free", field: "max_unterminated_shipments", expected: 1000 },
  { keys: ["pages.agencies.cta.finePrint"], code: "agency_free", field: "max_storage_bytes", expected: 5368709120 },

  // Agent free tier — "twenty at a time".
  { keys: ["pages.agents.capacity.p1", "pages.agents.cta.finePrint", "pages.faq.q.agentCapacity.a"], code: "agent_free", field: "max_unterminated_shipments", expected: 20 },
];

/** The one credit-pack figure the prose quotes, plus the per-action costs. */
const CHEAPEST_PACK_CLAIM = { keys: ["pages.faq.q.credits.a"], credits: 100, price: 600 };
const ACTION_COST_CLAIM = { keys: ["pages.pricing.credits.p1", "pages.faq.q.credits.a"], cost: 1 };

function describe(value: number | null): string {
  return value === null ? "null (unlimited)" : String(value);
}

/**
 * Throws listing every mismatch at once, so one build tells you everything to
 * rewrite instead of one failure per run.
 */
export function assertCopyMatchesCatalog(plans: PublicPlan[], credits: CreditCatalog): void {
  const byCode = new Map(plans.map((plan) => [plan.code, plan]));
  const problems: string[] = [];

  for (const claim of PLAN_CLAIMS) {
    const plan = byCode.get(claim.code);
    if (!plan) {
      problems.push(
        `plan "${claim.code}" is no longer in the catalog, but ${claim.keys.join(", ")} still describe it`
      );
      continue;
    }

    const actual = plan[claim.field];
    const normalised = typeof actual === "number" || actual === null ? actual : undefined;
    if (normalised !== claim.expected) {
      problems.push(
        `${claim.code}.${String(claim.field)} is ${describe(normalised ?? null)}, ` +
          `copy says ${describe(claim.expected)} — update ${claim.keys.join(", ")} in all five locales`
      );
    }
  }

  const cheapest = [...credits.packs].sort((a, b) => a.price - b.price)[0];
  if (
    !cheapest ||
    cheapest.credits !== CHEAPEST_PACK_CLAIM.credits ||
    cheapest.price !== CHEAPEST_PACK_CLAIM.price
  ) {
    problems.push(
      `cheapest credit pack is ${cheapest ? `${cheapest.credits} for ${cheapest.price}` : "missing"}, ` +
        `copy says ${CHEAPEST_PACK_CLAIM.credits} for ${CHEAPEST_PACK_CLAIM.price} — ` +
        `update ${CHEAPEST_PACK_CLAIM.keys.join(", ")}`
    );
  }

  // Env-overridable backend-side, so these drift more easily than the prices.
  for (const [action, cost] of Object.entries(credits.actionCosts)) {
    if (cost !== ACTION_COST_CLAIM.cost) {
      problems.push(
        `credit cost for ${action} is ${cost}, copy says ${ACTION_COST_CLAIM.cost} — ` +
          `update ${ACTION_COST_CLAIM.keys.join(", ")}`
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Marketing copy no longer matches the public plan catalog:\n` +
        problems.map((problem) => `  • ${problem}`).join("\n") +
        `\n\nThe numbers on the pricing cards come from the API and are already ` +
        `correct; these are the hand-written sentences that repeat them. See ` +
        `src/lib/marketing/copy-claims.ts.`
    );
  }
}
