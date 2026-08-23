"use client";
/**
 * PhoneField — the one phone number input in this application.
 *
 * Country selector at the start of the field, national number after it, and a
 * value that is always international (see src/lib/phone/README.md for the
 * contract). Register, login and checkout all render this; nothing else should
 * collect a phone number.
 *
 * Notes on the two details that are easy to get wrong:
 *
 * **Caret preservation.** The input is controlled *and* reformatted on every
 * keystroke, so naively writing the formatted string back would send the caret
 * to the end whenever someone edits the middle of a number. Positions are
 * therefore tracked as "how many digits precede the caret", which survives
 * regrouping, and restored in a layout effect before paint.
 *
 * **Backspacing a separator.** Deleting the space in "6 70 00" removes no
 * digit, so the reformat immediately puts it back and the key appears dead.
 * When a delete leaves the digit count unchanged, the digit before the caret is
 * removed instead — which is what the user meant.
 */
import {
    forwardRef,
    useCallback,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { cn } from "@/lib/utils";
import {
    buildPhoneValue,
    examplePlaceholder,
    formatNationalFromValue,
    formatNationalInput,
    parsePhoneValue,
    validatePhone,
    type CountryCode,
} from "@/lib/phone";
import { usePreferredCountry } from "@/lib/phone/usePreferredCountry";
import { usePhoneErrorText } from "@/lib/phone/usePhoneErrorText";
import InfoTooltip from "@/components/ui/InfoTooltip";
import CountrySelect from "./CountrySelect";

export interface PhoneFieldProps {
    /** International value — `""` when empty. See src/lib/phone/README.md. */
    value: string;
    /** Receives the international value on every edit. */
    onChange: (value: string) => void;
    onBlur?: () => void;

    label: string;
    /** The field's description, carried behind an info trigger (InfoTooltip). */
    hint?: string;
    /**
     * Error to display. Accepts a `phone.errors.*` code from PhoneSchema or any
     * other message (e.g. a backend field error) — codes are translated, the
     * rest is shown as given.
     */
    error?: string;
    required?: boolean;
    disabled?: boolean;

    name?: string;
    id?: string;
    autoComplete?: string;
    /**
     * Called with the underlying input — pass react-hook-form's `field.ref`
     * here so it can focus the field on a failed submit. A callback rather
     * than a `Ref` object because the field already owns an internal ref and
     * writing through a caller's ref object is not ours to do.
     */
    inputRef?: React.RefCallback<HTMLInputElement>;

    /**
     * "floating" — filled box with the label riding inside it, matching the
     * split login/register screens. "stacked" — label above the field.
     */
    variant?: "floating" | "stacked";
    className?: string;

    /**
     * Overrides the country the field starts on. Defaults to the user's
     * preferred country (profile → last choice → CM).
     */
    defaultCountry?: CountryCode;
    /** Notifies the parent when the selected country changes. */
    onCountryChange?: (country: CountryCode) => void;
}

function countDigits(text: string): number {
    let n = 0;
    for (const ch of text) if (ch >= "0" && ch <= "9") n++;
    return n;
}

/** Index in `text` just after the `count`-th digit. */
function offsetAfterDigits(text: string, count: number): number {
    if (count <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch >= "0" && ch <= "9") {
            seen++;
            if (seen === count) return i + 1;
        }
    }
    return text.length;
}

/** Removes the `index`-th digit (1-based) from a digit string. */
function removeDigitAt(digits: string, index: number): string {
    if (index < 1 || index > digits.length) return digits;
    return digits.slice(0, index - 1) + digits.slice(index);
}

interface PhoneFieldState {
    country: CountryCode;
    /** What the input shows — formatted, and not necessarily just digits. */
    display: string;
    /** The `value` these two correspond to, ours or the parent's. */
    value: string;
}

function deriveState(value: string, fallbackCountry: CountryCode): PhoneFieldState {
    const parts = parsePhoneValue(value, fallbackCountry);
    return {
        country: parts.country,
        display: formatNationalFromValue(parts.national, parts.country),
        value,
    };
}

const PhoneField = forwardRef<HTMLDivElement, PhoneFieldProps>(function PhoneField(
    {
        value,
        onChange,
        onBlur,
        label,
        hint,
        error,
        required,
        disabled,
        name,
        id,
        autoComplete = "tel",
        inputRef,
        variant = "floating",
        className,
        defaultCountry,
        onCountryChange,
    },
    ref
) {
    const translateError = usePhoneErrorText();
    const preferred = usePreferredCountry();

    const initialCountry = defaultCountry ?? preferred.country;

    const [state, setState] = useState<PhoneFieldState>(() =>
        deriveState(value, initialCountry)
    );
    const [touched, setTouched] = useState(false);

    const inputEl = useRef<HTMLInputElement | null>(null);
    /** Digits-before-caret to restore after the next controlled re-render. */
    const pendingCaret = useRef<number | null>(null);

    // ── Adjusting state to props, during render ─────────────────────────────
    // Country and display text are derived from `value`, but they cannot be
    // recomputed from it on every render: `value` carries only digits, while
    // the input has to preserve what the user actually typed (a national
    // prefix, a half-finished group). So they are state that gets *corrected*
    // when the parent hands over a value this field did not produce — a
    // prefill, a form reset. React's documented alternative to a
    // synchronising effect: no wasted commit, no visible flash of stale text.
    //
    // `next` shadows the state for the rest of this render so everything below
    // sees the corrected values immediately.
    let next = state;

    if (value !== next.value) {
        next = deriveState(value, next.country);
        setState(next);
    }

    // The profile country and the remembered choice both resolve after the
    // first paint. Adopting one is only safe while the field is still empty
    // and untouched; otherwise the selector would move out from under someone
    // mid-entry.
    if (
        !defaultCountry &&
        preferred.resolved &&
        !touched &&
        !next.value &&
        next.country !== preferred.country
    ) {
        next = { ...next, country: preferred.country };
        setState(next);
    }

    const { country, display } = next;

    const autoId = useId();
    const fieldId = id ?? name ?? `phone-${autoId}`;
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;

    const isFloating = variant === "floating";

    // ── Emit ────────────────────────────────────────────────────────────────
    // Recording the emitted value in state alongside the display is what makes
    // the render-time correction above a no-op for our own edits.
    const emit = useCallback(
        (nextCountry: CountryCode, national: string, nextDisplay: string) => {
            const nextValue = buildPhoneValue(nextCountry, national);
            setState({ country: nextCountry, display: nextDisplay, value: nextValue });
            onChange(nextValue);
        },
        [onChange]
    );

    // ── Caret restoration ───────────────────────────────────────────────────
    useLayoutEffect(() => {
        const digitsBefore = pendingCaret.current;
        if (digitsBefore === null) return;
        pendingCaret.current = null;

        const el = inputEl.current;
        if (!el || document.activeElement !== el) return;

        const offset = offsetAfterDigits(el.value, digitsBefore);
        el.setSelectionRange(offset, offset);
    }, [display]);

    // ── Typing ──────────────────────────────────────────────────────────────
    const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
        const el = event.target;
        const raw = el.value;
        const caret = el.selectionStart ?? raw.length;
        const inputType = (event.nativeEvent as InputEvent).inputType ?? "";

        let digitsBeforeCaret = countDigits(raw.slice(0, caret));
        let nextRaw = raw;

        // Backspace/delete that only removed a separator: drop the adjacent
        // digit instead, otherwise reformatting reinstates the separator and
        // the keypress looks ignored.
        const isDelete = inputType.startsWith("delete");
        const previousDigits = countDigits(display);
        if (isDelete && countDigits(raw) === previousDigits && previousDigits > 0) {
            const target =
                inputType === "deleteContentForward"
                    ? digitsBeforeCaret + 1
                    : digitsBeforeCaret;
            if (target >= 1 && target <= previousDigits) {
                nextRaw = removeDigitAt(raw.replace(/\D/g, ""), target);
                if (inputType !== "deleteContentForward") {
                    digitsBeforeCaret = Math.max(0, digitsBeforeCaret - 1);
                }
            }
        }

        const result = formatNationalInput(nextRaw, country);
        const nextCountry = result.country ?? country;

        pendingCaret.current = Math.min(
            digitsBeforeCaret,
            countDigits(result.display)
        );
        emit(nextCountry, result.national, result.display);

        if (nextCountry !== country) onCountryChange?.(nextCountry);
    };

    // ── Country change ──────────────────────────────────────────────────────
    // The digits already typed are kept and re-grouped under the new country's
    // conventions — switching country is a correction, not a restart.
    const handleCountryChange = (nextCountry: CountryCode) => {
        const { national } = parsePhoneValue(value, country);
        emit(nextCountry, national, formatNationalFromValue(national, nextCountry));
        preferred.remember(nextCountry);
        onCountryChange?.(nextCountry);
        // Typing continues where the user left off rather than at the selector.
        requestAnimationFrame(() => inputEl.current?.focus());
    };

    const handleBlur = () => {
        setTouched(true);
        onBlur?.();
    };

    // ── Messages ────────────────────────────────────────────────────────────
    // A form-level error always wins. Otherwise the field reports its own
    // verdict, but only once it has been left — flagging "too short" while
    // someone is still on their third digit is noise, not help.
    const liveError = useMemo(() => {
        if (error) return translateError(error);
        if (!touched) return undefined;
        const code = validatePhone(value, { required: Boolean(required) });
        return code ? translateError(code) : undefined;
    }, [error, touched, value, required, translateError]);

    // The hint is in the tooltip bubble, which stays mounted whether or not it
    // is showing, so it can be referenced unconditionally — an error no longer
    // has to displace it, because the two no longer compete for the same line.
    const describedBy =
        [liveError && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

    const messages = liveError && (
        <p
            id={errorId}
            aria-live="polite"
            className="text-xs font-medium text-red-500 transition-opacity duration-150"
        >
            {liveError}
        </p>
    );

    // Only ever one of these renders — the two variants are exclusive branches,
    // so the shared `hintId` is never duplicated in the document.
    const infoTrigger = (align: "start" | "end") =>
        hint ? <InfoTooltip id={hintId} content={hint} align={align} /> : null;

    const requiredMark = required && (
        <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
        </span>
    );

    // The country selector and the number share one bordered box so they read
    // as a single control; the box carries the focus ring for either half.
    const box = cn(
        "flex items-stretch bg-[var(--bg-subtle)] border border-[var(--border)]",
        "transition-all duration-200",
        "hover:border-[var(--border-strong)]",
        "focus-within:border-primary-400 focus-within:bg-[var(--surface)]",
        "focus-within:ring-2 focus-within:ring-primary-500/20",
        isFloating ? "rounded-2xl" : "rounded-xl",
        liveError &&
            "border-red-400 focus-within:border-red-500 focus-within:ring-red-500/20",
        disabled && "cursor-not-allowed opacity-60",
        className
    );

    const input = (
        <input
            ref={(node) => {
                inputEl.current = node;
                inputRef?.(node);
            }}
            id={fieldId}
            name={name}
            // Phone numbers read left-to-right in every locale, Arabic included.
            dir="ltr"
            type="tel"
            inputMode="tel"
            autoComplete={autoComplete}
            disabled={disabled}
            value={display}
            onChange={handleInput}
            onBlur={handleBlur}
            aria-invalid={liveError ? "true" : "false"}
            aria-describedby={describedBy}
            aria-required={required}
            // A non-empty placeholder is what `:placeholder-shown` keys off,
            // so the floating label needs one even when there is no example.
            placeholder={examplePlaceholder(country) || " "}
            className={cn(
                "peer w-full bg-transparent text-sm text-[var(--text-primary)]",
                "outline-none placeholder:text-[var(--text-subtle)]",
                isFloating
                    ? "rounded-e-2xl pb-2 pe-4 pt-6 ps-1 placeholder:opacity-0 focus:placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200"
                    : "rounded-e-xl px-1 py-3",
                // Clear of the info trigger parked at the trailing edge.
                isFloating && hint && "pe-10",
                disabled && "cursor-not-allowed"
            )}
        />
    );

    const selector = (
        <CountrySelect
            value={country}
            onChange={handleCountryChange}
            disabled={disabled}
            describedBy={describedBy}
            // Floating: bottom-aligned so the code shares the number's
            // baseline, clear of the label parked at the top of the box.
            buttonClassName={
                isFloating
                    ? "items-end rounded-s-2xl pb-2 pt-6"
                    : "items-center rounded-s-xl py-3"
            }
        />
    );

    // ── Floating variant ────────────────────────────────────────────────────
    if (isFloating) {
        return (
            <div ref={ref} className="flex flex-col gap-1.5">
                <div className={box}>
                    {selector}
                    <span
                        aria-hidden="true"
                        className="my-2.5 w-px shrink-0 bg-[var(--border)]"
                    />
                    <div className="relative flex-1">
                        {input}
                        <label
                            htmlFor={fieldId}
                            className={cn(
                                "pointer-events-none absolute start-1 top-2 origin-[0_0] text-[11px] font-medium",
                                "text-[var(--text-muted)] transition-all duration-200",
                                "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm",
                                "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-primary-600",
                                liveError && "peer-focus:text-red-500"
                            )}
                        >
                            {label}
                            {requiredMark}
                        </label>
                        {hint && (
                            <span className="absolute inset-y-0 end-0 flex w-10 items-center justify-center">
                                {infoTrigger("end")}
                            </span>
                        )}
                    </div>
                </div>
                {messages}
            </div>
        );
    }

    // ── Stacked variant ─────────────────────────────────────────────────────
    return (
        <div ref={ref} className="flex flex-col gap-1.5">
            {/* Trigger beside the label, not inside it — a button within a
                <label> swallows the click that focuses the field. */}
            <div className="flex items-center gap-1.5">
                <label
                    htmlFor={fieldId}
                    className="text-sm font-medium text-[var(--text-primary)]"
                >
                    {label}
                    {requiredMark}
                </label>
                {infoTrigger("start")}
            </div>
            <div className={box}>
                {selector}
                <span
                    aria-hidden="true"
                    className="my-2 w-px shrink-0 bg-[var(--border)]"
                />
                {input}
            </div>
            {messages}
        </div>
    );
});

export default PhoneField;
