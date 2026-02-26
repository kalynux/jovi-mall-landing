"use client";
import { Store, Building2, Bike, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { UiRole } from "@/lib/auth/auth.types";

// ─── Role Config ─────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<
  UiRole,
  {
    icon: React.ElementType;
    label: string;
    headline: string;
    description: string;
    isWa?: boolean;
  }
> = {
  vendor: {
    icon: Store,
    label: "Vendor",
    headline: "I want to sell products",
    description: "Upload your catalog and let AI sell for you on WhatsApp",
  },
  agency: {
    icon: Building2,
    label: "Agency",
    headline: "I manage deliveries",
    description: "Coordinate agents and earn commission on every delivery",
  },
  agent: {
    icon: Bike,
    label: "Agent",
    headline: "I deliver orders",
    description: "Pick up assignments and earn per successful delivery",
  },
  customer: {
    icon: MessageCircle,
    label: "Customer",
    headline: "I want to shop",
    description: "Just WhatsApp us — browse, buy, and get it delivered",
    isWa: true,
  },
};

// ─── Props ───────────────────────────────────────────────────────────────────
interface RolePickerProps {
  selected: UiRole | null;
  onSelect: (role: UiRole) => void;
  /** Roles to hide (e.g. already-held roles on the add-role page) */
  excluded?: UiRole[];
  /** If set, renders a skip button with this message */
  skipMessage?: string;
  onSkip?: () => void;
  /** If true, customer card triggers the callout instead of selection */
  customerCallout?: boolean;
  onCustomerCallout?: () => void;
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function RolePicker({
  selected,
  onSelect,
  excluded = [],
  skipMessage,
  onSkip,
  customerCallout = false,
  onCustomerCallout,
  className,
}: RolePickerProps) {
  const visibleRoles = (
    Object.keys(ROLE_CONFIG) as UiRole[]
  ).filter((r) => !excluded.includes(r));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visibleRoles.map((role, i) => {
          const config = ROLE_CONFIG[role];
          const Icon = config.icon;
          const isSelected = selected === role;
          const isWa = config.isWa;

          const handleClick = () => {
            if (role === "customer" && customerCallout && onCustomerCallout) {
              onCustomerCallout();
            } else {
              onSelect(role);
            }
          };

          return (
            <motion.button
              key={role}
              type="button"
              onClick={handleClick}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.07,
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
              aria-pressed={isSelected}
              aria-label={config.headline}
              className={cn(
                "group relative p-4 rounded-2xl border text-left",
                "transition-all duration-200 cursor-pointer",
                isSelected
                  ? isWa
                    ? "border-wa bg-wa/10"
                    : "border-primary-500 bg-[var(--accent-light)]"
                  : "border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-subtle)] hover:border-primary-400/40",
                "hover:shadow-card-hover hover:-translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              )}
            >
              {/* Role badge */}
              <div
                className={cn(
                  "absolute top-3 right-3 text-[9px] font-display font-bold px-2 py-0.5 rounded-full",
                  isWa
                    ? "bg-wa/10 text-wa-dark"
                    : "bg-[var(--accent-light)] text-primary-600"
                )}
              >
                {config.label}
              </div>

              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  isWa ? "bg-wa/10" : "bg-[var(--accent-light)]"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isWa ? "text-wa-dark" : "text-primary-600"
                  )}
                />
              </div>

              <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-0.5">
                {config.headline}
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {config.description}
              </p>
            </motion.button>
          );
        })}
      </div>

      {/* Skip button */}
      {skipMessage && onSkip && (
        <div className="text-center pt-1">
          <p className="text-xs text-[var(--text-muted)] mb-2">{skipMessage}</p>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-primary-600 hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            Skip role selection
          </button>
        </div>
      )}
    </div>
  );
}
