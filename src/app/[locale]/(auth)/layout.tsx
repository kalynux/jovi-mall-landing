import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";

/**
 * Server layout so it can carry metadata; the chrome itself is in AuthShell,
 * which needs "use client".
 *
 * noindex rather than a robots.txt Disallow: a disallowed URL can still be
 * indexed on the strength of inbound links, because the crawler never fetches
 * the page to learn otherwise. These routes are therefore left crawlable so the
 * tag can actually be read — see the note in app/robots.ts. `follow` stays on so
 * link equity still flows back to the landing page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
