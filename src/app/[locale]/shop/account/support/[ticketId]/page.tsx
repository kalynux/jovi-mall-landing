"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Avatar, Badge, Button, ConfirmDialog, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { uploadAttachments, maxBytesFor, uploadViolations } from "@/lib/shop/files.api";
import {
  addTicketNote,
  attachToTicket,
  closeTicket,
  getTicket,
  listTicketAttachments,
  listTicketNotes,
  MAX_TICKET_ATTACHMENTS,
  TICKET_STATUS_LABEL,
  ticketTypeLabel,
  type TicketAttachment,
  type TicketNote,
} from "@/lib/shop/tickets.api";
import { publicUrl } from "@/lib/shop/shop.types";

/**
 * One support ticket: the conversation, its attachments, and the two actions a
 * customer has.
 *
 * ── What a customer cannot do here, and why it is absent rather than disabled ─
 *
 * No reassignment and no priority control — those endpoints do not exist on the
 * customer namespace at all. No internal notes either: a customer note is always
 * public and the server rejects anything else, so there is no visibility control
 * to render.
 *
 * Status is likewise not a free choice. A `waiting_on_<role>` value is only
 * accepted when a participant with that role is on the ticket, and an unchanged
 * status is a `400`, so the only transition offered is closing.
 */
export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = use(params);
  const router = useRouter();
  const { flash } = useToast();
  const { status: authStatus } = useAuthGuard();

  const ticket = useApiResource(() => getTicket(ticketId), [ticketId, authStatus]);
  const notes = useApiResource(() => listTicketNotes(ticketId), [ticketId, authStatus]);
  const attachments = useApiResource(
    () => listTicketAttachments(ticketId),
    [ticketId, authStatus],
  );

  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const send = useCallback(async () => {
    const content = reply.trim();
    if (!content) return;
    setBusy(true);
    try {
      await addTicketNote(ticketId, content);
      setReply("");
      notes.reload();
      // The reply may have moved the ticket off `waiting_on_customer`.
      ticket.reload();
    } catch {
      flash("Could not send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [reply, ticketId, notes, ticket, flash]);

  const attach = useCallback(
    async (files: File[]) => {
      const current = attachments.data?.length ?? 0;
      const room = MAX_TICKET_ATTACHMENTS - current;
      if (room <= 0) {
        flash(`A ticket can hold ${MAX_TICKET_ATTACHMENTS} attachments.`);
        return;
      }

      const tooBig = files.find((f) => f.size > maxBytesFor(f));
      if (tooBig) {
        flash(`${tooBig.name} is too large.`);
        return;
      }

      setBusy(true);
      try {
        // Two steps by design: the bytes go to the shared file service, and only
        // the returned id is attached to the ticket.
        const uploaded = await uploadAttachments(files.slice(0, room));
        for (const file of uploaded) await attachToTicket(ticketId, file.id);
        attachments.reload();
      } catch (err) {
        // Name the offending file rather than the batch — the same reason the
        // create form does.
        const violations = uploadViolations(err);
        flash(
          violations.length > 0
            ? violations
                .map((v) => `${v.fileName ?? "That file"}: ${v.message ?? v.code}`)
                .join(" · ")
            : "Could not attach that file.",
        );
      } finally {
        setBusy(false);
      }
    },
    [attachments, ticketId, flash],
  );

  const close = useCallback(async () => {
    setConfirmClose(false);
    setBusy(true);
    try {
      await closeTicket(ticketId);
      ticket.reload();
    } catch {
      flash("Could not close that ticket.");
    } finally {
      setBusy(false);
    }
  }, [ticketId, ticket, flash]);

  if (authStatus === "loading" || ticket.status === "loading") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
        <Skeleton height={120} style={{ marginBottom: 12 }} />
        <Skeleton height={200} />
      </div>
    );
  }

  const t = ticket.data;
  if (!t) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
        <p className="muted">That ticket could not be found.</p>
        <Button variant="secondary" size="sm" onClick={() => router.push("/shop/account/support")}>
          Back to support
        </Button>
      </div>
    );
  }

  const view = TICKET_STATUS_LABEL[t.status] ?? { label: t.status, tone: "neutral" as const };
  const isClosed = t.status === "closed" || t.status === "resolved";

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{t.subject}</h1>

      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="muted" style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
            {t.ticket_number}
          </span>
          <Badge size="sm" tone={view.tone}>
            {view.label}
          </Badge>
        </div>

        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em" }}>{t.subject}</div>

        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {ticketTypeLabel(t.type)}
          {t.entity?.label ? ` · ${t.entity.label}` : ""}
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 10 }}>{t.description}</p>

        {/* `assigned_admin` is null on almost every ticket, because support
            administrators live in a separate service and nobody is assigned by
            default. `avatar_url` is reserved and always null, so the initials
            come from the name. */}
        {t.assigned_admin && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <Avatar name={t.assigned_admin.name} size={26} />
            <span style={{ fontSize: 13 }}>
              {t.assigned_admin.name}
              {t.assigned_admin.job_title && (
                <span className="muted"> · {t.assigned_admin.job_title}</span>
              )}
            </span>
          </div>
        )}
      </header>

      <Attachments
        items={attachments.data ?? []}
        busy={busy}
        disabled={isClosed}
        onPick={attach}
      />

      <Conversation notes={notes.data ?? []} />

      {isClosed ? (
        <p className="muted" style={{ fontSize: 13.5, marginTop: 16 }}>
          This ticket is {view.label.toLowerCase()}. Open a new one if you still need help.
        </p>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            className="input"
            rows={3}
            maxLength={300}
            placeholder="Add a reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button size="sm" disabled={!reply.trim() || busy} onClick={() => void send()}>
              {busy ? "Sending…" : "Send"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmClose(true)}
              style={{ marginLeft: "auto" }}
            >
              Close ticket
            </Button>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            {reply.length}/300
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirmClose}
        title="Close this ticket?"
        tone="warning"
        icon="circle-check-big"
        confirmLabel="Close it"
        onConfirm={() => void close()}
        onCancel={() => setConfirmClose(false)}
      >
        You can always open a new ticket if you need to.
      </ConfirmDialog>
    </div>
  );
}

function Attachments({
  items,
  busy,
  disabled,
  onPick,
}: {
  items: TicketAttachment[];
  busy: boolean;
  disabled: boolean;
  onPick: (files: File[]) => Promise<void>;
}) {
  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="ds-overline">Attachments</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {items.length}/{MAX_TICKET_ATTACHMENTS}
        </span>
      </div>

      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px", display: "grid", gap: 6 }}>
          {items.map((file) => {
            const href = publicUrl({ id: file.id, url: file.url });
            return (
              <li key={file.id} style={{ fontSize: 13.5 }}>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    {file.fileName}
                  </a>
                ) : (
                  // An authorized file has no URL to link. It still exists —
                  // render its name, never an empty slot.
                  <span>{file.fileName}</span>
                )}
                <span className="muted"> · {Math.round(file.fileSize / 1024)} KB</span>
              </li>
            );
          })}
        </ul>
      )}

      {!disabled && items.length < MAX_TICKET_ATTACHMENTS && (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <input
            type="file"
            multiple
            disabled={busy}
            style={{ display: "none" }}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) void onPick(files);
            }}
          />
          <span style={{ textDecoration: "underline" }}>Add a file</span>
        </label>
      )}
    </section>
  );
}

function Conversation({ notes }: { notes: TicketNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13.5 }}>
        No replies yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {notes.map((note) => (
        <div
          key={note._id}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 12,
            // A system note is the platform narrating, not a person replying.
            background: note.is_system_note ? "var(--surface-2)" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {!note.is_system_note && (
              <Avatar
                name={note.author?.name ?? "Support"}
                src={publicUrl(note.author?.avatar) ?? undefined}
                size={22}
              />
            )}
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {note.is_system_note ? "System" : (note.author?.name ?? "Support")}
            </span>
            <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
              {new Date(note.created_at).toLocaleString()}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{note.content}</p>
        </div>
      ))}
    </div>
  );
}
