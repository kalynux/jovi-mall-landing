"use client";

import { useFormatter, useTranslations } from "next-intl";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Button, Icon, Select, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { getBooking, listBookings } from "@/lib/shop/bookings.api";
import { getOrder } from "@/lib/shop/orders.api";
import {
  DEFAULT_TICKET_TYPE,
  heldPurchaseOf,
  ticketPrefillOf,
  type CustomerProtection,
} from "@/lib/shop/protection";
import { TICKET_LIST, ticketPath } from "@/lib/shop/shop.routes";
import {
  maxBytesFor,
  uploadAttachments,
  uploadViolations,
  type UploadedFile,
} from "@/lib/shop/files.api";
import {
  createTicket,
  listTicketOrderRefs,
  listTicketProductRefs,
  missingRequiredInfo,
  TICKET_TYPE_GROUPS,
  ticketTypeLabelKey,
  type Ticket,
  type TicketImportance,
  type TicketType,
} from "@/lib/shop/tickets.api";

const MAX_SUBJECT = 200;
/** The create schema's cap. `PATCH` allows 10000; creation does not. */
const MAX_DESCRIPTION = 700;
/** What the attachment endpoint accepts in one ticket. */
const MAX_FILES = 5;

/**
 * What a customer can file a ticket about.
 *
 * `ORDER` and `PRODUCT` are pickers backed by the reference lookups, and
 * `BOOKING` by the customer's own bookings, so the id is always one the backend
 * will resolve. `OTHER` needs no id at all — the backend defaults it. The
 * remaining entity types (`SHIPMENT`, `USER`, `VENDOR`, …) are omitted: they
 * take an id with **no existence check**, so offering a free-text field for one
 * is offering a way to file an unresolvable ticket.
 *
 * Values only: the labels live in `shop.support.subjects.*`, because a module
 * constant is evaluated once at import time and has no locale to read.
 */
const SUBJECTS = ["ORDER", "BOOKING", "PRODUCT", "OTHER"] as const;
type Subject = (typeof SUBJECTS)[number];

/**
 * What to say once a ticket exists, when there is something to say.
 *
 * `holds_earnings` on the response is the fact: `true` means this request put
 * the seller's payment on hold. `false` on an order or booking whose protection
 * has `ended` means the seller was already paid — that needs saying too, and it
 * must not promise a refund. Every other ticket goes straight to its thread, as
 * before.
 */
type Sent = { ticket: Ticket; outcome: "on_hold" | "after_protection" };

/** Likewise — the labels are `shop.support.importance.*`. */
const IMPORTANCE: TicketImportance[] = ["low", "medium", "high", "critical"];

/**
 * Open a support ticket.
 *
 * ── The vendor's support policy can refuse this, and the customer cannot see it ─
 *
 * A ticket filed against an **order** inherits that order's vendor's
 * `required_info` rules: some vendors require a tracking number, some require a
 * photo or video, and the shopper has never been shown either rule. So the
 * refusal — `400 TICKET_REQUIRED_INFO_MISSING`, with `details.missing[]` naming
 * what is absent — is turned into a prompt for exactly the missing thing rather
 * than a generic failure. The form keeps everything typed so the second attempt
 * only has to add what was asked for.
 *
 * `importance` is worth choosing carefully because it is **immutable after
 * creation** — there is no endpoint to change it, on this namespace or any
 * other.
 *
 * ── Opened from an order or a booking ────────────────────────────────────────
 *
 * "Report a problem" arrives with `?about=ORDER&id=…` (or `BOOKING`), and the
 * form starts on that record and on a problem type. The type is what decides
 * whether the request holds the seller's payment (Wi-Mall Protection), so the
 * default for every subject is a problem type — never `INVOICE_REQUEST` or
 * `ADDRESS_CHANGE`, which hold nothing.
 */
export default function NewTicketPage() {
  // `useSearchParams()` suspends during prerender — see `ShopBrowserClient`.
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
          <Skeleton height={280} />
        </div>
      }
    >
      <NewTicketForm />
    </Suspense>
  );
}

function NewTicketForm() {
  const t = useTranslations("shop.support");
  // Root-scoped: the lib modules emit absolute keys (`shop.support.types.…`,
  // and the optgroup names, which live in `shop.common`).
  const tKey = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { flash } = useToast();
  const { status: authStatus } = useAuthGuard();

  // Read once: the form owns these from here on, and a later change to the
  // query string must not overwrite what the customer has picked.
  const searchParams = useSearchParams();
  const [prefill] = useState(() => ticketPrefillOf(searchParams));

  const [entityType, setEntityType] = useState<Subject>(prefill?.entityType ?? "ORDER");
  const [entityId, setEntityId] = useState(prefill?.entityId ?? "");
  const [type, setType] = useState<TicketType>(
    DEFAULT_TICKET_TYPE[prefill?.entityType ?? "ORDER"],
  );
  const [importance, setImportance] = useState<TicketImportance>("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  // `null` until the customer types one: the chosen order's own number stands
  // in, which matters because the seller's policy may require it.
  const [typedTracking, setTypedTracking] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);

  const orders = useApiResource(
    () => (entityType === "ORDER" ? listTicketOrderRefs({ limit: 50 }) : Promise.resolve(null)),
    [entityType, authStatus],
  );
  const bookings = useApiResource(
    () => (entityType === "BOOKING" ? listBookings({ limit: 50 }) : Promise.resolve(null)),
    [entityType, authStatus],
  );
  const products = useApiResource(
    () => (entityType === "PRODUCT" ? listTicketProductRefs({ limit: 50 }) : Promise.resolve(null)),
    [entityType, authStatus],
  );

  const orderTracking =
    entityType === "ORDER"
      ? (orders.data?.data
          .find((o) => o.id === entityId)
          ?.shipments.find((s) => s.trackingNumber)?.trackingNumber ?? "")
      : "";
  const trackingNumber = typedTracking ?? orderTracking;

  const needsTracking = missing.includes("tracking_number");
  const needsMedia = missing.includes("product_photo_video");

  const pickFiles = useCallback(
    async (picked: File[]) => {
      const tooBig = picked.find((f) => f.size > maxBytesFor(f));
      if (tooBig) {
        flash(t("fileTooLarge", { name: tooBig.name }));
        return;
      }
      setBusy(true);
      try {
        const uploaded = await uploadAttachments(picked.slice(0, MAX_FILES - files.length));
        setFiles((prev) => [...prev, ...uploaded]);
      } catch (err) {
        // `UPLOAD_POLICY_VIOLATION` names each offending file, which is the only
        // information the person can act on — "could not upload" leaves them
        // guessing which of five files was the problem.
        //
        // `v.message` is the server's sentence and is already in the shopper's
        // language; only the frame around it is ours.
        const violations = uploadViolations(err);
        flash(
          violations.length > 0
            ? violations
                .map((v) =>
                  t("violation", {
                    name: v.fileName ?? t("thatFile"),
                    detail: v.message ?? v.code,
                  }),
                )
                .join(" · ")
            : t("uploadFailed"),
        );
      } finally {
        setBusy(false);
      }
    },
    [files.length, flash, t],
  );

  const submit = useCallback(async () => {
    setBusy(true);
    setMissing([]);
    try {
      const ticket = await createTicket({
        subject: subject.trim(),
        description: description.trim(),
        type,
        importance,
        entityType,
        entityId: entityType === "OTHER" ? undefined : entityId,
        trackingNumber: trackingNumber.trim() || undefined,
        attachments: files.map((f) => f.id),
      });
      if (ticket.holds_earnings) {
        setSent({ ticket, outcome: "on_hold" });
        return;
      }
      // Nothing was put on hold. On an order or a booking that is either
      // because the protection is over — worth saying — or because there was
      // never anything to hold, which is not. The read is best-effort: the
      // ticket exists either way.
      const protection: CustomerProtection | undefined =
        entityType === "ORDER"
          ? (await getOrder(entityId).catch(() => null))?.protection
          : entityType === "BOOKING"
            ? (await getBooking(entityId).catch(() => null))?.protection
            : undefined;
      if (protection?.status === "ended") {
        setSent({ ticket, outcome: "after_protection" });
        return;
      }
      router.replace(ticketPath(ticket.id));
    } catch (err) {
      const gaps = missingRequiredInfo(err);
      if (gaps.length > 0) {
        // The seller's policy, which the shopper has never seen. Ask for exactly
        // what it wants and keep everything already typed.
        setMissing(gaps);
        flash(t("requiredInfoMissing"));
      } else {
        const code = (err as { code?: string })?.code;
        flash(code === "TICKET_ENTITY_NOT_FOUND" ? t("entityNotFound") : t("createFailed"));
      }
    } finally {
      setBusy(false);
    }
  }, [
    subject,
    description,
    type,
    importance,
    entityType,
    entityId,
    trackingNumber,
    files,
    router,
    flash,
    t,
  ]);

  if (authStatus === "loading") {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
        <Skeleton height={280} />
      </div>
    );
  }

  if (sent) {
    const held = sent.outcome === "on_hold";
    return (
      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
        <div
          role="status"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            border: `1px solid var(--${held ? "success-border" : "border"})`,
            background: held ? "var(--success-bg)" : undefined,
            borderRadius: "var(--radius-lg)",
            padding: 14,
          }}
        >
          <Icon
            name={held ? "shield-check" : "circle-check-big"}
            size={19}
            style={{ color: `var(--${held ? "success" : "text-muted"})`, flexShrink: 0, marginTop: 1 }}
          />
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: "var(--text-body)" }}>
            {held
              ? tKey("shop.protection.sent.onHold")
              : tKey(`shop.protection.sent.afterProtection.${heldPurchaseOf(sent.ticket.entity_type)}`)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Button onClick={() => router.replace(ticketPath(sent.ticket.id))}>
            {tKey("shop.protection.viewRequest")}
          </Button>
        </div>
      </div>
    );
  }

  const needsEntity = entityType !== "OTHER";
  const valid =
    subject.trim().length > 0 &&
    description.trim().length > 0 &&
    (!needsEntity || entityId.length > 0) &&
    (!needsTracking || trackingNumber.trim().length > 0) &&
    (!needsMedia || files.length > 0);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.supportNew")}</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label={t("about")}>
          <Select
            value={entityType}
            onChange={(e) => {
              const next = e.target.value as Subject;
              setEntityType(next);
              setEntityId("");
              setType(DEFAULT_TICKET_TYPE[next]);
              setTypedTracking(null);
              setMissing([]);
            }}
            options={SUBJECTS.map((value) => ({ value, label: t(`subjects.${value}`) }))}
          />
        </Field>

        {entityType === "ORDER" && (
          <Field label={t("whichOrder")}>
            {orders.status === "loading" ? (
              <Skeleton height={40} />
            ) : (
              <Select
                value={entityId}
                onChange={(e) => {
                  setEntityId(e.target.value);
                  // The picker is also where a tracking number comes from —
                  // back to the newly chosen order's own.
                  setTypedTracking(null);
                }}
                options={[
                  { value: "", label: t("chooseOrder") },
                  // Opened from an order the lookup's first page does not
                  // reach: it still has to be the selected option.
                  ...(prefill?.entityType === "ORDER" &&
                  !orders.data?.data.some((o) => o.id === prefill.entityId)
                    ? [{ value: prefill.entityId, label: t("thisOrder") }]
                    : []),
                  ...(orders.data?.data ?? []).map((o) => ({
                    value: o.id,
                    // An order number and a date, not a sentence — the vendor's
                    // reference first because that is what a shopper scans for.
                    label: `${o.orderNumber} · ${format.dateTime(new Date(o.createdAt), {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`,
                  })),
                ]}
              />
            )}
          </Field>
        )}

        {entityType === "BOOKING" && (
          <Field label={t("whichBooking")}>
            {bookings.status === "loading" ? (
              <Skeleton height={40} />
            ) : (
              <Select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                options={[
                  { value: "", label: t("chooseBooking") },
                  ...(prefill?.entityType === "BOOKING" &&
                  !bookings.data?.data.some((b) => b.id === prefill.entityId)
                    ? [{ value: prefill.entityId, label: t("thisBooking") }]
                    : []),
                  ...(bookings.data?.data ?? []).map((b) => {
                    // The reference to quote, then when — the list read does
                    // not populate the service's name. `bookingNumber` is null
                    // on bookings older than the field.
                    const when = format.dateTime(new Date(b.startAt), {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return {
                      value: b.id,
                      label: b.bookingNumber ? `${b.bookingNumber} · ${when}` : when,
                    };
                  }),
                ]}
              />
            )}
          </Field>
        )}

        {entityType === "PRODUCT" && (
          <Field label={t("whichProduct")}>
            {products.status === "loading" ? (
              <Skeleton height={40} />
            ) : (
              <Select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                options={[
                  { value: "", label: t("chooseProduct") },
                  ...(products.data?.data ?? []).map((p) => ({ value: p.id, label: p.title })),
                ]}
              />
            )}
          </Field>
        )}

        <Field label={t("typeLabel")}>
          <select
            className="field"
            value={type}
            onChange={(e) => setType(e.target.value as TicketType)}
          >
            {TICKET_TYPE_GROUPS.map((group) => (
              <optgroup key={group.labelKey} label={tKey(group.labelKey)}>
                {group.types.map((value) => (
                  <option key={value} value={value}>
                    {tKey(ticketTypeLabelKey(value))}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label={t("urgency")} hint={t("urgencyHint")}>
          <Select
            value={importance}
            onChange={(e) => setImportance(e.target.value as TicketImportance)}
            options={IMPORTANCE.map((value) => ({ value, label: t(`importance.${value}`) }))}
          />
        </Field>

        <Field label={t("subjectLabel")}>
          <input
            className="field"
            maxLength={MAX_SUBJECT}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("subjectPlaceholder")}
          />
        </Field>

        <Field label={t("whatHappened")} hint={`${description.length}/${MAX_DESCRIPTION}`}>
          <textarea
            className="field"
            rows={5}
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {/* Only rendered once the backend has said this seller requires it —
            asking everyone for a tracking number would be wrong for most. */}
        {needsTracking && (
          <Field label={t("trackingNumber")} hint={t("trackingHint")}>
            <input
              className="field"
              maxLength={120}
              value={trackingNumber}
              onChange={(e) => setTypedTracking(e.target.value)}
            />
          </Field>
        )}

        <Field
          label={t("media")}
          hint={
            needsMedia ? t("mediaRequiredHint") : t("mediaOptionalHint", { n: MAX_FILES })
          }
        >
          {files.length > 0 && (
            <ul style={{ margin: "0 0 6px", paddingLeft: 18, fontSize: 13 }}>
              {files.map((f) => (
                <li key={f.id}>{f.originalName}</li>
              ))}
            </ul>
          )}
          {files.length < MAX_FILES && (
            <label style={{ fontSize: 13, cursor: busy ? "default" : "pointer" }}>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                disabled={busy}
                style={{ display: "none" }}
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (picked.length) void pickFiles(picked);
                }}
              />
              <span style={{ textDecoration: "underline" }}>{t("addFile")}</span>
            </label>
          )}
        </Field>

        <div style={{ display: "flex", gap: 8 }}>
          <Button disabled={!valid || busy} onClick={() => void submit()}>
            {busy ? tKey("shop.common.sending") : t("openTicket")}
          </Button>
          <Button variant="ghost" onClick={() => router.push(TICKET_LIST)}>
            {tKey("shop.common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
        {hint && (
          <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}
