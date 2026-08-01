"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useMotionTemplate,
} from "framer-motion";
import { MessageCircle, Zap, Bot, CheckCheck } from "lucide-react";
import CTAButton from "@/components/ui/CTAButton";
import { BRAND } from "@/lib/constants";
import { useTranslations } from "next-intl";

interface HeroSectionProps {
  onGetStarted: () => void;
}

/**
 * The focal moment (front half): a WhatsApp order placing itself in real time.
 * Messages arrive with a typing indicator before each AI reply, read-receipts
 * turn blue as the assistant answers, and the whole thing resolves on the
 * "Order Confirmed" badge landing — which is the cue the automation (the
 * How-It-Works flow) picks up further down the page.
 *
 * Reduced motion → the finished conversation is shown at rest, no timers.
 */
function HeroConversation() {
  const t = useTranslations("hero");
  const shouldReduce = useReducedMotion();

  const messages = useMemo(
    () =>
      [
        { from: "customer", text: t("chatCustomer1") },
        { from: "ai", text: t("chatAI1") },
        { from: "customer", text: t("chatCustomer2") },
        { from: "ai", text: t("chatAI2") },
      ] as const,
    [t]
  );

  const [count, setCount] = useState(shouldReduce ? messages.length : 0);
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(shouldReduce);

  useEffect(() => {
    if (shouldReduce) return;
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const after = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    const next = () => {
      if (i >= messages.length) {
        after(() => setDone(true), 350);
        return;
      }
      if (messages[i].from === "ai") {
        setTyping(true);
        after(() => {
          setTyping(false);
          setCount(++i);
          after(next, 850);
        }, 1100);
      } else {
        setCount(++i);
        after(next, 1250);
      }
    };

    after(next, 550);
    return () => timers.forEach(clearTimeout);
  }, [messages, shouldReduce]);

  // ── Tactile 3D: the card tilts toward the pointer (or device tilt on mobile),
  // and its layers sit at different depths so they parallax as it turns. All
  // transform-only; disabled entirely under reduced-motion.
  const MAX_TILT = 9;
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 15, mass: 0.4 });
  const sry = useSpring(ry, { stiffness: 150, damping: 15, mass: 0.4 });
  const tilt = !shouldReduce;

  const glare = useMotionTemplate`radial-gradient(120% 90% at ${glareX}% ${glareY}%, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)`;

  const onPointerMove = (e: React.PointerEvent) => {
    if (!tilt || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height; // 0..1
    ry.set((px - 0.5) * 2 * MAX_TILT);
    rx.set((0.5 - py) * 2 * MAX_TILT);
    glareX.set(px * 100);
    glareY.set(py * 100);
  };
  const onPointerLeave = () => {
    rx.set(0);
    ry.set(0);
    glareX.set(50);
    glareY.set(0);
  };

  // Gyroscope tilt on mobile (Android fires without a permission prompt; where it
  // doesn't, the card simply rests flat — no gating of content on it).
  useEffect(() => {
    if (!tilt || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    let raf = 0;
    const onOrient = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // left/right [-90,90]
      const beta = e.beta ?? 0; // front/back [-180,180]
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        ry.set(Math.max(-MAX_TILT, Math.min(MAX_TILT, gamma * 0.4)));
        rx.set(Math.max(-MAX_TILT, Math.min(MAX_TILT, (beta - 45) * 0.25)));
      });
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      cancelAnimationFrame(raf);
    };
  }, [tilt, rx, ry]);

  return (
    <div className="[perspective:1200px]" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <motion.div
        className="relative w-full max-w-[300px] sm:max-w-[340px] [transform-style:preserve-3d]"
        style={tilt ? { rotateX: srx, rotateY: sry } : undefined}
      >
      {/* Floating AI label — deepest layer, floats forward */}
      <div className="absolute -top-6 -right-4 z-20" style={tilt ? { transform: "translateZ(70px)" } : undefined}>
        <motion.div
          animate={{ y: shouldReduce ? 0 : [-6, 6, -6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-full text-xs font-display font-semibold shadow-glow-primary"
        >
          <Bot className="w-3.5 h-3.5" />
          {t("aiLabel")}
        </motion.div>
      </div>

      {/* Order confirmed badge — lands only when the conversation resolves */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.34, 1.4, 0.64, 1] }}
            className="absolute -bottom-8 -left-10 z-20 flex items-center gap-2 bg-[var(--bg)] border border-[var(--border-medium)] px-3 py-2 rounded-2xl shadow-card"
            style={tilt ? { transform: "translateZ(55px)" } : undefined}
          >
            <div className="w-6 h-6 rounded-full bg-wa-soft flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5 text-wa-dark" />
            </div>
            <div>
              <div className="text-[10px] font-display font-bold text-[var(--text-primary)]">{t("orderConfirmed")}</div>
              <div className="text-[9px] text-[var(--text-muted)]">{t("orderDetail")}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <div
        className="relative rounded-3xl overflow-hidden border-[3px] border-black/10 shadow-2xl bg-[#ece5dd]"
        style={tilt ? { transform: "translateZ(20px)" } : undefined}
      >
        {/* Moving glass glare that tracks the pointer across the card */}
        {tilt && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 mix-blend-soft-light"
            style={{ background: glare }}
          />
        )}
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
        <div className="p-3 space-y-2 min-h-[180px] flex flex-col justify-end">
          <AnimatePresence initial={false}>
            {messages.slice(0, count).map((msg, i) => {
              const isCustomer = msg.from === "customer";
              // a customer line is "read" (blue ticks) once the AI has replied after it
              const read = count > i + 1 || (typing && i === count - 1);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-xs shadow-sm ${
                      isCustomer
                        ? "bg-[#d9fdd3] text-gray-800 rounded-br-none"
                        : "bg-white text-gray-700 rounded-bl-none"
                    }`}
                  >
                    <span className="whitespace-pre-line">{msg.text}</span>
                    {isCustomer && (
                      <CheckCheck className={`inline-block w-3 h-3 ml-1 -mb-0.5 ${read ? "tick-confirm" : "text-gray-400"}`} />
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Typing indicator before an AI reply */}
            {typing && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex justify-start"
                aria-label="Jovi AI is typing"
              >
                <div className="bg-white px-3 py-2.5 rounded-xl rounded-bl-none shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-1" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-2" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-3" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </motion.div>
    </div>
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
      {/* Background — the shared AuroraBackground shows through; we only add the
          hero glow + a faint grid on top of it. */}
      <div className="absolute inset-0 bg-hero-glow" />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

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
            <span className="text-gradient-shimmer animate-shimmer-text">{t("title2")}</span>
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
              { icon: MessageCircle, tKey: "pillWhatsApp", color: "text-wa-dark dark:text-wa border-wa/20" },
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
            <CTAButton variant="primary" size="lg" onClick={onGetStarted} showArrow magnetic>
              {t("ctaPrimary")}
            </CTAButton>
            <CTAButton variant="secondary" size="lg" href="#how-it-works" magnetic>
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

          <HeroConversation />
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
