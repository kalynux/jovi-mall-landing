"use client";
import { Store, Building2, Bike, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { UiRole } from "@/lib/auth/auth.types";
import { useTranslations } from "next-intl";

// ─── Role Config ─────────────────────────────────────────────────────────────
/**
 * What is true about a role that is NOT copy: which glyph it wears, and whether
 * it is the WhatsApp-green one.
 *
 * The label, headline and description used to sit here too, in English, and were
 * already dead — every one of them is rendered from `modal.roles.<role>.*`
 * below. They are gone rather than converted to `labelKey`s, because the
 * catalogue is keyed by the same role id this map is: `ROLE_CONFIG[role]` and
 * `t("roles.<role>.label")` are two lookups on one key, and a second copy of the
 * key would only add a way for them to disagree.
 */
const ROLE_CONFIG: Record<UiRole, { icon: React.ElementType; isWa?: boolean }> = {
  vendor: { icon: Store },
  agency: { icon: Building2 },
  agent: { icon: Bike },
  customer: { icon: MessageCircle, isWa: true },
};

// ─── Props ───────────────────────────────────────────────────────────────────
interface RolePickerProps {
  selected: UiRole | null;
  onSelect: (role: UiRole) => void;
  /** Roles to hide (e.g. already-held roles on the add-role page) */
  ownedRoles?: UiRole[];
  /** Badge on an already-held role. Defaults to `authMe.ownedBadge`. */
  ownedRolesLabel?: string;
  /**
   * Role that is disabled (greyed-out, non-clickable).
   * Typically the user's currently active role.
   * Uses the shared "Current role" badge label from authMe.currentBadge.
   */
  disabledRole?: UiRole;
  /** Badge on the disabled card. Defaults to `authMe.currentBadge`. */
  disabledRoleLabel?: string;
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
  ownedRoles = [],
  ownedRolesLabel,
  disabledRole,
  disabledRoleLabel,
  skipMessage,
  onSkip,
  customerCallout = false,
  onCustomerCallout,
  className,
}: RolePickerProps) {
  // const visibleRoles = (
  //   Object.keys(ROLE_CONFIG) as UiRole[]
  // ).filter((r) => !ownedRoles.includes(r));

  const t = useTranslations("modal");
  const tMe = useTranslations("authMe");

  // The two badges default to the shared account vocabulary rather than to
  // English. Callers that already hold a translator still pass their own.
  const ownedLabel = ownedRolesLabel ?? tMe("ownedBadge");
  const currentLabel = disabledRoleLabel ?? tMe("currentBadge");

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.keys(ROLE_CONFIG) as UiRole[]).map((role, i) => {
          const config = ROLE_CONFIG[role];
          const Icon = config.icon;
          const headline = t(`roles.${role}.headline` as Parameters<typeof t>[0]);
          const isSelected = selected === role;
          const isWa = config.isWa;
          const isDisabled = role === disabledRole;
          const isOwned = ownedRoles.includes(role);

          const handleClick = () => {
            if (isDisabled) return;
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
              // Disabled role: not focusable, aria-disabled
              tabIndex={isDisabled ? -1 : undefined}
              aria-disabled={isDisabled ? "true" : undefined}
              aria-pressed={isDisabled ? undefined : isSelected}
              // One message, not a headline glued to a badge: the parenthesis
              // and the word order inside it are the translator's to move (§4).
              aria-label={
                isDisabled
                  ? tMe("roleAriaCurrent", { role: headline })
                  : headline
              }
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.07,
                duration: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn(
                "group relative p-4 rounded-2xl border text-left",
                "transition-all duration-200",
                isDisabled || isOwned
                  ? "opacity-50 cursor-not-allowed border-[var(--border)] bg-[var(--bg-subtle)]"
                  : isSelected
                    ? isWa
                      ? "border-wa bg-wa-soft"
                      : "border-primary-500 bg-[var(--accent-light)]"
                    : "border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-subtle)] hover:border-primary-400/40",
                !isDisabled && !isOwned && "hover:shadow-card-hover hover:-translate-y-0.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              )}
            >
              {/* Current role badge — replaces the normal role label badge */}
              <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                <div
                  className={cn(
                    "text-[9px] font-display font-bold px-2 py-0.5 rounded-full",
                    isWa
                      ? "bg-wa-soft text-wa-dark"
                      : "bg-[var(--accent-light)] text-primary-600"
                  )}
                >
                  {t(`roles.${role}.label` as Parameters<typeof t>[0])}
                </div>
                {isDisabled ? (
                  <div className="text-[9px] font-display font-bold px-2 py-0.5 rounded-full bg-[var(--border-medium)] text-[var(--text-muted)]">
                    {currentLabel}
                  </div>
                ) : isOwned && (
                  <div className="text-[9px] font-display font-bold px-2 py-0.5 rounded-full bg-[var(--border-medium)] text-[var(--text-muted)]">
                    {ownedLabel}
                  </div>
                )}
              </div>

              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                  isWa ? "bg-wa-soft" : "bg-[var(--accent-light)]"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isDisabled
                      ? "text-[var(--text-muted)]"
                      : isWa
                        ? "text-wa-dark"
                        : "text-primary-600"
                  )}
                />
              </div>

              <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-0.5">
                {headline}
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {t(`roles.${role}.description` as Parameters<typeof t>[0])}
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
            {t("skipRoleSelection")}
          </button>
        </div>
      )}
    </div>
  );
}
