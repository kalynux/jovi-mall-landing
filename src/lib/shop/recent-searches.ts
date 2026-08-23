/**
 * The last few things this shopper searched for.
 *
 * Purely local, and deliberately so: there is no search-history endpoint, and
 * inventing one would mean sending every query a signed-out browser types to a
 * server that has no account to file it against. This is the shopper's own
 * device remembering what the shopper typed on it.
 *
 * It goes through `platform/storage` rather than `localStorage` directly so the
 * app gets Capacitor Preferences — a WebView's `localStorage` is cleared by an
 * OS storage sweep, which would silently empty the list on a device while the
 * web kept its own. Async for the same reason: Preferences has no sync read.
 */
import { get, remove, set } from "@/lib/platform/storage";

const KEY = "wi-mall.shop.recent-searches";

/**
 * Six.
 *
 * The panel is a dropdown under a search field, not a history page — past six
 * rows it is taller than the results it is covering, and the seventh-most
 * recent search is not something anyone scrolls to find.
 */
const MAX = 6;

/** Trimmed and collapsed, so " red  shoes " and "red shoes" are one entry. */
function normalize(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

async function write(list: string[]): Promise<string[]> {
  if (list.length === 0) {
    await remove(KEY);
    return list;
  }
  await set(KEY, JSON.stringify(list));
  return list;
}

/** Newest first. Answers `[]` for anything unreadable rather than throwing. */
export async function readRecentSearches(): Promise<string[]> {
  try {
    const raw = await get(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Hand-edited storage, or a shape from an older build — filter rather than
    // trust, since these strings go straight into the DOM as row labels.
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map(normalize)
      .filter(Boolean)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

/**
 * Records a search and returns the new list.
 *
 * Case-insensitive de-duplication, but the *new* spelling wins — someone who
 * just typed "Ankara" should not see their older "ankara" come back at them.
 */
export async function rememberSearch(query: string): Promise<string[]> {
  const q = normalize(query);
  if (!q) return readRecentSearches();

  const existing = await readRecentSearches();
  const next = [q, ...existing.filter((v) => v.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
  return write(next);
}

export async function forgetSearch(query: string): Promise<string[]> {
  const q = normalize(query).toLowerCase();
  const existing = await readRecentSearches();
  return write(existing.filter((v) => v.toLowerCase() !== q));
}

export async function clearRecentSearches(): Promise<string[]> {
  return write([]);
}
