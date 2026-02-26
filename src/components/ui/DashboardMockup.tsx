"use client";
import { cn } from "@/lib/utils";
import { BarChart2, Bell, Box, Package, Settings, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { useTranslations } from "next-intl";

interface DashboardMockupProps {
  variant?: "vendor" | "agency" | "agent";
  className?: string;
}

const VENDOR_STATS = [
  { value: "₦ 284K", icon: TrendingUp, up: true },
  { value: "1,240", icon: ShoppingCart, up: true },
  { value: "86", icon: Box, up: false },
];
const AGENCY_STATS = [
  { value: "3,820", icon: Package, up: true },
  { value: "42", icon: Users, up: true },
  { value: "₦ 96K", icon: TrendingUp, up: true },
];
const AGENT_STATS = [
  { value: "148", icon: Package, up: true },
  { value: "₦ 38K", icon: TrendingUp, up: true },
  { value: "4.9 ★", icon: Bell, up: false },
];
const CHART_BARS = {
  vendor: [0.4, 0.6, 0.45, 0.8, 0.7, 0.9, 0.75, 0.85, 0.65, 0.95, 0.8, 1.0],
  agency: [0.5, 0.7, 0.6, 0.8, 0.65, 0.75, 0.9, 0.85, 0.7, 0.88, 0.92, 1.0],
  agent: [0.3, 0.5, 0.6, 0.4, 0.7, 0.9, 0.8, 0.75, 0.85, 0.9, 0.95, 1.0],
};

const ACCENT = "#7c3aed";

export default function DashboardMockup({ variant = "vendor", className }: DashboardMockupProps) {
  const t = useTranslations("trust.dashboard");

  const statsData = variant === "vendor" ? VENDOR_STATS : variant === "agency" ? AGENCY_STATS : AGENT_STATS;
  const chartBars = CHART_BARS[variant];

  const titles = { vendor: "Vendor Dashboard", agency: "Agency Dashboard", agent: "Agent Portal" };
  const statLabels: Record<string, string[]> = {
    vendor: ["Revenue", "Orders", "Products"],
    agency: ["Deliveries", "Agents", "Earnings"],
    agent: ["Delivered", "Earnings", "Rating"],
  };

  const activityItems = [
    t("recentActivity1"),
    t("recentActivity2"),
    t("recentActivity3"),
  ];

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-subtle)]",
        "shadow-[0_8px_40px_rgba(0,0,0,0.12)]",
        className
      )}
      aria-hidden="true"
      role="img"
      aria-label={`${titles[variant]} preview`}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--bg)] border-b border-[var(--border)]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <span className="text-[11px] font-display font-semibold text-[var(--text-muted)] ml-2">{titles[variant]}</span>
        <Settings className="w-3 h-3 text-[var(--text-muted)] ml-auto" />
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {statsData.map((stat, i) => (
            <div key={i} className="rounded-xl p-2.5 bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center gap-1 mb-1">
                <stat.icon className="w-3 h-3" style={{ color: ACCENT }} />
                <span className="text-[9px] text-[var(--text-muted)] font-medium">{statLabels[variant][i]}</span>
              </div>
              <div className="text-sm font-display font-bold text-[var(--text-primary)]">{stat.value}</div>
              <div className={cn("text-[9px] font-medium", stat.up ? "text-green-500" : "text-[var(--text-muted)]")}>
                {stat.up ? t("up") : t("stable")}
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-xl p-3 bg-[var(--bg)] border border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-display font-semibold text-[var(--text-secondary)]">{t("performance")}</span>
            <BarChart2 className="w-3 h-3 text-[var(--text-muted)]" />
          </div>
          <div className="flex items-end gap-1 h-14">
            {chartBars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${h * 100}%`,
                  background: `linear-gradient(to top, ${ACCENT}cc, ${ACCENT}44)`,
                  opacity: i === chartBars.length - 1 ? 1 : 0.6 + i * 0.04,
                }}
              />
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="space-y-1.5">
          {activityItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />
              <span className="text-[9px] text-[var(--text-secondary)] truncate">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
