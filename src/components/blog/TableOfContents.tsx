import type { Block } from "@/lib/blog/blog.types";
import { cn } from "@/lib/utils";

/**
 * The in-article contents list, built from the body's level-2 headings.
 *
 * Level 3s are deliberately excluded. A two-level tree in a 250px rail wraps
 * every entry onto three lines and stops being scannable, which is the only
 * thing a contents list is for.
 *
 * Anchors point at authored heading ids (see the note in `blog.types.ts`), so a
 * link shared into the middle of an article keeps working when the headline is
 * edited or retranslated.
 *
 * Rendered twice — a `<details>` above the article on phones, a sticky rail
 * from `lg` — because the two placements are genuinely different components of
 * the reading experience. Only one is ever in the accessibility tree, since the
 * other is `display: none` rather than visually hidden.
 */

export function tocEntries(body: Block[]): { id: string; text: string }[] {
  return body
    .filter((block): block is Extract<Block, { type: "heading" }> => block.type === "heading")
    .filter((heading) => heading.level === 2)
    .map((heading) => ({ id: heading.id, text: heading.text }));
}

function TocLinks({ entries }: { entries: { id: string; text: string }[] }) {
  return (
    <ol className="space-y-1 text-sm">
      {entries.map((entry, i) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            className="flex gap-2.5 rounded-lg px-2 py-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-role"
          >
            <span aria-hidden="true" className="font-mono text-xs text-[var(--text-muted)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="leading-snug">{entry.text}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

export default function TableOfContents({
  entries,
  label,
  className,
}: {
  entries: { id: string; text: string }[];
  label: string;
  className?: string;
}) {
  // One heading is not a contents list, it is a heading.
  if (entries.length < 2) return null;

  return (
    <>
      {/* Phone and tablet: collapsed by default so it costs no vertical space
          above the first paragraph. Native <details>, so it works before
          hydration — same reasoning as the FAQ accordion. */}
      <details className={cn("group rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:hidden", className)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-display text-sm font-semibold text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
          {label}
          <svg
            className="h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-45"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
        </summary>
        <nav aria-label={label} className="px-2 pb-3">
          <TocLinks entries={entries} />
        </nav>
      </details>

      {/* Desktop: a sticky rail. `top` clears the fixed navbar; the max-height
          and scroller keep a long list from running off the viewport. */}
      <nav
        aria-label={label}
        className={cn(
          "sticky top-24 hidden max-h-[calc(100svh-8rem)] overflow-y-auto lg:block",
          className
        )}
      >
        <p className="mb-3 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {label}
        </p>
        <TocLinks entries={entries} />
      </nav>
    </>
  );
}
