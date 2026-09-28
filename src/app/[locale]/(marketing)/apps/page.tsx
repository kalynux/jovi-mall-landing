import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import { CardGrid, PageHeader, Section, StepList } from "@/components/marketing/parts";
import AppDownloadLinks from "@/components/apps/AppDownloadLinks";
import { APP_KEYS, APP_ROLE, APPS, androidVersionForSdk, formatAppSize } from "@/lib/apps/apps";
import { getAppReleases } from "@/lib/apps/apps.api";
import { breadcrumbJsonLd, mobileApplicationJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";

const PATH = "/apps";

/**
 * APP_RELEASE_REVALIDATE_SECONDS, so a new APK shows up within five minutes.
 * A literal because Next reads segment config statically.
 */
export const revalidate = 300;

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("apps.metaTitle"),
    description: t("apps.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("apps.metaTitle"),
      description: t("apps.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function AppsPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });
  const tApps = await getTranslations({ locale, namespace: "apps" });
  const format = await getFormatter({ locale });
  const releases = await getAppReleases();

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.apps"), path: PATH },
  ];

  const installSteps = [1, 2, 3, 4].map((i) => ({
    title: t(`apps.install.s${i}Title`),
    body: t(`apps.install.s${i}Body`),
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          ...APP_KEYS.flatMap((app) => {
            const release = releases[app];
            return release
              ? [
                  mobileApplicationJsonLd(locale, PATH, {
                    id: app,
                    name: APPS[app].name,
                    description: t(`apps.cards.${app}.body`),
                    downloadUrl: APPS[app].apkUrl,
                    version: release.versionName,
                    fileSize: formatAppSize(release.sizeBytes, "en"),
                    android: androidVersionForSdk(release.minSdk),
                  }),
                ]
              : [];
          }),
        ]}
      />

      <PageHeader
        eyebrow={t("apps.eyebrow")}
        title={t("apps.title")}
        lead={t("apps.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
      />

      <Section title={t("apps.listTitle")} lead={t("apps.listLead")}>
        <CardGrid columns={2}>
          {APP_KEYS.map((app) => {
            const release = releases[app];
            const android = release ? androidVersionForSdk(release.minSdk) : null;
            const facts = release
              ? [
                  { label: t("apps.facts.version"), value: release.versionName },
                  { label: t("apps.facts.size"), value: formatAppSize(release.sizeBytes, locale) },
                  ...(android
                    ? [{ label: t("apps.facts.requires"), value: tApps("requires", { version: android }) }]
                    : []),
                  ...(release.publishedAt
                    ? [
                        {
                          label: t("apps.facts.updated"),
                          value: format.dateTime(new Date(release.publishedAt), { dateStyle: "medium" }),
                        },
                      ]
                    : []),
                ]
              : [];

            return (
              <article
                key={app}
                id={app}
                className={`role-${APP_ROLE[app]} card flex scroll-mt-24 flex-col p-6 sm:p-7`}
              >
                <p className="tag self-start">{t(`apps.cards.${app}.for`)}</p>
                <h3 className="mt-3 font-display text-xl font-semibold text-[var(--text-primary)]">
                  {APPS[app].name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                  {t(`apps.cards.${app}.body`)}
                </p>

                {facts.length > 0 ? (
                  <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-5 sm:grid-cols-4">
                    {facts.map((fact) => (
                      <div key={fact.label}>
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
                          {fact.label}
                        </dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                          {fact.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-5 border-t border-[var(--border)] pt-5 text-sm text-[var(--text-muted)]">
                    {t("apps.facts.unavailable")}
                  </p>
                )}

                <AppDownloadLinks app={app} release={release} variant="buttons" className="mt-6" />

                {release?.sha256 && (
                  <details className="mt-5 text-xs text-[var(--text-muted)]">
                    <summary className="cursor-pointer select-none font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                      {t("apps.facts.checksum")}
                    </summary>
                    <code dir="ltr" className="mt-2 block break-all font-mono text-[11px] text-[var(--text-secondary)]">
                      {release.sha256}
                    </code>
                  </details>
                )}
              </article>
            );
          })}
        </CardGrid>
        <p className="mt-6 max-w-2xl text-sm text-[var(--text-muted)]">{tApps("storesNote")}</p>
      </Section>

      <Section title={t("apps.install.title")} lead={t("apps.install.lead")} tone="subtle">
        <StepList steps={installSteps} />
      </Section>
    </>
  );
}
