"use client";
import { useEffect, useRef } from "react";

/**
 * A hairline progress bar under the navbar, tracking position through the
 * article body.
 *
 * Measured against the article element rather than the document, so the header,
 * the related-articles row and the footer do not count as "reading" — a bar
 * that hits 100% while there are still three paragraphs left is worse than no
 * bar.
 *
 * Writes a CSS custom property and lets `transform: scaleX()` do the work, so
 * nothing here triggers layout or paint. The whole update is one style write on
 * one element inside a rAF, which is what makes it safe to run on the cheap
 * phones this product is built for.
 */
export default function ReadingProgress({ targetId }: { targetId: string }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = document.getElementById(targetId);
    const node = bar.current;
    if (!element || !node) return;

    let frame = 0;

    const update = () => {
      frame = 0;

      const rect = element.getBoundingClientRect();
      // How far the article's own scrollable length has passed the top of the
      // viewport. Subtracting the viewport height means the bar completes when
      // the last line is visible, not when the element's foot reaches the top.
      const total = rect.height - window.innerHeight;
      const progress = total <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / total));

      node.style.transform = `scaleX(${progress})`;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [targetId]);

  return (
    // Purely decorative duplicate of information the scrollbar already conveys,
    // so it is hidden from assistive technology rather than exposed as a
    // progressbar nobody asked for.
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-16 z-40 h-0.5 bg-transparent lg:top-[4.5rem]"
    >
      <div
        ref={bar}
        className="h-full origin-left bg-gradient-to-r from-primary-600 to-primary-400 rtl:origin-right"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
