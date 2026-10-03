import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import PricingIllustration from "@/components/illustrations/PricingIllustration.generated";
import FaqList from "@/components/marketing/FaqList";
import { formatLimit, PlanGrid, type PlanCopy } from "@/components/marketing/PlanCards";
import {
  CardGrid,
  CtaBand,
  DataTable,
  InfoCard,
  PageHeader,
  Prose,
  RelatedLinks,
  Section,
  TextLink,
} from "@/components/marketing/parts";
import { breadcrumbJsonLd, offerCatalogJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import {
  fetchCreditCatalog,
  fetchPlansByRole,
  getPlanFacts,
  highlightCodeFor,
  PLAN_LIMITS,
  type PlanRole,
  type PublicPlan,
} from "@/lib/marketing/plans.api";
import { PRICING_FAQ } from "@/lib/marketing/faq";
import { formatNumber, formatPrice, formatUnitPrice } from "@/lib/marketing/format";
import { stripBidiIsolates } from "@/lib/bidi";
import { SHARE_IMAGES } from "@/lib/seo/share";

const PATH = "/pricing";

type PageProps = { params: Promise<{ locale: string }> };

// One namespace per file, resolved at the `pages` root rather than per section.
// Several `getTranslations` calls in one module read fine but defeat the editor's
// i18n key resolution, which attributes every `t()` to the last namespace it saw.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });
  const facts = await getPlanFacts(locale);

  return {
    title: t("pricing.metaTitle"),
    description: t("pricing.metaDescription", facts),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("pricing.metaTitle"),
      description: t("pricing.metaDescription", facts),
      url: localePath(locale, PATH),
      images: SHARE_IMAGES,
    },
  };
}

/**
 * Roles in the order the page argues them.
 *
 * `anchor` is spelled out rather than derived from `role` — the other pages
 * already link to `/pricing#agencies`, and `agency + "s"` would quietly break
 * every one of them.
 */
const ROLE_SECTIONS: { role: PlanRole; anchor: string; accent: string }[] = [
  { role: "vendor", anchor: "vendors", accent: "role-vendor" },
  { role: "agency", anchor: "agencies", accent: "role-agency" },
  { role: "agent", anchor: "agents", accent: "role-agent" },
];

export default async function PricingPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  // Both catalogs come off the public API — nothing on this page restates a
  // price the backend did not just give us. Revalidation is set per-fetch to
  // match the endpoint's own five-minute cache; see plans.api.ts.
  const [plansByRole, credits, facts] = await Promise.all([
    fetchPlansByRole(),
    fetchCreditCatalog(),
    // The sentences around the cards, filled from the same catalogue. They
    // carry no numbers of their own, so an edit reaches them and the cards
    // together. See plan-facts.ts.
    getPlanFacts(locale),
  ]);
  const allPlans = Object.values(plansByRole).flat();

  const copy: PlanCopy = {
    free: t("plans.free"),
    perTerm: (days: number) => t("plans.perTerm", { days }),
    unavailable: t("plans.unavailable"),
    cta: t("plans.cta"),
    unlimited: t("plans.unlimited"),
    limitLabels: {
      products: t("plans.limits.products"),
      storage: t("plans.limits.storage"),
      commission: t("plans.limits.commission"),
      credits: t("plans.limits.credits"),
      openShipments: t("plans.limits.openShipments"),
      concurrentDeliveries: t("plans.limits.concurrentDeliveries"),
    },
  };

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.pricing"), path: PATH },
  ];

  const num = (value: number) => formatNumber(locale, value);
  const price = (value: number, currency: string) => formatPrice(locale, value, currency);

  // Only tiers the catalog will actually sell are described as offers. Marking
  // up an `is_active: false` tier would be structured data for something no
  // endpoint will take money for.
  const offers = allPlans
    .filter((plan) => plan.is_active)
    .map((plan) => ({
      name: plan.name,
      description: describeLimits(plan, copy, num),
      price: plan.price,
      currency: plan.currency,
      category: plan.code,
    }));

  const faqItems = PRICING_FAQ.map((id) => ({
    id,
    question: t(`faq.q.${id}.q`),
    answer: t(`faq.q.${id}.a`, facts),
  }));

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(locale, trail), offerCatalogJsonLd(locale, PATH, offers)]} />

      <PageHeader
        eyebrow={t("pricing.eyebrow")}
        title={t("pricing.title")}
        lead={t("pricing.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
        aside={
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-glass)] p-4 text-xs leading-relaxed text-[var(--text-muted)]">
            {t("common.currencyNote")}
          </p>
        }
        illustration={<PricingIllustration />}
      />

      <Section title={t("pricing.howWeEarn.title")} lead={t("pricing.howWeEarn.lead")}>
        <CardGrid columns={4}>
          <InfoCard
            title={t("pricing.howWeEarn.commission.title")}
            body={t("pricing.howWeEarn.commission.body", facts)}
          />
          <InfoCard
            title={t("pricing.howWeEarn.plans.title")}
            body={t("pricing.howWeEarn.plans.body", facts)}
          />
          <InfoCard
            title={t("pricing.howWeEarn.credits.title")}
            body={t("pricing.howWeEarn.credits.body")}
          />
          <InfoCard
            title={t("pricing.howWeEarn.delivery.title")}
            body={t("pricing.howWeEarn.delivery.body")}
          />
        </CardGrid>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          {t("pricing.howWeEarn.customerNote")}
        </p>
      </Section>

      {ROLE_SECTIONS.map(({ role, anchor, accent }, i) => {
        const plans = plansByRole[role];
        const hasUnsoldTier = plans.some((plan) => !plan.is_active);

        return (
          <Section
            key={role}
            id={anchor}
            title={t(`pricing.${role}.title`)}
            lead={t(`pricing.${role}.lead`, facts)}
            tone={i % 2 === 0 ? "subtle" : "plain"}
          >
            <div className={accent}>
              <PlanGrid
                plans={plans}
                copy={copy}
                formatNumber={num}
                formatPrice={price}
                highlightCode={highlightCodeFor(plans)}
              />
            </div>
            <div className="mt-6 max-w-2xl space-y-2 text-sm leading-relaxed text-[var(--text-muted)]">
              <p>{t(`pricing.${role}.note`)}</p>
              {/* Only claimed when the catalog actually withholds a tier — the
                  moment they go on sale, the sentence disappears on its own. */}
              {hasUnsoldTier && <p>{t("pricing.unsoldTierNote")}</p>}
            </div>
          </Section>
        );
      })}

      <Section id="credits" title={t("pricing.credits.title")}>
        <Prose paragraphs={[t("pricing.credits.p1", facts), t("pricing.credits.p2", facts)]} />
        <h3 className="mt-10 font-display text-lg font-semibold text-[var(--text-primary)]">
          {t("pricing.credits.packsTitle")}
        </h3>
        <div className="mt-4 max-w-2xl">
          <DataTable
            caption={t("pricing.credits.packsCaption")}
            head={[
              t("pricing.credits.creditsHead"),
              t("pricing.credits.priceHead"),
              t("pricing.credits.perCreditHead"),
            ]}
            rows={credits.packs.map((pack) => [
              num(pack.credits),
              price(pack.price, pack.currency),
              formatUnitPrice(locale, pack.price / pack.credits, pack.currency),
            ])}
          />
        </div>
      </Section>

      <Section title={t("pricing.payment.title")} tone="subtle">
        <Prose
          paragraphs={[t("pricing.payment.p1"), t("pricing.payment.p2", facts), t("pricing.payment.p3")]}
        />
      </Section>

      <Section title={t("pricing.faqTitle")}>
        <FaqList items={faqItems} />
        <p className="mt-6 text-sm">
          <TextLink href="/faq">{t("common.allQuestions")}</TextLink>
        </p>
      </Section>

      <RelatedLinks
        title={t("common.keepReading")}
        links={[
          { href: "/vendors", label: t("nav.vendors"), body: t("pricing.vendor.lead", facts) },
          { href: "/agencies", label: t("nav.agencies"), body: t("pricing.agency.lead") },
          { href: "/agents", label: t("nav.agents"), body: t("pricing.agent.lead") },
        ]}
      />

      <CtaBand
        title={t("pricing.cta.title")}
        body={t("pricing.cta.body")}
        finePrint={t("pricing.cta.finePrint", facts)}
        primary={{ href: "/register?role=vendor", label: t("common.ctaVendor") }}
        primaryRole="vendor"
        secondary={{ href: "/faq", label: t("common.ctaFaq") }}
      />
    </>
  );
}

/**
 * Flat description of a plan's limits, for the structured-data Offer node.
 *
 * Built from the card's own `formatLimit`, so the two cannot disagree. This used
 * to be a second formatter, and it printed storage as a raw byte count and the
 * commission without its percent sign.
 */
function describeLimits(
  plan: PublicPlan,
  copy: PlanCopy,
  num: (value: number) => string
): string {
  return PLAN_LIMITS[plan.role]
    .map((spec) => stripBidiIsolates(formatLimit(plan, spec, copy, num)))
    .join(", ");
}
