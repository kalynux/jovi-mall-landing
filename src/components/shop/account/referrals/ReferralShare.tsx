"use client";

import { useFormatter, useTranslations } from "next-intl";
import { AccountCard } from "@/components/shop/account/AccountShell";
import { Button, Icon, type IconName } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { copyLink, shareLink } from "@/lib/native/share";
import { openExternal } from "@/lib/native/links";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { shareIntents, type EarningCategory, type ReferralOverview } from "@/lib/me/referral";
import { ReferralHeading } from "./parts";

function useCopy() {
  const t = useTranslations("shop.referrals.share");
  const tCommon = useTranslations("shop.common");
  const { flash, flashError } = useToast();

  return async (value: string) => {
    const outcome = await copyLink(value);
    if (outcome === "copied") flash(tCommon("copied"));
    else flashError(t("copyFailed"));
  };
}

/**
 * One value and its copy button. A code or URL reads left to right in every locale.
 *
 * `valueHidden` is for the chat links, whose percent-encoded text means nothing
 * to read: on a phone it would only push the rest of the page down.
 */
function CopyRow({
  label,
  value,
  strong,
  valueHidden,
}: {
  label: string;
  value: string;
  strong?: boolean;
  valueHidden?: boolean;
}) {
  const tCommon = useTranslations("shop.common");
  const copy = useCopy();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className={valueHidden ? undefined : "muted"}
          style={valueHidden ? { fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)" } : { fontSize: 12 }}
        >
          {label}
        </div>
        {!valueHidden && (
          <bdi
            dir="ltr"
            style={{
              display: "block",
              overflowWrap: "anywhere",
              fontFamily: strong ? "var(--font-mono, monospace)" : undefined,
              fontSize: strong ? 18 : 13,
              fontWeight: strong ? 800 : 500,
              letterSpacing: strong ? "0.04em" : undefined,
              color: "var(--text-strong)",
              marginTop: 2,
            }}
          >
            {value}
          </bdi>
        )}
      </div>
      <Button size="sm" variant="secondary" leadingIcon="copy" onClick={() => void copy(value)}>
        {tCommon("copy")}
      </Button>
    </div>
  );
}

/** Opens in the system browser in the app: a wa.me link inside the WebView is a dead end. */
function IntentLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={
        IS_NATIVE_BUILD
          ? (e) => {
              e.preventDefault();
              void openExternal(href);
            }
          : undefined
      }
      style={{
        flex: "1 1 130px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        minHeight: 40,
        padding: "8px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        fontSize: 13.5,
        fontWeight: 700,
        color: "var(--text-strong)",
        textDecoration: "none",
      }}
    >
      <Icon name={icon} size={16} />
      {label}
    </a>
  );
}

/**
 * An active partner's link.
 *
 * `registerUrl` is the one to send: it opens `/register`, which routes each role.
 * The chat links are copy-only, because tapping one would open the bot as the
 * partner rather than as the person being invited.
 */
export function ReferralShare({ overview: o }: { overview: ReferralOverview }) {
  const t = useTranslations("shop.referrals.share");
  const tCommon = useTranslations("shop.common");
  const { flash, flashError } = useToast();
  const links = o.links;
  if (!links) return null;

  const url = links.registerUrl;
  const message = t("message");
  const intents = url ? shareIntents(url, message) : null;

  const share = async () => {
    if (!url) return;
    const outcome = await shareLink({ title: t("nativeTitle"), text: message, url, dialogTitle: t("nativeTitle") });
    if (outcome === "copied") flash(tCommon("copied"));
    else if (outcome === "failed") flashError(t("copyFailed"));
  };

  return (
    <AccountCard>
      <ReferralHeading>{t("title")}</ReferralHeading>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {o.code && <CopyRow label={t("code")} value={o.code} strong />}
        {url && <CopyRow label={t("link")} value={url} />}

        {intents && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <IntentLink href={intents.whatsapp} icon="message-circle" label={t("whatsapp")} />
            <IntentLink href={intents.telegram} icon="send" label={t("telegram")} />
            {IS_NATIVE_BUILD && (
              <Button variant="secondary" leadingIcon="share-2" onClick={() => void share()} style={{ flex: "1 1 130px" }}>
                {tCommon("share")}
              </Button>
            )}
          </div>
        )}

        {(links.whatsappUrl || links.telegramUrl) && (
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>{t("chatTitle")}</p>
            <p className="muted" style={{ margin: "3px 0 10px", fontSize: 12.5, lineHeight: 1.5 }}>
              {t("chatBody")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {links.whatsappUrl && <CopyRow label={t("whatsappLink")} value={links.whatsappUrl} valueHidden />}
              {links.telegramUrl && <CopyRow label={t("telegramLink")} value={links.telegramUrl} valueHidden />}
            </div>
          </div>
        )}
      </div>
    </AccountCard>
  );
}

/** A former partner's code: still shown, with nothing offering to share it. */
export function ReferralCodeCard({ overview: o }: { overview: ReferralOverview }) {
  const t = useTranslations("shop.referrals.share");

  return (
    <AccountCard>
      <div className="muted" style={{ fontSize: 12 }}>
        {t("code")}
      </div>
      <bdi
        dir="ltr"
        style={{
          display: "block",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text-muted)",
          marginTop: 2,
          overflowWrap: "anywhere",
        }}
      >
        {o.code}
      </bdi>
      {o.links?.registerUrl && (
        <bdi
          dir="ltr"
          className="muted"
          style={{ display: "block", fontSize: 12.5, marginTop: 4, overflowWrap: "anywhere" }}
        >
          {o.links.registerUrl}
        </bdi>
      )}
    </AccountCard>
  );
}

const TERM_CATEGORIES: EarningCategory[] = ["vendor", "provider", "customer", "agency"];

/** This partner's own terms, which can differ from anyone else's. */
export function ReferralTerms({ overview: o }: { overview: ReferralOverview }) {
  const t = useTranslations("shop.referrals.terms");
  const format = useFormatter();

  return (
    <AccountCard>
      <ReferralHeading>{t("title")}</ReferralHeading>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TERM_CATEGORIES.flatMap((category) => {
          const term = o.terms?.[category];
          if (!term) return [];
          return [
            <div
              key={category}
              style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "2px 12px", fontSize: 13.5 }}
            >
              <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{t(category)}</span>
              <span className="muted">
                {/* A provider pays for plans and credits, not commission. */}
                {t(category === "provider" ? "lineProvider" : "line", {
                  rate: format.number(term.ratePercent / 100, { style: "percent", maximumFractionDigits: 2 }),
                  months: term.durationMonths,
                })}
              </span>
            </div>,
          ];
        })}
      </div>
    </AccountCard>
  );
}
