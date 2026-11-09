/**
 * The ink journal (docs/STORY.md, "A journal over the universe"): what Mohammad's pen writes over each figure, as data.
 * The engine (src/bridges/ink.ts) pins every mark to the anchors and paths the GL writes (src/lib/anchors.ts), draws
 * it on by scroll inside its `draw` window (local k of its figure: scrolling back undraws it), fades it in its `fade`
 * window, and never shows more than five at once (by `pri`). A mark whose anchor is not live fades out fast.
 *
 * Ink style: hairlines in paper white at 55-75 %, gold for each figure's key mark, notes in a small lowercase mono.
 * Numbers in the notes are measured from the simulation (shared.play), never made up.
 */
import type { shared } from "@/gl/shared";
import { ANCHOR, PATH } from "@/lib/anchors";
import type { FigureId } from "@/lib/journey";
import { projects, proof, work } from "./site";

export type Play = typeof shared.play;
type Win = readonly [number, number];

/** Values the engine derives once per frame (or slower) for the notes; read-only here. */
export type InkEnv = {
  /** Minutes past midnight in Riyadh, now (updated twice a second). */
  riyadhMin: number;
  /** Your point's speed (km/s) when it left, and after each flyby so far (latched as `play.flybys` counts up). */
  launchSpeed: number;
  flyby: Float32Array;
  flybyN: number;
  /** Index into STARS of the platform star under the pointer (-1 for none). */
  hover: number;
  /** City lights lit on the world (Fig. 8). */
  cities: number;
  /** A phone's narrow page: long notes write their short form. */
  narrow: boolean;
};

/** Text a mark writes: fixed, or measured (`fmt` runs only when `key` changes, so nothing is built per frame). */
type InkText =
  | string
  | { key: (p: Play, e: InkEnv) => number; fmt: (p: Play, e: InkEnv) => string };
/** An anchor id, or one picked from the visitor's outcomes (return a prebuilt string: no allocation per frame). */
export type InkAt = string | ((p: Play) => string);

type Mark = {
  fig: FigureId;
  /** Local k window in which the mark draws itself on (scrubbed by scroll). */
  draw: Win;
  /** Local k window in which it fades out. Default [0.9, 0.98]: gone before the next figure. */
  fade?: Win;
  /** When more than five marks want the page, the highest keep it. Default 1. */
  pri?: number;
  /** The figure's key mark, in gold. */
  gold?: boolean;
  /** Only when the visitor's outcome says so (fades in or out with it). */
  when?: (p: Play, e: InkEnv) => boolean;
  /** Fig. 1: also draws itself on in time after the big bang, before any scroll. */
  bang?: boolean;
  /** A dense mark: 0.8 px. */
  fine?: boolean;
};

export type InkItem = Mark &
  (
    | {
        /** A hand-drawn circle around an anchor: its projected radius plus `pad`, or `px` across. */
        kind: "circle";
        at: InkAt;
        pad?: number;
        px?: number;
        /** A small note on the rim, at `angle` degrees (0 = right, -90 = top). */
        text?: InkText;
        angle?: number;
      }
    | {
        /** Text near an anchor with a leader line (standing off a big body by part of its radius). `margin` sends the
         *  text to the page's edge (a sketch of who is in the room); `away` keeps the words on the far side from another
         *  body (chosen when the mark appears: a planet left of the sun is named on the left, `margin` is then only the
         *  default); `mid` pins it halfway between two anchors; `mark: "x"` crosses the spot. A body below the caption
         *  is named in the free band under it, never on the line of copy. */
        kind: "label";
        at: InkAt;
        text: InkText;
        dx: number;
        dy: number;
        margin?: "left" | "right";
        away?: InkAt;
        mid?: InkAt;
        mark?: "x";
      }
    | {
        /** Anchor to anchor, stopping short of both bodies, with a small open head. */
        kind: "arrow";
        from: InkAt;
        to: InkAt;
        bend?: number;
        text?: InkText;
      }
    | {
        /** Projected polylines (one mark, however many paths). `span` draws a stretch of it; `offset` runs beside it
         *  (px, to the left of travel); `bracket` closes the ends like a printer's bracket. */
        kind: "path";
        path: string | readonly string[];
        dash?: boolean;
        span?: Win;
        offset?: number;
        bracket?: boolean;
        text?: InkText;
      }
    | {
        /** Marks across a path at fractions of its length, with text; `flybys` puts one at each flyby so far,
         *  written with the speed it borrowed there. */
        kind: "ticks";
        path: string;
        at?: readonly number[];
        text?: readonly string[];
        flybys?: boolean;
      }
    | {
        /** Margin text at a fixed place on the page (fractions of the viewport; `m` on phones). */
        kind: "note";
        x: number;
        y: number;
        m?: readonly [number, number];
        text: InkText;
        align?: "start" | "end";
      }
    | {
        /** A dashed line from the cursor to an anchor; `play.autonomy` breaks it in the middle. */
        kind: "tether";
        to: InkAt;
        text?: InkText;
      }
  );

/* ---------------------------------------------------------------- ids */

const KNOT = [ANCHOR.knot(0), ANCHOR.knot(1), ANCHOR.knot(2)];
const PLANET = [0, 1, 2, 3, 4].map((i) => ANCHOR.planet(i));
const ORBIT = [0, 1, 2, 3, 4].map((i) => PATH.orbit(i));
const FIELD = [0, 1, 2, 3].map((i) => PATH.field(i));

/**
 * Fig. 2's version tags sit on four of the nebula's hundred clumps (anchors `clump0..3`, set by the genesis figure
 * through fig. 2: src/gl/show/figures/genesis.ts CLUMPS).
 */
const CLUMP = [0, 1, 2, 3].map((i) => ANCHOR.clump(i));

/**
 * Fig. 3's three knots, by index (the GL must match): 0 is the loud one (bright, flickering, light), 1 the heaviest
 * (quieter and bigger), 2 between. The masses are the ink's own reading of them.
 */
const KNOTS = { loud: 0, heavy: 1, mass: ["m 0.6", "m 2.4", "m 1.1"] } as const;
/** The chosen knot (the heaviest until there is a choice) and the other two. */
const chosen = (p: Play) => KNOT[p.center < 0 ? KNOTS.heavy : p.center];
const other = (n: 1 | 2) => (p: Play) => KNOT[((p.center < 0 ? KNOTS.heavy : p.center) + n) % 3];
/** The knot a click would pick now (fig. 3's hover), "" for none. */
const aimed = (p: Play) => (p.centerAim >= 0 ? KNOT[p.centerAim] : "");

/** Fig. 5: the two orbits that cross (engineering's and product's, of course). */
const CROSSING = [0, 1] as const;

/**
 * The record says nine of 50+ projects and platforms and site.ts names fifteen (the nine and the also-shipped list): the rest of the
 * galaxy's lit stars are the platforms the site does not name, and they answer the pointer as quietly as they shine.
 */
const UNNAMED_STARS = 36;

/**
 * Fig. 11's platform stars: the nine projects (anchor `star:<slug>`), the also-shipped list (`star:<domain>`) and the
 * unnamed ones (`star:unnamed-<i>`), with what the label writes for each: name, sector and his role; `short` (name and
 * sector) on a phone. `named`: it has a place in Work to jump to (an unnamed one jumps to Work's heading).
 */
export const STARS: { id: string; slug: string; text: string; short: string; named: boolean }[] = [
  ...projects.map((p) => {
    const name = p.name.toLowerCase();
    const sector = (proof.sector[p.slug] ?? "").toLowerCase();
    return {
      id: ANCHOR.star(p.slug),
      slug: p.slug,
      text: `${name} · ${sector} · ${(proof.role[p.slug] ?? "").toLowerCase()}`,
      short: `${name} · ${sector}`,
      named: true,
    };
  }),
  ...work.more.map((m) => ({
    id: ANCHOR.star(m.label),
    slug: m.label,
    text: `${m.label} · also shipped`,
    short: m.label,
    named: true,
  })),
  ...Array.from({ length: UNNAMED_STARS }, (_, i) => ({
    id: ANCHOR.star(`unnamed-${i}`),
    slug: `unnamed-${i}`,
    text: "one of the 50+ · not named here",
    short: "one of the 50+",
    named: false,
  })),
];
const STAR_BY_SLUG = new Map(STARS.map((s, i) => [s.slug, i]));
/** Index into STARS of a hovered slug (-1 for none); a Map lookup, no allocation. */
export const starIndex = (slug: string) => (slug ? (STAR_BY_SLUG.get(slug) ?? -1) : -1);

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/* ---------------------------------------------------------------- the journal, figure by figure */

export const INK: InkItem[] = [
  // ---- Fig. 1, the point: after the burst, a leader to your point (the crosshair and the hold ring are the cursor's);
  // the one mark stays on it through Fig. 2 (never undrawn and redrawn at the seam). Up and to its left: the cloud's
  // young stars (fig. 3's knots to be, not yet anchors) sit round it at rest, the brightest up and to its right, so the
  // word never seems to name another star (measured at 1280 to 1920 wide: 60-80 px clear on this side, 5-12 on the
  // other); the engine keeps it off the clumps and knots that are anchored
  {
    fig: "point",
    kind: "label",
    at: ANCHOR.yours,
    text: "yours",
    dx: -64,
    dy: -46,
    draw: [0.1, 0.22],
    fade: [1.9, 1.98],
    gold: true,
    bang: true,
    pri: 3,
  },

  // ---- Fig. 2, a hundred versions: version tags on the clumps, your point still labelled (Fig. 1's mark)
  {
    fig: "versions",
    kind: "label",
    at: CLUMP[0],
    text: "v.2",
    dx: -26,
    dy: -22,
    draw: [0.14, 0.22],
    fine: true,
  },
  {
    fig: "versions",
    kind: "label",
    at: CLUMP[1],
    text: "v.17",
    dx: 24,
    dy: -24,
    draw: [0.22, 0.3],
    fine: true,
  },
  {
    fig: "versions",
    kind: "label",
    at: CLUMP[2],
    text: "v.64",
    dx: 26,
    dy: 20,
    draw: [0.3, 0.38],
    fine: true,
  },
  {
    fig: "versions",
    kind: "label",
    at: CLUMP[3],
    text: "v.93",
    dx: -24,
    dy: 22,
    draw: [0.38, 0.46],
    fine: true,
  },

  // ---- Fig. 3, the center: a circle and a mass on each knot, the loud one named; then "this one" and the fall
  ...[0, 1, 2].map(
    (i): InkItem => ({
      fig: "center",
      kind: "circle",
      at: KNOT[i],
      pad: 9,
      text: KNOTS.mass[i],
      angle: i === 1 ? -36 : i === 0 ? -150 : -30,
      draw: [0.02 + i * 0.04, 0.12 + i * 0.04],
      fade: [0.78, 0.86],
      // the others let go of their circles once the center is chosen
      when: (p) => p.center < 0 || p.center === i,
      pri: 2,
    }),
  ),
  // the pick, shown before it is made: a gold ring round the knot a click would choose (a mouse; a finger taps one)
  {
    fig: "center",
    kind: "circle",
    at: aimed,
    pad: 17,
    draw: [0.14, 0.18],
    fade: [0.42, 0.46],
    gold: true,
    fine: true,
    when: (p) => p.centerAim >= 0 && !p.centerByVisitor,
    pri: 3,
  },
  {
    fig: "center",
    kind: "label",
    at: KNOT[KNOTS.loud],
    text: "loudest",
    dx: -58,
    dy: 44,
    draw: [0.12, 0.2],
    when: (p) => p.center < 0,
  },
  {
    fig: "center",
    kind: "label",
    at: chosen,
    text: "this one",
    dx: 74,
    dy: 58,
    draw: [0.14, 0.26],
    fade: [0.88, 0.95],
    gold: true,
    when: (p) => p.center >= 0,
    pri: 4,
  },
  {
    fig: "center",
    kind: "arrow",
    from: other(1),
    to: chosen,
    bend: 18,
    draw: [0.44, 0.56],
    fade: [0.76, 0.84],
    when: (p) => p.center >= 0,
    pri: 3,
  },
  {
    fig: "center",
    kind: "arrow",
    from: other(2),
    to: chosen,
    bend: -18,
    draw: [0.48, 0.6],
    fade: [0.76, 0.84],
    when: (p) => p.center >= 0,
    pri: 3,
  },

  // ---- Fig. 4, gathering: dashed orbits as the planets condense, then who is in the room, sketched in the margins
  {
    fig: "gathering",
    kind: "path",
    path: ORBIT,
    dash: true,
    fine: true,
    draw: [0.1, 0.42],
    fade: [0.44, 0.52],
  },
  // (each named in the margin on its own side of the sun, so no leader runs across the sun's disc)
  {
    fig: "gathering",
    kind: "label",
    at: PLANET[0],
    text: "engineering",
    dx: 0,
    dy: -44,
    margin: "left",
    away: ANCHOR.center,
    draw: [0.42, 0.52],
    fade: [0.92, 0.99],
  },
  {
    fig: "gathering",
    kind: "label",
    at: PLANET[1],
    text: "product",
    dx: 0,
    dy: -48,
    margin: "right",
    away: ANCHOR.center,
    draw: [0.48, 0.58],
    fade: [0.92, 0.99],
  },
  {
    fig: "gathering",
    kind: "label",
    at: PLANET[3],
    text: "data",
    dx: 0,
    dy: 46,
    margin: "right",
    away: ANCHOR.center,
    draw: [0.54, 0.64],
    fade: [0.92, 0.99],
  },
  {
    fig: "gathering",
    kind: "label",
    at: PLANET[4],
    text: "operations",
    dx: 0,
    dy: 42,
    margin: "left",
    away: ANCHOR.center,
    draw: [0.6, 0.7],
    fade: [0.92, 0.99],
  },
  {
    fig: "gathering",
    kind: "label",
    at: PLANET[2],
    text: "who it's for",
    dx: 58,
    dy: 50,
    draw: [0.68, 0.8],
    fade: [0.92, 0.99],
    gold: true,
    pri: 2,
  },

  // ---- Fig. 5, alignment: the two crossing paths, where they cross, then aligned; the outcome in the margin
  {
    fig: "alignment",
    kind: "path",
    path: [ORBIT[CROSSING[0]], ORBIT[CROSSING[1]]],
    draw: [0.0, 0.2],
    fade: [0.86, 0.94],
    pri: 2,
  },
  {
    fig: "alignment",
    kind: "label",
    at: PLANET[CROSSING[0]],
    mid: PLANET[CROSSING[1]],
    mark: "x",
    text: "crossing",
    dx: 34,
    dy: -30,
    draw: [0.12, 0.24],
    fade: [0.52, 0.6],
    when: (p) => p.aligned < 0.98,
  },
  {
    fig: "alignment",
    kind: "label",
    at: ANCHOR.center,
    text: "aligned",
    dx: -84,
    dy: -58,
    draw: [0.8, 0.88],
    gold: true,
    when: (p) => p.aligned >= 0.98,
    pri: 3,
  },
  // (the outcome is written whole before the figure lets it go)
  {
    fig: "alignment",
    kind: "note",
    x: 0.07,
    y: 0.17,
    m: [0.06, 0.2],
    text: "pulled together.",
    draw: [0.76, 0.86],
    fade: [0.94, 0.99],
    when: (p) => p.aligned >= 0.999 && p.alignedByVisitor,
    pri: 2,
  },
  {
    fig: "alignment",
    kind: "note",
    x: 0.07,
    y: 0.17,
    m: [0.06, 0.2],
    text: "would have got there. took longer.",
    draw: [0.76, 0.86],
    fade: [0.94, 0.99],
    when: (p) => p.aligned >= 0.999 && !p.alignedByVisitor,
    pri: 2,
  },

  // ---- Fig. 6, the window: the planned trajectory through every planet, a countdown along it, the window bracketed
  {
    fig: "window",
    kind: "path",
    path: PATH.assist,
    dash: true,
    draw: [0.3, 0.62],
    gold: true,
    pri: 3,
  },
  {
    fig: "window",
    kind: "ticks",
    path: PATH.assist,
    at: [0.3, 0.52, 0.74],
    text: ["T−3", "T−2", "T−1"],
    draw: [0.5, 0.74],
    fine: true,
    pri: 2,
  },
  {
    fig: "window",
    kind: "path",
    path: PATH.assist,
    span: [0.0, 0.18],
    offset: 16,
    bracket: true,
    text: "window",
    draw: [0.62, 0.76],
    pri: 2,
  },

  // ---- Fig. 7, gravity assist: the trail, your point's speed, what each flyby lent it, and the timing graded
  {
    fig: "assist",
    kind: "path",
    path: PATH.trail,
    draw: [0.14, 0.2],
    fade: [0.9, 0.98],
    gold: true,
    pri: 4,
  },
  {
    fig: "assist",
    kind: "label",
    at: ANCHOR.probe,
    text: { key: (p) => Math.round(p.speed), fmt: (p) => `v ${Math.round(p.speed)} km/s` },
    dx: 46,
    dy: -38,
    draw: [0.16, 0.24],
    fade: [0.84, 0.92],
    when: (p) => p.launchT >= 0 && p.speed > 0,
    pri: 3,
  },
  {
    fig: "assist",
    kind: "ticks",
    path: PATH.trail,
    flybys: true,
    draw: [0.14, 0.18],
    fade: [0.9, 0.98],
    fine: true,
    pri: 2,
  },
  {
    fig: "assist",
    kind: "note",
    x: 0.07,
    y: 0.17,
    // (a phone's chase frames the sun in the top-left corner, where the other figures keep their notes: fig. 7 writes
    // its notes at the foot of the page instead, under the copy)
    m: [0.06, 0.82],
    // v 11 → 19 → 28 → 42 km/s, as the flybys happen
    text: {
      key: (_p, e) => e.flybyN * 1000 + (e.launchSpeed > 0 ? Math.round(e.launchSpeed) : 0),
      // speeds not seen (a jump into mid-flight) are NaN: they fold into one "…"
      fmt: (_p, e) => {
        let s = "v";
        let gap = false;
        for (let i = -1; i < e.flybyN; i++) {
          const v = i < 0 ? e.launchSpeed : e.flyby[i];
          const sep = i < 0 ? " " : " → ";
          if (v > 0) {
            s += `${sep}${Math.round(v)}`;
            gap = false;
          } else if (!gap) {
            s += `${sep}…`;
            gap = true;
          }
        }
        return `${s} km/s`;
      },
    },
    draw: [0.2, 0.3],
    when: (p) => p.launchT >= 0 && p.speed > 0,
    pri: 2,
  },
  {
    fig: "assist",
    kind: "note",
    x: 0.07,
    y: 0.215,
    m: [0.06, 0.855],
    text: "right on the window.",
    draw: [0.2, 0.3],
    fade: [0.62, 0.7],
    when: (p) => p.launchByVisitor && p.launchTiming >= 0.8,
  },
  {
    fig: "assist",
    kind: "note",
    x: 0.07,
    y: 0.215,
    m: [0.06, 0.855],
    text: "a little early. the planets made up for it.",
    draw: [0.2, 0.32],
    fade: [0.62, 0.7],
    when: (p) => p.launchByVisitor && p.launchTiming < 0.8,
  },

  // ---- Fig. 8, theirs: first light where your point landed (riyadh), then a quiet count of cities. The words stand
  // off to the south-east, over the empty quarter and the Arabian Sea: every other way from Riyadh is lit
  {
    fig: "theirs",
    kind: "label",
    at: ANCHOR.hub,
    text: "first light",
    dx: 70,
    dy: 56,
    draw: [0.02, 0.12],
    gold: true,
    pri: 3,
  },
  {
    fig: "theirs",
    kind: "note",
    x: 0.07,
    y: 0.17,
    m: [0.06, 0.2],
    text: { key: (_p, e) => e.cities, fmt: (_p, e) => `cities lit · ${e.cities}` },
    draw: [0.1, 0.18],
    when: (_p, e) => e.cities > 0,
  },

  // ---- Fig. 9, the storm: the time, the front, the field's arcs, and nothing lost
  // (the notes keep to the margin's top, above the field's arcs and clear of the bodies)
  {
    fig: "storm",
    kind: "note",
    x: 0.07,
    y: 0.17,
    m: [0.06, 0.18],
    text: "02:07",
    draw: [0.0, 0.05],
    fade: [0.92, 0.99],
    pri: 2,
  },
  {
    fig: "storm",
    kind: "arrow",
    from: ANCHOR.storm,
    to: ANCHOR.world,
    bend: -26,
    text: "storm front",
    draw: [0.1, 0.22],
    fade: [0.5, 0.58],
  },
  {
    fig: "storm",
    kind: "path",
    path: FIELD,
    fine: true,
    draw: [0.22, 0.5],
    fade: [0.86, 0.96],
    pri: 2,
  },
  {
    fig: "storm",
    kind: "note",
    x: 0.07,
    y: 0.215,
    m: [0.06, 0.22],
    text: { key: (p) => p.lightsLost, fmt: (p) => `lights lost: ${p.lightsLost}` },
    draw: [0.5, 0.6],
    fade: [0.92, 0.99],
    gold: true,
    pri: 3,
  },
  // (named once the camera has settled under it, so the word never rides across the lights on the way; low enough
  // beside it that a phone's frame, the aurora just under its header, has room for it above the world)
  {
    fig: "storm",
    kind: "label",
    at: ANCHOR.poleN,
    text: "aurora",
    dx: -62,
    dy: -24,
    draw: [0.8, 0.88],
    fine: true,
  },

  // ---- Fig. 10, the flock: a tether from you, then it breaks; the best thing he builds, in the margin
  {
    fig: "flock",
    kind: "tether",
    to: ANCHOR.flock,
    text: "following",
    draw: [0.08, 0.18],
    fade: [0.62, 0.7],
    pri: 2,
  },
  {
    fig: "flock",
    kind: "label",
    at: ANCHOR.flock,
    text: "on their own.",
    dx: 70,
    dy: -54,
    draw: [0.56, 0.66],
    gold: true,
    when: (p) => p.autonomy > 0.5,
    pri: 3,
  },
  {
    fig: "flock",
    kind: "note",
    x: 0.07,
    y: 0.17,
    m: [0.06, 0.18],
    text: "best thing I build: people who don't need me in the room.",
    draw: [0.66, 0.84],
    pri: 2,
  },

  // ---- Fig. 11, again: the whole system's orbits as it pulls back (wherever the GL still draws them), then your
  // system is one star (the platform under the pointer is named by its card, src/bridges/star-card.ts)
  {
    fig: "again",
    kind: "path",
    path: ORBIT,
    dash: true,
    fine: true,
    draw: [0.05, 0.2],
    fade: [0.3, 0.38],
  },
  {
    fig: "again",
    kind: "circle",
    at: ANCHOR.system,
    px: 34,
    text: "this one",
    angle: -38,
    draw: [0.52, 0.64],
    gold: true,
    pri: 3,
  },

  // ---- Fig. 12, the sky: your point is one of the stars (marked past the figure, k = 1 + e, and lifted before the
  // ending's role and last line write in over the same sky: show-dom END.role, END.line); where and when this sky is
  {
    fig: "sky",
    kind: "label",
    at: ANCHOR.yours,
    text: "yours",
    dx: 60,
    dy: -44,
    draw: [0.12, 0.26],
    fade: [1.16, 1.25],
    gold: true,
    pri: 3,
  },
  {
    fig: "sky",
    kind: "note",
    x: 0.07,
    y: 0.17,
    m: [0.06, 0.18],
    text: {
      key: (_p, e) => e.riyadhMin,
      fmt: (_p, e) =>
        `riyadh, ${pad2(Math.floor(e.riyadhMin / 60))}:${pad2(e.riyadhMin % 60)} · 24.7° n 46.7° e`,
    },
    draw: [0.2, 0.32],
    fade: [0.84, 0.92],
  },
];

/* ---------------------------------------------------------------- the journal printed (the flow layout) */

/**
 * Each still's ink, as printed in the flow layout (reduced motion, the static tier, no JS): the same notebook, one
 * moment per figure, in the plate's own units (1600 × 1000, the still's 16:10). `route` points follow the planned
 * assist through the planets (src/components/stills.tsx draws it); text sits at (tx, ty), anchored at its start, or at
 * its end with `end`.
 */
export type PrintMark =
  | {
      kind: "circle";
      x: number;
      y: number;
      r: number;
      text?: string;
      angle?: number;
      gold?: boolean;
    }
  | {
      kind: "label";
      x: number;
      y: number;
      tx: number;
      ty: number;
      text: string;
      gold?: boolean;
      mark?: "x";
      end?: boolean;
    }
  | { kind: "arrow"; x0: number; y0: number; x1: number; y1: number; bend?: number; gold?: boolean }
  | {
      kind: "ellipse";
      x: number;
      y: number;
      rx: number;
      ry: number;
      rot?: number;
      dash?: boolean;
      gold?: boolean;
    }
  | {
      kind: "route";
      from: number;
      to: number;
      dash?: boolean;
      gold?: boolean;
      offset?: number;
      bracket?: boolean;
      text?: string;
    }
  | { kind: "ticks"; at: readonly number[]; text: readonly string[] }
  | { kind: "arcs"; x: number; y: number; r: number }
  | { kind: "note"; x: number; y: number; text: string; gold?: boolean };

export const PRINT: Record<FigureId, PrintMark[]> = {
  point: [{ kind: "label", x: 860, y: 470, tx: 948, ty: 398, text: "yours", gold: true }],
  versions: [
    { kind: "label", x: 1010, y: 330, tx: 1092, ty: 266, text: "yours", gold: true },
    { kind: "label", x: 520, y: 430, tx: 470, ty: 384, text: "v.2", end: true },
    { kind: "label", x: 1130, y: 590, tx: 1186, ty: 640, text: "v.17" },
    { kind: "label", x: 640, y: 650, tx: 588, ty: 706, text: "v.64", end: true },
  ],
  center: [
    { kind: "circle", x: 820, y: 540, r: 70, text: "m 2.4", angle: 50 },
    { kind: "label", x: 820, y: 540, tx: 610, ty: 330, text: "this one", gold: true, end: true },
    { kind: "arrow", x0: 420, y0: 476, x1: 735, y1: 532, bend: 22 },
    { kind: "arrow", x0: 1210, y0: 380, x1: 900, y1: 510, bend: -22 },
  ],
  gathering: [
    { kind: "label", x: 693, y: 536, tx: 96, ty: 780, text: "engineering" },
    { kind: "label", x: 1049, y: 468, tx: 1504, ty: 290, text: "product", end: true },
    { kind: "label", x: 1323, y: 460, tx: 1504, ty: 650, text: "data", end: true },
    { kind: "label", x: 164, y: 428, tx: 96, ty: 250, text: "operations" },
    { kind: "label", x: 634, y: 609, tx: 720, ty: 760, text: "who it's for", gold: true },
  ],
  alignment: [
    { kind: "ellipse", x: 800, y: 500, rx: 160, ry: 48 },
    { kind: "ellipse", x: 800, y: 500, rx: 270, ry: 81 },
    { kind: "ellipse", x: 930, y: 520, rx: 250, ry: 70, rot: 0.42, dash: true },
    { kind: "label", x: 1062, y: 541, tx: 1130, ty: 640, text: "crossing", mark: "x" },
    { kind: "label", x: 800, y: 500, tx: 600, ty: 330, text: "aligned", gold: true, end: true },
  ],
  window: [
    { kind: "route", from: 0, to: 1, dash: true, gold: true },
    { kind: "ticks", at: [0.34, 0.56, 0.76], text: ["T−3", "T−2", "T−1"] },
    { kind: "route", from: 0.02, to: 0.2, offset: -24, bracket: true, text: "window" },
  ],
  assist: [
    { kind: "route", from: 0, to: 1, gold: true },
    // the gains the flight really borrows at its four flybys (src/gl/show/figures/probe.ts KM)
    { kind: "ticks", at: [0.2, 0.42, 0.62, 0.8], text: ["+6", "+7", "+12", "+6"] },
    { kind: "note", x: 112, y: 250, text: "v 11 → 17 → 24 → 36 → 42 km/s" },
  ],
  // (figs 8 and 9 are frames of the real render, public/stills/*.webp: scripts/bake-stills.mjs prints where Riyadh and
  // the aurora sit on them, and these marks point there; the field's own lines are in the frame)
  theirs: [{ kind: "label", x: 736, y: 507, tx: 848, ty: 599, text: "first light", gold: true }],
  storm: [
    { kind: "note", x: 112, y: 230, text: "02:07" },
    { kind: "note", x: 112, y: 280, text: "lights lost: 0", gold: true },
    { kind: "label", x: 742, y: 292, tx: 610, ty: 214, text: "aurora", end: true },
  ],
  flock: [
    { kind: "label", x: 860, y: 360, tx: 1010, ty: 250, text: "on their own.", gold: true },
    {
      kind: "note",
      x: 112,
      y: 820,
      text: "best thing I build: people who don't need me in the room.",
    },
  ],
  again: [{ kind: "circle", x: 760, y: 500, r: 26, text: "this one", angle: -38, gold: true }],
  sky: [{ kind: "label", x: 1056, y: 300, tx: 1140, ty: 236, text: "yours", gold: true }],
};
