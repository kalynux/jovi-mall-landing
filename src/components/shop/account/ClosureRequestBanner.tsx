"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon } from "@/components/shop/ds";
import { useApiResource } from "@/lib/shop/useApiResource";
import { CLOSURE_REQUEST_PATH } from "@/lib/shop/shop.routes";
import { getClosureRequest, type ClosureRequest } from "@/lib/shop/closure-request.api";

/**
 * The account hub's notice that an administrator has asked to close this
 * shopping account (ADR-A10) — optional per the storefront changelog, and the
 * one door to `/shop/account/closure` that does not depend on the shopper
 * having seen the notification.
 *
 * Silent on every outcome but one. "Nothing waiting" is the normal answer and
 * renders nothing; so does a failed read, because this is a courtesy on a page
 * whose own content must not be held hostage to it — the notification, the
 * push and the chat message all still reach the person.
 */
export function ClosureRequestBanner() {
  const t = useTranslations("shop.closureRequest.banner");
  const format = useFormatter();
  const { data } = useApiResource<ClosureRequest | null>(() => getClosureRequest());

  if (!data || data.status !== "pending") return null;

  return (
    <Link
      href={CLOSURE_REQUEST_PATH}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 14,
        marginBottom: 16,
        border: "1px solid var(--danger-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--danger-bg)",
        textDecoration: "none",
      }}
    >
      <Icon name="triangle-alert" size={20} style={{ color: "var(--danger)", flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>
          {t("title")}
        </span>
        <span style={{ display: "block", fontSize: 13, lineHeight: 1.45, color: "var(--text-body)", marginTop: 3 }}>
          {t("body", {
            date: format.dateTime(new Date(data.expiresAt), { dateStyle: "long", timeStyle: "short" }),
          })}
        </span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--danger)", marginTop: 6 }}>
          {t("action")}
        </span>
      </span>
      <Icon name="chevron-right" size={17} style={{ color: "var(--text-subtle)", flexShrink: 0, marginTop: 2 }} />
    </Link>
  );
}
