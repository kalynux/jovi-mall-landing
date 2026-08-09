"use client";
/**
 * RoleCtaButton
 *
 * The one button every role CTA in the app renders. `useRoleCta` decides where
 * it goes; this decides what it looks like.
 *
 *   logged out / role not held → the surface's own marketing label. The copy IS
 *                                the pitch, so a signed-in customer reading the
 *                                Vendor section still sees "Start Selling Free";
 *                                only the destination changes to /add-role.
 *   role held                  → "Go to <Role> Dashboard", switching the active
 *                                role first if the session is on another one.
 *
 * Agent is the exception: it always opens the app dialog first, which recommends
 * the mobile app and offers the resolved destination as the web option.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useRoleCta, type CtaRole } from "@/lib/auth/useRoleCta";
import WaGateOverlay from "@/components/auth/WaGateOverlay";
import CTAButton from "./CTAButton";
import LinkButton from "./LinkButton";
import AgentAppDialog from "./AgentAppDialog";
import { cn } from "@/lib/utils";

/**
 * Shared width floor. These buttons sit in `flex flex-wrap gap-3` rows beside a
 * secondary button; without a common floor the sibling slides sideways when the
 * label upgrades from "Start Selling Free" to "Go to Vendor Dashboard". Sized to
 * hold the longest resolved label at `text-base` — check `fr` and `ar`, which
 * run longest, before lowering it.
 */
const CTA_MIN_W = "min-w-[13.5rem]";

const DASHBOARD_KEY = {
    vendor: "dashboardVendor",
    agency: "dashboardAgency",
    agent: "dashboardAgent",
} as const;

interface RoleCtaButtonProps {
    role: CtaRole;
    /** The surface's own marketing copy, used for register / add-role. */
    fallbackLabel: string;
    variant?: "primary" | "secondary";
    size?: "sm" | "md";
    showArrow?: boolean;
    className?: string;
    /** Extra attributes for analytics-style hooks on the marketing plan cards. */
    dataAttrs?: Record<string, string>;
}

export default function RoleCtaButton({
    role,
    fallbackLabel,
    variant = "primary",
    size = "md",
    showArrow = false,
    className,
    dataAttrs,
}: RoleCtaButtonProps) {
    const t = useTranslations("roleCta");
    const cta = useRoleCta(role);
    const [agentDialogOpen, setAgentDialogOpen] = useState(false);

    const label = cta.isDashboard
        ? cta.pending
            ? t("switching")
            : t(DASHBOARD_KEY[role])
        : fallbackLabel;

    const shared = cn(CTA_MIN_W, className);

    // Framer's crossfade keeps the label change from reading as a glitch when
    // auth resolves and the button turns out to belong to a signed-in user.
    const content = (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex items-center gap-2"
            >
                {cta.pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {label}
            </motion.span>
        </AnimatePresence>
    );

    let button: React.ReactNode;

    if (role === "agent") {
        // Never navigates — the dialog owns the decision.
        button = (
            <CTAButton
                variant={variant}
                size={size}
                showArrow={showArrow}
                onClick={() => setAgentDialogOpen(true)}
                className={shared}
            >
                {content}
            </CTAButton>
        );
    } else if (cta.mode === "dashboard" && cta.externalHref) {
        // Cross-origin: a raw <a> is correct, next-intl's Link would try to
        // prefix an absolute URL.
        button = (
            <CTAButton variant={variant} size={size} showArrow={showArrow} href={cta.externalHref} className={shared}>
                {content}
            </CTAButton>
        );
    } else if (cta.mode === "switch") {
        button = (
            <CTAButton
                variant={variant}
                size={size}
                showArrow={showArrow}
                onClick={cta.activate}
                disabled={cta.pending}
                className={shared}
            >
                {content}
            </CTAButton>
        );
    } else {
        // register / add-role / resolving — internal routes, so this must be the
        // locale-aware Link or an /fr visitor lands on the English page.
        button = (
            <LinkButton
                href={cta.href ?? `/register?role=${role}`}
                variant={variant}
                size={size}
                showArrow={showArrow}
                // LinkButton mirrors CTAButton's look but has no hover spring,
                // and this is the majority state — keep the pop.
                className={cn(shared, "hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none")}
            >
                {content}
            </LinkButton>
        );
    }

    return (
        <div className="flex flex-col gap-2" {...dataAttrs}>
            {button}

            {/* Scoped to the button that failed, so the Agency section cannot
                display the Vendor section's error. */}
            {cta.error && (
                <p role="alert" className="max-w-[13.5rem] text-xs font-medium text-red-600">
                    {cta.error}
                </p>
            )}

            {role === "agent" && (
                <AgentAppDialog isOpen={agentDialogOpen} onClose={() => setAgentDialogOpen(false)} cta={cta} />
            )}

            {cta.waGate && <WaGateOverlay gate={cta.waGate} />}
        </div>
    );
}
