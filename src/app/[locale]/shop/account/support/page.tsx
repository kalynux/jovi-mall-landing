"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, EmptyState, Skeleton, Tabs } from "@/components/shop/ds";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import {
  listTickets,
  TICKET_STATUS_LABEL,
  ticketTypeLabel,
  type Ticket,
  type TicketStatus,
} from "@/lib/shop/tickets.api";

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
      <h1 className="sr-only">Support</h1>

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
            { value: "open", label: "Open", count: open.length || undefined },
            { value: "closed", label: "Closed", count: done.length || undefined },
          ]}
        />
        <Button size="sm" leadingIcon="plus" onClick={() => router.push("/shop/account/support/new")}>
          New
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon="life-buoy"
          title={tab === "open" ? "No open tickets" : "Nothing closed yet"}
          description={
            tab === "open"
              ? "If something goes wrong with an order, open a ticket and we will look into it."
              : "Tickets you close will be kept here."
          }
          actionLabel={tab === "open" ? "New ticket" : undefined}
          onAction={tab === "open" ? () => router.push("/shop/account/support/new") : undefined}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((ticket) => (
            <TicketRow
              key={ticket._id}
              ticket={ticket}
              onOpen={() => router.push(`/shop/account/support/${ticket._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const view = TICKET_STATUS_LABEL[ticket.status] ?? { label: ticket.status, tone: "neutral" };

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
        <span className="muted" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {ticket.ticket_number}
        </span>
        <Badge size="sm" tone={view.tone}>
          {view.label}
        </Badge>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
          {new Date(ticket.updatedAt).toLocaleDateString()}
        </span>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{ticket.subject}</div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
        {ticketTypeLabel(ticket.type)}
        {ticket.entity?.label ? ` · ${ticket.entity.label}` : ""}
      </div>
    </button>
  );
}
