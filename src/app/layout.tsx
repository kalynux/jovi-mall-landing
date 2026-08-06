import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n-provider";
import { AuthProvider } from "@/lib/auth/useAuth";

/**
 * Absolute origin for share metadata. Crawlers reject the relative URLs Next
 * would otherwise emit for og:image, so this has to resolve even in preview
 * builds — hence the fallback rather than a bare env read.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wimall.com";

// icon.svg, favicon.ico, apple-icon.png, opengraph-image.png and
// twitter-image.png sit beside this file; Next picks them up by convention and
// emits the tags. Regenerate them from AppIcons/ with `npm run gen:app-icons`.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "WiMall — Commerce Runs on Conversation",
  description:
    "AI-powered ecommerce infrastructure for WhatsApp-first businesses. Vendors sell without a website. Customers shop by chatting. Agencies and agents earn on every delivery.",
  keywords: [
    "WhatsApp ecommerce",
    "AI commerce",
    "sell on WhatsApp",
    "mobile commerce",
    "ecommerce platform",
    "WiMall",
  ],
  openGraph: {
    title: "WiMall — Commerce Runs on Conversation",
    description: "The WhatsApp-first AI ecommerce platform for modern businesses.",
    type: "website",
    siteName: "WiMall",
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "WiMall — Commerce Runs on Conversation",
    description: "The WhatsApp-first AI ecommerce platform for modern businesses.",
  },
  alternates: { canonical: "/" },
  applicationName: "WiMall",
  appleWebApp: { capable: true, title: "WiMall", statusBarStyle: "default" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className="scroll-smooth" suppressHydrationWarning>
      <head>
        {/* Prevent FOUC: apply stored theme class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('wimall-theme');if(t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {/* Apply stored lang/dir before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('wimall-lang')||'en';var rtl=['ar'];document.documentElement.setAttribute('lang',l);document.documentElement.setAttribute('dir',rtl.includes(l)?'rtl':'ltr');}catch(e){}})()`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#068554" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
