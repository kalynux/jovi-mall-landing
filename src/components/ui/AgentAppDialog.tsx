"use client";
/**
 * AgentAppDialog / AgentAppPanel
 *
 * **There is no agent web app.** This panel used to offer "Continue on the web"
 * as a third option alongside the two stores; that led to `agent.wi-mall.com`,
 * which is not a product. The app is now the only destination, and it ships as
 * a direct APK (`EXTERNAL_LINKS.agentApkUrl`) because neither store listing
 * exists yet.
 *
 * What survives of the old web path is account creation, and only that: a
 * visitor who is not yet an agent still has to register, and registration is
 * hosted *here*, not on the app. So `cta.href` — the `/register?role=agent` and
 * `/add-role?role=agent` modes — is still offered, as a secondary link under
 * the download. The dashboard and role-switch modes are deliberately dropped:
 * both pointed at the web app that does not exist.
 *
 * Store URLs stay env-backed and empty until the listings go live; an empty URL
 * renders a disabled button with a "coming soon" pill, never a link that 404s.
 */
import { useState } from "react";
import { Bike, Download, Loader2, Smartphone, X } from "lucide-react";
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

/**
 * The account-creation link, for a visitor who does not hold the agent role yet.
 *
 * Only the `cta.href` modes reach here (`register`, `add-role`). `externalHref`
 * (the agent dashboard) and `activate` (role switch) are not rendered at all —
 * see the file header.
 */
function CreateAccountLink({ cta, label }: { cta: RoleCta; label: string }) {
    if (!cta.href) return null;
    return (
        <Link
            href={cta.href}
            className={cn(
                ROW,
                "text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)]"
            )}
        >
            {cta.pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {label}
        </Link>
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

    const accountLabel = cta.pending ? tRoleCta("switching") : t("createAccount");
    // The APK is the lead everywhere except an iPhone, where it cannot be
    // installed at all and the (unpublished) App Store button is the honest
    // thing to point at.
    const apkLead = platform !== "ios";
    const iosLead = platform === "ios";

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
                {/* The direct APK — the only live way to get the app today. Not
                    a StoreButton: its URL is a served endpoint rather than an
                    unpublished listing, so it is never in the "coming soon"
                    state those handle. */}
                <a
                    href={EXTERNAL_LINKS.agentApkUrl}
                    // Same-origin-ish API download, but the response is an
                    // attachment; a new tab keeps the dialog's page intact if
                    // the browser decides to navigate instead of download.
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(ROW, apkLead ? PRIMARY : SECONDARY)}
                >
                    <Download className="h-4 w-4" />
                    {t("download")}
                </a>

                <StoreButton
                    url={EXTERNAL_LINKS.agentAndroidUrl}
                    label={t("android")}
                    comingSoon={t("comingSoon")}
                    className={cn(ROW, SECONDARY)}
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

                <CreateAccountLink cta={cta} label={accountLabel} />

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
