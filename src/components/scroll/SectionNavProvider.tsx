"use client";
/**
 * SectionNavProvider — the full-page ("arena-breakout") scroll engine.
 *
 * Keeps the native window scroll (so HeroSection's useScroll, anchors and the
 * URL all keep working) and layers a lightweight navigator on top:
 *
 *  • wheel / keyboard / touch gestures snap one full section per gesture,
 *    with a short lock so a single gesture never skips two sections;
 *  • tall sections (short viewports) scroll natively until their top/bottom
 *    edge is reached, only then does a gesture advance to the neighbour;
 *  • a rAF-throttled scroll listener tracks the active section and syncs the
 *    URL hash via history.replaceState (no back-button spam);
 *  • prefers-reduced-motion disables the hijack entirely (plain scrolling),
 *    while hash + active tracking keep working.
 *
 * Consumers (Navbar, Footer, SectionProgressIndicator) read state and trigger
 * navigation through the useSectionNav() hook.
 */
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

export interface SectionMeta {
    id: string;
    label: string;
}

interface SectionNavValue {
    sections: SectionMeta[];
    activeIndex: number;
    activeId: string;
    scrollToIndex: (index: number) => void;
    scrollToId: (id: string) => void;
}

const SectionNavContext = createContext<SectionNavValue | null>(null);

/** Access the full-page nav state. Must be used under <SectionNavProvider>. */
export function useSectionNav(): SectionNavValue {
    const ctx = useContext(SectionNavContext);
    if (!ctx) {
        throw new Error("useSectionNav must be used within <SectionNavProvider>");
    }
    return ctx;
}

/**
 * Like useSectionNav but returns null instead of throwing when there is no
 * provider. Used by Navbar/Footer so they can be reused on pages (e.g. /shop)
 * that don't mount the full-page scroll engine.
 */
export function useOptionalSectionNav(): SectionNavValue | null {
    return useContext(SectionNavContext);
}

// How far past the edge (px) still counts as "at the edge" of a tall section.
const EDGE = 4;
// Minimum |deltaY| to treat a wheel event as intentional.
const WHEEL_THRESHOLD = 4;
// Minimum vertical travel (px) for a touch swipe to count.
const SWIPE_THRESHOLD = 48;
// How long gestures are ignored while a programmatic scroll settles.
const LOCK_MS = 780;

export function SectionNavProvider({
    sections,
    children,
}: {
    sections: SectionMeta[];
    children: ReactNode;
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeIndexRef = useRef(0);
    const lockedRef = useRef(false);
    const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const els = useCallback(
        () =>
            sections
                .map((s) => document.getElementById(s.id))
                .filter((el): el is HTMLElement => el != null),
        [sections]
    );

    const lock = useCallback(() => {
        lockedRef.current = true;
        if (lockTimer.current) clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => {
            lockedRef.current = false;
        }, LOCK_MS);
    }, []);

    const prefersReduced = useCallback(
        () =>
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        []
    );

    const scrollToIndex = useCallback(
        (index: number) => {
            const list = els();
            const clamped = Math.max(0, Math.min(list.length - 1, index));
            const el = list[clamped];
            if (!el) return;
            const top = window.scrollY + el.getBoundingClientRect().top;
            lock();
            activeIndexRef.current = clamped;
            setActiveIndex(clamped);
            window.scrollTo({
                top,
                behavior: prefersReduced() ? "auto" : "smooth",
            });
        },
        [els, lock, prefersReduced]
    );

    const scrollToId = useCallback(
        (id: string) => {
            const idx = sections.findIndex((s) => s.id === id);
            if (idx >= 0) scrollToIndex(idx);
        },
        [sections, scrollToIndex]
    );

    // ─── Active-section tracking + hash sync (rAF-throttled) ──────────────────
    useEffect(() => {
        let ticking = false;

        const measure = () => {
            ticking = false;
            const list = els();
            if (!list.length) return;
            const mid = window.innerHeight / 2;
            let next = activeIndexRef.current;
            for (let i = 0; i < list.length; i++) {
                const r = list[i].getBoundingClientRect();
                if (r.top <= mid && r.bottom > mid) {
                    next = i;
                    break;
                }
            }
            if (next !== activeIndexRef.current) {
                activeIndexRef.current = next;
                setActiveIndex(next);
                const id = sections[next]?.id;
                if (id && `#${id}` !== window.location.hash) {
                    history.replaceState(null, "", `#${id}`);
                }
            }
        };

        const onScroll = () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(measure);
            }
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        measure();
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [els, sections]);

    // ─── Deep-link: honour an incoming #hash on mount ─────────────────────────
    useEffect(() => {
        const hash = window.location.hash.replace("#", "");
        if (!hash) return;
        const idx = sections.findIndex((s) => s.id === hash);
        if (idx > 0) {
            // wait a tick so section elements are laid out
            requestAnimationFrame(() => scrollToIndex(idx));
        }
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Gesture hijack (wheel / keyboard / touch) ────────────────────────────
    useEffect(() => {
        if (prefersReduced()) return; // plain native scrolling

        const canAdvance = (dir: 1 | -1): boolean => {
            const list = els();
            const el = list[activeIndexRef.current];
            if (!el) return false;
            const r = el.getBoundingClientRect();
            if (dir === 1) {
                // only jump forward once the section is fully revealed to bottom
                const atBottom = r.bottom <= window.innerHeight + EDGE;
                return atBottom && activeIndexRef.current < list.length - 1;
            }
            const atTop = r.top >= -EDGE;
            return atTop && activeIndexRef.current > 0;
        };

        const go = (dir: 1 | -1) => scrollToIndex(activeIndexRef.current + dir);

        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
            if (lockedRef.current) {
                e.preventDefault();
                return;
            }
            const dir: 1 | -1 = e.deltaY > 0 ? 1 : -1;
            if (canAdvance(dir)) {
                e.preventDefault();
                go(dir);
            }
            // else: let the tall section scroll natively (no preventDefault)
        };

        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable)
            ) {
                return;
            }
            let dir: 1 | -1 | 0 = 0;
            if (["ArrowDown", "PageDown", " ", "Spacebar"].includes(e.key)) dir = 1;
            else if (["ArrowUp", "PageUp"].includes(e.key)) dir = -1;
            else if (e.key === "Home") {
                e.preventDefault();
                scrollToIndex(0);
                return;
            } else if (e.key === "End") {
                e.preventDefault();
                scrollToIndex(els().length - 1);
                return;
            }
            if (dir === 0 || lockedRef.current) return;
            if (canAdvance(dir)) {
                e.preventDefault();
                go(dir);
            }
        };

        let touchStartY = 0;
        // Is the current section taller than the viewport? If so we let native
        // touch-scrolling run inside it; otherwise we block it for crisp snapping.
        const currentIsTall = () => {
            const el = els()[activeIndexRef.current];
            return el ? el.getBoundingClientRect().height > window.innerHeight + EDGE : false;
        };

        const onTouchStart = (e: TouchEvent) => {
            touchStartY = e.touches[0]?.clientY ?? 0;
        };
        const onTouchMove = (e: TouchEvent) => {
            // Sections that fit the viewport shouldn't free-scroll — block the
            // native pan so one swipe maps to exactly one section.
            if (!currentIsTall() && e.cancelable) e.preventDefault();
        };
        const onTouchEnd = (e: TouchEvent) => {
            if (lockedRef.current) return;
            const endY = e.changedTouches[0]?.clientY ?? touchStartY;
            const dy = touchStartY - endY; // swipe up (dy>0) => go down
            if (Math.abs(dy) < SWIPE_THRESHOLD) return;
            const dir: 1 | -1 = dy > 0 ? 1 : -1;
            if (canAdvance(dir)) go(dir);
        };

        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("keydown", onKey);
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchmove", onTouchMove, { passive: false });
        window.addEventListener("touchend", onTouchEnd, { passive: true });
        return () => {
            window.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchmove", onTouchMove);
            window.removeEventListener("touchend", onTouchEnd);
        };
    }, [els, prefersReduced, scrollToIndex]);

    useEffect(() => {
        return () => {
            if (lockTimer.current) clearTimeout(lockTimer.current);
        };
    }, []);

    const value = useMemo<SectionNavValue>(
        () => ({
            sections,
            activeIndex,
            activeId: sections[activeIndex]?.id ?? sections[0]?.id ?? "",
            scrollToIndex,
            scrollToId,
        }),
        [sections, activeIndex, scrollToIndex, scrollToId]
    );

    return (
        <SectionNavContext.Provider value={value}>
            {children}
        </SectionNavContext.Provider>
    );
}
