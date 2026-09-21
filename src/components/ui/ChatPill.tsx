import { cn } from "@/lib/utils";
import ChatAppLogo, { type ChatApp } from "@/components/brand/ChatAppLogo";

export interface ChatPillChannel {
  app: ChatApp;
  /** `null` drops the half, e.g. Telegram while no bot name is configured. */
  href: string | null;
  /** The visible word — the app's name, one word. */
  label: string;
  /** The full action, for a screen reader. Must contain `label` (WCAG 2.5.3). */
  ariaLabel: string;
}

/**
 * Each half wears a faint wash of its own app's colour at rest, deepening on
 * hover. Two tinted halves say "two doors" without the grey divider this used
 * to need, and they borrow the one thing a visitor already associates with
 * each app. Low alpha on purpose: the green half sits beside the green primary
 * CTA and must not compete with it.
 */
const TONE: Record<ChatApp, string> = {
  whatsapp: "bg-wa/[0.07] hover:bg-wa/[0.14] focus-visible:ring-wa",
  telegram: "bg-[#229ED9]/[0.07] hover:bg-[#229ED9]/[0.14] focus-visible:ring-[#229ED9]",
};

/**
 * Hovering (or focusing) a half slides its mark inward, toward its own word —
 * the door leaning open. Keyed on which EDGE the mark sits on, not on the app,
 * and spelled per direction: in `/ar` the start edge is the right one, so
 * "inward" is the other sign. `ltr:`/`rtl:` rather than a bare class plus an
 * `rtl:` override, so the two never compete on cascade order. `motion-safe`
 * only; focus gets it too, so a keyboard visitor sees what a pointer does.
 */
const SLIDE = {
  start:
    "motion-safe:ltr:group-hover:translate-x-1.5 motion-safe:rtl:group-hover:-translate-x-1.5 motion-safe:ltr:group-focus-visible:translate-x-1.5 motion-safe:rtl:group-focus-visible:-translate-x-1.5",
  end:
    "motion-safe:ltr:group-hover:-translate-x-1.5 motion-safe:rtl:group-hover:translate-x-1.5 motion-safe:ltr:group-focus-visible:-translate-x-1.5 motion-safe:rtl:group-focus-visible:translate-x-1.5",
} as const;

/**
 * The bot's doors as one pill: each half is its own link, with that app's mark
 * on the pill's outer edge and a single word beside it. Two links rather than
 * one button with a menu — every click lands somewhere, and which app opens is
 * readable before the click.
 *
 * Sized to sit beside a `CTAButton size="lg"` (60px): 1px border + 6px padding
 * + a 46px mark. Logical properties (`rounded-s`/`rounded-e`, `ps`/`pe`) so
 * `/ar` mirrors it, with the first channel on the start edge. A channel with no
 * href is left out and the remaining one takes the whole pill.
 */
export default function ChatPill({ channels, className }: { channels: ChatPillChannel[]; className?: string }) {
  const live = channels.filter((c): c is ChatPillChannel & { href: string } => Boolean(c.href));

  return (
    <div
      className={cn(
        "inline-flex items-stretch gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-glass)] p-1.5",
        className
      )}
    >
      {live.map((c, i) => {
        const first = i === 0;
        const last = i === live.length - 1;
        // The mark goes on whichever edge of the pill this half touches.
        const markAtEnd = last && !first;
        return (
          <div key={c.app} className="flex flex-1 items-stretch">
            <a
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={c.ariaLabel}
              className={cn(
                "group flex flex-1 items-center gap-3 font-display text-lg font-semibold text-[var(--text-primary)]",
                "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                first && "rounded-s-full",
                last && "rounded-e-full",
                markAtEnd ? "flex-row-reverse ps-5" : "pe-5",
                TONE[c.app]
              )}
            >
              <ChatAppLogo
                app={c.app}
                className={cn(
                  "h-[46px] w-[46px] shrink-0 transition-transform duration-300 ease-out",
                  SLIDE[markAtEnd ? "end" : "start"]
                )}
              />
              <span className="flex-1 text-center">{c.label}</span>
            </a>
          </div>
        );
      })}
    </div>
  );
}
