"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LegalLink } from "@/components/legal/LegalLink";
import { Button } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import type { ReferralProgram } from "@/lib/me/referral";
import { applyToReferralProgram } from "@/lib/me/referral.api";
import { formatMoney } from "@/lib/shop/format";
import { ReferralField, ReferralNotice } from "./parts";

const MOTIVATION_MAX = 1000;

/**
 * The program in plain terms.
 *
 * ⚠ These sentences are the owner's wording, so rewording one can make a false
 * promise about money. The rate and duration are not here because nothing public
 * carries them: they can differ per partner and arrive only with approval.
 */
export function ReferralHowItWorks({
  program,
  currency,
  approved,
}: {
  program: ReferralProgram;
  currency?: string;
  /** A partner has their rate on the page already, so the note about it is not for them. */
  approved?: boolean;
}) {
  const t = useTranslations("shop.referrals.how");
  const lines = [
    t("earn"),
    t("who"),
    t("limited"),
    t("when", { days: program.rewardWaitDays }),
    t("refund"),
    t.rich("minimum", {
      amount: formatMoney(program.minPayoutAmount, currency ?? ""),
      b: (chunks) => <strong>{chunks}</strong>,
    }),
  ];

  return (
    <>
      <RuleList lines={lines} />
      {!approved && (
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "8px 0 0" }}>
          {t("rates")}
        </p>
      )}
    </>
  );
}

function RuleList({ lines }: { lines: ReactNode[] }) {
  return (
    <ul
      className="muted"
      style={{
        margin: 0,
        paddingInlineStart: 18,
        listStyle: "disc",
        fontSize: 13,
        lineHeight: 1.55,
        display: "grid",
        gap: 6,
      }}
    >
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

/**
 * Applying. The button waits for the box: accepting the Partner Terms is what an
 * application is, and the API takes `termsAccepted` as a literal `true`.
 */
export function ReferralApplication({ onApplied }: { onApplied: () => Promise<void> }) {
  const t = useTranslations("shop.referrals.application");
  const tError = useTranslations("errors");
  const { flash, flashError } = useToast();
  const [accepted, setAccepted] = useState(false);
  const [motivation, setMotivation] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    if (!accepted) return;
    setBusy(true);
    setProblem(null);
    try {
      await applyToReferralProgram(motivation);
      flash(t("sent"));
      await onApplied();
    } catch (err) {
      // The page was out of date, so a form that can only fail again gives way
      // to whatever is true now.
      if (
        err instanceof ApiError &&
        (err.code === "REFERRAL_PROGRAM_DISABLED" ||
          err.code === "REFERRAL_ALREADY_APPLIED" ||
          err.code === "REFERRAL_REAPPLY_NOT_ALLOWED")
      ) {
        flashError(translateError(tError, err));
        await onApplied();
        return;
      }
      setProblem(translateError(tError, err, t("error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
      <ReferralField label={t("motivationLabel")}>
        <textarea
          className="field"
          rows={3}
          maxLength={MOTIVATION_MAX}
          placeholder={t("motivationPlaceholder")}
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
        />
      </ReferralField>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 9,
          cursor: "pointer",
          fontSize: 13.5,
          lineHeight: 1.5,
          color: "var(--text-body)",
        }}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          style={{ width: 17, height: 17, marginTop: 2, flexShrink: 0, accentColor: "var(--brand)" }}
        />
        <span>
          {t.rich("termsLabel", {
            terms: (chunks) => (
              <LegalLink
                doc="referral-partner-terms"
                style={{ fontWeight: 700, color: "var(--brand-hover)", textDecoration: "underline" }}
              >
                {chunks}
              </LegalLink>
            ),
          })}
        </span>
      </label>

      {problem && (
        <ReferralNotice tone="danger" icon="triangle-alert">
          <span role="alert">{problem}</span>
        </ReferralNotice>
      )}

      <Button block disabled={!accepted || busy} onClick={() => void submit()}>
        {busy ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
