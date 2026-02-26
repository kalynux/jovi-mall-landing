"use client";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef } from "react";
import { Package, User2, TrendingUp } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import CTAButton from "@/components/ui/CTAButton";
import DashboardMockup from "@/components/ui/DashboardMockup";
import { useTranslations } from "next-intl";

export default function AgencySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const shouldReduce = useReducedMotion();
  const t = useTranslations("agency");

  const flow = [
    { icon: Package, labelKey: "flow.orderIn" as const, color: "bg-[var(--accent-light)] text-primary-600" },
    { icon: User2, labelKey: "flow.agentAssigned" as const, color: "bg-[var(--accent-light)] text-primary-600" },
    { icon: TrendingUp, labelKey: "flow.earnCommission" as const, color: "bg-wa-light text-wa-dark" },
  ];

  const benefits = [
    "benefits.dispatch" as const,
    "benefits.tracking" as const,
    "benefits.payout" as const,
  ];

  return (
    <section
      id="agencies"
      className="section-padding bg-[var(--bg-subtle)] relative overflow-hidden"
      aria-labelledby="agency-title"
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-400/30 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary-400/30 to-transparent" />

      <div className="container-xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center" ref={ref}>
          {/* Left: Dashboard */}
          <AnimatedSection direction="left" delay={0.1}>
            <DashboardMockup variant="agency" />
          </AnimatedSection>

          {/* Right: Content */}
          <AnimatedSection direction="right">
            <SectionLabel className="mb-6">{t("sectionLabel")}</SectionLabel>
            <h2 id="agency-title" className="font-display text-section text-[var(--text-primary)] mb-4">
              {t("title1")}<br />
              <span className="text-gradient">{t("title2")}</span>
            </h2>
            <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-8 max-w-lg">
              {t("subtitle")}
            </p>

            {/* Animated flow */}
            <div className="flex items-center gap-3 mb-8 flex-wrap" aria-label={t("ariaLabel")}>
              {flow.map((item, i) => (
                <motion.div
                  key={item.labelKey}
                  initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.85 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: i * 0.2 + 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.color} border border-[var(--border)]`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-display font-medium text-[var(--text-secondary)] whitespace-nowrap">{t(item.labelKey)}</span>
                </motion.div>
              ))}
              <div className="flex items-center gap-3 sm:order-none order-last">
                <span className="text-[var(--text-muted)] text-sm">→</span>
                <span className="text-[var(--text-muted)] text-sm">→</span>
              </div>
            </div>

            {/* Key benefits */}
            <ul className="space-y-2 mb-8">
              {benefits.map((bKey) => (
                <li key={bKey} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                  {t(bKey)}
                </li>
              ))}
            </ul>

            <CTAButton variant="primary" size="md" href="#" showArrow>
              {t("ctaPrimary")}
            </CTAButton>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
