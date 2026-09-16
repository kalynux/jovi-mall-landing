/**
 * The blog, read from the public API. Contract: `api-doc/public/articles.md`.
 *
 * Every function takes a locale and returns already-resolved data, so no page
 * or component knows that translations exist — that was the point of the layer
 * while it read fixtures, and it is why swapping to `fetch` touched nothing
 * above it.
 *
 * `server-only` because these pages are prerendered and the copy must be in the
 * served HTML: an article fetched in the browser is an article a crawler never
 * reads. The guard turns a mistaken client import into a build error rather
 * than a silently unindexable page.
 */
import "server-only";
import { getTranslations } from "next-intl/server";
import { describeFetchError, fetchWithRetry } from "@/lib/build-fetch";
import { LOCALE_CODES, localePath, type Locale } from "@/i18n/routing";
import { articlePath, categoryPath } from "./blog.routes";
import { readingMinutes } from "./blog.format";
import { BLOG_CATEGORIES, findCategory } from "./blog.categories";
import { BLOG_IS_PLACEHOLDER } from "./blog.seo";
import type {
  ArticleSummary,
  Block,
  CategoryKey,
  ResolvedArticle,
  ResolvedAuthor,
  ResolvedCategory,
} from "./blog.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8022";

/** Matches the endpoints' own `Cache-Control: public, max-age=300`. */
export const BLOG_REVALIDATE_SECONDS = 300;

/**
 * The list endpoint's ceiling, and ours for the two reads that need the whole
 * ordered sequence rather than a page of it (prev/next, and the index's
 * feature pick). Past 100 articles in one locale those two need a real
 * windowing parameter from the API — see the note on `getAdjacentArticles`.
 */
const MAX_PAGE = 100;

/* ─── Wire types ──────────────────────────────────────────────────────────── */

/**
 * What the API actually sends, kept separate from the domain types.
 *
 * Two shapes differ from ours on purpose and are normalised at this boundary:
 * `metaTitle`/`updatedAt` are **omitted** when unset (matching our `?:`), while
 * `cover` and `author.avatarUrl` are explicit `null`, because "no cover" is a
 * state the card renders rather than an absent field.
 */
type ApiAuthor = {
  id: string;
  name: string;
  type: "Person" | "Organization";
  title: string;
  bio: string;
  avatarUrl: string | null;
};

type ApiCover = { url: string; alt: string; width: number; height: number } | null;

type ApiSummary = {
  id: string;
  locale: Locale;
  slug: string;
  title: string;
  metaTitle?: string;
  excerpt: string;
  categoryKey: string;
  author: ApiAuthor;
  publishedAt: string;
  updatedAt?: string;
  featured: boolean;
  cover: ApiCover;
  wordCount: number;
  availableLocales: Locale[];
};

type ApiDetail = ApiSummary & { body: Block[] };

type ApiIndexRow = {
  id: string;
  categoryKey: string;
  publishedAt: string;
  updatedAt?: string;
  translations: { locale: Locale; slug: string }[];
};

type ApiError = {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
};

/* ─── Transport ───────────────────────────────────────────────────────────── */

/**
 * A build that cannot reach the blog API fails, rather than publishing an empty
 * blog.
 *
 * The same call `lib/marketing/plans.api.ts` makes, for the same reason: an
 * outage and "no articles yet" render identically, so a soft failure would ship
 * a blog with nothing in it and no signal that anything went wrong. The build
 * already requires this backend for /pricing, so this adds no new constraint.
 */
class BlogApiError extends Error {
  constructor(url: string, cause: string) {
    super(
      `Could not read the blog API at ${url}: ${cause}. The blog pages have no ` +
        `fallback content — a build that cannot reach the API must fail rather than ` +
        `publish an empty blog, which is indistinguishable from one nobody has ` +
        `written for yet. Check NEXT_PUBLIC_API_URL and that the API is reachable.`
    );
    this.name = "BlogApiError";
  }
}

type Envelope<T> = { success?: boolean; data?: T; error?: ApiError };

async function request<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  const url = `${API_BASE}${path}`;
  let res: Response;

  try {
    res = await fetchWithRetry(url, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS },
      // The 404 that says "this slug moved" carries the new slug in its body,
      // so an error response is data here, not just a status to react to.
      headers: { accept: "application/json" },
    });
  } catch (error) {
    throw new BlogApiError(url, describeFetchError(error));
  }

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new BlogApiError(url, `HTTP ${res.status} with a non-JSON body`);
  }

  if (body.success === true && body.data !== undefined) return { ok: true, data: body.data };
  if (body.success === false && body.error) return { ok: false, error: body.error };

  throw new BlogApiError(url, `HTTP ${res.status}: response was not a { success, data } envelope`);
}

/** For the reads where any error is a broken build, not a routing outcome. */
async function getJson<T>(path: string): Promise<T> {
  const result = await request<T>(path);
  if (!result.ok) {
    throw new BlogApiError(`${API_BASE}${path}`, `${result.error.code} (${result.error.statusCode})`);
  }
  return result.data;
}

/* ─── The route index ─────────────────────────────────────────────────────── */

/**
 * `GET /api/public/articles/index` — every `(locale, slug)` pair plus dates,
 * unpaginated and in the same order as the list.
 *
 * This one response powers everything that needs to *enumerate* rather than
 * display: `generateStaticParams`, the sitemap, the category counts, and the
 * per-article hreflang set. One cached request instead of five paginated ones.
 */
async function fetchIndex(): Promise<ApiIndexRow[]> {
  return getJson<ApiIndexRow[]>("/api/public/articles/index");
}

/* ─── Resolution ──────────────────────────────────────────────────────────── */

function resolveAuthor(author: ApiAuthor): ResolvedAuthor {
  return {
    id: author.id,
    name: author.name,
    type: author.type,
    // `null` is how the API says "unset"; our type says `?:`.
    avatarUrl: author.avatarUrl ?? undefined,
    title: author.title,
    bio: author.bio,
  };
}

type CategoryLabels = Record<CategoryKey, string>;

async function categoryLabels(locale: Locale): Promise<CategoryLabels> {
  const t = await getTranslations({ locale, namespace: "pages.blog.categories" });
  return Object.fromEntries(
    BLOG_CATEGORIES.map((category) => [category.key, t(category.key)])
  ) as CategoryLabels;
}

function resolveCategory(
  key: string,
  labels: CategoryLabels,
  counts: Record<CategoryKey, number>
): ResolvedCategory {
  const category = findCategory(key);
  return { ...category, label: labels[category.key], count: counts[category.key] ?? 0 };
}

function toSummary(
  item: ApiSummary,
  labels: CategoryLabels,
  counts: Record<CategoryKey, number>
): ArticleSummary {
  return {
    id: item.id,
    locale: item.locale,
    slug: item.slug,
    title: item.title,
    // Falls back to the headline so an article without an explicit SEO title
    // still has one rather than an empty <title>.
    metaTitle: item.metaTitle ?? item.title,
    excerpt: item.excerpt,
    category: resolveCategory(item.categoryKey, labels, counts),
    author: resolveAuthor(item.author),
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
    featured: item.featured,
    cover: item.cover ?? undefined,
    wordCount: item.wordCount,
    // Computed here, never sent: an editor's estimate drifts the moment the
    // article is revised. `wordCount` is derived on write, so this cannot.
    readingMinutes: readingMinutes(item.wordCount),
  };
}

/* ─── Counts ──────────────────────────────────────────────────────────────── */

/**
 * Per-locale, from the index.
 *
 * A category with three English articles and one French one reports 3 on /blog
 * and 1 on /fr/blog. Reporting the total would promise a French reader two
 * articles they cannot open.
 */
function countsFrom(index: ApiIndexRow[], locale: Locale): Record<CategoryKey, number> {
  const counts = Object.fromEntries(
    BLOG_CATEGORIES.map((category) => [category.key, 0])
  ) as Record<CategoryKey, number>;

  for (const row of index) {
    if (!row.translations.some((translation) => translation.locale === locale)) continue;
    counts[findCategory(row.categoryKey).key] += 1;
  }

  return counts;
}

/* ─── Public reads ────────────────────────────────────────────────────────── */

export type ListOptions = {
  category?: CategoryKey;
  /** Article `id` to leave out — for "related articles" on a detail page. */
  excludeId?: string;
  limit?: number;
};

/**
 * `GET /api/public/articles` — summaries for this locale, newest first.
 *
 * The order is the API's (`publishedAt` descending, article id as tie-break)
 * and is deliberately not re-sorted here: the list, the index and the prev/next
 * links are three views of one sequence, and a second sort on this side is how
 * they drift apart.
 *
 * `excludeId` has no API equivalent, so it is applied after fetching — one
 * extra row is requested to cover the removal.
 */
export async function listArticles(
  locale: Locale,
  options: ListOptions = {}
): Promise<ArticleSummary[]> {
  const limit = options.limit ?? MAX_PAGE;
  const params = new URLSearchParams({ locale });
  // The API takes the category *key*; the slug in the URL is ours alone.
  if (options.category) params.set("category", options.category);
  params.set("limit", String(Math.min(MAX_PAGE, options.excludeId ? limit + 1 : limit)));

  const [payload, index] = await Promise.all([
    getJson<{ items: ApiSummary[]; total: number }>(`/api/public/articles?${params}`),
    fetchIndex(),
  ]);

  const labels = await categoryLabels(locale);
  const counts = countsFrom(index, locale);

  return payload.items
    .filter((item) => item.id !== options.excludeId)
    .slice(0, limit)
    .map((item) => toSummary(item, labels, counts));
}

/**
 * The article the index leads with.
 *
 * Falls back to the newest when nothing is flagged, so the layout never has a
 * hole in it and flagging a feature stays an editorial nicety.
 */
export async function getFeaturedArticle(locale: Locale): Promise<ArticleSummary | undefined> {
  const articles = await listArticles(locale);
  return articles.find((article) => article.featured) ?? articles[0];
}

/**
 * The four outcomes of asking for one article, as a union the page can switch
 * on. See `api-doc/public/articles.md` § "The four outcomes".
 *
 * `moved` and `gone` are 404/410 responses carrying a destination, not errors:
 * the API can only redirect its own URL, and the URL that needs the permanent
 * redirect is the *page*. So it names the destination and the page emits the
 * redirect — which is also why the fetch above must not follow one itself.
 */
export type ArticleResult =
  | { status: "ok"; article: ResolvedArticle }
  | { status: "notFound" }
  | { status: "moved"; slug: string }
  | { status: "gone"; categoryKey: CategoryKey };

/** `GET /api/public/articles/{slug}?locale=…` — one article with its body. */
export async function getArticle(locale: Locale, slug: string): Promise<ArticleResult> {
  const result = await request<ApiDetail>(
    `/api/public/articles/${encodeURIComponent(slug)}?locale=${locale}`
  );

  if (!result.ok) {
    switch (result.error.code) {
      case "BLOG_ARTICLE_MOVED": {
        const moved = result.error.details?.slug;
        // A MOVED without a destination is a broken redirect, not a 404 —
        // falling through to notFound() would quietly lose the article.
        if (typeof moved !== "string") {
          throw new BlogApiError(
            `/api/public/articles/${slug}`,
            "BLOG_ARTICLE_MOVED carried no details.slug to redirect to"
          );
        }
        return { status: "moved", slug: moved };
      }
      case "BLOG_ARTICLE_GONE": {
        const key = result.error.details?.categoryKey;
        if (typeof key !== "string") return { status: "notFound" };
        return { status: "gone", categoryKey: findCategory(key).key };
      }
      default:
        return { status: "notFound" };
    }
  }

  const item = result.data;
  const index = await fetchIndex();
  const labels = await categoryLabels(locale);

  // hreflang needs each translation's *slug*, which the detail response does
  // not carry — only `availableLocales`. The index has both, and is already
  // cached, so it is the cheapest place to resolve them.
  const row = index.find((candidate) => candidate.id === item.id);
  const pathByLocale = Object.fromEntries(
    (row?.translations ?? [{ locale, slug: item.slug }]).map((translation) => [
      translation.locale,
      localePath(translation.locale, articlePath(translation.slug)),
    ])
  ) as Partial<Record<Locale, string>>;

  return {
    status: "ok",
    article: {
      ...toSummary(item, labels, countsFrom(index, locale)),
      body: item.body,
      pathByLocale,
    },
  };
}

/** Every category with its per-locale count. Empty ones are included. */
export async function listCategories(locale: Locale): Promise<ResolvedCategory[]> {
  const [index, labels] = await Promise.all([fetchIndex(), categoryLabels(locale)]);
  const counts = countsFrom(index, locale);

  return BLOG_CATEGORIES.map((category) => ({
    ...category,
    label: labels[category.key],
    count: counts[category.key] ?? 0,
  }));
}

export async function getCategoryBySlug(
  locale: Locale,
  slug: string
): Promise<ResolvedCategory | null> {
  const categories = await listCategories(locale);
  return categories.find((category) => category.slug === slug) ?? null;
}

/**
 * Related reading: same category first, then anything else to fill the row.
 *
 * Topping up rather than showing one card matters — a three-card row with one
 * card in it reads as a bug, and a reader at the foot of an article is the
 * reader most likely to follow a link.
 */
export async function getRelatedArticles(
  locale: Locale,
  article: ResolvedArticle,
  limit = 3
): Promise<ArticleSummary[]> {
  const sameCategory = await listArticles(locale, {
    category: article.category.key,
    excludeId: article.id,
    limit,
  });
  if (sameCategory.length >= limit) return sameCategory;

  const rest = await listArticles(locale, { excludeId: article.id });
  const seen = new Set(sameCategory.map((candidate) => candidate.id));

  return [...sameCategory, ...rest.filter((candidate) => !seen.has(candidate.id))].slice(0, limit);
}

/**
 * Previous (older) and next (newer) in this locale's reading order.
 *
 * Reads a page of summaries rather than the index, because the cards need
 * titles and the index carries only slugs. **Correct up to `MAX_PAGE` articles
 * per locale**; past that the neighbours of the oldest articles fall off the
 * page and the links quietly stop appearing. The fix is an API window
 * (`?before=`/`?after=`), not a bigger number — flagged in
 * BACKEND-BLOG-REQUIREMENTS.md.
 */
export async function getAdjacentArticles(
  locale: Locale,
  article: ResolvedArticle
): Promise<{ previous?: ArticleSummary; next?: ArticleSummary }> {
  const articles = await listArticles(locale, { limit: MAX_PAGE });
  const index = articles.findIndex((candidate) => candidate.id === article.id);
  if (index === -1) return {};

  // The list is newest-first, so the *next* one to read is the one above.
  return { next: articles[index - 1], previous: articles[index + 1] };
}

/* ─── Route enumeration ───────────────────────────────────────────────────── */

/**
 * Every `(locale, slug)` pair that exists — for `generateStaticParams`.
 *
 * The pairs include the parent's `locale` deliberately: returning `{ slug }`
 * alone would let Next cross the slugs with all five locales and prerender an
 * English article at a Portuguese URL, which is the one thing the content model
 * forbids.
 */
export async function listArticleParams(): Promise<{ locale: Locale; slug: string }[]> {
  const index = await fetchIndex();
  return index.flatMap((row) =>
    row.translations.map((translation) => ({
      locale: translation.locale,
      slug: translation.slug,
    }))
  );
}

/**
 * Every `(locale, category)` pair that has at least one article in it.
 *
 * Non-empty only: a category page with nothing on it is a thin page, and
 * generating one per category per locale would publish twenty-odd of them for
 * a handful of articles. The chips on /blog hide empty categories too, so
 * nothing links to the pages this omits.
 */
export async function listCategoryParams(): Promise<{ locale: Locale; category: string }[]> {
  const index = await fetchIndex();
  const seen = new Set<string>();
  const params: { locale: Locale; category: string }[] = [];

  for (const row of index) {
    const category = findCategory(row.categoryKey);
    for (const translation of row.translations) {
      const id = `${translation.locale}:${category.slug}`;
      if (seen.has(id)) continue;
      seen.add(id);
      params.push({ locale: translation.locale, category: category.slug });
    }
  }

  return params;
}

/** The hreflang set for one category hub — the locales where it is not empty. */
export async function categoryPathByLocale(
  categorySlug: string
): Promise<Partial<Record<Locale, string>>> {
  const params = await listCategoryParams();
  return Object.fromEntries(
    params
      .filter((param) => param.category === categorySlug)
      .map((param) => [param.locale, localePath(param.locale, categoryPath(categorySlug))])
  );
}

/** Locales that have at least one article — used to offer a reader a way out. */
export async function localesWithArticles(): Promise<Locale[]> {
  const index = await fetchIndex();
  const locales = new Set<Locale>();
  for (const row of index) {
    for (const translation of row.translations) locales.add(translation.locale);
  }
  // Stable, and in the site's own locale order rather than publication order.
  return LOCALE_CODES.filter((code) => locales.has(code));
}

/**
 * What the sitemap submits for the blog.
 *
 * Each entry carries the locales that URL actually exists in, so the sitemap's
 * hreflang half matches the pages' own — the site-wide "all five locales" shape
 * used for /pricing would list three URLs per article that 404.
 *
 * Articles carry a real `lastModified`, unlike the rest of the sitemap: the
 * shop catalog has no timestamps and a fabricated date teaches crawlers to
 * ignore the field, but an article knows when it was published and revised.
 *
 * Returns nothing while `BLOG_IS_PLACEHOLDER` is set.
 */
export async function blogSitemapEntries(): Promise<
  {
    pathByLocale: Partial<Record<Locale, string>>;
    lastModified?: string;
    changeFrequency: "weekly" | "monthly";
    priority: number;
  }[]
> {
  if (BLOG_IS_PLACEHOLDER) return [];

  const index = await fetchIndex();

  const articles = index.map((row) => ({
    pathByLocale: Object.fromEntries(
      row.translations.map((translation) => [
        translation.locale,
        localePath(translation.locale, articlePath(translation.slug)),
      ])
    ) as Partial<Record<Locale, string>>,
    lastModified: row.updatedAt ?? row.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const categoryParams = await listCategoryParams();
  const categories = BLOG_CATEGORIES.map((category) => ({
    pathByLocale: Object.fromEntries(
      categoryParams
        .filter((param) => param.category === category.slug)
        .map((param) => [param.locale, localePath(param.locale, categoryPath(category.slug))])
    ) as Partial<Record<Locale, string>>,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  })).filter((entry) => Object.keys(entry.pathByLocale).length > 0);

  return [...articles, ...categories];
}
