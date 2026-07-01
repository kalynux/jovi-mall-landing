import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n-provider";
import { AuthProvider } from "@/lib/auth/useAuth";

export const metadata: Metadata = {
  title: "Jovi Mall — Commerce Runs on Conversation",
  description:
    "AI-powered ecommerce infrastructure built for WhatsApp-first Africa. Vendors sell without a website. Customers shop by chatting. Agencies and agents earn on every delivery.",
  keywords: [
    "WhatsApp ecommerce",
    "AI commerce Africa",
    "sell on WhatsApp",
    "mobile commerce Nigeria",
    "ecommerce platform Africa",
    "Jovi Mall",
  ],
  openGraph: {
    title: "Jovi Mall — Commerce Runs on Conversation",
    description: "The WhatsApp-first AI ecommerce platform built for Africa.",
    type: "website",
    siteName: "Jovi Mall",
  },
  twitter: {
    card: "summary_large_image",
    title: "Jovi Mall — Commerce Runs on Conversation",
    description: "The WhatsApp-first AI ecommerce platform built for Africa.",
  },
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
            __html: `(function(){try{var t=localStorage.getItem('jovi-theme');if(t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {/* Apply stored lang/dir before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('jovi-lang')||'en';var rtl=['ar'];document.documentElement.setAttribute('lang',l);document.documentElement.setAttribute('dir',rtl.includes(l)?'rtl':'ltr');}catch(e){}})()`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#7c3aed" />
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
