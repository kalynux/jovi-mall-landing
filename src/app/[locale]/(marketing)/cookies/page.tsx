import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import { CardGrid, CheckList, InfoCard, PageHeader, Prose, Section, TextLink } from "@/components/marketing/parts";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { SHARE_IMAGES } from "@/lib/seo/share";

const PATH = "/cookies";

/**
 * Bump this when the policy's substance changes, not for a typo. Adding any
 * non-essential cookie (analytics, ads) is also the point where CookieNotice
 * stops being enough: that needs a real opt-in before the script loads.
 */
const LAST_UPDATED = "2026-09-28";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("cookies.metaTitle"),
    description: t("cookies.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("cookies.metaTitle"),
      description: t("cookies.metaDescription"),
      url: localePath(locale, PATH),
      images: SHARE_IMAGES,
    },
  };
}

/**
 * Deliberately short. Everything Wi-Mall stores is needed for the site to
 * work, so there is nothing to choose and the page only has to say what is
 * kept and why.
 */
export default async function CookiesPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });
  const format = await getFormatter({ locale });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.cookies"), path: PATH },
  ];

  const stored = (["signIn", "preferences", "cart"] as const).map((key) => ({
    key,
    meta: t(`cookies.stored.${key}.where`),
    title: t(`cookies.stored.${key}.title`),
    body: t(`cookies.stored.${key}.body`),
  }));

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(locale, trail)]} />

      <PageHeader
        eyebrow={t("cookies.eyebrow")}
        title={t("cookies.title")}
        lead={t("cookies.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
      />

      <Section title={t("cookies.stored.title")}>
        <CardGrid columns={3}>
          {stored.map((item) => (
            <InfoCard key={item.key} meta={item.meta} title={item.title} body={item.body} />
          ))}
        </CardGrid>
      </Section>

      <Section title={t("cookies.never.title")} tone="subtle">
        <CheckList
          columns={1}
          items={[t("cookies.never.ads"), t("cookies.never.tracking"), t("cookies.never.selling")]}
        />
      </Section>

      <Section title={t("cookies.more.title")}>
        <Prose paragraphs={[t("cookies.more.google"), t("cookies.more.clear"), t("cookies.more.changes")]} />
        <p className="mt-6 max-w-2xl text-sm text-[var(--text-muted)]">
          {t("cookies.more.updated", {
            date: format.dateTime(new Date(LAST_UPDATED), { dateStyle: "long", timeZone: "UTC" }),
          })}{" "}
          <TextLink href="/contact">{t("cookies.more.contact")}</TextLink>
        </p>
      </Section>
    </>
  );
}
