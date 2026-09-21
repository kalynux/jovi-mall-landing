"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalizedResolver } from "@/lib/auth/useLocalizedResolver";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircle,
  Send,
} from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import { PhoneField } from "@/components/ui/phone";
import { forgotPassword } from "@/lib/auth/auth.api";
import {
  ForgotPasswordSchema,
  type ForgotPasswordFormValues,
  type IdentifierType,
} from "@/lib/auth/auth.schemas";
import { BOT_COMMANDS, buildTelegramUrl, buildWhatsAppUrl } from "@/lib/constants";
import { formatInternational } from "@/lib/phone";

type Step = "form" | "chat" | "sent";

/**
 * Get a password-reset link: from the bot for a phone number, from the API for
 * an email.
 *
 * ── Phone first, and the phone path never calls the API ──────────────────────
 *
 * Phone is the required registration field and email is optional, so a number
 * is what nearly every account can be found by. For a number, the reset is
 * delivered by the Wi-Mall bot: the person sends `/password` on WhatsApp or
 * Telegram and the bot answers in that chat with the same link
 * `POST /auth/forgot-password` would have sent — same token, same lifetime, same
 * single use (jovi-mall `messaging-login/commands/reset-password.command.ts`).
 * So a valid number makes **no request at all**; it moves to a "continue in the
 * chat" step that says what to send, and from where.
 *
 * That is the point rather than a shortcut. The chat is where possession of the
 * number is proved: on WhatsApp the sender id *is* the number, and on Telegram
 * the bot asks for a contact Telegram verified at signup. A form on a web page
 * can prove neither.
 *
 * ── Nothing on either path may reveal whether an account exists ──────────────
 *
 * `POST /auth/forgot-password` always answers 200 precisely so that it cannot be
 * used to discover which emails are registered, and a UI that said "no account
 * found" would hand that back — the enumeration oracle would be here rather than
 * in the API, which is no better. So the email path has one success screen,
 * always, and its copy says "if an account uses that email". Errors that are
 * *not* about the identifier (network, rate limit) still surface, because those
 * are about the request, not about who holds an account.
 *
 * The phone path is uniform by construction: the chat step is built from the
 * number as typed, with nothing fetched behind it, so it reads the same for
 * every valid number. Whatever the bot later says about the account, it says
 * only to someone messaging *from* that number — which is why the backend may be
 * specific there and this page may not.
 *
 * ── No `?start=` payload for Telegram ────────────────────────────────────────
 *
 * `wa.me` pre-fills `/password`. Telegram cannot pre-fill a message, and a
 * `t.me/…?start=password` link would send `/start password`, which the bot's
 * router answers with its generic welcome — `start` takes no argument
 * (jovi-mall `bot-commands/services/command-router.service.ts`). So the link
 * just opens the bot and the command is printed for the person to type.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const [step, setStep] = useState<Step>("form");
  /** The E.164 number the chat step is about. Never sent anywhere. */
  const [chatPhone, setChatPhone] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Which input to focus once it has mounted. Set by the swap and the "edit
   * number" buttons only, so the page does not grab focus on first load.
   */
  const pendingFocus = useRef<IdentifierType | null>(null);
  /** The body of the chat and sent steps, focused when either opens. */
  const stepBody = useRef<HTMLDivElement>(null);

  const {
    control,
    register,
    handleSubmit,
    clearErrors,
    setFocus,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: useLocalizedResolver(zodResolver(ForgotPasswordSchema)),
    defaultValues: { method: "phone", phone: "", email: "" },
  });

  const method = watch("method");

  useEffect(() => {
    if (step !== "form") {
      // The button that was pressed has just unmounted, which drops focus to
      // <body>. Moving it to the new instructions is what lets a screen reader
      // hear them, and puts a keyboard user one Tab from the first link.
      stepBody.current?.focus();
      return;
    }
    const target = pendingFocus.current;
    if (!target || target !== method) return;
    pendingFocus.current = null;
    setFocus(target);
  }, [step, method, setFocus]);

  /**
   * Swap the phone field for the email one, or back.
   *
   * The value of the field being hidden is kept, so going back finds the number
   * still typed. Its errors are not: an error under a field the person has just
   * chosen not to use is noise, and the one being shown starts clean too.
   */
  const switchMethod = (next: IdentifierType) => {
    setValue("method", next);
    clearErrors(["phone", "email"]);
    setFailure(null);
    pendingFocus.current = next;
  };

  /** Back from the chat step to the number, which is still in the form. */
  const editNumber = () => {
    pendingFocus.current = "phone";
    setStep("form");
  };

  const onSubmit = handleSubmit(async (data) => {
    setFailure(null);

    if (data.method === "phone") {
      // Deliberately no request — see the header. `data.phone` is already
      // strict E.164 (ForgotPasswordSchema), which is the form the bot matches
      // a WhatsApp sender against.
      setChatPhone(data.phone);
      setStep("chat");
      return;
    }

    try {
      await forgotPassword(data.email);
      setStep("sent");
    } catch {
      // Deliberately generic, and deliberately NOT "no such account" — the
      // endpoint does not distinguish, and neither may this.
      setFailure(t("failed"));
    }
  });

  // ── Step: the email was accepted ──────────────────────────────────────────
  if (step === "sent") {
    return (
      <AuthCard title={t("sentTitle")}>
        <div
          ref={stepBody}
          tabIndex={-1}
          className="flex flex-col items-center gap-4 py-4 text-center outline-none"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-500" aria-hidden="true" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            {t("sentBody")}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{t("sentHint")}</p>
          <Link
            href="/login"
            className="mt-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
          >
            {t("backToLogin")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  // ── Step: continue in the chat ────────────────────────────────────────────
  if (step === "chat" && chatPhone) {
    // Null when NEXT_PUBLIC_TELEGRAM_BOT_NAME is unset: Telegram is then left
    // out rather than offered as a bot nobody can find.
    const telegramUrl = buildTelegramUrl();

    /**
     * Both values are Latin runs inside what may be an Arabic sentence. `/` is
     * bidi-neutral, so without isolation `/password` renders as `password/` in
     * RTL, and a phone number's spaces are neutral too (the reason `isolateLtr`
     * exists — lib/bidi.ts). `dir="ltr"` on the element isolates it; the string
     * itself stays clean, since these are only ever rendered here.
     */
    const code = (chunks: React.ReactNode) => (
      <code
        dir="ltr"
        className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[var(--text-primary)]"
      >
        {chunks}
      </code>
    );
    const phone = (chunks: React.ReactNode) => (
      <bdi dir="ltr" className="whitespace-nowrap font-semibold text-[var(--text-primary)]">
        {chunks}
      </bdi>
    );

    return (
      <AuthCard title={t("chatTitle")}>
        <div className="flex flex-col gap-6">
          <div
            ref={stepBody}
            tabIndex={-1}
            className="flex flex-col items-center gap-4 text-center outline-none"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wa-soft">
              <MessageCircle className="h-7 w-7 text-wa-dark" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {t.rich("chatBody", {
                command: BOT_COMMANDS.password,
                number: formatInternational(chatPhone),
                code,
                phone,
              })}
            </p>
          </div>

          {/* One block per channel, each carrying the one fact that differs:
              how that bot knows who is writing. */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <a
                href={buildWhatsAppUrl(BOT_COMMANDS.password)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4 flex-none" aria-hidden="true" />
                {t("chatWaCta")}
                <ExternalLink className="h-3.5 w-3.5 flex-none opacity-70" aria-hidden="true" />
              </a>
              <p className="text-center text-xs text-[var(--text-muted)]">{t("chatWaNote")}</p>
            </div>

            {telegramUrl && (
              <div className="flex flex-col gap-2">
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex w-full items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4 flex-none" aria-hidden="true" />
                  {t("chatTgCta")}
                  <ExternalLink className="h-3.5 w-3.5 flex-none opacity-70" aria-hidden="true" />
                </a>
                <p className="text-center text-xs text-[var(--text-muted)]">
                  {t.rich("chatTgNote", { command: BOT_COMMANDS.password, code })}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={editNumber}
              className="flex items-center gap-1.5 rounded text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              {t("editNumber")}
            </button>
            <Link
              href="/login"
              className="text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
            >
              {t("backToLogin")}
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  // ── Step: the form ────────────────────────────────────────────────────────
  const isPhone = method === "phone";

  return (
    <AuthCard title={t("title")} subtitle={isPhone ? t("subtitlePhone") : t("subtitleEmail")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {isPhone ? (
          <Controller
            name="phone"
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
                  clearErrors("phone");
                }}
                onBlur={field.onBlur}
                inputRef={field.ref}
                error={errors.phone?.message}
              />
            )}
          />
        ) : (
          <AuthFormField
            variant="floating"
            id="forgot-password-email"
            label={t("emailLabel")}
            type="email"
            autoComplete="username"
            placeholder={t("emailPlaceholder")}
            required
            {...register("email", {
              onChange: () => {
                clearErrors("email");
                setFailure(null);
              },
            })}
            error={errors.email?.message}
          />
        )}

        {failure && (
          <p className="text-xs text-red-500" role="alert">
            {failure}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("submitting") : isPhone ? t("continue") : t("submit")}
          {!isSubmitting && isPhone && (
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          )}
        </button>
      </form>

      {/* The other way in, as the quiet alternative it is — outside the form
          and `type="button"`, so it can never submit what is half-typed.

          `preventDefault` on mousedown is load-bearing. Without it, pressing
          this with a half-typed number blurs PhoneField first, which shows its
          "too short" line, which moves this centred card down before the
          mouseup — so the release lands off the button and the swap never
          happens (reproduced at 360px). Keeping focus where it is removes the
          shift; the swap then moves focus itself, and keyboard activation was
          never affected. */}
      <div className="mt-5 flex flex-col items-center gap-3">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => switchMethod(isPhone ? "email" : "phone")}
          className="rounded px-2 py-1 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {isPhone ? t("useEmail") : t("usePhone")}
        </button>
        <Link
          href="/login"
          className="text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </AuthCard>
  );
}
