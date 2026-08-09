import { formatArticleDate, isoDate } from "@/lib/blog/blog.format";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * The date-and-length line under a headline.
 *
 * `<time datetime>` rather than a bare string so the machine-readable date is
 * in the markup beside the human one, matching the `datePublished` in the
 * article's structured data.
 */
export default function ArticleMeta({
  locale,
  publishedAt,
  readingLabel,
  className,
}: {
  locale: Locale;
  publishedAt: string;
  /** Already interpolated — "6 min read" / "6 min de lecture". */
  readingLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]",
        className
      )}
    >
      <time dateTime={isoDate(publishedAt)}>{formatArticleDate(locale, publishedAt)}</time>
      <span aria-hidden="true">·</span>
      <span>{readingLabel}</span>
    </div>
  );
}
