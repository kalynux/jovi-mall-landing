import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import FaqList from "@/components/marketing/FaqList";
import { CtaBand, PageHeader, RelatedLinks, Section } from "@/components/marketing/parts";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { FAQ_GROUPS } from "@/lib/marketing/faq";

const PATH = "/faq";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("faq.metaTitle"),
    description: t("faq.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("faq.metaTitle"),
      description: t("faq.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function FaqPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.faq"), path: PATH },
  ];

  const groups = FAQ_GROUPS.map((group) => ({
    key: group.key,
    title: t(`faq.groups.${group.key}`),
    items: group.items.map((id) => ({
      id,
      question: t(`faq.q.${id}.q`),
      answer: t(`faq.q.${id}.a`),
    })),
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          // The site's only FAQPage. The role and pricing pages quote a few of
          // these questions but leave the markup here, so one entity owns them.
          faqPageJsonLd(
            locale,
            PATH,
            groups.flatMap((group) =>
              group.items.map((item) => ({ question: item.question, answer: item.answer }))
            )
          ),
        ]}
      />

      <PageHeader
        eyebrow={t("faq.eyebrow")}
        title={t("faq.title")}
        lead={t("faq.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
      />

      {groups.map((group, i) => (
        <Section
          key={group.key}
          id={group.key}
          title={group.title}
          tone={i % 2 ? "subtle" : "plain"}
        >
          <FaqList items={group.items} />
        </Section>
      ))}

      <RelatedLinks
        title={t("common.keepReading")}
        links={[
          { href: "/pricing", label: t("nav.pricing"), body: t("pricing.lead") },
          { href: "/vendors", label: t("nav.vendors"), body: t("vendors.lead") },
          { href: "/cameroon", label: t("nav.cameroon"), body: t("country.lead") },
        ]}
      />

      <CtaBand
        title={t("faq.cta.title")}
        body={t("faq.cta.body")}
        finePrint={t("faq.cta.finePrint")}
        primary={{ href: "/register?role=vendor", label: t("common.ctaVendor") }}
        primaryRole="vendor"
        secondary={{ href: "/pricing", label: t("common.ctaPricing") }}
      />
    </>
  );
}
