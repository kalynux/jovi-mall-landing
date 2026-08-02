"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type MotionValue } from "framer-motion";
import { Monitor, Smartphone, Tablet, Wifi, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DeviceShell — one console, three bodies.
 *
 * The three actor dashboards all ship as a responsive web app *and* a native
 * app, and saying so in a bullet is worth far less than showing it: the frame
 * physically narrows from a browser window to a tablet to a phone while the
 * dashboard inside reflows, live, without ever reloading. Height is constant
 * across all three so the page never jumps — only the width travels, which is
 * exactly what "responsive" means anyway.
 *
 * The rail underneath auto-advances until the visitor touches it, then it is
 * theirs; we stop cycling rather than fighting them for the control.
 */

export type Device = "desktop" | "tablet" | "phone";

export const DEVICE_ORDER: readonly Device[] = ["desktop", "tablet", "phone"];

/** Portrait widths, in px. Desktop takes whatever the column gives it. */
const DEVICE_WIDTH: Record<Exclude<Device, "desktop">, number> = {
  tablet: 404,
  phone: 252,
};

const DEVICE_ICON: Record<Device, LucideIcon> = {
  desktop: Monitor,
  tablet: Tablet,
  phone: Smartphone,
};

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface DeviceShellProps {
  device: Device;
  onDeviceChange: (device: Device) => void;
  /** Unique per instance — three shells share the page, and layoutId is global. */
  railId: string;
  accent: string;
  /** Address-bar text for the desktop chrome. */
  address: string;
  /** App name, beside the traffic lights and under the phone's app bar. */
  title: string;
  /** Bottom-tab glyphs for the phone body. The first is the active tab. */
  tabs: LucideIcon[];
  /** Localised strings — the shell has no opinion about language. */
  labels: {
    rail: string;
    desktop: string;
    tablet: string;
    phone: string;
    capDesktop: string;
    capTablet: string;
    capPhone: string;
  };
  /** Height of the frame area. Constant across bodies — only width travels. */
  frameClassName?: string;
  /** Pointer-tracking glare, painted over the screen in soft-light. */
  glare?: MotionValue<string>;
  /** Floats off the frame's top-right corner and travels with it. */
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export default function DeviceShell({
  device,
  onDeviceChange,
  railId,
  accent,
  address,
  title,
  tabs,
  labels,
  frameClassName,
  glare,
  badge,
  className,
  children,
}: DeviceShellProps) {
  const holder = useRef<HTMLDivElement>(null);
  // The frame's width has to be a number for it to animate, and a number is
  // exactly what the server doesn't have. So until we've measured, the frame is
  // plain `w-full` — which is the correct width anyway, because the rail always
  // starts on desktop. The measurement lands in a layout effect, before the
  // browser paints, so the swap from 100% to the identical pixel value is not
  // something anyone can see.
  const [column, setColumn] = useState<number | null>(null);

  useIsoLayoutEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setColumn(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handheld = device !== "desktop";
  const width = column === null ? null : device === "desktop" ? column : Math.min(column, DEVICE_WIDTH[device]);
  const caption = device === "desktop" ? labels.capDesktop : device === "tablet" ? labels.capTablet : labels.capPhone;

  return (
    <div className={cn("flex flex-col", className)}>
      <div ref={holder} className={cn("relative flex items-stretch justify-center", frameClassName)}>
        <motion.div
          // The whole device is decorative — mock data in a drawn frame. The
          // rail and caption below it carry the actual information, and they
          // stay outside this subtree so assistive tech still reaches them.
          aria-hidden="true"
          className={cn("relative h-full shrink-0 box-border", width === null && "w-full")}
          initial={false}
          animate={width === null ? { padding: handheld ? 9 : 0 } : { width, padding: handheld ? 9 : 0 }}
          transition={{ duration: 0.72, ease: [0.65, 0, 0.2, 1] }}
        >
          {/* Two bodies, cross-faded under one screen: the aluminium slab a
              handheld is milled from, and the light window a browser draws. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 rounded-[30px] bg-surface-900 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
            initial={false}
            animate={{ opacity: handheld ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] shadow-[0_18px_50px_rgba(0,0,0,0.14)]"
            initial={false}
            animate={{ opacity: handheld ? 0 : 1 }}
            transition={{ duration: 0.4 }}
          />

          {/* Screen */}
          <motion.div
            className="relative flex h-full flex-col overflow-hidden bg-[var(--bg-subtle)]"
            initial={false}
            animate={{ borderRadius: handheld ? 22 : 16 }}
            transition={{ duration: 0.72, ease: [0.65, 0, 0.2, 1] }}
          >
            {glare && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-30 mix-blend-soft-light"
                style={{ background: glare }}
              />
            )}

            <Chrome device={device} accent={accent} address={address} title={title} />

            <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>

            <AnimatePresence initial={false}>
              {device === "phone" && (
                <motion.div
                  key="tabbar"
                  // Height, not just opacity: the tab bar has to take its space
                  // away on the way out, or the dashboard above it snaps up the
                  // moment the exit finishes.
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className="flex shrink-0 items-center justify-around overflow-hidden border-t border-[var(--border)] bg-[var(--bg)] px-2 pb-2 pt-1.5"
                  aria-hidden="true"
                >
                  {tabs.map((Tab, i) => (
                    <span
                      key={i}
                      className="flex flex-col items-center gap-1"
                      style={{ color: i === 0 ? accent : "var(--text-subtle)" }}
                    >
                      <Tab className="h-4 w-4" />
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{ background: i === 0 ? accent : "transparent" }}
                      />
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Hairline over the screen. The screen fills the frame exactly on
              desktop, so it covers the window shell's own border — on handheld
              the bezel's 9px of padding shows instead and this fades out. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 border border-[var(--border)]"
            initial={false}
            animate={{ opacity: handheld ? 0 : 1, borderRadius: handheld ? 30 : 16 }}
            transition={{ duration: 0.4 }}
          />

          {badge && <div className="absolute -top-3.5 right-2 z-40">{badge}</div>}
        </motion.div>
      </div>

      <DeviceRail
        device={device}
        onDeviceChange={onDeviceChange}
        railId={railId}
        accent={accent}
        labels={labels}
      />

      {/* One caption line, swapped with the body. It carries the claim the
          whole control exists to make — including that the phone is a real
          app, not a shrunken web page. */}
      <div className="relative mt-2 flex h-5 items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={device}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.22 }}
            className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]"
          >
            {device === "phone" && (
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                <AppleMark className="h-3 w-3" />
                <PlayMark className="h-3 w-3" />
              </span>
            )}
            {caption}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Chrome ─────────────────────────────────────────────────────────────────
   Only the parts that differ between bodies live here. They cross-fade in
   place while the frame is still travelling, so the swap is never the thing
   you notice — the narrowing is.

   The wrapper owns an animated height and the three chromes are stacked
   absolutely inside it. Swapping them in flow instead (AnimatePresence
   mode="wait") drops the old one before the new one mounts, and the whole
   dashboard jumps up 38px and back down every time the body changes.        */

/** Measured, not guessed: each chrome is pinned to fill exactly this. */
const CHROME_H: Record<Device, number> = { desktop: 38, tablet: 32, phone: 56 };

function Chrome({
  device,
  accent,
  address,
  title,
}: {
  device: Device;
  accent: string;
  address: string;
  title: string;
}) {
  return (
    <motion.div
      className="relative shrink-0 overflow-hidden"
      aria-hidden="true"
      initial={false}
      animate={{ height: CHROME_H[device] }}
      transition={{ duration: 0.45, ease: [0.65, 0, 0.2, 1] }}
    >
      <AnimatePresence initial={false}>
        {device === "desktop" && (
          <motion.div
            key="desktop-chrome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center gap-2 border-b border-[var(--border)] px-4"
            style={{ background: `linear-gradient(90deg, ${accent}14, var(--bg))` }}
          >
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
            </div>
            <span className="ml-2 font-display text-[11px] font-semibold" style={{ color: accent }}>
              {title}
            </span>
            <span className="ml-auto hidden max-w-[46%] truncate rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[9px] text-[var(--text-muted)] sm:block">
              {address}
            </span>
          </motion.div>
        )}

        {device === "tablet" && (
          <motion.div
            key="tablet-chrome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-between border-b border-[var(--border)] px-4"
            style={{ background: `linear-gradient(90deg, ${accent}14, var(--bg))` }}
          >
            <span className="font-display text-[11px] font-semibold" style={{ color: accent }}>
              {title}
            </span>
            {/* Front camera */}
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-subtle)]/50" />
          </motion.div>
        )}

        {device === "phone" && (
          <motion.div
            key="phone-chrome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Status bar, with the notch cut out of the middle of it */}
            <div className="relative flex shrink-0 items-center justify-between px-4 pb-1 pt-1.5 text-[9px] font-medium text-[var(--text-muted)]">
              <span>9:41</span>
              <span className="absolute left-1/2 top-1 h-3.5 w-14 -translate-x-1/2 rounded-full bg-surface-900" />
              <span className="flex items-center gap-1">
                <Wifi className="h-2.5 w-2.5" />
                <span className="relative inline-flex h-2 w-4 items-center rounded-[2px] border border-current px-[1px]">
                  <span className="h-1 w-2.5 rounded-[1px] bg-current" />
                </span>
              </span>
            </div>
            {/* App bar — a native title, not a browser tab */}
            <div
              className="flex flex-1 items-center gap-2 border-b border-[var(--border)] px-3.5"
              style={{ background: `linear-gradient(90deg, ${accent}14, var(--bg))` }}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-[7px] text-[9px] font-bold text-white"
                style={{ background: accent }}
              >
                J
              </span>
              <span className="font-display text-[11px] font-semibold" style={{ color: accent }}>
                {title}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Rail ───────────────────────────────────────────────────────────────── */

function DeviceRail({
  device,
  onDeviceChange,
  railId,
  accent,
  labels,
}: Pick<DeviceShellProps, "device" | "onDeviceChange" | "railId" | "accent" | "labels">) {
  return (
    <div
      className="mt-4 flex shrink-0 items-center justify-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg)] p-1 mx-auto w-fit"
      role="group"
      aria-label={labels.rail}
    >
      {DEVICE_ORDER.map((d) => {
        const Icon = DEVICE_ICON[d];
        const active = d === device;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onDeviceChange(d)}
            aria-pressed={active}
            // The word is hidden below `sm`, so the button needs a name of its own.
            aria-label={labels[d]}
            className="relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-display font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            style={{ color: active ? accent : "var(--text-muted)" }}
          >
            {active && (
              <motion.span
                layoutId={railId}
                className="absolute inset-0 rounded-full"
                style={{ background: `${accent}1f` }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className="relative h-3.5 w-3.5" />
            <span className="relative hidden sm:inline">{labels[d]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Store marks ────────────────────────────────────────────────────────────
   Drawn rather than imported: two 12px glyphs are not worth a brand-icon
   dependency, and at this size only the silhouette survives anyway.        */

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function PlayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3.6 1.84a1 1 0 0 0-.5.88v18.56a1 1 0 0 0 .5.88l10.35-10.14v-.04L3.6 1.84z" opacity=".9" />
      <path d="M17.4 15.5 13.95 12.02v-.04L17.4 8.5l4.03 2.29c1.15.65 1.15 1.71 0 2.37L17.4 15.5z" opacity=".65" />
      <path d="M17.47 15.54 13.95 12 3.6 22.16a1.3 1.3 0 0 0 1.65.05l12.22-6.67z" opacity=".8" />
      <path d="M17.47 8.46 5.25 1.79A1.3 1.3 0 0 0 3.6 1.84L13.95 12l3.52-3.54z" />
    </svg>
  );
}
