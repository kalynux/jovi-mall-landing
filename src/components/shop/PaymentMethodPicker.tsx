"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button, Chip, Icon, type IconName } from "@/components/shop/ds";
import { PhoneField } from "@/components/ui/phone";
import { isValidPhone, toE164 } from "@/lib/phone";
import { detectCameroonOperator, providerMismatch } from "@/lib/shop/cm-operator";
import type { SavedPaymentMethod } from "@/lib/shop/customer.types";
import {
  providerForSavedWallet,
  type ChargeRequest,
  type PaymentProvider,
  type PaymentProviderOption,
} from "@/lib/shop/payments.api";
import { NETWORK_NAME } from "./payment-networks";
// Type-only, so the cycle with `useSavedPayment` (which imports
// `optionForSavedMethod` from here) is erased at compile time, not a real one.
import type { SavedPayment } from "./useSavedPayment";

/**
 * Choosing how to pay, in one place.
 *
 * Every screen that takes money renders this: checkout, the order pay sheet,
 * booking pay and booking balance. One copy of the provider mapping, so a
 * provider cannot work on one screen and fail on another.
 *
 * ── The list comes from the server, never from this file ─────────────────────
 *
 * `GET /api/payments/options` says what can be paid with right now (see
 * `usePaymentOptions`), and `optionsFromProviders` turns each entry into a row.
 * This file only knows how to *draw* a provider — its label and artwork — and
 * what the shopper has to type for it. Which providers exist, in what order,
 * and which company carries the money are the server's to decide, and an
 * administrator can change all three with no release. So nothing here names an
 * aggregator, and nothing is shown that `/options` did not list.
 *
 * ── The network is the shopper's; the number is checked against it ──────────
 *
 * See `lib/shop/cm-operator.ts`. The tile is pre-selected from the number as it
 * is typed, and a tile the shopper TAPS is never flipped back. But the server
 * refuses a provider that contradicts the number's prefix, so a contradiction
 * is said here, under the field, and the pay button waits — the same rule the
 * server applies, before the shopper commits rather than after a 422.
 */

export interface PaymentOption {
  id: string;
  /** What is sent as `provider`. Absent only on cash on delivery, which is never charged online. */
  provider?: PaymentProvider;
  /**
   * A **full dotted key** (`shop.payMethods.*`), never a sentence — these are
   * built outside any render, so there is no locale to read when they are.
   * Resolved at the call site with a root-scoped `tKey`, which is what lets a
   * screen outside this file render a row it was handed.
   */
  labelKey: string;
  /** Small print under the label. Kept short — this is a row, not a page. */
  hintKey?: string;
  /** Brand artwork in `public/payment/`, generated from `payment-methods-images/`. */
  logos?: { src: string; alt: string }[];
  /**
   * How the artwork sits. `tile` is a full-bleed brand square (MTN, Orange);
   * `plate` is transparent artwork on a white card, which is what keeps the
   * dark-blue Visa wordmark visible in dark mode.
   */
  art?: "tile" | "plate";
  /** Fallback when there is no artwork — a lucide name. */
  icon?: IconName;
  /** `/options` listed `phoneNumber` in the entry's `fields`. */
  needsPhone: boolean;
  /** `/options` warned that an SMS code may follow. A hint only — the charge's answer decides. */
  mayRequireOtp?: boolean;
  /** Settled at handoff — `initiate` is never called. */
  isCod?: boolean;
}

/** How each provider the server can list is drawn. Presentation only. */
const PRESENTATION: Record<
  PaymentProvider,
  Pick<PaymentOption, "labelKey" | "hintKey" | "logos" | "art" | "icon">
> = {
  MTN: {
    labelKey: "shop.payMethods.mtn",
    logos: [{ src: "/payment/mtn-momo.png", alt: "" }],
    art: "tile",
  },
  ORANGE: {
    labelKey: "shop.payMethods.orange",
    logos: [{ src: "/payment/orange-money.png", alt: "" }],
    art: "tile",
  },
  MOOV: {
    labelKey: "shop.payMethods.moov",
    icon: "smartphone",
  },
  CARD: {
    labelKey: "shop.payMethods.card",
    hintKey: "shop.payMethods.cardHint",
    logos: [
      { src: "/payment/visa.png", alt: "Visa" },
      { src: "/payment/mastercard.png", alt: "Mastercard" },
    ],
    art: "plate",
  },
};

/** The `channel` fields this form knows how to collect. */
const COLLECTABLE = new Set(["phoneNumber"]);

/**
 * The rows for an `/options` answer, in the server's order.
 *
 * An entry that asks for a field this form cannot collect is left out rather
 * than drawn: a row whose charge can only fail `VALIDATION_ERROR` is worse than
 * no row. None does today — mobile money wants `phoneNumber`, a card nothing.
 */
export function optionsFromProviders(entries: PaymentProviderOption[]): PaymentOption[] {
  return entries
    .filter((entry) => entry.fields.every((field) => COLLECTABLE.has(field)))
    .map((entry) => ({
      id: entry.provider.toLowerCase(),
      provider: entry.provider,
      ...PRESENTATION[entry.provider],
      needsPhone: entry.fields.includes("phoneNumber"),
      mayRequireOtp: entry.mayRequireOtp,
    }));
}

export const COD: PaymentOption = {
  id: "cod",
  labelKey: "shop.payMethods.cod",
  hintKey: "shop.payMethods.codHint",
  icon: "banknote",
  needsPhone: false,
  isCod: true,
};

/**
 * The body of a charge for a chosen row: `provider` plus the fields it listed,
 * and nothing else — no `gateway`, no `phoneOperator` (the provider IS the
 * operator), no `cardToken` (a card is confirmed client-side).
 *
 * `toE164` rather than the raw field value: the number is debited as given, and
 * a locally-formatted one is not a number that can be routed to. The fallback
 * keeps a malformed entry going to the server's own validator, which names the
 * field, rather than being silently blanked here.
 *
 * `null` for cash on delivery, which has nothing to charge.
 */
export function chargeRequest(option: PaymentOption, phone: string): ChargeRequest | null {
  if (!option.provider) return null;
  return {
    provider: option.provider,
    channel: option.needsPhone ? { phoneNumber: toE164(phone) ?? phone } : {},
  };
}

/**
 * Whether the row's requirements are met — the gate on any pay button.
 *
 * A number on the wrong network fails it: the server refuses that as
 * `PAYMENT_PROVIDER_PHONE_MISMATCH`, and the picker already says why.
 */
export function paymentReady(option: PaymentOption, phone: string): boolean {
  if (!option.needsPhone) return true;
  return isValidPhone(phone) && providerMismatch(option.provider, phone) === null;
}

/**
 * The row a saved payment method is paid over, if this screen offers it.
 *
 * A saved method and a payment option are not the same kind of thing. The
 * account page saves an *instrument* — this wallet, that card — while the rows
 * here are the *providers* the platform can charge right now. So pre-selecting
 * a saved method means finding its provider, and then checking that `/options`
 * still lists it.
 *
 * The saved `provider` is the charge vocabulary, so the join is direct — but
 * only for a mobile wallet. `null` is a real answer, not a failure: an old
 * saved card or bank transfer, a wallet whose network the server no longer
 * knows (`provider: null`), or one whose provider is switched off. Those stay
 * on the account page, listed and deletable; here the caller leaves its own
 * default selected.
 */
export function optionForSavedMethod(
  method: Pick<SavedPaymentMethod, "kind" | "provider">,
  options: PaymentOption[],
): PaymentOption | null {
  if (method.kind !== "MOBILE_MONEY") return null;

  const provider = providerForSavedWallet(method.provider);
  if (!provider) return null;
  return options.find((o) => o.provider === provider) ?? null;
}

export function PaymentMethodPicker({
  options,
  value,
  onChange,
  phone,
  onPhoneChange,
  disabled,
  saved,
}: {
  options: PaymentOption[];
  value: PaymentOption;
  onChange: (option: PaymentOption) => void;
  phone: string;
  onPhoneChange: (phone: string) => void;
  disabled?: boolean;
  /**
   * The shopper's saved methods, from `useSavedPayment`. Optional: a screen
   * that does not offer them renders exactly what it always did.
   */
  saved?: SavedPayment;
}) {
  const t = useTranslations("shop.payMethods");
  const tProvider = useTranslations("shop.payProvider");
  // Root-scoped: the rows emit absolute keys.
  const tKey = useTranslations();
  const detection = value.needsPhone ? detectCameroonOperator(phone) : { status: "unknown" as const };
  const detected = detection.status === "detected" ? detection.operator : null;
  const mismatch = value.needsPhone ? providerMismatch(value.provider, phone) : null;

  /**
   * Move the selection to the network the number belongs to.
   *
   * Keyed on the detected operator rather than on the phone value, so it fires
   * when the *answer* changes and not on every keystroke. A tile the shopper
   * taps afterwards therefore sticks — and if it contradicts the number, the
   * mismatch line below says so and the pay button waits, which is the server's
   * own rule. Editing the number into a different network re-runs this, and the
   * fresh answer wins.
   */
  const applied = useRef<string | null | undefined>(undefined);
  /**
   * Seeded from the *first* render's detection.
   *
   * A field that already had a number in it when this mounted was not typed
   * here — it came from a saved payment method the shopper picked by name. The
   * mount does not second-guess that choice by switching the row: if the number
   * is on another network, the mismatch line says so and the shopper decides.
   *
   * An empty field seeds `null`, so editing the number afterwards still lets a
   * fresh detection win.
   */
  if (applied.current === undefined) applied.current = detected;
  useEffect(() => {
    if (!detected) {
      // Reset, so re-typing the same network after clearing the field
      // re-selects it rather than being treated as already applied.
      applied.current = null;
      return;
    }
    if (applied.current === detected) return;
    applied.current = detected;

    const match = options.find((o) => o.provider === detected);
    if (match && match.id !== value.id) onChange(match);
  }, [detected, options, value.id, onChange]);

  return (
    <>
      {saved && <SavedMethodBar saved={saved} disabled={disabled} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {options.map((o) => {
          const selected = o.id === value.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 11,
                borderRadius: "var(--radius-md)",
                cursor: disabled ? "default" : "pointer",
                textAlign: "left",
                background: "var(--surface)",
                border: selected ? "1.5px solid var(--brand)" : "1.5px solid var(--border)",
                boxShadow: selected ? "var(--focus-ring)" : "none",
              }}
            >
              <PaymentArt option={o} />

              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: "var(--text-strong)",
                  }}
                >
                  {tKey(o.labelKey)}
                </span>
                {/* "Detected" earns its place: it explains why the selection
                    moved on its own, which is otherwise a control changing
                    under the shopper's hand for no visible reason. */}
                {detected && o.provider === detected ? (
                  <span
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--success)",
                      marginTop: 1,
                    }}
                  >
                    {t("detected")}
                  </span>
                ) : o.hintKey ? (
                  <span className="muted" style={{ display: "block", fontSize: 11.5, marginTop: 1 }}>
                    {tKey(o.hintKey)}
                  </span>
                ) : o.mayRequireOtp ? (
                  <span className="muted" style={{ display: "block", fontSize: 11.5, marginTop: 1 }}>
                    {tProvider("mayNeedCode")}
                  </span>
                ) : null}
              </span>

              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: selected ? "6px solid var(--brand)" : "2px solid var(--border-strong)",
                }}
              />
            </button>
          );
        })}
      </div>

      {value.needsPhone && (
        <div style={{ marginBottom: 20 }}>
          <PhoneField
            variant="stacked"
            label={t("phoneLabel")}
            required
            disabled={disabled}
            name="momo-phone"
            autoComplete="tel"
            value={phone}
            onChange={onPhoneChange}
            hint={t("phoneHint")}
          />

          {/* The number is on another network than the chosen tile. The server
              refuses exactly this (`PAYMENT_PROVIDER_PHONE_MISMATCH`), so it is
              said here and the pay button waits, rather than after a 422. */}
          {mismatch && value.provider && value.provider !== "CARD" && (
            <FieldNote tone="danger">
              {tProvider("mismatch", {
                detected: NETWORK_NAME[mismatch],
                provider: NETWORK_NAME[value.provider],
              })}
            </FieldNote>
          )}

          {/* A complete number the prefix table cannot place — Nexttel, Camtel,
              a ported or foreign number. The server charges it on the network
              the shopper chose, so this is a check-the-number hint, not a
              refusal, and the button stays live. */}
          {!mismatch && detection.status === "unsupported" && value.provider && value.provider !== "CARD" && (
            <FieldNote tone="warning">
              {tProvider("unplacedNumber", { network: NETWORK_NAME[value.provider] })}
            </FieldNote>
          )}
        </div>
      )}
    </>
  );
}

/** One line under the phone field, announced when it appears. */
function FieldNote({ tone, children }: { tone: "danger" | "warning"; children: React.ReactNode }) {
  return (
    <p
      role="alert"
      style={{
        display: "flex",
        gap: 7,
        alignItems: "flex-start",
        fontSize: 12,
        lineHeight: 1.5,
        color: "var(--text-body)",
        margin: "8px 0 0",
      }}
    >
      <Icon
        name="triangle-alert"
        size={14}
        style={{ color: `var(--${tone})`, flexShrink: 0, marginTop: 2 }}
      />
      <span>{children}</span>
    </p>
  );
}

/**
 * Said in place of the rows when `/options` lists nothing: an administrator
 * switched online payment off. Not an error, so there is no retry — only what
 * the shopper can still do, which the caller passes when there is something.
 */
export function OnlinePaymentUnavailable({ withCod }: { withCod?: boolean }) {
  const t = useTranslations("shop.payProvider");
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
        marginBottom: 12,
      }}
    >
      <Icon name="info" size={17} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
        {withCod ? t("onlineUnavailableCod") : t("onlineUnavailable")}
      </p>
    </div>
  );
}

/**
 * `/options` itself did not answer — a dropped connection, not "nothing to pay
 * with". The one state here that earns a retry: an empty list is an answer.
 */
export function OptionsLoadFailed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("shop.payProvider");
  const tCommon = useTranslations("shop.common");
  return (
    <div style={{ textAlign: "center", padding: "12px 0 16px" }}>
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px" }}>
        {t("loadFailed")}
      </p>
      <Button variant="secondary" size="sm" leadingIcon="refresh-cw" onClick={onRetry}>
        {tCommon("retry")}
      </Button>
    </div>
  );
}

/**
 * What the shopper has already saved, above the rails.
 *
 * Two shapes, because one saved method and several are different problems. With
 * one there is nothing to choose, only something to explain — the rail below is
 * preselected and the field may already be filled, and without a word for it
 * that reads as the page having guessed. With several, the explanation matters
 * less than the switch: the labels carry their own `••••1234`, so a chip row
 * says which wallet is being charged more directly than a sentence could.
 *
 * The number hint survives both. It is the cross-device case — the rail came
 * from the saved method, but only the handset that saved the wallet ever knew
 * its number — and there the label is the instruction.
 */
function SavedMethodBar({ saved, disabled }: { saved: SavedPayment; disabled?: boolean }) {
  const t = useTranslations("shop.payMethods");
  const { usable, active, usingSaved, apply, option, phone } = saved;
  if (usable.length === 0 || !active) return null;

  const needsNumber = usingSaved && option?.needsPhone === true && !isValidPhone(phone);
  const many = usable.length > 1;

  return (
    <div style={{ marginBottom: 12 }}>
      {many && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: needsNumber ? 8 : 0 }}>
          {usable.map((m) => (
            <Chip
              key={m.id}
              size="sm"
              icon={m.kind === "CARD" ? "credit-card" : "smartphone"}
              selected={usingSaved && active.id === m.id}
              disabled={disabled}
              onClick={() => void apply(m)}
            >
              {m.label}
            </Chip>
          ))}
        </div>
      )}

      {/* With a chip row above, the plain "using your saved X" only repeats the
          selected chip — so it earns its place solely when it has the number
          instruction to carry. */}
      {usingSaved && (needsNumber || !many) && (
        <p
          className="muted"
          style={{
            display: "flex",
            gap: 7,
            alignItems: "flex-start",
            fontSize: 12.5,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          <Icon
            name="wallet"
            size={14}
            style={{ color: "var(--brand)", flexShrink: 0, marginTop: 2 }}
          />
          <span>
            {needsNumber
              ? t("savedNeedsNumber", { method: active.label })
              : t("savedUsing", { method: active.label })}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * The brand artwork for one option.
 *
 * Two shapes, because the assets are two shapes. MTN and Orange ship as opaque
 * squares with their own background, so they are drawn as an app-icon tile.
 * Visa and Mastercard ship as transparent artwork — and Visa's wordmark is dark
 * navy, so on a dark surface it would be an invisible logo — so those sit on a
 * white plate, which is also how a card reads anyway.
 */
function PaymentArt({ option }: { option: PaymentOption }) {
  const box = {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: "var(--radius-sm)",
  } as const;

  if (!option.logos?.length) {
    return (
      <span
        style={{
          ...box,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-2)",
        }}
      >
        <Icon name={option.icon ?? "wallet"} size={20} style={{ color: "var(--text-muted)" }} />
      </span>
    );
  }

  if (option.art === "plate") {
    return (
      <span
        style={{
          ...box,
          width: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          padding: "0 4px",
          background: "#fff",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {option.logos.map((l) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={l.src}
            src={l.src}
            alt={l.alt}
            style={{ maxWidth: 21, maxHeight: 20, objectFit: "contain" }}
          />
        ))}
      </span>
    );
  }

  const [logo] = option.logos;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.src}
      alt={logo.alt}
      style={{
        ...box,
        objectFit: "cover",
        display: "block",
        // Orange Money's tile is near-black, which is within a shade of the
        // dark-theme card behind it — without an edge the glyph looks like it
        // is floating on the row rather than sitting on its own chip.
        border: "1px solid var(--border-subtle)",
      }}
    />
  );
}
