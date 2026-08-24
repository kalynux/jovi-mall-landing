"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Select, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { CUSTOMER_MAX_FILE_BYTES, uploadFiles, type UploadedFile } from "@/lib/shop/files.api";
import {
  createTicket,
  listTicketOrderRefs,
  listTicketProductRefs,
  missingRequiredInfo,
  TICKET_TYPE_GROUPS,
  type TicketEntityType,
  type TicketImportance,
  type TicketType,
} from "@/lib/shop/tickets.api";

const MAX_SUBJECT = 200;
/** The create schema's cap. `PATCH` allows 10000; creation does not. */
const MAX_DESCRIPTION = 700;

/**
 * What a customer can file a ticket about.
 *
 * `ORDER` and `PRODUCT` are pickers backed by the reference lookups, so the id
 * is always one the backend will resolve. `OTHER` needs no id at all — the
 * backend defaults it. The remaining entity types (`SHIPMENT`, `USER`,
 * `VENDOR`, …) are omitted: they take an id with **no existence check**, so
 * offering a free-text field for one is offering a way to file an unresolvable
 * ticket.
 */
const SUBJECTS = [
  { value: "ORDER", label: "An order" },
  { value: "PRODUCT", label: "A product" },
  { value: "OTHER", label: "Something else" },
] as const;

const IMPORTANCE: { value: TicketImportance; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

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
 */
export default function NewTicketPage() {
  const router = useRouter();
  const { flash } = useToast();
  const { status: authStatus } = useAuthGuard();

  const [entityType, setEntityType] = useState<TicketEntityType>("ORDER");
  const [entityId, setEntityId] = useState("");
  const [type, setType] = useState<TicketType>("ORDER_ISSUE");
  const [importance, setImportance] = useState<TicketImportance>("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const orders = useApiResource(
    () => (entityType === "ORDER" ? listTicketOrderRefs({ limit: 50 }) : Promise.resolve(null)),
    [entityType, authStatus],
  );
  const products = useApiResource(
    () => (entityType === "PRODUCT" ? listTicketProductRefs({ limit: 50 }) : Promise.resolve(null)),
    [entityType, authStatus],
  );

  const needsTracking = missing.includes("tracking_number");
  const needsMedia = missing.includes("product_photo_video");

  const pickFiles = useCallback(
    async (picked: File[]) => {
      const tooBig = picked.find((f) => f.size > CUSTOMER_MAX_FILE_BYTES);
      if (tooBig) {
        flash(`${tooBig.name} is too large.`);
        return;
      }
      setBusy(true);
      try {
        const uploaded = await uploadFiles(picked.slice(0, 5 - files.length));
        setFiles((prev) => [...prev, ...uploaded]);
      } catch {
        flash("Could not upload that file.");
      } finally {
        setBusy(false);
      }
    },
    [files.length, flash],
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
      router.replace(`/shop/account/support/${ticket._id}`);
    } catch (err) {
      const gaps = missingRequiredInfo(err);
      if (gaps.length > 0) {
        // The seller's policy, which the shopper has never seen. Ask for exactly
        // what it wants and keep everything already typed.
        setMissing(gaps);
        flash("This seller needs a little more before we can file this.");
      } else {
        const code = (err as { code?: string })?.code;
        flash(
          code === "TICKET_ENTITY_NOT_FOUND"
            ? "We could not find that order or product."
            : "Could not open that ticket. Please try again.",
        );
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
  ]);

  if (authStatus === "loading") {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
        <Skeleton height={280} />
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
      <h1 className="sr-only">New ticket</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="What is this about?">
          <Select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value as TicketEntityType);
              setEntityId("");
              setMissing([]);
            }}
            options={SUBJECTS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </Field>

        {entityType === "ORDER" && (
          <Field label="Which order?">
            {orders.status === "loading" ? (
              <Skeleton height={40} />
            ) : (
              <Select
                value={entityId}
                onChange={(e) => {
                  const id = e.target.value;
                  setEntityId(id);
                  // The picker is also where a tracking number comes from, which
                  // matters because the seller's policy may require one.
                  const order = orders.data?.data.find((o) => o.id === id);
                  const tracked = order?.shipments.find((s) => s.trackingNumber);
                  if (tracked?.trackingNumber) setTrackingNumber(tracked.trackingNumber);
                }}
                options={[
                  { value: "", label: "Choose an order" },
                  ...(orders.data?.data ?? []).map((o) => ({
                    value: o.id,
                    label: `${o.orderNumber} · ${new Date(o.createdAt).toLocaleDateString()}`,
                  })),
                ]}
              />
            )}
          </Field>
        )}

        {entityType === "PRODUCT" && (
          <Field label="Which product?">
            {products.status === "loading" ? (
              <Skeleton height={40} />
            ) : (
              <Select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                options={[
                  { value: "", label: "Choose a product" },
                  ...(products.data?.data ?? []).map((p) => ({ value: p.id, label: p.title })),
                ]}
              />
            )}
          </Field>
        )}

        <Field label="Type">
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as TicketType)}
          >
            {TICKET_TYPE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.types.map((value) => (
                  <option key={value} value={value}>
                    {value.replace(/_/g, " ").toLowerCase()}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <Field label="How urgent is it?" hint="This cannot be changed later.">
          <Select
            value={importance}
            onChange={(e) => setImportance(e.target.value as TicketImportance)}
            options={IMPORTANCE}
          />
        </Field>

        <Field label="Subject">
          <input
            className="input"
            maxLength={MAX_SUBJECT}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary"
          />
        </Field>

        <Field label="What happened?" hint={`${description.length}/${MAX_DESCRIPTION}`}>
          <textarea
            className="input"
            rows={5}
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        {/* Only rendered once the backend has said this seller requires it —
            asking everyone for a tracking number would be wrong for most. */}
        {needsTracking && (
          <Field
            label="Tracking number"
            hint="This seller needs it before they can look into an order."
          >
            <input
              className="input"
              maxLength={120}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </Field>
        )}

        <Field
          label="Photos or video"
          hint={
            needsMedia
              ? "This seller needs at least one before they can look into it."
              : "Optional. Up to 5."
          }
        >
          {files.length > 0 && (
            <ul style={{ margin: "0 0 6px", paddingLeft: 18, fontSize: 13 }}>
              {files.map((f) => (
                <li key={f.id}>{f.originalName}</li>
              ))}
            </ul>
          )}
          {files.length < 5 && (
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
              <span style={{ textDecoration: "underline" }}>Add a file</span>
            </label>
          )}
        </Field>

        <div style={{ display: "flex", gap: 8 }}>
          <Button disabled={!valid || busy} onClick={() => void submit()}>
            {busy ? "Sending…" : "Open ticket"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/shop/account/support")}>
            Cancel
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
