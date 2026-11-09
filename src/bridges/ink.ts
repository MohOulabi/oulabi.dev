import { INK, type InkAt, type InkEnv, type InkItem, type Play, starIndex } from "@/content/ink";
import { shared } from "@/gl/shared";
import { ANCHOR, type Anchor, allAnchors, allPaths, ink, PATH, type Path } from "@/lib/anchors";
import { addFrame } from "@/lib/clock";
import { hold } from "@/lib/hold";
import { F } from "@/lib/journey";
import { clamp01, smooth } from "@/lib/math";
import { onRestart } from "@/lib/restart";
import { story } from "@/lib/story";
import { pick, seedOf, wobble } from "./ink-geom";
import { createStarCard } from "./star-card";

/**
 * The ink journal's engine (docs/STORY.md, "A journal over the universe"): every frame it reads where the GL put the
 * things the ink points at (src/lib/anchors.ts, projected to CSS px), picks the marks that belong on the page now
 * (src/content/ink.ts: their figure's window, the visitor's outcomes, live anchors, at most five by priority), and
 * draws them into the fixed SVG of src/components/ink.tsx.
 *
 * It runs right after the projector, in the same frame (anchors.ts `ink.projected`), and pins every mark to where
 * its body is now: no spring, no frame of lag, so a circle never slides off its knot while the visitor scrolls. When
 * the GL is not drawing (asleep, or no stage) the clock runs it instead.
 *
 * Drawing on is scrubbed: a mark's stroke is cut at its draw progress (local k inside its `draw` window), so
 * scrolling back undraws it, and the pen never moves faster than a full mark per PEN_S, so a fast jump still shows
 * the hand. At rest (story.rest) a mark the scroll left half-drawn finishes itself at the pen's pace, so a stopping
 * point never shows a half-typed word; scrolling on carries on from what is drawn. The wobble is baked per mark
 * (src/bridges/ink-geom.ts), never animated. Attributes are written only when they change, nothing is measured from
 * the layout per frame, and nothing is allocated per frame beyond the strings it writes.
 *
 * Fig. 11's star card (src/bridges/star-card.ts) is placed here too, in the same frame, beside the star it names.
 */

const MAX_MARKS = 5;
/** The default fade: gone before the next figure takes the page. */
const FADE: readonly [number, number] = [0.9, 0.98];
/** Fastest the pen draws a whole mark (s). */
const PEN_S = 0.75;
/** Rest (s) before a half-drawn mark finishes itself. */
const REST_AFTER = 0.18;
/** Presence rates (1/s): in, out, and out when the anchor is gone. */
const IN_RATE = 4.5;
const OUT_RATE = 3;
const LOST_RATE = 9;
/** IBM Plex Mono: one character's advance in em, with the ink's 0.06 em letter-spacing (globals.css .ink text). */
const CHAR_EM = 0.66;
/** The leader stops this far from the text and from the body (px). */
const GAP = 6;
/** Polyline points per mark for leaders, arrows, tethers and ticks. */
const SMALL = 48;
/** Planned flybys we can label (Fig. 7). */
const FLYBYS = 6;
/** A label stands off a big body by part of its projected radius (px), so its words sit outside it, not on it. */
const STANDOFF = 0.7;
const STANDOFF_MAX = 140;
/** A wrapped note's line pitch, in em of the ink's text. */
const LINE_EM = 1.4;
/** Lines a note may wrap to. */
const MAX_LINES = 6;
/** A label whose words have sat on a body or a note this long (s) moves them to a clear side. */
const CLASH_S = 0.25;
const SVG_NS = "http://www.w3.org/2000/svg";
/**
 * The bodies a label's words keep off (the knots and the ring the ink draws round them, the clumps, the sun, the
 * planets, your point, the first city), and how far past each one's projected radius (px). A label is never kept off
 * its own body.
 */
const BODIES = [
  ...[0, 1, 2].map((i) => ANCHOR.knot(i)),
  ...[0, 1, 2, 3].map((i) => ANCHOR.clump(i)),
  ANCHOR.center,
  ...[0, 1, 2, 3, 4].map((i) => ANCHOR.planet(i)),
  ANCHOR.yours,
  ANCHOR.hub,
];
const BODY_PAD = new Float32Array(
  BODIES.map((id) =>
    id.startsWith("knot") ? 14 : id === ANCHOR.yours ? 10 : id.startsWith("clump") ? 6 : 8,
  ),
);

/**
 * Where the ink's words are this frame (CSS px boxes: l, t, r, b), for the hint's words to keep clear of
 * (src/bridges/show-dom.ts). Written by the engine every frame it draws; read-only elsewhere.
 */
export const inkWords = { n: 0, b: new Float32Array(4 * 16) };

type Source = {
  anchor: (id: string) => Anchor | undefined;
  path: (id: string) => Path | undefined;
  play: Play;
};

const REAL: Source = {
  anchor: (id) => allAnchors().get(id),
  path: (id) => allPaths().get(id),
  play: shared.play,
};

type Run = {
  it: InkItem;
  g: SVGGElement;
  s: SVGPathElement;
  t: SVGTextElement | null;
  tt: SVGTextElement[];
  /** Story time where this mark's figure starts. */
  f0: number;
  /** The draw window end, also for the bang (Fig. 1). */
  fade: readonly [number, number];
  want: boolean;
  chosen: boolean;
  pres: number;
  drawT: number;
  /** The pen's scrubbed target last frame (what scrolling moved; drawT may have finished ahead of it at rest). */
  rawT: number;
  alpha: number;
  shown: boolean;
  /** Anchors this frame (resolved lazily: the GL creates them). */
  a: Anchor | undefined;
  b: Anchor | undefined;
  /** The anchor a label keeps its words away from (`away`), and the side it chose when it first appeared. */
  c: Anchor | undefined;
  awaySide: number;
  aId: string;
  paths: (Path | undefined)[];
  pathIds: readonly string[];
  /** Anchor values this frame [ax, ay, ar, bx, by, br]. */
  sp: Float32Array;
  snap: boolean;
  /** The polyline written this frame: xy pairs, a subpath start flag per point. */
  px: Float32Array;
  brk: Uint8Array;
  n: number;
  /** Path points (paths and ticks), allocated once when the path first resolves. */
  sm: Float32Array | null;
  smN: Int16Array;
  wob: Float32Array;
  bow: number;
  /** Last written: geometry signature, transform, text and its place. */
  sig: number;
  tx: number;
  ty: number;
  side: number;
  flipX: boolean;
  flipY: boolean;
  full: string;
  key: number;
  chars: number;
  ttShown: number;
  ttKey: number;
  /** Tick places as last written: x, y, reveal per tick. */
  ttXY: Float32Array;
  tOpacity: number;
  bound: boolean;
  /** The text's lines (a note wraps to the page): count, each one's start and end, the longest (characters), what was
   *  wrapped at which width, and the tspans that carry them (only when there is more than one). */
  nl: number;
  ls: Int16Array;
  le: Int16Array;
  cols: number;
  wrapFor: string;
  wrapCols: number;
  ts: SVGTSpanElement[];
  tsOn: number;
  /** A note's place this frame. */
  nx: number;
  ny: number;
  /** A label's side away from what its words would sit on (0 as written; bit 1 mirrors x, bit 2 y), and how long the
   *  words have sat on something where they are. */
  cand: number;
  clashT: number;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const win = (w: readonly [number, number], k: number) =>
  clamp01((k - w[0]) / Math.max(1e-6, w[1] - w[0]));

export function startInk() {
  const svg = document.getElementById("nq-ink") as SVGSVGElement | null;
  if (!svg) return () => undefined;
  const root = document.documentElement;

  const src = REAL;

  // ---- one run per mark, bound to its prerendered group
  const groups = Array.from(svg.querySelectorAll<SVGGElement>("g[data-ink]"));
  const runs: Run[] = [];
  for (const g of groups) {
    const i = Number(g.dataset.ink);
    const it = INK[i];
    if (!it) continue;
    const seed = seedOf(`${it.fig}:${i}`);
    const pathIds =
      it.kind === "path"
        ? typeof it.path === "string"
          ? [it.path]
          : it.path
        : it.kind === "ticks"
          ? [it.path]
          : [];
    const cap = it.kind === "path" ? 64 * pathIds.length + 32 : SMALL;
    runs.push({
      it,
      g,
      s: g.querySelector(".ink-s") as SVGPathElement,
      t: g.querySelector(".ink-t"),
      tt: Array.from(g.querySelectorAll<SVGTextElement>(".ink-tt")),
      f0: F[it.fig],
      fade: it.fade ?? FADE,
      want: false,
      chosen: false,
      pres: 0,
      drawT: 0,
      rawT: 0,
      alpha: -1,
      shown: true,
      a: undefined,
      b: undefined,
      c: undefined,
      awaySide: 0,
      aId: "",
      paths: pathIds.map(() => undefined),
      pathIds,
      sp: new Float32Array(6),
      snap: true,
      px: new Float32Array(cap * 2),
      brk: new Uint8Array(cap),
      n: 0,
      sm: null,
      smN: new Int16Array(pathIds.length),
      // a ruled line's tremor (px); a trail grows by its head, so its points are not stable enough to carry one
      wob: wobble(seed, cap, pathIds[0] === PATH.trail ? 0 : it.kind === "path" ? 1.1 : 0.9),
      bow: (pick(seed + 7, 0, 1) < 0.5 ? -1 : 1) * pick(seed + 3, 3, 7),
      sig: Number.NaN,
      tx: Number.NaN,
      ty: Number.NaN,
      side: 0,
      flipX: false,
      flipY: false,
      full: "text" in it && typeof it.text === "string" ? it.text : "",
      key: Number.NaN,
      chars: -1,
      ttShown: -1,
      ttKey: Number.NaN,
      ttXY: new Float32Array(
        it.kind === "ticks" ? (it.flybys ? FLYBYS : (it.at?.length ?? 0)) * 3 : 0,
      ).fill(Number.NaN),
      tOpacity: 1,
      bound: false,
      nl: 1,
      ls: new Int16Array(it.kind === "note" ? MAX_LINES : 0),
      le: new Int16Array(it.kind === "note" ? MAX_LINES : 0),
      cols: 0,
      wrapFor: "",
      wrapCols: -1,
      ts: [],
      tsOn: 0,
      nx: 0,
      ny: 0,
      cand: 0,
      clashT: 0,
    });
  }

  // ---- what the notes measure (src/content/ink.ts InkEnv)
  const env: InkEnv = {
    riyadhMin: 0,
    launchSpeed: 0,
    flyby: new Float32Array(FLYBYS),
    flybyN: 0,
    hover: -1,
    cities: 0,
    narrow: false,
  };
  /** Fig. 7: where each flyby happened along the trail (point index), latched as it happens. */
  const flybyAt = new Int16Array(FLYBYS).fill(-1);

  // ---- the page's free space, measured on resize only (never per frame)
  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let phone = vw <= 760;
  /** Text stays between these: under the chrome, above the caption, clear of the spine. */
  let top = 84;
  let left = 24;
  let right = vw - 24;
  let capTop = vh * 0.7;
  /** The free band under the caption block, for words whose body sits below it (empty when there is no room). */
  let bandTop = vh;
  let bandBottom = vh;
  /** One character's advance at the ink's text size (11 px, 10.5 on phones), and a wrapped note's line pitch. */
  let charW = 11 * CHAR_EM;
  let lineH = 11 * LINE_EM;
  const capEl = document.querySelector<HTMLElement>(".caption");
  const measure = () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    phone = vw <= 760;
    charW = (phone ? 10.5 : 11) * CHAR_EM;
    lineH = (phone ? 10.5 : 11) * LINE_EM;
    env.narrow = phone;
    top = phone ? 96 : 84;
    // the caption spans the page between its gutters (globals.css --g, which takes in a notch's safe-area insets on a
    // phone held sideways): the ink keeps inside them too
    const cr = capEl?.getBoundingClientRect();
    const has = cr !== undefined && cr.width > 0;
    const g0 = Math.min(56, Math.max(16, vw * 0.034));
    const gl = has ? cr.left : g0;
    const gr = has ? vw - cr.right : g0;
    left = phone ? Math.max(16, gl) : Math.max(28, vw * 0.04, gl);
    // clear of the spine and the current figure's name beside it ("07 gravity assist"), which a notch moves inward
    right = phone
      ? vw - Math.max(22, gr + 6)
      : vw - Math.max(244, vw * 0.17) - Math.max(0, gr - g0);
    // the caption block's top, where the page puts it (globals.css .caption --cap-top: 71 svh, 69 on short screens, 60
    // on phones, lower than that on a phone held sideways)
    capTop = (has ? cr.top : (phone ? 0.6 : vh <= 760 ? 0.69 : 0.71) * vh) - 14;
    // its bottom (the label, a line of the serif, the Arabic under it), and the bottom chrome (the phone's fast lane)
    bandTop = capTop + (phone ? 150 : 150);
    bandBottom = vh - (phone ? 84 : 58);
    for (const r of runs) r.sig = Number.NaN;
  };
  measure();
  window.addEventListener("resize", measure);

  // the candidates for the page this frame (indices into runs), fixed size
  const want = new Int16Array(runs.length);
  let lastMin = -1;

  const resolve = (at: InkAt, p: Play) => (typeof at === "string" ? at : at(p));
  // biome-ignore-start lint/complexity/useOptionalChain: bind() returns these booleans as they are; ?. gives undefined
  const liveA = (a: Anchor | undefined) => a !== undefined && a.live && a.on > 0.02;
  const liveP = (p: Path | undefined) => p !== undefined && p.live && p.n > 1 && p.on > 0.02;
  // biome-ignore-end lint/complexity/useOptionalChain: liveA, liveP

  /** Resolve a mark's anchors and paths for this frame; false when what it points at is not on screen. */
  const bind = (r: Run, p: Play): boolean => {
    const it = r.it;
    switch (it.kind) {
      case "note":
        return true;
      case "path":
      case "ticks": {
        let any = false;
        for (let j = 0; j < r.pathIds.length; j++) {
          const pa = r.paths[j] ?? src.path(r.pathIds[j]);
          r.paths[j] = pa;
          if (liveP(pa)) any = true;
        }
        return any;
      }
      case "tether": {
        const id = resolve(it.to, p);
        r.a = src.anchor(id);
        // a mouse over the page, or a finger down: there is something to tie it to
        const pointer = (hold.pointerType === "mouse" && hold.inside) || hold.down;
        return pointer && liveA(r.a);
      }
      case "arrow": {
        const fromId = resolve(it.from, p);
        const toId = resolve(it.to, p);
        r.a = src.anchor(fromId);
        r.b = src.anchor(toId);
        if (fromId !== r.aId) {
          r.aId = fromId;
          r.snap = true;
        }
        return liveA(r.a) && liveA(r.b);
      }
      default: {
        const id = resolve(it.at, p);
        if (id === "") return false;
        r.a = src.anchor(id);
        if (id !== r.aId) {
          // a new anchor (the hovered star changed): the pen starts again there
          r.aId = id;
          r.snap = true;
          r.drawT = 0;
          r.rawT = 0;
        }
        if (it.kind === "label" && it.away) r.c = src.anchor(resolve(it.away, p));
        if (it.kind === "label" && it.mid) {
          r.b = src.anchor(resolve(it.mid, p));
          return liveA(r.a) && liveA(r.b);
        }
        return liveA(r.a);
      }
    }
  };

  /** A path's projected points into r.sm (base offset per path). Returns the points used. */
  const takePath = (r: Run, j: number, pa: Path, base: number) => {
    const sm = r.sm as Float32Array;
    const n = Math.min(pa.n, pa.max);
    for (let q = 0; q < n * 2; q++) sm[base * 2 + q] = pa.screen[q];
    r.smN[j] = n;
    return n;
  };

  /** Append a point to the mark's polyline (`start` begins a new subpath). */
  const put = (r: Run, x: number, y: number, start: boolean) => {
    if (r.n >= r.brk.length) return;
    r.px[r.n * 2] = x;
    r.px[r.n * 2 + 1] = y;
    r.brk[r.n] = start ? 1 : 0;
    r.n++;
  };

  /** A bowed line from (x0, y0) to (x1, y1) through `steps` points, with the mark's tremor. */
  const bowed = (
    r: Run,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    bow: number,
    steps: number,
    start: boolean,
  ) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let q = 0; q <= steps; q++) {
      const t = q / steps;
      const b = 4 * t * (1 - t) * bow + r.wob[q] * 0.7 * Math.sin(Math.PI * t);
      put(r, x0 + dx * t + nx * b, y0 + dy * t + ny * b, start && q === 0);
    }
  };

  /** A path's points into the polyline: breaks where it goes behind the camera, `span` cuts a stretch, `offset` runs
   *  beside it. Returns the length of the stretch written. */
  const pathLine = (
    r: Run,
    j: number,
    base: number,
    n: number,
    span: readonly [number, number] | undefined,
    offset: number,
  ) => {
    const sm = r.sm as Float32Array;
    const pa = r.paths[j] as Path;
    let total = 0;
    for (let q = 1; q < n; q++)
      total += Math.hypot(
        sm[(base + q) * 2] - sm[(base + q - 1) * 2],
        sm[(base + q) * 2 + 1] - sm[(base + q - 1) * 2 + 1],
      );
    const a = span ? span[0] * total : 0;
    const b = span ? span[1] * total : total;
    let acc = 0;
    let start = true;
    for (let q = 0; q < n; q++) {
      const o = (base + q) * 2;
      if (q > 0) acc += Math.hypot(sm[o] - sm[o - 2], sm[o + 1] - sm[o - 1]);
      if (acc < a || acc > b || !pa.front[q]) {
        start = true;
        continue;
      }
      // the normal (left of travel) from the neighbours
      const qa = Math.max(0, q - 1);
      const qb = Math.min(n - 1, q + 1);
      const tx = sm[(base + qb) * 2] - sm[(base + qa) * 2];
      const ty = sm[(base + qb) * 2 + 1] - sm[(base + qa) * 2 + 1];
      const tl = Math.hypot(tx, ty) || 1;
      const w = offset + r.wob[(base + q) % r.wob.length];
      put(r, sm[o] + (ty / tl) * w, sm[o + 1] - (tx / tl) * w, start);
      start = false;
    }
    return b - a;
  };

  /** The polyline as an SVG path, cut at `frac` of its length (the pen's progress). */
  const emit = (r: Run, frac: number) => {
    const px = r.px;
    let total = 0;
    for (let q = 1; q < r.n; q++)
      if (!r.brk[q]) total += Math.hypot(px[q * 2] - px[q * 2 - 2], px[q * 2 + 1] - px[q * 2 - 1]);
    const lim = total * frac;
    let acc = 0;
    let d = "";
    for (let q = 0; q < r.n; q++) {
      const x = px[q * 2];
      const y = px[q * 2 + 1];
      if (q === 0 || r.brk[q]) {
        if (q > 0 && acc >= lim) break;
        d += `M${r1(x)} ${r1(y)}`;
        continue;
      }
      const seg = Math.hypot(x - px[q * 2 - 2], y - px[q * 2 - 1]);
      if (acc + seg >= lim) {
        const t = seg > 0 ? (lim - acc) / seg : 0;
        d += `L${r1(px[q * 2 - 2] + (x - px[q * 2 - 2]) * t)} ${r1(px[q * 2 - 1] + (y - px[q * 2 - 1]) * t)}`;
        break;
      }
      acc += seg;
      d += `L${r1(x)} ${r1(y)}`;
    }
    return d;
  };

  /** A cheap fingerprint of the polyline and the pen, so an unchanged mark writes nothing. */
  const signature = (r: Run, frac: number) => {
    let s = r.n * 7.13 + Math.round(frac * 2000);
    for (let q = 0; q < r.n; q++)
      s +=
        Math.round(r.px[q * 2] * 4) * 1.37 + Math.round(r.px[q * 2 + 1] * 4) * 2.71 * ((q % 7) + 1);
    return s;
  };

  /** Where placeText put the text (scratch, so nothing is allocated per frame). */
  const out = new Float64Array(2);

  /** A text's line for a body at `ay` with words wanted at `y`: above the caption, or in the free band under it when
   *  the body itself is down there (never on the line of copy). */
  const lineFor = (ay: number, y: number) => {
    if (ay > capTop && bandBottom - bandTop > 14) return Math.min(bandBottom, Math.max(bandTop, y));
    return Math.min(capTop - 8, Math.max(top, y));
  };

  /** Place a text: keep it on the page, flipping sides with a little hysteresis rather than crowding an edge. */
  const placeText = (r: Run, ax: number, ay: number, dx: number, dy: number, w: number) => {
    const roomR = ax + Math.abs(dx) + w < right;
    const roomL = ax - Math.abs(dx) - w > left;
    if (dx >= 0) {
      if (!r.flipX && !roomR && roomL) r.flipX = true;
      else if (r.flipX && ax + Math.abs(dx) + w < right - 24) r.flipX = false;
    } else {
      if (!r.flipX && !roomL && roomR) r.flipX = true;
      else if (r.flipX && ax - Math.abs(dx) - w > left + 24) r.flipX = false;
    }
    const sx = (dx >= 0 ? 1 : -1) * (r.flipX ? -1 : 1);
    const up = dy < 0;
    const under = ay > capTop && bandBottom - bandTop > 14;
    const roomUp = ay - Math.abs(dy) > top;
    const roomDown = under || ay + Math.abs(dy) < capTop;
    if (!r.flipY && ((up && !roomUp && roomDown) || (!up && !roomDown && roomUp))) r.flipY = true;
    else if (r.flipY && (up ? ay - Math.abs(dy) > top + 24 : ay + Math.abs(dy) < capTop - 24))
      r.flipY = false;
    const sy = (up ? -1 : 1) * (r.flipY ? -1 : 1);
    r.side = sx;
    const x = ax + sx * Math.abs(dx);
    const y = ay + sy * Math.abs(dy);
    // both ends of the words stay on the page and out of the spine's column, whichever way they are anchored
    out[0] =
      sx > 0 ? Math.max(left, Math.min(x, right - w)) : Math.min(right, Math.max(x, left + w));
    out[1] = lineFor(ay, y);
  };

  /** The text's widest line (characters): the whole text, or a wrapped note's longest line. */
  const colsOf = (r: Run) => (r.nl > 1 ? r.cols : r.full.length);

  /** Write a text's place and anchor when they move. */
  const textAt = (r: Run, el: SVGTextElement, x: number, y: number, side: number) => {
    // a text that ends at x starts a full width before it (monospace), so the pen writes it left to right in place
    // rather than pushing it along as it types
    const w = colsOf(r) * charW;
    let sx = side < 0 ? x - w : x;
    // the whole of it on the page and clear of the spine's column, whichever way it is anchored (a tether's word, an
    // arrow's, a rim's note near the edge)
    sx = Math.max(left, Math.min(sx, right - w));
    // (written as "not within" so the first frame, NaN, always writes)
    if (!(Math.abs(sx - r.tx) <= 0.05) || !(Math.abs(y - r.ty) <= 0.05)) {
      r.tx = sx;
      r.ty = y;
      el.setAttribute("x", `${r1(sx)}`);
      // the x-height sits on the leader's end
      el.setAttribute("y", `${r1(y + 3.6)}`);
      for (let i = 0; i < r.tsOn; i++) r.ts[i].setAttribute("x", `${r1(sx)}`);
    }
    // where the words are, for the hint's words to keep clear of (show-dom)
    if (r.alpha > 0.05 && inkWords.n < inkWords.b.length / 4) {
      const o = inkWords.n++ * 4;
      inkWords.b[o] = sx;
      inkWords.b[o + 1] = y - 9;
      inkWords.b[o + 2] = sx + w;
      inkWords.b[o + 3] = y + 7 + (r.nl - 1) * lineH;
    }
  };

  /** A note's lines at the page's width (`cols` characters): broken between words into as few lines as fit, as even as
   *  they can be (never one word alone on the last), rewrapped only when the text or the width changes. */
  const wrap = (r: Run, cols: number) => {
    const s = r.full;
    if (s === r.wrapFor && cols === r.wrapCols) return;
    r.wrapFor = s;
    r.wrapCols = cols;
    const n = breakLines(r, cols);
    if (n > 1) {
      let c = Math.ceil(s.length / n);
      while (c < cols && breakLines(r, c) !== n) c++;
      if (c >= cols) breakLines(r, cols);
    }
    // written again, in place
    r.chars = -1;
    r.tx = Number.NaN;
  };
  /** Break the note greedily at `cols` characters a line (into r.ls, r.le, r.nl, r.cols): the number of lines. */
  const breakLines = (r: Run, cols: number) => {
    const s = r.full;
    let n = 0;
    let at = 0;
    let widest = 0;
    while (at < s.length && n < r.ls.length) {
      let end = s.length;
      if (end - at > cols && n < r.ls.length - 1) {
        // the last space that fits (a word longer than the line breaks where it must)
        const b = s.lastIndexOf(" ", at + cols);
        end = b > at ? b : at + cols;
      }
      r.ls[n] = at;
      r.le[n] = end;
      if (end - at > widest) widest = end - at;
      n++;
      at = end;
      while (s.charCodeAt(at) === 32) at++;
    }
    r.nl = Math.max(1, n);
    r.cols = widest;
    return r.nl;
  };

  /** The text element's tspans, one per line (made once, when a note first wraps to that many). */
  const lines = (r: Run, el: SVGTextElement) => {
    if (r.tsOn !== r.nl) {
      el.textContent = "";
      for (let i = 0; i < r.nl; i++) {
        let t = r.ts[i];
        if (!t) {
          t = document.createElementNS(SVG_NS, "tspan") as SVGTSpanElement;
          r.ts[i] = t;
        }
        t.setAttribute("x", `${r1(r.tx)}`);
        t.setAttribute("dy", i === 0 ? "0" : `${LINE_EM}em`);
        el.appendChild(t);
      }
      r.tsOn = r.nl;
    }
    return r.ts;
  };

  /** Write the text, revealed character by character as the pen reaches it (line by line when it wraps). */
  const typeText = (r: Run, el: SVGTextElement, frac: number) => {
    const len = r.full.length;
    const n = frac >= 1 ? len : Math.round(len * clamp01(frac));
    if (n === r.chars) return;
    r.chars = n;
    if (r.nl <= 1) {
      r.tsOn = 0;
      el.textContent = n >= len ? r.full : r.full.slice(0, n);
      return;
    }
    const ts = lines(r, el);
    for (let i = 0; i < r.nl; i++) {
      const a = r.ls[i];
      const b = r.le[i];
      ts[i].textContent = n >= b ? r.full.slice(a, b) : n > a ? r.full.slice(a, n) : "";
    }
  };

  /** A note's place on the page (its margin, `m` on a phone) and its lines, wrapped short of the spine. */
  const noteAt = (r: Run) => {
    const it = r.it;
    if (it.kind !== "note") return;
    const fx = phone && it.m ? it.m[0] : it.x;
    const fy = phone && it.m ? it.m[1] : it.y;
    // never so close to the edge that the rule before it falls off the page, nor up under the chrome
    r.nx = Math.max(left + 24, fx * vw);
    r.ny = Math.max(top + 12, fy * vh);
    const room = it.align === "end" ? r.nx - left : right - r.nx;
    wrap(r, Math.max(12, Math.floor(room / charW)));
  };
  /** The notes on the page this frame (boxes l, t, r, b): a label's words keep off them. */
  const noteBox = new Float32Array(4 * MAX_MARKS);
  let notes = 0;

  /** How much a label's words (from x0, `w` wide, on the line y) sit on the bodies and notes around its own anchor. */
  const clash = (r: Run, x0: number, y: number, w: number, ax: number, ay: number) => {
    const l = x0 - 3;
    const rt = x0 + w + 3;
    const t = y - 10;
    const b = y + 8;
    let s = 0;
    for (let i = 0; i < BODIES.length; i++) {
      const a = src.anchor(BODIES[i]);
      if (!a || a === r.a || a === r.b || !liveA(a)) continue;
      // (a body where the label's own anchor is, as your point riding the probe, is the same body)
      if (Math.abs(a.sx - ax) < 4 && Math.abs(a.sy - ay) < 4) continue;
      const rad = a.sr + BODY_PAD[i];
      // biome-ignore-start lint/complexity/useMathMinMax: clamps; Math.min differs from the ternary for a NaN bound
      const cx = a.sx < l ? l : a.sx > rt ? rt : a.sx;
      const cy = a.sy < t ? t : a.sy > b ? b : a.sy;
      // biome-ignore-end lint/complexity/useMathMinMax: cx, cy
      const d = Math.hypot(cx - a.sx, cy - a.sy);
      if (d < rad) s += rad - d;
    }
    for (let i = 0; i < notes; i++) {
      const o = i * 4;
      if (
        l < noteBox[o + 2] + 6 &&
        rt > noteBox[o] - 6 &&
        t < noteBox[o + 3] + 6 &&
        b > noteBox[o + 1] - 6
      )
        s += 1000;
    }
    return s;
  };

  /**
   * A label's place (placeText) on the side its words are clear: as written while they sit on nothing; when they have
   * sat on a body or a note for CLASH_S (at once when the mark appears) the other three sides are tried and the
   * clearest kept, so a passing body never sets the words flapping. Leaves the place in `out` and the side in r.side.
   */
  const placeLabel = (
    r: Run,
    ax: number,
    ay: number,
    dx: number,
    dy: number,
    w: number,
    dt: number,
  ) => {
    const c0 = r.cand;
    const fx = r.flipX;
    const fy = r.flipY;
    placeText(r, ax, ay, c0 & 1 ? -dx : dx, c0 & 2 ? -dy : dy, w);
    const hit = clash(r, r.side > 0 ? out[0] : out[0] - w, out[1], w, ax, ay);
    if (hit <= 0) {
      r.clashT = 0;
      return;
    }
    r.clashT += dt;
    if (!r.snap && r.clashT < CLASH_S) return;
    r.clashT = 0;
    let best = c0;
    let bestHit = hit;
    let bx = out[0];
    let by = out[1];
    let bfx = r.flipX;
    let bfy = r.flipY;
    let bs = r.side;
    for (let c = 0; c < 4 && bestHit > 0; c++) {
      if (c === c0) continue;
      r.flipX = fx;
      r.flipY = fy;
      placeText(r, ax, ay, c & 1 ? -dx : dx, c & 2 ? -dy : dy, w);
      const h = clash(r, r.side > 0 ? out[0] : out[0] - w, out[1], w, ax, ay);
      if (h < bestHit - 0.5) {
        best = c;
        bestHit = h;
        bx = out[0];
        by = out[1];
        bfx = r.flipX;
        bfy = r.flipY;
        bs = r.side;
      }
    }
    r.cand = best;
    r.flipX = bfx;
    r.flipY = bfy;
    r.side = bs;
    out[0] = bx;
    out[1] = by;
  };

  /** The side (±1) a label keeps to, away from its `away` body: chosen when the mark appears, then kept. */
  const awayFrom = (r: Run, ax: number, fallback: number) => {
    if (r.snap || r.awaySide === 0) {
      const c = r.c;
      r.awaySide = c?.live && Math.abs(ax - c.sx) > 2 ? (ax >= c.sx ? 1 : -1) : fallback;
    }
    return r.awaySide;
  };

  const card = createStarCard();
  let lastRun = -1;
  /** When the projector last handed over (performance.now()); the clock runs the ink only while it does not. */
  let projectedAt = -1e9;

  const update = (now: number) => {
    const dt = lastRun < 0 ? 1 / 60 : Math.min(0.05, Math.max(0, (now - lastRun) / 1000));
    lastRun = now;
    const P = story.Ts + story.after;
    const p = src.play;
    const resting = story.rest > REST_AFTER;

    // ---- what the notes measure
    env.cities = (p as Play & { cities?: number }).cities ?? 0;
    env.hover = starIndex(p.hoverStar);
    // Fig. 7: the speeds are latched as they happen; a visitor who jumps in mid-flight did not see the earlier ones,
    // so those stay unknown (NaN) and are never written, rather than guessed
    if (p.launchT < 0) {
      env.launchSpeed = 0;
      env.flybyN = 0;
    } else if (env.launchSpeed === 0 && p.speed > 0)
      env.launchSpeed = p.flybys === 0 ? p.speed : Number.NaN;
    if (p.flybys < env.flybyN) env.flybyN = Math.max(0, p.flybys);
    const last = Math.min(FLYBYS, p.flybys) - 1;
    const jumped = last - env.flybyN > 0;
    while (env.flybyN <= last) {
      const seen = !jumped || env.flybyN === last;
      const trail = src.path(PATH.trail);
      env.flyby[env.flybyN] = seen ? p.speed : Number.NaN;
      flybyAt[env.flybyN] = seen && trail && trail.n > 0 ? trail.n - 1 : -1;
      env.flybyN++;
    }
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== lastMin) {
      lastMin = minute;
      // Riyadh keeps UTC+3 all year
      env.riyadhMin = (minute + 180) % 1440;
    }

    // ---- who wants the page
    let nWant = 0;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const it = r.it;
      const k = P - r.f0;
      const banged = it.bang === true && hold.bangAt >= 0 && k < r.fade[1];
      const inWin = (k >= it.draw[0] - 0.002 && k <= r.fade[1]) || banged;
      r.bound = inWin && bind(r, p);
      r.want = r.bound && (!it.when || it.when(p, env));
      if (r.want) want[nWant++] = i;
    }
    // ---- at most five: the highest priority keep it (a mark already showing holds its place on a tie)
    for (let i = 0; i < runs.length; i++) runs[i].chosen = false;
    for (let c = 0; c < Math.min(MAX_MARKS, nWant); c++) {
      let best = -1;
      let bestS = Number.NEGATIVE_INFINITY;
      for (let q = 0; q < nWant; q++) {
        const r = runs[want[q]];
        if (r.chosen) continue;
        const s = (r.it.pri ?? 1) * 100 + r.it.draw[0] * 10 + (r.pres > 0 ? 5 : 0);
        if (s > bestS) {
          bestS = s;
          best = want[q];
        }
      }
      if (best >= 0) runs[best].chosen = true;
    }

    // ---- the notes on the page first (their place is fixed): the labels keep their words off them
    notes = 0;
    inkWords.n = 0;
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const it = r.it;
      if (it.kind !== "note" || !((r.want && r.chosen) || r.pres > 0) || notes >= MAX_MARKS)
        continue;
      if (typeof it.text !== "string") {
        const key = it.text.key(p, env);
        if (key !== r.key) {
          r.key = key;
          r.full = it.text.fmt(p, env);
          r.chars = -1;
        }
      }
      noteAt(r);
      const w = r.cols * charW;
      const x0 = it.align === "end" ? r.nx - w : r.nx;
      const o = notes++ * 4;
      noteBox[o] = x0 - 24;
      noteBox[o + 1] = r.ny - 9;
      noteBox[o + 2] = x0 + w;
      noteBox[o + 3] = r.ny + 7 + (r.nl - 1) * lineH;
    }

    // ---- draw
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      const it = r.it;
      const on = r.want && r.chosen;
      // an anchor gone from the screen takes its mark with it, quickly; anything else fades at the pen's pace
      const lost = !r.bound && r.pres > 0 && it.kind !== "note";
      r.pres = on
        ? Math.min(1, r.pres + dt * IN_RATE)
        : Math.max(0, r.pres - dt * (lost ? LOST_RATE : OUT_RATE));
      const k = P - r.f0;
      const fadeOut = 1 - smooth(win(r.fade, k));
      const alpha = r.pres * fadeOut;
      if (alpha < 0.004) {
        if (r.shown) {
          r.shown = false;
          r.g.style.visibility = "hidden";
          r.g.style.opacity = "0";
          r.alpha = 0;
        }
        if (r.pres === 0) {
          r.drawT = 0;
          r.rawT = 0;
          r.snap = true;
          r.awaySide = 0;
          r.cand = 0;
          r.clashT = 0;
        }
        continue;
      }
      if (!r.shown) {
        r.shown = true;
        r.g.style.visibility = "visible";
      }
      if (Math.abs(alpha - r.alpha) > 0.004 || alpha === 1) {
        if (alpha !== r.alpha) r.g.style.opacity = alpha.toFixed(3);
        r.alpha = alpha;
      }

      // the pen: scrubbed by scroll, never faster than PEN_S per mark; scrolling back undraws (in proportion to what
      // is drawn, so a mark that finished itself at rest draws back smoothly), and at rest it finishes what it began
      let raw = win(it.draw, k);
      if (it.bang && hold.bangAt >= 0)
        raw = Math.max(raw, smooth((now - hold.bangAt - 900) / 1100));
      if (raw < r.rawT)
        r.drawT =
          r.drawT <= raw ? r.drawT : r.rawT > 0 ? Math.max(raw, (r.drawT * raw) / r.rawT) : raw;
      r.rawT = raw;
      const target = resting && raw > 0 ? 1 : raw;
      if (target > r.drawT) r.drawT = Math.min(target, r.drawT + dt / PEN_S);
      const draw = r.drawT;

      // dynamic text: rebuilt only when its key changes
      if (
        it.kind !== "ticks" &&
        "text" in it &&
        it.text !== undefined &&
        typeof it.text !== "string"
      ) {
        const key = it.text.key(p, env);
        if (key !== r.key) {
          r.key = key;
          r.full = it.text.fmt(p, env);
          r.chars = -1;
        }
      }

      // ---- anchors, where they are this frame
      if (r.a) {
        r.sp[0] = r.a.sx;
        r.sp[1] = r.a.sy;
        r.sp[2] = r.a.sr;
      }
      if (r.b) {
        r.sp[3] = r.b.sx;
        r.sp[4] = r.b.sy;
        r.sp[5] = r.b.sr;
      }

      r.n = 0;
      switch (it.kind) {
        case "circle": {
          const rad = it.px ? it.px / 2 : Math.max(8, r.sp[2] + (it.pad ?? 8));
          const x = r.sp[0];
          const y = r.sp[1];
          // the loop is drawn once in unit space (ink.tsx): place and scale it, keep the stroke a hairline
          const sig =
            Math.round(x * 20) +
            Math.round(y * 20) * 3.1 +
            Math.round(rad * 20) * 7.7 +
            Math.round(draw * 2000) * 13.3;
          if (sig !== r.sig) {
            r.sig = sig;
            r.s.setAttribute("transform", `translate(${r1(x)} ${r1(y)}) scale(${r1(rad)})`);
            r.s.setAttribute("stroke-width", `${((it.fine ? 0.8 : 1) / rad).toFixed(4)}`);
            r.s.style.strokeDashoffset = `${(1 - draw).toFixed(4)}`;
          }
          if (r.t) {
            const ang = ((it.angle ?? -40) * Math.PI) / 180;
            const c = Math.cos(ang);
            const tx = x + c * (rad + 9);
            const ty = y + Math.sin(ang) * (rad + 9);
            textAt(r, r.t, tx, ty, c >= 0 ? 1 : -1);
            typeText(r, r.t, (draw - 0.45) / 0.55);
          }
          continue;
        }
        case "label": {
          let ax = r.sp[0];
          let ay = r.sp[1];
          let ar = r.sp[2];
          if (it.mid) {
            ax = (ax + r.sp[3]) / 2;
            ay = (ay + r.sp[4]) / 2;
            ar = 0;
          }
          const w = r.full.length * charW;
          let tx: number;
          let ty: number;
          let side: number;
          /** Where the words start on the page (whichever way they are anchored). */
          let x0: number;
          if (it.margin) {
            // the margin on the body's own side of its `away` body (a planet left of the sun is named on the left)
            side = it.away
              ? awayFrom(r, ax, it.margin === "left" ? -1 : 1)
              : it.margin === "left"
                ? -1
                : 1;
            // out toward its side of the page, a sketch's reach from the body, never past the margin
            const reach = Math.max(140, vw * 0.16);
            tx =
              side < 0
                ? Math.max(left, Math.min(ax - reach - w, ax - w - 40))
                : Math.min(right, Math.max(ax + reach + w, ax + w + 40));
            ty = lineFor(ay, ay + it.dy);
            x0 = side < 0 ? tx : tx - w;
            r.side = side;
          } else {
            // words stand off a big body by part of its radius (the flock, a pole's glow, a planet), on a side where
            // they sit on no other body and no note
            const grow = Math.min(ar, STANDOFF_MAX) * STANDOFF;
            const dir = it.away ? awayFrom(r, ax, it.dx >= 0 ? 1 : -1) : it.dx >= 0 ? 1 : -1;
            placeLabel(
              r,
              ax,
              ay,
              dir * (Math.abs(it.dx) + grow),
              it.dy + (it.dy >= 0 ? grow : -grow),
              w,
              dt,
            );
            tx = out[0];
            ty = out[1];
            side = r.side;
            x0 = side > 0 ? tx : tx - w;
          }
          // the leader reaches the nearest end of the words; when the body sits over their span (a long label on a
          // narrow page), it comes up to them from below or above instead of running under them
          let lx = x0 - GAP;
          let ly = ty;
          if (ax > x0 + w + GAP) lx = x0 + w + GAP;
          else if (ax >= x0 - GAP) {
            lx = Math.min(x0 + w, Math.max(x0, ax));
            ly = ty + (ay > ty ? 9 : -12);
          }
          if (it.mark === "x") {
            const m = 4.5;
            put(r, ax - m, ay - m, true);
            put(r, ax + m, ay + m, false);
            put(r, ax + m, ay - m, true);
            put(r, ax - m, ay + m, false);
          }
          const ux = lx - ax;
          const uy = ly - ay;
          const ul = Math.hypot(ux, uy) || 1;
          const sx0 = ax + (ux / ul) * (ar + 5);
          const sy0 = ay + (uy / ul) * (ar + 5);
          if (ul > ar + 14)
            bowed(r, sx0, sy0, lx, ly, it.margin ? r.bow * 2 : r.bow, it.margin ? 24 : 12, true);
          const lead = 0.5;
          const sig = signature(r, Math.min(1, draw / lead));
          if (sig !== r.sig) {
            r.sig = sig;
            r.s.setAttribute("d", emit(r, Math.min(1, draw / lead)));
          }
          if (r.t) {
            // margin text sits at the edge, anchored on the outer side
            textAt(r, r.t, tx, ty, it.margin ? -side : side);
            typeText(r, r.t, (draw - lead * 0.8) / (1 - lead * 0.8));
          }
          continue;
        }
        case "arrow": {
          const ax = r.sp[0];
          const ay = r.sp[1];
          const bx = r.sp[3];
          const by = r.sp[4];
          const dx = bx - ax;
          const dy = by - ay;
          const l = Math.hypot(dx, dy) || 1;
          const ux = dx / l;
          const uy = dy / l;
          const s0 = r.sp[2] + 8;
          const s1 = r.sp[5] + 10;
          // too short to read as a fall (the bodies close together, or one in front of the other): no arrow at all,
          // rather than a hook
          if (l > s0 + s1 + 40) {
            const x0 = ax + ux * s0;
            const y0 = ay + uy * s0;
            const x1 = bx - ux * s1;
            const y1 = by - uy * s1;
            const bend = it.bend ?? r.bow;
            bowed(r, x0, y0, x1, y1, bend, 20, true);
            // the head follows the line's last direction
            const q = r.n - 1;
            const hx = r.px[q * 2] - r.px[q * 2 - 2];
            const hy = r.px[q * 2 + 1] - r.px[q * 2 - 1];
            const hl = Math.hypot(hx, hy) || 1;
            const cx = -hx / hl;
            const cy = -hy / hl;
            const hs = 7;
            const ca = Math.cos(0.45);
            const sa = Math.sin(0.45);
            put(r, x1, y1, false);
            put(r, x1 + (cx * ca - cy * sa) * hs, y1 + (cx * sa + cy * ca) * hs, false);
            put(r, x1, y1, true);
            put(r, x1 + (cx * ca + cy * sa) * hs, y1 + (-cx * sa + cy * ca) * hs, false);
            if (r.t) {
              // the note sits beside the line's start, on the outside of its bend
              const nx = -uy * Math.sign(bend || 1);
              const ny = ux * Math.sign(bend || 1);
              textAt(r, r.t, x0 + nx * 14 - ux * 4, y0 + ny * 14 - uy * 4, nx >= 0 ? 1 : -1);
              typeText(r, r.t, draw / 0.5);
            }
          } else if (r.t && r.chars !== 0) {
            r.chars = 0;
            r.t.textContent = "";
          }
          const sig = signature(r, draw);
          if (sig !== r.sig) {
            r.sig = sig;
            r.s.setAttribute("d", emit(r, draw));
          }
          continue;
        }
        case "tether": {
          const ax = hold.x;
          const ay = hold.y;
          const bx = r.sp[0];
          const by = r.sp[1];
          const dx = bx - ax;
          const dy = by - ay;
          const l = Math.hypot(dx, dy) || 1;
          const ux = dx / l;
          const uy = dy / l;
          const s0 = 18;
          const s1 = r.sp[2] + 10;
          // free of the cursor, the tether parts in the middle and the halves draw back
          const brk = smooth((p.autonomy - 0.3) / 0.45);
          if (l > s0 + s1 + 10) {
            const x0 = ax + ux * s0;
            const y0 = ay + uy * s0;
            const x1 = bx - ux * s1;
            const y1 = by - uy * s1;
            const h = 0.5 - brk * 0.5;
            bowed(r, x0, y0, x0 + (x1 - x0) * h, y0 + (y1 - y0) * h, r.bow * h, 14, true);
            if (brk < 0.999)
              bowed(r, x1 + (x0 - x1) * h, y1 + (y0 - y1) * h, x1, y1, -r.bow * h, 14, true);
            if (r.t) {
              textAt(
                r,
                r.t,
                x0 + (x1 - x0) * 0.32 - uy * 12,
                y0 + (y1 - y0) * 0.32 + ux * 12,
                -uy >= 0 ? 1 : -1,
              );
              typeText(r, r.t, (draw - 0.4) / 0.6);
              if (Math.abs(1 - brk - r.tOpacity) > 0.004) {
                r.tOpacity = 1 - brk;
                r.t.style.opacity = r.tOpacity.toFixed(3);
              }
            }
          }
          const sig = signature(r, draw);
          if (sig !== r.sig) {
            r.sig = sig;
            r.s.setAttribute("d", emit(r, draw));
          }
          continue;
        }
        case "path":
        case "ticks": {
          // every path's points (allocated once, when the GL first creates the path)
          if (!r.sm) {
            let total = 0;
            let all = true;
            for (let j = 0; j < r.paths.length; j++) {
              const pa = r.paths[j];
              if (pa) total += pa.max;
              else all = false;
            }
            if (!all) continue;
            r.sm = new Float32Array(total * 2);
          }
          let base = 0;
          const used = r.smN;
          for (let j = 0; j < r.paths.length; j++) {
            const pa = r.paths[j] as Path;
            if (liveP(pa)) takePath(r, j, pa, base);
            else used[j] = 0;
            base += pa.max;
          }
          if (it.kind === "path") {
            base = 0;
            let mid = -1;
            /** The bracket's outward normal at its middle (for its word). */
            let bnx = 0;
            let bny = 0;
            for (let j = 0; j < r.paths.length; j++) {
              const pa = r.paths[j] as Path;
              if (used[j] > 1) {
                const from = r.n;
                if (it.bracket) {
                  // a printer's bracket over the stretch: a straight bar parallel to its chord, standing off the
                  // stretch on its outer side, its two ends turned back toward the path (never a loop around a curl)
                  pathLine(r, j, base, used[j], it.span, 0);
                  const m = r.n - from;
                  if (m > 1) {
                    const ax = r.px[from * 2];
                    const ay = r.px[from * 2 + 1];
                    const bx = r.px[(r.n - 1) * 2];
                    const by = r.px[(r.n - 1) * 2 + 1];
                    const cl = Math.hypot(bx - ax, by - ay) || 1;
                    let nx = -(by - ay) / cl;
                    let ny = (bx - ax) / cl;
                    // the stretch's bulge off its chord: the bar goes beyond it, on that side
                    let lo = 0;
                    let hi = 0;
                    for (let q = from; q < r.n; q++) {
                      const d = (r.px[q * 2] - ax) * nx + (r.px[q * 2 + 1] - ay) * ny;
                      if (d < lo) lo = d;
                      if (d > hi) hi = d;
                    }
                    if (-lo > hi) {
                      nx = -nx;
                      ny = -ny;
                      hi = -lo;
                    }
                    r.n = from;
                    const off = hi + (it.offset ?? 12);
                    const tick = 8;
                    put(r, ax + nx * (off - tick), ay + ny * (off - tick), true);
                    bowed(
                      r,
                      ax + nx * off,
                      ay + ny * off,
                      bx + nx * off,
                      by + ny * off,
                      0,
                      16,
                      false,
                    );
                    put(r, bx + nx * (off - tick), by + ny * (off - tick), false);
                    mid = from + 1 + 8;
                    bnx = nx;
                    bny = ny;
                  }
                } else {
                  pathLine(r, j, base, used[j], it.span, it.offset ?? 0);
                  if (mid < 0 && r.n > from) mid = from + ((r.n - from) >> 1);
                }
              }
              base += pa.max;
            }
            const sig = signature(r, draw);
            if (sig !== r.sig) {
              r.sig = sig;
              r.s.setAttribute("d", emit(r, draw));
            }
            if (r.t && mid >= 0) {
              // the word sits outside the middle of its line (the bracket's: beyond its bar)
              const q = Math.max(1, Math.min(r.n - 2, mid));
              let nx = bnx;
              let ny = bny;
              if (!it.bracket) {
                const tx = r.px[q * 2 + 2] - r.px[q * 2 - 2];
                const ty = r.px[q * 2 + 3] - r.px[q * 2 - 1];
                const tl = Math.hypot(tx, ty) || 1;
                nx = ty / tl;
                ny = -tx / tl;
              }
              const wx = r.px[q * 2] + nx * 12;
              const wy = r.px[q * 2 + 1] + ny * 12;
              // centred on the bar: start half a word before the middle
              const half = it.bracket ? (r.full.length * charW) / 2 : 0;
              textAt(
                r,
                r.t,
                it.bracket ? wx - half : wx,
                wy + (it.bracket && ny > 0 ? 6 : 0),
                it.bracket || nx >= 0 ? 1 : -1,
              );
              typeText(r, r.t, (draw - 0.6) / 0.4);
            }
            continue;
          }
          // ---- ticks across the first path, at fractions of its length or at each flyby
          const n = used[0];
          if (n < 2) continue;
          const sm = r.sm as Float32Array;
          let total = 0;
          for (let q = 1; q < n; q++)
            total += Math.hypot(sm[q * 2] - sm[q * 2 - 2], sm[q * 2 + 1] - sm[q * 2 - 1]);
          const count = it.flybys ? env.flybyN : (it.at?.length ?? 0);
          let shown = 0;
          for (let c = 0; c < count && c < r.tt.length; c++) {
            // where the tick goes: a point index (flybys) or a length along the path
            let qi = 0;
            let fx = 0;
            if (it.flybys) {
              // a flyby not seen happen (a jump into mid-flight) has no place on the trail
              if (flybyAt[c] < 0) continue;
              qi = Math.min(n - 2, Math.max(0, flybyAt[c] - 1));
              fx = 1;
            } else {
              const at = (it.at as readonly number[])[c] * total;
              let acc = 0;
              for (qi = 0; qi < n - 2; qi++) {
                const seg = Math.hypot(
                  sm[qi * 2 + 2] - sm[qi * 2],
                  sm[qi * 2 + 3] - sm[qi * 2 + 1],
                );
                if (acc + seg >= at) {
                  fx = seg > 0 ? (at - acc) / seg : 0;
                  break;
                }
                acc += seg;
              }
            }
            const x = sm[qi * 2] + (sm[qi * 2 + 2] - sm[qi * 2]) * fx;
            const y = sm[qi * 2 + 1] + (sm[qi * 2 + 3] - sm[qi * 2 + 1]) * fx;
            // a tick off the page is not drawn
            if (x < 8 || x > vw - 8 || y < 8 || y > vh - 8) continue;
            const el = r.tt[c];
            const o = c * 3;
            const tx = sm[qi * 2 + 2] - sm[qi * 2];
            const ty = sm[qi * 2 + 3] - sm[qi * 2 + 1];
            const tl = Math.hypot(tx, ty) || 1;
            const nx = ty / tl;
            const ny = -tx / tl;
            // each tick lands in its turn as the pen passes
            const reveal = it.flybys ? draw : clamp01((draw - c / Math.max(1, count)) * count);
            if (reveal <= 0) continue;
            put(r, x - nx * 5, y - ny * 5, true);
            put(r, x + nx * (5 + 3 * reveal), y + ny * (5 + 3 * reveal), false);
            const ex = r1(x + nx * 16);
            const ey = r1(y + ny * 16 + 3.6);
            if (ex !== r.ttXY[o] || ey !== r.ttXY[o + 1]) {
              r.ttXY[o] = ex;
              r.ttXY[o + 1] = ey;
              el.setAttribute("x", `${ex}`);
              el.setAttribute("y", `${ey}`);
            }
            // its word only where it can be read whole: on the page, under the chrome, above the bottom edge (the spine's
            // column thins the ink out by itself: globals.css .ink)
            const room =
              ey > top &&
              ey < vh - 20 &&
              (nx >= 0 ? ex > 8 && ex + 40 < vw - 8 : ex - 40 > 8 && ex < vw - 8);
            // reveal (to 1/50) and side packed in one slot: +start, -end (0: no room)
            const rv = room ? (Math.round(reveal * 50) + 1) * (nx >= 0 ? 1 : -1) : 0;
            if (rv !== r.ttXY[o + 2]) {
              // (the sign of NaN, the first frame, or of 0 never matches: the anchor is written)
              if (rv !== 0 && Math.sign(rv) !== Math.sign(r.ttXY[o + 2]))
                el.setAttribute("text-anchor", rv > 0 ? "start" : "end");
              r.ttXY[o + 2] = rv;
              el.style.opacity = rv === 0 ? "0" : `${(Math.abs(rv) - 1) / 50}`;
            }
            shown = c + 1;
          }
          // tick words: fixed, or what each flyby lent (+8), rewritten only when the count changes
          const tkey = it.flybys
            ? env.flybyN * 100000 + (env.launchSpeed > 0 ? Math.round(env.launchSpeed) : 0)
            : count;
          if (tkey !== r.ttKey || shown !== r.ttShown) {
            r.ttKey = tkey;
            r.ttShown = shown;
            for (let c = 0; c < r.tt.length; c++) {
              const el = r.tt[c];
              if (c >= shown) {
                el.textContent = "";
                continue;
              }
              if (it.flybys) {
                const before = c === 0 ? env.launchSpeed : env.flyby[c - 1];
                const gain = env.flyby[c] - before;
                // unknown (NaN) when either speed was not seen
                el.textContent = gain >= 0 ? `+${Math.round(gain)}` : "";
              } else el.textContent = it.text?.[c] ?? "";
            }
          }
          const sig = signature(r, 1);
          if (sig !== r.sig) {
            r.sig = sig;
            r.s.setAttribute("d", emit(r, 1));
          }
          continue;
        }
        case "note": {
          noteAt(r);
          const x = r.nx;
          const y = r.ny;
          const end = it.align === "end";
          // a short rule before the note, drawn first, like a pen settling
          bowed(r, end ? x + 22 : x - 22, y, end ? x + 8 : x - 8, y, 0.6, 4, true);
          const sig = signature(r, Math.min(1, draw / 0.3));
          if (sig !== r.sig) {
            r.sig = sig;
            r.s.setAttribute("d", emit(r, Math.min(1, draw / 0.3)));
          }
          if (r.t) {
            textAt(r, r.t, x, y, end ? -1 : 1);
            typeText(r, r.t, (draw - 0.2) / 0.8);
          }
          continue;
        }
      }
    }
    for (const r of runs) r.snap = r.pres === 0;
    card?.update(dt);
  };

  const active = () => !story.reducedMotion && !root.classList.contains("flow");

  // right after the projector, in the GL's frame: the anchors are this frame's
  const onProjected = () => {
    if (!active()) return;
    const now = performance.now();
    projectedAt = now;
    update(now);
  };
  ink.projected = onProjected;

  // Start over (src/lib/restart.ts): the journal is a clean page again, in the dark of the cut. Every mark is off and
  // undrawn (it draws on again from nothing when its figure comes), and what the notes measured (the launch's
  // speeds, the flybys, the cities, the hovered star) is forgotten.
  const unRestart = onRestart(() => {
    for (const r of runs) {
      r.want = false;
      r.chosen = false;
      r.bound = false;
      r.pres = 0;
      r.drawT = 0;
      r.rawT = 0;
      r.snap = true;
      r.awaySide = 0;
      r.cand = 0;
      r.clashT = 0;
      r.key = Number.NaN;
      r.chars = -1;
      r.ttShown = -1;
      r.ttKey = Number.NaN;
      if (r.shown) {
        r.shown = false;
        r.g.style.visibility = "hidden";
        r.g.style.opacity = "0";
        r.alpha = 0;
      }
    }
    env.launchSpeed = 0;
    env.flyby.fill(0);
    env.flybyN = 0;
    env.hover = -1;
    env.cities = 0;
    flybyAt.fill(-1);
  });

  // when the GL is not drawing (asleep, or no stage), the clock keeps the pen and the fades going
  const unFrame = addFrame(() => {
    if (!active()) return;
    const now = performance.now();
    if (now - projectedAt < 60) return;
    update(now);
  }, 6);

  return () => {
    unFrame();
    unRestart();
    if (ink.projected === onProjected) ink.projected = null;
    window.removeEventListener("resize", measure);
    card?.dispose();
  };
}
