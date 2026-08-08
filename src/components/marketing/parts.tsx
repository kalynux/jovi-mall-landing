/**
 * The building blocks every standalone marketing page is assembled from.
 *
 * All server components on purpose. These pages exist to be read — by a person
 * who arrived from a search result, and by the crawler that put them there — so
 * every word ships in the HTML with no hydration in the path. The landing page's
 * viewport-filling SectionShell is deliberately not reused: it centres one idea
 * per screen, which is right for a scroll narrative and wrong for a document.
 *
 * Spacing, colour and radius all come from the same CSS variables and utility
 * classes as the rest of the site (`card`, `container-xl`, `text-gradient`,
 * `--text-primary`, the `role-*` accents), so these read as the same product.
 */
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Role accent class for a page, driving `--role` for its children. */
export type Accent = "role-accent" | "role-vendor" | "role-agency" | "role-agent" | "role-customer";

/* ─── Page header ─────────────────────────────────────────────────────────── */

export function PageHeader({
  accent = "role-accent",
  eyebrow,
  title,
  lead,
  breadcrumbs,
  actions,
  aside,
}: {
  accent?: Accent;
  eyebrow: string;
  title: ReactNode;
  lead: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className={cn("relative overflow-hidden border-b border-[var(--border)]", accent)}>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% -10%, color-mix(in srgb, var(--role) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="container-xl relative z-10 px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-14 lg:pb-20">
        {breadcrumbs}
        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-role">
              {eyebrow}
            </p>
            <h1 className="mt-3 font-display text-hero-lg text-[var(--text-primary)]">{title}</h1>
            <p className="mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-[var(--text-secondary)]">
              {lead}
            </p>
            {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
          </div>
          {aside && <div className="lg:max-w-xs">{aside}</div>}
        </div>
      </div>
    </header>
  );
}

/* ─── Sections ────────────────────────────────────────────────────────────── */

export function Section({
  id,
  title,
  lead,
  children,
  tone = "plain",
  headingLevel = "h2",
}: {
  id?: string;
  title?: string;
  lead?: string;
  children: ReactNode;
  tone?: "plain" | "subtle";
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <section
      id={id}
      className={cn(
        "border-b border-[var(--border)] py-14 lg:py-20",
        tone === "subtle" && "bg-[var(--bg-subtle)]"
      )}
    >
      <div className="container-xl px-4 sm:px-6 lg:px-8">
        {title && (
          <Heading className="font-display text-section max-w-3xl text-[var(--text-primary)]">
            {title}
          </Heading>
        )}
        {lead && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
            {lead}
          </p>
        )}
        <div className={cn(title || lead ? "mt-9" : undefined)}>{children}</div>
      </div>
    </section>
  );
}

/** Body copy. Paragraphs come from the catalog as an array of strings. */
export function Prose({ paragraphs, className }: { paragraphs: string[]; className?: string }) {
  return (
    <div className={cn("max-w-2xl space-y-4", className)}>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-base leading-relaxed text-[var(--text-secondary)]">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

/* ─── Cards ───────────────────────────────────────────────────────────────── */

export function CardGrid({ columns = 3, children }: { columns?: 2 | 3 | 4; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4"
      )}
    >
      {children}
    </div>
  );
}

export function InfoCard({
  title,
  body,
  meta,
}: {
  title: string;
  body: string;
  meta?: string;
}) {
  return (
    <div className="card p-5">
      {meta && (
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-role">
          {meta}
        </p>
      )}
      <h3 className={cn("font-display text-base font-semibold text-[var(--text-primary)]", meta && "mt-2")}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{body}</p>
    </div>
  );
}

/** Numbered walkthrough — the "how it works" spine of the role pages. */
export function StepList({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title} className="card flex gap-4 p-5">
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-role-soft font-display text-sm font-bold text-role"
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Plain checklist — "what's included", "what you need". */
export function CheckList({ items, columns = 2 }: { items: string[]; columns?: 1 | 2 }) {
  return (
    <ul className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <svg
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-role"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm leading-relaxed text-[var(--text-secondary)]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── Data table ──────────────────────────────────────────────────────────── */

/**
 * Wrapped in its own horizontal scroller: a wide table is the one thing on these
 * pages that would otherwise make the whole document scroll sideways on a small
 * phone, which is most of the audience.
 */
export function DataTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-[var(--bg-subtle)]">
            {head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="px-4 py-3 text-start font-display text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-[var(--border)]">
              {row.map((cell, i) => (
                <td
                  key={cell + i}
                  className={cn(
                    "px-4 py-3 text-[var(--text-secondary)]",
                    i === 0 && "font-medium text-[var(--text-primary)]"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Links ───────────────────────────────────────────────────────────────── */

/** Plain anchor styling used inside body copy and link lists. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-role underline decoration-[color-mix(in_srgb,var(--role)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--role)]"
    >
      {children}
    </Link>
  );
}

/**
 * The related-pages block at the foot of every page.
 *
 * Not decoration: these pages only rank if they link to each other, and a
 * visitor who read /vendors and wants numbers should not have to find /pricing
 * in the footer.
 */
export function RelatedLinks({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; body: string }[];
}) {
  return (
    <Section title={title} tone="subtle">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="card p-5 transition-colors hover:border-role-soft"
          >
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
              {link.label}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{link.body}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ─── Closing call to action ──────────────────────────────────────────────── */

export function CtaBand({
  title,
  body,
  primary,
  secondary,
  finePrint,
}: {
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  finePrint?: string;
}) {
  return (
    <section className="py-16 lg:py-24">
      <div className="container-xl px-4 sm:px-6 lg:px-8">
        <div className="card relative overflow-hidden p-8 text-center lg:p-14">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 70% at 50% 0%, color-mix(in srgb, var(--role) 14%, transparent), transparent 70%)",
            }}
          />
          <div className="relative z-10">
            <h2 className="font-display text-section text-[var(--text-primary)]">{title}</h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--text-secondary)]">
              {body}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={primary.href}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary-700 to-primary-500 px-6 py-3 font-display font-semibold text-white shadow-[0_0_20px_rgba(13,160,107,0.35)] transition-shadow hover:shadow-[0_0_34px_rgba(13,160,107,0.6)]"
              >
                {primary.label}
              </Link>
              {secondary && (
                <Link
                  href={secondary.href}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-6 py-3 font-display font-semibold text-[var(--text-primary)] transition-colors hover:border-primary-400 hover:bg-[var(--accent-light)]"
                >
                  {secondary.label}
                </Link>
              )}
            </div>
            {finePrint && <p className="mt-5 text-xs text-[var(--text-muted)]">{finePrint}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
