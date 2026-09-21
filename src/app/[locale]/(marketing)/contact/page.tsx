import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import ContactIllustration from "@/components/illustrations/ContactIllustration.generated";
import EmbeddedForm from "@/components/marketing/EmbeddedForm";
import {
  CardGrid,
  InfoCard,
  PageHeader,
  Prose,
  RelatedLinks,
  Section,
  TextLink,
} from "@/components/marketing/parts";
import { breadcrumbJsonLd, contactPageJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { contactFormUrl } from "@/lib/marketing/forms";
import { BRAND, EXTERNAL_LINKS, SOCIAL_LINKS, buildWhatsAppUrl } from "@/lib/constants";

const PATH = "/contact";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("contact.metaTitle"),
    description: t("contact.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("contact.metaTitle"),
      description: t("contact.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.contact"), path: PATH },
  ];

  // This used to be `Boolean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER)`, because
  // `BRAND.whatsappNumber` was the `+2340000000000` placeholder and publishing a
  // number that reaches nobody, on the page whose entire job is being reachable,
  // is worse than publishing one fewer channel. The fallback is now the real bot
  // line, so the env var only overrides it and the gate had become a way to hide
  // a working channel from any deploy that relied on the default.
  const whatsappConfigured = Boolean(EXTERNAL_LINKS.whatsappNumber);
  const waUrl = buildWhatsAppUrl(t("contact.channels.whatsappMessage"));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          contactPageJsonLd(locale, PATH, t("contact.metaDescription")),
        ]}
      />

      <PageHeader
        eyebrow={t("contact.eyebrow")}
        title={t("contact.title")}
        lead={t("contact.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
        illustration={<ContactIllustration />}
      />

      <Section title={t("contact.before.title")} lead={t("contact.before.lead")}>
        <Prose paragraphs={[t("contact.before.p1"), t("contact.before.p2")]} />
        <p className="mt-5 text-sm">
          <TextLink href="/faq">{t("common.allQuestions")}</TextLink>
        </p>
      </Section>

      <Section title={t("contact.form.title")} lead={t("contact.form.lead")} tone="subtle">
        <EmbeddedForm
          src={contactFormUrl(locale)}
          title={t("contact.form.frameTitle")}
          note={t("contact.form.note")}
          fallbackLabel={t("common.openFormNewTab")}
        />
      </Section>

      <Section title={t("contact.channels.title")} lead={t("contact.channels.lead")}>
        <CardGrid columns={whatsappConfigured ? 3 : 2}>
          <InfoCard
            title={t("contact.channels.emailTitle")}
            body={t("contact.channels.emailBody", { email: BRAND.email })}
          />
          {whatsappConfigured && (
            <InfoCard
              title={t("contact.channels.whatsappTitle")}
              body={t("contact.channels.whatsappBody")}
            />
          )}
          <InfoCard
            title={t("contact.channels.roleTitle")}
            body={t("contact.channels.roleBody")}
          />
        </CardGrid>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a
            href={`mailto:${BRAND.email}`}
            className="font-semibold text-role underline decoration-[color-mix(in_srgb,var(--role)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--role)]"
          >
            {BRAND.email}
          </a>
          {whatsappConfigured && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-role underline decoration-[color-mix(in_srgb,var(--role)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--role)]"
            >
              {EXTERNAL_LINKS.whatsappNumber}
            </a>
          )}
          {SOCIAL_LINKS.map(({ network, url }) => (
            <a
              key={network}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-role underline decoration-[color-mix(in_srgb,var(--role)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--role)]"
            >
              {network}
            </a>
          ))}
        </div>
      </Section>

      <RelatedLinks
        title={t("common.keepReading")}
        links={[
          { href: "/faq", label: t("nav.faq"), body: t("faq.lead") },
          { href: "/about", label: t("nav.about"), body: t("about.lead") },
          { href: "/careers", label: t("nav.careers"), body: t("careers.relatedBody") },
        ]}
      />
    </>
  );
}
