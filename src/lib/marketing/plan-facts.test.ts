/**
 * The live plan figures in marketing sentences: `buildPlanFacts` plus the five
 * message catalogues it fills.
 *
 * Run with `npm test`. Messages are rendered with intl-messageformat, the
 * formatter next-intl itself uses (it arrives through next-intl), so a
 * sentence that renders here renders on the site.
 *
 * The regression this exists for: on 2026-09-22 an admin raised Starter to 75
 * products and every page kept saying 15. See plan-facts.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IntlMessageFormat } from "intl-messageformat";
import type { Locale } from "@/i18n/routing";
import { stripBidiIsolates } from "@/lib/bidi";
import { buildPlanFacts, PlanFactsError, type PlanFacts } from "./plan-facts";
import type { CreditCatalog, PublicPlan } from "./plans.api";
import { COUNTRY_FAQ, CUSTOMER_FAQ, type FaqId } from "./faq";

const LOCALES: Locale[] = ["en", "fr", "es", "pt", "ar"];
const GIB = 1024 ** 3;

type Tree = { [key: string]: string | Tree };

const MESSAGES: Record<string, Tree> = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), "utf8")),
  ])
);

function message(locale: string, path: string): string {
  const value = path.split(".").reduce<string | Tree | undefined>(
    (node, key) => (node && typeof node === "object" ? node[key] : undefined),
    MESSAGES[locale]
  );
  assert.equal(typeof value, "string", `${locale}: ${path} is missing`);
  return value as string;
}

function render(locale: string, template: string, values: Record<string, string | number>): string {
  return stripBidiIsolates(String(new IntlMessageFormat(template, locale).format(values)));
}

/** The sentences that quoted a figure and now take it from a placeholder. */
const CONVERTED = [
  "pages.pricing.metaDescription",
  "pages.pricing.howWeEarn.commission.body",
  "pages.pricing.howWeEarn.plans.body",
  "pages.pricing.vendor.lead",
  "pages.pricing.credits.p1",
  "pages.pricing.credits.p2",
  "pages.pricing.payment.p2",
  "pages.pricing.cta.finePrint",
  "pages.vendors.metaDescription",
  "pages.vendors.cost.p1",
  "pages.vendors.cost.p2",
  "pages.vendors.cta.finePrint",
  "pages.agencies.capacity.p1",
  "pages.agencies.cta.body",
  "pages.agencies.cta.finePrint",
  "pages.agents.capacity.p1",
  "pages.agents.cta.finePrint",
  "pages.faq.q.vendorCost.a",
  "pages.faq.q.agentCapacity.a",
  "pages.faq.q.credits.a",
  "pages.faq.q.renewal.a",
  "pages.city.sellingP2",
  "pages.city.opportunityBody",
  "finalCta.finePrint",
];

/** Rewritten to describe the new mechanism; carries no figure at all. */
const NO_FIGURES = [...CONVERTED, "pages.about.build.i1"];

// ── A catalogue shaped like production on 2026-09-22 ─────────────────────────

function plan(fields: Partial<PublicPlan> & Pick<PublicPlan, "role" | "code">): PublicPlan {
  return {
    id: fields.code,
    name: fields.code,
    price: 0,
    currency: "XAF",
    term_days: null,
    credit_allowance: 0,
    max_active_products: null,
    max_storage_bytes: null,
    commission_percent: null,
    max_unterminated_shipments: null,
    live_tracking_enabled: true,
    is_active: true,
    sort_order: 1,
    ...fields,
  };
}

const PLANS: PublicPlan[] = [
  plan({ role: "vendor", code: "starter", name: "Starter", credit_allowance: 100, max_active_products: 75, max_storage_bytes: GIB, commission_percent: 7 }),
  plan({ role: "vendor", code: "growth", name: "Growth", price: 5000, term_days: 30, credit_allowance: 400, max_active_products: 150, max_storage_bytes: 10 * GIB, commission_percent: 5, sort_order: 2 }),
  plan({ role: "vendor", code: "business", name: "Business", price: 25000, term_days: 30, credit_allowance: 1500, max_storage_bytes: 100 * GIB, commission_percent: 3, sort_order: 3 }),
  plan({ role: "agency", code: "agency_free", name: "Agency Free", credit_allowance: 50, max_unterminated_shipments: 1000, max_storage_bytes: 5 * GIB }),
  plan({ role: "agency", code: "agency_growth", name: "Agency Growth", price: 15000, term_days: 30, is_active: false, sort_order: 2 }),
  plan({ role: "agent", code: "agent_free", name: "Agent Free", credit_allowance: 20, max_unterminated_shipments: 20, max_storage_bytes: GIB, max_cod_pool: 500000 }),
  plan({ role: "agent", code: "agent_plus", name: "Agent Plus", price: 2000, term_days: 30, is_active: false, sort_order: 2 }),
];

const CREDITS: CreditCatalog = {
  packs: [
    { code: "pack_100", credits: 100, price: 600, currency: "XAF" },
    { code: "pack_320", credits: 320, price: 1800, currency: "XAF" },
    { code: "pack_1100", credits: 1100, price: 6000, currency: "XAF" },
    { code: "pack_2250", credits: 2250, price: 12000, currency: "XAF" },
  ],
  actionCosts: { vectorisation: 5, whatsappTemplate: 2 },
};

function facts(locale: Locale, plans = PLANS, credits = CREDITS): PlanFacts {
  const built = buildPlanFacts({
    plans,
    credits,
    locale,
    phrase: (key, values = {}) => render(locale, message(locale, `pages.facts.${key}`), values),
  });
  return Object.fromEntries(Object.entries(built).map(([key, value]) => [key, stripBidiIsolates(value)]));
}

const edit = (code: string, fields: Partial<PublicPlan>) =>
  PLANS.map((p) => (p.code === code ? { ...p, ...fields } : p));

/** Every `{name` a template refers to that is a fact. */
function factsUsed(template: string, known: PlanFacts): Set<string> {
  return new Set([...template.matchAll(/\{\s*([A-Za-z]\w*)/g)].map((m) => m[1]).filter((name) => name in known));
}

// ── The defect, verbatim ─────────────────────────────────────────────────────

test("the reported edit: Starter at 75 products reads 75, not 15", () => {
  assert.equal(
    render("en", message("en", "pages.vendors.cost.p1"), facts("en")),
    "The free tier is not a trial. Starter lets you publish 75 products with 1 GB of media, takes 7% of each paid order, and never expires."
  );
  assert.equal(
    render("en", message("en", "pages.pricing.credits.p2"), facts("en")),
    "Activating a plan grants its allowance once — 100 credits on the vendor free tier, 1,500 credits on Business. If you use it all, top up in packs. The larger the pack, the less each credit costs."
  );
});

test("every figure is read from the catalogue", () => {
  const en = facts("en");
  assert.deepEqual(
    {
      growth: `${en.growthPrice} ${en.growthPer}`,
      business: en.businessProducts,
      agency: en.agencyShipments,
      agent: en.agentDeliveries,
      term: en.paidTerm,
      saving: en.growthSaving,
      from: en.vendorFromPrice,
      pack: `${en.cheapestPackCredits} for ${en.cheapestPackPrice}`,
      costs: `${en.vectorisationCost} / ${en.whatsappTemplateCost}`,
      commission: `${en.vendorCommissionMax} → ${en.vendorCommissionMin}`,
    },
    {
      growth: "5,000 FCFA per 30 days",
      business: "unlimited products",
      agency: "1,000 open shipments",
      agent: "20 deliveries",
      term: "30 days",
      saving: "8,000 FCFA",
      from: "5,000 FCFA",
      pack: "100 credits for 600 FCFA",
      costs: "5 credits / 2 credits",
      commission: "7% → 3%",
    }
  );
});

// ── Values the sentences have to survive ─────────────────────────────────────

test("null reads as unlimited, and a null commission as the 0% the backend charges", () => {
  const en = facts("en", edit("growth", { max_active_products: null, max_storage_bytes: null, commission_percent: null }));
  assert.equal(en.growthProducts, "unlimited products");
  assert.equal(en.growthMedia, "unlimited media storage");
  assert.equal(en.growthCommission, "0%");
});

test("storage keeps a decimal, in the locale's own notation", () => {
  const plans = edit("starter", { max_storage_bytes: 1.5 * GIB });
  assert.equal(facts("en", plans).starterMedia, "1.5 GB of media");
  assert.equal(facts("fr", plans).starterMedia, "1,5 Go de médias");
});

test("the worked example switches to its neutral sentence once Growth stops saving", () => {
  const en = facts("en", edit("growth", { commission_percent: 8 }));
  assert.equal(en.growthSaves, "no");
  assert.equal(
    render("en", message("en", "pages.pricing.vendor.lead"), en),
    "The commission is the number worth comparing, and each tier's rate is listed with its plan."
  );
});

test("paid terms that differ send the reader to each plan", () => {
  assert.equal(facts("en", edit("business", { term_days: 60 })).paidTerm, "the length shown on each plan");
});

test("packs that stop getting cheaper drop the sentence that says they do", () => {
  const credits = { ...CREDITS, packs: [...CREDITS.packs, { code: "pack_5000", credits: 5000, price: 60000, currency: "XAF" }] };
  const en = facts("en", PLANS, credits);
  assert.equal(en.packDiscount, "no");
  assert.doesNotMatch(render("en", message("en", "pages.pricing.credits.p2"), en), /larger the pack/);
});

test("deleting a plan the prose names is the one edit that still fails", () => {
  assert.throws(() => facts("en", PLANS.filter((p) => p.code !== "growth")), PlanFactsError);
});

// ── Grammar ──────────────────────────────────────────────────────────────────

test("Arabic nouns agree with their count: dual, plural, accusative and genitive", () => {
  const ar = facts("ar");
  assert.equal(ar.whatsappTemplateCost, "رصيدين");
  assert.equal(ar.vectorisationCost, "5 أرصدة");
  assert.equal(ar.agentDeliveries, "20 توصيلة");
  assert.equal(ar.cheapestPackCredits, "100 رصيد");
  assert.equal(ar.starterProducts, "75 منتجًا");
});

test("a count of one is singular in every language", () => {
  const plans = edit("agent_free", { max_unterminated_shipments: 1 });
  assert.deepEqual(
    LOCALES.map((locale) => facts(locale, plans).agentDeliveries),
    ["1 delivery", "1 livraison", "1 entrega", "1 entrega", "توصيلة واحدة"]
  );
});

// ── The catalogues ───────────────────────────────────────────────────────────

test("every converted sentence renders in every language with nothing left unfilled", () => {
  for (const locale of LOCALES) {
    const values = { ...facts(locale), region: "Littoral", city: "Douala" };
    for (const key of CONVERTED) {
      const text = render(locale, message(locale, key), values);
      assert.doesNotMatch(text, /[{}]/, `${locale}: ${key} rendered "${text}"`);
    }
  }
});

test("each language uses the same placeholders as English", () => {
  const known = facts("en");
  for (const key of CONVERTED) {
    const expected = [...factsUsed(message("en", key), known)].sort();
    assert.ok(expected.length > 0, `${key} has no placeholder`);
    for (const locale of LOCALES) {
      assert.deepEqual([...factsUsed(message(locale, key), known)].sort(), expected, `${locale}: ${key}`);
    }
  }
});

test("no converted sentence types a figure of its own", () => {
  for (const locale of LOCALES) {
    for (const key of NO_FIGURES) {
      assert.doesNotMatch(message(locale, key), /[0-9٠-٩]/, `${locale}: ${key} holds a digit — use a placeholder`);
    }
  }
});

test("pages that pass no facts list no FAQ answer that needs them", () => {
  const known = facts("en");
  const unfilled = (ids: readonly FaqId[]) =>
    ids.filter((id) => factsUsed(message("en", `pages.faq.q.${id}.a`), known).size > 0);
  assert.deepEqual(unfilled(CUSTOMER_FAQ), []);
  assert.deepEqual(unfilled(COUNTRY_FAQ), []);
});
