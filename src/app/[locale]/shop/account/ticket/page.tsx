import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketDetailClient } from "@/components/shop/account/QueryScreens";
import { isLocale } from "@/i18n/routing";

/**
 * `/shop/account/ticket?id=<ticketId>` — the app's support thread.
 *
 * Server wrapper only, so it can carry the `noindex` a client component cannot
 * export. Everything under `/shop/account` is owner-scoped and already
 * `Disallow`ed in robots.txt; this says so in the page as well, because a
 * disallowed URL can still be indexed from an inbound link.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <TicketDetailClient />;
}
