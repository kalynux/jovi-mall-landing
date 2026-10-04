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
  getOrderDeliveryFees,
  payDeliveryFeeTopup,
  rejectDeliveryFee,
} from "@/lib/shop/delivery-fees.api";
import { formatMoney } from "@/lib/shop/format";
import { cardPagePath } from "@/lib/shop/pay-link.api";
import { isSettledFailure, nextPaymentStep, verifyPayment } from "@/lib/shop/payments.api";
import { useApiResource } from "@/lib/shop/useApiResource";
import type { CustomerOrder, DeliveryFeeProposal, OrderDeliveryFees } from "@/lib/shop/customer.types";

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
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const { flash, flashError } = useToast();
  const fees = useApiResource<OrderDeliveryFees>(() => getOrderDeliveryFees(order.id), [order.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState<DeliveryFeeProposal | null>(null);
  const [paying, setPaying] = useState<DeliveryFeeProposal | null>(null);

  const refresh = useCallback(() => {
    fees.reload();
    onChanged();
  }, [fees, onChanged]);

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
          flash(t("declined"));
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
    [order.id, flash, flashError, refresh, t, tErrors],
  );

  if (fees.status === "loading" && !fees.data) return null;
  const data = fees.data;
  // A failed read is not worth taking the order card down for; the receipt
  // above still carries the order's own delivery figures.
  if (!data) return null;

  const active = data.proposals.filter((p) => p.availableActions.length > 0);
  const history = data.proposals.filter((p) => p.availableActions.length === 0);
  const byHand = data.refunds.awaitingManual;
  if (active.length === 0 && history.length === 0 && byHand <= 0) return null;

  const money = (amount: number) => formatMoney(amount, data.currency);

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("title")}
      </p>

      {active.map((p) => (
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
              <span style={{ flex: 1, minWidth: 0 }}>{historyLine(t, p, money)}</span>
              <span style={{ flexShrink: 0 }}>
                {format.dateTime(new Date(p.respondedAt ?? p.createdAt), { day: "numeric", month: "short" })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={declining !== null}
        title={t("declineTitle")}
        tone="warning"
        icon="x"
        confirmLabel={t("decline")}
        cancelLabel={t("keepDeciding")}
        busy={busy !== null}
        onConfirm={() => declining && void answer(declining, "reject")}
        onCancel={() => setDeclining(null)}
      >
        {declining && t(declining.origin === "change_agency" ? "declineShopPays" : "declineCompany")}
      </ConfirmDialog>

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

/** One settled change, in a line. */
function historyLine(t: Translator, p: DeliveryFeeProposal, money: (n: number) => string): string {
  const values = { before: money(p.feeBefore), after: money(p.proposedFee) };
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
