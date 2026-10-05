"use client";
import type { CSSProperties, ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { UseFormRegisterReturn } from "react-hook-form";
import { legalUrl, type LegalDoc } from "@/lib/legal";
import { openExternal } from "@/lib/native/links";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * A link to one of the Legal Centre's documents, in the UI's language.
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

/** The `t.rich` tag for a document, styled as an inline agreement link. */
function agreementLink(doc: LegalDoc) {
  function AgreementLink(chunks: ReactNode) {
    return (
      <LegalLink doc={doc} className={AGREEMENT_LINK}>
        {chunks}
      </LegalLink>
    );
  }
  return AgreementLink;
}

/**
 * The business roles that must accept, and the agreement each one signs on top
 * of the Terms and the Privacy Policy.
 */
const ROLE_AGREEMENT = {
  vendor: { doc: "seller-agreement", label: "consentLabelSeller" },
  agency: { doc: "delivery-partner-agreement", label: "consentLabelDeliveryPartner" },
  agent: { doc: "delivery-partner-agreement", label: "consentLabelDeliveryPartner" },
} as const satisfies Record<string, { doc: LegalDoc; label: string }>;

export type ConsentRole = keyof typeof ROLE_AGREEMENT;

/**
 * The required "I agree to the Terms of Service, the Seller Agreement and the
 * Privacy Policy" checkbox for vendor, agency and agent sign-up (and add-role),
 * naming the agreement of the role being taken on. Customers never see it:
 * they register through the bot.
 *
 * The backend stores only that the user accepted (`terms_accepted: true`),
 * never which documents, so the wording can follow the Legal Centre freely.
 *
 * The links sit inside the label, which is safe: a click on an interactive
 * descendant of a label does not toggle its control.
 */
export function TermsConsentField({
  id,
  role,
  registration,
  error,
}: {
  id: string;
  role: ConsentRole;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const t = useTranslations("legal");
  const errorId = `${id}-error`;
  const { doc, label } = ROLE_AGREEMENT[role];

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
          {t.rich(label, {
            terms: agreementLink("terms-of-service"),
            agreement: agreementLink(doc),
            privacy: agreementLink("privacy-policy"),
          })}
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
 * Policy." — or the checkout's "Terms of Service and Returns & Refunds Policy"
 * line. Sits under the button it describes.
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

  return (
    <p
      className={className ?? "text-center text-xs leading-relaxed text-[var(--text-muted)]"}
      style={style}
    >
      {kind === "signup"
        ? t.rich("signupAgreement", {
            terms: agreementLink("terms-of-service"),
            privacy: agreementLink("privacy-policy"),
          })
        : t.rich("checkoutAgreement", {
            terms: agreementLink("terms-of-service"),
            refunds: agreementLink("returns-refunds-policy"),
          })}
    </p>
  );
}
