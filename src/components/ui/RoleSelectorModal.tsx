"use client";
/**
 * RoleSelectorModal
 *
 * The grid behind every "Get Started" button. Each card resolves the same way
 * the section CTAs do — register when signed out, the dashboard (switching the
 * active role first if needed) when the visitor already holds that role — so a
 * signed-in vendor is never offered a signup form.
 *
 * Agent and customer do not navigate: they swap the modal body for the panel
 * that belongs to them, rather than stacking a second dialog on this one.
 */
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X, Store, Building2, Bike, MessageCircle, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRoleCta, type CtaRole } from "@/lib/auth/useRoleCta";
import { cn } from "@/lib/utils";
import ModalShell from "./ModalShell";
import WhatsAppBotPanel from "./WhatsAppBotPanel";
import { AgentAppPanel } from "./AgentAppDialog";

type RoleId = CtaRole | "customer";
type View = "roles" | "agent-app" | "customer-wa";

const ROLE_ICONS: Record<RoleId, React.ElementType> = {
  vendor: Store,
  agency: Building2,
  agent: Bike,
  customer: MessageCircle,
};

// Customer leads — keep in step with UI_ROLES and RolePicker's ROLE_CONFIG.
const CARD_ORDER: RoleId[] = ["customer", "vendor", "agency", "agent"];

interface RoleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The visual body of a card — identical whatever the card ends up doing. */
function CardBody({ role, badge }: { role: RoleId; badge?: string }) {
  const t = useTranslations("modal");
  const Icon = ROLE_ICONS[role];
  const isWa = role === "customer";

  return (
    <>
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
          isWa ? "bg-wa-soft" : "bg-[var(--accent-light)]"
        )}
      >
        <Icon className={cn("w-5 h-5", isWa ? "text-wa-dark" : "text-primary-600")} />
      </div>
      <div
        className={cn(
          "absolute top-3 right-3 text-[9px] font-display font-bold px-2 py-0.5 rounded-full",
          isWa ? "bg-wa-soft text-wa-dark" : "bg-[var(--accent-light)] text-primary-600"
        )}
      >
        {badge ?? t(`roles.${role}.label` as Parameters<typeof t>[0])}
      </div>
      <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-0.5">
        {t(`roles.${role}.headline` as Parameters<typeof t>[0])}
      </h3>
      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        {t(`roles.${role}.description` as Parameters<typeof t>[0])}
      </p>
    </>
  );
}

const CARD_CLASS = cn(
  "group relative p-4 rounded-2xl border border-[var(--border)] text-left",
  "bg-[var(--bg)] hover:bg-[var(--bg-subtle)]",
  "hover:border-primary-400/50",
  "transition-all duration-200 cursor-pointer",
  "hover:shadow-card-hover hover:-translate-y-0.5",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
);

function cardMotion(index: number) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.07 + 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  };
}

/**
 * A card that navigates. Uses next-intl's Link for the internal routes — the
 * raw `<a href>` this replaced dropped the locale prefix and sent an /fr
 * visitor to the English register page.
 */
function NavRoleCard({
  role,
  index,
  onClose,
}: {
  role: CtaRole;
  index: number;
  onClose: () => void;
}) {
  const t = useTranslations("modal");
  const tRoleCta = useTranslations("roleCta");
  const cta = useRoleCta(role);
  const ariaLabel = t(`roles.${role}.headline` as Parameters<typeof t>[0]);
  const badge = cta.isDashboard ? tRoleCta("switching") : undefined;

  if (cta.mode === "dashboard" && cta.externalHref) {
    return (
      <motion.a {...cardMotion(index)} href={cta.externalHref} className={CARD_CLASS} aria-label={ariaLabel}>
        <CardBody role={role} />
      </motion.a>
    );
  }

  if (cta.mode === "switch") {
    return (
      <>
        <motion.button
          {...cardMotion(index)}
          type="button"
          onClick={cta.activate}
          disabled={cta.pending}
          className={cn(CARD_CLASS, "disabled:opacity-60")}
          aria-label={ariaLabel}
        >
          <CardBody role={role} badge={cta.pending ? badge : undefined} />
          {cta.pending && (
            <Loader2 className="absolute bottom-3 right-3 h-4 w-4 animate-spin text-primary-500" />
          )}
        </motion.button>
      </>
    );
  }

  return (
    <motion.div {...cardMotion(index)}>
      <Link
        href={cta.href ?? `/register?role=${role}`}
        onClick={onClose}
        className={cn(CARD_CLASS, "block h-full")}
        aria-label={ariaLabel}
      >
        <CardBody role={role} />
      </Link>
    </motion.div>
  );
}

/** A card that swaps the modal body instead of navigating. */
function ViewRoleCard({
  role,
  index,
  onSelect,
}: {
  role: RoleId;
  index: number;
  onSelect: () => void;
}) {
  const t = useTranslations("modal");
  return (
    <motion.button
      {...cardMotion(index)}
      type="button"
      onClick={onSelect}
      className={CARD_CLASS}
      aria-label={t(`roles.${role}.headline` as Parameters<typeof t>[0])}
    >
      <CardBody role={role} />
    </motion.button>
  );
}

export default function RoleSelectorModal({ isOpen, onClose }: RoleSelectorModalProps) {
  const t = useTranslations("modal");
  const [view, setView] = useState<View>("roles");
  const agentCta = useRoleCta("agent");

  // Always reopen on the grid — a visitor who closed the modal from the agent
  // panel should not find it still there next time. Done on the way out rather
  // than in an effect on `isOpen`, so there is no extra render pass.
  const handleClose = () => {
    setView("roles");
    onClose();
  };

  const back = (
    <button
      onClick={() => setView("roles")}
      className="absolute top-4 left-4 z-10 rounded-xl p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]"
      aria-label={t("back")}
    >
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
    </button>
  );

  let body: ReactNode;

  if (view === "agent-app") {
    body = (
      <>
        {back}
        <AgentAppPanel cta={agentCta} titleId="role-modal-title" onClose={handleClose} />
      </>
    );
  } else if (view === "customer-wa") {
    body = (
      <div className="p-4 pt-14">
        {back}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 rounded-xl p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]"
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="role-modal-title" className="sr-only">
          {t("roles.customer.headline")}
        </h2>
        <WhatsAppBotPanel />
      </div>
    );
  } else {
    body = (
      <>
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 rounded-xl p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]"
            aria-label={t("close")}
          >
            <X className="w-4 h-4" />
          </button>
          <h2 id="role-modal-title" className="font-display text-xl font-bold text-[var(--text-primary)]">
            {t("title")}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t("subtitle")}</p>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARD_ORDER.map((role, i) =>
            role === "customer" ? (
              <ViewRoleCard key={role} role={role} index={i} onSelect={() => setView("customer-wa")} />
            ) : role === "agent" ? (
              // Agents get a dashboard, but the app is the recommendation, so
              // the card opens that pitch rather than jumping straight in.
              <ViewRoleCard key={role} role={role} index={i} onSelect={() => setView("agent-app")} />
            ) : (
              <NavRoleCard key={role} role={role} index={i} onClose={handleClose} />
            )
          )}
        </div>

        <div className="px-6 pb-5 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            {t("signIn")}{" "}
            <Link href="/login" onClick={handleClose} className="text-primary-600 hover:underline font-medium">
              {t("signInLink")}
            </Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <ModalShell isOpen={isOpen} onClose={handleClose} labelledBy="role-modal-title" className="overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, x: view === "roles" ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: view === "roles" ? 12 : -12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </ModalShell>
  );
}
