"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { isCustomerSession } from "@/lib/shop/customer-session";
import { classifyCartAddFailure } from "@/lib/shop/cart-errors";
import type { CartAddFailure } from "@/lib/shop/cart-errors";
import {
  addCartItem,
  clearCart as clearServerCart,
  getCart,
  mergeCart,
  removeCartVariant,
  setCartItemQuantity,
} from "@/lib/shop/cart.api";
import { isNegotiatedLine } from "@/lib/shop/customer.types";
import type { CartDroppedLine, ServerCart } from "@/lib/shop/customer.types";
import { publicUrl } from "@/lib/shop/shop.types";
import type { CartLine, CartProductType, LocalCart, Product, Variant } from "@/lib/shop/shop.types";

/**
 * The shopper's cart, anonymous or signed in.
 *
 * ── One cart, one product type ───────────────────────────────────────────────
 *
 * This used to hold two baskets at once (`{ physical: [], digital: [] }`). There
 * was never a server behind that: `CartSchema.userId` is **uniquely indexed**,
 * so a customer has exactly one cart row carrying one `productType`, and adding
 * the other type answers `409 CART_MIXED_PRODUCT_TYPES`. Two local baskets could
 * only ever have synced one of themselves.
 *
 * So there is one cart, and switching type is an explicit, announced replacement
 * — `addItem` returns `"type_conflict"` rather than doing it silently, and the
 * caller confirms before calling again with `replace: true`. A shopper who wants
 * both should check out one and then the other; the ask for
 * `(userId, productType)`-keyed carts is filed in
 * `api-doc/public/BACKEND-SHOP-FOLLOWUP.md`.
 *
 * ── Anonymous vs signed in ───────────────────────────────────────────────────
 *
 * Signed out, the cart is localStorage and the server knows nothing. Signed in,
 * the **server is the source of truth** and every mutation is a call; the local
 * copy is handed over once by `POST /cart/merge` and then cleared, so there is
 * never a second cart quietly disagreeing on another tab.
 *
 * The snapshot fields on a local line (title, image, price…) exist so an
 * anonymous cart renders without a catalog round-trip per line. They are
 * display-only and are never sent: merge re-prices every line from the
 * catalogue, and rejects a body carrying a `price` at all.
 */

/** In the cart, or the reason it is not. See `lib/shop/cart-errors.ts`. */
export type AddItemOutcome = { kind: "added" } | CartAddFailure;

interface CartContextValue {
  /** The lines on screen, from whichever source is authoritative right now. */
  lines: CartLine[];
  productType: CartProductType;
  count: number;
  /** True while a server call is in flight, for disabling steppers. */
  busy: boolean;
  /**
   * True once the cart that *counts* for this session has actually been read —
   * localStorage when signed out, the server when signed in.
   *
   * ⚠ **Anything that treats an empty cart as a fact must wait on this, not on
   * `!busy`.** `busy` is false before the first fetch even starts, so `count ===
   * 0` on an early render means "not read yet", not "empty". Two screens read it
   * as empty and shipped the consequences: the cart page announced "Your cart is
   * empty" to a shopper holding two lines, and checkout redirected away from
   * every deep link — a push notification, a bookmark, the app resuming there.
   *
   * Showing a skeleton until this is true is the correct default for any screen
   * whose whole content depends on the cart.
   */
  hydrated: boolean;
  /** Lines the last sign-in merge could not carry over. Surface and then dismiss. */
  dropped: CartDroppedLine[];
  dismissDropped: () => void;

  /**
   * Titles of lines that **lost a price agreed in chat** on the last call.
   *
   * Two ordinary actions revert a negotiated line to the shelf price — changing
   * its quantity, and signing in with an anonymous cart — and both answer a
   * perfectly valid 200. Nothing in the response says a price moved, so a
   * shopper watching their total change has no explanation unless we give one.
   * Surfaced and dismissed exactly like {@link dropped}.
   */
  negotiationLapsed: string[];
  dismissNegotiationLapsed: () => void;

  addItem: (
    product: Product,
    variant: Variant,
    opts?: { qty?: number; replace?: boolean }
  ) => Promise<AddItemOutcome>;
  setQty: (variantId: string, qty: number) => Promise<void>;
  removeLine: (variantId: string) => Promise<void>;
  clear: () => Promise<void>;
  /** Re-read the server cart — after checkout, or when a call failed. */
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "wi-mall-shop-cart";
/**
 * The key from before the brand became `wi-mall`. Its contents are still valid,
 * so it is moved over rather than dropped — a shopper mid-basket at the moment
 * of the rename would otherwise come back to an empty cart.
 */
const PRE_RENAME_STORAGE_KEY = "wimall-shop-cart";
/** The pre-single-cart key. Read once to migrate, then removed. */
const LEGACY_STORAGE_KEY = "wimall-shop-carts";

const EMPTY: LocalCart = { productType: null, lines: [] };

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

/* ─── localStorage ────────────────────────────────────────────────────────── */

function readLocal(): LocalCart {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);

    // Same shape, older key — adopt it and retire the old one so this only
    // runs on the first mount after the rename.
    if (!raw) {
      const carried = localStorage.getItem(PRE_RENAME_STORAGE_KEY);
      if (carried) {
        localStorage.setItem(STORAGE_KEY, carried);
        localStorage.removeItem(PRE_RENAME_STORAGE_KEY);
        raw = carried;
      }
    }

    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalCart>;
      if (Array.isArray(parsed.lines)) {
        return { productType: parsed.productType ?? null, lines: parsed.lines };
      }
    }

    // Migrate the two-basket cart, if one is still sitting in a browser. Its
    // lines carry mock ids (`p1`/`v1`) that no longer resolve, and it has no
    // snapshot fields, so there is nothing worth keeping — dropping it is the
    // honest outcome. Removing the key stops this running on every mount.
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    /* private mode, quota, or a hand-edited value — an empty cart is fine */
  }
  return EMPTY;
}

function writeLocal(cart: LocalCart): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* ignore */
  }
}

function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ─── Mapping ─────────────────────────────────────────────────────────────── */

/**
 * A server line rendered as a cart row.
 *
 * The server cart carries no image and no store slug — it is keyed on ids and
 * titles — so those two fall back to the local snapshot for the same variant
 * where we still have one, and to nothing where we do not. A missing thumbnail
 * is a placeholder; a missing store slug just means the row does not link
 * through to the product.
 */
function toLine(item: ServerCart["items"][number], snapshot?: CartLine): CartLine {
  return {
    productId: item.productId,
    variantId: item.variantId,
    qty: item.quantity,
    title: item.title,
    variantName: item.variantTitle || item.sku,
    // Always the server's number, never the snapshot's. That is what makes a
    // negotiated line correct for free: the agreed price arrives as `price`,
    // and when the agreement lapses the next read simply carries the shelf
    // price instead.
    price: item.price,
    currency: item.currency,
    negotiated: isNegotiatedLine(item),
    image: snapshot?.image ?? null,
    productSlug: snapshot?.productSlug ?? "",
    storeSlug: snapshot?.storeSlug ?? "",
    storeName: snapshot?.storeName ?? "",
  };
}

function snapshotOf(product: Product, variant: Variant, qty: number): CartLine {
  return {
    productId: product.id,
    variantId: variant.id,
    qty,
    title: product.title,
    variantName: variant.name,
    price: variant.price,
    currency: variant.currency,
    // Through the helper, not off `.url`: a blocked image carries a null URL
    // and this snapshot outlives the read that produced it, so a raw copy would
    // freeze a broken thumbnail into the local cart until the shopper clears it.
    image: publicUrl(variant.images?.[0]) ?? publicUrl(product.images[0]) ?? null,
    productSlug: product.slug,
    storeSlug: product.store.slug,
    storeName: product.store.name,
  };
}

/* ─── Provider ────────────────────────────────────────────────────────────── */

export function CartProvider({ children }: { children: ReactNode }) {
  const { status, role } = useAuth();
  /**
   * "Signed in" here means signed in AS A CUSTOMER — the cart routes are
   * `requireRole(['customer'])`. A vendor, agency or agent session used to take
   * the server branch, so the read, the merge and every add answered
   * `403 AUTH_ROLE_NOT_FOUND`, and every "Add to cart" toasted the server's
   * English "Insufficient permissions". It gets the anonymous, localStorage
   * cart instead, which a later customer sign-in merges exactly like any
   * signed-out basket.
   */
  const signedIn = isCustomerSession(status, role);

  const [local, setLocal] = useState<LocalCart>(EMPTY);
  const [server, setServer] = useState<ServerCart | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropped, setDropped] = useState<CartDroppedLine[]>([]);
  const [negotiationLapsed, setNegotiationLapsed] = useState<string[]>([]);

  /**
   * ── The two halves of {@link CartContextValue.hydrated} ──────────────────
   *
   * `busy` cannot answer "has the cart been read yet?" — it is false *before*
   * the first fetch starts, so a consumer that waits on `!busy` reads an empty
   * cart and believes it. That cost two real bugs: `/shop/cart` announced "Your
   * cart is empty" for ~3s to a shopper holding two lines, and `/shop/checkout`
   * redirected away entirely on any deep link, because its guard fires on
   * `status === "authenticated" && count === 0` and `status` flips the moment
   * `/auth/me` answers — well before the cart GET resolves.
   *
   * So each source records that it has been *read*, not that it is idle.
   */
  const [localRead, setLocalRead] = useState(false);
  const [serverSettled, setServerSettled] = useState(false);

  /**
   * Snapshots by variantId, kept across the handover.
   *
   * The server cart has no images or slugs, so without this every row would lose
   * its thumbnail the moment a shopper signs in — the cart would visibly get
   * worse for having an account. A ref rather than state: it is a display cache,
   * and writing it must not re-render.
   */
  const snapshots = useRef(new Map<string, CartLine>());

  const rememberSnapshots = useCallback((lines: CartLine[]) => {
    for (const line of lines) snapshots.current.set(line.variantId, line);
  }, []);

  // Hydrate from localStorage once. Deliberately in an effect: localStorage does
  // not exist during SSR, so reading it during render would make the server and
  // first client render disagree.
  useEffect(() => {
    const stored = readLocal();
    setLocal(stored);
    rememberSnapshots(stored.lines);
    setLocalRead(true);
  }, [rememberSnapshots]);

  const persistLocal = useCallback((next: LocalCart) => {
    setLocal(next);
    writeLocal(next);
  }, []);

  /* ── The sign-in handover ──────────────────────────────────────────────── */

  /**
   * Runs once per sign-in, and only once — hence the ref rather than a state
   * flag. A second merge would double every quantity, because `strategy: "sum"`
   * means exactly that.
   */
  const merged = useRef(false);

  useEffect(() => {
    if (!signedIn) {
      // Signing out drops back to whatever is in localStorage, and re-arms the
      // handover for the next sign-in — including the "have we read the server
      // yet?" half of `hydrated`, or the next sign-in would be treated as
      // already-read and flash the previous account's empty cart.
      merged.current = false;
      setServer(null);
      setServerSettled(false);
      return;
    }
    if (merged.current) return;
    merged.current = true;

    let cancelled = false;

    (async () => {
      try {
        const pending = readLocal();
        if (pending.lines.length > 0) {
          rememberSnapshots(pending.lines);

          /*
             Read the server cart before merging, purely so we can tell the
             shopper what the merge cost them.

             A merge re-resolves every line from the shelf, and an anonymous cart
             cannot carry a price lock — so a line the customer haggled for in
             chat comes back at list price, silently, inside a valid 200. The
             merge response says nothing about it, and we cannot reconstruct the
             prior state afterwards, so the only place to learn it is here.

             Best-effort on purpose: if this read fails the handover still runs.
             Losing the explanation is bad; losing the basket is worse.

             The cost is one extra round trip at sign-in, and only when the
             shopper actually has an anonymous basket to hand over. That is a
             real delay on a slow connection, and it is paid deliberately: being
             charged more than you agreed, with nothing on screen saying why, is
             the worse outcome. If this is ever reversed, reverse it knowing that
             is the trade. */
          let negotiatedBefore: ServerCart["items"] = [];
          try {
            negotiatedBefore = (await getCart()).items.filter(isNegotiatedLine);
          } catch {
            /* no explanation available — proceed with the merge regardless */
          }

          const result = await mergeCart(
            pending.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              quantity: l.qty,
            })),
            "sum"
          );
          if (cancelled) return;
          setServer(result.cart);
          setDropped(result.dropped);

          if (negotiatedBefore.length > 0) {
            const kept = new Set(
              result.cart.items.filter(isNegotiatedLine).map((i) => i.variantId),
            );
            const lost = negotiatedBefore
              .filter((i) => !kept.has(i.variantId))
              .map((i) => i.title);
            if (lost.length > 0) setNegotiationLapsed(lost);
          }
          // Handed over — the local copy must go, or the next sign-in merges it
          // a second time.
          clearLocal();
          setLocal(EMPTY);
        } else {
          const cart = await getCart();
          if (cancelled) return;
          setServer(cart);
        }
      } catch {
        // A failed handover must not empty the basket: the local cart is left
        // exactly as it was, and `merged` stays true so this does not spin. The
        // shopper can retry from the cart page.
        merged.current = false;
      } finally {
        // Settled means *read*, not *succeeded*. On failure `server` stays null
        // and `lines` falls back to the local cart, which is then the honest
        // answer — so the UI must stop waiting either way, or a dropped
        // connection leaves the cart skeleton up forever.
        if (!cancelled) setServerSettled(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, rememberSnapshots]);

  /* ── Reads ─────────────────────────────────────────────────────────────── */

  const lines = useMemo<CartLine[]>(() => {
    if (signedIn && server) {
      return server.items.map((item) => toLine(item, snapshots.current.get(item.variantId)));
    }
    return local.lines;
  }, [signedIn, server, local]);

  const productType = useMemo<CartProductType>(() => {
    if (signedIn && server) return server.productType ?? null;
    return local.productType;
  }, [signedIn, server, local]);

  const count = useMemo(() => lines.reduce((total, line) => total + line.qty, 0), [lines]);

  /**
   * Has the authoritative source been read yet?
   *
   * Which source that is depends on the session, so this waits on auth first:
   * while `status` is `"loading"` we do not yet know whether localStorage or the
   * server is the answer, and answering from the wrong one is how an empty cart
   * gets rendered as fact.
   */
  const hydrated = useMemo(() => {
    if (status === "loading" || !localRead) return false;
    return signedIn ? serverSettled : true;
  }, [status, localRead, signedIn, serverSettled]);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    try {
      setBusy(true);
      setServer(await getCart());
    } finally {
      setBusy(false);
    }
  }, [signedIn]);

  /* ── Writes ────────────────────────────────────────────────────────────── */

  const addItem = useCallback<CartContextValue["addItem"]>(
    async (product, variant, opts = {}) => {
      const qty = opts.qty ?? 1;

      if (product.type === "service") return { kind: "service_not_allowed" };

      const incoming = product.type;
      const current = productType;

      if (current && current !== incoming && !opts.replace) {
        return { kind: "type_conflict", current, incoming };
      }

      // Digital is one product, quantity one. Checked here as well as at the API
      // so the anonymous cart cannot build a basket the server would refuse the
      // moment the shopper signs in.
      const replacing = Boolean(current && current !== incoming && opts.replace);
      if (incoming === "digital") {
        const existing = replacing ? [] : lines;
        const other = existing.find((l) => l.productId !== product.id);
        if (other) return { kind: "digital_limit" };
      }
      const effectiveQty = incoming === "digital" ? 1 : qty;

      const snapshot = snapshotOf(product, variant, effectiveQty);
      snapshots.current.set(variant.id, snapshot);

      if (!signedIn) {
        const base = replacing ? [] : local.lines;
        const at = base.findIndex((l) => l.variantId === variant.id);
        const next = [...base];
        if (at >= 0) {
          next[at] = {
            ...next[at],
            qty: incoming === "digital" ? 1 : next[at].qty + effectiveQty,
          };
        } else {
          next.push(snapshot);
        }
        persistLocal({ productType: incoming, lines: next });
        return { kind: "added" };
      }

      try {
        setBusy(true);
        if (replacing) await clearServerCart();
        const cart = await addCartItem({
          productId: product.id,
          variantId: variant.id,
          quantity: effectiveQty,
          currency: variant.currency,
        });
        setServer(cart);
        return { kind: "added" };
      } catch (error) {
        // Every branch, including "the request never arrived", lives in
        // `lib/shop/cart-errors.ts` — see the note there for why it is not
        // inline any more.
        return classifyCartAddFailure(error, current, incoming);
      } finally {
        setBusy(false);
      }
    },
    [signedIn, productType, lines, local.lines, persistLocal]
  );

  const setQty = useCallback<CartContextValue["setQty"]>(
    async (variantId, qty) => {
      // The API refuses 0 — removing is a different intention with its own call,
      // so route it rather than sending a quantity that will 400.
      if (qty < 1) return;

      if (!signedIn) {
        persistLocal({
          ...local,
          lines: local.lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
        });
        return;
      }

      try {
        setBusy(true);
        /*
           A price lock is bound to a quantity, so changing the quantity is a
           different deal and the backend drops the agreement — reverting the
           line to the shelf price and removing the negotiation fields, in a
           200 that says nothing about it. Compare across the call and tell the
           shopper, because the only other signal they get is a total that
           quietly went up. */
        const before = server?.items.find((i) => i.variantId === variantId);
        const next = await setCartItemQuantity(variantId, qty);
        setServer(next);

        if (before && isNegotiatedLine(before)) {
          const after = next.items.find((i) => i.variantId === variantId);
          if (!after || !isNegotiatedLine(after)) {
            setNegotiationLapsed((prev) =>
              prev.includes(before.title) ? prev : [...prev, before.title],
            );
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [signedIn, local, persistLocal, server]
  );

  const removeLine = useCallback<CartContextValue["removeLine"]>(
    async (variantId) => {
      if (!signedIn) {
        const next = local.lines.filter((l) => l.variantId !== variantId);
        persistLocal({ productType: next.length ? local.productType : null, lines: next });
        return;
      }

      try {
        setBusy(true);
        setServer(await removeCartVariant(variantId));
      } finally {
        setBusy(false);
      }
    },
    [signedIn, local, persistLocal]
  );

  const clear = useCallback<CartContextValue["clear"]>(async () => {
    if (!signedIn) {
      clearLocal();
      setLocal(EMPTY);
      return;
    }
    try {
      setBusy(true);
      await clearServerCart();
      setServer(await getCart());
    } finally {
      setBusy(false);
    }
  }, [signedIn]);

  const dismissDropped = useCallback(() => setDropped([]), []);
  const dismissNegotiationLapsed = useCallback(() => setNegotiationLapsed([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      productType,
      count,
      busy,
      hydrated,
      dropped,
      dismissDropped,
      negotiationLapsed,
      dismissNegotiationLapsed,
      addItem,
      setQty,
      removeLine,
      clear,
      refresh,
    }),
    [
      lines,
      productType,
      count,
      busy,
      hydrated,
      dropped,
      dismissDropped,
      negotiationLapsed,
      dismissNegotiationLapsed,
      addItem,
      setQty,
      removeLine,
      clear,
      refresh,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
