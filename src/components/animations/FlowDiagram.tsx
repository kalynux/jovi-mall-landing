"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/reduced-motion";
import { MessageCircle, Sparkles, ShoppingCart, Building2, Bike, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { FLOW_STEPS } from "@/lib/constants";
import { useTranslations } from "next-intl";

const ICON_MAP = { MessageCircle, Sparkles, ShoppingCart, Building2, Bike, Banknote };

type FlowStepKey =
  | "flow.step1Title" | "flow.step2Title" | "flow.step3Title"
  | "flow.step4Title" | "flow.step5Title" | "flow.step6Title";
type FlowDescKey =
  | "flow.step1Desc" | "flow.step2Desc" | "flow.step3Desc"
  | "flow.step4Desc" | "flow.step5Desc" | "flow.step6Desc";

const STEP_KEYS: { titleKey: FlowStepKey; descKey: FlowDescKey }[] = [
  { titleKey: "flow.step1Title", descKey: "flow.step1Desc" },
  { titleKey: "flow.step2Title", descKey: "flow.step2Desc" },
  { titleKey: "flow.step3Title", descKey: "flow.step3Desc" },
  { titleKey: "flow.step4Title", descKey: "flow.step4Desc" },
  { titleKey: "flow.step5Title", descKey: "flow.step5Desc" },
  { titleKey: "flow.step6Title", descKey: "flow.step6Desc" },
];

interface FlowDiagramProps {
  className?: string;
}

/*
  Two versions of this diagram have shipped, and this is deliberately a cross
  of them (owner's call, 2026-09-21):

  - The LOOK and the responsive layout are the original's (e5e4e87): tinted
    icon tiles with a numbered badge, six across on desktop, two columns on a
    tablet, one column with arrows on a phone. 9067c11 replaced that with a
    phased timeline; the owner preferred the original's resizing.
  - The MOTION is 9067c11's: stations land one at a time, the rail segment
    leaving each one draws in the gap before the next arrives and STAYS drawn,
    and each tile pulses as it settles. The original swept a single current
    across a rail and left nothing behind — and its `.flow-rail` CSS was
    deleted with that rebuild, so a straight revert drew no rail at all.
*/
const NODE_BASE = 0.1;
const NODE_STEP = 0.18;
const NODE_DURATION = 0.42;
const RAIL_DURATION = 0.16;
const EASE = [0.22, 1, 0.36, 1] as const;

const nodeDelay = (i: number) => NODE_BASE + i * NODE_STEP;
/** The wake pulse fires as the tile finishes settling, not as it starts. */
const wakeDelay = (i: number) => nodeDelay(i) + 0.18;
/** The segment (or arrow) after tile `i` draws in the gap before tile `i + 1`. */
const railDelay = (i: number) => nodeDelay(i) + 0.02;

/** The rail's resting tint — the original rail's settled colour. */
const RAIL_TINT = "color-mix(in srgb, var(--accent) 26%, transparent)";

/** One pipeline node — icon, number, title, copy. Lands in sequence once in view. */
function FlowNode({
  step,
  index,
  isInView,
  shouldReduce,
  size,
  connector,
}: {
  step: (typeof FLOW_STEPS)[number];
  index: number;
  isInView: boolean;
  shouldReduce: boolean;
  size: "sm" | "lg";
  /** Draw the desktop rail segment from this tile to the next one. */
  connector?: boolean;
}) {
  const Icon = ICON_MAP[step.icon as keyof typeof ICON_MAP];
  const isWa = step.color === "wa";
  const { titleKey, descKey } = STEP_KEYS[index];
  const t = useTranslations("howItWorks");
  const box = size === "lg" ? "w-14 h-14" : "w-12 h-12";
  const icon = size === "lg" ? "w-6 h-6" : "w-5 h-5";
  const wake = isInView && !shouldReduce;

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: shouldReduce ? 0 : 16 }}
      transition={{
        duration: shouldReduce ? 0 : NODE_DURATION,
        delay: shouldReduce ? 0 : nodeDelay(index),
        ease: EASE,
      }}
      className="flex flex-col items-center text-center flex-1 px-1"
    >
      {/* Full column width, tile height: what lets the segment pin itself to the
          tile's centre line and run to the next tile's edge. */}
      <div className="relative mb-4 flex w-full justify-center">
        {connector && (
          <motion.span
            aria-hidden="true"
            /* start: this tile's trailing edge (half of 3.5rem past the centre).
               end: the next tile's leading edge. Columns are equal `flex-1`
               with 4px padding a side, so that edge sits a column width minus
               the half-tile past this centre — 1.25rem − 50% from our end. */
            className="absolute top-[calc(50%_-_1px)] h-[2px] rounded-full origin-left rtl:origin-right start-[calc(50%_+_1.75rem)] end-[calc(1.25rem_-_50%)]"
            style={{ background: RAIL_TINT }}
            initial={{ scaleX: shouldReduce ? 1 : 0 }}
            animate={isInView || shouldReduce ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{
              duration: shouldReduce ? 0 : RAIL_DURATION,
              delay: shouldReduce ? 0 : railDelay(index),
              ease: "linear",
            }}
          />
        )}
        <div className="relative">
          <div
            className={cn(
              box,
              "rounded-2xl flex items-center justify-center border border-[var(--border)] shadow-card bg-[var(--surface)]",
              wake && "node-wake"
            )}
            style={{
              background: isWa
                ? "linear-gradient(135deg, color-mix(in srgb, #25D366 12%, var(--surface)), color-mix(in srgb, #128C7E 8%, var(--surface)))"
                : "var(--accent-light)",
              animationDelay: wake ? `${wakeDelay(index)}s` : undefined,
            }}
          >
            <Icon className={cn(icon, isWa ? "text-wa-dark dark:text-wa" : "text-primary-600 dark:text-primary-400")} />
          </div>
          <div
            className={cn(
              "absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center font-display text-white",
              isWa ? "bg-wa-dark" : "bg-primary-600"
            )}
          >
            {step.step}
          </div>
        </div>
      </div>
      <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-1.5 leading-tight">{t(titleKey)}</h3>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t(descKey)}</p>
    </motion.div>
  );
}

export default function FlowDiagram({ className }: FlowDiagramProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const shouldReduce = !!useReducedMotionSafe();
  const last = FLOW_STEPS.length - 1;

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Desktop: one connected pipeline, drawn segment by segment */}
      <div className="hidden lg:flex items-start justify-between gap-0">
        {FLOW_STEPS.map((step, i) => (
          <FlowNode
            key={step.step}
            step={step}
            index={i}
            isInView={isInView}
            shouldReduce={shouldReduce}
            size="lg"
            connector={i < last}
          />
        ))}
      </div>

      {/* Tablet and phone: the same tiles in a grid, still landing in order */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FLOW_STEPS.map((step, i) => (
          <div key={step.step} className="flex flex-col items-center">
            <FlowNode
              step={step}
              index={i}
              isInView={isInView}
              shouldReduce={shouldReduce}
              size="sm"
            />
            {i < last && (
              /* The phone's stand-in for the rail: it arrives in the same gap
                 the desktop segment draws in. */
              <motion.div
                className="mt-1 text-[var(--text-muted)] text-base sm:hidden"
                aria-hidden="true"
                initial={{ opacity: 0, y: shouldReduce ? 0 : -4 }}
                animate={isInView || shouldReduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
                transition={{
                  duration: shouldReduce ? 0 : RAIL_DURATION * 2,
                  delay: shouldReduce ? 0 : railDelay(i),
                  ease: EASE,
                }}
              >
                ↓
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
