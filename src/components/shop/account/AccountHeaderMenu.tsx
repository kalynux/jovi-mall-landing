"use client";

import { useState } from "react";
import { ConfirmDialog, IconButton, MenuSheet } from "@/components/shop/ds";
import { useAuth } from "@/lib/auth/useAuth";

/**
 * The account screen's overflow menu, in the header bar.
 *
 * It carries the two actions that must be reachable but must not be browsable:
 * signing out and closing the account. Neither is a row in the settings list
 * any more — a red "Close account" standing under Addresses and Payment methods
 * made deleting the account look like one of the six things the screen is for,
 * and a sign-out row is one mis-tap away from ending a session someone did not
 * mean to end.
 *
 * Both now cost a deliberate second tap, which is what a rare action should
 * cost. Sign out asks first; Close account opens the screen that carries the
 * full disclosure and its own typed confirmation.
 */
export function AccountHeaderMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { logout } = useAuth();

  const signOut = async () => {
    setSigningOut(true);
    try {
      // Leaves the app on its own — `logout()` discards the stored bearer pair
      // before it calls the endpoint and then navigates. Nothing to reset here:
      // this component goes with the page.
      await logout();
    } catch {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  };

  return (
    // The dropdown half of MenuSheet positions against the nearest positioned
    // ancestor, so the trigger needs one of its own.
    <div style={{ position: "relative" }}>
      <IconButton
        icon="ellipsis-vertical"
        variant="plain"
        label="Account options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      />

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Account options"
        items={[
          {
            icon: "log-out",
            label: "Sign out",
            description: "Ends this session on this device.",
            onClick: () => setConfirmSignOut(true),
          },
          {
            icon: "user-x",
            label: "Close account",
            href: "/shop/account/close",
            danger: true,
            // NOT "permanently delete": the backend anonymises and RETAINS (ADR-A02
            // D-1), and D-2 forbids describing that as a deletion. The screen this row
            // opens says "past orders are kept as business records" — a sheet promising
            // deletion one tap earlier contradicts it, and the promise it makes is the
            // one we cannot keep.
            description: "Anonymises your details. Past orders are kept as business records.",
          },
        ]}
      />

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        tone="warning"
        icon="log-out"
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        busy={signingOut}
        onConfirm={() => void signOut()}
        onCancel={() => setConfirmSignOut(false)}
      >
        You&apos;ll need the bot&apos;s sign-in link or code to get back in. Your cart, saved
        addresses and orders stay on your account.
      </ConfirmDialog>
    </div>
  );
}
