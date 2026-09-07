/**
 * `/shop/account/order/detail?id=<orderId>` — the app's single-order page.
 *
 * Server wrapper only, so it can carry the `noindex` a client component cannot
 * export. Everything under `/shop/account` is owner-scoped and already
 * `Disallow`ed in robots.txt; this says so in the page as well, because a
 * disallowed URL can still be indexed from an inbound link.
 *
 * ⚠ **`id` here is an `orderId`, not the `cartId` its neighbour one level up
 * takes.** `/shop/account/order?id=` is the checkout group; this is one seller's
 * order inside it. Swapping them resolves nothing.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetailClient } from "@/components/shop/account/QueryScreens";
import { isLocale } from "@/i18n/routing";

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

  return <OrderDetailClient />;
}
