// ─────────────────────────────────────────────────────────────────────────────
// Turns the unDraw SVGs in scripts/illustrations/ into animated React
// components under src/components/illustrations/.
//
// The sources are flat path soup — no groups, no names — so the parts worth
// animating are addressed by their index in document order among
// path|circle|ellipse|rect|polygon. Those index sets were derived by measuring
// every element's bounding box in a headless browser and checking the result
// against a colour-coded render; PARTS below is that measurement, frozen.
//
// Each element in a part gets `class="il-<part>"`, and parts listed in
// `stagger` additionally get `il-n<k>` for their position within the part. The
// motion itself lives in globals.css under "Illustrations", scoped by the root
// `il-<slug>` class.
//
// Re-run after editing any source SVG — and re-derive PARTS if the artwork
// itself changes, because the indices will shift.
//
//   npm run gen:illustrations
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "illustrations");
const OUT = join(HERE, "..", "src", "components", "illustrations");

const BRAND = "#068554";

/**
 * slug → { component, page, parts, extras }
 *
 * `parts` maps a part name to the element indices it owns. `extras` is markup
 * appended inside the root <svg> — motion the artwork has no shapes for
 * (speed lines, steam, confetti).
 */
const SPEC = {
  "online-revenue": {
    component: "VendorsIllustration",
    page: "/vendors",
    alt: "A vendor watching paid orders land one after another",
    parts: {
      ground: [0],
      easel: [1, 2, 3, 4],
      card1: [5, 6, 7, 8, 9, 10, 11],
      card2: [12, 13, 14, 15, 16, 17, 18],
      card3: [19, 20, 21, 22, 23, 24, 25],
      figure: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    },
    // The cards only ever translate, so they need no shared pivot.
    pivots: { figure: [760, 777] },
  },

  deliveries: {
    component: "AgenciesIllustration",
    page: "/agencies",
    alt: "Two couriers handling parcels that already carry a destination",
    parts: {
      pin: [79, 80, 81, 82, 83],
      parcel: [55, 56, 59, 65, 67, 68, 69],
      stack: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
      boxRight: [38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 51],
      personLeft: [54, 57, 58, 60, 61, 62, 63, 64, 66, 70, 71, 72, 73, 74, 75, 76, 77, 78],
      personRight: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 49, 50, 52, 53],
    },
    pivots: { pin: [42, 135], stack: [421, 452], personLeft: [176, 454], personRight: [660, 454] },
  },

  "on-the-way": {
    component: "AgentsIllustration",
    page: "/agents",
    alt: "A delivery agent riding a run with the parcel box on the back",
    parts: {
      ground: [39],
      foliage: [2, 3, 4, 5, 6, 7],
      hair: [29, 34, 35],
      box: [8, 9, 10, 11, 12, 13],
      rig: [0, 1, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 36, 37, 38],
    },
    // The rig tilts about the contact patch, the box about its own footprint,
    // the hair about the nape.
    pivots: { rig: [438, 349], box: [336, 204], hair: [415, 55] },
    // Dashes streaming off the back wheel. The bike never moves, so this is
    // what actually says "in motion"; they sit behind the artwork.
    extras: {
      position: "prepend",
      markup: [0, 1, 2, 3]
        .map((k) => {
          const y = [214, 258, 300, 178][k];
          const w = [96, 128, 74, 60][k];
          return `<rect className="il-speed il-n${k}" x="${-w}" y="${y}" width="${w}" height="7" rx="3.5" fill="${BRAND}" opacity="0" />`;
        })
        .join("\n      "),
    },
  },

  "happy-customer": {
    component: "CustomersIllustration",
    page: "/customers",
    alt: "A customer holding up the bags from an order that arrived",
    parts: {
      bagL: [11, 12, 13, 15, 23, 26],
      bagR: [4, 5, 6, 8, 9, 10, 16, 24],
      body: [0, 1, 2, 3, 7, 14, 17, 18, 19, 20, 21, 22, 25, 27, 28],
    },
    // Each bag swings from the hand holding it, not from its own middle.
    pivots: { bagL: [58, 14], bagR: [300, 66] },
    extras: {
      position: "append",
      markup: [
        [58, 96, 5.5],
        [352, 74, 4.5],
        [128, 40, 4],
        [300, 132, 5],
        [36, 168, 4],
        [386, 190, 5],
      ]
        .map(([cx, cy, r], k) =>
          `<circle className="il-spark il-n${k}" cx="${cx}" cy="${cy}" r="${r}" fill="${BRAND}" opacity="0" />`
        )
        .join("\n      "),
    },
  },

  decide: {
    component: "PricingIllustration",
    page: "/pricing",
    alt: "Someone weighing up the plans on offer",
    parts: {
      backdrop: [0],
      figure: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      scrap1: [13, 14, 15],
      scrap2: [16, 17, 18, 19, 20],
      scrap3: [21, 22, 23, 24, 25],
      scrap4: [26, 27, 28, 29, 30],
      scrap5: [31, 32, 33],
      scrap6: [34, 35, 36, 37, 38],
      scrap7: [39, 40, 41, 42, 43],
      scrap8: [44, 45, 46, 47, 48],
    },
    pivots: {
      figure: [708, 560],
      scrap1: [371, 46], scrap2: [422, 134], scrap3: [310, 121], scrap4: [467, 54],
      scrap5: [108, 247], scrap6: [28, 320], scrap7: [114, 349], scrap8: [180, 311],
    },
  },

  "reading-time": {
    component: "BlogIllustration",
    page: "/blog",
    alt: "A reader working through a guide under a lamp",
    parts: {
      lamp: [1, 2],
      tablet: [4, 10, 11, 12, 18],
      plant: [15],
      mug: [16],
      scene: [0, 3, 5, 6, 7, 8, 9, 13, 14, 17, 19, 20],
    },
    // The plant sways from its pot, not its middle.
    pivots: { plant: [152, 658], scene: [382, 800] },
    // Steam off the mug at (245..306, 595..658).
    extras: {
      position: "append",
      markup: [0, 1, 2]
        .map((k) => {
          const x = [262, 276, 290][k];
          return `<path className="il-steam il-n${k}" d="M${x} 592 q -7 -14 0 -28 q 7 -14 0 -28" fill="none" stroke="#d6d6e3" strokeWidth="4" strokeLinecap="round" opacity="0" />`;
        })
        .join("\n      "),
    },
  },

  questions: {
    component: "FaqIllustration",
    page: "/faq",
    alt: "Two people in front of an oversized question mark",
    parts: {
      ground: [12],
      swoosh: [1],
      bubbles: [2, 3, 4, 5, 6, 7, 8, 9, 10],
      dot: [0, 16],
      mark: [11, 13, 14, 15],
      personL: [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43],
      personR: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    },
    stagger: ["bubbles"],
    // The glyph tilts about its foot. Each bubble is its own object, so it
    // turns about its own centre.
    pivots: { mark: [485, 516], dot: [490, 623], personL: [177, 677], personR: [665, 675] },
    selfPivot: ["bubbles"],
  },

  // ---------------------------------------------------------------------------
  // A rule these three share, learned from a colour-coded render of the sources:
  // **every prop in them is held in a hand.** The clipboard, the round badge and
  // the card on /about, the CV on /careers, the question card and the phone on
  // /contact — all of them are gripped by a figure rather than free-standing.
  //
  // So a prop is never its own animated part. Either it is merged into the
  // figure holding it (and moves with the hand, which is what /about does), or
  // the figure is left still and only the things drawn *on* the prop move (which
  // is what /careers and /contact do). Animating a held prop independently pulls
  // it out of the hand — the one failure mode this artwork invites.
  // ---------------------------------------------------------------------------

  "about-us": {
    component: "AboutIllustration",
    page: "/about",
    alt: "Three people holding up the things they have built together",
    parts: {
      ground: [0],
      plantR: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      plantL: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      // Each figure carries its prop: the centre one's clipboard (23–34), the
      // left one's round badge (59–63), the right one's card (73–77).
      figureC: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
      figureL: [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 81, 82, 83, 84],
      figureR: [64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80],
    },
    // Figures scale about the ground under their own feet; shrubs sway from
    // their base, where they actually meet the ground.
    pivots: {
      plantR: [771, 556], plantL: [300, 580],
      figureC: [460, 534], figureL: [225, 590], figureR: [670, 590],
    },
  },

  careers: {
    component: "CareersIllustration",
    page: "/careers",
    alt: "Someone holding up an application board with candidates on it",
    parts: {
      figure: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
      card: [10, 11],
      photo: [16, 17, 18, 19, 20],
      tag: [13],
      rowA: [25, 26, 27],
      rowB: [22, 23, 24],
      rowC: [14, 15, 21],
    },
    // The figure and the board it holds are both still, which is what lets the
    // three candidate rows animate: they are drawn on the board, so the board
    // has to be a fixed surface for them to arrive onto.
    selfPivot: ["tag"],
  },

  "contact-us": {
    component: "ContactIllustration",
    page: "/contact",
    alt: "A message being written, with someone waiting to answer it",
    parts: {
      ground: [2],
      card: [1],
      // The grey swoosh linking the two figures. Static: both of its ends are
      // anchored to something, so any motion opens a gap at one end.
      arc: [19],
      mark: [20, 21, 22, 23, 24, 25, 26, 27],
      lines: [28, 29, 30],
      personL: [0, 14, 15, 16, 17, 18, 31, 32, 33],
      // 3 and 4 are the phone, merged in because the right figure is holding it.
      personR: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    },
    stagger: ["lines"],
    pivots: { mark: [313, 100] },
    // A ring leaving the question mark — the only motion here that is not drawn
    // on the card, and the one thing in the scene that can move without being
    // attached to a hand.
    extras: {
      position: "append",
      markup: [0, 1]
        .map(
          (k) =>
            `<circle className="il-ping il-n${k}" cx="313" cy="60" r="26" fill="none" stroke="${BRAND}" strokeWidth="3" opacity="0" />`
        )
        .join("\n      "),
    },
  },

  world: {
    component: "CameroonIllustration",
    page: "/cameroon",
    alt: "Pins being placed on a globe, city by city",
    parts: {
      ring: [53],
      deco: [0, 1],
      pinA: [28, 30, 31, 32],
      pinB: [23, 26, 27],
      pinC: [39, 41, 42, 43],
      globe: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 29, 40, 44],
      figure: [3, 33, 34, 35, 36, 37, 38, 45, 46, 47, 48, 49, 50, 51, 52],
    },
    // Ring and globe share the globe's centre; each pin turns about its tip.
    pivots: {
      ring: [341, 264], globe: [341, 264], figure: [585, 591],
      pinA: [227, 256], pinB: [378, 213], pinC: [522, 210],
    },
    // A ring that expands out of each pin's foot as it lands.
    extras: {
      position: "prepend",
      markup: [
        [227, 250],
        [378, 208],
        [522, 205],
      ]
        .map(([cx, cy], k) =>
          `<circle className="il-ping il-n${k}" cx="${cx}" cy="${cy}" r="10" fill="none" stroke="${BRAND}" strokeWidth="3" opacity="0" />`
        )
        .join("\n      "),
    },
  },
};

/** SVG attribute → JSX prop. Anything not listed passes through unchanged. */
const ATTR = {
  "xmlns:xlink": "xmlnsXlink",
  "xlink:href": "xlinkHref",
  "clip-path": "clipPath",
  "clip-rule": "clipRule",
  "fill-rule": "fillRule",
  "fill-opacity": "fillOpacity",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "stroke-opacity": "strokeOpacity",
  "stop-color": "stopColor",
  "stop-opacity": "stopOpacity",
  "gradient-units": "gradientUnits",
  "gradient-transform": "gradientTransform",
  "data-name": "data-name",
  class: "className",
};

// Dropped wherever they appear. The root's own width/height/viewBox are not
// listed: build() replaces the whole root tag, so they never reach the output,
// and listing them here would strip the dimensions off every <rect> too.
const DROP = new Set(["artist", "source", "xmlns", "xmlns:xlink", "role"]);

/** `style="isolation:isolate"` → `style={{ isolation: "isolate" }}`. */
function styleToJsx(val) {
  const props = val
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const at = d.indexOf(":");
      const prop = d.slice(0, at).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return `${prop}: ${JSON.stringify(d.slice(at + 1).trim())}`;
    })
    .join(", ");
  return `style={{ ${props} }}`;
}

function toJsx(svg) {
  return svg.replace(
    /<([a-zA-Z]+)((?:\s+[^\s=>]+\s*=\s*"[^"]*")*)\s*(\/?)>/g,
    (_m, tag, attrs, selfClose) => {
      const rebuilt = [...attrs.matchAll(/\s+([^\s=>]+)\s*=\s*"([^"]*)"/g)]
        .filter(([, k]) => !DROP.has(k))
        .map(([, k, val]) => (k === "style" ? styleToJsx(val) : `${ATTR[k] ?? k}="${val}"`))
        .join(" ");
      return `<${tag}${rebuilt ? " " + rebuilt : ""}${selfClose ? " /" : ""}>`;
    }
  );
}

/** unDraw ships duplicate ids across files; scope them so inlining is safe. */
function scopeIds(svg, slug) {
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const safe = `${slug}-${id}`;
    svg = svg
      .split(`id="${id}"`).join(`id="${safe}"`)
      .split(`url(#${id})`).join(`url(#${safe})`)
      .split(`href="#${id}"`).join(`href="#${safe}"`);
  }
  return svg;
}

// ---- Affine helpers -------------------------------------------------------
// Only enough matrix work to answer one question: where does a pivot given in
// viewBox coordinates land inside a particular element's own coordinate
// system? Everything downstream depends on that, because `transform-origin`
// lengths resolve locally, not against the viewBox — verified in Chromium.

const I = [1, 0, 0, 1, 0, 0]; // a b c d e f

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

function invApply([a, b, c, d, e, f], x, y) {
  const det = a * d - b * c;
  const px = x - e;
  const py = y - f;
  return [(d * px - c * py) / det, (a * py - b * px) / det];
}

function parseTransform(str) {
  let m = I;
  for (const [, fn, argStr] of str.matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const n = argStr.trim().split(/[\s,]+/).map(Number);
    if (fn === "translate") {
      m = mul(m, [1, 0, 0, 1, n[0] || 0, n[1] || 0]);
    } else if (fn === "matrix") {
      m = mul(m, n);
    } else if (fn === "scale") {
      m = mul(m, [n[0], 0, 0, n.length > 1 ? n[1] : n[0], 0, 0]);
    } else if (fn === "rotate") {
      const r = ((n[0] || 0) * Math.PI) / 180;
      const [cos, sin] = [Math.cos(r), Math.sin(r)];
      const rot = [cos, sin, -sin, cos, 0, 0];
      // rotate(a cx cy) turns about (cx, cy) rather than the origin.
      m = n.length > 1
        ? mul(mul(mul(m, [1, 0, 0, 1, n[1], n[2]]), rot), [1, 0, 0, 1, -n[1], -n[2]])
        : mul(m, rot);
    } else {
      throw new Error(`unhandled transform: ${fn}()`);
    }
  }
  return m;
}

/**
 * Wrap every element belonging to a part in its own `<g>` and put the
 * animation class on the wrapper.
 *
 * Wrapping rather than tagging the element directly buys two things. The CSS
 * `transform` property overrides an element's own `transform` attribute, and
 * plenty of these paths carry one — animating them in place would fling them
 * across the canvas. And a wrapper sits exactly where its child sat, so paint
 * order survives even though a part's elements are rarely contiguous.
 *
 * Parts in `pivots` rotate or scale as a unit, so each wrapper is handed the
 * shared pivot converted into its own local coordinates. Parts in `selfPivot`
 * turn about their own centre and just get `fill-box`.
 */
function wrapParts(svg, { parts, stagger = [], pivots = {}, selfPivot = [] }) {
  const owner = new Map();
  for (const [part, idx] of Object.entries(parts)) {
    idx.forEach((i, n) => owner.set(i, { part, n }));
  }
  const staggered = new Set(stagger);
  const selfish = new Set(selfPivot);

  // One pass over the markup, carrying the ancestor matrix down the tree.
  const TOKEN = /<(\/?)([a-zA-Z]+)((?:\s+[^\s=>]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  const stack = [I];
  const drawable = new Set(["path", "circle", "ellipse", "rect", "polygon"]);
  let out = "";
  let last = 0;
  let index = 0;
  let m;

  while ((m = TOKEN.exec(svg)) !== null) {
    const [full, close, tag, attrs, selfClose] = m;
    const own = attrs.match(/\stransform="([^"]*)"/)?.[1];
    const here = stack[stack.length - 1];

    if (close) {
      if (!drawable.has(tag)) stack.pop();
      continue;
    }

    if (!drawable.has(tag)) {
      if (!selfClose) stack.push(own ? mul(here, parseTransform(own)) : here);
      continue;
    }

    const hit = owner.get(index++);
    if (!hit) continue;

    // The element ends at this tag if self-closing, else at its close tag.
    let end = m.index + full.length;
    if (!selfClose) {
      const closeAt = svg.indexOf(`</${tag}>`, end);
      if (closeAt === -1) throw new Error(`unclosed <${tag}>`);
      end = closeAt + tag.length + 3;
    }

    const classes = [`il-${hit.part}`];
    if (staggered.has(hit.part)) classes.push(`il-n${hit.n}`);

    // Plain SVG attributes — toJsx() runs after this and converts them.
    let style = "";
    const pivot = pivots[hit.part];
    if (pivot) {
      const [lx, ly] = invApply(here, pivot[0], pivot[1]);
      style = ` style="transform-origin:${+lx.toFixed(2)}px ${+ly.toFixed(2)}px"`;
    } else if (selfish.has(hit.part)) {
      style = ` style="transform-box:fill-box;transform-origin:50% 50%"`;
    }

    out += svg.slice(last, m.index);
    out += `<g class="${classes.join(" ")}"${style}>${svg.slice(m.index, end)}</g>`;
    last = end;
    TOKEN.lastIndex = end;
  }

  return out + svg.slice(last);
}

function build(slug, spec) {
  let svg = readFileSync(join(SRC, `${slug}.svg`), "utf8").trim();

  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`${slug}.svg has no viewBox`);

  // These eight range from 2.28:1 to 0.48:1, so any layout that budgets width
  // alone makes the portrait ones tower and the landscape ones sprawl. The
  // ratio ships as `--il-ar` and the hero rules size against both budgets.
  const [, , vw, vh] = viewBox.trim().split(/[\s,]+/).map(Number);
  const aspect = +(vw / vh).toFixed(4);

  // Order matters: wrapParts reads plain SVG attributes, toJsx rewrites them.
  svg = scopeIds(svg, slug);
  svg = wrapParts(svg, spec);
  svg = toJsx(svg);

  // Rebuild the root tag on our own terms.
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").trim();
  const extras = spec.extras?.markup ?? "";
  const body = [
    spec.extras?.position === "prepend" ? extras : "",
    inner,
    spec.extras?.position === "append" ? extras : "",
  ].filter(Boolean).join("\n      ");

  return `// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit by hand.
//
// ${spec.alt}. Drawn by Katerina Limpitsouni for unDraw (undraw.co), recoloured
// to the Wi-Mall green and cut into animated parts for ${spec.page}.
//
// The motion is CSS, scoped by the \`il-${slug}\` class in globals.css, and it
// starts when the illustration scrolls into view. It stops only when
// HONOR_REDUCED_MOTION is switched on in lib/reduced-motion — deliberately not
// on the raw OS setting, which Windows reports as \`reduce\` for a common
// non-accessibility preference.
//
// Regenerate with: npm run gen:illustrations
// ─────────────────────────────────────────────────────────────────────────────
"use client";
import { useRef, type CSSProperties, type SVGProps } from "react";
import { useInView } from "framer-motion";
import { useSignatureReducedMotion } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";

/** Width ÷ height of the artwork. Layout rules size against it — see \`.il-hero-art\`. */
const ASPECT = ${aspect};

interface ${spec.component}Props extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  /** Accessible name. Omit to hide the illustration from assistive tech. */
  title?: string;
}

export default function ${spec.component}({ title, className, style, ...props }: ${spec.component}Props) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  // Every rule in globals.css hangs off data-play, so withholding it is the
  // whole still tier. Routed through the signature flag rather than a CSS media
  // query: Windows reports \`reduce\` whenever "Animation effects" is off, which
  // silently froze these for a large share of visitors. See lib/reduced-motion.
  const still = useSignatureReducedMotion();

  return (
    <svg
      ref={ref}
      viewBox="${viewBox}"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden={title ? undefined : true}
      data-play={inView && !still ? "true" : "false"}
      className={cn("il il-${slug}", className)}
      style={{ "--il-ar": ASPECT, ...style } as CSSProperties}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      ${body}
    </svg>
  );
}
`;
}

let n = 0;
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".svg"))) {
  const slug = file.replace(/\.svg$/, "");
  const spec = SPEC[slug];
  if (!spec) {
    console.warn(`  skip ${file} — no entry in SPEC`);
    continue;
  }
  writeFileSync(join(OUT, `${spec.component}.generated.tsx`), build(slug, spec));
  console.log(`  ${file} → ${spec.component}.generated.tsx`);
  n++;
}

const index = Object.entries(SPEC)
  .sort(([, a], [, b]) => a.component.localeCompare(b.component))
  .map(([, s]) => `export { default as ${s.component} } from "./${s.component}.generated";`)
  .join("\n");
writeFileSync(join(OUT, "index.ts"), `// GENERATED FILE — do not edit by hand. See scripts/gen-illustrations.mjs.\n${index}\n`);

console.log(`\n${n} illustration${n === 1 ? "" : "s"} generated.`);
