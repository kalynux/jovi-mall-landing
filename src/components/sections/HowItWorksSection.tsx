"use client";
import SectionLabel from "@/components/ui/SectionLabel";
import FlowDiagram from "@/components/animations/FlowDiagram";
import AnimatedSection from "@/components/ui/AnimatedSection";
import { useTranslations } from "next-intl";

export default function HowItWorksSection() {
  const t = useTranslations("howItWorks");

  const stats = [
    { value: "<2s", labelKey: "stats.aiResponse" as const },
    { value: "99.9%", labelKey: "stats.uptime" as const },
    { value: "40+", labelKey: "stats.payments" as const },
    { value: "15+", labelKey: "stats.cities" as const },
  ];

  return (
    <section
      id="how-it-works"
      className="section-padding bg-[var(--bg-subtle)] relative overflow-hidden"
      aria-labelledby="how-it-works-title"
    >
      {/* Background accent */}
      <div className="absolute inset-0">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-400/30 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-400/30 to-transparent" />
      </div>

      <div className="container-xl relative z-10">
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <div className="flex justify-center mb-4">
            <SectionLabel>{t("sectionLabel")}</SectionLabel>
          </div>
          <h2 id="how-it-works-title" className="font-display text-section mb-4 text-[var(--text-primary)]">
            {t("title1")}{" "}
            <span className="text-gradient">{t("title2")}</span>
            <br className="hidden sm:block" />
            {" "}{t("title3")}
          </h2>
          <p className="text-base text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </AnimatedSection>

        {/* Flow */}
        <FlowDiagram />

        {/* Bottom stat strip */}
        <AnimatedSection
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4"
          delay={0.3}
        >
          {stats.map((stat) => (
            <div
              key={stat.labelKey}
              className="card p-4 text-center"
            >
              <div className="font-display text-2xl font-bold text-gradient mb-1">{stat.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{t(stat.labelKey)}</div>
            </div>
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}
