/**
 * Renders an article body — the block array from `blog.types.ts`.
 *
 * One `switch` with a case per block type, and TypeScript's exhaustiveness
 * check on the discriminated union means adding a block type to the content
 * model without rendering it is a compile error rather than a blank space on a
 * published page.
 *
 * Measure is capped at `max-w-[68ch]` on the prose elements rather than on the
 * container, so a callout, an image or a CTA can run full-bleed to the column
 * while the running text stays at a readable line length. On a phone the cap
 * never binds and everything is simply full width.
 */
import { Link } from "@/i18n/navigation";
import FaqList from "@/components/marketing/FaqList";
import type { Block } from "@/lib/blog/blog.types";
import { cn } from "@/lib/utils";
import RichText from "./RichText";

/* ─── Callout tones ───────────────────────────────────────────────────────── */

const CALLOUT_STYLES = {
  note: "border-[var(--border-medium)] bg-[var(--bg-subtle)]",
  tip: "border-role-soft bg-role-soft",
  warning: "border-amber-300/60 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-700/10",
} as const;

const CALLOUT_ICON_CLASS = {
  note: "text-[var(--text-muted)]",
  tip: "text-role",
  warning: "text-amber-600 dark:text-amber-400",
} as const;

function CalloutIcon({ tone }: { tone: keyof typeof CALLOUT_STYLES }) {
  return (
    <svg
      className={cn("mt-0.5 h-5 w-5 flex-shrink-0", CALLOUT_ICON_CLASS[tone])}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.5" />
      {tone === "warning" ? (
        <>
          <path d="M10 6.5v4" />
          <path d="M10 13.5h.01" />
        </>
      ) : (
        <>
          <path d="M10 9.5v4" />
          <path d="M10 6.5h.01" />
        </>
      )}
    </svg>
  );
}

/* ─── Blocks ──────────────────────────────────────────────────────────────── */

const PROSE = "max-w-[68ch] text-[1.0625rem] leading-[1.75] text-[var(--text-secondary)]";

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    /**
     * `scroll-mt` clears the fixed navbar. Without it, following a
     * table-of-contents link or an anchor from a shared URL parks the heading
     * underneath the header and the reader lands mid-paragraph.
     */
    case "heading": {
      const Heading = block.level === 2 ? "h2" : "h3";
      return (
        <Heading
          id={block.id}
          className={cn(
            "scroll-mt-24 font-display font-bold text-[var(--text-primary)] lg:scroll-mt-28",
            block.level === 2
              ? "mt-12 text-xl sm:text-2xl first:mt-0"
              : "mt-9 text-lg sm:text-xl first:mt-0"
          )}
        >
          {block.text}
        </Heading>
      );
    }

    case "paragraph":
      return (
        <p className={cn("mt-5", PROSE)}>
          <RichText nodes={block.text} />
        </p>
      );

    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List
          className={cn(
            "mt-5 space-y-2.5 ps-5",
            PROSE,
            block.ordered ? "list-decimal marker:text-role" : "list-disc marker:text-role"
          )}
        >
          {block.items.map((item, i) => (
            <li key={i} className="ps-1.5">
              <RichText nodes={item} />
            </li>
          ))}
        </List>
      );
    }

    case "quote":
      return (
        <figure className="mt-8 max-w-[68ch]">
          <blockquote className="border-s-2 border-role ps-5 font-display text-lg leading-relaxed text-[var(--text-primary)] sm:text-xl">
            {block.text}
          </blockquote>
          {block.attribution && (
            <figcaption className="mt-3 ps-5 text-xs text-[var(--text-muted)]">
              — {block.attribution}
            </figcaption>
          )}
        </figure>
      );

    case "callout":
      return (
        <aside className={cn("mt-8 flex gap-3 rounded-2xl border p-4 sm:p-5", CALLOUT_STYLES[block.tone])}>
          <CalloutIcon tone={block.tone} />
          <div className="min-w-0">
            {block.title && (
              <p className="font-display text-sm font-bold text-[var(--text-primary)]">
                {block.title}
              </p>
            )}
            <div className={cn("text-[0.95rem] leading-relaxed text-[var(--text-secondary)]", block.title && "mt-1.5")}>
              <RichText nodes={block.text} />
            </div>
          </div>
        </aside>
      );

    case "image":
      return (
        <figure className="mt-9">
          {/* Plain <img> for the same reason as ArticleCard's cover — no
              article ships an image yet, so next.config carries no remote host
              to point next/image at. width/height reserve the box. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.alt}
            width={block.width}
            height={block.height}
            loading="lazy"
            decoding="async"
            className="w-full rounded-2xl border border-[var(--border)]"
            
          />
          {block.caption && (
            <figcaption className="mt-3 text-xs text-[var(--text-muted)]">{block.caption}</figcaption>
          )}
        </figure>
      );

    /**
     * Mid-article CTA. Visually a band rather than a paragraph, because a
     * reader skimming should be able to tell at a glance that this is the
     * advert and skip it — a CTA disguised as prose costs more trust than the
     * clicks it buys.
     */
    case "cta":
      return (
        <div className="card mt-10 p-6 sm:p-7">
          <p className="font-display text-lg font-bold text-[var(--text-primary)]">{block.title}</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
            {block.body}
          </p>
          <Link
            href={block.href}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary-700 to-primary-500 px-5 py-2.5 font-display text-sm font-semibold text-white shadow-[0_0_20px_rgba(13,160,107,0.3)] transition-shadow hover:shadow-[0_0_30px_rgba(13,160,107,0.55)]"
          >
            {block.label}
          </Link>
        </div>
      );

    /**
     * Reuses the FAQ accordion from the marketing pages — native `<details>`,
     * so the answers are in the HTML and work without JavaScript. The detail
     * page separately lifts these into FAQPage structured data.
     */
    case "faq":
      return (
        <div className="mt-10">
          <FaqList
            items={block.items.map((item, i) => ({
              id: `faq-${i}`,
              question: item.question,
              answer: item.answer,
            }))}
          />
        </div>
      );

    case "divider":
      return <hr className="mt-10 border-[var(--border)]" />;
  }
}

export default function ArticleBody({ body }: { body: Block[] }) {
  return (
    <div className="pb-4">
      {body.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
