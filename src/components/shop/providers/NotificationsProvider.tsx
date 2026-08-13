"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { getUnreadCount } from "@/lib/shop/notifications.api";

interface NotificationsContextValue {
  /** Unread notifications. `0` for anonymous visitors and while the session resolves. */
  unread: number;
  /** Re-read the count from the server. */
  refresh: () => void;
  /** Apply a known count locally — e.g. right after mark-all-read. */
  setUnread: (n: number) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

/**
 * Holds the header's unread badge.
 *
 * Two things this deliberately does not do:
 *
 *  - **It never calls the API without a session.** `/api/customer/notifications`
 *    is `requireRole(['customer'])`, so firing it for the anonymous majority of
 *    shop traffic would buy a 401 on every page view for nothing.
 *  - **It does not poll.** Customers get 600 requests/min across the whole API,
 *    and a background timer competes with the requests the user is waiting on.
 *    The count refreshes when the role changes and whenever a page that mutates
 *    read-state asks it to.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, role } = useAuth();
  const [fetched, setFetched] = useState(0);
  const [nonce, setNonce] = useState(0);

  const eligible = status === "authenticated" && role === "customer";

  // Derived rather than stored, so signing out or switching role clears the
  // badge in the same render instead of through a second setState pass.
  const unread = eligible ? fetched : 0;

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    getUnreadCount()
      .then((n) => {
        if (!cancelled) setFetched(n);
      })
      // A badge is not worth surfacing an error for — it just stays at zero.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [eligible, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo<NotificationsContextValue>(
    () => ({ unread, refresh, setUnread: setFetched }),
    [unread, refresh],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}
