/**
 * Removes empty, null, and undefined values from a form data object before
 * submitting to the API. This prevents sending empty strings for optional
 * fields (e.g. email) which the backend would reject.
 *
 * Rules:
 *  - Strings are trimmed. If the result is "", the key is dropped.
 *  - null / undefined values are dropped.
 *  - Numbers and booleans are preserved as-is.
 *  - Nested objects are NOT recursed — this targets flat API payloads.
 *
 * @example
 *   sanitizePayload({ name: "  Alice ", email: "", role: "vendor" })
 *   // → { name: "Alice", role: "vendor" }
 */
export function sanitizePayload<T extends Record<string, unknown>>(
    data: T
): Partial<T> {
    const result: Partial<T> = {};

    for (const key in data) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

        const value = data[key];

        if (value === null || value === undefined) continue;

        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed !== "") {
                (result as Record<string, unknown>)[key] = trimmed;
            }
            continue;
        }

        // numbers, booleans, arrays, objects — pass through untouched
        (result as Record<string, unknown>)[key] = value;
    }

    return result;
}
