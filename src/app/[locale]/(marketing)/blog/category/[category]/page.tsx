import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import { CtaBand, PageHeader, Section } from "@/components/marketing/parts";
import { ArticleGrid, CategoryChips } from "@/components/blog/parts";
import { blogJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { variantAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { BLOG_ROOT, articlePath, categoryPath } from "@/lib/blog/blog.routes";
import { blogRobots } from "@/lib/blog/blog.seo";
import {
  categoryPathByLocale,
  getCategoryBySlug,
  listArticles,
  listCategories,
  listCategoryParams,
} from "@/lib/blog/blog.api";

type PageProps = { params: Promise<{ locale: string; category: string }> };

/**
 * Only the (locale, category) pairs that have articles in them.
 *
 * Includes the parent's `locale` for the same reason the article route does:
 * crossing five locales with every category would prerender hubs that are empty
 * in four of them.
 */
export async function generateStaticParams() {
  return listCategoryParams();
}

/**
 * A hub that gains its first article after the last deploy resolves on demand.
 *
 * The `count === 0` guard below is what still 404s a genuinely empty hub, so
 * this does not reopen the thin-page problem — it just stops the answer being
 * frozen at build time. See the note on the article route.
 */
export const dynamicParams = true;

/** Matches the endpoint's own `max-age=300`. */
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, category: slug } = await params;
  if (!isLocale(locale)) notFound();

  const category = await getCategoryBySlug(locale, slug);
  if (!category || category.count === 0) notFound();

  const t = await getTranslations({ locale, namespace: "pages" });
  const title = t("blog.category.metaTitlePattern", { category: category.label });
  const description = t("blog.category.metaDescriptionPattern", { category: category.label });

  return {
    title,
    description,
    // A category hub exists in the locales where it is not empty, which is not
    // necessarily all five — so the per-variant builder, not localeAlternates.
    alternates: variantAlternates(locale, await categoryPathByLocale(category.slug)),
    robots: blogRobots(),
    openGraph: {
      type: "website",
      title,
      description,
      url: localePath(locale, categoryPath(category.slug)),
    },
  };
}

export default async function BlogCategoryPage({ params }: PageProps) {
  const { locale, category: slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const category = await getCategoryBySlug(locale, slug);
  if (!category || category.count === 0) notFound();

  const t = await getTranslations({ locale, namespace: "pages" });

  const [articles, categories] = await Promise.all([
    listArticles(locale, { category: category.key }),
    listCategories(locale),
  ]);

  const path = categoryPath(category.slug);
  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.blog"), path: BLOG_ROOT },
    { name: category.label, path },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          blogJsonLd(
            locale,
            path,
            {
              name: t("blog.category.titlePattern", { category: category.label }),
              description: t("blog.category.metaDescriptionPattern", { category: category.label }),
            },
            articles.map((article) => ({
              path: articlePath(article.slug),
              title: article.title,
              publishedAt: article.publishedAt,
            }))
          ),
        ]}
      />

      <PageHeader
        accent={category.accent}
        eyebrow={t("nav.blog")}
        title={t("blog.category.titlePattern", { category: category.label })}
        lead={t(`blog.category.leads.${category.key}`)}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
      />

      <Section>
        <CategoryChips
          categories={categories}
          activeSlug={category.slug}
          allLabel={t("blog.allArticles")}
        />
        <div className="mt-8">
          <ArticleGrid articles={articles} headingLevel="h2" />
        </div>
      </Section>

      <CtaBand
        title={t("blog.cta.title")}
        body={t("blog.cta.body")}
        finePrint={t("blog.cta.finePrint")}
        primary={{ href: "/register?role=vendor", label: t("common.ctaVendor") }}
        primaryRole="vendor"
        secondary={{ href: BLOG_ROOT, label: t("blog.backToBlog") }}
      />
    </>
  );
}
