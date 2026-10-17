"use client";
import { forwardRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";

/**
 * A `.field` password input with a show/hide toggle at its trailing edge.
 *
 * For the screens that lay their own label and messages out around a bare
 * `.field` — reset-password, the account's change-password card. The split
 * login/register screens use AuthFormField, which carries the same toggle.
 *
 * Each field keeps its own toggle: a new password is typed blind, and the
 * person who mistyped one box is the one who needs to look at it without also
 * exposing the other. Ref-forwarded so react-hook-form's `register()` can
 * track the input.
 */
const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">
>(function PasswordInput(props, ref) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {/* `pe-11` keeps a long password from sliding under the toggle. */}
      <input ref={ref} type={visible ? "text" : "password"} className="field pe-11" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-controls={props.id}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-[var(--radius-input)] text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});

export default PasswordInput;
