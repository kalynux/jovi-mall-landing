"use client";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef } from "react";
import { Bell, MapPin, DollarSign } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import CTAButton from "@/components/ui/CTAButton";
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
  const shouldReduce = useReducedMotion();
  const t = useTranslations("agent");

  return (
    <section
      id="agents"
      className="section-padding bg-[var(--bg)] relative overflow-hidden"
      aria-labelledby="agent-title"
    >
      <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(37,211,102,0.06), transparent 70%)" }} />

      <div className="container-xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center" ref={ref}>
          {/* Left: Content */}
          <AnimatedSection direction="left">
            <SectionLabel variant="wa" className="mb-6">{t("sectionLabel")}</SectionLabel>
            <h2 id="agent-title" className="font-display text-section text-[var(--text-primary)] mb-4">
              {t("title1")}{" "}
              <span className="text-gradient-wa">{t("title2")}</span>
              <br />{t("title3")}
            </h2>
            <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-8 max-w-lg">
              {t("subtitle")}
            </p>

            {/* Steps */}
            <div className="space-y-3 mb-8">
              {DELIVERY_STEPS.map((s, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <motion.div
                    key={s.step}
                    initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: i * 0.15 + 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-muted)] border border-[var(--border-medium)] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-wa-dark dark:text-wa" />
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

            <CTAButton variant="primary" size="md" href="#" showArrow>
              {t("ctaPrimary")}
            </CTAButton>
          </AnimatedSection>

          {/* Right: Dashboard */}
          <AnimatedSection direction="right" delay={0.2}>
            <DashboardMockup variant="agent" />
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
