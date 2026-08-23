"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AccountCard,
  AccountShell,
  CardAction,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Badge, BottomSheet, Button, ConfirmDialog, EmptyState, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import {
  addAddress,
  removeAddress,
  searchAddresses,
  setDefaultAddress,
} from "@/lib/shop/addresses.api";
import { getProfile } from "@/lib/shop/profile.api";
import { useApiResource } from "@/lib/shop/useApiResource";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { UseMyLocation } from "@/components/shop/account/UseMyLocation";
import type {
  CustomerProfile,
  GeoCandidate,
  SavedAddress,
} from "@/lib/shop/customer.types";

export default function AddressesPage() {
  const profile = useApiResource<CustomerProfile>(() => getProfile());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The address the shopper has asked to remove, held until they confirm. */
  const [pendingRemoval, setPendingRemoval] = useState<SavedAddress | null>(null);
  const { flash, flashError } = useToast();
  const t = useTranslations("errors");

  /**
   * Every address mutation answers with the whole updated profile, so the cache
   * is replaced rather than patched — that also keeps the `is_default` flip on
   * the *previous* default in sync without a second read.
   */
  const run = useCallback(
    async (id: string, op: () => Promise<CustomerProfile>, done: string) => {
      setBusyId(id);
      try {
        profile.set(await op());
        flash(done);
      } catch (err) {
        flashError(translateError(t, err, "We couldn't update your addresses."));
      } finally {
        setBusyId(null);
      }
    },
    [profile, flash, flashError, t],
  );

  return (
    <AccountShell
      title="Addresses"
      description="Where your orders are delivered."
      action={
        <Button size="sm" leadingIcon="plus" onClick={() => setSheetOpen(true)}>
          Add
        </Button>
      }
    >
      <ResourceView
        status={profile.status}
        error={profile.error}
        data={profile.data}
        onRetry={profile.reload}
        errorFallback="We couldn't load your addresses."
      >
        {(p) =>
          p.savedAddresses.length === 0 ? (
            <EmptyState
              icon="map-pin"
              title="No saved addresses"
              description="Add one now and it will be offered at checkout."
              actionLabel="Add an address"
              actionIcon="plus"
              onAction={() => setSheetOpen(true)}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {p.savedAddresses.map((a) => (
                <AddressRow
                  key={a._id}
                  address={a}
                  busy={busyId === a._id}
                  onMakeDefault={() =>
                    run(a._id, () => setDefaultAddress(a._id), "Default address updated")
                  }
                  onRemove={() => setPendingRemoval(a)}
                />
              ))}
            </div>
          )
        }
      </ResourceView>

      <AddAddressSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdded={(next) => {
          profile.set(next);
          setSheetOpen(false);
          flash("Address added");
        }}
      />

      {/* Removal is one tap from "Make default" on the same row, and a deleted
          address takes its geocode with it — re-entering one is a search, not a
          retype. So it asks. */}
      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove this address?"
        tone="danger"
        icon="trash-2"
        confirmLabel="Remove"
        cancelLabel="Keep it"
        busy={pendingRemoval !== null && busyId === pendingRemoval._id}
        onConfirm={async () => {
          const address = pendingRemoval;
          if (!address) return;
          await run(address._id, () => removeAddress(address._id), "Address removed");
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      >
        <strong>{pendingRemoval?.label}</strong> will no longer be offered at checkout. Orders
        already on their way to it are unaffected.
      </ConfirmDialog>
    </AccountShell>
  );
}

function AddressRow({
  address,
  busy,
  onMakeDefault,
  onRemove,
}: {
  address: SavedAddress;
  busy: boolean;
  onMakeDefault: () => void;
  onRemove: () => void;
}) {
  const lines = [
    address.address_line1,
    address.address_line2,
    [address.city, address.state].filter(Boolean).join(", "),
    address.country,
  ].filter(Boolean);

  return (
    <AccountCard>
      <div style={{ display: "flex", gap: 11 }}>
        <Icon name="map-pin" size={20} style={{ color: "var(--brand)", marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>
              {address.label}
            </span>
            {address.is_default && (
              <Badge size="sm" tone="brand">
                Default
              </Badge>
            )}
            {/* A geocoded address is what makes delivery routing work; a
                text-only one still delivers, but it is worth distinguishing. */}
            {address.geo && (
              <span
                className="muted"
                style={{ fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 3 }}
              >
                <Icon name="navigation" size={12} /> Located
              </span>
            )}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.5 }}>
            {lines.join(" · ")}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {!address.is_default && (
          <CardAction label="Make default" icon="check" disabled={busy} onClick={onMakeDefault} />
        )}
        <div style={{ flex: 1 }} />
        <CardAction label="Remove" icon="trash-2" danger disabled={busy} onClick={onRemove} />
      </div>
    </AccountCard>
  );
}

/**
 * Address entry, backed by `GET /api/geo/search`.
 *
 * The loose text fields stay editable because they are what is displayed, but
 * picking a search result is what attaches `geo` — the coordinates and provider
 * place id that delivery routing and proximity actually use. Typing an address
 * by hand is allowed and simply stores no `geo`.
 */
function AddAddressSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (profile: CustomerProfile) => void;
}) {
  const [label, setLabel] = useState("Home");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<GeoCandidate | null>(null);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const { flashError } = useToast();
  const t = useTranslations("errors");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (value: string) => {
    setQuery(value);
    setPicked(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    // Geocoding is a paid upstream call on some providers and rate-limited on
    // all of them — never one request per keystroke.
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchAddresses(value.trim()));
      } catch {
        setResults([]); // a failed lookup must not block manual entry
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const pick = (c: GeoCandidate) => {
    setPicked(c);
    setResults([]);
    setQuery(c.formatted_address);
    // Prefill from the structured components so the stored text and the
    // coordinates describe the same place.
    setLine1(c.components.street ?? c.formatted_address.split(",")[0] ?? "");
    setCity(c.components.city ?? "");
    setState(c.components.region ?? "");
  };

  const reset = () => {
    setLabel("Home");
    setQuery("");
    setResults([]);
    setPicked(null);
    setLine1("");
    setLine2("");
    setCity("");
    setState("");
    setIsDefault(false);
  };

  const canSave = label.trim().length > 0 && line1.trim().length > 0 && city.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const next = await addAddress({
        label: label.trim(),
        address_line1: line1.trim(),
        // Clearable fields: `null` clears, omitting leaves alone. On a create
        // there is nothing to leave alone, so an empty box means "not set".
        address_line2: line2.trim() || null,
        city: city.trim(),
        state: state.trim() || null,
        country: picked?.components.country_code ?? "CM",
        is_default: isDefault,
        geo: picked
          ? { ...picked, raw_input: query.trim() || null }
          : null,
      });
      reset();
      onAdded(next);
    } catch (err) {
      flashError(translateError(t, err, "We couldn't save that address."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Add an address"
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button block onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Save address"}
          </Button>
        </div>
      }
    >
      <Field label="Label">
        <input
          className="field"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Home, Work…"
          maxLength={50}
        />
      </Field>

      <Field label="Search for your address" hint="Pick a result to attach map coordinates.">
        <input
          className="field"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Start typing a street, area or landmark…"
          autoComplete="off"
        />

        {/*
          The GPS shortcut, and the reason it earns a location permission at all.

          Checkout REFUSES an address with no coordinates, and the only way to
          get them above is to describe where you live in words the geocoder
          recognises. Plenty of real addresses here are a landmark and a
          quartier, not a street and a number — and a shopper who cannot produce
          a match cannot check out. A coordinate from the handset skips the
          naming problem entirely, and comes back as the same `GeoCandidate` a
          picked search result produces, so everything downstream is unchanged.

          Rendered only where it can work: `IS_NATIVE_BUILD` is compile-time, so
          the web bundle never sees this button or the module behind it.
        */}
        {IS_NATIVE_BUILD && <UseMyLocation onResolved={pick} />}
        {searching && (
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Searching…
          </p>
        )}
        {results.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: "8px 0 0",
              padding: 0,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
            }}
          >
            {results.map((c, i) => (
              <li key={`${c.provider_place_id ?? "r"}-${i}`}>
                <button
                  onClick={() => pick(c)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: i < results.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    background: "var(--surface)",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13.5,
                    color: "var(--text-body)",
                  }}
                >
                  {c.formatted_address}
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && (
          <p
            className="muted"
            style={{ fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}
          >
            <Icon name="check" size={13} style={{ color: "var(--brand)" }} />
            Coordinates attached
          </p>
        )}
      </Field>

      <Field label="Address line 1">
        <input
          className="field"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          maxLength={200}
        />
      </Field>
      <Field label="Address line 2 (optional)">
        <input
          className="field"
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          maxLength={200}
        />
      </Field>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Field label="City">
            <input
              className="field"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
            />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Region (optional)">
            <input
              className="field"
              value={state}
              onChange={(e) => setState(e.target.value)}
              maxLength={100}
            />
          </Field>
        </div>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "8px 0",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-body)",
        }}
      >
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          style={{ width: 17, height: 17, accentColor: "var(--brand)" }}
        />
        Use as my default delivery address
      </label>
    </BottomSheet>
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
    <div style={{ marginBottom: 14 }}>
      <p className="ds-overline" style={{ marginBottom: 6 }}>
        {label}
      </p>
      {children}
      {hint && (
        <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
