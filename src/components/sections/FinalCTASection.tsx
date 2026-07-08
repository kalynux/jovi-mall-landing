"use client";
import { motion, useReducedMotion } from "framer-motion";
import CTAButton from "@/components/ui/CTAButton";
import { useTranslations } from "next-intl";

interface FinalCTASectionProps {
  onGetStarted: () => void;
}

export default function FinalCTASection({ onGetStarted }: FinalCTASectionProps) {
  const shouldReduce = useReducedMotion();
  const t = useTranslations("finalCta");

  return (
    <section
      id="cta"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden py-24"
      aria-labelledby="final-cta-title"
    >
      {/* Always-dark gradient background — themed via CSS var (dark in both modes) */}
      <div className="absolute inset-0 bg-[var(--bg-invert)]" />
      <div className="absolute inset-0 bg-gradient-radial from-primary-600/20 via-transparent to-transparent" />

      {/* Animated grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(13,160,107,1) 1px, transparent 1px), linear-gradient(90deg, rgba(13,160,107,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary-600/15 blur-3xl"
        animate={{ scale: shouldReduce ? 1 : [1, 1.15, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-wa/10 blur-3xl"
        animate={{ scale: shouldReduce ? 1 : [1, 1.2, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-6 max-w-2xl"
        >
          {/* Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-500/30 bg-primary-600/10 text-primary-300 text-xs font-display font-semibold">
            {t("badge")}
          </div>

          {/* Headline */}
          <h2
            id="final-cta-title"
            className="font-display text-hero-lg text-white"
          >
            {t("title1")}{" "}
            <span
              className="bg-gradient-to-r from-primary-400 to-wa bg-clip-text"
              style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              {t("title2")}
            </span>
          </h2>

          {/* Sub copy */}
          <p className="text-base text-white/60 leading-relaxed max-w-lg">
            {t("subtitle")}
          </p>

          {/* Single dominant CTA */}
          <CTAButton
            variant="primary"
            size="lg"
            onClick={onGetStarted}
            showArrow
            className="text-base px-10 py-4 shadow-[0_0_40px_rgba(13,160,107,0.5)] hover:shadow-[0_0_60px_rgba(13,160,107,0.7)]"
          >
            {t("ctaPrimary")}
          </CTAButton>

          <p className="text-xs text-white/30">
            {t("finePrint")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
