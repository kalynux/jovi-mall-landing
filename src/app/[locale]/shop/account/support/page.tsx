"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, EmptyState, Skeleton, Tabs } from "@/components/shop/ds";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import {
  listTickets,
  TICKET_STATUS_LABEL,
  ticketTypeLabelKey,
  type Ticket,
  type TicketStatus,
} from "@/lib/shop/tickets.api";
import { ticketPath } from "@/lib/shop/shop.routes";

/** Open-ish vs done, which is the only split a customer cares about. */
const OPEN_STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "waiting_on_admin",
  "waiting_on_vendor",
  "waiting_on_customer",
  "waiting_on_agency",
  "waiting_on_agent",
];

/**
 * The customer's support tickets.
 *
 * The status enum has nine values and every one of them is meaningful to
 * *staff*; a customer needs to know two things — is this still going, and does
 * anyone need something from me. So the tabs split on the first and
 * `waiting_on_customer` is the one status rendered as a call to action rather
 * than a report.
 *
 * Filtering happens client-side over one page rather than through `?status=`:
 * the endpoint takes a single status, not a set, so an "open" tab would
 * otherwise be seven requests.
 */
export default function SupportPage() {
  const t = useTranslations("shop.support");
  // Root-scoped: the screen title already exists in `shop.nav`, which Phase 1 froze.
  const tKey = useTranslations();
  const router = useRouter();
  const { status: authStatus } = useAuthGuard();
  const [tab, setTab] = useState<"open" | "closed">("open");

  const resource = useApiResource(() => listTickets({ limit: 50 }), [authStatus]);

  if (authStatus === "loading" || resource.status === "loading") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
        <Skeleton height={82} style={{ marginBottom: 10 }} />
        <Skeleton height={82} style={{ marginBottom: 10 }} />
      </div>
    );
  }

  const all = resource.data?.data ?? [];
  const open = all.filter((t) => OPEN_STATUSES.includes(t.status));
  const done = all.filter((t) => !OPEN_STATUSES.includes(t.status));
  const shown = tab === "open" ? open : done;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.support")}</h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as "open" | "closed")}
          tabs={[
            { value: "open", label: t("tabOpen"), count: open.length || undefined },
            { value: "closed", label: t("tabClosed"), count: done.length || undefined },
          ]}
        />
        <Button size="sm" leadingIcon="plus" onClick={() => router.push("/shop/account/support/new")}>
          {t("newTicket")}
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon="life-buoy"
          title={tab === "open" ? t("emptyOpenTitle") : t("emptyClosedTitle")}
          description={
            tab === "open" ? t("emptyOpenDescription") : t("emptyClosedDescription")
          }
          actionLabel={tab === "open" ? tKey("shop.nav.titles.supportNew") : undefined}
          onAction={tab === "open" ? () => router.push("/shop/account/support/new") : undefined}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onOpen={() => router.push(ticketPath(ticket.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();
  const format = useFormatter();
  // A status the map does not know is a backend addition. "Unknown" is a worse
  // answer than the real one and a better one than a raw `waiting_on_x` enum —
  // and unlike the enum it is a string every language has.
  const view = TICKET_STATUS_LABEL[ticket.status] ?? {
    labelKey: "shop.status.unknown",
    tone: "neutral" as const,
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        background: "none",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {/*
            `ticket_number` was rendered here and does not exist — there is no
            such path anywhere in the backend, so this printed "undefined" on
            every row. The ticketing engine identifies a ticket by its id alone,
            so the last six characters are the handle a customer can quote. */}
        <span className="muted" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          #{ticket.id.slice(-6)}
        </span>
        <Badge size="sm" tone={view.tone}>
          {tKey(view.labelKey)}
        </Badge>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
          {format.dateTime(new Date(ticket.updatedAt), {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{ticket.subject}</div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
        {tKey(ticketTypeLabelKey(ticket.type))}
        {ticket.entity?.label ? ` · ${ticket.entity.label}` : ""}
      </div>
    </button>
  );
}
