"use client";
import { forwardRef, useState, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import InfoTooltip from "@/components/ui/InfoTooltip";

interface AuthFormFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /**
   * The field's description. Carried behind an info trigger rather than as a
   * standing line under the input — see InfoTooltip for why.
   */
  hint?: string;
  /**
   * "stacked" (default) — label above the input.
   * "floating" — filled field with the label riding inside it, used by the
   * split login/register screens. Same markup contract either way: one input,
   * one <label htmlFor>, the same describedby wiring.
   */
  variant?: "stacked" | "floating";
  /**
   * A labelled action rendered inside the trailing edge of the field, in the
   * same slot the password eye occupies — "Get code" on the sign-in code box.
   *
   * Inside the field rather than beside it because the action *is about this
   * value*: it is how you obtain the thing the input wants. A button on the
   * next line reads as a second, competing submit.
   *
   * Floating variant only, and never together with a password toggle — the two
   * would fight for the same 44px.
   */
  trailingAction?: {
    label: string;
    onClick: () => void;
    /** Reflected as aria-expanded when the action opens a dialog. */
    expanded?: boolean;
  };
}

/**
 * Accessible form field wrapper compatible with react-hook-form's register().
 * Ref-forwarded so the library can focus/track the underlying input.
 *
 * When type="password" is passed, an eye/eye-off toggle is rendered inside
 * the field. The toggle switches the underlying input type between
 * "password" and "text". The wrapper preserves Chrome/Safari autofill
 * behaviour by keeping the input's `autocomplete` attribute and by using a
 * sibling-relative container instead of wrapping with another <input>.
 */
const AuthFormField = forwardRef<HTMLInputElement, AuthFormFieldProps>(
  (
    { label, error, hint, className, id, type, variant = "stacked", trailingAction, ...props },
    ref
  ) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;

    const isPassword = type === "password";
    const isFloating = variant === "floating";
    const [visible, setVisible] = useState(false);

    const toggleVisible = useCallback(() => setVisible((v) => !v), []);

    // Resolved input type: respect toggle only for password fields
    const resolvedType = isPassword ? (visible ? "text" : "password") : type;

    // The hint text now lives in the tooltip bubble, which stays mounted
    // whether or not it is showing — so pointing the input at it here keeps the
    // description available on field focus, not only on the trigger.
    const describedBy =
      [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

    const requiredMark = props.required && (
      <span className="text-red-500 ml-0.5" aria-hidden="true">
        *
      </span>
    );

    const messages = error && (
      <p
        id={errorId}
        aria-live="polite"
        className="text-xs text-red-500 font-medium transition-opacity duration-150"
      >
        {error}
      </p>
    );

    // ── Floating variant ────────────────────────────────────────────────────
    // The label parks at the top of the filled box and drops to the centre
    // while the field is empty and unfocused (:placeholder-shown). That needs a
    // placeholder to match against, so an empty one stands in when the caller
    // gives none — and a real placeholder is held at opacity 0 until focus, so
    // it never sits under the resting label.
    if (isFloating) {
      return (
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <input
              ref={ref}
              id={fieldId}
              type={resolvedType}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={describedBy}
              {...props}
              placeholder={props.placeholder ?? " "}
              className={cn(
                "peer w-full rounded-2xl px-4 pt-6 pb-2 text-sm",
                "bg-[var(--bg-subtle)] border border-[var(--border)]",
                "text-[var(--text-primary)]",
                "placeholder:text-[var(--text-subtle)] placeholder:opacity-0",
                "focus:placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200",
                "outline-none transition-all duration-200",
                "hover:border-[var(--border-strong)]",
                "focus:border-primary-400 focus:bg-[var(--surface)] focus:ring-2 focus:ring-primary-500/20",
                // Room for whichever affordances sit at the trailing edge.
                // The action pill is the widest of them and is measured off its
                // own text, so the reservation is generous rather than exact.
                trailingAction
                  ? "pe-[7.25rem]"
                  : isPassword && hint
                    ? "pe-[5.25rem]"
                    : isPassword
                      ? "pe-11"
                      : hint && "pe-10",
                error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
                className
              )}
            />

            <label
              htmlFor={fieldId}
              className={cn(
                "pointer-events-none absolute start-4 top-2 origin-[0_0] text-[11px] font-medium",
                "text-[var(--text-muted)] transition-all duration-200",
                "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm",
                "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-primary-600",
                error && "peer-focus:text-red-500"
              )}
            >
              {label}
              {requiredMark}
            </label>

            {hint && (
              <span
                className={cn(
                  "absolute inset-y-0 flex w-10 items-center justify-center",
                  // Clears the eye toggle's w-11 when a field carries both.
                  isPassword ? "end-11" : "end-0"
                )}
              >
                <InfoTooltip id={hintId} content={hint} align="end" />
              </span>
            )}

            {trailingAction && (
              <button
                type="button"
                onClick={trailingAction.onClick}
                aria-controls={fieldId}
                aria-haspopup="dialog"
                aria-expanded={trailingAction.expanded}
                className={cn(
                  "absolute end-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5",
                  "bg-[var(--accent-light)] font-display text-xs font-semibold text-primary-600",
                  "transition-colors duration-150 hover:bg-primary-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                )}
              >
                {trailingAction.label}
              </button>
            )}

            {isPassword && (
              <button
                type="button"
                tabIndex={0}
                onClick={toggleVisible}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-controls={fieldId}
                className={cn(
                  "absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-2xl",
                  "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
                )}
              >
                {visible ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            )}
          </div>

          {messages}
        </div>
      );
    }

    // ── Stacked variant (default) ───────────────────────────────────────────
    return (
      <div className="flex flex-col gap-1.5">
        {/* The trigger is a sibling of the <label>, never a child — a button
            inside a label swallows the click that focuses the input. */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-[var(--text-primary)]"
          >
            {label}
            {requiredMark}
          </label>
          {hint && <InfoTooltip id={hintId} content={hint} align="start" />}
        </div>

        {/* Wrapper: relative only when password so the toggle button can be
            positioned inside. Plain div for all other types — autofill
            overlays are unaffected because the input remains a direct child. */}
        <div className={cn(isPassword && "relative")}>
          <input
            ref={ref}
            id={fieldId}
            type={resolvedType}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={describedBy}
            className={cn(
              "w-full px-4 py-3 rounded-xl text-sm",
              "bg-[var(--bg-subtle)] border border-[var(--border)]",
              "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "outline-none transition-all duration-200",
              "focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20",
              // Extra right padding when the toggle button is rendered so text
              // never slides underneath it
              isPassword && "pr-11",
              error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            {...props}
          />

          {/* Eye toggle — only rendered for password fields */}
          {isPassword && (
            <button
              type="button"
              tabIndex={0}
              onClick={toggleVisible}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-controls={fieldId}
              className={cn(
                "absolute inset-y-0 right-0 flex items-center justify-center",
                "w-11 rounded-r-xl",
                "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                "transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
              )}
            >
              {visible ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {messages}
      </div>
    );
  }
);

AuthFormField.displayName = "AuthFormField";

export default AuthFormField;
