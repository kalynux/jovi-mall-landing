"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Icon } from "@/components/shop/ds";

/**
 * The end of the demo checkout.
 *
 * It used to claim "Payment received" and print order numbers
 * (`ORD-2026-000123`…) counted up from a query parameter. No payment was taken
 * and no order existed, so those numbers referred to nothing — a customer who
 * quoted one to support would be quoting a number the platform has never seen.
 *
 * The real version of this screen reads the `cartId` that
 * `POST /api/customer/orders/checkout` returns and links to
 * `/shop/account/orders/<cartId>`, where the genuine per-vendor order numbers
 * live. Until the catalogue and cart are wired, it says what actually happened.
 */
export default function SuccessPage() {
  const router = useRouter();
  const [count, setCount] = useState(1);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount(Math.max(1, Number(p.get("orders")) || 1));
  }, []);

  return (
    <div className="mx-auto flex max-w-[520px] flex-col items-center px-4 py-16 text-center sm:px-6">
      <div
        className="fadein"
        style={{
          width: 92,
          height: 92,
          borderRadius: "50%",
          background: "var(--warning-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <Icon name="eye" size={44} style={{ color: "var(--warning)" }} />
      </div>

      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: "0 0 6px",
          color: "var(--text-strong)",
        }}
      >
        End of the preview
      </h1>
      <p className="muted" style={{ maxWidth: 360, lineHeight: 1.55, margin: 0 }}>
        This is where your {count === 1 ? "order" : `${count} vendor orders`} would be confirmed and
        the {count === 1 ? "vendor" : "vendors"} notified on WhatsApp.{" "}
        <strong>No payment was taken and nothing was ordered</strong> — the marketplace catalogue is
        still being connected.
      </p>

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          marginTop: 20,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "13px 15px",
          textAlign: "left",
          display: "flex",
          gap: 10,
        }}
      >
        <Icon name="info" size={17} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
          Real orders appear under <strong>My orders</strong>, with their delivery progress and — for
          cash on delivery — the code to give the agent.
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 360,
          marginTop: 22,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Button block size="lg" onClick={() => router.push("/shop")}>
          Continue shopping
        </Button>
        <Button
          block
          variant="ghost"
          leadingIcon="receipt-text"
          onClick={() => router.push("/shop/account/orders")}
        >
          View my orders
        </Button>
      </div>
    </div>
  );
}
