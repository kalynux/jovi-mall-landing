import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import {
  CtaBand,
  PageHeader,
  Prose,
  Section,
  TextLink,
} from "@/components/marketing/parts";
import { breadcrumbJsonLd, serviceAreaJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { CITIES, cityPath, findCity, findRegion } from "@/lib/marketing/geo";

type PageProps = { params: Promise<{ locale: string; city: string }> };

/**
 * Prerenders every city in the registry, in every locale. Combined with the
 * parent [locale] segment's own params, that is 5 cities × 5 languages — small
 * enough to build statically, which is what makes these cheap to serve on the
 * connections they are written for.
 */
export function generateStaticParams() {
  return CITIES.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, city: slug } = await params;
  if (!isLocale(locale)) notFound();
  const city = findCity(slug);
  if (!city) notFound();

  const t = await getTranslations({ locale, namespace: "pages" });
  const region = t(`regions.${city.region}`);
  const path = cityPath(city.slug);

  return {
    title: t("city.metaTitlePattern", { city: city.name }),
    description: t("city.metaDescriptionPattern", { city: city.name, region }),
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: t("city.metaTitlePattern", { city: city.name }),
      description: t("city.metaDescriptionPattern", { city: city.name, region }),
      url: localePath(locale, path),
    },
  };
}

export default async function CityPage({ params }: PageProps) {
  const { locale, city: slug } = await params;
  if (!isLocale(locale)) notFound();
  const city = findCity(slug);
  if (!city) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });
  const region = t(`regions.${city.region}`);
  const path = cityPath(city.slug);

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.cameroon"), path: "/cameroon" },
    { name: city.name, path },
  ];

  const others = CITIES.filter((other) => other.slug !== city.slug);
  const regionTowns = findRegion(city.region).towns;

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          serviceAreaJsonLd(
            locale,
            path,
            { type: "City", name: city.name, containedIn: region },
            {
              name: t("city.metaTitlePattern", { city: city.name }),
              description: t("city.metaDescriptionPattern", { city: city.name, region }),
            }
          ),
        ]}
      />

      <PageHeader
        eyebrow={t("city.eyebrowPattern", { city: city.name })}
        title={t("city.titlePattern", { city: city.name })}
        lead={t(`cities.${city.slug}.lead`)}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
        aside={
          <dl className="rounded-2xl border border-[var(--border)] bg-[var(--surface-glass)] p-4">
            <dt className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {t("city.regionLabel")}
            </dt>
            <dd className="mt-1 font-display text-lg font-semibold text-[var(--text-primary)]">
              {region}
            </dd>
          </dl>
        }
      />

      {/* The city-specific half: what is true about commerce here, and why it
          changes the calculation. Everything below it is the platform answer. */}
      <Section title={t("city.contextTitle", { city: city.name })}>
        <Prose paragraphs={[t(`cities.${city.slug}.context`), t(`cities.${city.slug}.angle`)]} />
      </Section>

      <Section title={t("city.sellingTitle", { city: city.name })} tone="subtle">
        <Prose paragraphs={[t("city.sellingP1"), t("city.sellingP2")]} />
        <p className="mt-5 text-sm">
          <TextLink href="/vendors">{t("nav.vendors")}</TextLink>
        </p>
      </Section>

      <Section title={t("city.deliveryTitle", { city: city.name })}>
        <Prose
          paragraphs={[
            t("city.deliveryP1", { city: city.name, region }),
            t("city.deliveryP2"),
          ]}
        />
      </Section>

      <Section title={t("city.opportunityTitle", { city: city.name })} tone="subtle">
        <Prose paragraphs={[t("city.opportunityBody", { region })]} />
        {/* Coverage is registered per region, so the towns beside this city are
            part of the same registration — a real statement about reach rather
            than a keyword list. */}
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          {t("city.regionReach", {
            region,
            towns: regionTowns.join(", "),
          })}
        </p>
        <p className="mt-5 text-sm">
          <TextLink href="/agencies">{t("nav.agencies")}</TextLink>
        </p>
      </Section>

      <Section title={t("city.relatedTitle")}>
        <ul className="flex flex-wrap gap-3">
          {others.map((other) => (
            <li key={other.slug}>
              <Link
                href={cityPath(other.slug)}
                className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-primary-400 hover:text-[var(--text-primary)]"
              >
                {other.name}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/cameroon"
              className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-primary-400 hover:text-[var(--text-primary)]"
            >
              {t("nav.cameroon")}
            </Link>
          </li>
        </ul>
      </Section>

      <CtaBand
        title={t("city.ctaTitle", { city: city.name })}
        body={t("city.ctaBody")}
        finePrint={t("city.ctaFinePrint")}
        primary={{ href: "/register?role=vendor", label: t("common.ctaVendor") }}
        primaryRole="vendor"
        secondary={{ href: "/pricing", label: t("common.ctaPricing") }}
      />
    </>
  );
}
