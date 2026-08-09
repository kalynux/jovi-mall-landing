import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import FaqList from "@/components/marketing/FaqList";
import {
  CardGrid,
  CtaBand,
  DataTable,
  InfoCard,
  PageHeader,
  Prose,
  Section,
  TextLink,
} from "@/components/marketing/parts";
import { breadcrumbJsonLd, serviceAreaJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { CITIES, REGIONS, cityPath } from "@/lib/marketing/geo";
import { COUNTRY_FAQ } from "@/lib/marketing/faq";

const PATH = "/cameroon";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("country.metaTitle"),
    description: t("country.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("country.metaTitle"),
      description: t("country.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function CameroonPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.cameroon"), path: PATH },
  ];

  const faqItems = COUNTRY_FAQ.map((id) => ({
    id,
    question: t(`faq.q.${id}.q`),
    answer: t(`faq.q.${id}.a`),
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          serviceAreaJsonLd(
            locale,
            PATH,
            { type: "Country", name: t("nav.cameroon") },
            { name: t("country.metaTitle"), description: t("country.metaDescription") }
          ),
        ]}
      />

      <PageHeader
        eyebrow={t("country.eyebrow")}
        title={t("country.title")}
        lead={t("country.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
      />

      <Section title={t("country.why.title")}>
        <Prose paragraphs={[t("country.why.p1"), t("country.why.p2"), t("country.why.p3")]} />
      </Section>

      <Section title={t("country.coverage.title")} lead={t("country.coverage.lead")} tone="subtle">
        <div className="max-w-2xl">
          <DataTable
            caption={t("country.coverage.title")}
            head={[t("country.coverage.regionLabel"), t("country.coverage.capitalLabel")]}
            rows={REGIONS.map((region) => [t(`regions.${region.key}`), region.capital])}
          />
        </div>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          {t("country.coverage.note")}
        </p>
      </Section>

      <Section title={t("country.payments.title")}>
        <CardGrid columns={4}>
          <InfoCard
            title={t("country.payments.mobileTitle")}
            body={t("country.payments.mobileBody")}
          />
          <InfoCard title={t("country.payments.cardTitle")} body={t("country.payments.cardBody")} />
          <InfoCard title={t("country.payments.codTitle")} body={t("country.payments.codBody")} />
          <InfoCard
            title={t("country.payments.currencyTitle")}
            body={t("country.payments.currencyBody")}
          />
        </CardGrid>
      </Section>

      <Section title={t("country.cities.title")} lead={t("country.cities.lead")} tone="subtle">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CITIES.map((city) => (
            <Link
              key={city.slug}
              href={cityPath(city.slug)}
              className="card p-5 transition-colors hover:border-role-soft"
            >
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-role">
                {t(`regions.${city.region}`)}
              </p>
              <h3 className="mt-2 font-display text-base font-semibold text-[var(--text-primary)]">
                {city.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {t(`cities.${city.slug}.lead`)}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <Section title={t("country.faqTitle")}>
        <FaqList items={faqItems} />
        <p className="mt-6 text-sm">
          <TextLink href="/faq">{t("common.allQuestions")}</TextLink>
        </p>
      </Section>

      <CtaBand
        title={t("country.cta.title")}
        body={t("country.cta.body")}
        finePrint={t("country.cta.finePrint")}
        primary={{ href: "/register?role=vendor", label: t("common.ctaVendor") }}
        primaryRole="vendor"
        secondary={{ href: "/agencies", label: t("common.ctaAgency") }}
      />
    </>
  );
}
