"use client";
import { RefreshCw, SearchX, ServerCrash, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CTAButton from "@/components/ui/CTAButton";
import { cn } from "@/lib/utils";

/**
 * The one screen every failure lands on.
 *
 * Every `error.tsx` and `not-found.tsx` in the app renders this, so an outage
 * looks like part of the product rather than like Next's stock "Application
 * error: a server-side exception has occurred" — which is what a visitor saw
 * whenever the API was unreachable, because the app shipped no error
 * boundaries at all.
 *
 * Copy is chosen by `variant`, not by inspecting the error. That is deliberate:
 * Next strips `error.message` in production builds, so a boundary genuinely
 * cannot tell "the backend is down" from "we have a bug" at runtime. Each
 * boundary instead names the thing that failed to load, which is true either
 * way and is the part a visitor can act on.
 */
export type ErrorVariant = "generic" | "pricing" | "blog" | "shop" | "auth" | "notFound";

/** Which of the three icons reads right for each variant. */
const ICONS: Record<ErrorVariant, typeof TriangleAlert> = {
  generic: TriangleAlert,
  pricing: ServerCrash,
  blog: ServerCrash,
  shop: ServerCrash,
  auth: TriangleAlert,
  notFound: SearchX,
};

export default function ErrorScreen({
  variant = "generic",
  /** Next's `reset()`. Omitted on 404s, where retrying the same URL is pointless. */
  reset,
  /** Next's `error.digest` — the only identifier that survives to production. */
  digest,
  /** Dev-only: the real message, so a developer is not worse off than before. */
  error,
  className,
}: {
  variant?: ErrorVariant;
  reset?: () => void;
  digest?: string;
  error?: Error;
  className?: string;
}) {
  const t = useTranslations("errorPage");
  const Icon = ICONS[variant];

  return (
    <div
      className={cn(
        "flex min-h-[60svh] items-center justify-center px-4 py-16 sm:px-6 lg:px-8",
        className
      )}
    >
      <div className="w-full max-w-lg text-center">
        <span
          aria-hidden="true"
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]"
        >
          <Icon className="h-6 w-6 text-[var(--text-secondary)]" />
        </span>

        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
          {t(`${variant}.title`)}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)]">
          {t(`${variant}.body`)}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {reset && (
            <CTAButton onClick={reset} variant="primary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t("retry")}
            </CTAButton>
          )}
          {/* A plain Link, not CTAButton: this is the escape hatch, and it has to
              work even if the retry keeps failing. */}
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-6 py-3 font-display text-base font-semibold text-[var(--text-primary)] transition-colors hover:border-primary-400 hover:bg-[var(--accent-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {t("home")}
          </Link>
        </div>

        {/* The digest is the only thing that ties a visitor's report to a server
            log line in production, so it is shown rather than swallowed. */}
        {digest && (
          <p className="mt-8 font-mono text-xs text-[var(--text-muted)]">
            {t("reference", { id: digest })}
          </p>
        )}

        {process.env.NODE_ENV === "development" && error && (
          <details className="mt-8 text-start">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--text-muted)]">
              {t("devDetails")}
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-start font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
              {error.stack ?? error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
