"use client";

import type { CSSProperties, ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Icon, type IconName } from "@/components/shop/ds";
import { LegalLink } from "@/components/legal/LegalLink";
import { Link, useRouter } from "@/i18n/navigation";
import {
  protectionViewOf,
  type CustomerProtection,
  type ProblemSubject,
} from "@/lib/shop/protection";
import { reportProblemPath, ticketPath, TICKET_LIST } from "@/lib/shop/shop.routes";
import { listTickets } from "@/lib/shop/tickets.api";
import { useApiResource } from "@/lib/shop/useApiResource";

/** `ORDER` → the `order` copy, `BOOKING` → the `booking` copy. */
const PURCHASE = { ORDER: "order", BOOKING: "booking" } as const;

/**
 * Wi-Mall Protection on a delivered order or a completed booking.
 *
 * One notice, chosen from the record's `protection` block alone
 * (`protectionViewOf`): the deadline while the window is open, "the seller's
 * payment is on hold" once the customer has reported a problem, and the
 * after-protection message when it is over. Before delivery — and for money on
 * hold for a reason that is not the customer's own report — it draws nothing.
 *
 * The deadline is `endsAt`, printed with its time: a window that closes at
 * 09:12 on the 13th is not "the 13th". Nothing here counts days.
 *
 * ⛔ The `ended` copy must never promise a refund. After the window the seller
 * has been paid and Wi-Mall may act only at its own discretion; the button
 * stays, because a request still reaches the seller and support.
 */
export function ProtectionNotice({
  protection,
  about,
  id,
  autoConfirms = false,
  style,
}: {
  protection: CustomerProtection | null | undefined;
  about: ProblemSubject;
  /** The order's or the booking's id — what the request will be about. */
  id: string;
  /**
   * An order nobody has confirmed yet: the end of the window is also when it is
   * confirmed for the customer, so the notice says so.
   */
  autoConfirms?: boolean;
  style?: CSSProperties;
}) {
  const t = useTranslations("shop.protection");
  const format = useFormatter();
  const router = useRouter();
  const view = protectionViewOf(protection);
  if (view.kind === "none") return null;

  const purchase = PURCHASE[about];
  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const report = () => router.push(reportProblemPath(about, id));

  if (view.kind === "on_hold") {
    return (
      <Frame tone="warning" icon="hourglass" label={t("title")} style={style}>
        <p style={BODY}>{t("onHold")}</p>
        <RequestLink about={about} id={id} />
      </Frame>
    );
  }

  if (view.kind === "ended") {
    return (
      <Frame tone="neutral" icon="shield" label={t("title")} style={style}>
        <p style={BODY}>{t(`ended.${purchase}`, { date: date(view.endsAt) })}</p>
        <div style={ACTIONS}>
          <Button variant="secondary" leadingIcon="life-buoy" onClick={report}>
            {t("reportProblem")}
          </Button>
          <PolicyLink>{t("policy")}</PolicyLink>
        </div>
      </Frame>
    );
  }

  return (
    <Frame tone="info" icon="shield-check" label={t("title")} style={style}>
      <p style={BODY}>
        {t.rich(`active.${purchase}`, {
          date: date(view.endsAt),
          b: (chunks) => <strong style={{ color: "var(--text-strong)" }}>{chunks}</strong>,
        })}
      </p>
      {autoConfirms && (
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 0" }}>
          {t("autoConfirm", { date: date(view.endsAt) })}
        </p>
      )}
      <div style={ACTIONS}>
        <Button variant="secondary" leadingIcon="life-buoy" onClick={report}>
          {t("reportProblem")}
        </Button>
        <PolicyLink>{t("policy")}</PolicyLink>
      </div>
    </Frame>
  );
}

/**
 * The way to the request that is holding the payment.
 *
 * `protection` says a problem was reported, not which ticket said it, so the
 * customer's tickets about this record are read and the one carrying
 * `holds_earnings` is linked. Until that answers — or when the report was filed
 * about a parcel, which this filter does not see — the link goes to the list.
 */
function RequestLink({ about, id }: { about: ProblemSubject; id: string }) {
  const t = useTranslations("shop.protection");
  const tickets = useApiResource(
    () => listTickets({ entityType: about, entityId: id, limit: 20 }).catch(() => null),
    [about, id],
  );
  const holding = tickets.data?.data.find((ticket) => ticket.holds_earnings);

  return (
    <Link href={holding ? ticketPath(holding.id) : TICKET_LIST} style={{ ...LINK, marginTop: 8 }}>
      {t("viewRequest")}
      <Icon name="chevron-right" size={14} className="rtl:rotate-180" />
    </Link>
  );
}

function PolicyLink({ children }: { children: ReactNode }) {
  return (
    <LegalLink doc="returns-refunds-policy" style={LINK}>
      {children}
      <Icon name="external-link" size={13} />
    </LegalLink>
  );
}

function Frame({
  tone,
  icon,
  label,
  style,
  children,
}: {
  tone: "info" | "warning" | "neutral";
  icon: IconName;
  label: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const tinted = tone !== "neutral";
  return (
    <section
      aria-label={label}
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        border: `1px solid var(--${tinted ? `${tone}-border` : "border"})`,
        background: tinted ? `var(--${tone}-bg)` : undefined,
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
        ...style,
      }}
    >
      <Icon
        name={icon}
        size={17}
        style={{ color: `var(--${tinted ? tone : "text-muted"})`, flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </section>
  );
}

const BODY: CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  lineHeight: 1.5,
  color: "var(--text-body)",
};

const ACTIONS: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px 14px",
  marginTop: 10,
};

const LINK: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--brand)",
};
