"use client";
import type { CSSProperties, ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { UseFormRegisterReturn } from "react-hook-form";
import { legalUrl, type LegalDoc } from "@/lib/legal";
import { openExternal } from "@/lib/native/links";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * A link to the Privacy Policy or the Terms, in the UI's language.
 *
 * A real `<a target="_blank">` on the web. In the app the click goes through
 * `openExternal` instead — a Custom Tab on Android, which is a real browser, so
 * the page's "Download PDF" button works there; inside the WebView it does not.
 */
export function LegalLink({
  doc,
  children,
  className,
  style,
}: {
  doc: LegalDoc;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const url = legalUrl(doc, useLocale());

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={
        IS_NATIVE_BUILD
          ? (e) => {
              e.preventDefault();
              void openExternal(url);
            }
          : undefined
      }
    >
      {children}
    </a>
  );
}

const AGREEMENT_LINK = "font-semibold underline underline-offset-2 hover:text-primary-600";

/**
 * The required "I agree to the Terms of Service and Privacy Policy" checkbox
 * for vendor, agency and agent sign-up (and add-role). Customers never see it:
 * they register through the bot.
 *
 * The links sit inside the label, which is safe: a click on an interactive
 * descendant of a label does not toggle its control.
 */
export function TermsConsentField({
  id,
  registration,
  error,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const t = useTranslations("legal");
  const errorId = `${id}-error`;
  const links = {
    terms: (chunks: ReactNode) => (
      <LegalLink doc="terms" className={AGREEMENT_LINK}>
        {chunks}
      </LegalLink>
    ),
    privacy: (chunks: ReactNode) => (
      <LegalLink doc="privacy" className={AGREEMENT_LINK}>
        {chunks}
      </LegalLink>
    ),
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer accent-primary-600"
          {...registration}
        />
        <label htmlFor={id} className="cursor-pointer text-xs leading-relaxed text-[var(--text-secondary)]">
          {t.rich("consentLabel", links)}
        </label>
      </div>
      {error && (
        <p id={errorId} aria-live="polite" className="text-xs font-medium text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "By creating an account, you agree to our Terms of Service and Privacy
 * Policy." — or the checkout's shorter terms-only line. Sits under the button
 * it describes.
 */
export function LegalAgreement({
  kind,
  className,
  style,
}: {
  kind: "signup" | "checkout";
  className?: string;
  style?: CSSProperties;
}) {
  const t = useTranslations("legal");
  const links = {
    terms: (chunks: ReactNode) => (
      <LegalLink doc="terms" className={AGREEMENT_LINK}>
        {chunks}
      </LegalLink>
    ),
    privacy: (chunks: ReactNode) => (
      <LegalLink doc="privacy" className={AGREEMENT_LINK}>
        {chunks}
      </LegalLink>
    ),
  };

  return (
    <p
      className={className ?? "text-center text-xs leading-relaxed text-[var(--text-muted)]"}
      style={style}
    >
      {kind === "signup" ? t.rich("signupAgreement", links) : t.rich("checkoutAgreement", links)}
    </p>
  );
}
