import type { ReactNode } from "react";
import { CustomerOnlyGate } from "@/components/shop/CustomerOnlyNotice";

/**
 * Checkout is `requireRole(['customer'])` end to end — the quote, the orders,
 * the payment — so a business session is told so before any of it runs, rather
 * than filling in a form whose submit answers `AUTH_ROLE_NOT_FOUND`.
 *
 * Mounted on the layout, not the page, so the page's empty-cart redirect never
 * fires for that session either: a vendor holding a signed-out basket is shown
 * the way to a customer session, not bounced back to the cart. The same gate
 * covers `/shop/account`; see `CustomerOnlyGate`.
 */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <CustomerOnlyGate>{children}</CustomerOnlyGate>;
}
