import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import LandingPage from "@/components/LandingPage";
import JsonLd from "@/components/seo/JsonLd";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale } from "@/i18n/routing";

type PageProps = { params: Promise<{ locale: string }> };

// Title/description/OG are inherited from the layout, which describes this page
// in the request's language. Only the canonical + hreflang set belongs here.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return { alternates: localeAlternates(locale, "/") };
}

export default async function Home({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
      <LandingPage />
    </>
  );
}
