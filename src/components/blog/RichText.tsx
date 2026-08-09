import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import type { RichText as RichTextNodes } from "@/lib/blog/blog.types";

/**
 * Inline spans inside a paragraph, list item or callout.
 *
 * The reason this exists instead of `dangerouslySetInnerHTML` is in
 * `blog.types.ts`: article bodies will come from a CMS, and the set of tags a
 * CMS can put on this page should be the set enumerated here, not whatever
 * survived a sanitiser. Nothing below can emit an element an author did not ask
 * for by name.
 */

/**
 * Internal links go through the locale-aware `Link`, so an English article
 * linking to `/pricing` and a French one linking to the same path each land on
 * their own language's page. That is why article hrefs are authored *without* a
 * locale prefix — writing `/fr/pricing` in a French article would double it.
 *
 * External links get `nofollow` alongside the security attributes. An article
 * citing a payment provider should not be passing the site's ranking signal to
 * it, and a CMS-authored link is exactly the surface where that would otherwise
 * happen by accident.
 */
function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith("//");
}

const LINK_CLASS =
  "font-medium text-role underline decoration-[color-mix(in_srgb,var(--role)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--role)]";

export default function RichText({ nodes }: { nodes: RichTextNodes }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.type === "link") {
          return isExternal(node.href) ? (
            <a
              key={i}
              href={node.href}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className={LINK_CLASS}
            >
              {node.text}
            </a>
          ) : (
            <Link key={i} href={node.href} className={LINK_CLASS}>
              {node.text}
            </Link>
          );
        }

        // Marks compose: a span can be bold and code at once, which a nested
        // element tree would have made an authoring decision rather than a
        // rendering one.
        let content = <>{node.text}</>;
        if (node.code) {
          content = (
            <code className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--text-primary)]">
              {content}
            </code>
          );
        }
        if (node.italic) content = <em>{content}</em>;
        if (node.bold) {
          content = <strong className="font-semibold text-[var(--text-primary)]">{content}</strong>;
        }

        return <Fragment key={i}>{content}</Fragment>;
      })}
    </>
  );
}
