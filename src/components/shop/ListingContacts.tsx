"use client";

import { useCallback, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, Icon, Skeleton } from "@/components/shop/ds";
import { CustomerOnlyNotice } from "@/components/shop/CustomerOnlyNotice";
import { useToast } from "@/components/shop/providers";
import { useAuth } from "@/lib/auth/useAuth";
import { translateError } from "@/lib/auth/error-translator";
import { isBusinessSession, isCustomerSession } from "@/lib/shop/customer-session";
import { tapFeedback } from "@/lib/native/haptics";
import { openApp, openExternal } from "@/lib/native/links";
import { copyLink } from "@/lib/native/share";
import { HAS_MAP_TILES, MAP_HEIGHT } from "@/lib/shop/map";
import { revealListingContact, setListingConsent } from "@/lib/shop/listings.api";
import {
  drawableFields,
  FIELD_ICON,
  fieldLabelKey,
  hasPin,
  mapHref,
  safeHttpUrl,
  telHref,
  whatsappHref,
  type ListingContactField,
  type PublicListingDetail,
  type RevealResult,
} from "@/lib/shop/listings";
import { LISTING_CONSENTS_PATH } from "@/lib/shop/shop.routes";

/** Loaded only once a location has been unlocked; see the component's note. */
const ListingPlaceMap = dynamic(() => import("./ListingPlaceMap"), {
  ssr: false,
  loading: () => <Skeleton height={Math.round(MAP_HEIGHT * 0.85)} radius={12} />,
});

/**
 * The contact buttons on a listing page, one per `availableFields` entry.
 *
 * ── Three audiences ──────────────────────────────────────────────────────────
 *
 * - **Signed out:** every row says "Sign in to contact" and goes to sign-in,
 *   coming back here. The row still names WHICH detail, so a visitor can see
 *   that a WhatsApp number exists before deciding to sign in.
 * - **A business session** (vendor/agency/agent): the reveal is customer-only,
 *   so the shop's standard "switch to your customer account" notice replaces
 *   the rows rather than seven buttons that would each fail.
 * - **A customer:** a tap unlocks that one detail.
 *
 * ── What is never on screen ──────────────────────────────────────────────────
 *
 * ⛔ No price and no credit cost, on a button or anywhere near one. The
 * customer pays nothing; `charged`/`cost` describe the business's bill and are
 * not even on the client type.
 *
 * ⛔ A revealed value lives in this component's state and dies with the page.
 * No storage, no cache, no URL. Asking again within 30 days is free for the
 * business, so a reload costs nobody anything.
 *
 * ── The opt-in question ──────────────────────────────────────────────────────
 *
 * When an answer carries `askConsent: true` (once per business, on the first
 * unlock), the question appears inline under the rows, not in a modal: the
 * contact the customer just unlocked must stay usable while it is asked, and
 * leaving it unanswered is the default of "no".
 */

type FieldState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "revealed"; result: RevealResult }
  | { status: "error"; message: string };

type ConsentState = {
  vendorId: string;
  status: "asking" | "saving" | "granted" | "declined";
  error?: string;
};

export function ListingContacts({ listing }: { listing: PublicListingDetail }) {
  const t = useTranslations("shop.listings");
  const tKey = useTranslations();
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const { status, role } = useAuth();

  const fields = drawableFields(listing.availableFields);
  const [states, setStates] = useState<Partial<Record<ListingContactField, FieldState>>>({});
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const business = listing.companyName || listing.title;

  const reveal = useCallback(
    async (field: ListingContactField) => {
      void tapFeedback();
      setStates((prev) => ({ ...prev, [field]: { status: "loading" } }));
      try {
        const result = await revealListingContact(listing.id, field);
        setStates((prev) => ({ ...prev, [field]: { status: "revealed", result } }));
        if (result.askConsent && result.consentVendorId) {
          setConsent((prev) => prev ?? { vendorId: result.consentVendorId!, status: "asking" });
        }
      } catch (error) {
        setStates((prev) => ({
          ...prev,
          [field]: { status: "error", message: translateError(tErrors, error, t("revealFailed")) },
        }));
      }
    },
    [listing.id, t, tErrors]
  );

  const answer = useCallback(
    async (granted: boolean) => {
      if (!consent) return;
      setConsent({ ...consent, status: "saving", error: undefined });
      try {
        await setListingConsent(consent.vendorId, granted);
        setConsent({ vendorId: consent.vendorId, status: granted ? "granted" : "declined" });
      } catch (error) {
        setConsent({
          ...consent,
          status: "asking",
          error: translateError(tErrors, error, t("consent.saveFailed")),
        });
      }
    },
    [consent, t, tErrors]
  );

  const signIn = () => {
    const here = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?return=${encodeURIComponent(here)}&role=customer`);
  };

  if (fields.length === 0) {
    return (
      <Panel title={t("contactTitle")}>
        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          {t("noContacts")}
        </p>
      </Panel>
    );
  }

  if (status === "loading") {
    return (
      <Panel title={t("contactTitle")}>
        <div style={{ display: "grid", gap: 8 }}>
          {fields.map((field) => (
            <Skeleton key={field} height={56} radius={12} />
          ))}
        </div>
      </Panel>
    );
  }

  if (isBusinessSession(status, role)) {
    return (
      <Panel title={t("contactTitle")}>
        <CustomerOnlyNotice headingLevel={2} />
      </Panel>
    );
  }

  const customer = isCustomerSession(status, role);

  return (
    <Panel title={t("contactTitle")}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
        {fields.map((field) => {
          const state = states[field] ?? { status: "idle" };
          const label = tKey(fieldLabelKey(field));

          if (state.status === "revealed") {
            return (
              <li key={field}>
                <RevealedRow result={state.result} label={label} business={business} />
              </li>
            );
          }

          return (
            <li key={field}>
              <button
                type="button"
                className="listing-contact-row"
                onClick={customer ? () => void reveal(field) : signIn}
                disabled={state.status === "loading"}
                aria-busy={state.status === "loading" || undefined}
              >
                <span className="listing-contact-row__icon" aria-hidden="true">
                  <Icon name={FIELD_ICON[field]} size={19} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--text-strong)" }}>
                    {label}
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>
                    {customer ? t(`fieldHint.${field}`) : t("signInToContact")}
                  </span>
                </span>
                <span className="listing-contact-row__action">
                  {state.status === "loading" ? (
                    <Icon name="loader" size={17} className="animate-spin" />
                  ) : customer ? (
                    <>
                      {t("show")}
                      <Icon name="lock-open" size={15} />
                    </>
                  ) : (
                    <Icon name="lock" size={15} />
                  )}
                </span>
              </button>
              {state.status === "error" && (
                <p role="alert" className="listing-contact-row__error">
                  <Icon name="circle-alert" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{state.message}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p
        style={{
          margin: "12px 0 0",
          display: "flex",
          gap: 6,
          fontSize: 12.5,
          lineHeight: 1.5,
          color: "var(--text-muted)",
        }}
      >
        <Icon name="info" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{t("privacyNote")}</span>
      </p>

      {consent && <ConsentPrompt business={business} state={consent} onAnswer={answer} />}
    </Panel>
  );
}

/* ─── The panel ───────────────────────────────────────────────────────────── */

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby="listing-contacts-heading"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h2
        id="listing-contacts-heading"
        style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: "var(--text-strong)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ─── One unlocked detail ─────────────────────────────────────────────────── */

function RevealedRow({ result, label, business }: { result: RevealResult; label: string; business: string }) {
  const t = useTranslations("shop.listings");
  const tNet = useTranslations("shop.listings.network");
  const { flash } = useToast();

  const copy = (text: string) => {
    void copyLink(text).then((outcome) => {
      if (outcome !== "failed") flash(t("copied"));
    });
  };

  const valueLine = (text: string, copyable = true) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {/* LTR: a number, an address or a URL reads the same way in an Arabic page. */}
      <span
        dir="ltr"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 15.5,
          fontWeight: 700,
          color: "var(--text-strong)",
          overflowWrap: "anywhere",
          textAlign: "start",
          unicodeBidi: "isolate",
        }}
      >
        {text}
      </span>
      {copyable && (
        <button type="button" className="listing-copy" onClick={() => copy(text)} aria-label={t("copy", { what: label })}>
          <Icon name="copy" size={16} />
        </button>
      )}
    </div>
  );

  let body: ReactNode = null;
  switch (result.field) {
    case "whatsapp": {
      const href = whatsappHref(result.value);
      body = (
        <>
          {valueLine(result.value.number)}
          {href && (
            <Button block variant="whatsapp" leadingIcon="message-circle" onClick={() => void openApp(href)}>
              {t("action.whatsapp")}
            </Button>
          )}
        </>
      );
      break;
    }
    case "phone":
      body = (
        <>
          {valueLine(result.value.number)}
          <Button block leadingIcon="phone" onClick={() => void openApp(telHref(result.value.number))}>
            {t("action.phone")}
          </Button>
        </>
      );
      break;
    case "email":
      body = (
        <>
          {valueLine(result.value.address)}
          <Button
            block
            variant="secondary"
            leadingIcon="mail"
            onClick={() => void openApp(`mailto:${result.value.address}`)}
          >
            {t("action.email")}
          </Button>
        </>
      );
      break;
    case "website": {
      const href = safeHttpUrl(result.value.url);
      body = (
        <>
          {valueLine(href ? new URL(href).host : result.value.url)}
          {href && (
            <Button block variant="secondary" leadingIcon="external-link" onClick={() => void openExternal(href)}>
              {t("action.website")}
            </Button>
          )}
        </>
      );
      break;
    }
    case "socials": {
      const links = result.value.links
        .map((link) => ({ ...link, href: safeHttpUrl(link.url) }))
        .filter((link): link is typeof link & { href: string } => link.href !== null);
      body = links.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {links.map((link) => (
            <button
              key={link.href}
              type="button"
              className="listing-social"
              onClick={() => void openExternal(link.href)}
            >
              <span style={{ fontWeight: 700 }}>{tNet(link.network)}</span>
              <span dir="ltr" className="muted" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "start" }}>
                {new URL(link.href).host.replace(/^www\./, "")}
              </span>
              <Icon name="external-link" size={15} />
            </button>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>{t("noSocials")}</p>
      );
      break;
    }
    case "location": {
      const href = mapHref(result.value);
      body = (
        <>
          {result.value.address ? valueLine(result.value.address) : null}
          {hasPin(result.value) && HAS_MAP_TILES && (
            <ListingPlaceMap latitude={result.value.latitude} longitude={result.value.longitude} label={business} />
          )}
          {href && (
            <Button block leadingIcon="navigation" onClick={() => void openExternal(href)}>
              {t("action.location")}
            </Button>
          )}
        </>
      );
      break;
    }
    case "video": {
      const href = safeHttpUrl(result.value.url);
      body = href ? (
        <Button block variant="secondary" leadingIcon="play" onClick={() => void openExternal(href)}>
          {result.value.host === "google_drive" ? t("action.videoDrive") : t("action.video")}
        </Button>
      ) : (
        <p className="muted" style={{ margin: 0 }}>{t("videoBroken")}</p>
      );
      break;
    }
  }

  return (
    <div className="listing-revealed fadein">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon name={FIELD_ICON[result.field]} size={16} style={{ color: "var(--type-listing)" }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div style={{ display: "grid", gap: 10 }}>{body}</div>
    </div>
  );
}

/* ─── The opt-in question ─────────────────────────────────────────────────── */

function ConsentPrompt({
  business,
  state,
  onAnswer,
}: {
  business: string;
  state: ConsentState;
  onAnswer: (granted: boolean) => void;
}) {
  const t = useTranslations("shop.listings.consent");

  if (state.status === "granted" || state.status === "declined") {
    return (
      <div className="listing-consent fadein" role="status">
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--text-body)" }}>
          {t.rich(state.status === "granted" ? "savedYes" : "savedNo", {
            business,
            link: (chunks) => (
              <Link href={LISTING_CONSENTS_PATH} style={{ color: "var(--type-listing)", fontWeight: 700 }}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    );
  }

  const saving = state.status === "saving";
  return (
    <div className="listing-consent fadein" role="group" aria-labelledby="listing-consent-question">
      <p
        id="listing-consent-question"
        style={{ margin: 0, fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, color: "var(--text-strong)" }}
      >
        {t("question", { business })}
      </p>
      <p style={{ margin: "4px 0 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--text-muted)" }}>
        {t("terms")}
      </p>
      {state.error && (
        <p role="alert" className="listing-contact-row__error" style={{ marginTop: 0 }}>
          <Icon name="circle-alert" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{state.error}</span>
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="secondary" style={{ flex: 1 }} disabled={saving} onClick={() => onAnswer(false)}>
          {t("no")}
        </Button>
        <Button style={{ flex: 1 }} disabled={saving} onClick={() => onAnswer(true)}>
          {t("yes")}
        </Button>
      </div>
    </div>
  );
}
