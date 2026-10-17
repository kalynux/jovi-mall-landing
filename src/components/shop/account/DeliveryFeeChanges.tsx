"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BottomSheet, Button, ConfirmDialog, Icon, Skeleton } from "@/components/shop/ds";
import {
  OnlinePaymentUnavailable,
  OptionsLoadFailed,
  PaymentMethodPicker,
  chargeRequest,
  paymentReady,
} from "@/components/shop/PaymentMethodPicker";
import { PaymentOtpStep, PaymentRedirectPrompt } from "@/components/shop/PaymentSteps";
import { usePaymentOptions } from "@/components/shop/usePaymentOptions";
import { useSavedPayment } from "@/components/shop/useSavedPayment";
import { useChargeRefusal } from "@/components/shop/useChargeRefusal";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import {
  approveDeliveryFee,
  editDeliveryFeeProposal,
  getOrderDeliveryFees,
  payDeliveryFeeTopup,
  proposeDeliveryFee,
  rejectDeliveryFee,
  withdrawDeliveryFeeProposal,
} from "@/lib/shop/delivery-fees.api";
import {
  REASON_MAX,
  REASON_MIN,
  canProposeFee,
  ownProposalStage,
  parseWholeAmount,
  proposalLimitReached,
  reasonIsValid,
  type FeeShipment,
} from "@/lib/shop/fee-proposals";
import { currencyLabel, formatMoney } from "@/lib/shop/format";
import { cardPagePath } from "@/lib/shop/pay-link.api";
import { isSettledFailure, nextPaymentStep, verifyPayment } from "@/lib/shop/payments.api";
import { useApiResource } from "@/lib/shop/useApiResource";
import type { CustomerOrder, DeliveryFeeProposal, OrderDeliveryFees } from "@/lib/shop/customer.types";

/**
 * Parcels the server answered `…_LIMIT_REACHED` for, this session. Module
 * scope, not state: every answer re-reads the order, and the order screen
 * unmounts this card while it does, which would forget a `useState`.
 */
const cappedParcels = new Set<string>();

/** How long the top-up sheet watches a mobile-money prompt before handing back. */
const POLL_MS = 4_000;
const POLL_LIMIT = 15;

/**
 * Changes to this order's delivery fees after checkout (ADR-A11 W-E).
 *
 * Mounted on a customer-paid physical order only — a vendor-paid fee is between
 * the shop and its delivery company and never reaches this surface.
 *
 * ── What can happen, and what the customer does ──────────────────────────────
 *
 *   - a LOWER fee applies at once. Nothing to answer; it is listed, and its
 *     money shows on the receipt as a refund (online) or less cash (COD).
 *   - a HIGHER fee — the delivery company's, or the difference after the shop
 *     moved the parcel to a dearer company — waits for an answer, and the parcel
 *     cannot be picked up meanwhile. Approve or decline; an approved ONLINE
 *     increase is a top-up, paid through the ordinary payment flow.
 *
 * ── The figure answered is the figure shown ──────────────────────────────────
 *
 * Approve and decline send back the `version` on screen. If the company edited
 * the figure in between, the server answers `409` rather than applying a number
 * the customer never saw — and this re-reads and shows the current one instead
 * of retrying. The buttons are exactly `availableActions`; nothing here decides
 * what is allowed.
 *
 * ── The customer's own figure (ADR-A12, 2026-10-14) ──────────────────────────
 *
 * On a parcel the customer pays delivery for, with a company and not yet picked
 * up, "Propose a different fee" names a figure of their own — higher or lower.
 * The company accepts or declines, and the parcel waits for that answer. While
 * it waits the customer may edit or withdraw it; once a higher figure on an
 * online order is accepted, the difference (`topup.amount`, never worked out
 * here) is paid through the same top-up sheet, or declined, which takes the
 * proposal back. A lower or cash-on-delivery figure applies by itself, so the
 * order is simply re-read. After two proposals on one parcel the server answers
 * `…_LIMIT_REACHED`, and the button goes away for that parcel.
 */
export function DeliveryFeeChanges({
  order,
  onChanged,
}: {
  order: CustomerOrder;
  /** The order's own figures move too — total, refunds — so the parent re-reads. */
  onChanged: () => void;
}) {
  const t = useTranslations("shop.delivery.changes");
  const tp = useTranslations("shop.delivery.propose");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const { flash, flashError } = useToast();
  const fees = useApiResource<OrderDeliveryFees>(() => getOrderDeliveryFees(order.id), [order.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<DeliveryFeeProposal | null>(null);
  const [paying, setPaying] = useState<DeliveryFeeProposal | null>(null);
  const [withdrawing, setWithdrawing] = useState<DeliveryFeeProposal | null>(null);
  const [drafting, setDrafting] = useState<ProposalDraft | null>(null);

  const refresh = useCallback(() => {
    fees.reload();
    onChanged();
  }, [fees, onChanged]);

  const withdraw = useCallback(
    async (proposal: DeliveryFeeProposal) => {
      setBusy(proposal.id);
      try {
        await withdrawDeliveryFeeProposal(order.id, proposal.id);
        flash(tp("withdrawn"));
        refresh();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        // The company answered first: show its answer rather than an error.
        if (code === "DELIVERY_FEE_PROPOSAL_NOT_PENDING" || code === "DELIVERY_FEE_PROPOSAL_NOT_YOURS") {
          flashError(t("changedReload"));
          refresh();
        } else {
          flashError(translateError(tErrors, err, t("answerFailed")));
        }
      } finally {
        setBusy(null);
        setWithdrawing(null);
      }
    },
    [order.id, flash, flashError, refresh, t, tp, tErrors],
  );

  const answer = useCallback(
    async (proposal: DeliveryFeeProposal, decision: "approve" | "reject") => {
      setBusy(proposal.id);
      try {
        if (decision === "approve") {
          const next = await approveDeliveryFee(order.id, proposal.id, proposal.version);
          // Online: the figure is frozen and the difference is owed — go
          // straight to paying it rather than leaving a second button to find.
          if (next.topup?.status === "awaiting_payment") {
            setPaying(next);
          } else {
            flash(t("approved"));
          }
        } else {
          await rejectDeliveryFee(order.id, proposal.id, proposal.version);
          // Declining to pay for one's own accepted figure takes it back.
          flash(ownProposalStage(proposal) ? tp("takenBack") : t("declined"));
        }
        refresh();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        if (code === "DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH" || code === "DELIVERY_FEE_PROPOSAL_NOT_PENDING") {
          // The figure moved, or someone else answered. Show what is true now.
          flashError(t("changedReload"));
          refresh();
        } else {
          flashError(translateError(tErrors, err, t("answerFailed")));
        }
      } finally {
        setBusy(null);
        setDeclining(null);
      }
    },
    [order.id, flash, flashError, refresh, t, tp, tErrors],
  );

  if (fees.status === "loading" && !fees.data) return null;
  const data = fees.data;
  // A failed read is not worth taking the order card down for; the receipt
  // above still carries the order's own delivery figures.
  if (!data) return null;

  const active = data.proposals.filter((p) => p.availableActions.length > 0);
  const history = data.proposals.filter((p) => p.availableActions.length === 0);
  const byHand = data.refunds.awaitingManual;
  // Numbered by the read's own order; only drawn when the order has several.
  const proposable = data.shipments
    .map((s, i) => ({ shipment: s, n: i + 1 }))
    .filter(
      ({ shipment }) =>
        canProposeFee(shipment) &&
        !proposalLimitReached(data.proposals, shipment.shipmentId) &&
        !cappedParcels.has(shipment.shipmentId),
    );
  if (active.length === 0 && history.length === 0 && byHand <= 0 && proposable.length === 0) return null;

  const money = (amount: number) => formatMoney(amount, data.currency);
  /** The parcel's current fee, for the edit sheet — the read's, not the proposal's snapshot. */
  const currentFeeOf = (p: DeliveryFeeProposal) =>
    data.shipments.find((s) => s.shipmentId === p.shipmentId)?.fee ?? p.feeBefore;

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("title")}
      </p>

      {active.map((p) =>
        ownProposalStage(p) ? (
          <OwnProposalCard
            key={p.id}
            proposal={p}
            money={money}
            disabled={busy !== null}
            onEdit={() => setDrafting({ kind: "edit", proposal: p, currentFee: currentFeeOf(p) })}
            onWithdraw={() => setWithdrawing(p)}
            onPay={() => setPaying(p)}
            onDecline={() => setDeclining(p)}
          />
        ) : (
        <div
          key={p.id}
          style={{
            border: "1.5px solid var(--warning-border)",
            background: "var(--warning-bg)",
            borderRadius: "var(--radius-md)",
            padding: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Icon name="truck" size={17} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--text-strong)" }}>
                {t(p.origin === "change_agency" ? "movedIncrease" : "askIncrease", {
                  before: money(p.feeBefore),
                  after: money(p.proposedFee),
                })}
              </p>
              {p.reason && (
                <p style={{ margin: "4px 0 0" }}>
                  {t.rich("reason", {
                    reason: p.reason,
                    q: (chunks) => <q className="ds-ugc">{chunks}</q>,
                  })}
                </p>
              )}
              <p style={{ margin: "4px 0 0" }}>
                {p.topup?.status === "awaiting_payment"
                  ? t("topupDue", { amount: money(p.topup.amount) })
                  : t("waitsForYou")}
              </p>
              {p.availableActions.includes("reject") && p.topup?.status !== "awaiting_payment" && (
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                  {t(p.origin === "change_agency" ? "declineShopPays" : "declineCompany")}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {p.availableActions.includes("pay") && p.topup && (
              <Button size="sm" leadingIcon="wallet" disabled={busy !== null} onClick={() => setPaying(p)}>
                {t("payAmount", { amount: money(p.topup.amount) })}
              </Button>
            )}
            {p.availableActions.includes("approve") && (
              <Button
                size="sm"
                leadingIcon="check"
                disabled={busy !== null}
                onClick={() => void answer(p, "approve")}
              >
                {t("accept", { amount: money(p.proposedFee) })}
              </Button>
            )}
            {p.availableActions.includes("reject") && (
              <Button
                size="sm"
                variant="secondary"
                leadingIcon="x"
                disabled={busy !== null}
                onClick={() => setDeclining(p)}
              >
                {t("decline")}
              </Button>
            )}
          </div>
        </div>
        ),
      )}

      {/* "Propose a different fee" — one row per parcel that may take one. */}
      {proposable.map(({ shipment, n }) => (
        <div
          key={shipment.shipmentId}
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}
        >
          <span style={{ flex: "1 1 150px", minWidth: 0, fontSize: 13, color: "var(--text-body)" }}>
            {data.shipments.length > 1
              ? tp("rowMany", { n, fee: money(shipment.fee) })
              : tp("rowOne", { fee: money(shipment.fee) })}
          </span>
          <Button
            size="sm"
            variant="secondary"
            leadingIcon="hand-coins"
            disabled={busy !== null}
            onClick={() => setDrafting({ kind: "new", shipment })}
          >
            {tp("button")}
          </Button>
        </div>
      ))}

      {byHand > 0 && (
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "0 0 8px", display: "flex", gap: 6 }}>
          <Icon name="hourglass" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t("refundByHand", { amount: money(byHand) })}</span>
        </p>
      )}

      {history.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {history.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                fontSize: 12.5,
                color: "var(--text-muted)",
                padding: "3px 0",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{historyLine(t, tp, p, money)}</span>
              <span style={{ flexShrink: 0 }}>
                {format.dateTime(new Date(p.respondedAt ?? p.createdAt), { day: "numeric", month: "short" })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={declining !== null}
        title={declining && ownProposalStage(declining) ? tp("declineTitle") : t("declineTitle")}
        tone="warning"
        icon="x"
        confirmLabel={t("decline")}
        cancelLabel={t("keepDeciding")}
        busy={busy !== null}
        onConfirm={() => declining && void answer(declining, "reject")}
        onCancel={() => setDeclining(null)}
      >
        {declining &&
          (ownProposalStage(declining)
            ? tp("declineBody", { before: money(declining.feeBefore) })
            : t(declining.origin === "change_agency" ? "declineShopPays" : "declineCompany"))}
      </ConfirmDialog>

      <ConfirmDialog
        open={withdrawing !== null}
        title={tp("withdrawTitle")}
        tone="warning"
        icon="undo-2"
        confirmLabel={tp("withdraw")}
        cancelLabel={tp("keep")}
        busy={busy !== null}
        onConfirm={() => withdrawing && void withdraw(withdrawing)}
        onCancel={() => setWithdrawing(null)}
      >
        {withdrawing && tp("withdrawBody", { before: money(withdrawing.feeBefore) })}
      </ConfirmDialog>

      {drafting && (
        <ProposeFeeSheet
          orderId={order.id}
          currency={data.currency}
          draft={drafting}
          onClose={() => setDrafting(null)}
          onDone={(message) => {
            setDrafting(null);
            if (message) flash(message);
            refresh();
          }}
          onCapped={(shipmentId, message) => {
            setDrafting(null);
            cappedParcels.add(shipmentId);
            flashError(message);
            refresh();
          }}
          onStale={(message) => {
            setDrafting(null);
            flashError(message);
            refresh();
          }}
        />
      )}

      {paying?.topup && (
        <TopupSheet
          orderId={order.id}
          proposal={paying}
          open
          onClose={() => setPaying(null)}
          onSettled={() => {
            setPaying(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

type Translator = (key: string, values?: Record<string, string>) => string;

/** One settled change, in a line. `tp` words the customer's own proposals. */
function historyLine(
  t: Translator,
  tp: Translator,
  p: DeliveryFeeProposal,
  money: (n: number) => string,
): string {
  const values = { before: money(p.feeBefore), after: money(p.proposedFee) };
  if (p.raisedBy === "you") {
    switch (p.status) {
      case "approved":
        return tp("historyAccepted", values);
      case "rejected":
        return tp("historyDeclined", values);
      case "withdrawn":
        return tp("historyWithdrawn", values);
      default:
        return t("historyPending", values);
    }
  }
  switch (p.status) {
    case "approved":
      if (p.origin === "combined_request") return t("historyCombined", values);
      return p.direction === "decrease" ? t("historyLowered", values) : t("historyRaised", values);
    case "rejected":
      return t("historyDeclined", values);
    case "withdrawn":
      return t("historyWithdrawn", values);
    default:
      return t("historyPending", values);
  }
}

/** What the propose sheet is for: a new figure on a parcel, or editing one's own. */
type ProposalDraft =
  | { kind: "new"; shipment: FeeShipment }
  | { kind: "edit"; proposal: DeliveryFeeProposal; currentFee: number };

/**
 * The customer's own proposal while it is still live: waiting for the
 * company (edit · withdraw), or accepted with a difference to pay (pay ·
 * decline). The buttons are exactly `availableActions`.
 */
function OwnProposalCard({
  proposal: p,
  money,
  disabled,
  onEdit,
  onWithdraw,
  onPay,
  onDecline,
}: {
  proposal: DeliveryFeeProposal;
  money: (n: number) => string;
  disabled: boolean;
  onEdit: () => void;
  onWithdraw: () => void;
  onPay: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations("shop.delivery.changes");
  const tp = useTranslations("shop.delivery.propose");
  const due = ownProposalStage(p) === "pay" && p.topup ? p.topup.amount : null;
  const can = (action: DeliveryFeeProposal["availableActions"][number]) => p.availableActions.includes(action);

  return (
    <div
      style={{
        // The customer has something to do once it is accepted; until then it
        // is the company's turn, so it reads as information, not a warning.
        border: `1.5px solid var(${due !== null ? "--warning-border" : "--info-border"})`,
        background: `var(${due !== null ? "--warning-bg" : "--info-bg"})`,
        borderRadius: "var(--radius-md)",
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Icon
          name={due !== null ? "wallet" : "hourglass"}
          size={17}
          style={{ color: `var(${due !== null ? "--warning" : "--info"})`, flexShrink: 0, marginTop: 1 }}
        />
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--text-strong)" }}>
            {due !== null
              ? tp("acceptedPay", { amount: money(due) })
              : tp("ownTitle", { before: money(p.feeBefore), after: money(p.proposedFee) })}
          </p>
          {due !== null && (
            <p style={{ margin: "4px 0 0" }}>
              {tp("ownTitle", { before: money(p.feeBefore), after: money(p.proposedFee) })}
            </p>
          )}
          {p.reason && (
            <p style={{ margin: "4px 0 0" }}>
              {tp.rich("ownReason", {
                reason: p.reason,
                q: (chunks) => <q className="ds-ugc">{chunks}</q>,
              })}
            </p>
          )}
          {due === null && <p style={{ margin: "4px 0 0" }}>{tp("waiting")}</p>}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {can("pay") && p.topup && (
          <Button size="sm" leadingIcon="wallet" disabled={disabled} onClick={onPay}>
            {t("payAmount", { amount: money(p.topup.amount) })}
          </Button>
        )}
        {can("reject") && (
          <Button size="sm" variant="secondary" leadingIcon="x" disabled={disabled} onClick={onDecline}>
            {t("decline")}
          </Button>
        )}
        {can("edit") && (
          <Button size="sm" variant="secondary" leadingIcon="pencil" disabled={disabled} onClick={onEdit}>
            {tp("edit")}
          </Button>
        )}
        {can("withdraw") && (
          <Button size="sm" variant="ghost" leadingIcon="undo-2" disabled={disabled} onClick={onWithdraw}>
            {tp("withdraw")}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Errors after which the sheet has nothing left to offer: the parcel moved on,
 * someone else's change got there first, or the figure on screen is stale.
 * The sheet closes, the message is shown, and the order is re-read.
 */
const STALE_CODES: ReadonlySet<string> = new Set([
  "DELIVERY_FEE_PROPOSAL_ALREADY_PENDING",
  "DELIVERY_FEE_PROPOSAL_WINDOW_CLOSED",
  "DELIVERY_FEE_PROPOSAL_NOT_PAYER",
  "DELIVERY_FEE_PROPOSAL_ORDER_NOT_PAID",
  "DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH",
  "DELIVERY_FEE_PROPOSAL_NOT_PENDING",
  "DELIVERY_FEE_PROPOSAL_NOT_YOURS",
  "DELIVERY_FEE_TOPUP_IN_PROGRESS",
]);

/**
 * Proposing a fee, or editing one's own: the current fee, a whole amount and a
 * reason the company will read. The checks here only stop a figure the server
 * would refuse outright (not a whole number, the current fee, a reason outside
 * 3–500 characters); every other refusal is the server's, shown as it says it.
 */
function ProposeFeeSheet({
  orderId,
  currency,
  draft,
  onClose,
  onDone,
  onCapped,
  onStale,
}: {
  orderId: string;
  currency: string;
  draft: ProposalDraft;
  onClose: () => void;
  /** Sent — the toast to show, then the order is re-read. */
  onDone: (message: string) => void;
  /** `…_LIMIT_REACHED`: this parcel has had its two proposals. */
  onCapped: (shipmentId: string, message: string) => void;
  onStale: (message: string) => void;
}) {
  const tp = useTranslations("shop.delivery.propose");
  const tErrors = useTranslations("errors");
  const editing = draft.kind === "edit" ? draft.proposal : null;
  const currentFee = draft.kind === "edit" ? draft.currentFee : draft.shipment.fee;
  const shipmentId = draft.kind === "edit" ? draft.proposal.shipmentId : draft.shipment.shipmentId;

  const [amount, setAmount] = useState(editing ? String(editing.proposedFee) : "");
  const [reason, setReason] = useState(editing?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fee = parseWholeAmount(amount);
  const trimmed = reason.trim();
  const amountProblem =
    amount.trim() === "" ? null : fee === null ? tp("amountInvalid") : fee === currentFee ? tp("amountSame") : null;
  const reasonShort = trimmed.length > 0 && trimmed.length < REASON_MIN;
  const feeChanged = editing === null || fee !== editing.proposedFee;
  const reasonChanged = editing === null || trimmed !== (editing.reason ?? "").trim();
  const unchanged = editing !== null && !feeChanged && !reasonChanged;
  const valid = fee !== null && fee !== currentFee && reasonIsValid(reason) && !unchanged;

  const submit = async () => {
    if (!valid || fee === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        // Only what changed, and the version on screen: the company answers
        // the figure it saw, so every edit bumps it.
        await editDeliveryFeeProposal(orderId, editing.id, {
          ...(feeChanged ? { proposedFee: fee } : {}),
          ...(reasonChanged ? { reason: trimmed } : {}),
          version: editing.version,
        });
        onDone(tp("saved"));
      } else {
        await proposeDeliveryFee(orderId, shipmentId, { proposedFee: fee, reason: trimmed });
        onDone(tp("sent"));
      }
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : undefined;
      const message = translateError(tErrors, err, tp("failed"));
      if (code === "DELIVERY_FEE_PROPOSAL_LIMIT_REACHED") onCapped(shipmentId, message);
      else if (code && STALE_CODES.has(code)) onStale(message);
      else setError(message);
    }
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-strong)",
    marginBottom: 6,
  } as const;
  const formId = `fee-proposal-${shipmentId}`;

  return (
    <BottomSheet
      open
      onClose={() => !busy && onClose()}
      title={editing ? tp("editTitle") : tp("sheetTitle")}
      footer={
        <Button
          block
          size="lg"
          elevated
          type="submit"
          form={formId}
          leadingIcon="send"
          disabled={!valid || busy}
        >
          {busy ? tp(editing ? "saving" : "sending") : tp(editing ? "save" : "send")}
        </Button>
      }
    >
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 14px" }}>
        {tp("intro")}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          padding: "10px 12px",
          marginBottom: 16,
          borderRadius: "var(--radius-md)",
          background: "var(--bg-subtle)",
          border: "1px solid var(--border-subtle)",
          fontSize: 13.5,
        }}
      >
        <span>{tp("currentFee")}</span>
        <span style={{ fontWeight: 700, color: "var(--text-strong)", fontVariantNumeric: "tabular-nums" }}>
          {formatMoney(currentFee, currency)}
        </span>
      </div>

      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={`${formId}-amount`} style={labelStyle}>
          {tp("amountLabel", { currency: currencyLabel(currency) })}
        </label>
        <input
          id={`${formId}-amount`}
          className="field"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="next"
          dir="ltr"
          disabled={busy}
          aria-invalid={amountProblem !== null}
          aria-describedby={amountProblem ? `${formId}-amount-error` : undefined}
          style={{ fontVariantNumeric: "tabular-nums", fontSize: 16 }}
        />
        <p
          id={`${formId}-amount-error`}
          style={{
            fontSize: 12.5,
            lineHeight: 1.5,
            margin: "6px 0 16px",
            minHeight: 19,
            color: amountProblem ? "var(--danger)" : "var(--text-muted)",
          }}
        >
          {amountProblem ?? (fee !== null ? formatMoney(fee, currency) : "")}
        </p>

        <label htmlFor={`${formId}-reason`} style={labelStyle}>
          {tp("reasonLabel")}
        </label>
        <textarea
          id={`${formId}-reason`}
          className="field ds-ugc"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={REASON_MAX}
          placeholder={tp("reasonPlaceholder")}
          disabled={busy}
          aria-invalid={reasonShort}
          aria-describedby={`${formId}-reason-hint`}
          style={{ fontSize: 16 }}
        />
        <div
          id={`${formId}-reason-hint`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 12.5,
            lineHeight: 1.5,
            margin: "6px 0 0",
            color: reasonShort ? "var(--danger)" : "var(--text-muted)",
          }}
        >
          <span>{reasonShort ? tp("reasonTooShort", { min: REASON_MIN }) : tp("reasonHint")}</span>
          <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }} dir="ltr">
            {tp("reasonCount", { n: reason.length, max: REASON_MAX })}
          </span>
        </div>
      </form>

      {unchanged && (
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "12px 0 0" }}>
          {tp("nothingChanged")}
        </p>
      )}

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
            borderRadius: "var(--radius-md)",
            padding: "11px 13px",
            marginTop: 16,
          }}
        >
          <Icon name="triangle-alert" size={17} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>{error}</p>
        </div>
      )}
    </BottomSheet>
  );
}

/**
 * Paying the difference on an approved online increase.
 *
 * `POST …/:proposalId/pay` takes the body every payment door takes and answers
 * like `/payments/initiate`, so this is the order pay sheet's flow in a smaller
 * frame: the picker from `/options`, then whatever the answer's `instructions`
 * ask for — a card page, an SMS code, a page to open, or the prompt on the
 * phone, which is then watched through `POST /payments/verify` until it lands.
 * The parcel waits for this payment, which is why the sheet stays put rather
 * than handing off to the checkout success screen.
 */
function TopupSheet({
  orderId,
  proposal,
  open,
  onClose,
  onSettled,
}: {
  orderId: string;
  proposal: DeliveryFeeProposal;
  open: boolean;
  onClose: () => void;
  /** Paid — or no longer worth watching. Either way the order is re-read. */
  onSettled: () => void;
}) {
  const t = useTranslations("shop.delivery.topup");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const { flash } = useToast();
  const payOptions = usePaymentOptions(open);
  const payForm = useSavedPayment(payOptions.options, open);
  const { option, phone } = payForm;
  const refusal = useChargeRefusal(payOptions.applyOffered);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpFor, setOtpFor] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  /*
   * The parent hands over a fresh closure every render; the poll below must not
   * restart (and reset its count) each time it does, so it reads this ref.
   */
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  });

  const amount = proposal.topup?.amount ?? 0;
  const currency = proposal.currency;

  const pay = useCallback(async () => {
    const charge = option ? chargeRequest(option, phone) : null;
    if (!charge) return;
    setBusy(true);
    setError(null);
    try {
      const payment = await payDeliveryFeeTopup(orderId, proposal.id, charge);
      if (isSettledFailure(payment.status)) {
        setBusy(false);
        setError(payment.message ?? t("refused"));
        return;
      }
      const step = nextPaymentStep(payment.instructions);
      if (step.kind === "card") {
        router.push(await cardPagePath(payment.transactionId));
        return;
      }
      setBusy(false);
      if (step.kind === "otp") {
        setOtpFor(payment.transactionId);
        return;
      }
      if (step.kind === "redirect") setRedirectUrl(step.url);
      setWaitingFor(payment.transactionId);
    } catch (err) {
      setBusy(false);
      const code = err instanceof ApiError ? err.code : undefined;
      // Already paid, or no longer owed: there is nothing to do but re-read.
      if (code === "DELIVERY_FEE_TOPUP_NOT_DUE") {
        flash(t("notDue"));
        onSettled();
        return;
      }
      setError(refusal(err) ?? translateError(tErrors, err, t("startFailed")));
    }
  }, [option, phone, orderId, proposal.id, router, t, tErrors, refusal, flash, onSettled]);

  // Watch the prompt settle. A lost poll is not a failed payment.
  useEffect(() => {
    if (!waitingFor) return;
    let cancelled = false;
    let attempts = 0;
    const id = setInterval(async () => {
      attempts += 1;
      try {
        const result = await verifyPayment(waitingFor);
        if (cancelled) return;
        if (result.status === "SUCCEEDED") {
          clearInterval(id);
          flash(t("paid"));
          settledRef.current();
          return;
        }
        if (isSettledFailure(result.status)) {
          clearInterval(id);
          setWaitingFor(null);
          setRedirectUrl(null);
          setError(t("refused"));
          return;
        }
      } catch {
        /* keep watching */
      }
      if (attempts >= POLL_LIMIT) {
        clearInterval(id);
        if (!cancelled) {
          flash(t("stillPending"));
          settledRef.current();
        }
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [waitingFor, flash, t]);

  const phoneOk = option !== null && paymentReady(option, phone);
  const formShown = !otpFor && !waitingFor;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("title")}
      footer={
        formShown ? (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
                fontWeight: 800,
                color: "var(--text-strong)",
              }}
            >
              <span style={{ fontSize: 14 }}>{t("toPay")}</span>
              <span style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{formatMoney(amount, currency)}</span>
            </div>
            <Button
              block
              size="lg"
              elevated
              leadingIcon="lock"
              disabled={!payForm.ready || !phoneOk || busy}
              onClick={() => void pay()}
            >
              {busy ? t("starting") : t("payAmount", { amount: formatMoney(amount, currency) })}
            </Button>
          </>
        ) : undefined
      }
    >
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 16px" }}>
        {t("intro", { fee: formatMoney(proposal.proposedFee, currency) })}
      </p>

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
            borderRadius: "var(--radius-md)",
            padding: "11px 13px",
            marginBottom: 16,
          }}
        >
          <Icon name="triangle-alert" size={17} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>{error}</p>
        </div>
      )}

      {otpFor ? (
        <PaymentOtpStep
          transactionId={otpFor}
          onAuthorized={() => {
            setWaitingFor(otpFor);
            setOtpFor(null);
          }}
          onRestart={(reason) => {
            setOtpFor(null);
            setError(reason);
          }}
        />
      ) : waitingFor ? (
        redirectUrl ? (
          <PaymentRedirectPrompt url={redirectUrl} />
        ) : (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Icon name="smartphone" size={18} style={{ color: "var(--brand)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 14.5, fontWeight: 700, margin: "0 0 4px" }}>{t("checkPhoneTitle")}</p>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                {t("checkPhoneBody")}
              </p>
            </div>
          </div>
        )
      ) : payOptions.failed ? (
        <OptionsLoadFailed onRetry={payOptions.reload} />
      ) : payOptions.options?.length === 0 ? (
        <OnlinePaymentUnavailable />
      ) : payForm.ready && option && payOptions.options ? (
        <PaymentMethodPicker
          key={payForm.formKey}
          options={payOptions.options}
          value={option}
          onChange={payForm.setOption}
          phone={phone}
          onPhoneChange={payForm.setPhone}
          disabled={busy}
          saved={payForm}
        />
      ) : (
        <Skeleton height={180} />
      )}
    </BottomSheet>
  );
}
