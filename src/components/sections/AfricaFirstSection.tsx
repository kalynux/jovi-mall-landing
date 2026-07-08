"use client";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { Smartphone, MessageCircle, Wifi } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionShell from "@/components/ui/SectionShell";
import CTAButton from "@/components/ui/CTAButton";
import { useTranslations } from "next-intl";

const FEATURE_ICONS = [Smartphone, MessageCircle, Wifi];

type FeatureKey = "features.mobileTitle" | "features.whatsappTitle" | "features.dataTitle";
type FeatureDescKey = "features.mobileDesc" | "features.whatsappDesc" | "features.dataDesc";

const FEATURES: { titleKey: FeatureKey; descKey: FeatureDescKey }[] = [
  { titleKey: "features.mobileTitle", descKey: "features.mobileDesc" },
  { titleKey: "features.whatsappTitle", descKey: "features.whatsappDesc" },
  { titleKey: "features.dataTitle", descKey: "features.dataDesc" },
];

function PhoneMockup() {
  const shouldReduce = useReducedMotion();
  const t = useTranslations("africaFirst");
  const ph = useTranslations("africaFirst.phone");

  const chatLines = [
    { from: "customer", textKey: "phone.chat1Customer" as const },
    { from: "ai", textKey: "phone.chat1AI" as const },
    { from: "customer", textKey: "phone.chat2Customer" as const },
    { from: "ai", textKey: "phone.chat2AI" as const },
  ];

  return (
    <div className="relative flex justify-center">
      <motion.div
        animate={{ y: shouldReduce ? 0 : [-8, 8, -8] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        <div className="absolute inset-0 bg-primary-500/20 rounded-[40px] blur-2xl scale-95" />

        <div className="relative w-[200px] sm:w-[240px] bg-surface-900 rounded-[40px] p-3 shadow-2xl border-4 border-surface-800">
          <div className="bg-[var(--bg)] rounded-[30px] overflow-hidden h-[380px] sm:h-[440px] flex flex-col">
            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 text-[9px] text-[var(--text-muted)] font-medium">
              <span>{ph("status")}</span>
              <div className="w-16 h-1.5 bg-surface-900 rounded-full" />
              <span>●●●</span>
            </div>

            {/* WhatsApp header */}
            <div className="bg-[#128C7E] px-3 py-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold text-[9px]">J</span>
              </div>
              <div>
                <div className="text-white text-[10px] font-semibold">{ph("assistantName")}</div>
                <div className="text-white/60 text-[8px]">{ph("assistantSub")}</div>
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 bg-[#ece5dd] p-3 space-y-2 overflow-hidden">
              {chatLines.map((m, i) => (
                <div key={i} className={`flex ${m.from === "customer" ? "justify-end" : "justify-start"}`}>
                  <div className={`text-[9px] px-2 py-1.5 rounded-lg max-w-[80%] ${
                    m.from === "customer" ? "bg-[#d9fdd3] text-gray-700 rounded-br-none" : "bg-white text-gray-700 rounded-bl-none"
                  }`}>
                    {t(m.textKey)}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="bg-[#f0f0f0] p-2 flex items-center gap-1.5">
              <div className="flex-1 bg-white rounded-full px-3 py-1 text-[9px] text-gray-400">{ph("inputPlaceholder")}</div>
              <div className="w-6 h-6 rounded-full bg-[#128C7E] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Floating badges */}
        <motion.div
          animate={{ x: shouldReduce ? 0 : [0, 4, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute -right-6 top-12 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-2 py-1.5 shadow-card"
        >
          <div className="text-[9px] font-display font-bold text-wa-dark">{ph("earnedBadge")}</div>
        </motion.div>
        <motion.div
          animate={{ x: shouldReduce ? 0 : [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1 }}
          className="absolute -left-6 bottom-20 bg-primary-600 text-white rounded-xl px-2 py-1.5 shadow-glow-primary"
        >
          <div className="text-[9px] font-display font-bold">{ph("aiActiveBadge")}</div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function AfricaFirstSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const shouldReduce = useReducedMotion();
  const t = useTranslations("africaFirst");

  return (
    <SectionShell id="why-jovi" glow="top">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center" ref={ref}>
        {/* Left: Phone */}
        <AnimatedSection direction="left" delay={0.1}>
          <PhoneMockup />
        </AnimatedSection>

        {/* Right: Content */}
        <AnimatedSection direction="right">
          <SectionLabel className="mb-5">{t("sectionLabel")}</SectionLabel>
          <h2 id="africa-title" className="font-display text-section text-[var(--text-primary)] mb-4">
            {t("title1")}{" "}
            <span className="text-gradient">{t("title2")}</span>
            <br />
            {t("title3")}
          </h2>
          <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-6 max-w-lg">
            {t("subtitle")}
          </p>

          <div className="space-y-3.5">
            {FEATURES.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <motion.div
                  key={f.titleKey}
                  initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.12 + 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="flex gap-4 items-start"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-0.5">{t(f.titleKey)}</h3>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t(f.descKey)}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-7">
            <CTAButton variant="primary" size="md" href="#" showArrow>
              {t("ctaPrimary")}
            </CTAButton>
          </div>
        </AnimatedSection>
      </div>
    </SectionShell>
  );
}
