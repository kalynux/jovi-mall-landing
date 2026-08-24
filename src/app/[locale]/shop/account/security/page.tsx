"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { ApiError } from "@/lib/auth/auth.types";
import {
  cancelEmailChange,
  cancelPhoneChange,
  confirmPhoneChange,
  getContact,
  requestEmailChange,
  requestPhoneChange,
  type ContactState,
  type PendingContactChange,
} from "@/lib/me/contact.api";
import { changePassword, PASSWORD_RULES, passwordMeetsPolicy } from "@/lib/me/password.api";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * Sign-in details: the email and phone the account is resolved by, and the
 * password.
 *
 * ── The identifier does not move until it is proved ──────────────────────────
 *
 * Every control here writes a **pending** change and nothing else. The current
 * email and phone keep signing the account in until a confirmation lands, which
 * is what makes a typo recoverable — the alternative, writing the new value and
 * flagging it unverified, locks the account out with the correction form behind
 * the sign-in.
 *
 * So the page always renders both: what you sign in with today, and what is
 * waiting to be proved.
 */
export default function SecurityPage() {
  const { status } = useAuthGuard();

  // Keyed on `status` so the read runs once the guard has a session, and again
  // if that session is re-established.
  const resource = useApiResource<ContactState>(() => getContact(), [status]);
  const contact = resource.data;

  const reload = useCallback(async () => {
    resource.reload();
  }, [resource]);

  if (status === "loading" || !contact) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
        <Skeleton height={120} style={{ marginBottom: 12 }} />
        <Skeleton height={120} style={{ marginBottom: 12 }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">Sign-in details</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EmailSection contact={contact} onChanged={reload} />
        <PhoneSection contact={contact} onChanged={reload} />
        <PasswordSection />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 800 }}>{title}</h2>
      {children}
    </section>
  );
}

function Pending({ change, note }: { change: PendingContactChange; note: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <Badge size="sm" tone="warning" icon="clock">
        Waiting on {change.target}
      </Badge>
      <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
        {note} Expires {new Date(change.expiresAt).toLocaleString()}.
      </p>
    </div>
  );
}

/** Maps the contract's error codes to instructions that differ from each other. */
function contactMessage(err: unknown): string {
  const code = err instanceof ApiError ? err.code : undefined;
  switch (code) {
    case "CONTACT_CHANGE_SAME_IDENTIFIER":
      return "That is already the value on your account.";
    case "CONTACT_CHANGE_IDENTIFIER_TAKEN":
      return "Another account already signs in with that.";
    case "CONTACT_CHANGE_NOT_PENDING":
      return "There is nothing waiting to be confirmed.";
    case "CONTACT_CHANGE_EXPIRED":
      // Deliberately not the same sentence as TOKEN_INVALID: "start again" and
      // "check the link" are different instructions to a person.
      return "That request expired. Start again.";
    case "CONTACT_CHANGE_TOKEN_INVALID":
      return "That link is not valid. Check you opened the most recent email.";
    case "CONTACT_CHANGE_PHONE_UNPROVEN":
      return "Connect that number on WhatsApp first, then come back and confirm.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function EmailSection({
  contact,
  onChanged,
}: {
  contact: ContactState;
  onChanged: () => Promise<void>;
}) {
  const { flash } = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await requestEmailChange(value.trim());
      setValue("");
      await onChanged();
      flash("Check your new address for a confirmation link.");
    } catch (err) {
      flash(contactMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelEmailChange();
      await onChanged();
    } catch (err) {
      flash(contactMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Email">
      <p style={{ margin: 0, fontSize: 14 }}>
        {contact.email ?? <span className="muted">No email on this account</span>}
      </p>

      {contact.pendingEmail ? (
        <>
          <Pending
            change={contact.pendingEmail}
            note="We sent a confirmation link there. Your current address still signs you in until it is used."
          />
          <div style={{ marginTop: 10 }}>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancel()}>
              Cancel this change
            </Button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: "1 1 200px" }}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="New email address"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button size="sm" disabled={!value.trim() || busy} onClick={() => void submit()}>
            {busy ? "Sending…" : "Change"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function PhoneSection({
  contact,
  onChanged,
}: {
  contact: ContactState;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const { flash } = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [unproven, setUnproven] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await requestPhoneChange(value.trim());
      setValue("");
      await onChanged();
    } catch (err) {
      flash(contactMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setUnproven(false);
    try {
      await confirmPhoneChange();
      await onChanged();
      flash("This is the number you sign in with now.");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      // The one refusal with somewhere to go: the fix is a WhatsApp connection,
      // so route there rather than repeating the error.
      if (code === "CONTACT_CHANGE_PHONE_UNPROVEN") setUnproven(true);
      else flash(contactMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelPhoneChange();
      setUnproven(false);
      await onChanged();
    } catch (err) {
      flash(contactMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Phone">
      <p style={{ margin: 0, fontSize: 14 }}>
        {contact.phone ?? <span className="muted">No phone on this account</span>}
      </p>

      {contact.pendingPhone ? (
        <>
          <Pending
            change={contact.pendingPhone}
            note="Message our WhatsApp bot from that number and connect it, then confirm below."
          />

          {unproven && (
            <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--danger)" }}>
              We could not find a WhatsApp connection for that number on your account. A Telegram
              connection does not count — a chat id says nothing about a phone number.
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Button size="sm" disabled={busy} onClick={() => void confirm()}>
              {busy ? "Checking…" : "Confirm"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              // Connections live on the notification settings screen, which is
              // where ChatChannels is mounted.
              onClick={() => router.push("/shop/account/notifications/settings")}
            >
              Connect WhatsApp
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancel()}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ flex: "1 1 200px" }}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+237 6XX XXX XXX"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button size="sm" disabled={!value.trim() || busy} onClick={() => void submit()}>
              {busy ? "Saving…" : "Change"}
            </Button>
          </div>
          {/* Said up front, because it is the part people do not expect: the
              proof is an inbound WhatsApp message, not a code we send. */}
          <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
            We confirm a new number by matching it to a WhatsApp connection on your account — there
            is no code to wait for.
          </p>
        </>
      )}
    </Card>
  );
}

function PasswordSection() {
  const { flash } = useToast();
  const [open, setOpen] = useState(false);
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = oldPassword.length > 0 && passwordMeetsPolicy(newPassword);

  const submit = async () => {
    setBusy(true);
    try {
      await changePassword(oldPassword, newPassword);
      setOld("");
      setNew("");
      setOpen(false);
      flash(
        IS_NATIVE_BUILD
          ? "Password changed. Please sign in again."
          : "Password changed. Your other devices have been signed out.",
      );
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      flash(
        code === "AUTH_INVALID_CREDENTIALS"
          ? "That current password is not right."
          : "Could not change your password. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Password">
      {/* Most customers have never set one: an account is created by the bot with
          a system-generated password and signs in with a magic link or code. */}
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        You normally sign in with a link or code from the bot. A password is only needed if you have
        set one.
      </p>

      {!open ? (
        <div style={{ marginTop: 10 }}>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Change password
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={oldPassword}
            onChange={(e) => setOld(e.target.value)}
          />
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />

          <ul style={{ margin: "2px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
            {PASSWORD_RULES.map((rule) => (
              <li
                key={rule.label}
                style={{
                  color: rule.test(newPassword) ? "var(--success)" : "var(--text-muted)",
                }}
              >
                {rule.label}
              </li>
            ))}
          </ul>

          {/* Stated before they commit, because it is a consequence they cannot
              undo and would otherwise discover on another device. */}
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
            {IS_NATIVE_BUILD
              ? "Changing this signs out every device, including this one."
              : "Changing this signs out every other device."}
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" disabled={!valid || busy} onClick={() => void submit()}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
