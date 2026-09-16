import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import { CtaBand, Section } from "@/components/marketing/parts";
import ArticleBody from "@/components/blog/ArticleBody";
import ArticleMeta from "@/components/blog/ArticleMeta";
import AuthorCard, { AuthorByline } from "@/components/blog/AuthorCard";
import CoverArt from "@/components/blog/CoverArt";
import { ArticleGrid } from "@/components/blog/parts";
import ReadingProgress from "@/components/blog/ReadingProgress";
import ShareRow from "@/components/blog/ShareRow";
import TableOfContents, { tocEntries } from "@/components/blog/TableOfContents";
import { blogPostingJsonLd, breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/jsonld";
import { variantAlternates } from "@/lib/seo/alternates";
import { absoluteUrl } from "@/lib/site";
import { isLocale, localePath, type Locale } from "@/i18n/routing";
import { BLOG_ROOT, articlePath, categoryPath } from "@/lib/blog/blog.routes";
import { blogRobots } from "@/lib/blog/blog.seo";
import { categorySlugFor } from "@/lib/blog/blog.categories";
import {
  getAdjacentArticles,
  getArticle,
  getCategoryBySlug,
  getRelatedArticles,
  listArticleParams,
} from "@/lib/blog/blog.api";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

/**
 * Every (locale, slug) pair that exists at build time — and, because the pairs
 * include the parent's `locale`, *only* those.
 *
 * Returning `{ slug }` alone would let Next cross the slugs with all five
 * locales and prerender `/pt/blog/how-to-sell-on-whatsapp-without-a-website`,
 * an English article at a Portuguese URL. The article's translations are the
 * routes; there is no product of the two sets.
 */
export async function generateStaticParams() {
  return listArticleParams();
}

/**
 * An article published after the last deploy renders on first request and is
 * cached from then on.
 *
 * This was `false` while articles were a compile-time fixture, where an unknown
 * slug could only be a typo. With a CMS behind it that would mean an article
 * published at 10am 404s until someone deploys — so the enumeration above is
 * now a warm-start list, not the set of valid URLs.
 */
export const dynamicParams = true;

/** Matches the endpoint's own `max-age=300`. See BLOG_REVALIDATE_SECONDS. */
export const revalidate = 300;

/**
 * Resolves the article or leaves the route.
 *
 * A retired slug is a `404` carrying the current one, and an archived article
 * a `410` carrying its category — because the API can only redirect its own
 * URL, and the URL that needs the permanent redirect is this page. Both are
 * handled here rather than in the page body so that `generateMetadata` cannot
 * emit a canonical for an address the page is about to redirect away from.
 */
async function resolveOrRedirect(locale: Locale, slug: string) {
  const result = await getArticle(locale, slug);

  switch (result.status) {
    case "ok":
      return result.article;
    // The three cases below never fall through: permanentRedirect() and
    // notFound() both return `never`, which is why none of them needs a break.
    case "moved":
      // 308, and to the *localized* path — this article's other translations
      // keep their own slugs and are not affected.
      permanentRedirect(localePath(locale, articlePath(result.slug)));
    case "gone": {
      // A redirect to the hub keeps whatever inbound links the article had,
      // which a bare 410 would discard. `api-doc` allows either.
      //
      // But the hub 404s when it is empty in this locale — and an archived
      // article is often the last one in its category, which is exactly when
      // that happens. Redirecting there would turn a recoverable 410 into a
      // redirect to a 404, so an empty hub falls back to the blog index.
      const hubSlug = categorySlugFor(result.categoryKey);
      const hub = await getCategoryBySlug(locale, hubSlug);
      permanentRedirect(
        localePath(locale, hub && hub.count > 0 ? categoryPath(hubSlug) : BLOG_ROOT)
      );
    }
    default:
      notFound();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const article = await resolveOrRedirect(locale, slug);

  return {
    title: article.metaTitle,
    description: article.excerpt,
    // Per-article rather than sitewide: this post exists in the languages it
    // has been translated into, not in all five.
    alternates: variantAlternates(locale, article.pathByLocale),
    robots: blogRobots(),
    authors: [{ name: article.author.name }],
    openGraph: {
      type: "article",
      title: article.metaTitle,
      description: article.excerpt,
      url: localePath(locale, articlePath(article.slug)),
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      authors: [article.author.name],
      section: article.category.label,
      ...(article.cover ? { images: [{ url: article.cover.url, alt: article.cover.alt }] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const article = await resolveOrRedirect(locale, slug);

  const t = await getTranslations({ locale, namespace: "pages" });
  const tb = await getTranslations({ locale, namespace: "pages.blog" });

  const [related, adjacent] = await Promise.all([
    getRelatedArticles(locale, article),
    getAdjacentArticles(locale, article),
  ]);

  const path = articlePath(article.slug);
  const url = absoluteUrl(localePath(locale, path));
  const entries = tocEntries(article.body);
  const readingLabel = tb("readTime", { minutes: article.readingMinutes });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.blog"), path: BLOG_ROOT },
    { name: article.category.label, path: categoryPath(article.category.slug) },
    { name: article.title, path },
  ];

  // Questions authored as `faq` blocks, lifted into structured data. These do
  // not collide with the site's FAQPage on /faq the way a role page quoting the
  // same three questions would — an article's questions are its own, asked
  // nowhere else on the site.
  const faqItems = article.body.flatMap((block) => (block.type === "faq" ? block.items : []));

  const shareLabels = {
    share: tb("share.label"),
    whatsapp: tb("share.whatsapp"),
    x: tb("share.x"),
    linkedin: tb("share.linkedin"),
    copy: tb("share.copy"),
    copied: tb("share.copied"),
  };

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd(locale, trail),
          blogPostingJsonLd(locale, {
            path,
            title: article.title,
            excerpt: article.excerpt,
            publishedAt: article.publishedAt,
            updatedAt: article.updatedAt,
            wordCount: article.wordCount,
            section: article.category.label,
            author: article.author,
            cover: article.cover,
          }),
          ...(faqItems.length
            ? [
                faqPageJsonLd(
                  locale,
                  path,
                  faqItems.map((item) => ({ question: item.question, answer: item.answer }))
                ),
              ]
            : []),
        ]}
      />

      <ReadingProgress targetId="article-body" />

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className={`relative overflow-hidden border-b border-[var(--border)] ${article.category.accent}`}>
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% -10%, color-mix(in srgb, var(--role) 15%, transparent), transparent 70%)",
          }}
        />
        <div className="container-xl relative z-10 px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-14 lg:pt-12">
          <Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />

          <div className="mt-6 max-w-3xl">
            <Link
              href={categoryPath(article.category.slug)}
              className="tag transition-opacity hover:opacity-80"
            >
              {article.category.label}
            </Link>

            <h1 className="mt-4 font-display text-3xl font-bold leading-[1.12] tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
              {article.title}
            </h1>

            <p className="mt-5 text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
              {article.excerpt}
            </p>

            {/* Stacks on a phone; the byline and the share row sit on one line
                once there is room for both. */}
            <div className="mt-7 flex flex-col gap-5 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <AuthorByline author={article.author} />
                <span aria-hidden="true" className="h-8 w-px bg-[var(--border)]" />
                <ArticleMeta
                  locale={locale}
                  publishedAt={article.publishedAt}
                  readingLabel={readingLabel}
                />
              </div>
              <ShareRow url={url} title={article.title} labels={shareLabels} />
            </div>
          </div>
        </div>
      </header>

      {/* ─── Cover ──────────────────────────────────────────────────────── */}
      <div className="container-xl px-4 pt-8 sm:px-6 lg:px-8">
        <div className={`overflow-hidden rounded-2xl border border-[var(--border)] ${article.category.accent}`}>
          {/* Plain <img> — no article ships a cover yet; see ArticleCard. */}
          {article.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.cover.url}
              alt={article.cover.alt}
              width={article.cover.width}
              height={article.cover.height}
              className="aspect-[16/9] w-full object-cover lg:aspect-[21/9]"
              
            />
          ) : (
            <CoverArt seed={article.id} variant="hero" className="aspect-[16/9] w-full lg:aspect-[21/9]" />
          )}
        </div>
      </div>

      {/* ─── Body + contents ────────────────────────────────────────────── */}
      <div className="container-xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-14">
          {/* First in the DOM so the collapsed contents list sits above the
              article on a phone; `order` moves it into the rail from lg, where
              grid stretch gives the sticky child a column to stick inside. */}
          <div className="lg:order-2">
            <TableOfContents entries={entries} label={tb("tocLabel")} />
          </div>

          <div className="min-w-0 lg:order-1">
            {/* The id ReadingProgress measures. */}
            <article id="article-body">
              <ArticleBody body={article.body} />
            </article>

            <div className="mt-10 flex flex-col gap-6 border-t border-[var(--border)] pt-8">
              <ShareRow url={url} title={article.title} labels={shareLabels} />
              <AuthorCard author={article.author} label={tb("authorLabel")} />
            </div>

            {/* Prev/next in this locale's reading order. Present only when
                there is one — an empty half would read as a broken link. */}
            {(adjacent.previous || adjacent.next) && (
              <nav
                aria-label={tb("moreArticles")}
                className="mt-8 grid gap-4 border-t border-[var(--border)] pt-8 sm:grid-cols-2"
              >
                {adjacent.previous ? (
                  <Link
                    href={articlePath(adjacent.previous.slug)}
                    className={`card group flex flex-col gap-1.5 p-5 ${adjacent.previous.category.accent}`}
                  >
                    <span className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      ← {tb("previous")}
                    </span>
                    <span className="font-display text-sm font-semibold leading-snug text-[var(--text-primary)] transition-colors group-hover:text-role">
                      {adjacent.previous.title}
                    </span>
                  </Link>
                ) : (
                  <span aria-hidden="true" className="hidden sm:block" />
                )}
                {adjacent.next && (
                  <Link
                    href={articlePath(adjacent.next.slug)}
                    className={`card group flex flex-col items-end gap-1.5 p-5 text-end ${adjacent.next.category.accent}`}
                  >
                    <span className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {tb("next")} →
                    </span>
                    <span className="font-display text-sm font-semibold leading-snug text-[var(--text-primary)] transition-colors group-hover:text-role">
                      {adjacent.next.title}
                    </span>
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <Section title={tb("related")} tone="subtle">
          <ArticleGrid articles={related} />
        </Section>
      )}

      <CtaBand
        title={tb("cta.title")}
        body={tb("cta.body")}
        finePrint={tb("cta.finePrint")}
        primary={{ href: "/register?role=vendor", label: t("common.ctaVendor") }}
        primaryRole="vendor"
        secondary={{ href: BLOG_ROOT, label: tb("backToBlog") }}
      />
    </>
  );
}
