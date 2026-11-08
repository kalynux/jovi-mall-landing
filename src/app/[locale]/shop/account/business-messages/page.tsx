"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { EmptyState, Icon } from "@/components/shop/ds";
import { AccountCard, AccountShell, ResourceView } from "@/components/shop/account/AccountShell";
import { useApiResource } from "@/lib/shop/useApiResource";
import { translateError } from "@/lib/auth/error-translator";
import { listListingConsents, setListingConsent } from "@/lib/shop/listings.api";
import type { ListingConsent } from "@/lib/shop/listings";

/**
 * Account → "Businesses that may message me".
 *
 * Every business the customer was asked about after unlocking one of its
 * contacts (`GET /api/me/listing-consents`, newest change first), each with a
 * switch (`PUT … { granted }`). A business that may message the customer can
 * send at most 3 messages in 30 days, and each one carries "Stop these
 * messages", which withdraws the consent from the chat itself.
 *
 * The switch is optimistic: it moves at once and moves back with a sentence if
 * the PUT fails, because a toggle that waits a network round trip on a 2G
 * phone reads as broken.
 */
export default function BusinessMessagesPage() {
  const t = useTranslations("shop.listings.consents");
  const tKey = useTranslations();
  const router = useRouter();
  const consents = useApiResource(listListingConsents);

  return (
    <AccountShell title={tKey("shop.nav.titles.businessMessages")} description={t("lead")}>
      <ResourceView
        status={consents.status}
        error={consents.error}
        data={consents.data}
        onRetry={consents.reload}
        errorFallback={t("loadFailed")}
      >
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState
              icon="megaphone"
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              actionLabel={t("emptyAction")}
              onAction={() => router.push("/shop")}
            />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rows.map((row) => (
                <ConsentRow
                  key={row.vendorId}
                  row={row}
                  onSaved={(next) => consents.set(rows.map((r) => (r.vendorId === next.vendorId ? next : r)))}
                />
              ))}
              <p className="muted" style={{ display: "flex", gap: 6, fontSize: 12.5, lineHeight: 1.5, margin: "6px 2px 0" }}>
                <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{t("footnote")}</span>
              </p>
            </div>
          )
        }
      </ResourceView>
    </AccountShell>
  );
}

function ConsentRow({ row, onSaved }: { row: ListingConsent; onSaved: (next: ListingConsent) => void }) {
  const t = useTranslations("shop.listings.consents");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const on = optimistic ?? row.granted;
  const labelId = `consent-${row.vendorId}`;

  const toggle = async () => {
    if (saving) return;
    const next = !on;
    setOptimistic(next);
    setSaving(true);
    setError(null);
    try {
      const saved = await setListingConsent(row.vendorId, next);
      onSaved(saved);
      setOptimistic(null);
    } catch (err) {
      setOptimistic(null);
      setError(translateError(tErrors, err, t("saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : null);
  const status =
    row.consent === "granted"
      ? t("statusGranted", { date: date(row.grantedAt) ?? "", hasDate: row.grantedAt ? "yes" : "no" })
      : row.consent === "revoked"
        ? t("statusRevoked", { date: date(row.revokedAt) ?? "", hasDate: row.revokedAt ? "yes" : "no" })
        : t("statusNotGranted");

  return (
    <AccountCard style={{ padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 64, padding: "10px 14px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            id={labelId}
            className="ds-ugc"
            style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", overflowWrap: "anywhere" }}
          >
            {row.businessName}
          </div>
          <div style={{ fontSize: 12.5, color: on && optimistic === null ? "var(--success)" : "var(--text-muted)", marginTop: 2 }}>
            {optimistic !== null ? t("saving") : status}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={labelId}
          aria-describedby={error ? `${labelId}-error` : undefined}
          disabled={saving}
          onClick={() => void toggle()}
          className="consent-switch"
        >
          <span className="consent-switch__thumb" />
        </button>
      </div>
      {error && (
        <p id={`${labelId}-error`} role="alert" className="listing-contact-row__error" style={{ margin: 0, padding: "0 14px 12px" }}>
          <Icon name="circle-alert" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </p>
      )}
    </AccountCard>
  );
}
