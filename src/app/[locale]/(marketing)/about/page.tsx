import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import AboutIllustration from "@/components/illustrations/AboutIllustration.generated";
import {
  CardGrid,
  CheckList,
  CtaBand,
  InfoCard,
  PageHeader,
  Prose,
  RelatedLinks,
  Section,
  StepList,
  TextLink,
} from "@/components/marketing/parts";
import { aboutPageJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";

const PATH = "/about";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("about.metaTitle"),
    description: t("about.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("about.metaTitle"),
      description: t("about.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.about"), path: PATH },
  ];

  const steps = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: t(`about.how.s${i}Title`),
    body: t(`about.how.s${i}Body`),
  }));

  const beliefs = [1, 2, 3, 4, 5].map((i) => ({
    title: t(`about.beliefs.b${i}Title`),
    body: t(`about.beliefs.b${i}Body`),
  }));

  const practices = [1, 2, 3, 4].map((i) => t(`about.build.i${i}`));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          aboutPageJsonLd(locale, PATH, t("about.metaDescription")),
        ]}
      />

      <PageHeader
        eyebrow={t("about.eyebrow")}
        title={t("about.title")}
        lead={t("about.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
        illustration={<AboutIllustration />}
      />

      <Section title={t("about.why.title")}>
        <Prose
          paragraphs={[
            t("about.why.p1"),
            t("about.why.p2"),
            t("about.why.p3"),
            t("about.why.p4"),
          ]}
        />
      </Section>

      <Section title={t("about.how.title")} lead={t("about.how.lead")} tone="subtle">
        <StepList steps={steps} />
      </Section>

      <Section title={t("about.here.title")} lead={t("about.here.lead")}>
        <Prose paragraphs={[t("about.here.p1"), t("about.here.p2"), t("about.here.p3")]} />
        <p className="mt-5 text-sm">
          <TextLink href="/cameroon">{t("about.here.link")}</TextLink>
        </p>
      </Section>

      <Section title={t("about.foursides.title")} lead={t("about.foursides.lead")} tone="subtle">
        <CardGrid columns={4}>
          <div className="role-vendor">
            <InfoCard
              title={t("about.foursides.vendorTitle")}
              body={t("about.foursides.vendorBody")}
            />
          </div>
          <div className="role-agency">
            <InfoCard
              title={t("about.foursides.agencyTitle")}
              body={t("about.foursides.agencyBody")}
            />
          </div>
          <div className="role-agent">
            <InfoCard
              title={t("about.foursides.agentTitle")}
              body={t("about.foursides.agentBody")}
            />
          </div>
          <div className="role-customer">
            <InfoCard
              title={t("about.foursides.customerTitle")}
              body={t("about.foursides.customerBody")}
            />
          </div>
        </CardGrid>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          {t("about.foursides.note")}
        </p>
      </Section>

      <Section title={t("about.beliefs.title")} lead={t("about.beliefs.lead")}>
        <CardGrid columns={2}>
          {beliefs.map((belief, i) => (
            <InfoCard
              key={belief.title}
              meta={t("about.beliefs.meta", { n: i + 1 })}
              title={belief.title}
              body={belief.body}
            />
          ))}
        </CardGrid>
      </Section>

      <Section title={t("about.build.title")} lead={t("about.build.lead")} tone="subtle">
        <CheckList items={practices} columns={1} />
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          {t("about.build.note")}
        </p>
      </Section>

      <Section title={t("about.now.title")}>
        <Prose paragraphs={[t("about.now.p1"), t("about.now.p2"), t("about.now.p3")]} />
        <p className="mt-5 text-sm">
          <TextLink href="/pricing">{t("common.ctaPricing")}</TextLink>
        </p>
      </Section>

      <RelatedLinks
        title={t("common.keepReading")}
        links={[
          { href: "/cameroon", label: t("nav.cameroon"), body: t("country.lead") },
          { href: "/careers", label: t("nav.careers"), body: t("careers.relatedBody") },
          { href: "/contact", label: t("nav.contact"), body: t("contact.relatedBody") },
        ]}
      />

      <CtaBand
        title={t("about.cta.title")}
        body={t("about.cta.body")}
        finePrint={t("about.cta.finePrint")}
        primary={{ href: "/vendors", label: t("common.ctaVendor") }}
        secondary={{ href: "/contact", label: t("about.cta.secondary") }}
      />
    </>
  );
}
