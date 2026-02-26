"use client";
import { Bot, Settings2, DollarSign, Globe } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import { TRUST_STATS } from "@/lib/constants";
import { useTranslations } from "next-intl";

const TRUST_LOGOS = ["Techstars", "Google for Startups", "Y Combinator", "Paystack", "Flutterwave", "MTN"];
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
    <section
      id="trust"
      className="section-padding bg-[var(--bg)] relative overflow-hidden"
      aria-labelledby="trust-title"
    >
      <div className="absolute inset-0 bg-hero-glow opacity-40" />

      <div className="container-xl relative z-10">
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {FEATURES.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <AnimatedSection key={f.titleKey} delay={i * 0.1}>
                <div className="card p-6 h-full flex flex-col group hover:border-primary-400/40 transition-colors">
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

        {/* Stats Strip */}
        <AnimatedSection className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16" delay={0.2}>
          {TRUST_STATS.map((stat, i) => (
            <div key={stat.value} className="text-center">
              <div className="font-display text-3xl sm:text-4xl font-black text-gradient mb-1">{stat.value}</div>
              <div className="text-sm text-[var(--text-muted)]">{t(STAT_KEYS[i])}</div>
            </div>
          ))}
        </AnimatedSection>

        {/* Trust logos */}
        <AnimatedSection direction="none" delay={0.3}>
          <div className="text-center mb-6">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest font-display font-semibold">
              {t("backedBy")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 opacity-50 grayscale hover:opacity-70 hover:grayscale-0 transition-all duration-500">
            {TRUST_LOGOS.map((logo) => (
              <div
                key={logo}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-display font-semibold text-[var(--text-secondary)] whitespace-nowrap"
              >
                {logo}
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
