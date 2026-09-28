"use client";
/**
 * The current release of one app, read from the browser.
 *
 * The auth pages are client components, and the API allows the site's origin,
 * so the metadata is fetched where it is shown. One request per app per page
 * load, shared across re-renders and role switches; a failure resolves to null
 * and the buttons simply show without the version line.
 */
import { useEffect, useState } from "react";
import { APPS, parseRelease, type AppKey, type AppRelease } from "./apps";

const requests = new Map<AppKey, Promise<AppRelease | null>>();

function load(app: AppKey): Promise<AppRelease | null> {
  let request = requests.get(app);
  if (!request) {
    request = fetch(APPS[app].latestUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then(parseRelease)
      .catch(() => null);
    requests.set(app, request);
  }
  return request;
}

export function useAppRelease(app: AppKey | null): AppRelease | null {
  const [release, setRelease] = useState<{ app: AppKey; value: AppRelease | null } | null>(null);

  useEffect(() => {
    if (!app) return;
    let live = true;
    load(app).then((value) => {
      if (live) setRelease({ app, value });
    });
    return () => {
      live = false;
    };
  }, [app]);

  // Never show the previous role's version while the new one is loading.
  return release && release.app === app ? release.value : null;
}
