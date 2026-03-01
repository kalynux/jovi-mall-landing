"use client";
import { forwardRef, useState, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthFormFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
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
  ({ label, error, hint, className, id, type, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
    const errorId = `${fieldId}-error`;
    const hintId = `${fieldId}-hint`;

    const isPassword = type === "password";
    const [visible, setVisible] = useState(false);

    const toggleVisible = useCallback(() => setVisible((v) => !v), []);

    // Resolved input type: respect toggle only for password fields
    const resolvedType = isPassword ? (visible ? "text" : "password") : type;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-[var(--text-primary)]"
        >
          {label}
          {props.required && (
            <span className="text-red-500 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>

        {/* Wrapper: relative only when password so the toggle button can be
            positioned inside. Plain div for all other types — autofill
            overlays are unaffected because the input remains a direct child. */}
        <div className={cn(isPassword && "relative")}>
          <input
            ref={ref}
            id={fieldId}
            type={resolvedType}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={
              [error && errorId, hint && hintId].filter(Boolean).join(" ") ||
              undefined
            }
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

        {hint && !error && (
          <p id={hintId} className="text-xs text-[var(--text-muted)]">
            {hint}
          </p>
        )}

        {error && (
          <p
            id={errorId}
            aria-live="polite"
            className="text-xs text-red-500 font-medium transition-opacity duration-150"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

AuthFormField.displayName = "AuthFormField";

export default AuthFormField;
