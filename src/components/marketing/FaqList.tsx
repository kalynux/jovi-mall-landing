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
              "flex cursor-pointer list-none items-start justify-between gap-4 py-4",
              "[&::-webkit-details-marker]:hidden",
              "font-display text-base font-semibold text-[var(--text-primary)]",
              "transition-colors hover:text-role",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            )}
          >
            <span>{item.question}</span>
            <svg
              className="mt-1 h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200 group-open:rotate-45"
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
          <p className="pb-5 pe-8 text-sm leading-relaxed text-[var(--text-secondary)]">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
