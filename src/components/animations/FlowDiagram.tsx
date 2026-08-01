"use client";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
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

// The automation "reaches" each node in sequence, timed to trail the travelling
// current in the rail (see .flow-rail / .node-wake in globals.css).
const WAKE_BASE = 0.35;
const WAKE_STEP = 0.36;

/** One pipeline node — icon, number, title, copy. Wakes in sequence once in view. */
function FlowNode({
  step,
  index,
  isInView,
  shouldReduce,
  size,
}: {
  step: (typeof FLOW_STEPS)[number];
  index: number;
  isInView: boolean;
  shouldReduce: boolean;
  size: "sm" | "lg";
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
      initial={{ opacity: 0, y: shouldReduce ? 0 : 22 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
      transition={{ duration: 0.45, delay: shouldReduce ? 0 : index * 0.07 + 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center flex-1 px-1"
    >
      <div className="relative mb-4">
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
            animationDelay: wake ? `${WAKE_BASE + index * WAKE_STEP}s` : undefined,
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
      <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-1.5 leading-tight">{t(titleKey)}</h3>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t(descKey)}</p>
    </motion.div>
  );
}

export default function FlowDiagram({ className }: FlowDiagramProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const shouldReduce = useReducedMotion();

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Desktop: a single connected pipeline with a travelling current */}
      <div className="hidden lg:block relative">
        {/* The rail sits behind the icon row, at the icons' vertical centre
            (icon box is 56px tall → centre ≈ 28px = top-7). The current runs
            once when the section scrolls into view, then rests. */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute left-[8%] right-[8%] top-7 h-[3px] -translate-y-1/2 rounded-full flow-rail",
            isInView && "is-live"
          )}
        />
        <div className="relative flex items-start justify-between gap-0">
          {FLOW_STEPS.map((step, i) => (
            <FlowNode
              key={step.step}
              step={step}
              index={i}
              isInView={isInView}
              shouldReduce={!!shouldReduce}
              size="lg"
            />
          ))}
        </div>
      </div>

      {/* Mobile: vertical rhythm, nodes still wake in sequence */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FLOW_STEPS.map((step, i) => (
          <div key={step.step} className="flex flex-col items-center">
            <FlowNode
              step={step}
              index={i}
              isInView={isInView}
              shouldReduce={!!shouldReduce}
              size="sm"
            />
            {i < FLOW_STEPS.length - 1 && (
              <div className="mt-1 text-[var(--text-muted)] text-base sm:hidden" aria-hidden="true">↓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
