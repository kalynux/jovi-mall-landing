/**
 * The article content model.
 *
 * This file is the contract. `blog.fixtures.ts` satisfies it today and a CMS
 * satisfies it tomorrow, so everything the pages render is described here and
 * nowhere else — see `landing/BACKEND-BLOG-REQUIREMENTS.md` for the endpoint
 * shapes that produce it.
 *
 * Three decisions are worth stating up front, because they are the ones that
 * cost something to change later.
 *
 * **1. A body is an array of typed blocks, not an HTML string.** An HTML string
 * from a CMS has to be sanitised on the way in and rendered through
 * `dangerouslySetInnerHTML` on the way out, and a single missed edge case is
 * stored XSS on the marketing domain. Blocks render through React components
 * that cannot emit markup an author did not ask for, they are trivial to
 * validate at the boundary, and they let a `faq` block do double duty as
 * FAQPage structured data. The cost is that authors get a fixed vocabulary
 * rather than arbitrary markup — which for a blog whose job is ranking is a
 * feature.
 *
 * **2. An article is one entity with many translations, each with its own
 * slug.** Not five independent articles. The English and French versions of a
 * post are the same document, so they must point at each other with hreflang —
 * which requires knowing they are related. And the French slug is
 * `comment-vendre-sur-whatsapp-sans-site-web`, not the English slug served at a
 * French URL: the keyword in the path is a meaningful part of why the page
 * ranks, and this blog exists to rank in French.
 *
 * **3. A translation that does not exist is a 404, not a fallback.** Serving
 * English prose at `/pt/blog/...` publishes a page whose content contradicts
 * its own `lang` attribute and competes with the English original. An article
 * exists in the locales it has been translated into and in no others.
 */
import type { Locale } from "@/i18n/routing";

/* ─── Inline text ─────────────────────────────────────────────────────────── */

/**
 * The inline vocabulary inside a paragraph or list item.
 *
 * Deliberately flat — a span carries its own marks rather than nesting inside
 * `<strong><em>` wrappers. Nested inline trees are what make rich-text
 * renderers hard, and nothing an article needs requires arbitrary nesting.
 */
export type InlineNode =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean; code?: boolean }
  /**
   * `href` is a site-relative path (`/pricing`) for internal links, which is
   * what makes them locale-aware when rendered. An absolute URL is treated as
   * external and gets `rel="nofollow noopener"` — see RichText.tsx.
   */
  | { type: "link"; text: string; href: string };

export type RichText = InlineNode[];

/* ─── Blocks ──────────────────────────────────────────────────────────────── */

export type CalloutTone = "note" | "tip" | "warning";

/**
 * `id` on a heading is authored, not derived. Deriving it from the text would
 * change every anchor the moment a title is edited or retranslated, silently
 * breaking any link anyone ever shared into the middle of an article.
 */
export type Block =
  | { type: "heading"; level: 2 | 3; id: string; text: string }
  | { type: "paragraph"; text: RichText }
  | { type: "list"; ordered?: boolean; items: RichText[] }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "callout"; tone: CalloutTone; title?: string; text: RichText }
  | { type: "image"; url: string; alt: string; width: number; height: number; caption?: string }
  | { type: "cta"; title: string; body: string; href: string; label: string }
  /** Renders as an accordion *and* as FAQPage JSON-LD. See the detail page. */
  | { type: "faq"; items: { question: string; answer: string }[] }
  | { type: "divider" };

export type BlockType = Block["type"];

/* ─── Authors ─────────────────────────────────────────────────────────────── */

/**
 * `name` is not localized — a person's name is the same in five languages. The
 * job title and bio are, because "Head of Merchant Growth" is not.
 *
 * `type` is what the `author` node in the structured data becomes. A house
 * byline like "The Wi-Mall team" is an Organization; emitting it as a Person
 * would assert that a human being by that name exists, which is the same class
 * of claim as the invented review counts `lib/seo/jsonld.ts` refuses to make.
 */
export type Author = {
  id: string;
  name: string;
  type: "Person" | "Organization";
  /** Optional: falls back to generated initials, so no avatar is never a gap. */
  avatarUrl?: string;
  translations: Partial<Record<Locale, { title: string; bio: string }>>;
};

export type ResolvedAuthor = {
  id: string;
  name: string;
  type: "Person" | "Organization";
  avatarUrl?: string;
  title: string;
  bio: string;
};

/* ─── Categories ──────────────────────────────────────────────────────────── */

/**
 * Category slugs are locale-agnostic; only the label is translated.
 *
 * The opposite of the decision made for article slugs, and on purpose. The
 * article URL is where a keyword match earns rankings; a category page is an
 * internal hub whose traffic comes from the blog itself. Keeping its slug
 * stable means `localeAlternates()` works on it unchanged, and one fewer
 * lookup table has to stay in sync across five languages.
 */
export type CategoryKey = "selling" | "payments" | "delivery" | "growth" | "guides";

export type Category = {
  key: CategoryKey;
  slug: string;
  /** Role-accent class driving `--role` for the category's cards and pages. */
  accent: "role-accent" | "role-vendor" | "role-agency" | "role-agent" | "role-customer";
};

export type ResolvedCategory = Category & {
  label: string;
  /** How many published articles this category has *in the current locale*. */
  count: number;
};

/* ─── Articles ────────────────────────────────────────────────────────────── */

export type ArticleTranslation = {
  locale: Locale;
  /** Localized, and unique within its locale. The URL segment. */
  slug: string;
  title: string;
  /** Card copy and `<meta name="description">`. One or two sentences. */
  excerpt: string;
  /**
   * Used for `<title>` when the SEO phrasing differs from the on-page H1 —
   * a headline can be good writing and a bad title tag at the same time.
   */
  metaTitle?: string;
  body: Block[];
};

export type Article = {
  id: string;
  categoryKey: CategoryKey;
  authorId: string;
  /** ISO 8601, UTC. Drives ordering, `datePublished` and the visible byline. */
  publishedAt: string;
  /** ISO 8601, UTC. Omitted when the article has never been revised. */
  updatedAt?: string;
  /** At most one per locale should carry this — the index leads with it. */
  featured?: boolean;
  /**
   * Optional. Absent means the card and header render generated cover art
   * instead (see CoverArt.tsx), which is why no fixture ships a stock photo.
   */
  cover?: { url: string; alt: string; width: number; height: number };
  /** Non-empty. The locales this article exists in, and only those. */
  translations: ArticleTranslation[];
};

/**
 * One article, flattened for one locale — what every component takes.
 *
 * Components never see `Article`, so none of them can accidentally render a
 * translation the visitor did not ask for, and none of them need to know that
 * translations exist at all.
 */
export type ResolvedArticle = {
  id: string;
  locale: Locale;
  slug: string;
  title: string;
  metaTitle: string;
  excerpt: string;
  body: Block[];
  category: ResolvedCategory;
  author: ResolvedAuthor;
  publishedAt: string;
  updatedAt?: string;
  featured: boolean;
  cover?: { url: string; alt: string; width: number; height: number };
  /**
   * `wordCount` is the API's, derived from the body on write so it cannot drift
   * from the prose. `readingMinutes` is always computed from it here and never
   * sent — an editor's estimate goes stale the moment an article is revised,
   * and "6 min read" over four paragraphs costs a reader's trust cheaply.
   */
  readingMinutes: number;
  wordCount: number;
  /**
   * The locales this article exists in, and the path it takes in each. This is
   * the article's hreflang set; it is per-article rather than site-wide because
   * a post translated into two languages must not claim to exist in five.
   *
   * Only on the full article: the detail response carries `availableLocales`
   * but not the other translations' slugs, so this is resolved against the
   * route index — work a card has no use for.
   */
  pathByLocale: Partial<Record<Locale, string>>;
};

/** The index and card grids never need a body — this is what they get. */
export type ArticleSummary = Omit<ResolvedArticle, "body" | "pathByLocale">;
