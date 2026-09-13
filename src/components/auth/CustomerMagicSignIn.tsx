"use client";
/**
 * CustomerMagicSignIn — the customer's whole sign-in, which has no password in
 * it anywhere.
 *
 * A customer account is created with a system-generated password that is hashed
 * and disclosed to nobody, including the customer, so `POST /auth/login` can
 * only ever refuse them (api-doc/auth/customer-auth.md). They send `/login` to
 * the WhatsApp or Telegram bot instead and get **two credentials for one
 * session**:
 *
 *   - a magic LINK, for the phone already in their hand — redeemed by the
 *     `/login/magic` page, not here;
 *   - an 8-character CODE, for the desktop in front of them when WhatsApp is on
 *     a phone across the room — redeemed by the form below.
 *
 * Both expire in 10 minutes, spending either kills the other, and a failed
 * attempt spends the code too — so every refusal here means "send /login
 * again", never "try that again".
 *
 * ── Why the bot buttons are behind a dialog ──────────────────────────────────
 *
 * They used to open the screen: two full-width CTAs, a command hint and an "or"
 * rule, all above the form that actually signs anyone in. That is the wrong
 * order of business for the common case — a returning shopper already has the
 * code in the other app and only wants somewhere to type it. So the form is the
 * screen now, and getting a fresh code is an action *on the code field*: the
 * "Get code" pill inside it opens the two bot links, one row, one instruction.
 */
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalizedResolver } from "@/lib/auth/useLocalizedResolver";
import { MessageCircle, Send, ExternalLink, Loader2, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  MagicCodeSchema,
  type IdentifierType,
  type MagicCodeFormValues,
} from "@/lib/auth/auth.schemas";
import { magicCodeSignIn } from "@/lib/auth/auth.api";
import { mapApiErrors, parseRootType } from "@/lib/auth/form-errors";
import { BOT_COMMANDS, buildTelegramUrl, buildWhatsAppUrl } from "@/lib/constants";
import ResponsiveDialog from "@/components/ui/ResponsiveDialog";
import AuthFormField from "./AuthFormField";
import IdentifierTypeToggle from "./IdentifierTypeToggle";
import { GlobalError } from "./GlobalError";
import { PhoneField } from "@/components/ui/phone";

interface CustomerMagicSignInProps {
  /** Called once the cookies are set. The page decides where to send them. */
  onSignedIn: () => void;
  /**
   * Called when the user backs out to the role picker. Omit to hide the control
   * entirely — the app build has no other role to back out to.
   */
  onBack?: () => void;
  /** Names what backing out leads to. Defaults to the role picker's wording. */
  backLabel?: string;
}

export default function CustomerMagicSignIn({
  onSignedIn,
  onBack,
  backLabel,
}: CustomerMagicSignInProps) {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");

  const waUrl = buildWhatsAppUrl(BOT_COMMANDS.login);
  // Null when NEXT_PUBLIC_TELEGRAM_BOT_NAME is unset. Telegram cannot pre-fill
  // a message anyway, so the command is shown as text either way and an absent
  // link costs the user nothing but a tap.
  const telegramUrl = buildTelegramUrl();

  const [helpOpen, setHelpOpen] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MagicCodeFormValues>({
    resolver: useLocalizedResolver(zodResolver(MagicCodeSchema)),
    defaultValues: { identifier_type: "phone", identifier: "", code: "" },
  });

  const identifierType = watch("identifier_type");

  const clearIdentifierErrors = () => {
    clearErrors("identifier");
    clearErrors("root");
  };

  /** Switching kind clears the value — a phone number is not a draft email. */
  const handleIdentifierType = (next: IdentifierType) => {
    setValue("identifier_type", next);
    setValue("identifier", "");
    clearIdentifierErrors();
  };

  const onSubmit = async (data: MagicCodeFormValues) => {
    clearErrors("root");
    try {
      // The code goes up exactly as typed. The server already forgives case,
      // spacing, dashes, O/0 and I/L; a second opinion here could only disagree
      // with the first (api-doc/auth/magic-login.md).
      await magicCodeSignIn(data.identifier, data.code);
      onSignedIn();
    } catch (err) {
      mapApiErrors(err, setError, tErrors);
    }
  };

  const { errorCode, requestId, category } = parseRootType(
    errors.root?.type as string | undefined
  );

  const botCommandLine = t.rich("customerGetCodeBody", {
    command: BOT_COMMANDS.login,
    code: (chunks) => (
      <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-primary)]">
        {chunks}
      </code>
    ),
  });

  return (
    <div className="flex flex-col gap-5">
      {/* No instruction line here: the page heading carries it, so the form
          starts at the first field rather than at a third sentence. */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <IdentifierTypeToggle
            value={identifierType}
            onChange={handleIdentifierType}
            groupLabel={t("identifierTypeLabel")}
            labels={{
              phone: t("identifierTypePhone"),
              email: t("identifierTypeEmail"),
            }}
          />

          {identifierType === "phone" ? (
            <Controller
              name="identifier"
              control={control}
              render={({ field }) => (
                <PhoneField
                  label={t("phoneLabel")}
                  required
                  autoComplete="username"
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={(next) => {
                    field.onChange(next);
                    clearIdentifierErrors();
                  }}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  error={errors.identifier?.message}
                  hint={t("customerSignInIdentifierHint")}
                />
              )}
            />
          ) : (
            <AuthFormField
              variant="floating"
              label={t("emailLabelLogin")}
              type="email"
              autoComplete="username"
              placeholder={t("emailPlaceholder")}
              required
              hint={t("customerSignInIdentifierHint")}
              {...register("identifier", { onChange: clearIdentifierErrors })}
              error={errors.identifier?.message}
            />
          )}
        </div>

        {/* The code field carries its own way of obtaining a code. The hint
            tooltip that used to sit at this edge is gone with it — the pill
            needs the room, and what the hint said now lives in the dialog. */}
        <AuthFormField
          variant="floating"
          label={t("customerCodeLabel")}
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t("customerCodePlaceholder")}
          required
          maxLength={32}
          className="font-mono tracking-[0.18em]"
          trailingAction={{
            label: t("customerGetCode"),
            onClick: () => setHelpOpen(true),
            expanded: helpOpen,
          }}
          {...register("code", {
            onChange: () => clearErrors(["code", "root"] as never),
          })}
          error={errors.code?.message}
        />

        <GlobalError
          message={errors.root?.message}
          requestId={requestId}
          errorCode={errorCode}
          category={category}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("signingIn") : t("signIn")}
          {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </button>

        {/* Shown once they have actually left for the bot: at that point the
            most likely next problem is a code that has already aged out, and
            the remedy is another `/login`, never a retry of the same one. */}
        {codeSent && (
          <p className="text-center text-xs text-[var(--text-muted)]">
            {t("customerCodeExpiryNote")}
          </p>
        )}
      </form>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-center text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
        >
          {backLabel ?? t("customerWaBack")}
        </button>
      )}

      {/* ── "Get code" ──────────────────────────────────────────────────────
          One instruction, two ways to carry it out, side by side. The dialog
          deliberately does not narrate what comes back: the bot's reply is the
          next thing on their screen, and describing it here would be telling
          someone what they are about to read. */}
      <ResponsiveDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t("customerGetCodeTitle")}
        description={botCommandLine}
      >
        <div className="flex flex-row gap-2">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setCodeSent(true);
              setHelpOpen(false);
            }}
            className="btn-primary flex flex-1 items-center justify-center gap-1.5 px-2 text-sm"
          >
            <MessageCircle className="h-4 w-4 flex-none" aria-hidden="true" />
            {t("customerSignInWaCta")}
            <ExternalLink className="h-3 w-3 flex-none opacity-70" aria-hidden="true" />
          </a>

          {telegramUrl && (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setCodeSent(true);
                setHelpOpen(false);
              }}
              className="btn-secondary flex flex-1 items-center justify-center gap-1.5 px-2 text-sm"
            >
              <Send className="h-4 w-4 flex-none" aria-hidden="true" />
              {t("customerSignInTgCta")}
              <ExternalLink className="h-3 w-3 flex-none opacity-70" aria-hidden="true" />
            </a>
          )}
        </div>
      </ResponsiveDialog>
    </div>
  );
}
