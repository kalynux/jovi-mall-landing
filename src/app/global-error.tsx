"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The boundary of last resort: it catches failures in the root layout itself,
 * which is the one place the locale-level `error.tsx` cannot reach.
 *
 * By the time this renders, the layout that would have provided them is gone —
 * so there is no `NextIntlClientProvider` to read messages from, no
 * `ThemeProvider`, and no guarantee that globals.css was applied. Everything
 * here is therefore self-contained: its own `<html>`/`<body>`, inline styles,
 * a five-language dictionary, and `prefers-color-scheme` in place of the theme
 * class. It should never be seen; if it is, it must still be a sentence rather
 * than a stack trace.
 */

const COPY = {
  en: {
    lang: "en",
    dir: "ltr",
    title: "Something went wrong",
    body: "We hit an unexpected problem and could not finish loading Wi-Mall. It is usually temporary — please try again.",
    retry: "Try again",
    home: "Back to home",
  },
  fr: {
    lang: "fr",
    dir: "ltr",
    title: "Une erreur est survenue",
    body: "Un problème inattendu nous a empêchés de charger Wi-Mall. C'est généralement temporaire — veuillez réessayer.",
    retry: "Réessayer",
    home: "Retour à l'accueil",
  },
  pt: {
    lang: "pt",
    dir: "ltr",
    title: "Algo correu mal",
    body: "Ocorreu um problema inesperado e não conseguimos carregar a Wi-Mall. Normalmente é temporário — tente novamente.",
    retry: "Tentar novamente",
    home: "Voltar ao início",
  },
  es: {
    lang: "es",
    dir: "ltr",
    title: "Algo ha salido mal",
    body: "Se ha producido un problema inesperado y no hemos podido cargar Wi-Mall. Suele ser temporal: inténtalo de nuevo.",
    retry: "Reintentar",
    home: "Volver al inicio",
  },
  ar: {
    lang: "ar",
    dir: "rtl",
    title: "حدث خطأ ما",
    body: "واجهنا مشكلة غير متوقعة ولم نتمكن من تحميل Wi-Mall. عادةً ما تكون مؤقتة — يُرجى المحاولة مرة أخرى.",
    retry: "أعد المحاولة",
    home: "العودة إلى الصفحة الرئيسية",
  },
} as const;

type LocaleKey = keyof typeof COPY;

/**
 * Read straight off the URL rather than from `useLocale()`, which needs the
 * provider this page has just lost. An unprefixed path is English, matching
 * `localePrefix: "as-needed"` in i18n/routing.ts.
 */
function localeFromPath(pathname: string | null): LocaleKey {
  const segment = (pathname ?? "/").split("/")[1];
  return segment in COPY ? (segment as LocaleKey) : "en";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = COPY[localeFromPath(usePathname())];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={copy.lang} dir={copy.dir}>
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1rem",
          background: "#ffffff",
          color: "#0f1712",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          lineHeight: 1.6,
          textAlign: "center",
        }}
      >
        {/* Inline rather than a class: globals.css is not guaranteed here, and a
            visitor on dark mode should not be flashbanged by the failure page. */}
        <style>{`@media (prefers-color-scheme: dark){body{background:#0b0f0d!important;color:#e8efe9!important}
          .ge-secondary{border-color:#2a3430!important;color:#e8efe9!important}
          .ge-ref{color:#7d8a83!important}}`}</style>

        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ margin: "0 0 1rem", fontSize: "1.75rem", fontWeight: 700 }}>{copy.title}</h1>
          <p style={{ margin: "0 0 2rem", fontSize: "1rem", opacity: 0.8 }}>{copy.body}</p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.75rem",
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: 600,
                fontFamily: "inherit",
                color: "#ffffff",
                background: "linear-gradient(90deg, #068554, #0da06b)",
              }}
            >
              {copy.retry}
            </button>
            {/* A real document navigation, not `<Link>`: this boundary catches
                root-layout failures, and a client-side route transition would
                hand control back to the same tree that just threw. Reloading
                from scratch is the only escape that is certain to work. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              className="ge-secondary"
              href="/"
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.75rem",
                border: "1px solid #d8e0db",
                fontSize: "1rem",
                fontWeight: 600,
                color: "#0f1712",
                textDecoration: "none",
              }}
            >
              {copy.home}
            </a>
          </div>

          {error.digest && (
            <p
              className="ge-ref"
              style={{
                margin: "2rem 0 0",
                fontSize: "0.75rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: "#6b7770",
              }}
            >
              {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
