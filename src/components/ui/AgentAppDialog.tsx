"use client";
/**
 * AgentAppDialog / AgentAppPanel
 *
 * Agents get a web dashboard, but the job happens on a phone — live order
 * alerts, navigation, one-tap delivery confirmation — so the app is what we
 * recommend and the web is the third option rather than the default.
 *
 * Which of the three reads as primary depends on the device: recommending a
 * phone download to somebody on a laptop that is already able to show them the
 * dashboard is bad advice, so on desktop the web button takes the lead.
 *
 * Store URLs are env-backed (EXTERNAL_LINKS) and empty until the listings go
 * live. An empty URL renders a disabled button with a "coming soon" pill —
 * never a link that 404s.
 */
import { useState } from "react";
import { Bike, Loader2, Smartphone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EXTERNAL_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { RoleCta } from "@/lib/auth/useRoleCta";
import ModalShell from "./ModalShell";

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "android";
    // iPadOS 13+ reports itself as MacIntel; touch points are what separate it
    // from an actual desktop Mac.
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
        return "ios";
    }
    return "other";
}

const PRIMARY =
    "bg-gradient-to-r from-primary-700 to-primary-500 text-white shadow-[0_0_20px_rgba(13,160,107,0.35)] hover:shadow-[0_0_34px_rgba(13,160,107,0.6)]";
const SECONDARY =
    "border border-[var(--border)] bg-[var(--surface-glass)] text-[var(--text-primary)] hover:border-primary-400 hover:bg-[var(--accent-light)]";
const ROW =
    "flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-display text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2";

/** Renders whichever element the resolved CTA calls for. */
function ContinueOnWeb({
    cta,
    label,
    className,
}: {
    cta: RoleCta;
    label: string;
    className: string;
}) {
    if (cta.href) {
        return (
            <Link href={cta.href} className={className}>
                {label}
            </Link>
        );
    }
    if (cta.externalHref) {
        return (
            <a href={cta.externalHref} className={className}>
                {label}
            </a>
        );
    }
    return (
        <button type="button" onClick={cta.activate} disabled={cta.pending} className={cn(className, "disabled:opacity-60")}>
            {cta.pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {label}
        </button>
    );
}

function StoreButton({
    url,
    label,
    comingSoon,
    className,
}: {
    url: string;
    label: string;
    comingSoon: string;
    className: string;
}) {
    if (!url) {
        return (
            <span className={cn(className, SECONDARY, "cursor-not-allowed opacity-60")} aria-disabled="true">
                {label}
                <span className="rounded-full bg-[var(--border-medium)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                    {comingSoon}
                </span>
            </span>
        );
    }
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
            {label}
        </a>
    );
}

export function AgentAppPanel({
    cta,
    titleId,
    onClose,
}: {
    cta: RoleCta;
    titleId: string;
    onClose?: () => void;
}) {
    const t = useTranslations("agentApp");
    const tRoleCta = useTranslations("roleCta");
    // Lazy initialiser rather than an effect: this panel only ever mounts from
    // a click, so it is client-only by construction, and the guard keeps it
    // safe if that ever stops being true.
    const [platform] = useState<Platform>(() =>
        typeof navigator === "undefined" ? "other" : detectPlatform()
    );

    const webLabel = cta.pending ? tRoleCta("switching") : t("continueWeb");
    // On a phone the store that matches leads; on a desktop the web does.
    const androidLead = platform === "android";
    const iosLead = platform === "ios";
    const webLead = platform === "other";

    return (
        <div className="p-6">
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 rounded-xl p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]"
                    aria-label={t("close")}
                >
                    <X className="h-4 w-4" />
                </button>
            )}

            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-light)]">
                <Bike className="h-5 w-5 text-primary-600" />
            </div>

            <h2 id={titleId} className="font-display text-lg font-bold text-[var(--text-primary)]">
                {t("title")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{t("body")}</p>

            <div className="mt-6 flex flex-col gap-2.5">
                <StoreButton
                    url={EXTERNAL_LINKS.agentAndroidUrl}
                    label={t("android")}
                    comingSoon={t("comingSoon")}
                    className={cn(ROW, androidLead ? PRIMARY : SECONDARY)}
                />
                <StoreButton
                    url={EXTERNAL_LINKS.agentIosUrl}
                    label={t("ios")}
                    comingSoon={t("comingSoon")}
                    className={cn(ROW, iosLead ? PRIMARY : SECONDARY)}
                />

                <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <Smartphone className="h-3 w-3" />
                    {t("appHint")}
                </div>

                <ContinueOnWeb
                    cta={cta}
                    label={webLabel}
                    className={cn(ROW, webLead ? PRIMARY : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)]")}
                />

                {cta.error && (
                    <p role="alert" className="text-center text-xs font-medium text-red-600">
                        {cta.error}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function AgentAppDialog({
    isOpen,
    onClose,
    cta,
}: {
    isOpen: boolean;
    onClose: () => void;
    cta: RoleCta;
}) {
    return (
        <ModalShell isOpen={isOpen} onClose={onClose} labelledBy="agent-app-title" className="max-w-md">
            <AgentAppPanel cta={cta} titleId="agent-app-title" onClose={onClose} />
        </ModalShell>
    );
}
