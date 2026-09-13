"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isValidPhone } from "@/lib/phone";
import { listPaymentMethods } from "@/lib/shop/payment-methods.api";
import { readWalletNumber } from "@/lib/shop/wallet-numbers";
import type { SavedPaymentMethod } from "@/lib/shop/customer.types";
import { optionForSavedMethod, type PaymentOption } from "./PaymentMethodPicker";

/**
 * The payment form, with the shopper's saved methods already applied to it.
 *
 * ── Why this owns `option` and `phone` ───────────────────────────────────────
 *
 * Every screen that takes money held those two pieces of state itself and
 * initialised them to "MTN, blank" — which is why a saved method had no way in.
 * Preselecting one is not a matter of reading a list and calling a setter,
 * though: the rail, the number and the picker's own memory of what the shopper
 * has declared all have to land in the same commit, or the picker's operator
 * detection treats the prefill as typing and overrides it. Owning the state is
 * what lets that be guaranteed here once rather than re-derived correctly on
 * three screens.
 *
 * ── The two rules a caller has to honour ─────────────────────────────────────
 *
 *   1. Do not mount the picker until `ready`. A number that appears in the
 *      field *after* the picker mounts arrives as an edit, and the detection
 *      fires on it.
 *   2. Pass `formKey` as the picker's `key`. See its own note below.
 *
 * Both exist for the same underlying reason, and both are cheap.
 */
export interface SavedPayment {
  option: PaymentOption;
  setOption: (option: PaymentOption) => void;
  phone: string;
  setPhone: (phone: string) => void;
  /**
   * The saved methods that map to a rail this screen actually offers, default
   * first. A saved card is not in here on a mobile-money-only screen.
   */
  usable: SavedPaymentMethod[];
  /** The saved method last applied to the form. Sticky — see `usingSaved`. */
  active: SavedPaymentMethod | null;
  /**
   * Whether the form still reflects `active`.
   *
   * Separate from `active` because the two answer different questions. `active`
   * is what the shopper last chose, and must not change while they type — it
   * keys the picker, and a remount mid-number would take the focus with it.
   * `usingSaved` is whether what is on screen is still that method, which goes
   * false the moment they select another rail or type a different wallet.
   */
  usingSaved: boolean;
  /** Switch to a saved method: its rail, and its number where this device knows it. */
  apply: (method: SavedPaymentMethod) => Promise<void>;
  /**
   * The picker's `key`.
   *
   * Remounting on a switch is what re-seeds the picker's "this number was
   * declared, not typed" memory. Without it, applying an Orange wallet that
   * sits on a ported MTN-prefix number sets the Orange rail, then the incoming
   * number trips the detection and moves the selection to MTN — charging the
   * wrong network for a wallet the shopper picked by name.
   *
   * Safe to key on because `active` changes only on an explicit `apply`, never
   * while the shopper is typing, and `apply` batches the rail and the number
   * into one commit so the remount already sees both.
   */
  formKey: string;
  /** False until the saved methods have been read. Gate the picker's mount. */
  ready: boolean;
}

export function useSavedPayment(options: PaymentOption[], enabled = true): SavedPayment {
  const [option, setOption] = useState<PaymentOption>(options[0]);
  const [phone, setPhone] = useState("");
  const [usable, setUsable] = useState<SavedPaymentMethod[]>([]);
  const [active, setActive] = useState<SavedPaymentMethod | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * The rails, read through a ref.
   *
   * A dependency would re-run the fetch every time the caller's list changed
   * identity — checkout's drops cash on delivery once it knows the cart is
   * digital — and none of those changes can alter which saved methods are
   * usable, because no saved method maps to a rail that comes and goes.
   */
  const optionsRef = useRef(options);
  // ⚠ KNOWN EXCEPTION, AND THE RULE IS RIGHT IN PRINCIPLE. Writing a ref during
  //   render is not safe under concurrent rendering. The reason it is here is in the
  //   note above: the hook needs the caller's latest option list WITHOUT making it a
  //   dependency, because checkout's list changes identity for reasons that cannot
  //   affect which saved methods are usable.
  //
  //   Not restructured as part of a lint cleanup, deliberately: this hook decides
  //   which saved payment method a shopper is shown and whether it contradicts what
  //   they typed. That needs its behaviour re-reasoned and exercised against a real
  //   cart — not changed blind on a storefront that is now taking orders.
  // eslint-disable-next-line react-hooks/refs
  optionsRef.current = options;

  /**
   * Once per mount, not once per `enabled`.
   *
   * The pay sheet passes its own `open`, so without this every reopen would
   * re-read the methods and re-apply the default — over the top of a number the
   * shopper had already corrected, and after the picker had mounted, which is
   * exactly the ordering the rest of this file exists to prevent.
   */
  const loaded = useRef(false);

  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;
    let cancelled = false;
    let settled = false;

    void (async () => {
      // An unreadable wallet is a missing convenience, never a blocked payment:
      // the form still works exactly as it did before any of this existed.
      const methods = await listPaymentMethods().catch((): SavedPaymentMethod[] => []);
      if (cancelled) return;

      const rails = optionsRef.current;
      const mine = methods.filter((m) => optionForSavedMethod(m, rails) !== null);
      setUsable(mine);

      /**
       * `is_default` first, then the head of the list.
       *
       * The fallback is not a tie-break, it is the mobile-money-only screens:
       * a shopper whose default is a saved card has no default *here*, and
       * preselecting the one wallet they can actually pay with beats leaving
       * the form on its hardcoded guess. The list arrives default-first, so
       * `[0]` is the best of the rest.
       */
      const preferred = mine.find((m) => m.is_default) ?? mine[0] ?? null;
      const rail = preferred ? optionForSavedMethod(preferred, rails) : null;

      if (preferred && rail) {
        // Resolved before `ready` flips, so the picker's first render already
        // sees the number and reads it as a declaration rather than an edit.
        const number = rail.needsPhone
          ? await readWalletNumber(preferred.id, preferred.last4)
          : null;
        if (cancelled) return;

        setOption(rail);
        setActive(preferred);
        if (number) setPhone(number);
      }

      setReady(true);
      settled = true;
    })();

    return () => {
      cancelled = true;
      // A load cut short does not count as done. Without this, closing the pay
      // sheet while the request was still out would latch `loaded` against a
      // `ready` that never flipped, and every reopen would sit on the skeleton.
      if (!settled) loaded.current = false;
    };
  }, [enabled]);

  const apply = useCallback(async (method: SavedPaymentMethod) => {
    const rail = optionForSavedMethod(method, optionsRef.current);
    if (!rail) return;

    // Awaited before any setState so the rail, the number and the remount land
    // in one commit — see `formKey`. React batches these three together.
    const number = rail.needsPhone ? await readWalletNumber(method.id, method.last4) : null;

    setOption(rail);
    setActive(method);
    // Cleared rather than left alone when this device does not know the number:
    // the previous wallet's digits sitting under a freshly chosen method is the
    // one state that could send a payment to a number nobody selected.
    setPhone(number ?? "");
  }, []);

  /**
   * A *complete* number is what can contradict the active method. An empty or
   * half-typed field is the cross-device case — the rail came from the saved
   * method, the number only ever lived on the handset that saved it — and there
   * the attribution is the most useful thing on screen, because its `••••1234`
   * names the wallet to type.
   */
  const contradicted =
    active !== null &&
    // Same known exception as the ref write above; this is its read side.
    // eslint-disable-next-line react-hooks/refs
    (optionForSavedMethod(active, optionsRef.current)?.id !== option.id ||
      (option.needsPhone &&
        Boolean(active.last4) &&
        isValidPhone(phone) &&
        phone.replace(/\D/g, "").slice(-4) !== active.last4));

  return {
    option,
    setOption,
    phone,
    setPhone,
    usable,
    active,
    usingSaved: active !== null && !contradicted,
    apply,
    formKey: active?.id ?? "none",
    ready,
  };
}
