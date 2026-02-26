"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight, MessageCircle, Zap, Bot } from "lucide-react";
import CTAButton from "@/components/ui/CTAButton";
import { BRAND } from "@/lib/constants";
import { useTranslations } from "next-intl";

interface HeroSectionProps {
  onGetStarted: () => void;
}

function HeroChatBubble({ text, from, delay = 0 }: { text: string; from: "customer" | "ai"; delay?: number }) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, x: from === "customer" ? 20 : -20, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: shouldReduce ? 0 : 0.5, delay: shouldReduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${from === "customer" ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs shadow-sm ${
        from === "customer"
          ? "bg-[#d9fdd3] text-gray-800 rounded-br-none"
          : "bg-white text-gray-700 rounded-bl-none"
      }`}>
        {text}
      </div>
    </motion.div>
  );
}

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
  const containerRef = useRef(null);
  const shouldReduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], shouldReduce ? [0, 0] : [0, -60]);
  const opacity = useTransform(scrollYProgress, [0.55, 0.95], [1, 0]);
  const t = useTranslations("hero");

  return (
    <section
      id="hero"
      ref={containerRef}
      className="relative min-h-[100svh] flex flex-col items-center justify-center overflow-hidden pt-20"
      aria-labelledby="hero-headline"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[var(--bg)]" />
      <div className="absolute inset-0 bg-hero-glow" />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Orbs */}
      <div className="absolute top-1/4 left-0 w-[500px] h-[500px] rounded-full blur-3xl animate-pulse-glow" style={{ background: "rgba(124,58,237,0.08)" }} />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-3xl animate-float" style={{ background: "rgba(37,211,102,0.06)" }} />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 container-xl px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
      >
        {/* Left: Copy */}
        <div className="flex flex-col items-start gap-6 text-left">
          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-400/30 bg-[var(--accent-light)] text-primary-600 text-xs font-display font-semibold"
          >
            <Zap className="w-3 h-3" />
            {t("badge")}
          </motion.div>

          {/* Headline */}
          <motion.h1
            id="hero-headline"
            className="font-display text-hero-xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {t("title1")}{" "}
            <span className="text-gradient">{t("title2")}</span>
            <br />
            {t("title3")}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="text-base sm:text-lg text-[var(--text-secondary)] max-w-lg leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.35 }}
          >
            {t("subtitle")}{" "}
            <strong className="text-[var(--text-primary)]">{t("subtitleBold1")}</strong>{" "}
            {t("subtitleMid")}{" "}
            <strong className="text-[var(--text-primary)]">{t("subtitleBold2")}</strong>
            {" "}{t("subtitleEnd")}
          </motion.p>

          {/* Feature pills */}
          <motion.div
            className="flex flex-wrap gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {[
              { icon: MessageCircle, tKey: "pillWhatsApp", color: "text-wa-dark bg-wa-light/50 border-wa/20" },
              { icon: Bot, tKey: "pillAI", color: "text-primary-600 bg-[var(--accent-light)] border-primary-400/20" },
              { icon: Zap, tKey: "pillNoStorefront", color: "text-primary-600 bg-[var(--accent-light)] border-primary-400/20" },
            ].map(({ icon: Icon, tKey, color }) => (
              <span
                key={tKey}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${color}`}
              >
                <Icon className="w-3 h-3" />
                {t(tKey as Parameters<typeof t>[0])}
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            className="flex flex-wrap gap-3 mt-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6 }}
          >
            <CTAButton variant="primary" size="lg" onClick={onGetStarted} showArrow>
              {t("ctaPrimary")}
            </CTAButton>
            <CTAButton variant="secondary" size="lg" href="#how-it-works">
              {t("ctaSecondary")}
            </CTAButton>
          </motion.div>

          {/* Social proof */}
          <motion.p
            className="text-xs text-[var(--text-muted)] flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <span className="flex -space-x-1">
              {["F", "A", "K", "O", "E"].map((letter, i) => (
                <span key={i} className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[8px] text-white font-bold border border-[var(--bg)]">
                  {letter}
                </span>
              ))}
            </span>
            {t("socialProof")}
          </motion.p>
        </div>

        {/* Right: Visual */}
        <motion.div
          className="flex flex-col items-center gap-4 relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 bg-radial-center rounded-3xl" />

          <div className="relative w-full max-w-[300px] sm:max-w-[340px]">
            {/* Floating AI label */}
            <motion.div
              animate={{ y: shouldReduce ? 0 : [-6, 6, -6] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-6 -right-4 z-20 flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-full text-xs font-display font-semibold shadow-glow-primary"
            >
              <Bot className="w-3.5 h-3.5" />
              {t("aiLabel")}
            </motion.div>

            {/* Order confirmed badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.5, duration: 0.4 }}
              className="absolute -bottom-8 -left-10 z-20 flex items-center gap-2 bg-[var(--bg)] border border-[var(--border-medium)] px-3 py-2 rounded-2xl shadow-card"
            >
              <div className="w-6 h-6 rounded-full bg-wa/15 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-wa-dark" />
              </div>
              <div>
                <div className="text-[10px] font-display font-bold text-[var(--text-primary)]">{t("orderConfirmed")}</div>
                <div className="text-[9px] text-[var(--text-muted)]">{t("orderDetail")}</div>
              </div>
            </motion.div>

            {/* Chat window */}
            <div className="rounded-3xl overflow-hidden border-[3px] border-black/10 shadow-2xl bg-[#ece5dd]">
              {/* WhatsApp header */}
              <div className="bg-[#128C7E] px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">J</span>
                </div>
                <div>
                  <div className="text-white text-sm font-semibold font-display">{BRAND.name}</div>
                  <div className="flex items-center gap-1 text-white/70 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-300" />
                    {t("whatsAppOnline")}
                  </div>
                </div>
              </div>

              {/* Chat bubbles */}
              <div className="p-3 space-y-2 min-h-[180px]">
                <HeroChatBubble from="customer" text={t("chatCustomer1")} delay={0.7} />
                <HeroChatBubble from="ai" text={t("chatAI1")} delay={1.4} />
                <HeroChatBubble from="customer" text={t("chatCustomer2")} delay={2.2} />
                <HeroChatBubble from="ai" text={t("chatAI2")} delay={2.9} />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        animate={{ y: shouldReduce ? 0 : [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        aria-hidden="true"
      >
        <span className="text-[10px] font-display uppercase tracking-widest text-[var(--text-muted)]">{t("scroll")}</span>
        <div className="w-px h-8 bg-gradient-to-b from-primary-400/60 to-transparent" />
      </motion.div>
    </section>
  );
}
