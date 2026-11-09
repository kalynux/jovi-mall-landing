"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AccountCard, ResourceView } from "@/components/shop/account/AccountShell";
import { Badge, Button, EmptyState, Tabs, type IconName } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import type { ListMeta } from "@/lib/api/client";
import { translateError } from "@/lib/auth/error-translator";
import {
  knownCategory,
  maskedPayout,
  payoutStatusOf,
  referredState,
  rewardShownAmount,
  rewardStatusOf,
  type PayoutStatus,
  type ReferralPayout,
  type ReferralReward,
  type ReferredAccount,
  type RewardStatus,
} from "@/lib/me/referral";
import { listReferralPayouts, listReferralRewards, listReferredAccounts } from "@/lib/me/referral.api";
import { formatMoney } from "@/lib/shop/format";
import { useApiResource } from "@/lib/shop/useApiResource";
import { ReferralHeading } from "./parts";

type Tab = "referred" | "rewards" | "payouts";
type BadgeTone = ComponentProps<typeof Badge>["tone"];

const REWARD_TONE: Record<RewardStatus, BadgeTone> = {
  held: "warning",
  released: "success",
  reversed: "neutral",
};

const PAYOUT_TONE: Record<PayoutStatus, BadgeTone> = {
  pending: "warning",
  processing: "info",
  paid: "success",
  rejected: "danger",
  failed: "danger",
};

/**
 * Referred accounts, rewards and withdrawals, one page at a time.
 *
 * ⛔ These rows name no order, product, vendor or commission, and the backend
 * withholds them on purpose (api-doc/me/referrals.md). Names arrive masked.
 */
export function ReferralHistory({ referredTotal }: { referredTotal?: number }) {
  const t = useTranslations("shop.referrals.history");
  const [tab, setTab] = useState<Tab>("referred");

  return (
    <section>
      <ReferralHeading>{t("title")}</ReferralHeading>
      <Tabs
        value={tab}
        onChange={(next) => setTab(next as Tab)}
        tabs={[
          { value: "referred", label: t("referred"), count: referredTotal },
          { value: "rewards", label: t("rewards") },
          { value: "payouts", label: t("payouts") },
        ]}
      />
      <div style={{ marginTop: 12 }}>
        {tab === "referred" && (
          <PagedRows
            key="referred"
            load={listReferredAccounts}
            icon="user"
            emptyTitle={t("referredEmptyTitle")}
            emptyBody={t("referredEmptyBody")}
            row={(r: ReferredAccount) => <ReferredRow key={r.id} row={r} />}
          />
        )}
        {tab === "rewards" && (
          <PagedRows
            key="rewards"
            load={listReferralRewards}
            icon="coins"
            emptyTitle={t("rewardsEmptyTitle")}
            emptyBody={t("rewardsEmptyBody")}
            row={(r: ReferralReward) => <RewardRow key={r.id} row={r} />}
          />
        )}
        {tab === "payouts" && (
          <PagedRows
            key="payouts"
            load={listReferralPayouts}
            icon="banknote"
            emptyTitle={t("payoutsEmptyTitle")}
            emptyBody={t("payoutsEmptyBody")}
            row={(r: ReferralPayout) => <PayoutRow key={r.id} row={r} />}
          />
        )}
      </div>
    </section>
  );
}

function PagedRows<T>({
  load,
  row,
  icon,
  emptyTitle,
  emptyBody,
}: {
  load: (page: number) => Promise<{ data: T[]; meta: ListMeta }>;
  row: (item: T) => ReactNode;
  icon: IconName;
  emptyTitle: string;
  emptyBody: string;
}) {
  const tKey = useTranslations();
  const tError = useTranslations("errors");
  const { flashError } = useToast();
  const first = useApiResource(() => load(1));
  /** What "Show more" has added: the rows after the first page, and how far it has read. */
  const [more, setMore] = useState<{ rows: T[]; page: number; pages: number } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const showMore = async (page: number) => {
    setLoadingMore(true);
    try {
      const next = await load(page + 1);
      setMore((prev) => ({
        rows: [...(prev?.rows ?? []), ...next.data],
        page: page + 1,
        pages: next.meta.pages,
      }));
    } catch (err) {
      flashError(translateError(tError, err));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <ResourceView status={first.status} error={first.error} data={first.data} onRetry={first.reload}>
      {({ data, meta }) => {
        const page = more?.page ?? meta.page;
        const pages = more?.pages ?? meta.pages;

        if (data.length === 0) {
          return <EmptyState icon={icon} title={emptyTitle} description={emptyBody} />;
        }

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.map(row)}
            {more?.rows.map(row)}
            {page < pages && (
              <Button variant="secondary" block disabled={loadingMore} onClick={() => void showMore(page)}>
                {loadingMore ? tKey("shop.common.loading") : tKey("shop.common.showMore")}
              </Button>
            )}
          </div>
        );
      }}
    </ResourceView>
  );
}

/** The row every list shares: who, how much, and what happened. */
function RowFrame({
  title,
  amount,
  badge,
  lines,
}: {
  title: ReactNode;
  amount?: string;
  badge?: ReactNode;
  lines: ReactNode[];
}) {
  return (
    <AccountCard>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0, fontSize: 14, fontWeight: 700, color: "var(--text-strong)", overflowWrap: "anywhere" }}>
          {title}
        </div>
        {amount && (
          <div style={{ flexShrink: 0, fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}>{amount}</div>
        )}
      </div>
      {badge && <div style={{ marginTop: 6 }}>{badge}</div>}
      {lines.length > 0 && (
        <div className="muted" style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5 }}>
          {lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </AccountCard>
  );
}

function useDate() {
  const format = useFormatter();
  return (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
}

function CategoryLabel({ category }: { category: string }) {
  const t = useTranslations("shop.referrals.history.category");
  const known = knownCategory(category);
  return known ? <>{t(known)}</> : null;
}

function ReferredRow({ row }: { row: ReferredAccount }) {
  const t = useTranslations("shop.referrals.history");
  const date = useDate();
  const state = referredState(row);

  return (
    <RowFrame
      title={<bdi>{row.name}</bdi>}
      amount={state === "neverEarns" ? undefined : formatMoney(row.totalEarned, "")}
      badge={
        <Badge size="sm" tone={state === "earning" ? "success" : "neutral"}>
          {t(`referredState.${state}`)}
        </Badge>
      }
      lines={[
        <>
          <CategoryLabel category={row.category} /> · {t("joined", { date: date(row.registeredAt) })}
        </>,
        state === "neverEarns"
          ? t("neverEarnsBody")
          : t(state === "earning" ? "earnsUntil" : "endedOn", { date: date(row.expiresAt as string) }),
      ]}
    />
  );
}

function RewardRow({ row }: { row: ReferralReward }) {
  const t = useTranslations("shop.referrals.history");
  const date = useDate();
  const status = rewardStatusOf(row.status);

  return (
    <RowFrame
      title={<bdi>{row.name}</bdi>}
      amount={formatMoney(rewardShownAmount(row), row.currency)}
      badge={
        <Badge size="sm" tone={REWARD_TONE[status]}>
          {t(`reward.${status}`)}
        </Badge>
      }
      lines={[
        <>
          <CategoryLabel category={row.category} /> · {t("earnedOn", { date: date(row.earnedAt) })}
        </>,
        // What a provider paid for, never how much (owner RS-7).
        ...(row.paymentKind === "plan" || row.paymentKind === "credits" ? [t(`paidFor.${row.paymentKind}`)] : []),
        ...(status === "held" ? [t("availableFrom", { date: date(row.availableFrom) })] : []),
        ...(row.adjusted && status !== "reversed" ? [t("adjusted")] : []),
      ]}
    />
  );
}

function PayoutRow({ row }: { row: ReferralPayout }) {
  const t = useTranslations("shop.referrals.history");
  const date = useDate();
  const status = payoutStatusOf(row.status);
  const destination = maskedPayout(row.destination);

  return (
    <RowFrame
      title={t("requestedOn", { date: date(row.requestedAt) })}
      amount={formatMoney(row.amount, row.currency)}
      badge={
        <Badge size="sm" tone={PAYOUT_TONE[status]}>
          {t(`payout.${status}`)}
        </Badge>
      }
      lines={[
        ...(destination
          ? [
              <>
                {destination.name} · <bdi dir="ltr">{destination.number}</bdi>
              </>,
            ]
          : []),
        ...(row.resolvedAt ? [t("resolvedOn", { date: date(row.resolvedAt) })] : []),
        ...(row.rejectionReason ? [t("refusedReason", { reason: row.rejectionReason })] : []),
      ]}
    />
  );
}
