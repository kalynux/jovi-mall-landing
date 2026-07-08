/**
 * GrainOverlay — a static, ultra-cheap film-grain texture over the whole page.
 *
 * Pure CSS (base64 SVG noise via the `.grain` utility). No JS, no animation,
 * no repaint cost beyond the initial composite. Sits above the aurora but
 * below content, and never intercepts pointer events.
 */
export default function GrainOverlay() {
    return (
        <div
            aria-hidden="true"
            className="grain pointer-events-none fixed inset-0 -z-10 opacity-[0.06] mix-blend-overlay dark:opacity-[0.09]"
        />
    );
}
