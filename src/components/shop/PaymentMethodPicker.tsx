"use client";

import { useEffect, useRef } from "react";
import { Chip, Icon } from "@/components/shop/ds";
import { PhoneField } from "@/components/ui/phone";
import { isValidPhone, toE164 } from "@/lib/phone";
import { detectCameroonOperator } from "@/lib/shop/cm-operator";
import type { SavedPaymentMethod } from "@/lib/shop/customer.types";
import type { PaymentChannel, PaymentGateway, PhoneOperator } from "@/lib/shop/payments.api";
// Type-only, so the cycle with `useSavedPayment` (which imports
// `optionForSavedMethod` from here) is erased at compile time, not a real one.
import type { SavedPayment } from "./useSavedPayment";

/**
 * Choosing how to pay, in one place.
 *
 * This lived inside the checkout page, which was fine while checkout was the
 * only screen that took money. It is not: an order left at `AWAITING_PAYMENT`
 * is paid from its detail screen, through the same gateways, with the same
 * operator mapping. Two copies of that mapping is the kind of duplication that
 * drifts silently — a gateway added to one list and not the other is a payment
 * option that works on one screen and 400s on the other.
 *
 * ── The gateway is ours, and is never a question ─────────────────────────────
 *
 * `POST /api/payments/initiate` requires a `gateway`, and there is no server
 * default — `getPaymentGateway()` throws `400 PAYMENT_GATEWAY_NOT_SUPPORTED`
 * for anything outside the three it knows. So the storefront must send one, and
 * it always sends **NOTCHPAY** for mobile money. That is a merchant decision,
 * not a shopper one: a customer has no way to know what NotchPay or My-CoolPay
 * are, and picking between them is picking between two of our own contracts.
 * It is on the option below and on no screen.
 *
 * My-CoolPay stays in the type union because the backend implements it and it
 * is one edit away, but note it is **not a drop-in swap**: its Orange Money flow
 * answers `REQUIRE_OTP`, which needs a code screen and
 * `POST /payments/:id/authorize`, and neither exists here yet.
 *
 * ── The operator is the shopper's, and is derived, not asked ─────────────────
 *
 * See `lib/shop/cm-operator.ts`. NotchPay needs an explicit `cm.mtn`/`cm.orange`
 * and the backend lets a *declared* operator override what the number says — so
 * the tile is selected from the number as it is typed rather than left to a tap
 * that can contradict it. Overriding is still possible, because Cameroon has
 * number portability and the shopper knows their own account.
 */

export interface PaymentOption {
  id: string;
  label: string;
  /** Small print under the label. Kept short — this is a row, not a page. */
  hint?: string;
  /** Brand artwork in `public/payment/`, generated from `payment-methods-images/`. */
  logos?: { src: string; alt: string }[];
  /**
   * How the artwork sits. `tile` is a full-bleed brand square (MTN, Orange);
   * `plate` is transparent artwork on a white card, which is what keeps the
   * dark-blue Visa wordmark visible in dark mode.
   */
  art?: "tile" | "plate";
  /** Fallback when there is no artwork — a lucide name. */
  icon?: string;
  gateway: PaymentGateway;
  /** What tells the gateway which prompt to send. Mobile money only. */
  operator?: PhoneOperator;
  needsPhone: boolean;
  /** Settled at handoff, not through a gateway — `initiate` is never called. */
  isCod?: boolean;
}

export const MTN: PaymentOption = {
  id: "mtn",
  label: "MTN Mobile Money",
  logos: [{ src: "/payment/mtn-momo.png", alt: "" }],
  art: "tile",
  gateway: "NOTCHPAY",
  operator: "MTN",
  needsPhone: true,
};

export const ORANGE: PaymentOption = {
  id: "orange",
  label: "Orange Money",
  logos: [{ src: "/payment/orange-money.png", alt: "" }],
  art: "tile",
  gateway: "NOTCHPAY",
  operator: "ORANGE",
  needsPhone: true,
};

export const CARD: PaymentOption = {
  id: "card",
  label: "Card",
  hint: "Visa or Mastercard",
  logos: [
    { src: "/payment/visa.png", alt: "Visa" },
    { src: "/payment/mastercard.png", alt: "Mastercard" },
  ],
  art: "plate",
  gateway: "STRIPE",
  needsPhone: false,
};

export const COD: PaymentOption = {
  id: "cod",
  label: "Cash on delivery",
  hint: "Pay the courier when your parcel arrives",
  icon: "banknote",
  gateway: "NOTCHPAY",
  needsPhone: false,
  isCod: true,
};

/** The two mobile-money rails, which are the only ones proven end to end. */
export const MOBILE_MONEY_OPTIONS: PaymentOption[] = [MTN, ORANGE];

/** Everything checkout offers, in the order checkout has always offered it. */
export const CHECKOUT_OPTIONS: PaymentOption[] = [MTN, ORANGE, CARD, COD];

/**
 * The `channel` for a chosen option.
 *
 * `toE164` rather than the raw field value: the gateway debits the number it is
 * given, and a locally-formatted one is not a number it can route to. The
 * fallback keeps a malformed entry going to the server's own validator, which
 * names the field, rather than being silently blanked here.
 */
export function paymentChannel(option: PaymentOption, phone: string): PaymentChannel {
  if (!option.needsPhone) return {};
  return { phoneNumber: toE164(phone) ?? phone, phoneOperator: option.operator };
}

/** Whether the option's requirements are met — the gate on any pay button. */
export function paymentReady(option: PaymentOption, phone: string): boolean {
  return !option.needsPhone || isValidPhone(phone);
}

/**
 * The rail a saved payment method is paid over, if this screen offers it.
 *
 * A saved method and a payment option are not the same kind of thing. The
 * account page saves an *instrument* — this wallet, that card — while the rows
 * here are the *rails* the platform can charge over. So preselecting a saved
 * method means finding its rail, and the join has to be done on two fields
 * because two writers populate them differently:
 *
 *   - `brand` is what `customer/payment-methods.md` documents for a method
 *     enrolled through a gateway (`MTN`, `ORANGE`, `visa`).
 *   - `provider` is what the account page's own add form writes
 *     (`mtn_momo`, `orange_money`, `moov_money`), leaving `brand` null.
 *
 * `null` is a real answer, not a failure: a `bank_transfer` method, or a Moov
 * wallet — which the add form offers because the operator exists and
 * `PhoneOperator` names it, but which neither gateway is wired to charge — has
 * no row here. The caller leaves its own default selected rather than
 * preselecting a rail the shopper cannot pay on.
 */
export function optionForSavedMethod(
  method: Pick<SavedPaymentMethod, "method_type" | "provider" | "brand">,
  options: PaymentOption[],
): PaymentOption | null {
  if (method.method_type === "card") {
    return options.find((o) => !o.needsPhone && !o.isCod) ?? null;
  }
  if (method.method_type !== "mobile_money") return null;

  // `brand` first and `provider` only as a fallback, rather than matching
  // against the two concatenated: they can disagree, and when they do the
  // gateway's own `brand` is the field that describes the instrument it will
  // actually charge. Concatenating would let whichever operator was tested
  // first win an argument it has no business winning.
  const operator = operatorNamedBy(method.brand) ?? operatorNamedBy(method.provider);
  if (!operator) return null;

  return options.find((o) => o.operator === operator) ?? null;
}

/** The operator a `brand` or `provider` string names, if it names one. */
function operatorNamedBy(value: string | null | undefined): PhoneOperator | null {
  const text = (value ?? "").toUpperCase();
  if (!text) return null;
  // Substring rather than equality because the same operator arrives spelt
  // three ways across the two writers — `MTN`, `mtn_momo`, `MTN Mobile Money`.
  const match = (["MTN", "ORANGE", "MOOV"] as const).find((o) => text.includes(o));
  return match ?? null;
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
  const detection = value.needsPhone ? detectCameroonOperator(phone) : { status: "unknown" as const };
  const detected = detection.status === "detected" ? detection.operator : null;

  /**
   * Move the selection to the network the number belongs to.
   *
   * Keyed on the detected operator rather than on the phone value, so it fires
   * when the *answer* changes and not on every keystroke. That is what leaves
   * room for an override: tapping MTN on an Orange number sticks, because the
   * detection has not changed — right up until the shopper edits the number
   * into a different network, at which point a stale override is exactly the
   * bug this exists to prevent, and the fresh answer wins.
   */
  const applied = useRef<string | null | undefined>(undefined);
  /**
   * Seeded from the *first* render's detection, which is what makes a prefilled
   * number safe.
   *
   * A field that already had a number in it when this mounted was not typed
   * here — it came from a saved payment method, whose network the shopper
   * declared themselves when they saved it. Cameroon has number portability, so
   * an Orange wallet on an MTN-prefix number is a real account, and without this
   * the mount would read the prefix, decide "MTN", and switch the row out from
   * under a selection that was already correct.
   *
   * An empty field seeds `null` — identical to the old starting state, so a
   * checkout with nothing saved behaves exactly as it always has, and editing
   * the number afterwards still lets a fresh detection win.
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

    const match = options.find((o) => o.operator === detected);
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
                  {o.label}
                </span>
                {/* "Detected" earns its place: it explains why the selection
                    moved on its own, which is otherwise a control changing
                    under the shopper's hand for no visible reason. */}
                {detected && o.operator === detected ? (
                  <span
                    style={{
                      display: "block",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--success)",
                      marginTop: 1,
                    }}
                  >
                    Detected from your number
                  </span>
                ) : o.hint ? (
                  <span className="muted" style={{ display: "block", fontSize: 11.5, marginTop: 1 }}>
                    {o.hint}
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
            label="Mobile money number"
            required
            disabled={disabled}
            name="momo-phone"
            autoComplete="tel"
            value={phone}
            onChange={onPhoneChange}
            hint="The number the payment prompt will be sent to."
          />

          {/* A complete number on a network neither gateway can charge. Said
              here, before the pay button, because the alternative is a 422 the
              shopper reads as "payment declined" — and the fix (use an MTN or
              Orange number) is not something they could guess from that. */}
          {detection.status === "unsupported" && (
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
                style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }}
              />
              <span>
                Mobile money works on MTN and Orange numbers in Cameroon. Check the number, or
                choose your network above if it has been ported.
              </span>
            </p>
          )}
        </div>
      )}
    </>
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
  const { usable, active, usingSaved, apply, option, phone } = saved;
  if (usable.length === 0 || !active) return null;

  const needsNumber = usingSaved && option.needsPhone && !isValidPhone(phone);
  const many = usable.length > 1;

  return (
    <div style={{ marginBottom: 12 }}>
      {many && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: needsNumber ? 8 : 0 }}>
          {usable.map((m) => (
            <Chip
              key={m.id}
              size="sm"
              icon={m.method_type === "card" ? "credit-card" : "smartphone"}
              selected={usingSaved && active.id === m.id}
              disabled={disabled}
              onClick={() => void apply(m)}
            >
              {m.display_label}
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
              ? `Enter the number for your saved ${active.display_label} below.`
              : `Using your saved ${active.display_label}.`}
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
