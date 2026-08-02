"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCheck, Headphones, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/constants";
import { useCardTilt } from "@/components/ui/useCardTilt";
import { useSignatureReducedMotion } from "@/lib/reduced-motion";
import { useTranslations } from "next-intl";

/**
 * The customer's side of the same story the hero tells — and the one place on
 * the page where you watch someone *write*.
 *
 * The hero shows messages arriving; here the composer fills in character by
 * character before each customer line launches, which is the detail that turns
 * a transcript into a person. It costs one interval. The AI answers the way it
 * does everywhere else: typing indicator, then the bubble, then the customer's
 * ticks go blue behind it.
 *
 * The thread also carries a real product card rather than a third paragraph of
 * text, because the claim of the section is that you can *shop* in a chat, and
 * a wall of prose is evidence against it.
 *
 * Mirrored geometry, not copied: this card sits in the left column, so its
 * badge hangs bottom-right and the glide axis runs NW–SE — pointing back into
 * the page instead of off the edge of it.
 */

interface WhatsAppChatProps {
  autoPlay?: boolean;
  className?: string;
}

type Line = { from: "customer" | "ai"; text: string; product?: boolean };

/** How long the finished thread rests on the delivery badge before looping. */
const REST_MS = 4600;

export default function WhatsAppChat({ autoPlay = true, className }: WhatsAppChatProps) {
  const t = useTranslations("customer.chat");
  const shouldReduce = useReducedMotion();

  const lines = useMemo<Line[]>(
    () => [
      { from: "customer", text: t("m1") },
      { from: "ai", text: t("m2"), product: true },
      { from: "customer", text: t("m3") },
      { from: "ai", text: t("m4") },
      { from: "customer", text: t("m5") },
      { from: "ai", text: t("m6") },
    ],
    [t]
  );

  const [count, setCount] = useState(shouldReduce || !autoPlay ? lines.length : 0);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState(shouldReduce || !autoPlay);

  useEffect(() => {
    if (shouldReduce || !autoPlay) return;
    let i = 0;
    // Strictly serial, so one pending timeout and at most one running composer
    // — an array of handles would grow for as long as the page is open.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ticker: ReturnType<typeof setInterval> | undefined;
    const after = (fn: () => void, ms: number) => {
      timer = setTimeout(fn, ms);
    };

    /** Fills the composer, then holds a beat on the finished line before sending. */
    const compose = (text: string, send: () => void) => {
      let n = 0;
      ticker = setInterval(() => {
        n = Math.min(text.length, n + 2);
        setDraft(text.slice(0, n));
        if (n >= text.length) {
          clearInterval(ticker);
          after(send, 300);
        }
      }, 26);
    };

    const next = () => {
      if (i >= lines.length) {
        after(() => {
          setDone(true);
          // Hold the payoff, then wipe and run it again — the thread refills
          // from empty so the loop reads as the next customer, not a rewind.
          after(() => {
            setDone(false);
            setCount(0);
            i = 0;
            after(next, 520);
          }, REST_MS);
        }, 380);
        return;
      }
      if (lines[i].from === "ai") {
        setTyping(true);
        after(() => {
          setTyping(false);
          setCount(++i);
          after(next, 620);
        }, 880);
      } else {
        compose(lines[i].text, () => {
          setDraft("");
          setCount(++i);
          after(next, 640);
        });
      }
    };

    after(next, 600);
    return () => {
      clearTimeout(timer);
      clearInterval(ticker);
    };
  }, [lines, shouldReduce, autoPlay]);

  // ── Tactile 3D, mirrored for a left-column card: ↘ is positive, so the badge
  // in the bottom-right counter-travels back toward the page's centre.
  const tilt = useCardTilt({
    enabled: !useSignatureReducedMotion(),
    maxTilt: 8,
    axis: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  });
  const cardTravel = tilt.useTravel(12);
  const badgeTravel = tilt.useTravel(-11);

  return (
    <div className="[perspective:1200px]" {...tilt.surfaceProps}>
      <motion.div
        className="relative mx-auto w-full max-w-[400px]"
        style={tilt.enabled ? { rotateX: tilt.rotateX, rotateY: tilt.rotateY } : undefined}
      >
        {/* Delivery badge — lands only when the order resolves. Tucked inside
            the card's footprint below 420px, where the section clips overflow. */}
        <AnimatePresence>
          {done && (
            <motion.div
              className="absolute -bottom-11 right-2 z-20 min-[420px]:-right-6"
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
              style={tilt.enabled ? { x: badgeTravel.x, y: badgeTravel.y } : undefined}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.82, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.34, 1.4, 0.64, 1] }}
                className="flex items-center gap-2 rounded-2xl border border-[var(--border-medium)] bg-[var(--bg)] px-3 py-2 shadow-card"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-wa-soft">
                  <MessageCircle className="h-3.5 w-3.5 text-wa-dark" />
                </span>
                <span className="block">
                  <span className="block font-display text-[10px] font-bold text-[var(--text-primary)]">
                    {t("orderBadge")}
                  </span>
                  <span className="block text-[9px] text-[var(--text-muted)]">{t("orderDetail")}</span>
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={cn(
            "relative flex h-[clamp(392px,54svh,512px)] flex-col overflow-hidden rounded-3xl",
            "border-[3px] border-black/10 bg-[#ece5dd] shadow-2xl",
            className
          )}
          style={tilt.enabled ? { x: cardTravel.x, y: cardTravel.y } : undefined}
          aria-label="WhatsApp conversation simulation"
          role="region"
        >
          {tilt.enabled && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 mix-blend-soft-light"
              style={{ background: tilt.glare }}
            />
          )}

          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 bg-[#128C7E] px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <span className="font-display text-sm font-bold text-white">J</span>
            </span>
            <span className="block">
              <span className="block font-display text-sm font-semibold text-white">{BRAND.name}</span>
              <span className="flex items-center gap-1 text-[11px] text-white/70">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-300" />
                {t("headerRole")}
              </span>
            </span>
          </div>

          {/* Thread. justify-end pins it to the bottom the way a real chat sits,
              so a long conversation runs off the top instead of overflowing. */}
          <div className="chat-thread-fade flex min-h-0 flex-1 flex-col justify-end space-y-2 overflow-hidden p-3">
            <AnimatePresence initial={false}>
              {lines.slice(0, count).map((line, i) => {
                const isCustomer = line.from === "customer";
                // A customer line is read once the AI has answered it — or is
                // visibly about to.
                const read = count > i + 1 || (typing && i === count - 1);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.28 } }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className={cn("flex", isCustomer ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
                        isCustomer
                          ? "rounded-br-sm bg-[#d9fdd3] text-gray-800"
                          : "rounded-bl-sm bg-white text-gray-700"
                      )}
                    >
                      <span className="whitespace-pre-line">{line.text}</span>
                      {line.product && <ProductCard t={t} />}
                      <span
                        className={cn(
                          "mt-0.5 flex items-center gap-1 text-[9px] text-gray-400",
                          isCustomer ? "justify-end" : "justify-start"
                        )}
                      >
                        {isCustomer ? t("you") : t("ai")} · {t("now")}
                        {isCustomer && (
                          <CheckCheck className={cn("h-3 w-3", read ? "tick-confirm" : "text-gray-400")} />
                        )}
                      </span>
                    </div>
                  </motion.div>
                );
              })}

              {typing && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex justify-start"
                  aria-label={`${t("ai")} is typing`}
                >
                  <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-typing-1" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-typing-2" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-typing-3" />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Composer. The customer's next line is typed in here before it is
              sent, so the send button lighting up actually means something. */}
          <div className="flex shrink-0 items-center gap-2 border-t border-black/5 bg-[#f0f0f0] px-3 py-2 dark:bg-[#1a1a2e]">
            <div className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-left text-xs">
              {draft ? (
                <span className="block truncate text-gray-700">
                  {draft}
                  <span className="ml-px inline-block w-px animate-pulse text-gray-700">|</span>
                </span>
              ) : (
                <span className="block truncate text-gray-400">{t("placeholder")}</span>
              )}
            </div>
            <motion.span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#128C7E]"
              animate={{ scale: draft ? 1.06 : 1, opacity: draft ? 1 : 0.65 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </motion.span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/** The bit that makes it shopping rather than messaging. */
function ProductCard({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="mt-2 flex items-center gap-2.5 rounded-xl bg-gray-50 p-2 ring-1 ring-black/5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-primary-700">
        <Headphones className="h-5 w-5 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[11px] font-bold text-gray-800">
          {t("productName")}
        </span>
        <span className="block truncate text-[9px] text-gray-500">{t("productMeta")}</span>
      </span>
      <span className="shrink-0 font-display text-[11px] font-bold text-primary-700">{t("productPrice")}</span>
    </motion.span>
  );
}
