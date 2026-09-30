"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AccountCard,
  AccountShell,
  CardAction,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Badge, BottomSheet, Button, ConfirmDialog, EmptyState, Icon, type IconName } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError, translateFieldCode } from "@/lib/auth/error-translator";
import { isValidPhone, toE164 } from "@/lib/phone";
import { PhoneField } from "@/components/ui/phone";
import { NETWORK_NAME } from "@/components/shop/payment-networks";
import { providerMismatch } from "@/lib/shop/cm-operator";
import {
  addPaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/shop/payment-methods.api";
import { forgetWalletNumber, rememberWalletNumber } from "@/lib/shop/wallet-numbers";
import { useApiResource } from "@/lib/shop/useApiResource";
import type {
  SavedMethodKind,
  SavedPaymentMethod,
  SavedWalletProvider,
} from "@/lib/shop/customer.types";

const KIND_META: Record<SavedMethodKind, { labelKey: string; icon: IconName }> = {
  MOBILE_MONEY: { labelKey: "shop.paymentMethods.types.mobile_money", icon: "smartphone" },
  CARD: { labelKey: "shop.paymentMethods.types.card", icon: "credit-card" },
  BANK_TRANSFER: { labelKey: "shop.paymentMethods.types.bank_transfer", icon: "landmark" },
};

/**
 * The networks a wallet can be saved on — the same `MTN` / `ORANGE` / `MOOV`
 * a charge sends as `provider`. Never a payment company: which company moves
 * the money is the server's choice, made at payment time.
 *
 * `brandName` is a proper noun, not copy: MTN Mobile Money is called that in
 * every language we ship. Deliberately not in the catalogue — LOCALISATION.md §6.
 */
const WALLET_PROVIDERS: { id: SavedWalletProvider; brandName: string }[] = [
  { id: "MTN", brandName: "MTN Mobile Money" },
  { id: "ORANGE", brandName: "Orange Money" },
  { id: "MOOV", brandName: "Moov Money" },
];

/**
 * Whether checkout can pay with this saved method. An old saved card, a bank
 * transfer, or a wallet whose network the server no longer knows
 * (`provider: null`) is listed and deletable, but never pre-selected.
 */
const payable = (m: SavedPaymentMethod) =>
  m.kind === "MOBILE_MONEY" && (m.provider === "MTN" || m.provider === "ORANGE" || m.provider === "MOOV");

export default function PaymentMethodsPage() {
  const methods = useApiResource<SavedPaymentMethod[]>(() => listPaymentMethods());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The method the shopper has asked to remove, held until they confirm. */
  const [pendingRemoval, setPendingRemoval] = useState<SavedPaymentMethod | null>(null);
  const { flash, flashError } = useToast();
  const t = useTranslations("shop.paymentMethods");
  const tCommon = useTranslations("shop.common");
  const tKey = useTranslations();
  const tError = useTranslations("errors");

  const run = useCallback(
    async (id: string, op: () => Promise<unknown>, done: string) => {
      setBusyId(id);
      try {
        await op();
        methods.reload();
        flash(done);
      } catch (err) {
        if (err instanceof ApiError && err.code === "PAYMENT_METHOD_NOT_FOUND") {
          // Already gone — removed on another device, say. Re-read the list
          // rather than showing a row that can only fail again.
          await forgetWalletNumber(id);
          methods.reload();
          flash(t("goneRefreshed"));
          return;
        }
        flashError(translateError(tError, err, t("updateError")));
      } finally {
        setBusyId(null);
      }
    },
    [methods, flash, flashError, t, tError],
  );

  return (
    <AccountShell
      title={tKey("shop.nav.titles.paymentMethods")}
      description={t("description")}
      action={
        <Button size="sm" leadingIcon="plus" onClick={() => setSheetOpen(true)}>
          {tCommon("add")}
        </Button>
      }
    >
      <ResourceView
        status={methods.status}
        error={methods.error}
        data={methods.data}
        onRetry={methods.reload}
        errorFallback={t("loadError")}
      >
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              icon="wallet"
              title={t("emptyTitle")}
              description={t("emptyDescription")}
              actionLabel={t("emptyAction")}
              actionIcon="plus"
              onAction={() => setSheetOpen(true)}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {list.map((m) => (
                <MethodRow
                  key={m.id}
                  method={m}
                  busy={busyId === m.id}
                  onMakeDefault={() =>
                    run(m.id, () => setDefaultPaymentMethod(m.id), t("defaultUpdated"))
                  }
                  onRemove={() => setPendingRemoval(m)}
                />
              ))}
            </div>
          )
        }
      </ResourceView>

      <AddMethodSheet
        open={sheetOpen}
        existing={methods.data ?? []}
        onClose={() => setSheetOpen(false)}
        onAdded={() => {
          setSheetOpen(false);
          methods.reload();
          flash(t("added"));
        }}
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t("removeTitle")}
        tone="danger"
        icon="trash-2"
        confirmLabel={tCommon("remove")}
        cancelLabel={t("removeCancel")}
        busy={pendingRemoval !== null && busyId === pendingRemoval.id}
        onConfirm={async () => {
          const method = pendingRemoval;
          if (!method) return;
          await run(
            method.id,
            async () => {
              await removePaymentMethod(method.id);
              // Only after the server agrees it is gone — a failed delete
              // leaves a method that checkout should still be able to prefill.
              await forgetWalletNumber(method.id);
            },
            t("removed"),
          );
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      >
        {t.rich("removeBody", {
          label: pendingRemoval?.label ?? "",
          name: (chunks) => <strong>{chunks}</strong>,
        })}
      </ConfirmDialog>
    </AccountShell>
  );
}

function MethodRow({
  method,
  busy,
  onMakeDefault,
  onRemove,
}: {
  method: SavedPaymentMethod;
  busy: boolean;
  onMakeDefault: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("shop.paymentMethods");
  const tCommon = useTranslations("shop.common");
  const tKey = useTranslations();
  const meta = KIND_META[method.kind] ?? KIND_META.MOBILE_MONEY;

  return (
    <AccountCard>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Icon name={meta.icon} size={20} style={{ color: "var(--brand)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>
              {method.label}
            </span>
            {method.isDefault && (
              <Badge size="sm" tone="brand">
                {t("defaultBadge")}
              </Badge>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
            {tKey(meta.labelKey)}
            {method.maskedPhone && (
              <>
                {" · "}
                {/* A phone number reads left to right in every locale. */}
                <bdi dir="ltr">{method.maskedPhone}</bdi>
              </>
            )}
          </div>
          {!payable(method) && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
              {t("legacyNote")}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {!method.isDefault && (
          <CardAction
            label={t("makeDefault")}
            icon="check"
            disabled={busy}
            onClick={onMakeDefault}
          />
        )}
        <div style={{ flex: 1 }} />
        <CardAction
          label={tCommon("remove")}
          icon="trash-2"
          danger
          disabled={busy}
          onClick={onRemove}
        />
      </div>
    </AccountCard>
  );
}

/**
 * Saving a wallet: a network and a phone number, nothing else.
 *
 * The body is exactly `{ provider, phoneNumber, isDefault? }` — the server
 * writes the label and `last4` itself, and refuses any other key (and `CARD`)
 * with `400`. Every refusal keeps the sheet open with what was typed.
 *
 * The number is checked against the chosen network before sending, by the same
 * prefix rule the server applies (`PAYMENT_PROVIDER_PHONE_MISMATCH`), with a
 * one-tap switch to the network the number is actually on. The server has no
 * duplicate check, so the same network + last four digits already in the list
 * is refused here.
 */
function AddMethodSheet({
  open,
  existing,
  onClose,
  onAdded,
}: {
  open: boolean;
  existing: SavedPaymentMethod[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [provider, setProvider] = useState<SavedWalletProvider>(WALLET_PROVIDERS[0].id);
  const [phone, setPhone] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  /** A refusal to show in the sheet. Cleared by any edit to what caused it. */
  const [problem, setProblem] = useState<string | null>(null);
  /** The server's field message for the number, from a `VALIDATION_ERROR`. */
  const [phoneError, setPhoneError] = useState<string | null>(null);
  /** The server's mismatch verdict, for a prefix this build does not know. */
  const [serverDetected, setServerDetected] = useState<SavedWalletProvider | null>(null);
  const t = useTranslations("shop.paymentMethods");
  const tProvider = useTranslations("shop.payProvider");
  const tCommon = useTranslations("shop.common");
  const tError = useTranslations("errors");

  const e164 = toE164(phone);
  const detected = providerMismatch(provider, phone) ?? serverDetected;
  const duplicate =
    e164 !== null &&
    existing.some((m) => m.provider === provider && m.last4 === e164.slice(-4));
  const valid = isValidPhone(phone) && !detected && !duplicate;

  const choose = (next: SavedWalletProvider) => {
    setProvider(next);
    setServerDetected(null);
    setProblem(null);
  };
  const editPhone = (next: string) => {
    setPhone(next);
    setServerDetected(null);
    setPhoneError(null);
    setProblem(null);
  };

  const save = async () => {
    if (!e164 || !valid) return;
    setSaving(true);
    setProblem(null);
    setPhoneError(null);
    try {
      const created = await addPaymentMethod({
        provider,
        phoneNumber: e164,
        ...(isDefault ? { isDefault: true } : {}),
      });

      /**
       * This is the only moment the app will ever hold this number again.
       *
       * The server stores it and never returns it — reads carry `maskedPhone`
       * and `last4` only — so a checkout that wants to prefill the wallet has
       * nothing to read unless the device writes it down here. Keyed on the id
       * the server just assigned, and verified against `last4` when read back.
       */
      await rememberWalletNumber(created.id, e164);

      setPhone("");
      setIsDefault(false);
      onAdded();
    } catch (err) {
      if (err instanceof ApiError && err.code === "PAYMENT_PROVIDER_PHONE_MISMATCH") {
        const d = (err.details ?? {}) as { detected?: unknown };
        if (d.detected === "MTN" || d.detected === "ORANGE" || d.detected === "MOOV") {
          setServerDetected(d.detected);
          return;
        }
      }
      if (err instanceof ApiError && err.code === "PAYMENT_METHOD_LIMIT_REACHED") {
        setProblem(t("limitReached"));
        return;
      }
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && err.details?.fields?.length) {
        const others: string[] = [];
        for (const f of err.details.fields) {
          if (f.path.includes("phoneNumber")) setPhoneError(t("phoneInvalid"));
          else others.push(translateFieldCode(tError, f.code, f.message));
        }
        setProblem(others.length ? others.join(" ") : null);
        return;
      }
      setProblem(translateError(tError, err, t("saveError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("sheetTitle")}
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {tCommon("cancel")}
          </Button>
          <Button block onClick={() => void save()} disabled={!valid || saving}>
            {saving ? tCommon("saving") : t("saveCta")}
          </Button>
        </div>
      }
    >
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("provider")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {WALLET_PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: 13,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              textAlign: "left",
              background: "var(--surface)",
              border:
                provider === p.id ? "1.5px solid var(--brand)" : "1.5px solid var(--border)",
              boxShadow: provider === p.id ? "var(--focus-ring)" : "none",
            }}
          >
            <Icon
              name="smartphone"
              size={20}
              style={{ color: provider === p.id ? "var(--brand)" : "var(--text-muted)" }}
            />
            <span
              style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)" }}
            >
              {p.brandName}
            </span>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border:
                  provider === p.id ? "6px solid var(--brand)" : "2px solid var(--border-strong)",
              }}
            />
          </button>
        ))}
      </div>

      <PhoneField
        variant="stacked"
        label={t("walletNumber")}
        required
        name="momo-wallet"
        autoComplete="tel"
        value={phone}
        onChange={editPhone}
        hint={t("walletHint")}
        error={phoneError ?? undefined}
      />

      {/* The number is on another network than the chosen one — the server
          refuses exactly this. Said here, with the fix one tap away. */}
      {detected && (
        <div role="alert" style={noteStyle}>
          <Icon name="triangle-alert" size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
          <span style={{ flex: 1 }}>
            {tProvider("mismatch", { detected: NETWORK_NAME[detected], provider: NETWORK_NAME[provider] })}{" "}
            <button type="button" onClick={() => choose(detected)} style={linkButtonStyle}>
              {t("switchTo", { network: NETWORK_NAME[detected] })}
            </button>
          </span>
        </div>
      )}
      {!detected && duplicate && (
        <div role="alert" style={noteStyle}>
          <Icon name="triangle-alert" size={14} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }} />
          <span>{t("duplicate")}</span>
        </div>
      )}
      {problem && (
        <div role="alert" style={noteStyle}>
          <Icon name="triangle-alert" size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
          <span>{problem}</span>
        </div>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "12px 0 0",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-body)",
        }}
      >
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          style={{ width: 17, height: 17, accentColor: "var(--brand)" }}
        />
        {t("useAsDefault")}
      </label>

      <p className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
        {t("cardNote")}
      </p>
    </BottomSheet>
  );
}

const noteStyle = {
  display: "flex",
  gap: 7,
  alignItems: "flex-start",
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "var(--text-body)",
  margin: "10px 0 0",
} as const;

const linkButtonStyle = {
  border: "none",
  background: "none",
  padding: 0,
  color: "var(--brand-hover)",
  fontWeight: 700,
  fontSize: "inherit",
  cursor: "pointer",
  textDecoration: "underline",
} as const;
