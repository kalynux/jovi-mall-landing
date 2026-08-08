"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Icon } from "@/components/shop/ds";
import { useCart } from "@/components/shop/providers";
import { findProductById, findVendorById } from "@/lib/shop/shop.api";
import { formatXAF } from "@/lib/shop/format";
import { isValidPhone, toE164 } from "@/lib/phone";
import { PhoneField } from "@/components/ui/phone";
import type { CartItem, CartKey } from "@/lib/shop/shop.types";

function line(item: CartItem) {
  const p = findProductById(item.productId)!;
  const vr = p.variants.find((x) => x.id === item.variantId)!;
  return { p, vr };
}

interface VendorOrder {
  vendorId: string;
  type: CartKey;
  items: CartItem[];
  no: string;
}

const PAYMENTS: [string, string, string][] = [
  ["mtn", "MTN Mobile Money", "smartphone"],
  ["orange", "Orange Money", "smartphone"],
  ["card", "Card (Visa / Mastercard)", "credit-card"],
];

export default function CheckoutPage() {
  const router = useRouter();
  const { carts, clearCarts } = useCart();
  const [pay, setPay] = useState("mtn");
  /** International value from PhoneField — see src/lib/phone/README.md. */
  const [phone, setPhone] = useState("");
  const [total, setTotal] = useState(0);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get("total"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) setTotal(t);
  }, []);

  /** Mobile money debits a phone number; card does not. */
  const needsPhone = pay !== "card";

  const orders = useMemo<VendorOrder[]>(() => {
    const grouped: Record<string, VendorOrder> = {};
    (["physical", "digital"] as CartKey[]).forEach((key) => {
      carts[key].forEach((it) => {
        const { p } = line(it);
        const gkey = `${key}:${p.vendorId}`;
        (grouped[gkey] = grouped[gkey] || { vendorId: p.vendorId, type: key, items: [], no: "" }).items.push(it);
      });
    });
    return Object.values(grouped).map((o, i) => ({
      ...o,
      no: `ORD-2026-${String(123 + i).padStart(6, "0")}`,
    }));
  }, [carts]);

  useEffect(() => {
    if (orders.length === 0) router.replace("/shop/cart");
  }, [orders.length, router]);

  if (orders.length === 0) return null;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6">
      <button
        onClick={() => router.push("/shop/cart")}
        className="mb-4 inline-flex items-center gap-1.5"
        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}
      >
        <Icon name="arrow-left" size={16} /> Back to cart
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", marginBottom: 18 }}>Checkout</h1>

      {/* Address */}
      <p className="overline" style={{ marginBottom: 8 }}>
        Delivery address
      </p>
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 13, display: "flex", gap: 11, marginBottom: 20 }}>
        <Icon name="map-pin" size={20} style={{ color: "var(--brand)", marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Aïcha Ngo · +237 6 70 00 00 00</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            Akwa, Boulevard de la Liberté, Douala
          </div>
        </div>
        <button style={{ border: "none", background: "none", color: "var(--brand-hover)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Change
        </button>
      </div>

      {/* Payment */}
      <p className="overline" style={{ marginBottom: 8 }}>
        Payment method
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {PAYMENTS.map(([k, lb, ic]) => (
          <button
            key={k}
            onClick={() => setPay(k)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: 13,
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              textAlign: "left",
              background: "var(--surface)",
              border: pay === k ? "1.5px solid var(--brand)" : "1.5px solid var(--border)",
              boxShadow: pay === k ? "var(--focus-ring)" : "none",
            }}
          >
            <Icon name={ic} size={20} style={{ color: pay === k ? "var(--brand)" : "var(--text-muted)" }} />
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)" }}>{lb}</span>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: pay === k ? "6px solid var(--brand)" : "2px solid var(--border-strong)",
              }}
            />
          </button>
        ))}
      </div>
      {needsPhone ? (
        <div style={{ marginBottom: 20 }}>
          <PhoneField
            variant="stacked"
            label="Mobile money number"
            required
            name="momo-phone"
            autoComplete="tel"
            value={phone}
            onChange={setPhone}
            hint="The number the payment prompt will be sent to."
          />
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <input className="field" placeholder="Card number" style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field" placeholder="MM / YY" />
            <input className="field" placeholder="CVC" />
          </div>
        </div>
      )}

      {/* Summary */}
      <p className="overline" style={{ marginBottom: 8 }}>
        Order summary · {orders.length} vendor order{orders.length > 1 ? "s" : ""}
      </p>
      {orders.map((o) => {
        const sub = o.items.reduce((s, it) => s + line(it).vr.price * it.qty, 0);
        const vendor = findVendorById(o.vendorId);
        return (
          <div key={o.no} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Avatar name={vendor?.name ?? "?"} size={22} />
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{vendor?.name}</span>
              <span style={{ marginLeft: "auto" }}>
                <Badge productType={o.type} size="sm">
                  {o.type}
                </Badge>
              </span>
            </div>
            {o.items.map((it) => {
              const { p, vr } = line(it);
              return (
                <div key={it.variantId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-body)", padding: "2px 0" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                    {it.qty}× {p.title}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatXAF(vr.price * it.qty)}</span>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, borderTop: "1px solid var(--border-subtle)", marginTop: 6, paddingTop: 6 }}>
              <span>Order subtotal</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatXAF(sub)}</span>
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 7, marginTop: 8, marginBottom: 20 }}>
        <Icon name="shield-check" size={16} style={{ color: "var(--brand)", marginTop: 1 }} />
        <span className="muted" style={{ fontSize: 12.5 }}>
          Split into one order per vendor — each ships independently. You’re charged once for the group.
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "sticky", bottom: 0 }} className="stickybar rounded-t-2xl">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>Total</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatXAF(total)}</div>
        </div>
        <Button
          size="lg"
          elevated
          leadingIcon="lock"
          // Mobile money charges the number typed here, so an incomplete one
          // must not be payable. Card has its own fields and no phone.
          disabled={needsPhone && !isValidPhone(phone)}
          title={needsPhone && !isValidPhone(phone) ? "Enter a valid mobile money number" : undefined}
          onClick={() => {
            // Whatever a payment call ends up being wired to, it receives
            // E.164 — the same normalisation every other form applies.
            const momoNumber = needsPhone ? toE164(phone) : null;
            if (needsPhone && !momoNumber) return;

            clearCarts();
            router.push(`/shop/checkout/success?orders=${orders.length}&total=${total}`);
          }}
        >
          Pay {formatXAF(total)}
        </Button>
      </div>
    </div>
  );
}
