"use client";
import Link from "next/link";
import { Zap, Twitter, Linkedin, Instagram } from "lucide-react";
import { BRAND } from "@/lib/constants";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("navbar");

  const footerLinks = [
    {
      label: t("platform"),
      links: [
        { label: nav("howItWorks"), href: "#how-it-works" },
        { label: nav("forVendors"), href: "#vendors" },
        { label: nav("forAgencies"), href: "#agencies" },
        { label: nav("forAgents"), href: "#agents" },
      ],
    },
    {
      label: t("company"),
      links: [
        { label: t("about"), href: "#" },
        { label: t("blog"), href: "#" },
        { label: t("careers"), href: "#" },
        { label: t("contact"), href: "#" },
      ],
    },
    {
      label: t("legal"),
      links: [
        { label: t("privacy"), href: "#" },
        { label: t("terms"), href: "#" },
        { label: t("cookies"), href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-[var(--bg-subtle)] border-t border-[var(--border-medium)] pt-16 pb-8">
      <div className="container-xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[var(--border)]">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4 group" aria-label={t("logoAriaLabel")}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-primary group-hover:scale-110 transition-transform duration-200">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-lg text-[var(--text-primary)]">{BRAND.name}</span>
            </Link>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-xs">
              {BRAND.description}
            </p>
            <div className="flex gap-3 mt-6">
              {[Twitter, Linkedin, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-lg border border-[var(--border-medium)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-primary-400/50 hover:bg-[var(--accent-light)] transition-all duration-200"
                  aria-label={t("socialAriaLabel")}
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {footerLinks.map((group) => (
            <div key={group.label}>
              <h3 className="font-display font-semibold text-xs text-[var(--text-muted)] mb-4 uppercase tracking-widest">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:text-primary-600 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[var(--text-muted)] text-xs">
          <p>© {new Date().getFullYear()} {BRAND.name}. {t("copyright")}</p>
          <p>{t("builtFor")}</p>
        </div>
      </div>
    </footer>
  );
}
