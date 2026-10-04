import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountClosedNotice } from "@/components/shop/AccountClosedNotice";
import { isLocale } from "@/i18n/routing";

/**
 * `/shop/account-closed` — where a session whose shopping account was closed
 * lands (ADR-A10): after confirming an administrator's request, or on any
 * `403 AUTH_ROLE_CLOSED` / `AUTH_ACCOUNT_CLOSED` inside the shop
 * (`AuthProvider`). `?all=1` when the whole account is gone.
 *
 * Outside `/shop/account` on purpose — see `ACCOUNT_CLOSED_PATH`. robots.txt
 * already disallows it (the `/shop/account` rule is a prefix match); this
 * carries the noindex that works even when a link to it is crawled.
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

  return <AccountClosedNotice />;
}
