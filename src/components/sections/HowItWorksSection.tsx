"use client";
import SectionLabel from "@/components/ui/SectionLabel";
import FlowDiagram from "@/components/animations/FlowDiagram";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionShell from "@/components/ui/SectionShell";
import { useTranslations } from "next-intl";

export default function HowItWorksSection() {
  const t = useTranslations("howItWorks");

  const stats = [
    { value: "<2s", labelKey: "stats.aiResponse" as const },
    { value: "99.9%", labelKey: "stats.uptime" as const },
    { value: "Mobile", labelKey: "stats.payments" as const },
    { value: "15+", labelKey: "stats.cities" as const },
  ];

  return (
    <SectionShell id="how-it-works" glow="top" containerClassName="text-center">
      {/* Header */}
      <AnimatedSection className="text-center mb-10 lg:mb-12">
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
        className="mt-10 lg:mt-12 grid grid-cols-2 md:grid-cols-4 gap-4"
        delay={0.3}
      >
        {stats.map((stat) => (
          <div
            key={stat.labelKey}
            className="glass-strong rounded-2xl p-4 text-center"
          >
            <div className="font-display text-2xl font-bold text-gradient mb-1">{stat.value}</div>
            <div className="text-xs text-[var(--text-muted)]">{t(stat.labelKey)}</div>
          </div>
        ))}
      </AnimatedSection>
    </SectionShell>
  );
}
