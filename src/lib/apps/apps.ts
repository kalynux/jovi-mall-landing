/**
 * The four installable Wi-Mall apps, one per sign-in role.
 *
 * Every app ships today as a sideloaded APK served by the API's public
 * app-distribution route; the store listings do not exist yet. So each app
 * carries three channels and only the first one is live:
 *
 *   apk        `/api/public/app/<slug>/download` — a 302 to the CDN file
 *   playStore  empty until the Play listing is published
 *   appStore   empty until the App Store listing is published
 *
 * An empty store URL is the signal to render that channel greyed out, so
 * turning one on is an env var, not a code change. The agent app keeps the
 * env names `EXTERNAL_LINKS` already had for it.
 *
 * Client-safe on purpose: the auth pages read this from the browser, the /apps
 * page from the server. Nothing here touches `server-only` code.
 */
import type { UiRole } from "@/lib/auth/auth.types";
import { EXTERNAL_LINKS } from "@/lib/constants";

export type AppKey = "shop" | "vendor" | "agency" | "agent";

/** Display order everywhere the apps are listed together. */
export const APP_KEYS: AppKey[] = ["shop", "vendor", "agency", "agent"];

/** A customer signs in to the shop; every other role has an app of its own name. */
export const ROLE_APP: Record<UiRole, AppKey> = {
  customer: "shop",
  vendor: "vendor",
  agency: "agency",
  agent: "agent",
};

/** The role each app is for — drives the `role-*` accent on the /apps cards. */
export const APP_ROLE: Record<AppKey, UiRole> = {
  shop: "customer",
  vendor: "vendor",
  agency: "agency",
  agent: "agent",
};

/**
 * Always the production distribution route, including in `next dev`: a local
 * API has no releases uploaded, and there is only one set of real APKs.
 * `fetchWithRetry` still rewrites the server's reads to the internal address,
 * because this is the same origin as NEXT_PUBLIC_API_URL in production.
 */
const DIST_BASE = (
  process.env.NEXT_PUBLIC_APP_DIST_URL || "https://api.wi-mall.com/api/public/app"
).replace(/\/+$/, "");

export type AppChannels = {
  /** The distribution route's app id, e.g. `vendor-android`. */
  slug: string;
  /** Brand name of the app. Not translated. */
  name: string;
  apkUrl: string;
  /** Metadata for the current APK — see `AppRelease`. */
  latestUrl: string;
  /** Empty until published. */
  playStoreUrl: string;
  /** Empty until published. */
  appStoreUrl: string;
};

function channels(slug: string, name: string, playStoreUrl: string, appStoreUrl: string): AppChannels {
  return {
    slug,
    name,
    apkUrl: `${DIST_BASE}/${slug}/download`,
    latestUrl: `${DIST_BASE}/${slug}/latest`,
    playStoreUrl,
    appStoreUrl,
  };
}

// Each env var is read by its literal name: Next only inlines
// `process.env.NEXT_PUBLIC_*` into the client bundle when it can see the name.
export const APPS: Record<AppKey, AppChannels> = {
  shop: channels(
    "shop-android",
    "Wi-Mall Shop",
    process.env.NEXT_PUBLIC_SHOP_APP_ANDROID_URL ?? "",
    process.env.NEXT_PUBLIC_SHOP_APP_IOS_URL ?? ""
  ),
  vendor: channels(
    "vendor-android",
    "Wi-Vendor",
    process.env.NEXT_PUBLIC_VENDOR_APP_ANDROID_URL ?? "",
    process.env.NEXT_PUBLIC_VENDOR_APP_IOS_URL ?? ""
  ),
  agency: channels(
    "agency-android",
    "Wi-Agency",
    process.env.NEXT_PUBLIC_AGENCY_APP_ANDROID_URL ?? "",
    process.env.NEXT_PUBLIC_AGENCY_APP_IOS_URL ?? ""
  ),
  agent: {
    ...channels("agent-android", "Wi-Agent", EXTERNAL_LINKS.agentAndroidUrl, EXTERNAL_LINKS.agentIosUrl),
    // AgentAppDialog already links this one; both must name the same file.
    apkUrl: EXTERNAL_LINKS.agentApkUrl,
  },
};

/**
 * `GET /api/public/app/<slug>/latest` → `data`. Only the fields shown are
 * typed; the response also carries the signing-cert hash, package id and notes.
 */
export type AppRelease = {
  versionName: string;
  versionCode: number;
  minSdk: number;
  sizeBytes: number;
  sha256: string;
  publishedAt: string;
};

/** Narrows the envelope, or null for anything that is not a usable release. */
export function parseRelease(body: unknown): AppRelease | null {
  const data = (body as { success?: boolean; data?: Partial<AppRelease> } | null)?.data;
  if (!data || typeof data.versionName !== "string" || typeof data.sizeBytes !== "number") return null;
  return {
    versionName: data.versionName,
    versionCode: Number(data.versionCode ?? 0),
    minSdk: Number(data.minSdk ?? 0),
    sizeBytes: data.sizeBytes,
    sha256: String(data.sha256 ?? ""),
    publishedAt: String(data.publishedAt ?? ""),
  };
}

/**
 * Android API level → the version a person recognises. Nobody knows what
 * "SDK 24" is; "Android 7.0" is on the phone's own settings screen.
 */
const ANDROID_VERSION_BY_SDK: Record<number, string> = {
  21: "5.0",
  22: "5.1",
  23: "6.0",
  24: "7.0",
  25: "7.1",
  26: "8.0",
  27: "8.1",
  28: "9",
  29: "10",
  30: "11",
  31: "12",
  32: "12L",
  33: "13",
  34: "14",
  35: "15",
  36: "16",
};

export function androidVersionForSdk(minSdk: number): string | null {
  return ANDROID_VERSION_BY_SDK[minSdk] ?? null;
}

/** "9.6 MB" in the reader's own numerals and unit spelling. */
export function formatAppSize(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: bytes >= 10 * 1024 * 1024 ? 0 : 1,
  }).format(bytes / (1024 * 1024));
}
