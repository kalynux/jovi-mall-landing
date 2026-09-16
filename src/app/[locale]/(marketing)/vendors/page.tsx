import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import VendorsIllustration from "@/components/illustrations/VendorsIllustration.generated";
import FaqList from "@/components/marketing/FaqList";
import {
  CheckList,
  CtaBand,
  PageHeader,
  Prose,
  RelatedLinks,
  Section,
  StepList,
  TextLink,
} from "@/components/marketing/parts";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { VENDOR_FAQ } from "@/lib/marketing/faq";

const PATH = "/vendors";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("vendors.metaTitle"),
    description: t("vendors.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("vendors.metaTitle"),
      description: t("vendors.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function VendorsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.vendors"), path: PATH },
  ];

  const steps = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: t(`vendors.how.s${i}Title`),
    body: t(`vendors.how.s${i}Body`),
  }));

  const included = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => t(`vendors.included.i${i}`));
  const start = [1, 2, 3, 4].map((i) => t(`vendors.start.i${i}`));

  const faqItems = VENDOR_FAQ.map((id) => ({
    id,
    question: t(`faq.q.${id}.q`),
    answer: t(`faq.q.${id}.a`),
  }));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />

      <PageHeader
        accent="role-vendor"
        eyebrow={t("vendors.eyebrow")}
        title={t("vendors.title")}
        lead={t("vendors.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
        illustration={<VendorsIllustration />}
      />

      <div className="role-vendor">
        <Section title={t("vendors.problem.title")}>
          <Prose
            paragraphs={[
              t("vendors.problem.p1"),
              t("vendors.problem.p2"),
              t("vendors.problem.p3"),
            ]}
          />
        </Section>

        <Section title={t("vendors.how.title")} lead={t("vendors.how.lead")} tone="subtle">
          <StepList steps={steps} />
        </Section>

        <Section title={t("vendors.included.title")}>
          <CheckList items={included} />
        </Section>

        <Section title={t("vendors.cost.title")} tone="subtle">
          <Prose paragraphs={[t("vendors.cost.p1"), t("vendors.cost.p2")]} />
          <p className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface-glass)] p-4 text-sm leading-relaxed text-[var(--text-muted)]">
            {t("common.payoutCapNote")}
          </p>
          <p className="mt-5 text-sm">
            <TextLink href="/pricing#vendors">{t("common.ctaPricing")}</TextLink>
          </p>
        </Section>

        <Section title={t("vendors.start.title")} lead={t("vendors.start.lead")}>
          <CheckList items={start} columns={1} />
        </Section>

        <Section title={t("vendors.faqTitle")} tone="subtle">
          <FaqList items={faqItems} />
          <p className="mt-6 text-sm">
            <TextLink href="/faq">{t("common.allQuestions")}</TextLink>
          </p>
        </Section>

        <RelatedLinks
          title={t("common.keepReading")}
          links={[
            { href: "/pricing", label: t("nav.pricing"), body: t("pricing.vendor.lead") },
            { href: "/agencies", label: t("nav.agencies"), body: t("pricing.agency.lead") },
            { href: "/cameroon", label: t("nav.cameroon"), body: t("country.lead") },
          ]}
        />

        <CtaBand
          title={t("vendors.cta.title")}
          body={t("vendors.cta.body")}
          finePrint={t("vendors.cta.finePrint")}
          primary={{ href: "/register?role=vendor", label: t("common.ctaVendor") }}
          primaryRole="vendor"
          secondary={{ href: "/pricing", label: t("common.ctaPricing") }}
        />
      </div>
    </>
  );
}
