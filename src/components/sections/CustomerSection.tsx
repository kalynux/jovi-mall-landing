"use client";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionLabel from "@/components/ui/SectionLabel";
import SectionShell from "@/components/ui/SectionShell";
import WhatsAppChat from "@/components/animations/WhatsAppChat";
import WhatsAppDeepLinkPreview from "../ui/WhatsAppDeepLinkPreview";
import { useTranslations } from "next-intl";

type BenefitKey = "benefits.chatTitle" | "benefits.instantTitle" | "benefits.deliveryTitle";
type BenefitDescKey = "benefits.chatDesc" | "benefits.instantDesc" | "benefits.deliveryDesc";

const BENEFITS: { emoji: string; titleKey: BenefitKey; descKey: BenefitDescKey }[] = [
  { emoji: "💬", titleKey: "benefits.chatTitle", descKey: "benefits.chatDesc" },
  { emoji: "⚡", titleKey: "benefits.instantTitle", descKey: "benefits.instantDesc" },
  { emoji: "🚚", titleKey: "benefits.deliveryTitle", descKey: "benefits.deliveryDesc" },
];

export default function CustomerSection() {
  const t = useTranslations("customer");

  return (
    <SectionShell id="customers" accent="role-customer" glow="center">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left: Chat simulation */}
        <AnimatedSection direction="left" delay={0.1}>
          <WhatsAppChat />
        </AnimatedSection>

        {/* Right: Content */}
        <AnimatedSection direction="right">
          <SectionLabel variant="wa" className="mb-5">{t("sectionLabel")}</SectionLabel>
          <h2 id="customer-title" className="font-display text-section text-[var(--text-primary)] mb-4">
            {t("title1")}{" "}
            <span className="text-gradient-wa">{t("title2")}</span>
          </h2>
          <p className="text-base text-[var(--text-secondary)] leading-relaxed mb-6 max-w-lg">
            {t("subtitle")}
          </p>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
            {BENEFITS.map((b) => (
              <div key={b.titleKey} className="glass-strong rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-0.5">
                <div className="text-2xl mb-2">{b.emoji}</div>
                <h3 className="font-display font-semibold text-xs text-[var(--text-primary)] mb-1">{t(b.titleKey)}</h3>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t(b.descKey)}</p>
              </div>
            ))}
          </div>

          {/* WhatsApp deep-link preview */}
          <WhatsAppDeepLinkPreview />
        </AnimatedSection>
      </div>
    </SectionShell>
  );
}
