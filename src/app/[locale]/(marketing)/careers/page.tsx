import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/marketing/Breadcrumbs";
import CareersIllustration from "@/components/illustrations/CareersIllustration.generated";
import EmbeddedForm from "@/components/marketing/EmbeddedForm";
import {
  CheckList,
  CtaBand,
  PageHeader,
  Prose,
  RelatedLinks,
  Section,
  TextLink,
} from "@/components/marketing/parts";
import { breadcrumbJsonLd, jobPostingJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale, localePath } from "@/i18n/routing";
import { CAREERS_FORM_URL } from "@/lib/marketing/forms";
import { EMPLOYMENT_TYPE, HIRING_OPEN, OPENINGS } from "@/lib/marketing/careers";
import { cn } from "@/lib/utils";

const PATH = "/careers";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("careers.metaTitle"),
    description: t("careers.metaDescription"),
    alternates: localeAlternates(locale, PATH),
    openGraph: {
      title: t("careers.metaTitle"),
      description: t("careers.metaDescription"),
      url: localePath(locale, PATH),
    },
  };
}

export default async function CareersPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "pages" });

  const trail = [
    { name: t("common.home"), path: "/" },
    { name: t("nav.careers"), path: PATH },
  ];

  const practices = [1, 2, 3, 4, 5].map((i) => t(`careers.how.i${i}`));

  // Structured data for the roles is emitted only when they are genuinely open.
  // See the comment on HIRING_OPEN — a JobPosting for a role nobody can be hired
  // into is fabricated markup, not an SEO shortcut.
  const jobNodes = HIRING_OPEN
    ? OPENINGS.map((opening) =>
        jobPostingJsonLd(locale, PATH, {
          id: opening.id,
          title: t(`careers.roles.${opening.id}.title`),
          description: t(`careers.roles.${opening.id}.body`),
          employmentType: EMPLOYMENT_TYPE[opening.commitment],
          datePosted: opening.datePosted,
        })
      )
    : [];

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(locale, trail), ...jobNodes]} />

      <PageHeader
        eyebrow={t("careers.eyebrow")}
        title={t("careers.title")}
        lead={HIRING_OPEN ? t("careers.leadOpen") : t("careers.leadClosed")}
        breadcrumbs={<Breadcrumbs trail={trail} label={t("common.breadcrumbLabel")} />}
        illustration={<CareersIllustration />}
      />

      <Section title={t("careers.why.title")}>
        <Prose
          paragraphs={[t("careers.why.p1"), t("careers.why.p2"), t("careers.why.p3")]}
        />
      </Section>

      <Section title={t("careers.how.title")} lead={t("careers.how.lead")} tone="subtle">
        <CheckList items={practices} columns={1} />
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          {t("careers.how.note")}
        </p>
      </Section>

      <Section
        title={t("careers.roles.title")}
        lead={HIRING_OPEN ? t("careers.roles.leadOpen") : t("careers.roles.leadClosed")}
      >
        {/* Shaded while hiring is closed: the roles are real shapes of work, but
            nothing is open, so they read as dimmed and carry a plain label
            rather than pretending to be a live vacancy. Flipping HIRING_OPEN
            restores full contrast and the apply affordance. */}
        <ul className="grid gap-4 sm:grid-cols-2">
          {OPENINGS.map((opening) => (
            <li
              key={opening.id}
              className={cn(
                "card p-6 transition-all duration-300",
                HIRING_OPEN
                  ? "hover:-translate-y-1 hover:border-role-soft hover:shadow-lg"
                  : "opacity-70"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("tag", !HIRING_OPEN && "tag-muted")}>
                  {HIRING_OPEN ? t("careers.roles.openBadge") : t("careers.roles.closedBadge")}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                  {t(`careers.teams.${opening.team}`)} ·{" "}
                  {t(`careers.commitments.${opening.commitment}`)}
                </span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-[var(--text-primary)]">
                {t(`careers.roles.${opening.id}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                {t(`careers.roles.${opening.id}.body`)}
              </p>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                {t("careers.roles.location")}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={HIRING_OPEN ? t("careers.form.titleOpen") : t("careers.form.titleClosed")}
        lead={HIRING_OPEN ? t("careers.form.leadOpen") : t("careers.form.leadClosed")}
        tone="subtle"
      >
        <EmbeddedForm
          src={CAREERS_FORM_URL}
          title={t("careers.form.frameTitle")}
          note={t("careers.form.note")}
          fallbackLabel={t("common.openFormNewTab")}
        />
      </Section>

      <Section title={t("careers.elsewhere.title")}>
        <Prose paragraphs={[t("careers.elsewhere.p1"), t("careers.elsewhere.p2")]} />
        <p className="mt-5 text-sm">
          <TextLink href="/agencies">{t("careers.elsewhere.link")}</TextLink>
        </p>
      </Section>

      <RelatedLinks
        title={t("common.keepReading")}
        links={[
          { href: "/about", label: t("nav.about"), body: t("about.lead") },
          { href: "/agencies", label: t("nav.agencies"), body: t("agencies.lead") },
          { href: "/contact", label: t("nav.contact"), body: t("contact.relatedBody") },
        ]}
      />

      <CtaBand
        title={t("careers.cta.title")}
        body={t("careers.cta.body")}
        finePrint={t("careers.cta.finePrint")}
        primary={{ href: "/contact", label: t("careers.cta.primary") }}
        secondary={{ href: "/about", label: t("careers.cta.secondary") }}
      />
    </>
  );
}
