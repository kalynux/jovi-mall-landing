"use client";
import FlowDiagram from "@/components/animations/FlowDiagram";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionShell from "@/components/ui/SectionShell";
import { useTranslations } from "next-intl";

/**
 * How it works — the six-station pipeline, framed.
 *
 * The section used to close on four stat tiles ("<2s", "99.9%", "Mobile",
 * "15+") whose values were invented in this file and presented as fact. They
 * are gone rather than restyled: there is no honest figure to put in their
 * place yet, and the flow is the section's substance — it reads stronger
 * without a competing row of numbers under it. TrustSection is where measurable
 * claims belong, and it already frames its own as first-year goals.
 *
 * `howItWorks.stats.*` in messages/*.json is now unused.
 */
export default function HowItWorksSection() {
  const t = useTranslations("howItWorks");

  return (
    <SectionShell id="how-it-works" glow="top">
      <AnimatedSection className="mx-auto max-w-3xl text-center">
        <span className="tag">{t("sectionLabel")}</span>
        <h2
          id="how-it-works-title"
          className="mt-6 font-display text-section text-[var(--text-primary)]"
        >
          {t("title1")} <span className="text-gradient">{t("title2")}</span>
          <br className="hidden sm:block" /> {t("title3")}
        </h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-base leading-relaxed text-[var(--text-secondary)] sm:text-[17px]">
          {t("subtitle")}
        </p>
      </AnimatedSection>

      {/* The track gets a frame of its own so the six stations read as one
          object rather than as loose furniture floating in the section. */}
      <AnimatedSection className="mt-10 lg:mt-14" delay={0.1}>
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg sm:p-7 lg:p-10">
          <div
            aria-hidden="true"
            className="grain pointer-events-none absolute inset-0 opacity-[0.16]"
          />
          {/* The one deliberate accent on the frame: a hairline of the section's
              role colour across the top edge, fading out at both ends. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--role) 55%, transparent), transparent)",
            }}
          />
          <FlowDiagram className="relative z-10" />
        </div>
      </AnimatedSection>
    </SectionShell>
  );
}
