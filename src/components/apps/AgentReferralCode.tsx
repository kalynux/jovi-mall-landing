"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useReferralLink } from "@/lib/me/useReferralLink";

/**
 * "Enter this code during sign-up in the Wi-Agent app."
 *
 * An agent signs up in the app, and no install can carry a link's code into it,
 * so typing it there is the only path (api-doc/public/FRONTEND-CHANGELOG-referrals.md).
 * It tells them what to do and nothing about the partner or the code's fate.
 */
export function AgentReferralCode({ code, withAppLink }: { code: string; withAppLink?: boolean }) {
  const t = useTranslations("auth.referral");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-start">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">{t("agentLabel")}</p>
      <p dir="ltr" className="mt-1 text-start font-mono text-base font-bold tracking-wider text-[var(--text-primary)] break-all rtl:text-end">
        {code}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
        {t(withAppLink ? "agentFormBody" : "agentAppBody")}
      </p>
      {withAppLink && (
        <Link
          href={`/apps?ref=${encodeURIComponent(code)}#agent`}
          className="mt-2 inline-block text-xs font-semibold text-primary-600 underline-offset-4 hover:underline"
        >
          {t("agentAppLink")}
        </Link>
      )}
    </div>
  );
}

/**
 * The same, on /apps, from the visit's own `?ref=`.
 *
 * A client island so the page stays statically cached: reading the search params
 * on the server would turn off its five-minute revalidation for every visitor.
 * Shows nothing on an ordinary visit, or for a code the API does not confirm.
 */
export function AgentReferralCodeFromUrl() {
  const { confirmed } = useReferralLink(useSearchParams().get("ref"));
  if (!confirmed?.code) return null;

  return (
    <div className="mt-5">
      <AgentReferralCode code={confirmed.code} />
    </div>
  );
}
