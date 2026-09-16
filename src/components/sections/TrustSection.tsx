"use client";
import { Bot, Settings2, DollarSign, Globe, Smartphone, ShieldCheck, Unlock, Headset } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionShell from "@/components/ui/SectionShell";
import { TRUST_STATS } from "@/lib/constants";
import { useTranslations } from "next-intl";

// Honest, launch-phase trust signals (no fake investor logos).
const GUARANTEES = [
  { icon: Smartphone, key: "guarantees.payments" as const },
  { icon: ShieldCheck, key: "guarantees.secure" as const },
  { icon: Unlock, key: "guarantees.noLockIn" as const },
  { icon: Headset, key: "guarantees.support" as const },
];
const FEATURE_ICONS = [Bot, Settings2, DollarSign, Globe];
const FEATURE_GRADIENTS = [
  "from-primary-600 to-primary-400",
  "from-primary-500 to-primary-700",
  "from-wa-dark to-wa",
  "from-primary-700 to-primary-500",
];

type FeatureTitleKey = "features.aiTitle" | "features.zeroSetupTitle" | "features.revenueTitle" | "features.scaleTitle";
type FeatureDescKey = "features.aiDesc" | "features.zeroSetupDesc" | "features.revenueDesc" | "features.scaleDesc";
type StatLabelKey = "stats.vendors" | "stats.agencies" | "stats.orders" | "stats.cities";

const FEATURES: { titleKey: FeatureTitleKey; descKey: FeatureDescKey }[] = [
  { titleKey: "features.aiTitle", descKey: "features.aiDesc" },
  { titleKey: "features.zeroSetupTitle", descKey: "features.zeroSetupDesc" },
  { titleKey: "features.revenueTitle", descKey: "features.revenueDesc" },
  { titleKey: "features.scaleTitle", descKey: "features.scaleDesc" },
];

const STAT_KEYS: StatLabelKey[] = ["stats.vendors", "stats.agencies", "stats.orders", "stats.cities"];

export default function TrustSection() {
  const t = useTranslations("trust");

  return (
    <SectionShell id="trust" glow="top">
      {/* Header */}
      <AnimatedSection className="text-center mb-8 lg:mb-10">
        <div className="flex justify-center mb-4">
          <SectionLabel>{t("sectionLabel")}</SectionLabel>
        </div>
        <h2 id="trust-title" className="font-display text-section text-[var(--text-primary)] mb-4">
          {t("title1")}{" "}
          <span className="text-gradient">{t("title2")}</span>
          <br className="hidden sm:block" />
          {t("title3")}
        </h2>
        <p className="text-base text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          {t("subtitle")}
        </p>
      </AnimatedSection>

      {/* Feature tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 lg:mb-12">
        {FEATURES.map((f, i) => {
          const Icon = FEATURE_ICONS[i];
          return (
            <AnimatedSection key={f.titleKey} delay={i * 0.08}>
              <div className="glass-strong rounded-2xl p-5 h-full flex flex-col group transition-all duration-200 hover:-translate-y-0.5">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${FEATURE_GRADIENTS[i]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-2">{t(f.titleKey)}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed flex-1">{t(f.descKey)}</p>
              </div>
            </AnimatedSection>
          );
        })}
      </div>

      {/* Stats Strip — framed as first-year goals, not current counts */}
      <AnimatedSection className="mb-10 lg:mb-12" delay={0.2}>
        <p className="text-center text-xs text-[var(--text-muted)] uppercase tracking-widest font-display font-semibold mb-5">
          {t("statsHeading")}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {TRUST_STATS.map((stat, i) => (
            <div key={stat.value} className="text-center">
              <div className="font-display text-3xl sm:text-4xl font-black text-gradient mb-1">{stat.value}</div>
              <div className="text-sm text-[var(--text-muted)]">{t(STAT_KEYS[i])}</div>
            </div>
          ))}
        </div>
      </AnimatedSection>

      {/* Trust guarantees — honest signals for a launching platform */}
      <AnimatedSection direction="none" delay={0.3}>
        <div className="text-center mb-5">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-display font-semibold">
            {t("promiseHeading")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {GUARANTEES.map(({ icon: Icon, key }) => (
            // Chips, not badges: they keep the glass surface and their own
            // text colour, but take .tag's 2px corner and lose glass-strong's
            // drop shadow (plain .glass is the same surface without it) so they
            // sit in the same squared family as the badges.
            <div
              key={key}
              className="flex items-center gap-2 rounded-[2px] glass px-4 py-2 text-xs font-display font-medium text-[var(--text-secondary)]"
            >
              <Icon className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
              {t(key)}
            </div>
          ))}
        </div>
      </AnimatedSection>
    </SectionShell>
  );
}
