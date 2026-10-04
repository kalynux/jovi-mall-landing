"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AccountCard } from "@/components/shop/account/AccountShell";
import { Badge, Button, ConfirmDialog } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import { customerPaysDelivery } from "@/lib/shop/delivery";
import {
  cancelCombinedDelivery,
  listCombinedDeliveryRequests,
  requestCombinedDelivery,
} from "@/lib/shop/delivery-fees.api";
import { formatMoney } from "@/lib/shop/format";
import { getOrderGroup, listOrderShipments } from "@/lib/shop/orders.api";
import type {
  CombinedDeliveryRequest,
  CustomerOrder,
  CustomerShipment,
} from "@/lib/shop/customer.types";

/**
 * "Ask for a combined delivery price" (ADR-A11 D-8).
 *
 * When one checkout sends two or more customer-paid parcels with the same
 * delivery company, the customer may ask that company for one price for all of
 * them. The company can only LOWER fees — an answer lands as ordinary decreases
 * on the orders, with the money moving like any other — or decline.
 *
 * ── Who is eligible is the server's call ─────────────────────────────────────
 *
 * The rule is: same checkout, same company, customer-paid, not picked up, no
 * fee change pending, change cap not reached — at least two. This screen sees
 * only the first four, so it offers the button where they hold (parcels still
 * `preparing`, grouped by `agency.id`) and sends no `shipmentIds`: the server
 * then takes every parcel that is actually eligible, and answers
 * `COMBINED_DELIVERY_REQUEST_INELIGIBLE` when fewer than two are.
 *
 * It lives at the checkout level (`cartId`), so the group screen hands over the
 * orders it already has, and a single-order screen lets this read the group.
 */
export function CombinedDeliveryPanel({
  cartId,
  orders: given,
}: {
  cartId: string;
  /** The checkout's orders, when the caller already has them. */
  orders?: CustomerOrder[];
}) {
  const t = useTranslations("shop.delivery.combined");
  const tErrors = useTranslations("errors");
  const { flash, flashError } = useToast();

  const [fetched, setFetched] = useState<CustomerOrder[] | null>(null);
  const orders = given ?? fetched;
  const [shipments, setShipments] = useState<CustomerShipment[] | null>(null);
  const [requests, setRequests] = useState<CombinedDeliveryRequest[] | null>(null);
  const [asking, setAsking] = useState<{ agencyId: string; name: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // The single-order screen has one order; the rule spans the whole checkout.
  useEffect(() => {
    if (given) return;
    let cancelled = false;
    getOrderGroup(cartId)
      .then((g) => !cancelled && setFetched(g.orders))
      .catch(() => !cancelled && setFetched([]));
    return () => {
      cancelled = true;
    };
  }, [cartId, given]);

  const paying = useMemo(() => (orders ?? []).filter(customerPaysDelivery), [orders]);
  const payingKey = paying.map((o) => o.id).join(",");

  const loadRequests = useCallback(() => {
    listCombinedDeliveryRequests(cartId)
      .then(setRequests)
      .catch(() => setRequests([]));
  }, [cartId]);

  useEffect(() => {
    if (paying.length === 0) return;
    let cancelled = false;
    Promise.all(paying.map((o) => listOrderShipments(o.id).catch(() => [] as CustomerShipment[])))
      .then((lists) => !cancelled && setShipments(lists.flat()));
    loadRequests();
    return () => {
      cancelled = true;
    };
    // `payingKey` stands for `paying`: a re-read group is a new array with the same orders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payingKey, loadRequests]);

  /** Company names, for the request rows — the requests carry only an id. */
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shipments ?? []) if (s.agency?.id && s.agency.name) map.set(s.agency.id, s.agency.name);
    return map;
  }, [shipments]);

  /** Companies carrying two or more parcels not picked up yet, with no request open. */
  const candidates = useMemo(() => {
    const open = new Set((requests ?? []).filter((r) => r.status === "open").map((r) => r.agencyId));
    const counts = new Map<string, number>();
    for (const s of shipments ?? []) {
      if (s.status !== "preparing" || !s.agency?.id) continue;
      counts.set(s.agency.id, (counts.get(s.agency.id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([agencyId, n]) => n >= 2 && !open.has(agencyId))
      .map(([agencyId, n]) => ({ agencyId, n, name: names.get(agencyId) ?? null }));
  }, [shipments, requests, names]);

  const send = useCallback(async () => {
    if (!asking) return;
    setBusy(true);
    try {
      const trimmed = note.trim();
      await requestCombinedDelivery(cartId, { agencyId: asking.agencyId, ...(trimmed ? { note: trimmed } : {}) });
      flash(t("sent"));
      setAsking(null);
      setNote("");
    } catch (err) {
      flashError(translateError(tErrors, err, t("sendFailed")));
    } finally {
      setBusy(false);
      loadRequests();
    }
  }, [asking, note, cartId, flash, flashError, t, tErrors, loadRequests]);

  const cancel = useCallback(
    async (request: CombinedDeliveryRequest) => {
      setBusy(true);
      try {
        await cancelCombinedDelivery(cartId, request.id);
        flash(t("cancelled"));
      } catch (err) {
        flashError(translateError(tErrors, err, t("cancelFailed")));
      } finally {
        setBusy(false);
        loadRequests();
      }
    },
    [cartId, flash, flashError, t, tErrors, loadRequests],
  );

  if (paying.length === 0 || !shipments || !requests) return null;
  if (candidates.length === 0 && requests.length === 0) return null;

  return (
    <AccountCard style={{ marginBottom: 12 }}>
      <p className="ds-overline" style={{ marginBottom: 6 }}>
        {t("title")}
      </p>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, margin: "0 0 10px" }}>
        {t("intro")}
      </p>

      {candidates.map((c) => (
        <div key={c.agencyId} style={{ marginBottom: 8 }}>
          <Button
            block
            variant="secondary"
            leadingIcon="layers"
            disabled={busy}
            onClick={() => setAsking({ agencyId: c.agencyId, name: c.name ?? t("theCompany") })}
          >
            {t("ask", { company: c.name ?? t("theCompany") })}
          </Button>
        </div>
      ))}

      {requests.map((r) => {
        const company = names.get(r.agencyId) ?? t("theCompany");
        const chip = STATUS_CHIP[r.status];
        return (
          <div
            key={r.id}
            style={{
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: 11,
              marginTop: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-strong)" }}>
                {t("requestTo", { company, n: r.shipments.length })}
              </span>
              <span style={{ marginLeft: "auto" }}>
                <Badge size="sm" tone={chip.tone} icon={chip.icon}>
                  {t(`status.${r.status}`)}
                </Badge>
              </span>
            </div>

            {r.status === "answered" && r.answer && (
              <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: "6px 0 0", color: "var(--text-body)" }}>
                {t("saving", { amount: formatMoney(r.answer.saving, r.currency) })}
              </p>
            )}
            {(r.answer?.note || r.declineNote) && (
              <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, margin: "4px 0 0" }}>
                {t.rich("theirNote", {
                  note: (r.answer?.note || r.declineNote) ?? "",
                  q: (chunks) => <q className="ds-ugc">{chunks}</q>,
                })}
              </p>
            )}
            {r.status === "open" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span className="muted" style={{ fontSize: 12.5, flex: 1 }}>
                  {t("waiting")}
                </span>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancel(r)}>
                  {t("cancel")}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={asking !== null}
        title={t("confirmTitle")}
        tone="brand"
        icon="layers"
        confirmLabel={t("send")}
        cancelLabel={t("notNow")}
        busy={busy}
        onConfirm={() => void send()}
        onCancel={() => {
          setAsking(null);
          setNote("");
        }}
      >
        <p style={{ margin: "0 0 10px" }}>{t("confirmBody", { company: asking?.name ?? "" })}</p>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
          {t("noteLabel")}
          <textarea
            value={note}
            maxLength={500}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            style={{
              display: "block",
              width: "100%",
              marginTop: 4,
              padding: "8px 10px",
              fontSize: 13.5,
              fontWeight: 400,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface)",
              color: "var(--text-body)",
              resize: "vertical",
            }}
          />
        </label>
      </ConfirmDialog>
    </AccountCard>
  );
}

const STATUS_CHIP: Record<
  CombinedDeliveryRequest["status"],
  { tone: "brand" | "neutral" | "success" | "warning" | "danger" | "info"; icon: "hourglass" | "circle-check-big" | "circle-x" | "circle-slash" }
> = {
  open: { tone: "warning", icon: "hourglass" },
  answered: { tone: "success", icon: "circle-check-big" },
  declined: { tone: "danger", icon: "circle-x" },
  cancelled: { tone: "neutral", icon: "circle-slash" },
};

