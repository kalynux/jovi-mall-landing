/**
 * Server-side read of every app's current release, for the /apps page.
 *
 * Unlike /pricing this never fails the page: the download buttons work without
 * the metadata (the route redirects to whatever is current), so an unreachable
 * API costs the version line, not the page — and not a release build.
 */
import "server-only";
import { describeFetchError, fetchWithRetry } from "@/lib/build-fetch";
import { APP_KEYS, APPS, parseRelease, type AppKey, type AppRelease } from "./apps";

/** Matches the endpoint's own `Cache-Control: public, max-age=300`. */
export const APP_RELEASE_REVALIDATE_SECONDS = 300;

async function getRelease(app: AppKey): Promise<AppRelease | null> {
  const url = APPS[app].latestUrl;
  try {
    const res = await fetchWithRetry(url, { next: { revalidate: APP_RELEASE_REVALIDATE_SECONDS } });
    if (!res.ok) {
      console.warn(`[apps] ${url} answered HTTP ${res.status}`);
      return null;
    }
    return parseRelease(await res.json());
  } catch (error) {
    console.warn(`[apps] ${url} failed: ${describeFetchError(error)}`);
    return null;
  }
}

export async function getAppReleases(): Promise<Record<AppKey, AppRelease | null>> {
  const releases = await Promise.all(APP_KEYS.map(getRelease));
  return Object.fromEntries(APP_KEYS.map((app, i) => [app, releases[i]])) as Record<
    AppKey,
    AppRelease | null
  >;
}
