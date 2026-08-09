import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
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
import { AGENT_FAQ } from "@/lib/marketing/faq";

const PATH = "/agents";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("agents.metaTitle"),
    description: t("agents.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("agents.metaTitle"),
      description: t("agents.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function AgentsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.agents"), path: PATH },
  ];

  const steps = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: t(`agents.how.s${i}Title`),
    body: t(`agents.how.s${i}Body`),
  }));

  const start = [1, 2, 3, 4].map((i) => t(`agents.start.i${i}`));

  const faqItems = AGENT_FAQ.map((id) => ({
    id,
    question: t(`faq.q.${id}.q`),
    answer: t(`faq.q.${id}.a`),
  }));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />

      <PageHeader
        accent="role-agent"
        eyebrow={t("agents.eyebrow")}
        title={t("agents.title")}
        lead={t("agents.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
      />

      <div className="role-agent">
        <Section title={t("agents.how.title")} tone="subtle">
          <StepList steps={steps} />
        </Section>

        <Section title={t("agents.earnings.title")}>
          <Prose
            paragraphs={[
              t("agents.earnings.p1"),
              t("agents.earnings.p2"),
              t("agents.earnings.p3"),
            ]}
          />
        </Section>

        <Section title={t("agents.capacity.title")} tone="subtle">
          <Prose paragraphs={[t("agents.capacity.p1"), t("agents.capacity.p2")]} />
          <p className="mt-5 text-sm">
            <TextLink href="/pricing#agents">{t("common.ctaPricing")}</TextLink>
          </p>
        </Section>

        <Section title={t("agents.start.title")}>
          <CheckList items={start} columns={1} />
        </Section>

        <Section title={t("agents.faqTitle")} tone="subtle">
          <FaqList items={faqItems} />
          <p className="mt-6 text-sm">
            <TextLink href="/faq">{t("common.allQuestions")}</TextLink>
          </p>
        </Section>

        <RelatedLinks
          title={t("common.keepReading")}
          links={[
            { href: "/agencies", label: t("nav.agencies"), body: t("pricing.agency.lead") },
            { href: "/pricing", label: t("nav.pricing"), body: t("pricing.agent.lead") },
            { href: "/cameroon", label: t("nav.cameroon"), body: t("country.lead") },
          ]}
        />

        <CtaBand
          title={t("agents.cta.title")}
          body={t("agents.cta.body")}
          finePrint={t("agents.cta.finePrint")}
          primary={{ href: "/register?role=agent", label: t("common.ctaAgent") }}
          primaryRole="agent"
          secondary={{ href: "/agencies", label: t("nav.agencies") }}
        />
      </div>
    </>
  );
}
