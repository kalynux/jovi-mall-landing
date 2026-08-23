import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import CustomersIllustration from "@/components/illustrations/CustomersIllustration.generated";
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
  StepList,
  TextLink,
} from "@/components/marketing/parts";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { CUSTOMER_FAQ } from "@/lib/marketing/faq";
import { buildWhatsAppUrl } from "@/lib/constants";

const PATH = "/customers";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("customers.metaTitle"),
    description: t("customers.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("customers.metaTitle"),
      description: t("customers.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function CustomersPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });
  const tc = await getTranslations({ locale, namespace: "customer" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.customers"), path: PATH },
  ];

  const steps = [1, 2, 3, 4, 5, 6].map((i) => ({
    title: t(`customers.how.s${i}Title`),
    body: t(`customers.how.s${i}Body`),
  }));

  const asks = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => t(`customers.ask.i${i}`));
  const need = [1, 2, 3, 4].map((i) => t(`customers.need.i${i}`));

  const faqItems = CUSTOMER_FAQ.map((id) => ({
    id,
    question: t(`faq.q.${id}.q`),
    answer: t(`faq.q.${id}.a`),
  }));

  // The one action on this page. Unlike the other three roles there is no
  // registration form to send anyone to — the buying side has no account — so
  // every CTA here is the same translated deep link into the bot.
  const waUrl = buildWhatsAppUrl(tc("whatsapp.previewUserMsg"));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />

      <PageHeader
        accent="role-customer"
        eyebrow={t("customers.eyebrow")}
        title={t("customers.title")}
        lead={t("customers.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
        // The other role pages close on their CTA and nothing else. This one
        // also opens with it: a reader who arrived on "buy X in Douala" is one
        // tap from the thing the page is describing, and there is no form
        // standing between them and it.
        actions={
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            {t("common.ctaCustomer")}
          </a>
        }
        illustration={<CustomersIllustration />}
      />

      <div className="role-customer">
        <Section title={t("customers.problem.title")}>
          <Prose
            paragraphs={[
              t("customers.problem.p1"),
              t("customers.problem.p2"),
              t("customers.problem.p3"),
            ]}
          />
        </Section>

        <Section title={t("customers.how.title")} lead={t("customers.how.lead")} tone="subtle">
          <StepList steps={steps} />
        </Section>

        <Section title={t("customers.ask.title")} lead={t("customers.ask.lead")}>
          <CheckList items={asks} />
        </Section>

        <Section title={t("customers.pay.title")} lead={t("customers.pay.lead")} tone="subtle">
          <CardGrid columns={3}>
            <InfoCard title={t("customers.pay.mobileTitle")} body={t("customers.pay.mobileBody")} />
            <InfoCard title={t("customers.pay.cardTitle")} body={t("customers.pay.cardBody")} />
            <InfoCard title={t("customers.pay.codTitle")} body={t("customers.pay.codBody")} />
          </CardGrid>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
            {t("common.currencyNote")}
          </p>
        </Section>

        <Section title={t("customers.delivery.title")}>
          <Prose
            paragraphs={[
              t("customers.delivery.p1"),
              t("customers.delivery.p2"),
              t("customers.delivery.p3"),
            ]}
          />
          <p className="mt-5 text-sm">
            <TextLink href="/cameroon">{t("customers.delivery.link")}</TextLink>
          </p>
        </Section>

        <Section title={t("customers.cost.title")} tone="subtle">
          <Prose paragraphs={[t("customers.cost.p1"), t("customers.cost.p2")]} />
          <p className="mt-5 text-sm">
            <TextLink href="/pricing">{t("common.ctaPricing")}</TextLink>
          </p>
        </Section>

        <Section title={t("customers.need.title")} lead={t("customers.need.lead")}>
          <CheckList items={need} columns={1} />
        </Section>

        <Section title={t("customers.faqTitle")} tone="subtle">
          <FaqList items={faqItems} />
          <p className="mt-6 text-sm">
            <TextLink href="/faq">{t("common.allQuestions")}</TextLink>
          </p>
        </Section>

        <RelatedLinks
          title={t("common.keepReading")}
          links={[
            { href: "/cameroon", label: t("nav.cameroon"), body: t("country.lead") },
            { href: "/faq", label: t("nav.faq"), body: t("faq.lead") },
            { href: "/vendors", label: t("nav.vendors"), body: t("customers.sellToo") },
          ]}
        />

        <CtaBand
          title={t("customers.cta.title")}
          body={t("customers.cta.body")}
          finePrint={t("customers.cta.finePrint")}
          primary={{ href: waUrl, label: t("common.ctaCustomer") }}
          secondary={{ href: "/faq", label: t("common.ctaFaq") }}
        />
      </div>
    </>
  );
}
