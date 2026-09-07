/**
 * `/pay/:token` — the hosted card page.
 *
 * ── Why it is here and not under `/shop/account` ─────────────────────────────
 *
 * Everything owner-scoped in the shop lives under `/shop/account`, which
 * `middleware.ts` gates on a session. This one deliberately does not: the whole
 * point of a pay link is that somebody **without an account** opens it — a
 * mother places an order, her son gets the link in a chat and pays. Building it
 * inside the signed-in tree would lock out the only person it is for. So it sits
 * at the top level beside `(auth)` and `(marketing)`, and is reached by anybody
 * holding the link.
 *
 * ── It was already live before this page existed ─────────────────────────────
 *
 * The bot's `payment_create_pay_link` tool and the catalogue's "Pay now" button
 * have been minting `{STOREFRONT_URL}/pay/{token}` and handing it to customers
 * in chat. The address was right and the page was missing.
 *
 * ── `noindex`, and deliberately NOT a robots.txt Disallow ───────────────────
 *
 * A pay link is pasted into WhatsApp and Telegram, both of which **fetch** the
 * URL to build a preview card — which is the reason the link points at the
 * storefront rather than the API in the first place. That fetch must not put a
 * live payment page into anybody's index.
 *
 * This is a server component, so it carries a real `noindex` rather than the
 * second-best Disallow the client-rendered shop screens have to settle for. And
 * it must stay that way round: adding `/pay` to `robots.ts` would block the very
 * fetch that lets a crawler read this header, so a URL picked up from an inbound
 * link could still be indexed with nothing to say otherwise. Same reasoning the
 * auth routes are excluded from that list for.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayLink } from "@/components/pay/PayLink";
import { isLocale } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Complete your payment",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <main className="mx-auto max-w-[480px] px-4 py-10 sm:px-6">
      <PayLink token={token} />
    </main>
  );
}
