"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AccountShell } from "@/components/shop/account/AccountShell";
import { Button, Icon } from "@/components/shop/ds";
import { useAuth } from "@/lib/auth/useAuth";
import { translateError } from "@/lib/auth/error-translator";
import {
  ACCOUNT_CLOSURE_CONFIRMATION,
  closeAccount,
} from "@/lib/shop/account-closure.api";

/**
 * Close account — the in-app path both app stores require.
 *
 * A screen rather than a dialog, deliberately. `ConfirmDialog` is the right
 * surface for "empty this cart"; this one has to carry a disclosure the shopper
 * can read at their own pace, and a typed confirmation that a sheet would crowd.
 * It is also what a store reviewer is sent to, and a reachable URL is easier to
 * hand over than a tap path.
 *
 * ── The wording is load-bearing ──────────────────────────────────────────────
 *
 * The backend anonymises and retains (ADR-A02 D-1) and forbids calling that a
 * deletion (D-2). The bullets below are the same promise the endpoint returns in
 * its own success message, split so each clause is separately readable — what
 * goes, what stays, and why it stays. Saying "your data will be deleted" here
 * would be the one thing the design refuses to do, and would be a false promise
 * to a store reviewer as much as to a shopper.
 */

/** What closing does, in the order someone worries about it. */
const CONSEQUENCES: { icon: string; text: string }[] = [
  {
    icon: "user-x",
    text: "Your name, phone number, email address and saved addresses are removed from your profile.",
  },
  {
    icon: "package",
    text:
      "Past orders are kept as business records, without your name or contact details — "
      + "sellers and delivery agencies need them for their own accounts.",
  },
  {
    icon: "log-out",
    text: "You are signed out everywhere, and you will not be able to sign in to this account again.",
  },
  {
    icon: "download",
    text: "Anything in your downloads library stops being available. Save what you want to keep first.",
  },
];

export default function CloseAccountPage() {
  const t = useTranslations("errors");
  const { logout } = useAuth();

  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compared against the constant rather than matched loosely: the backend
  // takes it as a `z.literal`, so a lowercase attempt is a round trip that can
  // only fail. Disabling until it matches keeps that failure off the wire.
  const confirmed = typed.trim() === ACCOUNT_CLOSURE_CONFIRMATION;

  async function submit() {
    if (!confirmed || busy) return;

    setBusy(true);
    setError(null);

    try {
      await closeAccount(typed.trim());

      /**
       * Every token minted before the closure is now refused, so the session
       * has to end here. `logout()` discards the stored pair *before* it calls
       * the endpoint, which is what makes this safe: the logout request itself
       * will 403 on a closed account, and that is caught and ignored.
       *
       * It then leaves through `/` — the locale bootstrap — rather than
       * `/shop`, which is a path the native export never writes.
       */
      await logout();
    } catch (err) {
      setError(translateError(t, err));
      // Deliberately not cleared on success: the page is navigating away, and
      // re-enabling the button would offer a second attempt at a closed account.
      setBusy(false);
    }
  }

  return (
    <AccountShell
      title="Close account"
      description="This cannot be undone."
    >
      <div
        style={{
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: 14,
            background: "var(--danger-bg)",
            borderBottom: "1px solid var(--danger-border)",
          }}
        >
          <Icon name="triangle-alert" size={20} style={{ color: "var(--danger)", flexShrink: 0 }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
            Closing your account cannot be undone. There is no way to reopen it, and you cannot
            sign in again with the same phone number or email.
          </p>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 14, display: "grid", gap: 13 }}>
          {CONSEQUENCES.map((c) => (
            <li key={c.icon} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <Icon
                name={c.icon}
                size={17}
                style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }}
              />
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text-body)" }}>
                {c.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 22 }}>
        <label
          htmlFor="closure-confirm"
          style={{
            display: "block",
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-strong)",
            marginBottom: 7,
          }}
        >
          Type <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
            {ACCOUNT_CLOSURE_CONFIRMATION}
          </span> to confirm
        </label>

        <input
          id="closure-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={error ? "closure-error" : undefined}
          placeholder={ACCOUNT_CLOSURE_CONFIRMATION}
          style={{
            width: "100%",
            height: 46,
            padding: "0 13px",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${confirmed ? "var(--danger)" : "var(--border)"}`,
            background: "var(--surface)",
            color: "var(--text-strong)",
            fontSize: 15,
            letterSpacing: 0.3,
          }}
        />

        {error && (
          <p
            id="closure-error"
            role="alert"
            style={{ color: "var(--danger)", fontSize: 13, marginTop: 9, lineHeight: 1.45 }}
          >
            {error}
          </p>
        )}

        <Button
          variant="danger"
          size="lg"
          block
          disabled={!confirmed || busy}
          onClick={() => void submit()}
          style={{ marginTop: 14 }}
        >
          {busy ? "Closing…" : "Close my account"}
        </Button>

        <p className="muted" style={{ fontSize: 12.5, textAlign: "center", marginTop: 12 }}>
          Orders still in progress have to finish before an account can be closed.
        </p>
      </div>
    </AccountShell>
  );
}
