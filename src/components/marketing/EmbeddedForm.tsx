/**
 * A third-party hosted form, embedded in the page.
 *
 * Server component with no hydration, like the rest of the marketing kit.
 *
 * Three things this wrapper exists to handle, none of which the raw embed
 * snippet does:
 *
 * - **Size.** Google's snippet ships `width="640" height="957"`, which overflows
 *   a 360px phone. The frame is fluid instead, and taller on small screens
 *   because the fields stack. An embedded form scrolls internally, so a frame
 *   that is slightly too short costs a scroll rather than losing a question.
 * - **Theme.** The form is always light, whatever the site theme. Dropped
 *   straight onto a dark page it reads as a lit slab someone forgot to style, so
 *   it sits on a deliberate white card that looks intentional in both themes.
 * - **Disclosure.** It is a third-party frame that sets its own cookies, and
 *   this site has no consent banner. `note` says so in one plain line.
 */
export default function EmbeddedForm({
  src,
  title,
  note,
  fallbackLabel,
}: {
  src: string;
  /**
   * Accessible name for the frame. Required — an `<iframe>` without one is
   * announced as an unlabelled document, which is a real barrier rather than a
   * lint nit.
   */
  title: string;
  note?: string;
  /** Text for the escape hatch below the frame. */
  fallbackLabel: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-2 shadow-sm sm:p-3">
        {/* Deliberately childless. An `<iframe>` has no fallback content model
            in HTML5: a browser parses anything between the tags as text rather
            than as elements, so markup put there survives in React's tree but
            not in the DOM — which is a hydration mismatch on every load. The
            escape hatch is a sibling below instead, where it also happens to be
            visible to the people who need it. */}
        <iframe
          src={src}
          title={title}
          loading="lazy"
          className="h-[1150px] w-full rounded-xl border-0 sm:h-[1000px]"
        />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-role underline decoration-[color-mix(in_srgb,var(--role)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--role)]"
        >
          {fallbackLabel}
        </a>
      </p>
      {note && <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{note}</p>}
    </div>
  );
}
