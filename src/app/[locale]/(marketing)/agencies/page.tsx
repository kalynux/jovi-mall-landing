import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import FaqList from "@/components/marketing/FaqList";
import {
  CardGrid,
  CheckList,
  CtaBand,
  InfoCard,
  PageHeader,
  Prose,
  RelatedLinks,
  Section,
  TextLink,
} from "@/components/marketing/parts";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { AGENCY_FAQ } from "@/lib/marketing/faq";

const PATH = "/agencies";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("agencies.metaTitle"),
    description: t("agencies.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("agencies.metaTitle"),
      description: t("agencies.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function AgenciesPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.agencies"), path: PATH },
  ];

  const capabilities = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: t(`agencies.run.i${i}Title`),
    body: t(`agencies.run.i${i}Body`),
  }));

  const start = [1, 2, 3, 4].map((i) => t(`agencies.start.i${i}`));

  const faqItems = AGENCY_FAQ.map((id) => ({
    id,
    question: t(`faq.q.${id}.q`),
    answer: t(`faq.q.${id}.a`),
  }));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />

      <PageHeader
        accent="role-agency"
        eyebrow={t("agencies.eyebrow")}
        title={t("agencies.title")}
        lead={t("agencies.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
      />

      <div className="role-agency">
        <Section title={t("agencies.money.title")}>
          <Prose
            paragraphs={[t("agencies.money.p1"), t("agencies.money.p2"), t("agencies.money.p3")]}
          />
          <p className="mt-6 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface-glass)] p-4 text-sm leading-relaxed text-[var(--text-muted)]">
            {t("agencies.money.codNote")}
          </p>
        </Section>

        <Section title={t("agencies.run.title")} tone="subtle">
          <CardGrid columns={3}>
            {capabilities.map((item) => (
              <InfoCard key={item.title} title={item.title} body={item.body} />
            ))}
          </CardGrid>
        </Section>

        <Section title={t("agencies.capacity.title")}>
          <Prose paragraphs={[t("agencies.capacity.p1"), t("agencies.capacity.p2")]} />
          <p className="mt-5 text-sm">
            <TextLink href="/pricing#agencies">{t("common.ctaPricing")}</TextLink>
          </p>
        </Section>

        <Section title={t("agencies.start.title")} tone="subtle">
          <CheckList items={start} columns={1} />
        </Section>

        <Section title={t("agencies.faqTitle")}>
          <FaqList items={faqItems} />
          <p className="mt-6 text-sm">
            <TextLink href="/faq">{t("common.allQuestions")}</TextLink>
          </p>
        </Section>

        <RelatedLinks
          title={t("common.keepReading")}
          links={[
            { href: "/agents", label: t("nav.agents"), body: t("pricing.agent.lead") },
            { href: "/pricing", label: t("nav.pricing"), body: t("pricing.agency.lead") },
            { href: "/cameroon", label: t("nav.cameroon"), body: t("country.lead") },
          ]}
        />

        <CtaBand
          title={t("agencies.cta.title")}
          body={t("agencies.cta.body")}
          finePrint={t("agencies.cta.finePrint")}
          primary={{ href: "/register?role=agency", label: t("common.ctaAgency") }}
          secondary={{ href: "/pricing", label: t("common.ctaPricing") }}
        />
      </div>
    </>
  );
}
