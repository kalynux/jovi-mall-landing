"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionTemplate,
} from "framer-motion";
import { MessageCircle, Zap, Bot, CheckCheck } from "lucide-react";
import CTAButton from "@/components/ui/CTAButton";
import { BRAND, buildWhatsAppUrl } from "@/lib/constants";
import { useSignatureReducedMotion, useReducedMotionSafe } from "@/lib/reduced-motion";
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
  // Signature surface: the pointer interaction and the message timeline are the
  // whole point of the hero, so they survive an OS reduced-motion setting. See
  // lib/reduced-motion.ts for why, and for the switch that hands it back.
  const shouldReduce = useSignatureReducedMotion();

  // A full pre-sale exchange, not just an order: spec question, delivery
  // question, then payment choice. Keys are in conversation order.
  const messages = useMemo(
    () =>
      [
        { from: "customer", text: t("chatCustomer1") },
        { from: "ai", text: t("chatAI1") },
        { from: "customer", text: t("chatCustomer2") },
        { from: "ai", text: t("chatAI2") },
        { from: "customer", text: t("chatCustomer3") },
        { from: "ai", text: t("chatAI3") },
        { from: "customer", text: t("chatCustomer4") },
        { from: "ai", text: t("chatAI4") },
        { from: "customer", text: t("chatCustomer5") },
        { from: "ai", text: t("chatAI5") },
      ] as const,
    [t]
  );

  /** One rendered bubble. `id` is a global sequence number, never reused. */
  type Entry = { id: number; from: "customer" | "ai"; text: string };

  const [thread, setThread] = useState<Entry[]>([]);
  const [typing, setTyping] = useState(false);
  const [done, setDone] = useState(false);

  /** How long the thread rests on the payoff before the next round starts. */
  const ROUND_PAUSE = 5000;
  /** Beat before the very first message. */
  const LEAD_IN = 450;
  /**
   * How many bubbles stay mounted. The thread never clears, so without a cap the
   * DOM would grow by ten nodes a round for as long as the tab is open. At the
   * tallest card (~556px of thread) about 14 bubbles can be on screen at once, so
   * 18 keeps a margin and only ever drops bubbles that already scrolled off.
   */
  const THREAD_WINDOW = 18;

  useEffect(() => {
    if (shouldReduce) {
      // No timeline: rest on the finished conversation with the badge landed.
      setThread(messages.map((m, i) => ({ id: i, from: m.from, text: m.text })));
      setDone(true);
      return;
    }

    // Never resets. The conversation is one continuous thread; a "round" is just
    // the sequence wrapping back to the first message, and the only thing that
    // marks it is the pause.
    let seq = 0;
    // Exactly one timeout is ever pending — the sequence is strictly serial — so
    // this holds a single handle rather than an array. An array would grow for as
    // long as the page is open, since the loop never ends.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const after = (fn: () => void, ms: number) => {
      timer = setTimeout(fn, ms);
    };

    const next = () => {
      const m = messages[seq % messages.length];

      const commit = () => {
        const id = seq; // captured before the increment — the updater runs later
        seq += 1;
        setThread((t) => [...t, { id, from: m.from, text: m.text }].slice(-THREAD_WINDOW));

        if (seq % messages.length === 0) {
          // Round closed. Land the badge — a no-op from the second round on, so
          // it appears once and then simply stays — hold, and carry on in the
          // same thread. Nothing is cleared; the next round types straight on
          // under the last message.
          after(() => {
            setDone(true);
            after(next, ROUND_PAUSE);
          }, 350);
        } else {
          after(next, m.from === "ai" ? 550 : 750);
        }
      };

      if (m.from === "ai") {
        setTyping(true);
        after(() => {
          setTyping(false);
          commit();
        }, 750);
      } else {
        commit();
      }
    };

    // Paced so ten messages still resolve in ~10s: at the original timings a
    // conversation this long took 16s to reach the Order Confirmed payoff.
    after(next, LEAD_IN);
    return () => clearTimeout(timer);
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

  // ── Oblique glide. The two floating badges sit on the card's NE–SW diagonal
  // (AI label pinned top-right, order badge bottom-left), so that diagonal *is*
  // the travel axis: pointer input is projected onto it, the card slides along
  // it, and the badges slide back down it. The card therefore closes the gap
  // with one badge exactly as it opens the gap with the other. Travel distances
  // are signed — negative is "against the card" — and scale with each layer's
  // translateZ, so the badge that floats highest reacts hardest.
  // Travel is capped by collision, not by taste: both badges already overlap the
  // card slightly at rest, and counter-travel closes that gap on one side of the
  // sweep. At these distances the order badge stops inside the card's bottom
  // padding instead of riding up over the last message bubble.
  const AXIS = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }; // ↗ positive, ↙ negative
  const CHAT_TRAVEL = 13;
  const AI_TRAVEL = -15;
  const ORDER_TRAVEL = -10;

  const glide = useMotionValue(0); // −1…1 along AXIS
  const sGlide = useSpring(glide, { stiffness: 140, damping: 18, mass: 0.5 });

  const chatX = useTransform(sGlide, (v) => v * CHAT_TRAVEL * AXIS.x);
  const chatY = useTransform(sGlide, (v) => v * CHAT_TRAVEL * AXIS.y);
  const aiX = useTransform(sGlide, (v) => v * AI_TRAVEL * AXIS.x);
  const aiY = useTransform(sGlide, (v) => v * AI_TRAVEL * AXIS.y);
  const orderX = useTransform(sGlide, (v) => v * ORDER_TRAVEL * AXIS.x);
  const orderY = useTransform(sGlide, (v) => v * ORDER_TRAVEL * AXIS.y);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!tilt || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height; // 0..1
    const nx = (px - 0.5) * 2; // −1..1
    const ny = (py - 0.5) * 2;
    ry.set(nx * MAX_TILT);
    rx.set(-ny * MAX_TILT);
    glareX.set(px * 100);
    glareY.set(py * 100);
    // Project the pointer onto the diagonal; clamped so the corners don't
    // overshoot the ±1 the travel distances are calibrated against.
    glide.set(Math.max(-1, Math.min(1, nx * AXIS.x + ny * AXIS.y)));
  };
  const onPointerLeave = () => {
    rx.set(0);
    ry.set(0);
    glareX.set(50);
    glareY.set(0);
    glide.set(0);
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
        className="relative w-full max-w-[336px] sm:max-w-[384px] [transform-style:preserve-3d]"
        style={tilt ? { rotateX: srx, rotateY: sry } : undefined}
      >
      {/* Floating AI label — highest layer, so it counter-glides hardest. The
          outer node owns the parallax, the inner one keeps its idle float. */}
      {/* Below ~420px the badges tuck inside the card: the wider card leaves them
          no room to float past its corners, and the section clips overflow. */}
      <motion.div
        className="absolute -top-6 right-3 min-[420px]:-right-4 z-20"
        style={tilt ? { z: 70, x: aiX, y: aiY } : undefined}
      >
        <motion.div
          animate={{ y: shouldReduce ? 0 : [-6, 6, -6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-full text-xs font-display font-semibold shadow-glow-primary"
        >
          <Bot className="w-3.5 h-3.5" />
          {t("aiLabel")}
        </motion.div>
      </motion.div>

      {/* Order confirmed badge — lands when the first round resolves, then stays
          for the life of the page (the thread keeps running underneath it). */}
      <AnimatePresence>
        {done && (
          // Outer node: parallax only. The landing animation below owns `y`, so
          // the two cannot share a node without fighting over it.
          <motion.div
            // -bottom-12, not -8: at -8 the badge already overlapped the card by
            // ~11px at rest, which the counter-glide then pushed onto the copy.
            className="absolute -bottom-12 left-2 min-[420px]:-left-10 z-20"
            style={tilt ? { z: 55, x: orderX, y: orderY } : undefined}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.34, 1.4, 0.64, 1] }}
              className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--border-medium)] px-3 py-2 rounded-2xl shadow-card"
            >
              <div className="w-6 h-6 rounded-full bg-wa-soft flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5 text-wa-dark" />
              </div>
              <div>
                <div className="text-[10px] font-display font-bold text-[var(--text-primary)]">{t("orderConfirmed")}</div>
                <div className="text-[9px] text-[var(--text-muted)]">{t("orderDetail")}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat window — glides along the diagonal, the badges glide back down it.
          Height is viewport-relative so the card fills ~65% of the hero's right
          column on desktop, with a floor and a ceiling so it neither collapses on
          a short laptop nor outgrows the section on a tall monitor. */}
      <motion.div
        className="relative flex flex-col h-[clamp(360px,50svh,440px)] lg:h-[clamp(440px,65svh,620px)] rounded-3xl overflow-hidden border-[3px] border-black/10 shadow-2xl bg-[#ece5dd]"
        style={tilt ? { z: 20, x: chatX, y: chatY } : undefined}
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
        <div className="shrink-0 bg-[#128C7E] px-4 py-3 flex items-center gap-3">
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

        {/* Chat bubbles. min-h-0 lets this flex child actually shrink (its default
            min-height:auto would otherwise push past the card), and justify-end
            keeps the thread pinned to the bottom the way a real chat sits — so a
            long conversation runs off the top edge instead of overflowing. */}
        <div className="chat-thread-fade flex-1 min-h-0 overflow-hidden p-3 space-y-2 flex flex-col justify-end">
          <AnimatePresence initial={false}>
            {thread.map((msg, idx) => {
              const isCustomer = msg.from === "customer";
              // a customer line is "read" (blue ticks) once anything follows it —
              // another message, or the assistant starting to type
              const read = idx < thread.length - 1 || typing;
              return (
                <motion.div
                  key={msg.id}
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
                aria-label="Wi-Mall AI is typing"
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
      </motion.div>
      </motion.div>
    </div>
  );
}

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
  const containerRef = useRef(null);
  const shouldReduce = useReducedMotionSafe();
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
            className="tag role-accent"
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
              // WhatsApp keeps its green: it names the channel the whole product
              // runs on, and it is the same green the rest of the page uses for
              // that channel. The other two were only ever the brand accent —
              // the same colour as the badge directly above them — so they go
              // muted. One accent badge, one green and two neutrals reads as a
              // hierarchy; four accent blocks stacked in a column does not.
              { icon: MessageCircle, tKey: "pillWhatsApp", tone: "tag-wa" },
              { icon: Bot, tKey: "pillAI", tone: "tag-muted" },
              { icon: Zap, tKey: "pillNoStorefront", tone: "tag-muted" },
            ].map(({ icon: Icon, tKey, tone }) => (
              <span key={tKey} className={`tag ${tone}`}>
                <Icon className="w-3 h-3" />
                {t(tKey as Parameters<typeof t>[0])}
              </span>
            ))}
          </motion.div>

          {/* CTAs. `w-full` is load-bearing: the column above is `items-start`,
              so without it this row shrink-wraps and .cta-row's full-width
              mobile stack has nothing to be full-width of. */}
          <motion.div
            className="cta-row mt-2 w-full"
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
            {/* Third door: straight into the bot, no account needed. CTAButton
                takes no target/rel and is not ours to change, so this is a plain
                <a> wearing CTAButton's secondary/lg classes, tinted WhatsApp
                green so it reads as a different path and not a third identical
                button. The hover tint is `wa/10` rather than the solid wa-light,
                which would put light green under light text in dark mode. */}
            <a
              href={buildWhatsAppUrl(t("ctaWhatsappPrefill"))}
              target="_blank"
              rel="noopener noreferrer"
              className="relative inline-flex items-center justify-center gap-2.5 rounded-2xl border border-wa/60 bg-[var(--surface-glass)] px-8 py-4 font-display text-lg font-semibold text-[var(--text-primary)] transition-[box-shadow,background-color,border-color] duration-200 hover:border-wa hover:bg-wa/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wa focus-visible:ring-offset-2"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-wa-dark dark:text-wa" aria-hidden="true" />
              {t("ctaWhatsapp")}
            </a>
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
