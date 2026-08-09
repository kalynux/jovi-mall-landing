/**
 * The article card, in the three sizes the blog needs.
 *
 * One component rather than three because the parts are identical and only the
 * arrangement differs — three components would drift the moment the meta line
 * or the category pill changed.
 *
 * Mobile first throughout: every variant is a single stacked column on a phone
 * and only becomes something else at `sm` or `lg`. The `featured` variant in
 * particular is a plain card until `lg`, because a side-by-side hero on a
 * 360px screen is two cramped columns, not a feature.
 *
 * An async server component so it can read its own labels. It renders inside a
 * `setRequestLocale` subtree and takes its locale from the article itself, so a
 * card cannot be labelled in a different language from the article it points at.
 */
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { articlePath } from "@/lib/blog/blog.routes";
import type { ArticleSummary } from "@/lib/blog/blog.types";
import { cn } from "@/lib/utils";
import ArticleMeta from "./ArticleMeta";
import CoverArt from "./CoverArt";

export type CardVariant = "default" | "featured" | "compact";

/**
 * The cover well.
 *
 * A real cover renders as a plain `<img>` rather than `next/image`: no article
 * ships one today, and adding a remote host to `next.config.ts` for an image
 * that does not exist yet is configuration written against a guess. `width` and
 * `height` are required by the content model precisely so this reserves its
 * space and does not shift the layout when it loads.
 */
function Cover({
  article,
  variant,
  className,
}: {
  article: ArticleSummary;
  variant: CardVariant;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-[var(--bg-subtle)]", className)}>
      {article.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- see the note above
        <img
          src={article.cover.url}
          alt={article.cover.alt}
          width={article.cover.width}
          height={article.cover.height}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <CoverArt
          seed={article.id}
          variant={variant === "featured" ? "hero" : "card"}
          className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
        />
      )}

      <span className="absolute start-3 top-3 inline-flex items-center rounded-pill border border-role-soft bg-[var(--surface)] px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-role shadow-sm">
        {article.category.label}
      </span>
    </div>
  );
}

export default async function ArticleCard({
  article,
  variant = "default",
  /** `h2` inside a titled section, `h3` under a sub-heading. */
  headingLevel = "h3",
}: {
  article: ArticleSummary;
  variant?: CardVariant;
  headingLevel?: "h2" | "h3";
}) {
  const t = await getTranslations({ locale: article.locale, namespace: "pages.blog" });
  const Heading = headingLevel;

  const readingLabel = t("readTime", { minutes: article.readingMinutes });
  const href = articlePath(article.slug);

  /* ─── Compact: a text row, for sidebars and prev/next ──────────────────── */
  if (variant === "compact") {
    return (
      <Link
        href={href}
        className={cn(
          "group flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-role-soft",
          article.category.accent
        )}
      >
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.1em] text-role">
          {article.category.label}
        </span>
        <Heading className="font-display text-sm font-semibold leading-snug text-[var(--text-primary)] transition-colors group-hover:text-role">
          {article.title}
        </Heading>
        <ArticleMeta
          locale={article.locale}
          publishedAt={article.publishedAt}
          readingLabel={readingLabel}
        />
      </Link>
    );
  }

  /* ─── Featured: stacked on phones, side by side from lg ────────────────── */
  if (variant === "featured") {
    return (
      <Link
        href={href}
        className={cn(
          "card group grid overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-role-soft hover:shadow-lg lg:grid-cols-2",
          article.category.accent
        )}
      >
        <Cover article={article} variant="featured" className="aspect-[16/10] lg:aspect-auto lg:h-full" />
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <Heading className="font-display text-2xl font-bold leading-tight text-[var(--text-primary)] transition-colors group-hover:text-role sm:text-3xl">
            {article.title}
          </Heading>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            {article.excerpt}
          </p>
          <ArticleMeta
            className="mt-6"
            locale={article.locale}
            publishedAt={article.publishedAt}
            readingLabel={readingLabel}
          />
          <span
            aria-hidden="true"
            className="mt-5 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-role"
          >
            {t("readArticle")}
            <svg
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </span>
        </div>
      </Link>
    );
  }

  /* ─── Default: the grid card ───────────────────────────────────────────── */
  return (
    <Link
      href={href}
      className={cn(
        "card group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-role-soft hover:shadow-lg",
        article.category.accent
      )}
    >
      <Cover article={article} variant="default" className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col p-5">
        <Heading className="font-display text-base font-semibold leading-snug text-[var(--text-primary)] transition-colors group-hover:text-role">
          {article.title}
        </Heading>
        {/* Clamped rather than truncated in the data, so the full excerpt is
            still in the HTML for the crawler and for a card that has room. */}
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--text-muted)]">
          {article.excerpt}
        </p>
        <ArticleMeta
          className="mt-auto pt-4"
          locale={article.locale}
          publishedAt={article.publishedAt}
          readingLabel={readingLabel}
        />
      </div>
    </Link>
  );
}
