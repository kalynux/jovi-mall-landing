"use client";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { MessageCircle, Sparkles, ShoppingCart, Building2, Bike, Banknote, ChevronRight } from "lucide-react";
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

export default function FlowDiagram({ className }: FlowDiagramProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const shouldReduce = useReducedMotion();
  const t = useTranslations("howItWorks");

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Desktop layout */}
      <div className="hidden lg:flex items-start justify-between gap-0">
        {FLOW_STEPS.map((step, i) => {
          const Icon = ICON_MAP[step.icon as keyof typeof ICON_MAP];
          const isWa = step.color === "wa";
          const isLast = i === FLOW_STEPS.length - 1;
          const { titleKey, descKey } = STEP_KEYS[i];

          return (
            <div key={step.step} className="flex items-start flex-1">
              <motion.div
                initial={{ opacity: 0, y: shouldReduce ? 0 : 28 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                transition={{ duration: 0.5, delay: shouldReduce ? 0 : i * 0.12 + 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center text-center flex-1 px-1"
              >
                <div className="relative mb-4">
                  <div
                    className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border border-[var(--border)] shadow-card")}
                    style={{ background: isWa ? "linear-gradient(135deg, rgba(37,211,102,0.12), rgba(18,140,126,0.08))" : "var(--accent-light)" }}
                  >
                    <Icon className={cn("w-6 h-6", isWa ? "text-wa-dark dark:text-wa" : "text-primary-600 dark:text-primary-400")} />
                  </div>
                  <div className={cn("absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center font-display text-white", isWa ? "bg-wa-dark" : "bg-primary-600")}>
                    {step.step}
                  </div>
                </div>
                <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-1.5 leading-tight">{t(titleKey)}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t(descKey)}</p>
              </motion.div>

              {!isLast && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: shouldReduce ? 0 : i * 0.12 + 0.4, duration: 0.3 }}
                  className="flex-shrink-0 flex items-center justify-center mt-4"
                >
                  <ChevronRight className={cn("w-5 h-5", i === FLOW_STEPS.length - 2 ? "text-wa/60" : "text-primary-400/60")} />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile layout */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FLOW_STEPS.map((step, i) => {
          const Icon = ICON_MAP[step.icon as keyof typeof ICON_MAP];
          const isWa = step.color === "wa";
          const { titleKey, descKey } = STEP_KEYS[i];

          return (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: shouldReduce ? 0 : i * 0.1 + 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center text-center"
            >
              <div className="relative mb-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center border border-[var(--border)] shadow-card"
                  style={{ background: isWa ? "linear-gradient(135deg, rgba(37,211,102,0.12), rgba(18,140,126,0.08))" : "var(--accent-light)" }}
                >
                  <Icon className={cn("w-5 h-5", isWa ? "text-wa-dark dark:text-wa" : "text-primary-600 dark:text-primary-400")} />
                </div>
                <div className={cn("absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center font-display text-white", isWa ? "bg-wa-dark" : "bg-primary-600")}>
                  {step.step}
                </div>
              </div>

              <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-1 leading-tight">{t(titleKey)}</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t(descKey)}</p>

              {i < FLOW_STEPS.length - 1 && (
                <div className="mt-3 text-[var(--text-muted)] text-base sm:hidden">↓</div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
