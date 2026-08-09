"use client";
import { motion, useInView } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/reduced-motion";
import { useRef } from "react";
import { Package, User2, TrendingUp } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionShell from "@/components/ui/SectionShell";
import RoleCtaButton from "@/components/ui/RoleCtaButton";
import LinkButton from "@/components/ui/LinkButton";
import DashboardMockup from "@/components/ui/DashboardMockup";
import { useTranslations } from "next-intl";

export default function AgencySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const shouldReduce = useReducedMotionSafe();
  const t = useTranslations("agency");

  const flow = [
    { icon: Package, labelKey: "flow.orderIn" as const, color: "bg-role-soft text-role" },
    { icon: User2, labelKey: "flow.agentAssigned" as const, color: "bg-role-soft text-role" },
    { icon: TrendingUp, labelKey: "flow.earnCommission" as const, color: "bg-wa-light text-wa-dark" },
  ];

  const benefits = [
    "benefits.dispatch" as const,
    "benefits.tracking" as const,
    "benefits.payout" as const,
  ];

  return (
    <SectionShell id="agencies" accent="role-agency" glow="center">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center" ref={ref}>
        {/* Left: Dashboard */}
        <AnimatedSection direction="left" delay={0.1}>
          <DashboardMockup variant="agency" />
        </AnimatedSection>

        {/* Right: Content */}
        <AnimatedSection direction="right">
          <SectionLabel variant="role" className="mb-5">{t("sectionLabel")}</SectionLabel>
          <h2 id="agency-title" className="font-display text-section text-[var(--text-primary)] mb-4">
            {t("title1")}<br />
            <span className="text-gradient">{t("title2")}</span>
          </h2>
          <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-6 max-w-lg">
            {t("subtitle")}
          </p>

          {/* Animated flow */}
          <div className="flex items-center gap-3 mb-6 flex-wrap" aria-label={t("ariaLabel")}>
            {flow.map((item, i) => (
              <motion.div
                key={item.labelKey}
                initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.85 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: i * 0.18 + 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
          <ul className="space-y-2 mb-7">
            {benefits.map((bKey) => (
              <li key={bKey} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-role mt-1.5 flex-shrink-0" />
                {t(bKey)}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <RoleCtaButton role="agency" fallbackLabel={t("ctaPrimary")} size="md" showArrow />
            {/* The section is a summary; the page is the answer. */}
            <LinkButton href="/agencies" variant="secondary" size="md" showArrow>
              {t("ctaSecondary")}
            </LinkButton>
          </div>
        </AnimatedSection>
      </div>
    </SectionShell>
  );
}
