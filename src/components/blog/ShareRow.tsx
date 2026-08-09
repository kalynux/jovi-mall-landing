"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Share links, with WhatsApp first.
 *
 * That ordering is not a preference, it is the audience: this is a product
 * about selling on WhatsApp, read largely on phones in a market where WhatsApp
 * is how links get passed around. A row that leads with X would be copied from
 * a template written for somewhere else.
 *
 * Plain anchors to each network's share URL — no embedded SDKs, so no
 * third-party script runs on the page and nothing here can track the reader.
 * The URL is computed server-side and passed in, because `window.location`
 * would be wrong during the prerender and briefly wrong after it.
 */
export default function ShareRow({
  url,
  title,
  labels,
}: {
  /** Absolute, canonical URL of this article in this locale. */
  url: string;
  title: string;
  labels: { share: string; whatsapp: string; x: string; linkedin: string; copy: string; copied: string };
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clears on unmount so a reader who navigates away mid-timeout does not get
  // a state update on a gone component.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused in some in-app browsers and on insecure
      // origins. The other four buttons still work; silently doing nothing is
      // better than an error toast for a copy the reader can do by hand.
    }
  }

  const targets = [
    {
      key: "whatsapp",
      label: labels.whatsapp,
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      path: "M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.13c-.24.68-1.42 1.33-1.95 1.37-.5.04-.98.22-3.3-.69-2.78-1.1-4.55-3.94-4.69-4.13-.14-.19-1.12-1.49-1.12-2.85s.71-2.02.97-2.3c.25-.28.55-.35.73-.35l.53.01c.17 0 .4-.06.62.48.24.57.8 1.97.87 2.11.07.14.12.31.02.5-.09.19-.14.31-.28.47l-.42.49c-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.21 1.36.28.14.44.12.6-.07.17-.19.7-.81.88-1.09.19-.28.37-.23.63-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.12.07.68-.17 1.36Z",
    },
    {
      key: "x",
      label: labels.x,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      path: "M17.53 3h3.02l-6.6 7.54L21.75 21h-5.9l-4.62-6.04L5.94 21H2.92l7.06-8.07L2.25 3h6.05l4.18 5.52L17.53 3Zm-1.06 16.2h1.67L7.6 4.7H5.81l10.66 14.5Z",
    },
    {
      key: "linkedin",
      label: labels.linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      path: "M6.94 5.5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0ZM3.25 8.9h3.5V21h-3.5V8.9Zm5.75 0h3.35v1.65h.05c.47-.85 1.6-1.75 3.3-1.75 3.53 0 4.18 2.2 4.18 5.07V21h-3.5v-5.42c0-1.29-.02-2.95-1.84-2.95-1.85 0-2.13 1.4-2.13 2.86V21H9V8.9Z",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="me-1 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {labels.share}
      </span>

      {targets.map((target) => (
        <a
          key={target.key}
          href={target.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={target.label}
          title={target.label}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] transition-colors hover:border-primary-400 hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d={target.path} />
          </svg>
        </a>
      ))}

      <button
        type="button"
        onClick={copy}
        // The label changes to "Copied", which is announced because the
        // accessible name of the focused button changed — no live region and no
        // toast needed for a two-word confirmation.
        aria-label={copied ? labels.copied : labels.copy}
        title={copied ? labels.copied : labels.copy}
        className="flex h-9 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-primary-400 hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]"
      >
        {copied ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-role" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <rect x="7" y="7" width="9" height="9" rx="2" />
            <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
          </svg>
        )}
        <span>{copied ? labels.copied : labels.copy}</span>
      </button>
    </div>
  );
}
