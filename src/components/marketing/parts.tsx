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
 *
 * The conviction dial is turned up from the landing's calmer document tier: the
 * header reads as a real hero, the cards carry depth and a role-tinted hover,
 * and the closing band is an inverted, glow-lit peak. Every device here is one
 * the brand already owns (role glows, the pill label, the green gradient, real
 * elevation) — pushed to full strength, not invented, and still zero-hydration.
 */
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { CtaRole } from "@/lib/auth/useRoleCta";
import RoleCtaButton from "@/components/ui/RoleCtaButton";

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
  illustration,
}: {
  accent?: Accent;
  eyebrow: string;
  title: ReactNode;
  lead: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  /**
   * The page's animated scene. Purely atmospheric — it is hidden from assistive
   * tech and sized by `.il-hero-art` in globals.css, which keeps it in the flow
   * beneath the copy on phones and only promotes it to a background layer at
   * `lg`, where there is room for it to sit behind the text without costing
   * legibility.
   */
  illustration?: ReactNode;
}) {
  return (
    // `overflow-x-clip` rather than `overflow-hidden`: the ambient washes still
    // need containing sideways, but the illustration is meant to bleed past the
    // bottom edge into the section below, which `hidden` would cut off.
    <header
      className={cn(
        "relative overflow-x-clip overflow-y-visible border-b border-[var(--border)]",
        accent
      )}
    >
      {/* Layered ambient: a broad role wash from the top edge, a concentrated
          glow off the corner for depth, and a whisper of grain — all static,
          so the hero reads loud without a single frame of animation on the thin
          connections these pages are written for. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(ellipse 72% 62% at 50% -12%, color-mix(in srgb, var(--role) 20%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -end-24 -top-28 -z-0 h-80 w-80 rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle at center, color-mix(in srgb, var(--role) 24%, transparent), transparent 70%)",
          filter: "blur(64px)",
        }}
      />
      <div aria-hidden="true" className="grain absolute inset-0 -z-0 opacity-[0.18]" />
      {/* Role-tinted hairline sits on top of the neutral border-b. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--role) 45%, transparent), transparent)",
        }}
      />
      <div className="container-xl relative z-10 px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-24 lg:pb-24">
        {breadcrumbs}
        {/* The copy keeps its own stacking level so the illustration, which sits
            at z-index -1 inside this container, can never wash over it. */}
        <div className="relative z-10 mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-pill border border-role-soft bg-role-soft px-3.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-role">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-role" />
              {eyebrow}
            </p>
            <h1 className="mt-5 font-display text-hero-lg lg:text-hero-xl text-[var(--text-primary)]">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--text-secondary)] sm:text-xl">
              {lead}
            </p>
            {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
          </div>
          {aside && <div className="lg:max-w-xs">{aside}</div>}
        </div>
        {illustration && (
          <div aria-hidden="true" className="il-hero-art">
            {illustration}
          </div>
        )}
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
        "relative border-b border-[var(--border)] py-16 lg:py-24",
        tone === "subtle" && "bg-[var(--bg-subtle)]"
      )}
    >
      {/* A soft role glow crowns the subtle-tone bands, so alternating sections
          pulse down the page instead of reading as one flat column. */}
      {tone === "subtle" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(ellipse 62% 45% at 50% 0%, color-mix(in srgb, var(--role) 8%, transparent), transparent 70%)",
          }}
        />
      )}
      <div className="container-xl relative z-10 px-4 sm:px-6 lg:px-8">
        {title && (
          <Heading className="font-display text-section max-w-3xl text-[var(--text-primary)]">
            {title}
          </Heading>
        )}
        {/* The recurring section marker: a short green-brand rule that ties every
            heading on every page to the same signature. */}
        {title && (
          <div
            aria-hidden="true"
            className="mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-primary-600 to-primary-400"
          />
        )}
        {lead && (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
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
    <div className="card group p-6 transition-all duration-300 hover:-translate-y-1 hover:border-role-soft hover:shadow-lg">
      {meta && (
        <p className="inline-flex items-center rounded-pill border border-role-soft bg-role-soft px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-role">
          {meta}
        </p>
      )}
      <h3
        className={cn(
          "font-display text-lg font-semibold text-[var(--text-primary)] transition-colors group-hover:text-role",
          meta && "mt-3"
        )}
      >
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
        <li
          key={step.title}
          className="card group flex gap-4 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-role-soft hover:shadow-lg"
        >
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-role-soft bg-role-soft font-display text-base font-bold text-role"
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)] transition-colors group-hover:text-role">
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
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-role-soft text-role"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
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
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] shadow-sm">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-role-soft">
            {head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="px-4 py-3.5 text-start font-display text-xs font-bold uppercase tracking-wider text-role"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[0]}
              className="border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-subtle)]"
            >
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
      className="font-semibold text-role underline decoration-[color-mix(in_srgb,var(--role)_45%,transparent)] underline-offset-4 transition-colors hover:decoration-[var(--role)]"
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
            className="card group flex flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:border-role-soft hover:shadow-lg"
          >
            <h3 className="font-display text-base font-semibold text-[var(--text-primary)] transition-colors group-hover:text-role">
              {link.label}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{link.body}</p>
            <span
              aria-hidden="true"
              className="mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-role-soft text-role transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
            >
              <svg
                className="h-4 w-4 rtl:rotate-180"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

/* ─── Closing call to action ──────────────────────────────────────────────── */

/**
 * A CTA destination that may live outside the app.
 *
 * The customer CTA is a `wa.me` deep link, and the localised `Link` is the
 * wrong element for it twice over: it exists to prefix in-app paths with the
 * locale, and an outward hop should not replace the page the reader is on. An
 * absolute href therefore falls back to a plain anchor with the usual
 * `noopener` guard; everything else routes as before.
 */
function CtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function CtaBand({
  title,
  body,
  primary,
  primaryRole,
  secondary,
  finePrint,
}: {
  title: string;
  body: string;
  primary: { href: string; label: string };
  /**
   * Set this when the primary action is "sign up as <role>". The button becomes
   * a small client island that knows who is reading: a signed-in vendor gets
   * their dashboard instead of a registration form. Everything else on the band
   * stays server-rendered, and the island's own server output is a link to
   * `primary.href`, so the CTA is still in the HTML a crawler sees.
   */
  primaryRole?: CtaRole;
  secondary?: { href: string; label: string };
  finePrint?: string;
}) {
  return (
    <section className="py-20 lg:py-28">
      <div className="container-xl px-4 sm:px-6 lg:px-8">
        {/* The scroll's crescendo: an always-dark band (the `--bg-invert` token
            exists for exactly this) lit by the page's role glow, so the last
            thing a reader sees is the loudest thing on the page. Text is fixed
            light because the surface is dark in both themes. */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-invert)] p-10 text-center shadow-xl lg:p-16">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 72% at 50% 0%, color-mix(in srgb, var(--role) 32%, transparent), transparent 70%)",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 left-1/2 h-64 w-[38rem] -translate-x-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle at center, rgba(13,160,107,0.35), transparent 70%)",
              filter: "blur(70px)",
            }}
          />
          <div aria-hidden="true" className="grain absolute inset-0 opacity-20" />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--role) 60%, transparent), transparent)",
            }}
          />
          <div className="relative z-10">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {title}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              {body}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              {primaryRole ? (
                <RoleCtaButton role={primaryRole} fallbackLabel={primary.label} variant="primary" size="md" />
              ) : (
                <CtaLink
                  href={primary.href}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary-700 to-primary-500 px-6 py-3 font-display font-semibold text-white shadow-[0_0_20px_rgba(13,160,107,0.35)] transition-shadow hover:shadow-[0_0_34px_rgba(13,160,107,0.6)]"
                >
                  {primary.label}
                </CtaLink>
              )}
              {secondary && (
                <CtaLink
                  href={secondary.href}
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3 font-display font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10"
                >
                  {secondary.label}
                </CtaLink>
              )}
            </div>
            {finePrint && <p className="mt-5 text-xs text-white/50">{finePrint}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
