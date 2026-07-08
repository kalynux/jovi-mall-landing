"use client";
import { cn } from "@/lib/utils";
import {
  BarChart2,
  Bell,
  Box,
  MapPin,
  Navigation,
  Package,
  Settings,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
  Clock,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface DashboardMockupProps {
  variant?: "vendor" | "agency" | "agent";
  className?: string;
}

// Each role gets its own accent + title so the three mockups read as distinct products.
const ROLE = {
  vendor: { accent: "#068554", title: "Vendor Dashboard" },
  agency: { accent: "#2563eb", title: "Agency Console" },
  agent: { accent: "#f59e0b", title: "Agent App" },
} as const;

const VENDOR_STATS = [
  { value: "₦ 284K", icon: TrendingUp, up: true, labelIdx: 0 },
  { value: "1,240", icon: ShoppingCart, up: true, labelIdx: 1 },
  { value: "86", icon: Box, up: false, labelIdx: 2 },
];
const AGENCY_STATS = [
  { value: "3,820", icon: Package, up: true, labelIdx: 0 },
  { value: "42", icon: Users, up: true, labelIdx: 1 },
  { value: "₦ 96K", icon: TrendingUp, up: true, labelIdx: 2 },
];
const AGENT_STATS = [
  { value: "148", icon: Package, up: true, labelIdx: 0 },
  { value: "₦ 38K", icon: TrendingUp, up: true, labelIdx: 1 },
  { value: "4.9", icon: Star, up: false, labelIdx: 2 },
];

const VENDOR_BARS = [0.4, 0.6, 0.45, 0.8, 0.7, 0.9, 0.75, 0.85, 0.65, 0.95, 0.8, 1.0];

// Agency "live agents" roster — proper-noun names need no translation.
const AGENCY_AGENTS = [
  { name: "Chidi", statusKey: "online" as const, dot: "#22c55e" },
  { name: "Amara", statusKey: "enRoute" as const, dot: "#f59e0b" },
  { name: "Tunde", statusKey: "idle" as const, dot: "#9ca3af" },
];

export default function DashboardMockup({ variant = "vendor", className }: DashboardMockupProps) {
  const t = useTranslations("trust.dashboard");
  const { accent, title } = ROLE[variant];

  const statLabels: Record<string, string[]> = {
    vendor: ["Revenue", "Orders", "Products"],
    agency: ["Deliveries", "Agents", "Earnings"],
    agent: ["Delivered", "Earnings", "Rating"],
  };

  const statsData =
    variant === "vendor" ? VENDOR_STATS : variant === "agency" ? AGENCY_STATS : AGENT_STATS;

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-subtle)]",
        "shadow-[0_8px_40px_rgba(0,0,0,0.12)]",
        className
      )}
      aria-hidden="true"
      role="img"
      aria-label={`${title} preview`}
    >
      {/* Title bar — tinted to the role accent */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]"
        style={{ background: `linear-gradient(90deg, ${accent}14, var(--bg))` }}
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <span className="text-[11px] font-display font-semibold ml-2" style={{ color: accent }}>
          {title}
        </span>
        <Settings className="w-3 h-3 text-[var(--text-muted)] ml-auto" />
      </div>

      {/* Stats row — shared across roles but accent-colored */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {statsData.map((stat, i) => (
            <div key={i} className="rounded-xl p-2.5 bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center gap-1 mb-1">
                <stat.icon className="w-3 h-3" style={{ color: accent }} />
                <span className="text-[9px] text-[var(--text-muted)] font-medium">
                  {statLabels[variant][i]}
                </span>
              </div>
              <div className="text-sm font-display font-bold text-[var(--text-primary)]">
                {stat.value}
                {variant === "agent" && i === 2 && <span style={{ color: accent }}> ★</span>}
              </div>
              <div className={cn("text-[9px] font-medium", stat.up ? "text-green-500" : "text-[var(--text-muted)]")}>
                {stat.up ? t("up") : t("stable")}
              </div>
            </div>
          ))}
        </div>

        {/* ── Vendor: performance bar chart ─────────────────────────────── */}
        {variant === "vendor" && (
          <>
            <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-display font-semibold text-[var(--text-secondary)]">{t("performance")}</span>
                <BarChart2 className="w-3 h-3 text-[var(--text-muted)]" />
              </div>
              <div className="flex items-end gap-1 h-14">
                {VENDOR_BARS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${h * 100}%`,
                      background: `linear-gradient(to top, ${accent}cc, ${accent}44)`,
                      opacity: i === VENDOR_BARS.length - 1 ? 1 : 0.6 + i * 0.04,
                    }}
                  />
                ))}
              </div>
            </div>
            <ActivityList t={t} accent={accent} />
          </>
        )}

        {/* ── Agency: live-agent dispatch roster ────────────────────────── */}
        {variant === "agency" && (
          <>
            <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[9px] font-display font-semibold text-[var(--text-secondary)]">{t("agentsOnline")}</span>
                <Users className="w-3 h-3 text-[var(--text-muted)]" />
              </div>
              <div className="space-y-1.5">
                {AGENCY_AGENTS.map((a) => (
                  <div key={a.name} className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                      style={{ background: accent }}
                    >
                      {a.name[0]}
                    </div>
                    <span className="text-[10px] font-medium text-[var(--text-primary)]">{a.name}</span>
                    <span className="ml-auto flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.dot }} />
                      {t(a.statusKey)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Dispatch load bar */}
            <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-display font-semibold text-[var(--text-secondary)]">{t("dispatchLoad")}</span>
                <span className="text-[9px] font-bold" style={{ color: accent }}>72%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: "72%", background: accent }} />
              </div>
            </div>
          </>
        )}

        {/* ── Agent: active-delivery route card ─────────────────────────── */}
        {variant === "agent" && (
          <>
            <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-display font-semibold text-[var(--text-secondary)]">{t("activeDelivery")}</span>
                <span
                  className="flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: accent }}
                >
                  <Navigation className="w-2.5 h-2.5" />
                  {t("enRoute")}
                </span>
              </div>
              {/* Route */}
              <div className="relative pl-4">
                <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px" style={{ background: `${accent}66` }} />
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="absolute left-0 w-2.5 h-2.5 rounded-full border-2 bg-[var(--bg)]" style={{ borderColor: accent }} />
                  <span className="text-[9px] text-[var(--text-muted)]">{t("pickup")}</span>
                  <span className="text-[10px] font-medium text-[var(--text-primary)] ml-auto">JoviTech Store</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="absolute left-[-1px] w-3.5 h-3.5" style={{ color: accent }} />
                  <span className="text-[9px] text-[var(--text-muted)]">{t("dropoff")}</span>
                  <span className="text-[10px] font-medium text-[var(--text-primary)] ml-auto">Lekki Phase 1</span>
                </div>
              </div>
            </div>
            {/* ETA */}
            <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)] flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: accent }} />
              <span className="text-[9px] text-[var(--text-muted)]">{t("eta")}</span>
              <span className="text-sm font-display font-bold text-[var(--text-primary)] ml-auto">18 min</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActivityList({
  t,
  accent,
}: {
  t: ReturnType<typeof useTranslations>;
  accent: string;
}) {
  const items = [t("recentActivity1"), t("recentActivity2"), t("recentActivity3")];
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accent }} />
          <span className="text-[9px] text-[var(--text-secondary)] truncate">{item}</span>
          <Bell className="w-2.5 h-2.5 text-[var(--text-muted)] ml-auto flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
