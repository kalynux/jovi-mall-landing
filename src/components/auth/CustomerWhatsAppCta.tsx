"use client";
import { MessageCircle, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { BRAND } from "@/lib/constants";
import { useLocale, type Locale } from "@/lib/i18n-provider";

// ─── Locale → /profile command ──────────────────────────────────────────────
/**
 * Returns the localised WhatsApp profile command.
 *
 * Arabic is passed through encodeURIComponent so RTL characters in the
 * query-string are percent-encoded — WhatsApp renders them correctly
 * regardless of the surrounding RTL context.
 */
const PROFILE_COMMAND: Record<Locale, string> = {
  en: "/profile",
  es: "/profile",
  pt: "/profile",
  fr: "/profil",
  ar: "/profile", // Arabic users get the same command; the UI is RTL but the command stays ASCII
};

function buildWaUrl(locale: Locale): string {
  const number = BRAND.whatsappNumber.replace(/\D/g, "");
  // Always encode the text param — this ensures RTL characters (if added in
  // future) are safe in the URL, and avoids issues with Arabic browsers that
  // may not encode query params automatically.
  const command = encodeURIComponent(PROFILE_COMMAND[locale] ?? "/profile");
  return `https://wa.me/${number}?text=${command}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface CustomerWhatsAppCtaProps {
  /** Called when the user clicks "Choose a different role" */
  onBack: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function CustomerWhatsAppCta({ onBack }: CustomerWhatsAppCtaProps) {
  const { locale } = useLocale();
  const t = useTranslations("auth");
  const waUrl = buildWaUrl(locale);

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-wa/10 flex items-center justify-center">
        <MessageCircle className="w-8 h-8 text-wa-dark" aria-hidden="true" />
      </div>

      {/* Heading */}
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base text-[var(--text-primary)]">
          {t("customerWaTitle")}
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          {t("customerWaSubtitle")}
        </p>
      </div>

      {/* Body copy */}
      <p className="text-sm text-[var(--text-secondary)] max-w-xs">
        {t("customerWaBody")}
      </p>

      {/* Primary CTA */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
        {t("customerWaCta")}
        <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
      </a>

      {/* Back */}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
      >
        ← {t("customerWaBack")}
      </button>
    </div>
  );
}
