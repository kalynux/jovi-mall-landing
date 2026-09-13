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
import { translateError } from "@/lib/auth/error-translator";
import { isValidPhone, toE164 } from "@/lib/phone";
import { PhoneField } from "@/components/ui/phone";
import {
  addPaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
} from "@/lib/shop/payment-methods.api";
import { forgetWalletNumber, rememberWalletNumber } from "@/lib/shop/wallet-numbers";
import { useApiResource } from "@/lib/shop/useApiResource";
import type { PaymentMethodType, SavedPaymentMethod } from "@/lib/shop/customer.types";

const TYPE_META: Record<PaymentMethodType, { labelKey: string; icon: IconName }> = {
  mobile_money: { labelKey: "shop.paymentMethods.types.mobile_money", icon: "smartphone" },
  card: { labelKey: "shop.paymentMethods.types.card", icon: "credit-card" },
  bank_transfer: { labelKey: "shop.paymentMethods.types.bank_transfer", icon: "landmark" },
};

/**
 * The mobile-money providers the platform's gateways actually settle against.
 *
 * `brandName` is a proper noun, not copy: MTN Mobile Money is called that in
 * every language we ship, and the string is also half of the `display_label`
 * sent to the backend and read back on every later render. Translating it would
 * make the saved label disagree with itself the moment a shopper switched
 * language. Deliberately not in the catalogue — see LOCALISATION.md §6.
 */
const MOMO_PROVIDERS = [
  { id: "mtn_momo", brandName: "MTN Mobile Money" },
  { id: "orange_money", brandName: "Orange Money" },
  { id: "moov_money", brandName: "Moov Money" },
];

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
          label: pendingRemoval?.display_label ?? "",
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
  const meta = TYPE_META[method.method_type] ?? TYPE_META.card;
  const expiry =
    method.exp_month && method.exp_year
      ? t("expires", {
          date: `${String(method.exp_month).padStart(2, "0")}/${String(method.exp_year).slice(-2)}`,
        })
      : null;

  return (
    <AccountCard>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Icon name={meta.icon} size={20} style={{ color: "var(--brand)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>
              {method.display_label}
            </span>
            {method.is_default && (
              <Badge size="sm" tone="brand">
                {t("defaultBadge")}
              </Badge>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
            {[tKey(meta.labelKey), method.brand, expiry].filter(Boolean).join(" · ")}
          </div>
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
        {!method.is_default && (
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
 * Adding a method records **display metadata only**.
 *
 * Tokenization belongs to the gateway, so there is no card-number field here on
 * purpose: a real card is enrolled during a payment, and what is saved is the
 * instrument id the gateway hands back. Mobile money is the case a customer can
 * meaningfully enter themselves — the wallet is the phone number.
 */
function AddMethodSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [provider, setProvider] = useState(MOMO_PROVIDERS[0].id);
  const [phone, setPhone] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const { flashError } = useToast();
  const t = useTranslations("shop.paymentMethods");
  const tCommon = useTranslations("shop.common");
  const tError = useTranslations("errors");

  const valid = isValidPhone(phone);

  const save = async () => {
    const e164 = toE164(phone);
    if (!e164) return;
    setSaving(true);
    try {
      const brandName = MOMO_PROVIDERS.find((p) => p.id === provider)?.brandName ?? "Mobile money";
      const created = await addPaymentMethod({
        provider,
        // The wallet IS the phone number for mobile money: the gateway keys the
        // customer and the instrument on the same E.164 value.
        gateway_customer_id: e164,
        gateway_instrument_id: e164,
        method_type: "mobile_money",
        display_label: `${brandName} · ${e164.slice(-4).padStart(8, "•")}`,
        last4: e164.slice(-4),
        is_default: isDefault,
      });

      /**
       * This is the only moment the app will ever hold this number again.
       *
       * The two `e164` fields above are stored server-side and never returned —
       * so a checkout that wants to prefill the wallet has nothing to read
       * unless the device writes it down here. Keyed on the id the server just
       * assigned, and verified against `last4` when it is read back.
       */
      await rememberWalletNumber(created.id, e164);

      setPhone("");
      setIsDefault(false);
      onAdded();
    } catch (err) {
      flashError(translateError(tError, err, t("saveError")));
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
          <Button block onClick={save} disabled={!valid || saving}>
            {saving ? tCommon("saving") : t("saveCta")}
          </Button>
        </div>
      }
    >
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("provider")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {MOMO_PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
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
        onChange={setPhone}
        hint={t("walletHint")}
      />

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
