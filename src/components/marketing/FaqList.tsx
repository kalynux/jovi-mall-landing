import { cn } from "@/lib/utils";

/**
 * Native `<details>` rather than a JS accordion.
 *
 * Two reasons, both of which matter more here than the animation would. The
 * answers ship in the HTML and stay readable with JavaScript disabled or still
 * loading — which on a 2G connection is most of the first few seconds. And the
 * open/close, focus and keyboard behaviour is the browser's, so it is correct
 * on every device without us maintaining it.
 */
export default function FaqList({
  items,
  defaultOpen = false,
}: {
  items: { id: string; question: string; answer: string }[];
  defaultOpen?: boolean;
}) {
  return (
    <div className="max-w-3xl divide-y divide-[var(--border)] border-y border-[var(--border)]">
      {items.map((item) => (
        <details key={item.id} id={item.id} open={defaultOpen} className="group">
          <summary
            className={cn(
              // Safari still paints a disclosure triangle unless the WebKit
              // pseudo-element is hidden too; `list-none` alone is not enough.
              "flex cursor-pointer list-none items-start justify-between gap-4 py-5",
              "[&::-webkit-details-marker]:hidden",
              "font-display text-base font-semibold text-[var(--text-primary)] sm:text-lg",
              "transition-colors hover:text-role group-open:text-role",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            )}
          >
            <span>{item.question}</span>
            {/* The toggle grows into a filled role chip on open, so an expanded
                question is unmistakable at a glance. */}
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-all duration-200 group-hover:border-role-soft group-hover:text-role group-open:border-role-soft group-open:bg-role-soft group-open:text-role"
            >
              <svg
                className="h-4 w-4 transition-transform duration-200 group-open:rotate-45"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
            </span>
          </summary>
          <p className="pb-5 pe-8 text-sm leading-relaxed text-[var(--text-secondary)]">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
