import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import BlogIllustration from "@/components/illustrations/BlogIllustration.generated";
import { CtaBand, PageHeader, RelatedLinks, Section } from "@/components/marketing/parts";
import ArticleCard from "@/components/blog/ArticleCard";
import { ArticleGrid, CategoryChips, EmptyArticleList } from "@/components/blog/parts";
import { blogJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath, type Locale } from "@/i18n/routing";
import { BLOG_ROOT, articlePath } from "@/lib/blog/blog.routes";
import { blogRobots } from "@/lib/blog/blog.seo";
import {
  getFeaturedArticle,
  listArticles,
  listCategories,
  localesWithArticles,
} from "@/lib/blog/blog.api";

const PATH = BLOG_ROOT;

/**
 * Matches the endpoint's own `max-age=300`, so a newly published article shows
 * up on the index within five minutes plus this window rather than at the next
 * deploy.
 */
export const revalidate = 300;

type PageProps = { params: Promise<{ locale: string }> };

/**
 * The index exists in all five locales even where there are no articles yet.
 *
 * A 404 would be wrong — /pt/blog is a real page that will have content, and it
 * is linked from the footer of every Portuguese page, so 404ing it would put a
 * broken link on every page of the site. The empty state offers the languages
 * that do have articles instead, which is the only useful answer.
 *
 * `localeAlternates` rather than the per-article variant: the index itself does
 * exist in all five, whatever its contents.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("blog.metaTitle"),
    description: t("blog.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    robots: blogRobots(),
    openGraph: {
      type: "website",
      title: t("blog.metaTitle"),
      description: t("blog.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const [articles, categories] = await Promise.all([listArticles(locale), listCategories(locale)]);
  const featured = await getFeaturedArticle(locale);
  const rest = articles.filter((article) => article.id !== featured?.id);

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.blog"), path: PATH },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          blogJsonLd(
            locale,
            PATH,
            { name: t("blog.title"), description: t("blog.metaDescription") },
            articles.map((article) => ({
              path: articlePath(article.slug),
              title: article.title,
              publishedAt: article.publishedAt,
            }))
          ),
        ]}
      />

      <PageHeader
        eyebrow={t("blog.eyebrow")}
        title={t("blog.title")}
        lead={t("blog.lead")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
        illustration={<BlogIllustration />}
      />

      <Section>
        {articles.length === 0 ? (
          <EmptyLocaleState locale={locale} />
        ) : (
          <>
            <CategoryChips categories={categories} allLabel={t("blog.allArticles")} />

            {featured && (
              <div className="mt-8">
                <ArticleCard article={featured} variant="featured" headingLevel="h2" />
              </div>
            )}

            {rest.length > 0 && (
              <div className="mt-12">
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  {t("blog.latest")}
                </h2>
                <div className="mt-5">
                  <ArticleGrid articles={rest} />
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      <RelatedLinks
        title={t("common.keepReading")}
        links={[
          { href: "/pricing", label: t("nav.pricing"), body: t("pricing.lead") },
          { href: "/vendors", label: t("nav.vendors"), body: t("vendors.lead") },
          { href: "/faq", label: t("nav.faq"), body: t("faq.lead") },
        ]}
      />

      <CtaBand
        title={t("blog.cta.title")}
        body={t("blog.cta.body")}
        finePrint={t("blog.cta.finePrint")}
        primary={{ href: "/register?role=vendor", label: t("common.ctaVendor") }}
        primaryRole="vendor"
        secondary={{ href: "/pricing", label: t("common.ctaPricing") }}
      />
    </>
  );
}

/**
 * Shown when this locale has no articles.
 *
 * Language names come from `Intl.DisplayNames` rather than a message key per
 * language per locale — that would be 25 strings to say "English" and "French"
 * in five languages, all of which the platform already knows.
 */
async function EmptyLocaleState({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "pages.blog" });
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const available = (await localesWithArticles()).filter((code) => code !== locale);

  return (
    <EmptyArticleList title={t("empty.title")} body={t("empty.body")}>
      {available.map((code) => (
        <Link
          key={code}
          href={BLOG_ROOT}
          // Switches language as well as route — the whole point of the link.
          locale={code}
          hrefLang={code}
          lang={code}
          className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-primary-400 hover:text-[var(--text-primary)]"
        >
          {t("empty.readIn", { language: names.of(code) ?? code })}
        </Link>
      ))}
    </EmptyArticleList>
  );
}
