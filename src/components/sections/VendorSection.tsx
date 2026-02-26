"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { useInView } from "framer-motion";
import { Upload, Bot, Banknote, CheckCircle } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import CTAButton from "@/components/ui/CTAButton";
import DashboardMockup from "@/components/ui/DashboardMockup";
import { useTranslations } from "next-intl";

export default function VendorSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const shouldReduce = useReducedMotion();
  const t = useTranslations("vendor");

  const steps = [
    { icon: Upload, titleKey: "steps.uploadTitle" as const, descKey: "steps.uploadDesc" as const },
    { icon: Bot, titleKey: "steps.aiTitle" as const, descKey: "steps.aiDesc" as const },
    { icon: Banknote, titleKey: "steps.revenueTitle" as const, descKey: "steps.revenueDesc" as const },
  ];

  return (
    <section
      id="vendors"
      className="section-padding bg-[var(--bg)] relative overflow-hidden"
      aria-labelledby="vendor-title"
    >
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124,58,237,0.06), transparent 70%)" }} />

      <div className="container-xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center" ref={ref}>
          {/* Left: content */}
          <AnimatedSection direction="left">
            <SectionLabel className="mb-6">{t("sectionLabel")}</SectionLabel>
            <h2 id="vendor-title" className="font-display text-section text-[var(--text-primary)] mb-4">
              {t("title1")}<br />
              <span className="text-gradient">{t("title2")}</span>
            </h2>
            <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-8 max-w-lg">
              {t("subtitle")}
            </p>

            {/* Steps */}
            <div className="space-y-4 mb-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.titleKey}
                  initial={{ opacity: 0, x: shouldReduce ? 0 : -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.15 + 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-4 p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] hover:border-primary-400/40 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                    <step.icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-0.5">{t(step.titleKey)}</h3>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t(step.descKey)}</p>
                  </div>
                  <CheckCircle className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5 ml-auto" />
                </motion.div>
              ))}
            </div>

            <CTAButton variant="primary" size="md" showArrow href="#">
              {t("ctaPrimary")}
            </CTAButton>
          </AnimatedSection>

          {/* Right: Dashboard mockup */}
          <AnimatedSection direction="right" delay={0.2}>
            <DashboardMockup variant="vendor" />
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
