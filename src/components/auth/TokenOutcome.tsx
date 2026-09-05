"use client";
/**
 * The shared frame for the two pages that redeem an emailed token on behalf of
 * every Wi-Mall app — `/verify-email` (registration) and
 * `/account/confirm-email` (login-email change).
 *
 * Both are reached from a mail client by customers, vendors, agencies and
 * agents alike, and both have exactly three states: working, done, failed. They
 * were drifting apart — one localised and one not, one styled and one bare —
 * which is the failure mode a shared frame exists to stop: the copy differs
 * between the flows, but nothing else should.
 */
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import AuthCard from "@/components/auth/AuthCard";
import { originAppUrl, type OriginRole } from "@/lib/me/confirm-origin";

export type OutcomeTone = "pending" | "success" | "error";

interface TokenOutcomeProps {
    /** Card heading. Stays the same across all three states of a given flow. */
    title: string;
    tone: OutcomeTone;
    /** Bold line above the body. Omitted while pending — a spinner says it. */
    heading?: string;
    message: string;
    /** The way out. Nothing is offered while the request is in flight. */
    children?: ReactNode;
}

const TONE_ICON = {
    pending: Loader2,
    success: CheckCircle2,
    error: AlertCircle,
} as const;

const TONE_STYLE = {
    pending: { wrap: "", icon: "w-8 h-8 animate-spin text-primary-500" },
    success: { wrap: "bg-green-500/10", icon: "w-7 h-7 text-green-500" },
    error: { wrap: "bg-red-500/10", icon: "w-7 h-7 text-red-500" },
} as const;

export default function TokenOutcome({
    title,
    tone,
    heading,
    message,
    children,
}: TokenOutcomeProps) {
    const Icon = TONE_ICON[tone];
    const style = TONE_STYLE[tone];

    return (
        <AuthCard title={title}>
            <div className="flex flex-col items-center gap-4 py-4 text-center">
                {tone === "pending" ? (
                    <Icon className={style.icon} aria-hidden="true" />
                ) : (
                    <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${style.wrap}`}
                    >
                        <Icon className={style.icon} aria-hidden="true" />
                    </div>
                )}

                <div className="space-y-1">
                    {heading && (
                        <p className="font-display font-semibold text-[var(--text-primary)]">
                            {heading}
                        </p>
                    )}
                    {/*
                     * `aria-live` on every state, not just the spinner. The whole
                     * page is one client-rendered region that swaps under a
                     * screen reader without any focus moving, so a success or a
                     * failure announced only visually is not announced at all.
                     */}
                    <p
                        className="text-sm text-[var(--text-secondary)]"
                        aria-live="polite"
                    >
                        {message}
                    </p>
                </div>

                {children}
            </div>
        </AuthCard>
    );
}

interface ReturnCtaProps {
    /** The `?app=` hint, or `null` for a link minted before it existed. */
    origin: OriginRole | null;
    /** Where a customer — or an unknown origin — is sent, as a site-relative path. */
    customerHref: string;
    /** Label for the customer/unknown destination. */
    customerLabel: string;
    /** Label for a dashboard destination, already resolved for `origin`. */
    appLabel: string;
    className?: string;
}

/**
 * The way back out, pointed at whichever app started the flow.
 *
 * Two shapes on purpose. A dashboard is a **different origin**, so it needs a
 * plain anchor with an absolute URL. This site is the customer app, so its own
 * destination goes through `@/i18n/navigation`'s `Link` — that keeps the locale
 * prefix and, on the native build, keeps the WebView inside its own origin
 * instead of steering it at a URL that resolves to a dev server on the handset.
 *
 * An unrecognised or absent `origin` falls back to the customer destination
 * rather than rendering nothing: three of the four audiences would otherwise get
 * a dead end, and a storefront link they can ignore beats no link at all.
 */
export function ReturnCta({
    origin,
    customerHref,
    customerLabel,
    appLabel,
    className = "btn-primary w-full text-center",
}: ReturnCtaProps) {
    const appUrl = originAppUrl(origin);

    if (!appUrl) {
        return (
            <Link href={customerHref} className={className}>
                {customerLabel}
            </Link>
        );
    }

    // No `noopener` dance: this navigates the tab rather than opening one, and
    // the destination is a compile-time constant, never a value from the URL.
    return (
        <a href={appUrl} className={className}>
            {appLabel}
        </a>
    );
}
