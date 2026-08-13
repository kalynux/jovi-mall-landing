"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ResourceStatus = "loading" | "ready" | "error";

export interface ApiResource<T> {
  data: T | null;
  status: ResourceStatus;
  /** The thrown value, kept raw so callers can branch on `ApiError.code`. */
  error: unknown;
  /** Re-run the loader. Safe to call from a retry button. */
  reload: () => void;
  /** Replace the cached value without a round-trip — for endpoints that echo the updated record back. */
  set: (next: T) => void;
}

/**
 * Load one API resource, with the four states every account page needs.
 *
 * The loader is held in a ref rather than listed as a dependency: every call
 * site passes an inline arrow, so depending on it would re-fetch on each render.
 * `deps` is what actually re-triggers a load — pass the ids the request is keyed
 * on, and nothing else.
 */
export function useApiResource<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<ResourceStatus>("loading");
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const set = useCallback((next: T) => {
    setData(next);
    setStatus("ready");
    setError(null);
  }, []);

  return { data, status, error, reload, set };
}
