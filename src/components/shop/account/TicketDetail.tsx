"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useCallback, useState } from "react";
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
  ticketTypeLabelKey,
  type TicketAttachment,
  type TicketNote,
} from "@/lib/shop/tickets.api";
import { fileUnavailableReason, publicUrl } from "@/lib/shop/shop.types";
import { TICKET_LIST } from "@/lib/shop/shop.routes";

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
export function TicketDetail({ ticketId }: { ticketId: string }) {
  // ⚠ BOTH TRANSLATORS ARE BOUND HERE, ABOVE THE GUARDS BELOW, AND THAT
  //   POSITION IS THE POINT.
  //   `tKey` used to sit after the early returns, which is a real rules-of-hooks
  //   violation rather than a style one: this component renders a skeleton while
  //   loading, then a "not found" branch, then the full view — so the number of
  //   hooks React saw CHANGED between renders as the data arrived. React matches
  //   hooks by call order, so the first render after loading finishes can read
  //   another hook's state, and the symptom is a crash or wrong state on a
  //   screen that worked a moment earlier.
  //
  //   Note the name: this file binds `t` to the TICKET, so the screen's own copy
  //   is `tSupport`. `tKey` is root-scoped, for the absolute keys the lib
  //   modules emit (`shop.status.ticket.…`, `shop.support.types.…`).
  const tSupport = useTranslations("shop.support");
  const tKey = useTranslations();
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
  /** The cap the textarea enforces and the counter reports. One source. */
  const REPLY_MAX = 300;
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
      flash(tSupport("sendFailed"));
    } finally {
      setBusy(false);
    }
  }, [reply, ticketId, notes, ticket, flash, tSupport]);

  const attach = useCallback(
    async (files: File[]) => {
      const current = attachments.data?.length ?? 0;
      const room = MAX_TICKET_ATTACHMENTS - current;
      if (room <= 0) {
        flash(tSupport("attachmentLimit", { n: MAX_TICKET_ATTACHMENTS }));
        return;
      }

      const tooBig = files.find((f) => f.size > maxBytesFor(f));
      if (tooBig) {
        flash(tSupport("fileTooLarge", { name: tooBig.name }));
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
        // create form does. `v.message` is the server's own sentence.
        const violations = uploadViolations(err);
        flash(
          violations.length > 0
            ? violations
                .map((v) =>
                  tSupport("violation", {
                    name: v.fileName ?? tSupport("thatFile"),
                    detail: v.message ?? v.code,
                  }),
                )
                .join(" · ")
            : tSupport("attachFailed"),
        );
      } finally {
        setBusy(false);
      }
    },
    [attachments, ticketId, flash, tSupport],
  );

  const close = useCallback(async () => {
    setConfirmClose(false);
    setBusy(true);
    try {
      await closeTicket(ticketId);
      ticket.reload();
    } catch {
      flash(tSupport("closeFailed"));
    } finally {
      setBusy(false);
    }
  }, [ticketId, ticket, flash, tSupport]);

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
        <p className="muted">{tSupport("notFound")}</p>
        <Button variant="secondary" size="sm" onClick={() => router.push(TICKET_LIST)}>
          {tSupport("backToSupport")}
        </Button>
      </div>
    );
  }

  const view = TICKET_STATUS_LABEL[t.status] ?? {
    labelKey: "shop.status.unknown",
    tone: "neutral" as const,
  };
  const isClosed = t.status === "closed" || t.status === "resolved";

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{t.subject}</h1>

      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {/* See the note in the support list: there is no `ticket_number`. */}
          <span className="muted" style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
            #{t.id.slice(-6)}
          </span>
          <Badge size="sm" tone={view.tone}>
            {tKey(view.labelKey)}
          </Badge>
        </div>

        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em" }}>{t.subject}</div>

        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {tKey(ticketTypeLabelKey(t.type))}
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
        /* Two whole sentences rather than one with the status dropped into it.
           The English version lower-cased the badge text to read "this ticket is
           closed", which only works in a language that has cases and where the
           adjective does not have to agree with anything. */
        <p className="muted" style={{ fontSize: 13.5, marginTop: 16 }}>
          {t.status === "resolved" ? tSupport("resolvedNotice") : tSupport("closedNotice")}
        </p>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            className="field"
            rows={3}
            maxLength={REPLY_MAX}
            placeholder={tSupport("replyPlaceholder")}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button size="sm" disabled={!reply.trim() || busy} onClick={() => void send()}>
              {busy ? tKey("shop.common.sending") : tKey("shop.common.send")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmClose(true)}
              style={{ marginLeft: "auto" }}
            >
              {tSupport("closeTicket")}
            </Button>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            {tSupport("replyCharCount", { n: reply.length, max: REPLY_MAX })}
          </span>
        </div>
      )}

      <ConfirmDialog
        open={confirmClose}
        title={tSupport("confirmCloseTitle")}
        tone="warning"
        icon="circle-check-big"
        confirmLabel={tSupport("confirmCloseAction")}
        onConfirm={() => void close()}
        onCancel={() => setConfirmClose(false)}
      >
        {tSupport("confirmCloseBody")}
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
  const t = useTranslations("shop.support");

  return (
    <section style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="ds-overline">{t("attachments")}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {items.length}/{MAX_TICKET_ATTACHMENTS}
        </span>
      </div>

      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px", display: "grid", gap: 6 }}>
          {items.map((file) => {
            // Rebuilt rather than passed whole because a TicketAttachment is not
            // a FileDetail — `access` has to be copied across explicitly, and
            // omitting it is what made every blocked file look authorized.
            const href = publicUrl({ id: file.id, url: file.url, access: file.access });
            const blocked = fileUnavailableReason({
              id: file.id,
              url: file.url,
              access: file.access,
            });
            return (
              <li key={file.id} style={{ fontSize: 13.5 }}>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    {file.fileName}
                  </a>
                ) : (
                  // The file exists in both no-URL cases — render its name, never
                  // an empty slot. The reasons differ and so does the sentence:
                  // "locked" is a billing state the owner can undo, and saying
                  // "deleted" about a file nothing deleted sends a customer to
                  // support over a vendor's storage plan.
                  <span>{file.fileName}</span>
                )}
                <span className="muted"> · {Math.round(file.fileSize / 1024)} KB</span>
                {blocked === "blocked" && <span className="muted"> · {t("fileLocked")}</span>}
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
          <span style={{ textDecoration: "underline" }}>{t("addFile")}</span>
        </label>
      )}
    </section>
  );
}

function Conversation({ notes }: { notes: TicketNote[] }) {
  const t = useTranslations("shop.support");
  const format = useFormatter();

  if (notes.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 13.5 }}>
        {t("noReplies")}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {notes.map((note) => (
        <div
          key={note.id}
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
                name={note.author?.name ?? t("supportAuthor")}
                src={publicUrl(note.author?.avatar) ?? undefined}
                size={22}
              />
            )}
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {note.is_system_note
                ? t("systemAuthor")
                : (note.author?.name ?? t("supportAuthor"))}
            </span>
            <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
              {format.dateTime(new Date(note.created_at), {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{note.content}</p>
        </div>
      ))}
    </div>
  );
}
