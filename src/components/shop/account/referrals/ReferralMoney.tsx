"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AccountCard } from "@/components/shop/account/AccountShell";
import { BottomSheet, Button, ConfirmDialog, Icon } from "@/components/shop/ds";
import { PhoneField } from "@/components/ui/phone";
import { useToast } from "@/components/shop/providers";
import { NETWORK_NAME } from "@/components/shop/payment-networks";
import { ApiError } from "@/lib/auth/auth.types";
import { getRoleUrl } from "@/lib/auth/auth.redirect";
import { translateError } from "@/lib/auth/error-translator";
import {
  balanceRows,
  maskedPayout,
  PAYOUT_PAGE,
  withdrawBlocker,
  type PayoutDestination,
  type PayoutSource,
  type ReferralOverview,
} from "@/lib/me/referral";
import { requestReferralPayout, setReferralPayoutMethod } from "@/lib/me/referral.api";
import { openExternal } from "@/lib/native/links";
import { isValidPhone, toE164 } from "@/lib/phone";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { providerMismatch } from "@/lib/shop/cm-operator";
import { formatMoney } from "@/lib/shop/format";
import { ReferralField, ReferralHeading, ReferralNotice } from "./parts";

/**
 * Balances, where the money goes, and the way to withdraw it.
 *
 * ⚠ `clawback` is what the partner owes back. It runs the other way, so it is a
 * sentence of its own and never joins the figures above it (`balanceRows`).
 */
export function ReferralMoney({
  overview: o,
  destination,
  onChanged,
}: {
  overview: ReferralOverview;
  /** Whether this person can hold a destination at all. A rejected applicant cannot. */
  destination: boolean;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("shop.referrals");
  const tError = useTranslations("errors");
  const { flash, flashError } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const balances = o.balances;
  if (!balances) return null;

  const { currency } = balances;
  const money = (amount: number) => formatMoney(amount, currency);
  const blocker = withdrawBlocker(o);
  const shown = maskedPayout(o.payoutDestination?.method);

  const withdraw = async () => {
    setBusy(true);
    try {
      await requestReferralPayout();
      flash(t("withdraw.requested"));
    } catch (err) {
      const min = err instanceof ApiError ? err.details?.minAmount : undefined;
      flashError(
        err instanceof ApiError && err.code === "EARNINGS_PAYOUT_BELOW_MINIMUM" && typeof min === "number"
          ? t("withdraw.belowMinimum", { amount: money(min) })
          : translateError(tError, err, t("withdraw.failed")),
      );
    } finally {
      setBusy(false);
      setConfirming(false);
    }
    // Success or refusal, the balances on screen are now out of date.
    await onChanged();
  };

  return (
    <>
      <AccountCard>
        <ReferralHeading>{t("balances.title")}</ReferralHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px 16px" }}>
          {balanceRows(balances).map((row) => (
            <div key={row.key} style={{ minWidth: 0 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                {t(`balances.${row.key}`)}
              </div>
              <div
                style={{
                  fontSize: row.key === "available" ? 20 : 15,
                  fontWeight: 800,
                  color: row.key === "available" ? "var(--brand-hover)" : "var(--text-strong)",
                  marginTop: 2,
                }}
              >
                {money(row.amount)}
              </div>
            </div>
          ))}
        </div>

        {balances.clawback > 0 && (
          <div style={{ marginTop: 12 }}>
            <ReferralNotice tone="warning" icon="triangle-alert">
              {t("balances.owes", { amount: money(balances.clawback) })}
            </ReferralNotice>
          </div>
        )}

        {destination && o.payoutDestination && (
          <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 14, paddingTop: 14 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>
              {t("destination.title")}
            </p>

            {shown ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="smartphone" size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                  <div style={{ fontWeight: 700, color: "var(--text-strong)" }}>{shown.name}</div>
                  <div className="muted" style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>
                    <bdi dir="ltr">{shown.number}</bdi> · <bdi>{shown.holder}</bdi>
                  </div>
                </div>
                {o.payoutDestination.editableHere && (
                  <Button size="sm" variant="ghost" leadingIcon="pencil" onClick={() => setSheetOpen(true)}>
                    {t("destination.change")}
                  </Button>
                )}
              </div>
            ) : (
              <Button block variant="secondary" leadingIcon="plus" onClick={() => setSheetOpen(true)}>
                {t("destination.add")}
              </Button>
            )}

            {!o.payoutDestination.editableHere && o.payoutDestination.source && (
              <ManagedElsewhere source={o.payoutDestination.source} />
            )}
          </div>
        )}

        {o.canWithdraw && (
          <div style={{ marginTop: 14 }}>
            <Button block leadingIcon="banknote" disabled={busy} onClick={() => setConfirming(true)}>
              {t("withdraw.button", { amount: money(balances.available) })}
            </Button>
          </div>
        )}

        {blocker && blocker !== "owes" && (
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.5 }}>
            {blocker === "belowMinimum"
              ? t("withdraw.blocked.belowMinimum", { amount: money(o.program.minPayoutAmount) })
              : t(`withdraw.blocked.${blocker}`)}
          </p>
        )}
      </AccountCard>

      <ConfirmDialog
        open={confirming}
        title={t("withdraw.confirmTitle")}
        icon="banknote"
        confirmLabel={t("withdraw.confirm")}
        cancelLabel={t("withdraw.cancel")}
        busy={busy}
        onConfirm={() => void withdraw()}
        onCancel={() => setConfirming(false)}
      >
        {shown
          ? t("withdraw.confirmBody", { amount: money(balances.available), destination: `${shown.name} ${shown.number}` })
          : t("withdraw.confirmBodyNoDestination", { amount: money(balances.available) })}
      </ConfirmDialog>

      <PayoutNumberSheet
        open={sheetOpen}
        current={o.payoutDestination ?? null}
        onClose={() => setSheetOpen(false)}
        onSaved={async () => {
          setSheetOpen(false);
          await onChanged();
        }}
      />
    </>
  );
}

/**
 * A destination held by a role on this account, read live: editing it on that
 * app's page is what changes it here. Those apps live on other hosts, and in the
 * shop bundle they open in the system browser.
 */
function ManagedElsewhere({ source }: { source: PayoutSource }) {
  const t = useTranslations("shop.referrals.destination");
  if (source === "referral") return null;

  const href = getRoleUrl(source, PAYOUT_PAGE[source]);

  return (
    <p className="muted" style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.5 }}>
      {t(`managed.${source}`)}{" "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={
          IS_NATIVE_BUILD
            ? (e) => {
                e.preventDefault();
                void openExternal(href);
              }
            : undefined
        }
        style={{ fontWeight: 700, color: "var(--brand-hover)", textDecoration: "underline" }}
      >
        {t(`manage.${source}`)}
      </a>
    </p>
  );
}

/**
 * `wire` is the contract's own spelling. Unlike a charge's `MTN`, a payout's
 * `provider` is free text that a person reads on the payout ticket.
 * `brandName` is a proper noun, not copy (LOCALISATION.md §6).
 */
const NETWORKS = [
  { id: "MTN", wire: "mtn", brandName: "MTN Mobile Money" },
  { id: "ORANGE", wire: "orange", brandName: "Orange Money" },
  { id: "MOOV", wire: "moov", brandName: "Moov Money" },
] as const;

type NetworkId = (typeof NETWORKS)[number]["id"];

/**
 * The partner's own destination. The API refuses it if a role on the account
 * already holds one, and it must have an account name as well as a number.
 *
 * The prefix check is the same one saving a wallet uses: money sent to the wrong
 * network is much harder to get back than a refused form.
 */
function PayoutNumberSheet({
  open,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: PayoutDestination | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("shop.referrals.sheet");
  const tProvider = useTranslations("shop.payProvider");
  const tCommon = useTranslations("shop.common");
  const tError = useTranslations("errors");
  const { flash, flashError } = useToast();
  const [network, setNetwork] = useState<NetworkId>("MTN");
  const [phone, setPhone] = useState("");
  const [accountName, setAccountName] = useState(current?.method?.mobile_money?.account_name ?? "");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const detected = providerMismatch(network, phone);
  const name = accountName.trim();
  const valid = isValidPhone(phone) && !detected && name.length > 0;

  const save = async () => {
    const e164 = toE164(phone);
    const chosen = NETWORKS.find((n) => n.id === network);
    if (!e164 || !chosen || !valid) return;
    setSaving(true);
    setProblem(null);
    setPhoneError(null);
    try {
      await setReferralPayoutMethod({ provider: chosen.wire, phoneNumber: e164, accountName: name });
      setPhone("");
      flash(t("saved"));
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === "REFERRAL_PAYOUT_METHOD_MANAGED_ELSEWHERE") {
        // A role gained a destination since this page loaded, and that one is
        // what payouts use now. The refreshed page shows it and where to edit it.
        flashError(translateError(tError, err));
        await onSaved();
        return;
      }
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && err.details?.fields?.length) {
        if (err.details.fields.some((f) => f.path.includes("phone_number"))) setPhoneError(t("phoneInvalid"));
        if (err.details.fields.some((f) => f.path.includes("account_name"))) setProblem(t("nameInvalid"));
        return;
      }
      setProblem(translateError(tError, err, t("error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("title")}
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {tCommon("cancel")}
          </Button>
          <Button block onClick={() => void save()} disabled={!valid || saving}>
            {saving ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      }
    >
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("network")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {NETWORKS.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-pressed={network === n.id}
            onClick={() => {
              setNetwork(n.id);
              setProblem(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: 13,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              textAlign: "start",
              background: "var(--surface)",
              border: network === n.id ? "1.5px solid var(--brand)" : "1.5px solid var(--border)",
              boxShadow: network === n.id ? "var(--focus-ring)" : "none",
            }}
          >
            <Icon
              name="smartphone"
              size={20}
              style={{ color: network === n.id ? "var(--brand)" : "var(--text-muted)" }}
            />
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)" }}>
              {n.brandName}
            </span>
          </button>
        ))}
      </div>

      <PhoneField
        variant="stacked"
        label={t("number")}
        required
        name="referral-payout-number"
        autoComplete="tel"
        value={phone}
        onChange={(next) => {
          setPhone(next);
          setPhoneError(null);
          setProblem(null);
        }}
        hint={t("numberHint")}
        error={phoneError ?? undefined}
      />

      {detected && (
        <div style={{ marginTop: 10 }}>
          <ReferralNotice tone="danger" icon="triangle-alert">
            <span role="alert">
              {tProvider("mismatch", { detected: NETWORK_NAME[detected], provider: NETWORK_NAME[network] })}{" "}
              <button
                type="button"
                onClick={() => setNetwork(detected)}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  color: "var(--brand-hover)",
                  fontWeight: 700,
                  fontSize: "inherit",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                {t("switchTo", { network: NETWORK_NAME[detected] })}
              </button>
            </span>
          </ReferralNotice>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <ReferralField label={t("accountName")} hint={t("accountNameHint")}>
          <input
            className="field"
            type="text"
            autoComplete="name"
            value={accountName}
            maxLength={100}
            onChange={(e) => {
              setAccountName(e.target.value);
              setProblem(null);
            }}
          />
        </ReferralField>
      </div>

      {problem && (
        <div style={{ marginTop: 10 }}>
          <ReferralNotice tone="danger" icon="triangle-alert">
            <span role="alert">{problem}</span>
          </ReferralNotice>
        </div>
      )}
    </BottomSheet>
  );
}
