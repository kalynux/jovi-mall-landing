/**
 * Shared backend HTTP client.
 *
 * Extracted verbatim from `src/lib/auth/auth.api.ts`, where it lived as a
 * module-private helper until the shop needed it too. Behaviour is unchanged —
 * `auth.api.ts` now imports from here.
 *
 * Everything the backend exposes goes through this: cookie-first auth
 * (`credentials: "include"`), the `{ success, data, meta }` success envelope, and
 * the structured `{ success: false, requestId, error: {...} }` error contract.
 * See api-doc/README.md § "The response envelope".
 */
import { AuthError, ApiError } from "@/lib/auth/auth.types";
import type { ApiErrorBody } from "@/lib/auth/auth.types";
import { isErrorCategory } from "@/lib/auth/error-categories";

export const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8022";

/** The `meta` block on any paginated list response (api-doc/README.md § Pagination). */
export interface ListMeta {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

/**
 * Throws the structured error contract, or an `AuthError` when the body is not
 * one the backend produced (proxy, network layer, gateway).
 */
function throwResponseError(res: Response, body: Record<string, unknown>): never {
    // Try to conform to the structured backend error contract first.
    // See: api-doc/errors/README.md
    const structured = body as Partial<ApiErrorBody>;
    if (structured?.error?.code) {
        throw new ApiError(
            structured.error.message,
            structured.error.statusCode ?? res.status,
            structured.error.code,
            structured.error.details,
            structured.requestId,  // propagate request trace ID for support display
            // Validated rather than cast: the contract says `category` is
            // always present, but a body from a proxy or a pre-Phase-16
            // deploy has none, and consumers must see `undefined` rather
            // than an unchecked string that fails an === comparison later.
            isErrorCategory(structured.error.category)
                ? structured.error.category
                : undefined
        );
    }

    // Fallback for non-structured responses (network layer, proxies, etc.)
    throw new AuthError(
        (body?.message as string) ||
        (body?.error as string) ||
        `Request failed (${res.status})`,
        res.status
    );
}

async function request(
    path: string,
    options: RequestInit
): Promise<{ res: Response; body: Record<string, unknown> }> {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include", // always send both cookies
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
    });

    let body: Record<string, unknown> = {};
    try {
        body = await res.json();
    } catch {
        // empty body — fall through to generic error below
    }

    if (!res.ok) throwResponseError(res, body);

    return { res, body };
}

/**
 * Fetch and return the unwrapped payload.
 *
 * ── Success envelope unwrap ──────────────────────────────────────────────
 * Breaking change (api-doc/README.md, 2026-07-17): every endpoint now wraps
 * its payload in `{ success, data, meta }`. Callers want `data`, not the
 * envelope. We stay defensive: only unwrap when the standard envelope is
 * actually present (`success === true` and a `data` key exists — `data` may
 * legitimately be `null`, e.g. logout). Anything else is returned as-is.
 *
 * That defensiveness is load-bearing for three real endpoint families, which
 * the backend builds by hand rather than through a response interceptor:
 *   - `/api/payments/*` answers flat — `{ success, transactionId, status }` and
 *     `{ success, transaction }`, with no `data` key.
 *   - `DELETE /api/customer/cart` and `DELETE /api/me/payment-methods/:id`
 *     answer `{ success, message }` — also no `data`.
 *   - provider webhooks keep their provider-specific bodies.
 * All of them fall through and are returned whole, so callers of those routes
 * must type `T` as the full body, not as a payload.
 */
export async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const { body } = await request(path, options);

    const envelope = body as { success?: boolean; data?: unknown };
    if (
        envelope &&
        typeof envelope === "object" &&
        envelope.success === true &&
        "data" in envelope
    ) {
        return envelope.data as T;
    }

    return body as T;
}

/**
 * Fetch a paginated list and keep the `meta` block.
 *
 * `apiFetch` unwraps to `data` and drops `meta`, which is where every list
 * endpoint puts its pagination — and where the customer notification inbox puts
 * `unreadCount`. Use this whenever the caller needs page counts or those extra
 * summary fields; `M` widens `meta` for them.
 *
 * A response with no `meta` (some endpoints return a bare array) yields a
 * synthesised single-page block, so callers never have to null-check it.
 */
export async function apiFetchList<T, M = Record<string, unknown>>(
    path: string,
    options: RequestInit = {}
): Promise<{ data: T[]; meta: ListMeta & M }> {
    const { body } = await request(path, options);

    const envelope = body as { success?: boolean; data?: unknown; meta?: unknown };
    const data = (Array.isArray(envelope?.data) ? envelope.data : []) as T[];
    const meta = (envelope?.meta ?? {}) as Partial<ListMeta> & M;

    return {
        data,
        meta: {
            ...meta,
            total: meta.total ?? data.length,
            page: meta.page ?? 1,
            limit: meta.limit ?? data.length,
            pages: meta.pages ?? 1,
        } as ListMeta & M,
    };
}
