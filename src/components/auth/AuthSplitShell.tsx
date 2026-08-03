"use client";
/**
 * AuthSplitShell — the two-pane frame behind /login and /register.
 *
 * One card, split down the middle: the warm-neutral form pane on the leading
 * side, the always-dark emerald AuthShowcase on the trailing side, and a switch
 * medallion sitting on the seam that flips between signing in and signing up.
 * Below `lg` the showcase pane is dropped for a compact banner above the form,
 * so a phone gets the brand note without losing the fold.
 *
 * The shell carries its own logo and locale/theme controls, which is why the
 * (auth) layout skips its header on these two routes — see that file.
 */
import Link from "next/link";
import { ArrowLeftRight, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { BRAND } from "@/lib/constants";
import type { UiRole } from "@/lib/auth/auth.types";
import { cn } from "@/lib/utils";
import AuthPageControls from "@/components/auth/AuthPageControls";
import AuthShowcase from "@/components/auth/AuthShowcase";

interface AuthSplitShellProps {
  mode: "login" | "register";
  title: string;
  subtitle?: string;
  /** Small pill above the title — usually the mode name. */
  eyebrow?: string;
  /** Step labels, in order. Omit to hide the stepper (terminal branches). */
  steps?: string[];
  /** 1-based index of the active step. */
  currentStep?: number;
  /**
   * Called with a 1-based step index when the visitor clicks a step they have
   * already been through. Steps ahead of the current one stay inert — they
   * depend on choices that haven't been made yet.
   */
  onStepSelect?: (step: number) => void;
  /** Drives the showcase pane's copy and accent. */
  role?: UiRole | null;
  children: React.ReactNode;
  /** Rendered under a hairline at the bottom of the form pane. */
  footer?: React.ReactNode;
}

function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: string[];
  current: number;
  onSelect?: (step: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isDone = n < current;
        // Only completed steps are navigable: step 2 has no meaning until a
        // role has been picked on step 1.
        const isClickable = Boolean(onSelect) && isDone;

        const body = (
          <>
            <span
              className={cn(
                "grid h-5 w-5 place-items-center rounded-full text-[10px] transition-colors duration-200",
                isCurrent
                  ? "bg-primary-600 text-white"
                  : isDone
                    ? "bg-[var(--accent-light)] text-primary-600 group-hover:bg-primary-600 group-hover:text-white"
                    : "bg-[var(--bg-muted)] text-[var(--text-subtle)]"
              )}
            >
              {n}
            </span>
            {label}
          </>
        );

        const shared =
          "flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider transition-colors duration-200";

        return (
          <li key={label} className="flex items-center gap-2">
            {isClickable ? (
              <button
                type="button"
                onClick={() => onSelect?.(n)}
                className={cn(
                  shared,
                  "group rounded-full text-primary-600 hover:text-primary-700",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                )}
              >
                {body}
              </button>
            ) : (
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={cn(shared, isCurrent ? "text-primary-600" : "text-[var(--text-subtle)]")}
              >
                {body}
              </span>
            )}
            {i < steps.length - 1 && <span className="h-px w-6 bg-[var(--border)]" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function AuthSplitShell({
  mode,
  title,
  subtitle,
  eyebrow,
  steps,
  currentStep = 1,
  onStepSelect,
  role = null,
  children,
  footer,
}: AuthSplitShellProps) {
  const t = useTranslations("auth");

  // The medallion flips to the other side of the auth pair.
  const switchHref = mode === "login" ? "/register" : "/login";
  const switchLabel = mode === "login" ? t("createAccount") : t("signInLink");

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative mx-auto w-full max-w-6xl",
        "rounded-[28px] border border-[var(--border)] bg-[var(--surface)]",
        "shadow-[var(--shadow-xl)] overflow-hidden",
        "grid lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)]"
      )}
    >
      {/* ── Form pane ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col px-6 py-7 sm:px-10 sm:py-9 lg:px-12">
        {/* Brand row */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2" aria-label={t("backToHome")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow-primary transition-transform duration-200 group-hover:scale-110">
              <Zap className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)]">
              {BRAND.name}
            </span>
          </Link>
          <AuthPageControls />
        </div>

        {/* Compact brand banner — stands in for the showcase pane below lg. */}
        <AuthShowcase mode={mode} role={role} compact className="mt-6 lg:hidden" />

        {/* Heading block */}
        <div className="mt-8 lg:mt-12">
          {eyebrow && (
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary-400/30 bg-[var(--accent-light)] px-3 py-1 text-xs font-display font-semibold text-primary-600">
              <Zap className="h-3 w-3" aria-hidden="true" />
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-[var(--text-primary)] sm:text-[2.35rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{subtitle}</p>
          )}
          {steps && steps.length > 1 && (
            <div className="mt-5">
              <Stepper steps={steps} current={currentStep} onSelect={onStepSelect} />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="mt-7 flex-1">{children}</div>

        {footer && (
          <div className="mt-8 border-t border-[var(--border)] pt-5 text-center text-sm text-[var(--text-muted)]">
            {footer}
          </div>
        )}
      </div>

      {/* ── Showcase pane ──────────────────────────────────────────────────── */}
      <div className="relative hidden lg:block">
        {/* Switch medallion — straddles the join and swaps sign-in for sign-up.
            The ring is the form pane's own surface colour, so it reads as a
            punch-out rather than a sticker. */}
        <Link
          href={switchHref}
          aria-label={switchLabel}
          title={switchLabel}
          className={cn(
            "group absolute top-1/2 -start-6 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center",
            "rounded-full bg-gradient-to-br from-primary-500 to-primary-700 ring-4 ring-[var(--surface)]",
            "transition-transform duration-200 hover:scale-110 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-primary-500"
          )}
        >
          <ArrowLeftRight className="h-5 w-5 text-white" aria-hidden="true" />
          {/* Names what the medallion does, on hover / keyboard focus. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-full mt-3 whitespace-nowrap rounded-full",
              "bg-[var(--surface-inverse)] px-2.5 py-1 font-display text-[11px] font-semibold text-[var(--text-inverse)]",
              "opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
            )}
          >
            {switchLabel}
          </span>
        </Link>

        <AuthShowcase mode={mode} role={role} />
      </div>
    </motion.div>
  );
}
