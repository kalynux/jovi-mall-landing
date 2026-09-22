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
type PhaseKey = "phases.conversation" | "phases.dispatch" | "phases.payout";

const STEP_KEYS: { titleKey: FlowStepKey; descKey: FlowDescKey }[] = [
  { titleKey: "flow.step1Title", descKey: "flow.step1Desc" },
  { titleKey: "flow.step2Title", descKey: "flow.step2Desc" },
  { titleKey: "flow.step3Title", descKey: "flow.step3Desc" },
  { titleKey: "flow.step4Title", descKey: "flow.step4Desc" },
  { titleKey: "flow.step5Title", descKey: "flow.step5Desc" },
  { titleKey: "flow.step6Title", descKey: "flow.step6Desc" },
];

/**
 * The six stations read as three pairs, and that grouping is the hierarchy the
 * flat six-across row was missing. Each phase brackets two consecutive steps,
 * so `from`/`to` are also what slices FLOW_STEPS for the stacked layout.
 */
const PHASES: { key: PhaseKey; from: number; to: number }[] = [
  { key: "phases.conversation", from: 0, to: 1 },
  { key: "phases.dispatch", from: 2, to: 3 },
  { key: "phases.payout", from: 4, to: 5 },
];

/**
 * Which accent each station flies, as a `.role-*` wrapper class that sets
 * `--role` for everything inside it: node tint, icon, rail segment, wake pulse.
 *
 * The colour changes hands as the work does. The customer opens, the platform
 * answers, the vendor's order is raised, then the agency's blue and the agent's
 * amber mark the two steps a human partner owns, and the payout returns to the
 * brand accent. Four of the six are greens, which is the point: the blue and the
 * amber are the only two moments meant to catch the eye.
 *
 * This deliberately ignores FLOW_STEPS[].color, which only knows "wa" and
 * "primary". `--whatsapp` is a display green that fails contrast as an icon or
 * text colour on a light surface, so it is not used as a `--role` here.
 */
const STATION_ROLE = [
  "role-customer",
  "role-accent",
  "role-vendor",
  "role-agency",
  "role-agent",
  "role-accent",
] as const;

/** The rail's resting tint, mixed from whichever `--role` is in scope. */
const RAIL_TINT = "color-mix(in srgb, var(--role) 32%, transparent)";

/* Entrance choreography. One station lands every NODE_STEP, and the rail
   segment leaving it draws in the gap before the next one arrives, so the
   sequence is read rather than watched all at once. */
const NODE_BASE = 0.1;
const NODE_STEP = 0.18;
const NODE_DURATION = 0.42;
const RAIL_DURATION = 0.16;
const EASE = [0.22, 1, 0.36, 1] as const;

const nodeDelay = (i: number) => NODE_BASE + i * NODE_STEP;
/** The wake pulse fires as the station finishes settling, not as it starts. */
const wakeDelay = (i: number) => nodeDelay(i) + 0.18;
const railDelay = (i: number) => nodeDelay(i) + 0.02;

interface FlowDiagramProps {
  className?: string;
}

/** The icon chip. Squared to sit with `.tag`; tinted by the station's `--role`. */
function StationNode({
  icon,
  size,
  wake,
  index,
}: {
  icon: string;
  size: "sm" | "lg";
  wake: boolean;
  index: number;
}) {
  const Icon = ICON_MAP[icon as keyof typeof ICON_MAP];
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-center rounded-[var(--radius-xs)] border border-role-soft bg-role-soft shadow-xs",
        size === "lg" ? "h-[3.25rem] w-[3.25rem]" : "h-11 w-11",
        wake && "node-wake"
      )}
      style={{ animationDelay: wake ? `${wakeDelay(index)}s` : undefined }}
    >
      <Icon className={cn("text-role", size === "lg" ? "h-6 w-6" : "h-5 w-5")} aria-hidden="true" />
    </div>
  );
}

/** The phase bracket's quiet label. */
function PhaseLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[11px] font-bold uppercase text-[var(--text-muted)]">
      {children}
    </span>
  );
}

/** `01` through `06`. Generated, never translated, so tracking is safe here. */
function StationNumber({ step }: { step: number }) {
  return (
    <span className="font-display text-[11px] font-bold tabular-nums tracking-[0.14em] text-[var(--text-muted)]">
      {String(step).padStart(2, "0")}
    </span>
  );
}

export default function FlowDiagram({ className }: FlowDiagramProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const shouldReduce = useReducedMotionSafe();
  const t = useTranslations("howItWorks");
  const last = FLOW_STEPS.length - 1;

  /** Shared entrance for a station, on either axis. */
  const station = (i: number) => ({
    initial: { opacity: 0, y: shouldReduce ? 0 : 16 },
    animate: isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: shouldReduce ? 0 : 16 },
    transition: {
      duration: shouldReduce ? 0 : NODE_DURATION,
      delay: shouldReduce ? 0 : nodeDelay(i),
      ease: EASE,
    },
  });

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* ── Wide: one horizontal track, three phases, six stations ───────── */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-6 gap-x-6">
          {PHASES.map((phase) => (
            <div key={phase.key} className="col-span-2 border-t border-[var(--border)] pt-3">
              <PhaseLabel>{t(phase.key)}</PhaseLabel>
            </div>
          ))}
        </div>

        <ol className="mt-8 grid list-none grid-cols-6 gap-x-6">
          {FLOW_STEPS.map((step, i) => (
            <motion.li
              key={step.step}
              className={cn("flex flex-col items-center text-center", STATION_ROLE[i])}
              {...station(i)}
            >
              <StationNumber step={step.step} />
              {/* Full column width, node height — which is what lets the segment
                  below pin itself to the node's centre and run to the next
                  node's edge without knowing anything about the copy around it. */}
              <div className="relative mt-3 flex w-full justify-center">
                {i < last && (
                  <motion.span
                    aria-hidden="true"
                    /* start: this node's trailing edge, half of 3.25rem past the
                       column centre. end: the next node's leading edge, which is
                       half a column plus the 1.5rem gap past this column's end. */
                    className="absolute top-[calc(50%_-_1px)] h-[2px] origin-left start-[calc(50%_+_1.625rem)] end-[calc(0.125rem_-_50%)] rtl:origin-right"
                    style={{ background: RAIL_TINT }}
                    initial={{ scaleX: shouldReduce ? 1 : 0 }}
                    animate={isInView || shouldReduce ? { scaleX: 1 } : { scaleX: 0 }}
                    transition={{
                      duration: shouldReduce ? 0 : RAIL_DURATION,
                      delay: shouldReduce ? 0 : railDelay(i),
                      ease: "linear",
                    }}
                  />
                )}
                <StationNode icon={step.icon} size="lg" wake={isInView && !shouldReduce} index={i} />
              </div>
              {/* Two lines' worth of floor, so the descriptions below start on
                  the same baseline across the row even though "Order is
                  created" is a line shorter than its neighbours. */}
              <h3 className="mt-5 min-h-[2.6rem] font-display text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
                {t(STEP_KEYS[i].titleKey)}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
                {t(STEP_KEYS[i].descKey)}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>

      {/* ── Narrow: the same track stood on its end ──────────────────────── */}
      <ol className="mx-auto max-w-xl list-none lg:hidden">
        {PHASES.map((phase, p) => (
          <li key={phase.key}>
            {/* The label sits ON the rail rather than beside it, so the line
                runs unbroken from station 01 through to station 06. */}
            <div className="relative flex gap-4">
              <div className={cn("relative w-11 flex-none", p > 0 && STATION_ROLE[phase.from - 1])}>
                {p > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 inset-y-0 mx-auto w-[2px]"
                    style={{ background: RAIL_TINT }}
                  />
                )}
              </div>
              <div className={cn("min-w-0 flex-1 pb-4", p > 0 && "pt-7")}>
                <PhaseLabel>{t(phase.key)}</PhaseLabel>
              </div>
            </div>

            <ol className="list-none">
              {FLOW_STEPS.slice(phase.from, phase.to + 1).map((step, offset) => {
                const i = phase.from + offset;
                const isLast = i === last;
                return (
                  <motion.li
                    key={step.step}
                    className={cn("flex gap-4", STATION_ROLE[i])}
                    {...station(i)}
                  >
                    {/* Stretches to the row's full height, which is what lets the
                        rail end exactly where the next node begins. */}
                    <div className="relative w-11 flex-none">
                      <StationNode
                        icon={step.icon}
                        size="sm"
                        wake={isInView && !shouldReduce}
                        index={i}
                      />
                      {!isLast && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 bottom-0 top-11 mx-auto w-[2px]"
                          style={{ background: RAIL_TINT }}
                        />
                      )}
                    </div>
                    {/* The row gap lives here, not on the row, so the rail above
                        measures it as part of the row and spans it. */}
                    <div className={cn("min-w-0 flex-1", isLast ? "pb-0" : "pb-7")}>
                      <div className="flex items-baseline gap-2">
                        <StationNumber step={step.step} />
                        <h3 className="font-display text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
                          {t(STEP_KEYS[i].titleKey)}
                        </h3>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">
                        {t(STEP_KEYS[i].descKey)}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
