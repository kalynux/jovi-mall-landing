"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import {
  BarChart2,
  Bell,
  Box,
  Home,
  Navigation,
  Package,
  Route,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DeviceShell, { DEVICE_ORDER, type Device } from "@/components/ui/DeviceShell";
import { useCardTilt } from "@/components/ui/useCardTilt";
import { useSignatureReducedMotion, useReducedMotionSafe } from "@/lib/reduced-motion";
import { useTranslations } from "next-intl";

/**
 * The three actor consoles — vendor, agency, agent — as running software
 * rather than screenshots.
 *
 * Everything each card does hangs off one integer, the heartbeat. A vendor
 * beat is an order landing, so the same tick raises revenue, extends the
 * chart, pushes a row onto the activity feed and drops a toast. Drive four
 * widgets off four independent timers and you get a slot machine; drive them
 * off one and you get a product where something just happened. That single
 * causal chain is the whole trick, and it is the same one the hero uses when
 * the conversation resolves onto the Order Confirmed badge.
 *
 * The frame is the second claim: each console is one responsive app plus a
 * native build, so the body narrows from browser to tablet to phone while the
 * layout reflows underneath — dropping the least load-bearing stat, shortening
 * the chart, trading a sidebar of chrome for a tab bar. See DeviceShell.
 */

type Variant = "vendor" | "agency" | "agent";

const ROLE: Record<Variant, { accent: string; title: string; address: string; tabs: LucideIcon[] }> = {
  vendor: {
    accent: "#068554",
    title: "Vendor Dashboard",
    address: "app.wimall.com/vendor",
    tabs: [Home, Package, BarChart2, Wallet],
  },
  agency: {
    accent: "#2563eb",
    title: "Agency Console",
    address: "app.wimall.com/agency",
    tabs: [Home, Users, Route, Wallet],
  },
  agent: {
    accent: "#f59e0b",
    title: "Agent App",
    address: "app.wimall.com/agent",
    tabs: [Home, Navigation, Package, Wallet],
  },
};

/** How long one beat lasts. Slow enough to read a change, fast enough to catch two. */
const BEAT_MS = 3400;
/** How long the device rail dwells on a body before advancing itself. */
const DEVICE_MS = 5600;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export default function DashboardMockup({
  variant = "vendor",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const t = useTranslations("trust.dashboard");
  const { accent, title, address, tabs } = ROLE[variant];
  const reduce = useReducedMotionSafe();
  const holder = useRef<HTMLDivElement>(null);
  // Not `once` — a card that scrolled away stops burning timers, and picks the
  // story back up from wherever it left off when you come back to it.
  const inView = useInView(holder, { amount: 0.25 });
  const running = !reduce && inView;

  const beat = useHeartbeat(BEAT_MS, running);

  const [device, setDevice] = useState<Device>("desktop");
  const [taken, setTaken] = useState(false);
  useEffect(() => {
    if (taken || !running) return;
    const id = setInterval(
      () => setDevice((d) => DEVICE_ORDER[(DEVICE_ORDER.indexOf(d) + 1) % DEVICE_ORDER.length]),
      DEVICE_MS
    );
    return () => clearInterval(id);
  }, [taken, running]);

  const tilt = useCardTilt({ enabled: !useSignatureReducedMotion(), maxTilt: 7 });
  const badgeTravel = tilt.useTravel(-14);

  return (
    // No role="img" here: the rail below the frame holds real buttons, and
    // burying controls inside an image role hides them from assistive tech.
    // The device itself is marked decorative inside DeviceShell instead, which
    // leaves the rail and its caption — the parts that actually say something —
    // exposed.
    <div ref={holder} className={cn("[perspective:1200px]", className)} {...tilt.surfaceProps}>
      <motion.div style={tilt.enabled ? { rotateX: tilt.rotateX, rotateY: tilt.rotateY } : undefined}>
        <DeviceShell
          device={device}
          onDeviceChange={(d) => {
            setDevice(d);
            setTaken(true); // their choice now; stop cycling under them
          }}
          railId={`device-rail-${variant}`}
          accent={accent}
          address={address}
          title={title}
          tabs={tabs}
          glare={tilt.enabled ? tilt.glare : undefined}
          frameClassName="h-[356px] sm:h-[400px] lg:h-[clamp(400px,50svh,468px)]"
          labels={{
            rail: t("deviceRail"),
            desktop: t("desktop"),
            tablet: t("tablet"),
            phone: t("phone"),
            capDesktop: t("capDesktop"),
            capTablet: t("capTablet"),
            capPhone: t("capPhone"),
          }}
          badge={
            <motion.div style={tilt.enabled ? { x: badgeTravel.x, y: badgeTravel.y } : undefined}>
              <motion.span
                animate={{ y: reduce ? 0 : [-3.5, 3.5, -3.5] }}
                transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[10px] font-semibold text-white shadow-lg"
                style={{ background: accent }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {running && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  )}
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                {t("live")}
              </motion.span>
            </motion.div>
          }
        >
          <Console variant={variant} device={device} accent={accent} beat={beat} running={running} t={t} />
        </DeviceShell>
      </motion.div>
    </div>
  );
}

/** One clock per card. Parked — not merely paused — while off-screen. */
function useHeartbeat(period: number, running: boolean) {
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setBeat((b) => b + 1), period);
    return () => clearInterval(id);
  }, [period, running]);
  return beat;
}

/* ── Console ────────────────────────────────────────────────────────────── */

type T = ReturnType<typeof useTranslations>;

interface ConsoleProps {
  variant: Variant;
  device: Device;
  accent: string;
  beat: number;
  running: boolean;
  t: T;
}

function Console({ variant, device, accent, beat, running, t }: ConsoleProps) {
  const dense = device === "phone";
  // The one event per beat worth interrupting someone for. The agent only gets
  // one when a drop actually completes — a courier notified every three seconds
  // would stop reading them.
  const toasting =
    running && beat > 0 && (variant !== "agent" || beat % AGENT_CYCLE === 0);
  const toastText =
    variant === "vendor" ? t("toastOrder") : variant === "agency" ? t("toastDispatch") : t("toastDelivered");

  return (
    <div className={cn("relative flex h-full flex-col overflow-hidden", dense ? "gap-2.5 p-2.5" : "gap-3 p-3.5")}>
      <Stats variant={variant} dense={dense} accent={accent} beat={beat} t={t} />

      {variant === "vendor" && <VendorPanels dense={dense} accent={accent} beat={beat} t={t} />}
      {variant === "agency" && <AgencyPanels dense={dense} accent={accent} beat={beat} t={t} />}
      {variant === "agent" && <AgentPanels dense={dense} accent={accent} beat={beat} t={t} />}

      {/* In-app toast. It sits inside the screen rather than floating off the
          card, because that is where a real notification would land — and it
          survives the frame narrowing to 252px without clipping.

          Keyed on the beat, so a new beat remounts it and replays the whole
          arrive-hold-leave sequence. No dismissal timer, no state: the toast's
          entire life is one keyframe list. */}
      {toasting && (
        <motion.div
          key={beat}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: [0, 1, 1, 0], y: [16, 0, 0, 6], scale: [0.96, 1, 1, 0.98] }}
          transition={{ duration: 2.9, times: [0, 0.16, 0.8, 1], ease: [0.34, 1.4, 0.64, 1] }}
          className="absolute inset-x-3 bottom-3 z-20 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 shadow-lg"
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
            style={{ background: `${accent}1f` }}
          >
            <Bell className="h-2.5 w-2.5" style={{ color: accent }} />
          </span>
          <span className="truncate font-display text-[10px] font-semibold text-[var(--text-primary)]">
            {toastText}
          </span>
        </motion.div>
      )}
    </div>
  );
}

/* ── Stats ──────────────────────────────────────────────────────────────── */

function Stats({
  variant,
  dense,
  accent,
  beat,
  t,
}: {
  variant: Variant;
  dense: boolean;
  accent: string;
  beat: number;
  t: T;
}) {
  const cycles = Math.floor(beat / AGENT_CYCLE);

  const stats =
    variant === "vendor"
      ? [
          { icon: TrendingUp, label: t("stRevenue"), value: `₦ ${(284 + beat * 2.45).toFixed(1)}K`, up: true },
          { icon: ShoppingCart, label: t("stOrders"), value: `${(1240 + beat).toLocaleString("en-US")}`, up: true },
          { icon: Box, label: t("stProducts"), value: "86", up: false },
        ]
      : variant === "agency"
        ? [
            { icon: Package, label: t("stDeliveries"), value: `${(3820 + beat).toLocaleString("en-US")}`, up: true },
            { icon: Users, label: t("stAgents"), value: `${40 + (beat % 5)}`, up: true },
            { icon: TrendingUp, label: t("stEarnings"), value: `₦ ${(96 + beat * 0.8).toFixed(1)}K`, up: true },
          ]
        : [
            { icon: Package, label: t("stDelivered"), value: `${148 + cycles}`, up: true },
            { icon: TrendingUp, label: t("stEarnings"), value: `₦ ${(38 + cycles * 1.2).toFixed(1)}K`, up: true },
            { icon: Star, label: t("stRating"), value: "4.9", up: false },
          ];

  // The phone drops the third metric rather than shrinking all three into
  // unreadability — which is the actual decision a responsive layout makes.
  const shown = dense ? stats.slice(0, 2) : stats;

  return (
    <div className={cn("grid shrink-0 gap-2", dense ? "grid-cols-2" : "grid-cols-3")}>
      {shown.map((s) => (
        <div
          key={s.label}
          className={cn(
            "rounded-xl border border-[var(--border)] bg-[var(--bg)]",
            dense ? "p-2" : "p-2.5"
          )}
        >
          <div className="mb-1 flex items-center gap-1">
            <s.icon className="h-3 w-3 shrink-0" style={{ color: accent }} />
            <span className="truncate text-[9px] font-medium text-[var(--text-muted)]">{s.label}</span>
          </div>
          <Odometer
            value={s.value}
            className="font-display text-sm font-bold text-[var(--text-primary)]"
          />
          <div className={cn("text-[9px] font-medium", s.up ? "text-green-500" : "text-[var(--text-muted)]")}>
            {s.up ? t("up") : t("stable")}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A number that changes the way a number on a dashboard changes: the old value
 * leaves upward, the new one arrives from below. Cheap, and it draws the eye to
 * exactly the figure that moved.
 */
function Odometer({ value, className }: { value: string; className?: string }) {
  // Height and line-height are the same multiple of the font size, so the
  // window is exactly one line tall whatever type scale it inherits — anything
  // else clips descenders on one card and leaves a gap on another.
  return (
    <span className={cn("relative block h-[1.4em] overflow-hidden leading-[1.4]", className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          initial={{ y: "-105%" }}
          animate={{ y: "0%" }}
          exit={{ y: "105%" }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 top-0 block truncate tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ── Vendor ─────────────────────────────────────────────────────────────── */

const ACTIVITY_KEYS = ["recentActivity1", "recentActivity2", "recentActivity3"] as const;
const CHART_COLUMNS = 12;

/**
 * The height of column `id`, forever. Two slow octaves plus a hashed jitter:
 * the sine gives neighbouring days a relationship — takings that trend, the way
 * a real week does — and the hash keeps it from reading as a wave.
 *
 * Derived rather than random-walked into state so the server and the client
 * draw the same chart, and so a column's height never changes once it exists.
 */
function column(id: number) {
  const wave = Math.sin(id * 0.68) * 0.5 + 0.5;
  const x = Math.sin(id * 12.9898) * 43758.5453;
  const jitter = x - Math.floor(x);
  return clamp(0.26 + (wave * 0.56 + jitter * 0.44) * 0.74, 0.26, 1);
}

function VendorPanels({ dense, accent, beat, t }: { dense: boolean; accent: string; beat: number; t: T }) {
  // A rolling window, not a decorative sparkline: the window is [beat,
  // beat+11], so every beat retires the oldest column on the left and lands a
  // new one on the right. Keys are the column ids, which is what lets the new
  // one grow in while the survivors hold still.
  const columns = Array.from({ length: CHART_COLUMNS }, (_, i) => ({ id: beat + i, h: column(beat + i) }));

  // Newest first. Same trick: the ids walk with the beat, so the top row is a
  // fresh mount and the third falls off the bottom.
  const rows = Array.from({ length: dense ? 1 : 3 }, (_, k) => {
    const id = beat - k;
    return { id, k: ACTIVITY_KEYS[((id % 3) + 3) % 3] };
  });

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <span className="font-display text-[9px] font-semibold text-[var(--text-secondary)]">
            {t("performance")}
          </span>
          <BarChart2 className="h-3 w-3 text-[var(--text-muted)]" />
        </div>
        <div className={cn("flex min-h-0 flex-1 items-end gap-1", dense && "gap-[3px]")}>
          {columns.map((b, i) => (
            <motion.div
              key={b.id}
              className="min-w-0 flex-1 rounded-t-[3px]"
              initial={{ height: "0%", opacity: 0 }}
              // Opacity is a function of position, and position walks left with
              // every beat — so each column quietly fades as its day ages out.
              animate={{ height: `${b.h * 100}%`, opacity: 0.5 + i * 0.04 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: `linear-gradient(to top, ${accent}cc, ${accent}3d)` }}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 space-y-1.5">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.div
              key={row.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
              <span className="truncate text-[9px] text-[var(--text-secondary)]">{t(row.k)}</span>
              <Bell className="ml-auto h-2.5 w-2.5 shrink-0 text-[var(--text-muted)]" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

/* ── Agency ─────────────────────────────────────────────────────────────── */

const ROSTER = ["Chidi", "Amara", "Tunde", "Ngozi"];
const STATUS = ["online", "enRoute", "idle"] as const;
const STATUS_DOT: Record<(typeof STATUS)[number], string> = {
  online: "#22c55e",
  enRoute: "#f59e0b",
  idle: "#9ca3af",
};

function AgencyPanels({
  dense,
  accent,
  beat,
  t,
}: {
  dense: boolean;
  accent: string;
  beat: number;
  t: T;
}) {
  const roster = dense ? ROSTER.slice(0, 3) : ROSTER;
  // Whoever is nearest takes the beat's order. Offsetting each agent by their
  // index keeps the board from flipping in unison, which no real roster does.
  const assignee = beat % roster.length;
  const load = 68 + ((beat * 7) % 25);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <span className="font-display text-[9px] font-semibold text-[var(--text-secondary)]">
            {t("agentsOnline")}
          </span>
          <Users className="h-3 w-3 text-[var(--text-muted)]" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-around">
          {roster.map((name, i) => {
            const status = STATUS[(beat + i) % STATUS.length];
            const taking = i === assignee && beat > 0;
            return (
              <div key={name} className="flex items-center gap-2">
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  {/* Re-keyed on the beat so the one-shot ring fires again each
                      time this agent is the one picked up by dispatch. */}
                  {taking && <span key={beat} className="node-wake absolute inset-0 rounded-full" />}
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: accent }}
                  >
                    {name[0]}
                  </span>
                </span>
                <span className="truncate text-[10px] font-medium text-[var(--text-primary)]">{name}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1 text-[9px] text-[var(--text-muted)]">
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full"
                    animate={{ backgroundColor: STATUS_DOT[status] }}
                    transition={{ duration: 0.4 }}
                  />
                  {t(status)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-[9px] font-semibold text-[var(--text-secondary)]">
            {t("dispatchLoad")}
          </span>
          <span className="font-display text-[9px] font-bold tabular-nums" style={{ color: accent }}>
            {load}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <motion.div
            className="h-full rounded-full"
            initial={false}
            animate={{ width: `${load}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: accent }}
          />
        </div>
      </div>
    </>
  );
}

/* ── Agent ──────────────────────────────────────────────────────────────── */

/** Beats per delivery: pickup → drop-off → paid → next job. */
const AGENT_CYCLE = 8;

/**
 * The route, in a 0–100 box. Deliberately orthogonal with two dog-legs: a
 * straight line between two pins is a diagram, a turn or three is a street.
 */
const ROUTE: [number, number][] = [
  [10, 80],
  [10, 54],
  [37, 54],
  [37, 31],
  [66, 31],
  [66, 17],
  [90, 17],
];

/** Position along the polyline at t ∈ 0–1, measured by real segment length. */
function pointOnRoute(t: number): [number, number] {
  const lengths = ROUTE.slice(1).map(([x, y], i) => Math.hypot(x - ROUTE[i][0], y - ROUTE[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let travelled = clamp(t, 0, 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (travelled <= lengths[i]) {
      const f = lengths[i] === 0 ? 0 : travelled / lengths[i];
      return [
        ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * f,
        ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * f,
      ];
    }
    travelled -= lengths[i];
  }
  return ROUTE[ROUTE.length - 1];
}

const ROUTE_D = ROUTE.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");

function AgentPanels({
  dense,
  accent,
  beat,
  t,
}: {
  dense: boolean;
  accent: string;
  beat: number;
  t: T;
}) {
  const step = beat % AGENT_CYCLE;
  const progress = step / (AGENT_CYCLE - 1);
  const eta = Math.max(2, 18 - step * 2);
  const [mx, my] = pointOnRoute(progress);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <span className="font-display text-[9px] font-semibold text-[var(--text-secondary)]">
            {t("activeDelivery")}
          </span>
          <span
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white"
            style={{ background: accent }}
          >
            <Navigation className="h-2.5 w-2.5" />
            {t("enRoute")}
          </span>
        </div>

        {/* The map. Two faint grids stand in for a street plan — enough to read
            as a city without pretending to be one. */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
          {/* The box is stretched to fill the panel (preserveAspectRatio="none"),
              which would otherwise squash horizontal strokes against vertical
              ones — non-scaling-stroke keeps every line the same weight on
              screen while the geometry stretches. */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <g stroke="var(--border)" strokeWidth="1" opacity="0.75" vectorEffect="non-scaling-stroke">
              {[18, 40, 62, 84].map((y) => (
                <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} vectorEffect="non-scaling-stroke" />
              ))}
              {[16, 44, 72].map((x) => (
                <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            <path
              d={ROUTE_D}
              fill="none"
              stroke={`${accent}33`}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <motion.path
              d={ROUTE_D}
              fill="none"
              stroke={accent}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={false}
              animate={{ pathLength: progress }}
              transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
            />
          </svg>

          {/* Pins and courier ride above the svg so they never scale with
              preserveAspectRatio="none" — a squashed pin gives the trick away. */}
          <Pin x={ROUTE[0][0]} y={ROUTE[0][1]} className="border-[var(--text-muted)] bg-[var(--bg)]" />
          <Pin x={ROUTE[ROUTE.length - 1][0]} y={ROUTE[ROUTE.length - 1][1]} style={{ borderColor: accent, background: accent }} />
          <motion.span
            className="absolute z-10 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md"
            style={{ background: accent }}
            initial={false}
            animate={{ left: `${mx}%`, top: `${my}%` }}
            transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
          >
            <Navigation className="h-2 w-2" />
          </motion.span>
        </div>

        {!dense && (
          <div className="mt-2 flex shrink-0 items-center justify-between text-[9px]">
            <span className="text-[var(--text-muted)]">
              {t("pickup")} · <span className="font-medium text-[var(--text-primary)]">WiTech Store</span>
            </span>
            <span className="text-[var(--text-muted)]">
              {t("dropoff")} · <span className="font-medium text-[var(--text-primary)]">Lekki Phase 1</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
        <Clock className="h-4 w-4 shrink-0" style={{ color: accent }} />
        <span className="text-[9px] text-[var(--text-muted)]">{t("eta")}</span>
        <Odometer
          value={`${eta} min`}
          className="ml-auto text-right font-display text-sm font-bold text-[var(--text-primary)]"
        />
      </div>
    </>
  );
}

function Pin({
  x,
  y,
  className,
  style,
}: {
  x: number;
  y: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2", className)}
      style={{ left: `${x}%`, top: `${y}%`, ...style }}
    />
  );
}
