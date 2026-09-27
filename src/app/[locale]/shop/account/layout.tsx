import type { ReactNode } from "react";
import { CustomerOnlyGate } from "@/components/shop/CustomerOnlyNotice";

/**
 * Every `/shop/account/*` screen is a customer's, and says so once, here.
 *
 * The middleware already sends a visitor with no session to sign in. This is
 * the other half: a visitor WITH a session, scoped to a vendor, an agency or an
 * agent, whose every request below would come back `403 AUTH_ROLE_NOT_FOUND`.
 * They get one screen explaining that and offering the way across, instead of
 * a "Try again" that could never work. See `CustomerOnlyGate`.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <CustomerOnlyGate>{children}</CustomerOnlyGate>;
}
