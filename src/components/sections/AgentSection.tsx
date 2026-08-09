"use client";
import { motion, useInView } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/reduced-motion";
import { useRef } from "react";
import { Bell, MapPin, DollarSign } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionShell from "@/components/ui/SectionShell";
import RoleCtaButton from "@/components/ui/RoleCtaButton";
import LinkButton from "@/components/ui/LinkButton";
import DashboardMockup from "@/components/ui/DashboardMockup";
import { useTranslations } from "next-intl";

const STEP_ICONS = [Bell, MapPin, DollarSign];
type StepStub = { step: string; titleKey: "steps.step01Title" | "steps.step02Title" | "steps.step03Title"; descKey: "steps.step01Desc" | "steps.step02Desc" | "steps.step03Desc" };

const DELIVERY_STEPS: StepStub[] = [
  { step: "01", titleKey: "steps.step01Title", descKey: "steps.step01Desc" },
  { step: "02", titleKey: "steps.step02Title", descKey: "steps.step02Desc" },
  { step: "03", titleKey: "steps.step03Title", descKey: "steps.step03Desc" },
];

export default function AgentSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const shouldReduce = useReducedMotionSafe();
  const t = useTranslations("agent");

  return (
    <SectionShell id="agents" accent="role-agent" glow="top">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center" ref={ref}>
        {/* Left: Content */}
        <AnimatedSection direction="left">
          <SectionLabel variant="role" className="mb-5">{t("sectionLabel")}</SectionLabel>
          <h2 id="agent-title" className="font-display text-section text-[var(--text-primary)] mb-4">
            {t("title1")}{" "}
            <span className="text-gradient-wa">{t("title2")}</span>
            <br />{t("title3")}
          </h2>
          <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-6 max-w-lg">
            {t("subtitle")}
          </p>

          {/* Steps */}
          <div className="space-y-3 mb-7">
            {DELIVERY_STEPS.map((s, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.12 + 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-role-soft border-role-soft border flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-role" />
                  </div>
                  <div>
                    <span className="text-[10px] font-display font-bold text-[var(--text-muted)] uppercase tracking-wider">{t("steps.stepLabel")} {s.step}</span>
                    <h3 className="font-display font-semibold text-sm text-[var(--text-primary)]">{t(s.titleKey)}</h3>
                    <p className="text-xs text-[var(--text-muted)]">{t(s.descKey)}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <RoleCtaButton role="agent" fallbackLabel={t("ctaPrimary")} size="md" showArrow />
            {/* The section is a summary; the page is the answer. */}
            <LinkButton href="/agents" variant="secondary" size="md" showArrow>
              {t("ctaSecondary")}
            </LinkButton>
          </div>
        </AnimatedSection>

        {/* Right: Dashboard */}
        <AnimatedSection direction="right" delay={0.2}>
          <DashboardMockup variant="agent" />
        </AnimatedSection>
      </div>
    </SectionShell>
  );
}
