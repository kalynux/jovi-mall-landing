"use client";
/**
 * AuthShowcase — the brand half of the split auth screen.
 *
 * Always dark emerald regardless of theme (the same always-dark treatment the
 * landing's final CTA section uses), so the light form pane next to it reads as
 * the "paper" side of the seam. Rendered only from `lg` up: below that the auth
 * card is the form alone.
 *
 * The copy tracks the role the visitor has picked, and it is the landing page's
 * own copy: each role's section headline, subtitle and three beats, pulled from
 * the namespace that section already owns. Nothing is duplicated into `auth`, so
 * the pitch a vendor reads here is the pitch they read on the way in — in every
 * locale, with no new strings to keep in sync. Before a role is chosen the
 * generic `auth.showcase*` copy stands in.
 *
 * The role also tints the panel: its accent drives the corner glow, the ring
 * medallion and the bullet icons, so choosing a role visibly changes the room.
 */
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  Bell,
  Bike,
  Bot,
  Building2,
  CreditCard,
  MapPin,
  MessageCircle,
  Package,
  Route,
  Sparkles,
  Store,
  Truck,
  Upload,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { UiRole } from "@/lib/auth/auth.types";
import { cn } from "@/lib/utils";

interface AuthShowcaseProps {
  mode: "login" | "register";
  /** Selected role, or null before the visitor has picked one. */
  role?: UiRole | null;
  className?: string;
}

/**
 * Per-role furniture. Colours are fixed hexes rather than the theme-aware
 * --accent-* vars: this panel is dark in both themes, so it needs the value
 * that reads on dark, not the one that flips with the page.
 */
const ROLE_VISUALS: Record<UiRole, { icon: React.ElementType; accent: string; pointIcons: React.ElementType[] }> = {
  vendor: { icon: Store, accent: "#22BD82", pointIcons: [Upload, Bot, Banknote] },
  agency: { icon: Building2, accent: "#7CB2FB", pointIcons: [Route, MapPin, Wallet] },
  agent: { icon: Bike, accent: "#FBBF24", pointIcons: [Bell, Package, Wallet] },
  customer: { icon: MessageCircle, accent: "#57D6A0", pointIcons: [MessageCircle, Sparkles, Truck] },
};

const DEFAULT_VISUALS = {
  icon: MessageCircle,
  accent: "#22BD82",
  pointIcons: [Bot, CreditCard, Bike] as React.ElementType[],
};

/** Ambient wash + grid. The trailing blob picks up the active role's accent. */
function ShowcaseBackdrop({ accent }: { accent: string }) {
  return (
    <>
      {/* Blurred brand blobs, echoing AuroraBackground on the landing page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/4 -left-1/4 h-[70%] w-[70%] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle at center, rgba(34,189,130,0.45), transparent 65%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-1/3 -right-1/4 h-[75%] w-[75%] rounded-full blur-3xl transition-colors duration-500"
        style={{ background: `radial-gradient(circle at center, ${accent}3D, transparent 65%)` }}
      />
      {/* Faint grid — the hero uses the same 60px lattice. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay" />
    </>
  );
}

/**
 * Corner ornament: concentric rings around the active role's glyph, bleeding
 * off the bottom-trailing corner. Purely decorative — it is the panel's anchor
 * weight, and the ring geometry is the same vocabulary as the landing's
 * OrbitalBackground.
 */
function ShowcaseOrnament({ icon: Icon, accent }: { icon: React.ElementType; accent: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-20 -end-20 z-0 h-64 w-64 xl:h-72 xl:w-72"
    >
      <div
        className="absolute inset-0 rounded-full blur-2xl transition-colors duration-500"
        style={{ background: `radial-gradient(circle at center, ${accent}40, transparent 68%)` }}
      />
      <div className="absolute inset-0 rounded-full border border-white/10" />
      <div className="absolute inset-[11%] rounded-full border border-white/[0.08]" />
      <div className="absolute inset-[22%] rounded-full border-2 border-dashed border-white/[0.07]" />
      <div
        className="absolute inset-[33%] grid place-items-center rounded-full border border-white/15"
        style={{ background: `linear-gradient(145deg, ${accent}2E, rgba(255,255,255,0.04))` }}
      >
        <Icon className="h-12 w-12 xl:h-14 xl:w-14 transition-colors duration-500" style={{ color: `${accent}D9` }} />
      </div>
      {/* Two beads riding the outer ring, as the orbital scene does. */}
      <span
        className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: accent, boxShadow: `0 0 12px 2px ${accent}80` }}
      />
      <span
        className="absolute left-0 top-[28%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/60"
      />
    </div>
  );
}

export default function AuthShowcase({ mode, role = null, className }: AuthShowcaseProps) {
  const t = useTranslations("auth");
  // One hook per role namespace — the landing sections own this copy, and it is
  // already translated everywhere, so the panel reads from them rather than
  // keeping a second set of strings under `auth`.
  const tVendor = useTranslations("vendor");
  const tAgency = useTranslations("agency");
  const tAgent = useTranslations("agent");
  const tCustomer = useTranslations("customer");

  const visuals = role ? ROLE_VISUALS[role] : DEFAULT_VISUALS;

  const content = useMemo(() => {
    switch (role) {
      case "vendor":
        return {
          eyebrow: tVendor("sectionLabel"),
          title: `${tVendor("title1")} ${tVendor("title2")}`,
          body: tVendor("subtitle"),
          points: [
            tVendor("steps.uploadTitle"),
            tVendor("steps.aiTitle"),
            tVendor("steps.revenueTitle"),
          ],
        };
      case "agency":
        return {
          eyebrow: tAgency("sectionLabel"),
          title: `${tAgency("title1")} ${tAgency("title2")}`,
          body: tAgency("subtitle"),
          points: [
            tAgency("benefits.dispatch"),
            tAgency("benefits.tracking"),
            tAgency("benefits.payout"),
          ],
        };
      case "agent":
        return {
          eyebrow: tAgent("sectionLabel"),
          title: `${tAgent("title1")} ${tAgent("title2")} ${tAgent("title3")}`,
          body: tAgent("subtitle"),
          points: [
            tAgent("steps.step01Title"),
            tAgent("steps.step02Title"),
            tAgent("steps.step03Title"),
          ],
        };
      case "customer":
        return {
          eyebrow: tCustomer("sectionLabel"),
          title: `${tCustomer("title1")} ${tCustomer("title2")}`,
          body: tCustomer("subtitle"),
          points: [
            tCustomer("benefits.chatTitle"),
            tCustomer("benefits.instantTitle"),
            tCustomer("benefits.deliveryTitle"),
          ],
        };
      default:
        return {
          eyebrow: t("showcaseEyebrow"),
          title: mode === "login" ? t("showcaseTitleLogin") : t("showcaseTitleRegister"),
          body: t("showcaseBody"),
          points: [t("showcasePoint1"), t("showcasePoint2"), t("showcasePoint3")],
        };
    }
  }, [role, mode, t, tVendor, tAgency, tAgent, tCustomer]);

  // Swapping role re-keys the copy so it cross-fades rather than snapping.
  const swapKey = role ?? `default-${mode}`;

  return (
    <div
      className={cn(
        "relative isolate flex h-full min-h-[520px] flex-col justify-center overflow-hidden p-10 text-white xl:p-12",
        className
      )}
      style={{ background: "linear-gradient(155deg, #06412E 0%, #066844 48%, #075138 100%)" }}
    >
      <ShowcaseBackdrop accent={visuals.accent} />
      <ShowcaseOrnament icon={visuals.icon} accent={visuals.accent} />

      <AnimatePresence mode="wait">
        <motion.div
          key={swapKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-w-[22rem]"
        >
          {/* The one badge style. This panel is dark in both themes, so the
              ink fill would sink into it and the tag takes the tag-on-dark
              inversion instead. That drops the role tint from the badge —
              white on #FBBF24 is ~1.9:1, so a tinted fill could not have
              kept .tag's white text anyway — and leaves the accent to the
              backdrop, the ornament and the bullet icons, none of which
              have to carry 11px text. The cross-fade is untouched: it is
              AnimatePresence re-keying this whole subtree, never a CSS
              colour interpolation, so there was nothing here to preserve. */}
          <div className="tag tag-on-dark">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {content.eyebrow}
          </div>

          <h2 className="mt-5 font-display text-[clamp(1.5rem,2.2vw,2rem)] font-bold leading-[1.15] text-white">
            {content.title}
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-white/70">{content.body}</p>

          <ul className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-6">
            {content.points.map((text, i) => {
              const Icon = visuals.pointIcons[i];
              return (
                <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 transition-colors duration-500"
                    style={{ backgroundColor: `${visuals.accent}1F` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: visuals.accent }} aria-hidden="true" />
                  </span>
                  {text}
                </li>
              );
            })}
          </ul>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
