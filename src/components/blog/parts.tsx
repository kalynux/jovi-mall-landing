/**
 * The small shared pieces of the blog's list pages.
 *
 * Same rationale as `components/marketing/parts.tsx`: server components, no
 * hydration, and every token borrowed from the existing design system so the
 * blog reads as part of the site rather than as a bolted-on CMS theme.
 */
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { BLOG_ROOT, categoryPath } from "@/lib/blog/blog.routes";
import type { ArticleSummary, ResolvedCategory } from "@/lib/blog/blog.types";
import { cn } from "@/lib/utils";
import ArticleCard from "./ArticleCard";

/**
 * One column on a phone, two from `sm`, three from `lg`.
 *
 * Not four at any width: a card whose excerpt clamps to three lines needs about
 * 18rem to stay readable, and a fourth column on a 1280px screen puts it below
 * that. The row is also the reason `items-stretch` matters — cards carry their
 * meta line at the foot with `mt-auto`, which only aligns if they share height.
 */
export function ArticleGrid({
  articles,
  headingLevel = "h3",
}: {
  articles: ArticleSummary[];
  headingLevel?: "h2" | "h3";
}) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} headingLevel={headingLevel} />
      ))}
    </div>
  );
}

/**
 * The category filter.
 *
 * Real links to real URLs, not client-side filter state. A filter that lives in
 * `useState` produces one indexable page; these produce one per category, each
 * of which is a hub a search engine can rank and a reader can bookmark — which
 * is the entire reason category pages exist.
 *
 * Empty categories are dropped rather than rendered disabled: a chip that leads
 * to a page with nothing on it is worse than an absent chip.
 */
export function CategoryChips({
  categories,
  activeSlug,
  allLabel,
}: {
  categories: ResolvedCategory[];
  /** Undefined on /blog itself, where "All" is the active chip. */
  activeSlug?: string;
  allLabel: string;
}) {
  const chip = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-2 font-display text-xs font-semibold transition-colors sm:text-sm",
      active
        ? "border-role-soft bg-role-soft text-role"
        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-primary-400 hover:text-[var(--text-primary)]"
    );

  return (
    // Scrolls sideways inside itself on a phone rather than wrapping to three
    // rows and pushing the first article below the fold.
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        <li>
          <Link href={BLOG_ROOT} className={chip(!activeSlug)} aria-current={!activeSlug ? "page" : undefined}>
            {allLabel}
          </Link>
        </li>
        {categories
          .filter((category) => category.count > 0)
          .map((category) => {
            const active = category.slug === activeSlug;
            return (
              <li key={category.key} className={category.accent}>
                <Link
                  href={categoryPath(category.slug)}
                  className={chip(active)}
                  aria-current={active ? "page" : undefined}
                >
                  {category.label}
                  <span className="text-[var(--text-muted)]">{category.count}</span>
                </Link>
              </li>
            );
          })}
      </ul>
    </div>
  );
}

/**
 * What a locale with no articles gets.
 *
 * A 404 would be wrong — /pt/blog is a real page that will have content — and
 * an empty grid says nothing. This says which languages the blog exists in and
 * links to them, which is the only genuinely useful thing to offer someone who
 * arrived at an empty shelf.
 */
export function EmptyArticleList({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center p-8 text-center sm:p-12">
      <svg
        className="h-10 w-10 text-[var(--text-muted)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a1 1 0 0 1 1 1v14.5" />
        <path d="M4 5.5v13A2.5 2.5 0 0 0 6.5 21H19" />
        <path d="M8 7.5h7M8 11h5" />
      </svg>
      <h2 className="mt-4 font-display text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">{body}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
