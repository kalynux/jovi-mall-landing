"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Icon } from "@/components/shop/ds";

export default function SuccessPage() {
  const router = useRouter();
  const [orderNos, setOrderNos] = useState<string[]>([]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const n = Math.max(1, Number(p.get("orders")) || 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderNos(Array.from({ length: n }, (_, i) => `ORD-2026-${String(123 + i).padStart(6, "0")}`));
  }, []);

  return (
    <div className="mx-auto flex max-w-[520px] flex-col items-center px-4 py-16 text-center sm:px-6">
      <div
        className="fadein"
        style={{
          width: 92,
          height: 92,
          borderRadius: "50%",
          background: "var(--brand-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <Icon name="circle-check-big" size={48} style={{ color: "var(--brand)" }} />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px", color: "var(--text-strong)" }}>
        Payment received
      </h1>
      <p className="muted" style={{ maxWidth: 340, lineHeight: 1.5, margin: 0 }}>
        Thank you! We’ve created {orderNos.length} order{orderNos.length > 1 ? "s" : ""} and notified the vendor
        {orderNos.length > 1 ? "s" : ""} on WhatsApp.
      </p>

      <div style={{ width: "100%", maxWidth: 340, margin: "20px 0 0" }}>
        {orderNos.map((no) => (
          <div
            key={no}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "11px 13px",
              marginBottom: 8,
            }}
          >
            <Icon name="package" size={18} style={{ color: "var(--brand)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500 }}>{no}</span>
            <span style={{ marginLeft: "auto" }}>
              <Badge tone="info" size="sm" dot>
                Awaiting confirmation
              </Badge>
            </span>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: 340, marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <Button block size="lg" onClick={() => router.push("/shop")}>
          Continue shopping
        </Button>
        <Button block variant="ghost" leadingIcon="receipt-text" onClick={() => router.push("/shop/account")}>
          View my orders
        </Button>
      </div>
    </div>
  );
}
