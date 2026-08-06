"use client";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Smartphone, MessageCircle, Wifi } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionShell from "@/components/ui/SectionShell";
import CTAButton from "@/components/ui/CTAButton";
import { useCardTilt } from "@/components/ui/useCardTilt";
import { useSignatureReducedMotion } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const FEATURE_ICONS = [Smartphone, MessageCircle, Wifi];

type FeatureKey = "features.mobileTitle" | "features.whatsappTitle" | "features.dataTitle";
type FeatureDescKey = "features.mobileDesc" | "features.whatsappDesc" | "features.dataDesc";

const FEATURES: { titleKey: FeatureKey; descKey: FeatureDescKey }[] = [
  { titleKey: "features.mobileTitle", descKey: "features.mobileDesc" },
  { titleKey: "features.whatsappTitle", descKey: "features.whatsappDesc" },
  { titleKey: "features.dataTitle", descKey: "features.dataDesc" },
];

/**
 * The network degrades as the conversation runs — four bars, then three, then
 * a bare EDGE "E" — and the order goes through anyway. The section's third
 * promise is that commerce doesn't stop when the signal drops, and this is the
 * only honest way to make that claim on a landing page: show the signal
 * dropping. Each rung also stretches the pacing, so the thread visibly gets
 * slower without ever getting stuck.
 */
const NETWORK = [
  { label: "4G", bars: 4, pace: 1 },
  { label: "3G", bars: 3, pace: 1.3 },
  { label: "E", bars: 2, pace: 1.75 },
  { label: "E", bars: 1, pace: 2.1 },
] as const;

function PhoneMockup() {
  const shouldReduce = useReducedMotion();
  const t = useTranslations("africaFirst");
  const ph = useTranslations("africaFirst.phone");

  const chatLines = useMemo(
    () =>
      [
        { from: "customer", textKey: "phone.chat1Customer" as const },
        { from: "ai", textKey: "phone.chat1AI" as const },
        { from: "customer", textKey: "phone.chat2Customer" as const },
        { from: "ai", textKey: "phone.chat2AI" as const },
      ] as const,
    []
  );

  const [count, setCount] = useState(shouldReduce ? chatLines.length : 0);
  const [typing, setTyping] = useState(false);

  // The signal is a function of how far the thread has got — it can only fall
  // while a conversation is in flight, and it resets when the next one starts.
  const net = NETWORK[Math.min(count, NETWORK.length - 1)];

  useEffect(() => {
    if (shouldReduce) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const after = (fn: () => void, ms: number) => {
      timer = setTimeout(fn, ms);
    };
    // Read the pace off `i`, not off the render's `net`: the timer closure is
    // created once and would otherwise pace the whole loop at 4G.
    const pace = () => NETWORK[Math.min(i, NETWORK.length - 1)].pace;

    const next = () => {
      if (i >= chatLines.length) {
        after(() => {
          setCount(0);
          i = 0;
          after(next, 700);
        }, 4200);
        return;
      }
      if (chatLines[i].from === "ai") {
        setTyping(true);
        after(() => {
          setTyping(false);
          setCount(++i);
          after(next, 520 * pace());
        }, 780 * pace());
      } else {
        setCount(++i);
        after(next, 640 * pace());
      }
    };

    after(next, 700);
    return () => clearTimeout(timer);
  }, [chatLines, shouldReduce]);

  // Subtle by design: the phone is already floating, so a hard tilt on top of
  // that reads as a wobble. Gyro is off for the same reason.
  const tilt = useCardTilt({ enabled: !useSignatureReducedMotion(), maxTilt: 6, gyro: false });

  return (
    <div className="relative flex justify-center [perspective:1100px]" {...tilt.surfaceProps}>
      <motion.div
        animate={{ y: shouldReduce ? 0 : [-8, 8, -8] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
      >
        <motion.div
          className="relative"
          style={tilt.enabled ? { rotateX: tilt.rotateX, rotateY: tilt.rotateY } : undefined}
        >
          <div className="absolute inset-0 bg-primary-500/20 rounded-[40px] blur-2xl scale-95" />

          <div className="relative w-[200px] sm:w-[240px] bg-surface-900 rounded-[40px] p-3 shadow-2xl border-4 border-surface-800">
            <div className="relative bg-[var(--bg)] rounded-[30px] overflow-hidden h-[380px] sm:h-[440px] flex flex-col">
              {tilt.enabled && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 mix-blend-soft-light"
                  style={{ background: tilt.glare }}
                />
              )}

              {/* Status bar — the signal meter is the whole point of it */}
              <div className="flex items-center justify-between px-4 py-2 text-[9px] font-medium text-[var(--text-muted)]">
                <span className="tabular-nums">{ph("status")}</span>
                <div className="w-16 h-1.5 bg-surface-900 rounded-full" />
                <span className="flex items-center gap-1">
                  <span className="flex items-end gap-[1.5px]" aria-hidden="true">
                    {[2, 4, 6, 8].map((h, i) => (
                      <motion.span
                        key={h}
                        className="w-[2px] rounded-[1px] bg-current"
                        style={{ height: h }}
                        animate={{ opacity: i < net.bars ? 1 : 0.22 }}
                        transition={{ duration: 0.45 }}
                      />
                    ))}
                  </span>
                  <span className="w-3 text-left font-mono text-[8px] leading-none">{net.label}</span>
                </span>
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

              {/* Chat — pinned to the bottom so it fills upward as it runs */}
              <div className="flex-1 min-h-0 bg-[#ece5dd] p-3 space-y-2 overflow-hidden flex flex-col justify-end">
                <AnimatePresence initial={false}>
                  {chatLines.slice(0, count).map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className={cn("flex", m.from === "customer" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "text-[9px] px-2 py-1.5 rounded-lg max-w-[80%] leading-relaxed",
                          m.from === "customer"
                            ? "bg-[#d9fdd3] text-gray-700 rounded-br-none"
                            : "bg-white text-gray-700 rounded-bl-none"
                        )}
                      >
                        {t(m.textKey)}
                      </div>
                    </motion.div>
                  ))}

                  {typing && (
                    <motion.div
                      key="typing"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex justify-start"
                    >
                      <span className="flex items-center gap-1 rounded-lg rounded-bl-none bg-white px-2 py-2 shadow-sm">
                        <span className="h-1 w-1 rounded-full bg-gray-400 animate-typing-1" />
                        <span className="h-1 w-1 rounded-full bg-gray-400 animate-typing-2" />
                        <span className="h-1 w-1 rounded-full bg-gray-400 animate-typing-3" />
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Input */}
              <div className="bg-[#f0f0f0] p-2 flex items-center gap-1.5">
                <div className="flex-1 bg-white rounded-full px-3 py-1 text-[9px] text-gray-400 truncate">{ph("inputPlaceholder")}</div>
                <div className="w-6 h-6 rounded-full bg-[#128C7E] flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges. The low-signal note only appears once the bars
              have actually fallen — otherwise it is just a sticker. */}
          <AnimatePresence>
            {net.bars <= 2 && (
              <motion.div
                key="low-signal"
                initial={{ opacity: 0, x: 8, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.25 } }}
                transition={{ duration: 0.4, ease: [0.34, 1.4, 0.64, 1] }}
                className="absolute -right-8 top-24 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 shadow-card"
              >
                <div className="font-display text-[9px] font-bold text-wa-dark">{ph("lowSignalNote")}</div>
              </motion.div>
            )}
          </AnimatePresence>
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
    <SectionShell id="why-wimall" glow="top">
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
