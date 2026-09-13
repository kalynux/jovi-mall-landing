"use client";
/**
 * SectionNavProvider — section awareness for the landing page.
 *
 * The page scrolls natively. This provider never touches the scroll position
 * unless something asks it to; it only watches:
 *
 *  • a rAF-throttled scroll listener tracks the active section and syncs the
 *    URL hash via history.replaceState (no back-button spam);
 *  • scrollToIndex / scrollToId smooth-scroll on request — the section rail,
 *    the footer's in-page anchors and an incoming #hash on mount;
 *  • prefers-reduced-motion makes those requested jumps instant.
 *
 * It used to hijack wheel, keyboard and touch to snap exactly one section per
 * gesture. That is gone, and deliberately so:
 *
 *  • on a phone `touchmove` was cancelled outright for any section that fitted
 *    the viewport, so a swipe did not scroll the page at all — it armed a 780ms
 *    programmatic jump that fired on release. The destination arrived before
 *    its own entrance animations had run, which is the "the whole section
 *    appears at once" glitch;
 *  • the gate for that cancel was `height > innerHeight`, and on mobile
 *    `innerHeight` changes every time the URL bar hides, so the same swipe was
 *    sometimes captured and sometimes not;
 *  • it stepped through sections by their index in SECTION_IDS, whose order had
 *    drifted from the DOM, so "the next section" was regularly not the next
 *    section on screen.
 *
 * Consumers (Footer, SectionProgressIndicator) read state and trigger
 * navigation through the useSectionNav() hook, exactly as before.
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

/** Access the section nav state. Must be used under <SectionNavProvider>. */
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
 * that don't mount the landing page's section rail.
 */
export function useOptionalSectionNav(): SectionNavValue | null {
    return useContext(SectionNavContext);
}

export function SectionNavProvider({
    sections,
    children,
}: {
    sections: SectionMeta[];
    children: ReactNode;
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeIndexRef = useRef(0);

    const els = useCallback(
        () =>
            sections
                .map((s) => document.getElementById(s.id))
                .filter((el): el is HTMLElement => el != null),
        [sections]
    );

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
            window.scrollTo({
                top,
                behavior: prefersReduced() ? "auto" : "smooth",
            });
        },
        [els, prefersReduced]
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
