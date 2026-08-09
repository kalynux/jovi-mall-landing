"use client";
/**
 * WhatsAppBotPanel
 *
 * The customer hand-off: a preview of the conversation they are about to start,
 * then the button that starts it. Body-only, so it can be an anchored disclosure
 * panel in the Customer section or the body of a modal in the role picker.
 *
 * The greeting carried in the deep link is the localised `previewUserMsg` — the
 * bot's whole pitch is natural language, so a sentence is the right payload.
 */
import { MessageCircle, ChevronRight, X, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { BRAND, buildWhatsAppUrl } from "@/lib/constants";

export default function WhatsAppBotPanel({ onClose }: { onClose?: () => void }) {
    const t = useTranslations("customer.whatsapp");
    const openRef = useRef<HTMLAnchorElement | null>(null);
    const waUrl = buildWhatsAppUrl(t("previewUserMsg"));

    // Land focus on the action, not on the close button — the panel exists to
    // be acted on, and this is what makes the promoted button reachable without
    // tabbing past the dismiss control first.
    useEffect(() => {
        openRef.current?.focus();
    }, []);

    return (
        <div className="glass border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#128C7E]">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">J</span>
                    </div>
                    <div>
                        <div className="text-white text-xs font-semibold font-display">{BRAND.name}</div>
                        <div className="text-white/60 text-[9px]">{t("business")}</div>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors"
                        aria-label={t("closePreview")}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Message preview */}
            <div className="p-4 bg-[#ece5dd] dark:bg-[#0d1117]">
                <div className="bg-white rounded-xl rounded-bl-none p-3 shadow-sm max-w-[90%]">
                    <p className="text-xs text-gray-800 font-medium">{t("previewWelcome")}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                        {t("previewMsg")}
                    </p>
                    <span className="text-[9px] text-gray-400 block mt-1 text-right">{t("previewTime")}</span>
                </div>

                <div className="mt-2 bg-[#d9fdd3] rounded-xl rounded-br-none p-3 shadow-sm ml-auto max-w-[85%]">
                    <p className="text-xs text-gray-700 italic">
                        &ldquo;{t("previewUserMsg")}&rdquo;
                    </p>
                </div>
            </div>

            {/* Trust line, then the action. Previously these sat side by side and
                the action was a small text link — the one thing the panel is for
                was the least prominent thing in it. */}
            <div className="p-3 border-t border-[var(--border)] flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                    <ShieldCheck className="w-3 h-3 text-wa-dark" />
                    {t("trust")}
                </div>
                <a
                    ref={openRef}
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-wa-dark to-wa px-4 py-2.5 font-display text-sm font-semibold text-white shadow-glow-wa transition-all duration-200 hover:shadow-[0_0_30px_rgba(37,211,102,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wa focus-visible:ring-offset-2"
                >
                    <MessageCircle className="w-4 h-4" />
                    {t("openWhatsApp")}
                    <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
                </a>
            </div>
        </div>
    );
}
