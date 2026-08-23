"use client";
/**
 * CustomerWhatsAppCta — the registration branch for a shopper.
 *
 * There is **no customer registration endpoint for a storefront to call**. The
 * account is created on the person's first interaction with the WhatsApp or
 * Telegram bot, so this component's whole job is to get them there
 * (api-doc/auth/customer-auth.md § 1). Building a form here would create
 * accounts whose password nobody can use.
 *
 * Sign-in is a different screen — see CustomerMagicSignIn, which also redeems
 * the code the bot replies with.
 *
 * ── It does not repeat the page heading ──────────────────────────────────────
 *
 * This used to carry its own <h2> and subtitle, which were the SAME two strings
 * the register page passes to AuthSplitShell — so the screen said "Shoppers
 * start in the chat / No form to fill in" twice, once as the page title and
 * again 200px below it. Unnoticed while this was a branch someone had to choose
 * their way into; unmissable now that the app opens straight onto it.
 *
 * The shell owns the heading. This owns the two buttons and the one instruction
 * that goes with them — the same line the sign-in dialog uses, for the same
 * reason: what the bot replies with is the next thing on their screen, so
 * narrating it here is telling someone what they are about to read.
 */
import { MessageCircle, Send, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { BOT_COMMANDS, buildTelegramUrl, buildWhatsAppUrl } from "@/lib/constants";

interface CustomerWhatsAppCtaProps {
  /**
   * Called when the user backs out to the role picker. Omit to hide the control
   * — the app build has no other role to register for.
   */
  onBack?: () => void;
  /** Names what backing out leads to. Defaults to the role picker's wording. */
  backLabel?: string;
}

export default function CustomerWhatsAppCta({ onBack, backLabel }: CustomerWhatsAppCtaProps) {
  const t = useTranslations("auth");

  // `/login` rather than a localised command: the bot matches command strings
  // literally, so a translated one reaches no handler. It is also the command
  // that creates the account — registration happens on first contact.
  const waUrl = buildWhatsAppUrl(BOT_COMMANDS.login);
  const telegramUrl = buildTelegramUrl();

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wa-soft">
        <MessageCircle className="h-8 w-8 text-wa-dark" aria-hidden="true" />
      </div>

      {/* Primary CTA — plus Telegram when a bot name is configured. */}
      <div className="flex w-full flex-col gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex w-full items-center justify-center gap-2"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {t("customerWaCta")}
          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
        </a>

        {telegramUrl && (
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex w-full items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {t("customerSignInTgCta")}
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
          </a>
        )}
      </div>

      {/* Telegram cannot pre-fill a message, so the command has to be readable
          and not merely embedded in a link. */}
      <p className="text-xs text-[var(--text-muted)]">
        {t.rich("customerGetCodeBody", {
          command: BOT_COMMANDS.login,
          code: (chunks) => (
            <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-primary)]">
              {chunks}
            </code>
          ),
          })}
      </p>

      {/* Back */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="rounded text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          ← {backLabel ?? t("customerWaBack")}
        </button>
      )}
    </div>
  );
}
