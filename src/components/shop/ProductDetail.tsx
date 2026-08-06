"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Chip,
  Icon,
  IconButton,
  PriceDisplay,
  ProductCard,
  QtyStepper,
  Rating,
  Tabs,
} from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { products } from "@/lib/shop/shop.fixtures";
import { findVendorById } from "@/lib/shop/shop.api";
import { discountPct, formatXAF } from "@/lib/shop/format";
import type { Product, Vendor } from "@/lib/shop/shop.types";

const REVIEWS: [string, number, string][] = [
  ["Aïcha N.", 5, "Exactly as described, fast delivery to Douala. Will buy again."],
  ["Samuel T.", 4, "Great quality. Sizing runs slightly large."],
  ["Fatou B.", 5, "Beautiful craftsmanship and the vendor answered on WhatsApp quickly."],
];

export function ProductDetail({ product: p, vendor: v }: { product: Product; vendor: Vendor }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const { flash } = useToast();

  const [vi, setVi] = useState(0);
  const [imgIndex, setImgIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("desc");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [booking, setBooking] = useState(false);

  const variant = p.variants[vi];
  const isService = p.type === "service";
  const isDigital = p.type === "digital";
  const deliveryFee = p.type === "physical" ? 1000 : 0;
  const serviceFee = Math.round(variant.price * 0.02);
  const total = variant.price * (isService ? 1 : qty) + deliveryFee + serviceFee;
  const pct = discountPct(p.price, p.compareAt);

  const related = useMemo(() => {
    const same = products.filter((x) => x.vendorId === p.vendorId && x.id !== p.id);
    const others = products.filter((x) => x.vendorId !== p.vendorId);
    return same.concat(others).slice(0, 6);
  }, [p]);

  const doAdd = () => {
    addToCart(p, variant, qty);
    flash(`Added to cart · ${variant.name}`);
  };

  const specTabLabel = isService ? "Policy" : "Delivery";
  const tabs = isDigital
    ? [
        { value: "desc", label: "Description" },
        { value: "specs", label: "What’s included" },
        { value: "reviews", label: "Reviews" },
      ]
    : [
        { value: "desc", label: "Description" },
        { value: "specs", label: "Specifications" },
        { value: "reviews", label: "Reviews" },
        { value: "delivery", label: specTabLabel },
      ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push("/shop")}
        className="mb-4 inline-flex items-center gap-1.5"
        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}
      >
        <Icon name="arrow-left" size={16} /> Back to shop
      </button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div style={{ position: "relative", background: "var(--surface-2)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.images[imgIndex]}
              alt={p.title}
              style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
            />
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
              <Badge productType={p.type} variant="solid">
                {p.type[0].toUpperCase() + p.type.slice(1)}
              </Badge>
              {pct && (
                <Badge tone="danger" variant="solid">
                  -{pct}%
                </Badge>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", scrollbarWidth: "none" }}>
            {p.images.map((im, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                style={{
                  flexShrink: 0,
                  width: 64,
                  height: 64,
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  border: imgIndex === i ? "2px solid var(--brand)" : "1.5px solid var(--border)",
                  padding: 0,
                  cursor: "pointer",
                  background: "none",
                }}
                aria-label={`Image ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        </div>

        {/* Info + buy box */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <button
            onClick={() => router.push(`/shop/stores/${v.slug}`)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "none", background: "none", cursor: "pointer", padding: 0, marginBottom: 10 }}
          >
            <Avatar name={v.name} size={24} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-body)" }}>{v.name}</span>
            {v.verified && <Icon name="badge-check" size={14} style={{ color: "var(--brand)" }} />}
            <Icon name="chevron-right" size={14} style={{ color: "var(--text-subtle)" }} />
          </button>

          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 10px", color: "var(--text-strong)" }}>
            {p.title}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Rating value={p.rating} count={p.reviews} compact />
            <span className="muted">· {p.sales} sold</span>
            <Badge tone="neutral" variant="outline" size="sm">
              {p.category}
            </Badge>
          </div>

          <div style={{ marginTop: 14 }}>
            <PriceDisplay amount={variant.price} compareAt={p.compareAt && vi === 0 ? p.compareAt : undefined} size="lg" />
          </div>

          {/* Variant selection */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Icon name="layers" size={16} style={{ color: "var(--brand)" }} />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--text-strong)" }}>
                {isService ? "Service option" : "Choose a variant"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.variants.map((vr, i) => (
                <Chip
                  key={vr.id}
                  selected={vi === i}
                  onClick={() => {
                    setVi(i);
                    setQty(1);
                  }}
                >
                  {vr.name} · {formatXAF(vr.price)}
                </Chip>
              ))}
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--text-body)",
                background: "var(--brand-subtle)",
                border: "1px solid var(--success-border)",
                borderRadius: "var(--radius-md)",
                padding: "9px 12px",
              }}
            >
              <Icon name="check" size={16} style={{ color: "var(--brand)" }} />
              <span>
                You’re buying: <strong>{variant.name}</strong>
              </span>
              {!isService && !isDigital &&
                (variant.stock <= 5 ? (
                  <span style={{ marginLeft: "auto", color: "var(--warning)", fontWeight: 700 }}>Only {variant.stock} left</span>
                ) : (
                  <span style={{ marginLeft: "auto", color: "var(--success)", fontWeight: 700 }}>In stock</span>
                ))}
            </div>
          </div>

          {/* Price breakdown */}
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => setShowBreakdown((s) => !s)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                padding: "12px 13px",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              <Icon name="receipt-text" size={17} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>Price breakdown</span>
              <span style={{ marginLeft: "auto", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--text-strong)" }}>
                {formatXAF(total)}
              </span>
              <Icon name={showBreakdown ? "chevron-up" : "chevron-down"} size={18} style={{ color: "var(--text-muted)" }} />
            </button>
            {showBreakdown && (
              <div
                className="fadein"
                style={{
                  border: "1px solid var(--border)",
                  borderTop: "none",
                  borderRadius: "0 0 var(--radius-md) var(--radius-md)",
                  padding: "4px 13px 12px",
                  marginTop: -6,
                }}
              >
                {(
                  [
                    [isService ? "Service price" : "Product price", variant.price],
                    !isService && qty > 1 ? [`Quantity × ${qty}`, variant.price * (qty - 1)] : null,
                    deliveryFee ? ["Delivery fee", deliveryFee] : null,
                    ["Taxes", 0],
                    ["Service fee", serviceFee],
                  ].filter(Boolean) as [string, number][]
                ).map(([l, val], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", fontSize: 13.5, color: "var(--text-body)" }}>
                    <span>{l}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{val === 0 ? "Free" : formatXAF(val)}</span>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "9px 0 0",
                    borderTop: "1px solid var(--border)",
                    marginTop: 4,
                    fontWeight: 800,
                    color: "var(--text-strong)",
                  }}
                >
                  <span>Grand total</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatXAF(total)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Buy actions */}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
            {isService ? (
              <Button block size="lg" elevated leadingIcon="calendar-clock" onClick={() => setBooking(true)}>
                Book now · {formatXAF(variant.price)}
              </Button>
            ) : (
              <>
                {p.type === "physical" && <QtyStepper value={qty} onChange={setQty} max={variant.stock || 10} />}
                <Button
                  block
                  size="lg"
                  elevated
                  leadingIcon={isDigital ? "download" : "shopping-cart"}
                  disabled={!p.inStock}
                  onClick={doAdd}
                >
                  {p.inStock
                    ? `Add to cart · ${formatXAF(variant.price * (p.type === "physical" ? qty : 1))}`
                    : "Out of stock"}
                </Button>
              </>
            )}
            <IconButton
              icon="heart"
              variant="fav"
              active={isFavorite(p.id)}
              onClick={() => toggle(p.id)}
              label="Save"
            />
          </div>

          {/* Type-specific info card */}
          <div style={{ marginTop: 18 }}>
            {p.type === "physical" && (
              <InfoCard title="Delivery" icon="truck">
                <InfoRow icon="building-2" label="Delivery agency" value={v.agency || "WiExpress"} />
                <InfoRow icon="coins" label="Delivery fee" value={formatXAF(deliveryFee)} />
                <InfoRow icon="clock" label="Estimated time" value="2–4 business days" />
                <InfoRow icon="map-pin" label="Regions" value="Douala, Yaoundé + nationwide" />
                <InfoRow icon="package-check" label="Options" value="Home delivery · Pickup available" />
              </InfoCard>
            )}
            {isDigital && (
              <InfoCard title="Digital delivery" icon="download">
                <InfoRow icon="file-down" label="Download" value={variant.format || "Instant download after payment"} />
                <InfoRow icon="key-round" label="License" value={p.digital!.license} />
                <InfoRow icon="clock" label="Access duration" value={p.digital!.access} />
                <InfoRow icon="repeat" label="Download limit" value={`${p.digital!.downloads} downloads`} />
                <InfoRow icon="monitor-smartphone" label="Platforms" value={p.digital!.platforms} />
              </InfoCard>
            )}
            {isService && (
              <InfoCard title="Booking" icon="calendar-clock">
                <InfoRow icon="clock" label="Duration" value={`${p.service!.duration} minutes`} />
                <InfoRow icon="map-pin" label="Location" value={p.service!.location} />
                <InfoRow icon="calendar-check" label="Booking mode" value="Instant confirmation" />
                <InfoRow icon="info" label="Note" value="Services are bookable only — not added to cart." />
              </InfoCard>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginTop: 32 }} className="max-w-3xl">
        <Tabs variant="pill" value={tab} onChange={setTab} tabs={tabs} />
        <div style={{ padding: "16px 2px 0", minHeight: 60 }}>
          {tab === "desc" && (
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-body)", margin: 0 }}>{p.desc}</p>
          )}
          {tab === "specs" && (
            <div>
              {(p.options.length ? p.options : [{ name: "Category", values: [p.category] }, { name: "Vendor", values: [v.name] }]).map(
                (o) => (
                  <InfoRow key={o.name} icon="dot" label={o.name} value={o.values.join(", ")} />
                ),
              )}
            </div>
          )}
          {tab === "reviews" && <ReviewsBlock rating={p.rating} count={p.reviews} />}
          {tab === "delivery" && (
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-body)", margin: 0 }}>
              {isService
                ? "Free cancellation up to 24h before your appointment. Rescheduling is subject to availability."
                : `Delivered by ${v.agency || "WiExpress"}. Returns accepted within 7 days of delivery for unused items in original packaging.`}
            </p>
          )}
        </div>
      </div>

      {/* Related */}
      <div style={{ marginTop: 32 }}>
        <p className="overline" style={{ marginBottom: 12 }}>
          Related products
        </p>
        <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
          {related.map((rp) => (
            <div key={rp.id} style={{ width: 190, flexShrink: 0 }}>
              <ProductCard
                title={rp.title}
                image={rp.images[0]}
                type={rp.type}
                price={rp.price}
                compareAt={rp.compareAt}
                rating={rp.rating}
                reviewCount={rp.reviews}
                vendorName={findVendorById(rp.vendorId)?.name}
                showVendor
                favorite={isFavorite(rp.id)}
                onToggleFavorite={() => toggle(rp.id)}
                inStock={rp.inStock}
                onQuickAdd={() =>
                  rp.type === "service" ? router.push(`/shop/products/${rp.slug}`) : addToCart(rp, rp.variants[0])
                }
                onClick={() => router.push(`/shop/products/${rp.slug}`)}
              />
            </div>
          ))}
        </div>
      </div>

      <BookingSheet open={booking} onClose={() => setBooking(false)} product={p} variantPrice={variant.price} onConfirm={() => flash("Booking confirmed — pay to secure it")} />
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <Icon name={icon} size={19} style={{ color: "var(--brand)", marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 14.5, color: "var(--text-strong)", fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 13px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Icon name={icon} size={17} style={{ color: "var(--brand)" }} />
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}>{title}</span>
      </div>
      <div style={{ padding: "2px 13px 6px" }}>{children}</div>
    </div>
  );
}

function ReviewsBlock({ rating, count }: { rating: number; count: number }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 0 14px" }}>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>{rating.toFixed(1)}</div>
        <div>
          <Rating value={rating} showValue={false} />
          <div className="muted" style={{ marginTop: 3 }}>
            {count} reviews
          </div>
        </div>
      </div>
      {REVIEWS.map(([n, r, t], i) => (
        <div key={i} style={{ padding: "12px 0", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar name={n} size={30} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{n}</span>
            <span style={{ marginLeft: "auto" }}>
              <Rating value={r} showValue={false} size={12} />
            </span>
          </div>
          <p style={{ margin: "7px 0 0", fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.5 }}>{t}</p>
        </div>
      ))}
    </div>
  );
}

function BookingSheet({
  open,
  onClose,
  product,
  variantPrice,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  variantPrice: number;
  onConfirm: () => void;
}) {
  const svc = product.service;
  const [step, setStep] = useState(0);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const days = ["Mon 14", "Tue 15", "Wed 16", "Thu 17", "Fri 18", "Sat 19"];
  const times = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00"];
  const canConfirm = date != null && time != null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Book appointment"
      footer={
        step < 1 ? (
          <Button block disabled={!canConfirm} onClick={() => setStep(1)}>
            Continue
          </Button>
        ) : (
          <Button
            block
            leadingIcon="check"
            onClick={() => {
              onClose();
              setStep(0);
              onConfirm();
            }}
          >
            Confirm booking · {formatXAF(variantPrice)}
          </Button>
        )
      }
    >
      {step === 0 && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.images[0]} alt="" style={{ width: 46, height: 46, borderRadius: "var(--radius-md)", objectFit: "cover" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{product.title}</div>
              <div className="muted">
                {svc?.duration} min · {formatXAF(variantPrice)}
              </div>
            </div>
          </div>
          <p className="overline" style={{ marginBottom: 8 }}>
            Select a date
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {days.map((d) => (
              <Chip key={d} selected={date === d} onClick={() => setDate(d)}>
                {d}
              </Chip>
            ))}
          </div>
          <p className="overline" style={{ marginBottom: 8 }}>
            Select a time
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {times.map((t) => (
              <Chip key={t} selected={time === t} onClick={() => setTime(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {step === 1 && (
        <div>
          <div
            style={{
              background: "var(--brand-subtle)",
              border: "1px solid var(--success-border)",
              borderRadius: "var(--radius-md)",
              padding: 12,
              marginBottom: 14,
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <Icon name="calendar-check" size={20} style={{ color: "var(--brand)" }} />
            <div>
              <div style={{ fontWeight: 700 }}>
                {date} · {time}
              </div>
              <div className="muted">
                {svc?.duration} min · {svc?.location}
              </div>
            </div>
          </div>
          <p className="overline" style={{ marginBottom: 8 }}>
            Notes for the vendor (optional)
          </p>
          <textarea
            className="field"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the stylist should know…"
            style={{ resize: "none" }}
          />
          <p className="muted" style={{ marginTop: 12, display: "flex", gap: 7 }}>
            <Icon name="info" size={15} style={{ marginTop: 1 }} />
            You’ll pay with mobile money or card after confirming.
          </p>
        </div>
      )}
    </BottomSheet>
  );
}
