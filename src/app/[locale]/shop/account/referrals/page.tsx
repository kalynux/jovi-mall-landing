"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AccountCard, AccountShell, ResourceView } from "@/components/shop/account/AccountShell";
import { EmptyState } from "@/components/shop/ds";
import { ReferralApplication, ReferralHowItWorks } from "@/components/shop/account/referrals/ReferralApplication";
import { ReferralHistory } from "@/components/shop/account/referrals/ReferralHistory";
import { ReferralMoney } from "@/components/shop/account/referrals/ReferralMoney";
import { ReferralCodeCard, ReferralShare, ReferralTerms } from "@/components/shop/account/referrals/ReferralShare";
import { ReferralNotice } from "@/components/shop/account/referrals/parts";
import { referralView, type ReferralOverview } from "@/lib/me/referral";
import { getReferralOverview } from "@/lib/me/referral.api";
import { useApiResource } from "@/lib/shop/useApiResource";

/**
 * The referral program, in every state (api-doc/FRONTEND-CHANGELOG-referrals.md).
 *
 * The status lives only here: there is no in-app notification when it changes,
 * so this page must always read it fresh rather than assume.
 *
 * The program starts switched off, and every figure on the page comes from the
 * response. See the notes in `lib/me/referral.ts`.
 */
export default function ReferralsPage() {
  const tKey = useTranslations();
  const t = useTranslations("shop.referrals");
  const overview = useApiResource<ReferralOverview>(() => getReferralOverview());
  /** Bumped after an action, so the history re-reads along with the balances. */
  const [version, setVersion] = useState(0);

  // Re-read in place: a reload would blank a money screen to skeletons between
  // the toast and the new balance.
  const { set, reload } = overview;
  const refresh = useCallback(async () => {
    try {
      set(await getReferralOverview());
      setVersion((v) => v + 1);
    } catch {
      reload();
    }
  }, [set, reload]);

  return (
    <AccountShell title={tKey("shop.nav.titles.referrals")}>
      <ResourceView
        status={overview.status}
        error={overview.error}
        data={overview.data}
        onRetry={overview.reload}
        errorFallback={t("loadError")}
      >
        {(o) => <ReferralScreen overview={o} version={version} onChanged={refresh} />}
      </ResourceView>
    </AccountShell>
  );
}

function ReferralScreen({
  overview: o,
  version,
  onChanged,
}: {
  overview: ReferralOverview;
  version: number;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("shop.referrals");
  const format = useFormatter();
  const view = referralView(o);

  if (view.closed) {
    return <EmptyState icon="hand-coins" title={t("closedTitle")} description={t("closedBody")} />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {view.reviewing && (
        <ReferralNotice tone="info" icon="hourglass" title={t("reviewingTitle")}>
          {o.appliedAt
            ? t("reviewingBodyDated", { date: format.dateTime(new Date(o.appliedAt), { dateStyle: "medium" }) })
            : t("reviewingBody")}
        </ReferralNotice>
      )}

      {view.notice && (
        <ReferralNotice
          tone={view.notice === "rejected" ? "neutral" : "warning"}
          icon={view.notice === "rejected" ? "info" : "triangle-alert"}
          title={t(`status.${view.notice}.title`)}
        >
          {o.statusReason && (
            <span style={{ display: "block", marginBottom: 4 }}>
              {t("status.reason", { reason: o.statusReason })}
            </span>
          )}
          {t(`status.${view.notice}.body`)}
          {view.form && <span style={{ display: "block", marginTop: 4 }}>{t("status.canApplyAgain")}</span>}
        </ReferralNotice>
      )}

      {view.paused && (
        <ReferralNotice tone="warning" icon="info">
          {t("pausedNotice")}
        </ReferralNotice>
      )}

      {view.form && (
        <AccountCard>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-strong)" }}>
            {t("introTitle")}
          </h2>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: "6px 0 12px" }}>
            {t("introLead")}
          </p>
          <ReferralHowItWorks program={o.program} currency={o.balances?.currency} />
          <ReferralApplication onApplied={onChanged} />
        </AccountCard>
      )}

      {view.share && <ReferralShare overview={o} />}
      {view.deadCode && <ReferralCodeCard overview={o} />}
      {view.terms && <ReferralTerms overview={o} />}
      {view.money && <ReferralMoney overview={o} destination={view.destination} onChanged={onChanged} />}

      {view.share && (
        <details>
          <summary
            style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "var(--text-body)", padding: "2px 0" }}
          >
            {t("how.title")}
          </summary>
          <div style={{ marginTop: 10 }}>
            <ReferralHowItWorks program={o.program} currency={o.balances?.currency} approved />
          </div>
        </details>
      )}

      {view.money && <ReferralHistory key={version} referredTotal={o.referred?.total} />}
    </div>
  );
}
