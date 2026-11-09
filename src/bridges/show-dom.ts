import { ending, figures, firstScreen, hints as HINT_COPY, lineRamp } from "@/content/site";
import { shared } from "@/gl/shared";
import { ANCHOR, anchor } from "@/lib/anchors";
import { addFrame, isAwake, wake } from "@/lib/clock";
import { gate, gateAnswer, gateClosed, VIA } from "@/lib/gate";
import { FREE_AT, hold, inShow, keyHold } from "@/lib/hold";
import { F, FIGURE_COUNT, FIGURES, HINTS } from "@/lib/journey";
import { clamp01, smooth } from "@/lib/math";
import { onRestart } from "@/lib/restart";
import { story } from "@/lib/story";
import { inkWords } from "./ink";

/**
 * The show's DOM director (docs/STORY.md "How it is presented"): every frame it scrubs the caption block by story time
 * (the figure's "fig. 5 — alignment" and its lines, local k windows from src/content/site.ts), shows the hint ring's
 * verb inside the HINTS windows of src/lib/journey.ts (beside the cursor, or at the bottom centre on touch), signs the
 * journal after the last figure, dims the sky under the record and keeps the live readout honest. Direct DOM writes
 * only when a value changes; no React state, nothing allocated per frame beyond the strings it must write.
 *
 * Show position P = Ts + after: story time runs 0..11 through the twelve figures; past the last marker `after`
 * (viewport heights) carries the sky's figure (11..12), then the ending (12..12 + ending.screens), and the record rises.
 *
 * Lines are scrubbed by scroll, and finish themselves at rest: when the visitor stops (story.rest), a line caught
 * mid-ramp writes itself in (or out) in place over REST_S, so a stopping point never shows a half-blurred line. The
 * scroll position never moves; scrolling on carries on from what is shown, without a jump.
 *
 * The first screen's gate (src/lib/gate.ts): while the page waits for the visitor's hold or click, fig. 1's ring says
 * so ("hold, or click, to begin", with the "with sound" line while the music waits), and every scroll attempt is
 * answered there: the ring and its words come forward (.is-knock) with one soft pulse per attempt (.cursor-pulse), a
 * repeated attempt a little more (.is-knock2), never more. A keyboard attempt also brings the hold key forward (it
 * takes the focus, so Space or Enter on it is the way through; while the gate waits it is the first stop of the tab
 * order, so the next Tab goes on to "Skip the show", never past the whole show). An attempt made with the pointer on a
 * control (a wheel over the fast lane) is answered at the screen's centre, where the point is.
 */

/** 0..1 across [a, b]. */
const ramp = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

/** The flock counts as led while the pointer moved this recently (ms): only then does the ring say "let go". */
const LEADING_MS = 1500;

/** The hint's words start this far right of the ring's centre (CSS px; globals.css .cursor-hint left). */
const HINT_X = 38;
/** The ring's half-width (its 64 px box), and the radius of the circle it draws with a verb (r 22, scaled up to 1.28). */
const RING_HALF = 32;
const RING_DRAWN = 26;
/**
 * On a desktop the words sit beside the ring, else (near the spine and the figure's name beside it, or the page's
 * edge) under it, centred, else under it to its left: never across what the pointer is on, never under the spine.
 * At the foot of the screen they go over the ring instead (EDGE px from the bottom), so they never run off it. They go
 * back to a better place only once it clearly fits again (BACK px), so they never flap.
 */
const UNDER_Y = 41;
const BACK = 60;
/** The words' top above the ring's centre on a desktop (globals.css .cursor-hint top), and on a phone (stacked). */
const HINT_TOP = -11;
const PHONE_HINT_TOP = -21;
const EDGE = 8;
/** On touch, how far the waiting invitation steps aside at a time to find a clear place (CSS px). */
const SHIFT_STEP = 90;

/** Rest (s) before a half-written line finishes itself, and how long it takes. */
const REST_AFTER = 0.18;
const REST_S = 0.4;

/**
 * Follow a scrubbed value `r` (moved from `r0`) with a shown value `d` that may have settled ahead of or behind it:
 * the scroll carries it on continuously and they meet at the ends (0 and 1), so scrolling back still undraws.
 */
const relax = (d: number, r: number, r0: number) => {
  if (r > r0) return d >= r ? d : r0 < 1 ? Math.min(r, 1 - ((1 - d) * (1 - r)) / (1 - r0)) : r;
  if (r < r0) return d <= r ? d : r0 > 0 ? Math.max(r, (d * r) / r0) : r;
  return d;
};

/** The ending's beats, in screens past the last figure (e = P - 12). */
const END = {
  sigAr: [-0.1, 0.28],
  fillAr: [0.12, 0.38],
  sigEn: [-0.02, 0.32],
  fillEn: [0.18, 0.42],
  rule: [0.22, 0.4],
  role: [0.26, 0.4],
  line: [0.3, 0.5],
  actions: [0.42, 0.56],
} as const;
/** The ending's scrubbed CSS variables, each with its beat (written in order into endVals' slots). */
const END_VARS: readonly (readonly [string, readonly [number, number]])[] = [
  ["--sa", END.sigAr],
  ["--fa", END.fillAr],
  ["--se", END.sigEn],
  ["--fe", END.fillEn],
  ["--sr", END.rule],
  ["--ro", END.role],
  ["--e", END.line],
  ["--ac", END.actions],
];
/** The actions' slot in END_VARS (--ac): what is shown of it decides when the ending's links answer. */
const AC_SLOT = END_VARS.findIndex((v) => v[0] === "--ac");
/**
 * The ending's links answer a click, a tap or Tab only once they can be read (a link scrubbed in by --ac is invisible
 * at its start, and an invisible link must never take a click): the email and "Keep your sky" from half shown, and
 * "Start over" (it undoes the whole visit) from three quarters of its own opacity (globals.css .end-again: --ac * 1.6
 * - 0.6). Until then they are inert, and a click there reaches the sky beneath.
 */
const ACTS_LIVE = 0.5;
const AGAIN_LIVE = (0.75 + 0.6) / 1.6;
/** Where the record's top reaches the bottom of the screen, in e: the ending goes up with the page from here. */
const LIFT_FROM = ending.screens - 1;
/** A third into Fig. 1 the first screen gives way: the name's line steps back for the story. */
const PAST_FIRST = F.point + 0.35;

/** It is really the small hours for the visitor: 1:30 to 3:00, local time. */
function lateNight() {
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= 90 && m < 180;
}

/** "Like now." after the 2 a.m. line, everywhere it is printed (also the flow layout). */
export function markLateNight() {
  document.documentElement.classList.toggle("late-night", lateNight());
}

export function startShowDom() {
  const root = document.documentElement;
  const lines = Array.from(document.querySelectorAll<HTMLElement>(".caption .line"));
  const labels = Array.from(document.querySelectorAll<HTMLElement>(".caption .cap-label"));
  const cursor = document.getElementById("nq-cursor");
  const holdArc = document.getElementById("nq-hold");
  const hintEl = document.getElementById("nq-hint");
  const hintEn = document.querySelector<HTMLElement>("#nq-hint .hint-en");
  const hintAr = document.querySelector<HTMLElement>("#nq-hint .hint-ar");
  /** The "with sound" line under the first figure's hold (src/components/cursor.tsx), while the music waits. */
  const hintSound = document.querySelector<HTMLElement>("#nq-hint .hint-sound");
  const readout = document.getElementById("nq-readout");
  const scrim = document.querySelector<HTMLElement>(".scrim");
  const endEl = document.getElementById("nq-ending");
  const keepWrap = document.getElementById("nq-keep-wrap");
  const keep = document.getElementById("nq-keep") as HTMLButtonElement | null;
  const keepStatus = document.getElementById("nq-keep-status");
  const actsEl = endEl?.querySelector<HTMLElement>(".end-actions") ?? null;
  const againEl = endEl?.querySelector<HTMLElement>(".end-again") ?? null;
  if (actsEl) actsEl.inert = true;
  if (againEl) againEl.inert = true;
  const holdKey = document.getElementById("nq-holdkey");
  /** The gate's pulse round the ring (src/components/cursor.tsx): one per scroll attempt at the closed gate. */
  const pulseEl = document.querySelector<HTMLElement>("#nq-cursor .cursor-pulse");
  const recordEl = document.getElementById("record");
  let recordY = recordEl ? recordEl.offsetTop : 0;

  (window as unknown as { __nuqtaLive?: boolean }).__nuqtaLive = true;

  // ---- each caption line's figure and window (src/content/site.ts), read once
  const lineFig = new Int8Array(lines.length);
  const lineIdx = new Int8Array(lines.length);
  const lineWin = new Float32Array(lines.length * 2);
  for (let i = 0; i < lines.length; i++) {
    const fi = Number(lines[i].dataset.fig);
    const li = Number(lines[i].dataset.l);
    const w = figures[FIGURES[fi]].lines[li].win;
    lineFig[i] = fi;
    lineIdx[i] = li;
    lineWin[i * 2] = w[0];
    lineWin[i * 2 + 1] = w[1];
  }

  // ---- the hints: each one's figure start, and whether the visitor has already done it
  const hintF0 = new Float32Array(HINTS.length);
  for (let j = 0; j < HINTS.length; j++) hintF0[j] = F[HINTS[j].fig];
  /** Each hint's figure, as an index (its caption block: inviteY). */
  const hintFi = new Int8Array(HINTS.length);
  for (let j = 0; j < HINTS.length; j++) hintFi[j] = Math.max(0, FIGURES.indexOf(HINTS[j].fig));
  const hintDone = new Uint8Array(HINTS.length);
  const hintSince = new Float64Array(HINTS.length).fill(-1);
  /** Seconds the pointer has been moving lately (a typed slot: written every frame, never boxed). */
  const moveFor = new Float64Array(1);
  /** Where the current press went down (a drag counts only what moved since: never the motion that came before it). */
  let pressX = 0;
  let pressY = 0;
  let wasDown = false;

  // A screen with a fine pointer that can hover is a desktop, even before its mouse has moved: it is never told "tap".
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  // The bodies the hint keeps off (your point, the knots, the clumps, the sun, the planets, the first city), each with
  // its margin (px past its projected radius); the world and the gold world only on touch, where the ring waits on its
  // own (on a desktop the ring is the pointer, which may well be over the world).
  const bodies = [
    anchor(ANCHOR.yours),
    ...[0, 1, 2].map((i) => anchor(ANCHOR.knot(i))),
    ...[0, 1, 2, 3].map((i) => anchor(ANCHOR.clump(i))),
    anchor(ANCHOR.center),
    ...[0, 1, 3, 4].map((i) => anchor(ANCHOR.planet(i))),
    anchor(ANCHOR.hub),
  ];
  const bodyPad = new Float32Array(bodies.map((_, i) => (i === 0 ? 8 : i <= 3 ? 14 : 6)));
  const shy = [anchor(ANCHOR.world), anchor(ANCHOR.planet(2))];
  let hintShift = 0;
  /** Where the touch invitation is going (its shift from the centre), kept while that place stays clear. */
  let hintWant = 0;
  /** Where the hint's words would sit (scratch: left, top, the drop under the header). */
  const wb = new Float64Array(3);
  /** The hint's words' width (CSS px), measured when they change. */
  let hintW = 120;
  /** The words' height (CSS px), measured with their width. */
  let hintH = 24;
  /**
   * Where the words sit (0 beside the ring, 1 under it centred, 2 under it to its left; `hintUp`: over the ring
   * instead, at the foot of the screen), for which size.
   */
  let hintMode = 0;
  let hintUp = false;
  let hintModeW = -1;
  let hintModeH = -1;
  /** The spine's band and its room at the right edge (measured on resize). */
  const spineEl = document.querySelector<HTMLElement>(".spine");
  let spineTop = 0;
  let spineBottom = 0;
  let spineRoom = 244;
  const measureSpine = () => {
    spineRoom = Math.max(244, window.innerWidth * 0.17);
    if (!spineEl) return;
    const r = spineEl.getBoundingClientRect();
    spineTop = r.top - 24;
    spineBottom = r.bottom + 24;
  };
  measureSpine();
  window.addEventListener("resize", measureSpine);

  /**
   * The frame's controls the hint's words keep clear of (viewport CSS px, measured on resize): on a desktop the words
   * never run across the name or the fast lane (they drop under them) nor the bottom row (they go over the ring); on
   * touch the invitation waits in the band between the figure's caption and the controls at the foot of the screen,
   * or above the caption where that band is too short (a phone held sideways). Each figure's caption block: its
   * number's top and its lines' lowest foot.
   */
  type Box = { l: number; t: number; r: number; b: number };
  let chromeHigh: Box[] = [];
  let chromeLow: Box[] = [];
  let chromeCeil = 0;
  let chromeFloor = 0;
  /** The page's gutters (the caption's sides: globals.css --g, a notch's safe-area inset included). */
  let gutL = 16;
  let gutR = 16;
  const capEl = document.querySelector<HTMLElement>(".caption");
  /** The invitation's words are measured (and its row decided) again on the next frame (after a resize). */
  let inviteStale = false;
  const capTop = new Float32Array(FIGURE_COUNT);
  const capBottom = new Float32Array(FIGURE_COUNT);
  const measureChrome = () => {
    const vh = window.innerHeight;
    const cr = capEl?.getBoundingClientRect();
    if (cr && cr.width > 0) {
      gutL = cr.left;
      gutR = window.innerWidth - cr.right;
    }
    const all: Box[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      ".chrome .ident, .chrome .lane, .skip-show, .corner-bl",
    )) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) all.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    chromeHigh = all.filter((b) => b.t + b.b < vh);
    chromeLow = all.filter((b) => b.t + b.b >= vh);
    chromeCeil = 0;
    for (const b of chromeHigh) chromeCeil = Math.max(chromeCeil, b.b);
    chromeFloor = vh - 12;
    for (const b of chromeLow) chromeFloor = Math.min(chromeFloor, b.t);
    capTop.fill(vh * 0.7);
    capBottom.fill(vh * 0.85);
    for (let i = 0; i < labels.length && i < FIGURE_COUNT; i++)
      capTop[i] = labels[i].getBoundingClientRect().top;
    const low = new Float32Array(FIGURE_COUNT);
    for (let i = 0; i < lines.length; i++) {
      const b = lines[i].getBoundingClientRect().bottom;
      if (b > low[lineFig[i]]) low[lineFig[i]] = b;
    }
    for (let i = 0; i < FIGURE_COUNT; i++) if (low[i] > 0) capBottom[i] = low[i];
    hintModeW = -1;
    inviteStale = true;
  };
  measureChrome();
  // (once per frame however many resizes a window drag or a phone's address bar reports)
  let chromeRaf = 0;
  const onChromeResize = () => {
    if (!chromeRaf)
      chromeRaf = requestAnimationFrame(() => {
        chromeRaf = 0;
        measureChrome();
      });
  };
  window.addEventListener("resize", onChromeResize);
  if (document.fonts) void document.fonts.ready.then(onChromeResize);

  /**
   * On touch, where the invitation's ring waits (its centre's y) for figure `fi`'s hint: centred in the band between
   * the caption and the foot's controls when it fits there, else just above the caption (never over the header).
   */
  const inviteY = (fi: number) => {
    // the invitation's reach above and below the ring's centre (the ring and its pulse; the words and their lines; in
    // one line, the circle the ring draws)
    const above = rowOn ? RING_DRAWN + 6 : RING_HALF + 10;
    const below = rowOn ? RING_DRAWN + 6 : Math.max(RING_HALF + 10, HINT_TOP + hintH + 8);
    const lo = capBottom[fi] + 10;
    const hi = chromeFloor - 10;
    if (hi - lo >= above + below) return (lo + hi + above - below) / 2;
    return Math.max(chromeCeil + 10 + above, capTop[fi] - 10 - below);
  };
  /**
   * On a phone the waiting invitation's words stack beside the ring (two short lines) under the caption. A short phone
   * may have no room for that under a two-line sentence: there the ring and its words stand in one line (.is-row) when
   * that fits under it, rather than going up over the picture. Decided when the words change (and on resize).
   */
  let rowOn = false;
  const setRow = (on: boolean) => {
    if (on === rowOn) return;
    rowOn = on;
    cursor?.classList.toggle("is-row", on);
  };

  /**
   * How much a box (CSS px) sits on the ink: its words this frame (src/bridges/ink.ts inkWords) and the bodies it names,
   * and on touch the world too (0: clear). The hint's words and the touch invitation keep off them.
   */
  const onInk = (l: number, t: number, r: number, b: number, big: boolean) => {
    let s = 0;
    const W = inkWords.b;
    for (let i = 0; i < inkWords.n; i++) {
      const o = i * 4;
      if (l < W[o + 2] + 4 && r > W[o] - 4 && t < W[o + 3] + 4 && b > W[o + 1] - 4) s += 60;
    }
    for (let i = 0; i < bodies.length + (big ? shy.length : 0); i++) {
      const a = i < bodies.length ? bodies[i] : shy[i - bodies.length];
      if (!a.live || !a.vis || a.on < 0.2) continue;
      const rad = a.sr + (i < bodies.length ? bodyPad[i] : 20);
      // biome-ignore-start lint/complexity/useMathMinMax: clamps; Math.min differs from the ternary for a NaN bound
      const cx = a.sx < l ? l : a.sx > r ? r : a.sx;
      const cy = a.sy < t ? t : a.sy > b ? b : a.sy;
      // biome-ignore-end lint/complexity/useMathMinMax: cx, cy
      const d = Math.hypot(cx - a.sx, cy - a.sy);
      if (d < rad) s += rad - d;
    }
    return s;
  };

  /**
   * A desktop's hint words round the ring at (x, y): in place `m` (0 beside, 1 under it centred, 2 under it to its
   * left), or over the ring when `up`. Writes their box's left and top, and the drop that keeps them under the header's
   * controls or lifts them clear of the bottom row, into wb; false when under the ring they would run into the bottom
   * row or off the screen's foot (`slack` px of hysteresis).
   */
  const wordsAt = (x: number, y: number, m: number, up: boolean, slack: number) => {
    const left =
      x + HINT_X + (m === 0 ? 0 : m === 1 ? -(HINT_X + hintW / 2) : -(HINT_X + hintW + 8));
    const right = left + hintW;
    let floor = story.vh - EDGE;
    for (const b of chromeLow) if (left < b.r && right > b.l) floor = Math.min(floor, b.t - 6);
    const top = y + HINT_TOP + (m === 0 ? 0 : UNDER_Y);
    let drop = 0;
    if (!up) {
      let ceil = 0;
      for (const b of chromeHigh) if (left < b.r && right > b.l) ceil = Math.max(ceil, b.b + 10);
      if (top < ceil) drop = Math.round(ceil - top);
      wb[1] = top + drop;
    } else {
      // (over the ring with the pointer down in the bottom row itself: lifted clear of it)
      const footUp = y - HINT_TOP - UNDER_Y;
      if (footUp > floor) drop = Math.round(floor - footUp);
      wb[1] = footUp - hintH + drop;
    }
    wb[0] = left;
    wb[2] = drop;
    return top + hintH <= floor - slack;
  };

  /** When the first screen arrived (its line and figure number fade in from here): the load, or starting over. */
  let bootAt = performance.now();
  /** Each line's scrubbed values last frame, and what is shown (they part only at rest). */
  const rawE = new Float32Array(lines.length).fill(-1);
  const rawX = new Float32Array(lines.length).fill(-1);
  const showE = new Float32Array(lines.length);
  const showX = new Float32Array(lines.length);
  const lastE = new Float32Array(lines.length).fill(-1);
  const lastX = new Float32Array(lines.length).fill(-1);
  const lineOn = new Uint8Array(lines.length);
  const labelO = new Float32Array(labels.length).fill(-1);
  const endVals = new Float32Array(END_VARS.length).fill(-1);
  /** The ending's scrubbed values last frame, and what is shown (they part only at rest, as the lines do). */
  const endRaw = new Float32Array(END_VARS.length).fill(-1);
  const endShow = new Float32Array(END_VARS.length);
  let cx = -1;
  let cy = -1;
  let lastK = -1;
  let lastScrim = -1;
  let ringState = -1;
  let hintIdx = -2;
  let hintTouch = false;
  let holdOpen = -2;
  let lastLift = -1;
  let endOn = false;
  let keepOn = false;
  let actsLive = false;
  let againLive = false;
  let lastReadoutAt = 0;
  let lastLateAt = 0;
  let readoutOn = false;
  let notAwakeSince = 0;
  let flags = 0;
  /** The gate's answer shown (0 none, 1 an attempt, 2 a repeated one), the attempt last pulsed, the pulse's phase. */
  let knockState = 0;
  let lastTry = -1;
  let pulseFlip = false;
  /** How far the ring has gone to the screen's centre to answer an attempt made over a control (0..1, eased), and
   *  whether the invitation shown is there only for that answer (it fades when the answer does, never cut). */
  let centreK = 0;
  let byCentre = false;
  /** The hold key is the first stop of the tab order (while the gate waits). */
  let holdFirst = false;
  /** The hold window whose first Tab has been to the hold key (-2: none yet; see onTab). */
  let tabbedWin = -2;
  /** How far the words drop under the header's controls (px; desktop). */
  let hintDrop = 0;

  const fmt = new Intl.NumberFormat("en-US");

  const setFlag = (bit: number, name: string, on: boolean) => {
    if (((flags & bit) !== 0) === on) return;
    flags = on ? flags | bit : flags & ~bit;
    root.classList.toggle(name, on);
  };

  /** Write one of the ending's scrub values as a CSS variable, only when it moves. */
  const endVar = (slot: number, name: string, v: number) => {
    if (
      !endEl ||
      (Math.abs(v - endVals[slot]) < 0.002 && v !== 0 && v !== 1) ||
      v === endVals[slot]
    )
      return;
    endVals[slot] = v;
    endEl.style.setProperty(name, v.toFixed(3));
  };

  /** The hint's words for a figure and verb (the figure's own, or the shared ones; the touch variant on touch). */
  const hintWords = (j: number, touch: boolean) => {
    const h = HINTS[j];
    const c = figures[h.fig].hints?.[h.verb] ?? HINT_COPY[h.verb];
    return touch && c.touch ? c.touch : c;
  };

  /** A shown value at rest: a ramp caught in its middle finishes (past `cut`) or withdraws, at REST_S. */
  const settle = (d: number, raw: number, cut: number, dt: number) => {
    if (raw <= 0 || raw >= 1) return raw;
    const to = raw > cut ? 1 : 0;
    return to > d ? Math.min(to, d + dt / REST_S) : Math.max(to, d - dt / REST_S);
  };

  // Start over (src/lib/restart.ts): the first screen arrives again (its line and number fade in, the hold ring
  // invites), every hint invites again, and no line or ending value carries on from where the visit left it.
  const unRestart = onRestart(() => {
    bootAt = performance.now();
    hintDone.fill(0);
    hintSince.fill(-1);
    moveFor[0] = 0;
    rawE.fill(-1);
    rawX.fill(-1);
    endRaw.fill(-1);
    hintIdx = -2;
    ringState = -1;
    holdOpen = -2;
    tabbedWin = -2;
    wasDown = false;
    lastTry = -1;
  });

  const unFrame = addFrame((_t, dt) => {
    const now = performance.now();
    const P = story.Ts + story.after;
    const banged = hold.bangAt >= 0;
    const e = P - FIGURE_COUNT;
    const resting = story.rest > REST_AFTER && !story.reducedMotion;

    // ---- the caption's lines
    for (let i = 0; i < lines.length; i++) {
      const fi = lineFig[i];
      const k = P - F[FIGURES[fi]];
      const w0 = lineWin[i * 2];
      const w1 = lineWin[i * 2 + 1];
      let en: number;
      let ex: number;
      // the first figure's lines answer the arrival, the hold and the burst in time: those parts never settle
      let timedE = false;
      let timedX = false;
      if (fi === 0 && lineIdx[i] === 0) {
        // fades in once on arrival; the hold, the burst (or its quiet release) or the scroll take it away
        en = story.reducedMotion ? 1 : smooth((now - bootAt - 250) / 1200);
        ex = Math.max(
          clamp01(hold.k * 1.4),
          banged ? clamp01((now - hold.bangAt) / 450) : 0,
          ramp(k, w1 - lineRamp.out, w1),
        );
        timedE = true;
        timedX = true;
      } else if (fi === 0 && lineIdx[i] === 1) {
        // the line that answers the burst, a moment after it (time-based, once), or scrubbed in by scroll once the burst
        // has come (docs/STORY.md: "after the burst"). A release by the scroll (past FREE_AT) draws the sky into the
        // point for a moment first: the scrub waits for it, then joins in over a short fade so the line never jumps in.
        const since = banged ? now - hold.bangAt - 700 : -1;
        const t = since > 0 ? smooth(since / 1300) : 0;
        const gate = banged && story.reducedMotion ? 1 : since > 0 ? smooth(since / 400) : 0;
        const s0 = Math.max(w0, FREE_AT - F.point);
        en = Math.max(t, gate * ramp(k, s0, s0 + lineRamp.in));
        ex = ramp(k, w1 - lineRamp.out, w1);
        timedE = true;
      } else {
        en = ramp(k, w0, w0 + lineRamp.in);
        ex = ramp(k, w1 - lineRamp.out, w1);
      }
      // what is shown: the scrub, carried on from wherever a rest left it, and finished in place at rest
      let se = en;
      let sx = ex;
      if (!timedE && rawE[i] >= 0) {
        se = relax(showE[i], en, rawE[i]);
        if (resting) se = settle(se, en, 0.3, dt);
      }
      if (!timedX && rawX[i] >= 0) {
        sx = relax(showX[i], ex, rawX[i]);
        if (resting) sx = settle(sx, ex, 0.5, dt);
      }
      rawE[i] = en;
      rawX[i] = ex;
      showE[i] = se;
      showX[i] = sx;
      if (se !== lastE[i] && (Math.abs(se - lastE[i]) > 0.0015 || se === 0 || se === 1)) {
        lines[i].style.setProperty("--e", se.toFixed(3));
        lastE[i] = se;
      }
      if (sx !== lastX[i] && (Math.abs(sx - lastX[i]) > 0.0015 || sx === 0 || sx === 1)) {
        lines[i].style.setProperty("--x", sx.toFixed(3));
        lastX[i] = sx;
      }
      const on = se > 0.001 && sx < 0.999 ? 1 : 0;
      if (on !== lineOn[i]) {
        lineOn[i] = on;
        lines[i].classList.toggle("on", on === 1);
      }
    }

    // ---- the figure's number in the margin: through its figure, crossing over at the seams
    for (let i = 0; i < labels.length; i++) {
      const enter =
        i === 0
          ? story.reducedMotion
            ? 1
            : smooth((now - bootAt - 150) / 1200)
          : ramp(P, i - 0.02, i + 0.04);
      const leave =
        i === labels.length - 1 ? ramp(P, i + 0.84, i + 0.92) : ramp(P, i + 0.96, i + 1.0);
      const o = enter * (1 - leave);
      if (Math.abs(o - labelO[i]) > 0.004 || (o === 0) !== (labelO[i] === 0)) {
        labelO[i] = o;
        labels[i].style.opacity = o.toFixed(3);
        labels[i].style.visibility = o > 0.001 ? "visible" : "hidden";
      }
    }

    // ---- the hint ring: one verb, inside its window, until the visitor has done it. It only ever invites what will
    // answer: a click is done when its outcome happened (a click that changed nothing leaves the invitation up), the
    // let-go only while the flock is following, and never over a control (the stage's gestures do not start there)
    const touch = hold.pointerType === "touch" || (hold.pointerType === "" && !finePointer.matches);
    const show = inShow() && !story.reducedMotion;
    const moving = now - hold.lastMove < 120;
    // the gate answering an attempt made with the pointer on a control (a wheel over the fast lane): the invitation
    // comes to the screen's centre, where the point is, while the answer lasts
    const gatedNow = gateClosed();
    const answer = gatedNow ? gateAnswer(now) : 0;
    const centre =
      show && !touch && gatedNow && answer > 0.04 && !hold.down && !(hold.inside && hold.overStage);
    if (hold.down && !wasDown) {
      pressX = hold.x;
      pressY = hold.y;
    }
    wasDown = hold.down;
    moveFor[0] = moving ? moveFor[0] + dt : Math.max(0, moveFor[0] - dt * 0.5);
    let hint = -1;
    let holdWin = -1;
    for (let j = 0; j < HINTS.length && show; j++) {
      const h = HINTS[j];
      const k = P - hintF0[j];
      // the first figure's hold invites only until the light is let go (it bursts once per visit)
      const open = j === 0 ? !banged && k < h.win[1] + 0.2 : k >= h.win[0] && k <= h.win[1];
      if (!open) {
        hintSince[j] = -1;
        continue;
      }
      if (h.verb === "hold" && holdWin < 0) holdWin = j;
      if (hint >= 0) continue;
      if (hintSince[j] < 0) {
        hintSince[j] = now;
        // (leading counts from here: the pointer's motion before the flock was there led nothing)
        if (h.verb === "move") moveFor[0] = 0;
      }
      const p = shared.play;
      let can = true;
      if (!hintDone[j]) {
        let did = false;
        switch (h.verb) {
          case "hold":
            // (fig. 1's is the gate's invitation: it stays until the light is let go, even past a hold given up)
            did = h.fig === "point" ? false : hold.live;
            break;
          case "drag": {
            // fig. 2's stir takes any stroke; the figures that turn (4, 8, 12) turn with a sideways drag only
            const stir = h.fig === "versions";
            const moved = stir
              ? Math.hypot(hold.x - pressX, hold.y - pressY)
              : Math.abs(hold.x - pressX);
            did =
              hold.down &&
              !hold.pressing &&
              moved > 40 &&
              (stir ? Math.abs(hold.vx) + Math.abs(hold.vy) : Math.abs(hold.vx)) > 80;
            break;
          }
          case "click":
            // the figure's own outcome (fig. 3 a knot chosen, fig. 7 the launch), never the mere click
            did =
              h.fig === "center"
                ? p.centerByVisitor
                : h.fig === "assist"
                  ? p.launchByVisitor
                  : hold.tapAt > hintSince[j];
            break;
          case "move":
            did = moveFor[0] > 1.4;
            break;
          case "letgo":
            // it says "let go" to a visitor who is leading the flock; done once it flies on its own
            did = p.autonomy > 0.9;
            // (a finger leads while it is down: lifting it is the letting go, answered at once)
            can = touch ? hold.down : now - hold.lastMove < LEADING_MS;
            break;
          case "hover":
            // a star named (on touch, by a first tap): its card says how to open it, so the ring is done
            did = p.hoverStar !== "";
            break;
        }
        if (did) hintDone[j] = 1;
      }
      if (!hintDone[j] && can && (touch || (hold.inside && hold.overStage) || (j === 0 && centre)))
        hint = j;
    }
    // the invitation leaves at once when nothing would answer it any more (its window closed under the scroll, the
    // pointer went over a control); it fades out only once the gesture has answered it (fig. 1's: the light let go)
    const cut =
      hintIdx >= 0 && hint < 0 && !hintDone[hintIdx] && !(hintIdx === 0 && (banged || byCentre));
    byCentre = hint === 0 && centre;
    if (hint !== hintIdx || touch !== hintTouch || (inviteStale && hint >= 0)) {
      hintIdx = hint;
      hintTouch = touch;
      inviteStale = false;
      if (hint >= 0 && hintEn && hintAr) {
        const w = hintWords(hint, touch);
        hintEn.textContent = w.en;
        hintAr.textContent = w.ar;
        cursor?.setAttribute("data-verb", HINTS[hint].verb);
        // (measured once per change of words: on touch the ring and its words are centred together, with the first
        // hold's "with sound" line under them while the music waits)
        if (hintEl) {
          setRow(false);
          const line =
            hint === 0 && hintSound && root.classList.contains("sound-ready")
              ? hintSound.offsetWidth
              : 0;
          hintW = Math.max(hintEl.offsetWidth, line);
          hintH = hintEl.offsetHeight;
          // a phone with no room under the caption for the stacked words: in one line there, where that fits
          if (touch && hint > 0 && story.vw <= 760) {
            const room = chromeFloor - 10 - (capBottom[hintFi[hint]] + 10);
            if (room < 2 * (RING_HALF + 10) && room >= 2 * (RING_DRAWN + 6)) {
              setRow(true);
              if (RING_HALF + HINT_X + hintEl.offsetWidth <= story.vw - gutL - gutR) {
                hintW = hintEl.offsetWidth;
                hintH = hintEl.offsetHeight;
              } else setRow(false);
            }
          }
        }
      }
    }

    // ---- the keyboard's hold: in the tab order while a figure invites a hold, with that figure's words; when its
    // window closes it lets go of the focus and the key (Space scrolls again), so it never invites what will not answer
    // (while the gate waits the hold key is the first stop of the tab order: a Tab after an attempt goes on to "Skip the
    // show", never past the whole show into the record)
    const first = gatedNow && holdWin >= 0;
    if (holdKey && first !== holdFirst) {
      holdFirst = first;
      if (first) holdKey.tabIndex = 1;
      else holdKey.removeAttribute("tabindex");
    }
    if (holdWin !== holdOpen) {
      holdOpen = holdWin;
      // (a window that closes offers its first Tab again when it next opens)
      if (holdWin < 0) tabbedWin = -2;
      if (holdKey) {
        holdKey.classList.toggle("open", holdWin >= 0);
        if (holdWin >= 0)
          holdKey.textContent =
            firstScreen.holdKey[HINTS[holdWin].fig] ?? firstScreen.holdKey.point;
        else if (document.activeElement === holdKey) {
          keyHold(false);
          holdKey.blur();
        }
      }
    }

    // ---- the cursor: the ring under the pointer (at the bottom centre on touch, while it only invites)
    if (cursor) {
      const pressing = hold.live || hold.k > 0.01;
      let x = hold.x;
      let y = hold.y;
      // (an attempt over a control: the ring goes to the centre, eased, and comes back to the pointer after)
      centreK += ((centre ? 1 : 0) - centreK) * (1 - Math.exp(-dt * 10));
      if (centreK < 0.002) centreK = 0;
      if (centreK > 0) {
        x += (story.vw / 2 - x) * centreK;
        y += (story.vh / 2 - y) * centreK;
        wake(200);
      }
      if (touch && !pressing && hint >= 0) {
        // the ring (RING_HALF each side of x) and its words (from x + HINT_X) centred as one, inside the frame
        const half = (RING_HALF + HINT_X + hintW) / 2;
        x = story.vw / 2 - half + RING_HALF;
        // between the caption and the controls at the foot (a phone's fast lane, a tablet's bottom row), or above the
        // caption where that is too tight
        y = inviteY(hintFi[hint]);
        // a body or the ink's words right where the invitation waits (your point and its label, a knot, the world): it
        // steps aside to the nearest place either way where it sits on none of them, and keeps a place while it is
        // clear (eased, never a jump)
        const lo = gutL + RING_HALF - x;
        const hi = story.vw - gutR - HINT_X - hintW - x;
        const wTop = y + (story.vw <= 760 && !rowOn ? PHONE_HINT_TOP : HINT_TOP);
        const t = Math.min(y - RING_DRAWN, wTop);
        const b = Math.max(y + RING_DRAWN, wTop + hintH);
        let want = Math.min(hi, Math.max(lo, hintWant));
        let best = onInk(x + want - RING_DRAWN, t, x + want + HINT_X + hintW, b, true);
        for (let c = 0; c < 7 && best > 0; c++) {
          const s = Math.min(
            hi,
            Math.max(lo, c === 0 ? 0 : (c % 2 === 1 ? -1 : 1) * Math.ceil(c / 2) * SHIFT_STEP),
          );
          const h = onInk(x + s - RING_DRAWN, t, x + s + HINT_X + hintW, b, true);
          if (h < best - 0.5) {
            best = h;
            want = s;
          }
        }
        hintWant = want;
        hintShift += (want - hintShift) * (1 - Math.exp(-dt * 6));
        x += hintShift;
      } else {
        hintShift = 0;
        hintWant = 0;
      }
      // a desktop: beside the ring, else under it, so the words never run under the spine or off the page (eased
      // in CSS; a fading hint stays where it is)
      if (hint >= 0) {
        let m = 0;
        let up = false;
        let drop = 0;
        if (!touch) {
          const lim = y > spineTop && y < spineBottom ? story.vw - spineRoom : story.vw - 20;
          if (x + HINT_X + hintW <= lim - (hintMode > 0 ? BACK : 0)) m = 0;
          else if (x + hintW / 2 <= lim - (hintMode > 1 ? BACK : 0)) m = 1;
          else m = 2;
          // the words' foot where they would sit (beside the ring or under it): past the screen's foot, or across the
          // bottom row's controls, they go over the ring; and never across the name or the fast lane: under them
          up = !wordsAt(x, y, m, false, hintUp ? BACK : 0);
          wordsAt(x, y, m, up, 0);
          drop = wb[2];
          // nor on the ink's words or the bodies it names (your point and its label, a knot the visitor reaches for):
          // there, the first other place round the ring that fits and is clear
          if (onInk(wb[0], wb[1], wb[0] + hintW, wb[1] + hintH, false) > 0) {
            for (let c = 0; c < 6; c++) {
              const cm = c % 3;
              const cu = c >= 3;
              if (
                (cm === m && cu === up) ||
                (cm === 0 && x + HINT_X + hintW > lim) ||
                (cm === 1 && x + hintW / 2 > lim)
              )
                continue;
              if (!wordsAt(x, y, cm, cu, 0) && !cu) continue;
              if (onInk(wb[0], wb[1], wb[0] + hintW, wb[1] + hintH, false) > 0) continue;
              m = cm;
              up = cu;
              drop = wb[2];
              break;
            }
          }
        }
        if (
          (m !== hintMode ||
            up !== hintUp ||
            hintW !== hintModeW ||
            hintH !== hintModeH ||
            drop !== hintDrop) &&
          hintEl
        ) {
          hintMode = m;
          hintUp = up;
          hintModeW = hintW;
          hintModeH = hintH;
          hintDrop = drop;
          const tx = m === 0 ? 0 : m === 1 ? -(HINT_X + hintW / 2) : -(HINT_X + hintW + 8);
          // (over the ring they keep as clear of it as under it: their foot as far above its centre as their top is below)
          const ty = (up ? -(2 * HINT_TOP + UNDER_Y + hintH) : m === 0 ? 0 : UNDER_Y) + drop;
          hintEl.style.translate = tx === 0 && ty === 0 ? "" : `${tx}px ${ty}px`;
        }
      }
      if (Math.abs(x - cx) > 0.05 || Math.abs(y - cy) > 0.05) {
        cx = x;
        cy = y;
        cursor.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      }
      // bits: 1 ring, 2 pressing, 4 the verb beside it, 8 touch (the invitation breathes), 16 the first figure's crosshair
      let state = 0;
      if (show && pressing) state = 1 | 2;
      else if (show && hint >= 0) state = 1 | 4;
      if (touch) state |= 8;
      if (show && P < F.versions && !banged && (state & 1) !== 0) state |= 16;
      if (state !== ringState) {
        ringState = state;
        cursor.classList.toggle("is-cut", cut);
        cursor.classList.toggle("is-ring", (state & 1) !== 0);
        cursor.classList.toggle("is-press", (state & 2) !== 0);
        cursor.classList.toggle("is-hint", (state & 4) !== 0);
        cursor.classList.toggle("is-invite", (state & 4) !== 0 && (state & 8) !== 0);
        cursor.classList.toggle("is-cross", (state & 16) !== 0);
      }
      if (holdArc && Math.abs(hold.k - lastK) > 0.002) {
        lastK = hold.k;
        holdArc.style.strokeDashoffset = (100 - 100 * hold.k).toFixed(2);
      }

      // ---- the gate's answer to a scroll attempt: the invitation comes forward (a repeated attempt a little more),
      // one soft pulse per attempt; it settles back a moment after the visitor stops
      const gated = gatedNow;
      const ans = answer;
      const kn = ans > 0.04 && (state & 4) !== 0 ? (gate.tries > 1 ? 2 : 1) : 0;
      if (kn !== knockState) {
        knockState = kn;
        cursor.classList.toggle("is-knock", kn > 0);
        cursor.classList.toggle("is-knock2", kn > 1);
      }
      if (gated && gate.tryAt >= 0 && gate.tryAt !== lastTry) {
        lastTry = gate.tryAt;
        if (pulseEl && (state & 4) !== 0) {
          // (two names for one keyframe set: switching restarts it without a forced layout)
          pulseFlip = !pulseFlip;
          pulseEl.classList.toggle("go-a", pulseFlip);
          pulseEl.classList.toggle("go-b", !pulseFlip);
          pulseEl.classList.toggle("strong", gate.tries > 1);
        }
        // a keyboard's attempt: the hold key comes forward with the focus (Space or Enter on it is the way through)
        const a = document.activeElement;
        if (
          gate.via === VIA.key &&
          holdKey?.classList.contains("open") &&
          (!a || a === document.body || a === root)
        ) {
          holdKey.focus({ preventScroll: true });
        }
        wake(1600);
      }
      if (kn > 0) wake(200);
    }

    // ---- the ending: signed in ink, the last line, the email; carried up with the page as the record arrives
    if (endEl) {
      // the signature, the last line and the email write themselves by scroll, and finish in place at rest
      for (let s = 0; s < END_VARS.length; s++) {
        const w = END_VARS[s][1];
        const raw = ramp(e, w[0], w[1]);
        let v = endRaw[s] < 0 ? raw : relax(endShow[s], raw, endRaw[s]);
        if (resting) v = settle(v, raw, 0.3, dt);
        endRaw[s] = raw;
        endShow[s] = v;
        endVar(s, END_VARS[s][0], v);
      }
      const lift = Math.max(0, e - LIFT_FROM) * story.vh;
      if (Math.abs(lift - lastLift) > 0.1) {
        lastLift = lift;
        endEl.style.transform = lift > 0 ? `translate3d(0,${(-lift).toFixed(1)}px,0)` : "";
      }
      const on = !story.reducedMotion && e > END.sigAr[0] && lift < story.vh;
      if (on !== endOn) {
        endOn = on;
        endEl.classList.toggle("on", on);
      }
      const ac = endShow[AC_SLOT];
      const al = on && ac >= ACTS_LIVE;
      if (actsEl && al !== actsLive) {
        actsLive = al;
        actsEl.inert = !al;
      }
      const gl = on && ac >= AGAIN_LIVE;
      if (againEl && gl !== againLive) {
        againLive = gl;
        againEl.inert = !gl;
      }
      if (keepWrap) {
        const k = on && shared.captureSky !== null && e > END.actions[0];
        if (k !== keepOn) {
          keepOn = k;
          keepWrap.classList.toggle("on", k);
        }
      }
    }

    // ---- the record dims the sky as it rises over it
    const dim = ramp(e, LIFT_FROM - 0.1, LIFT_FROM + 0.6);
    if (scrim && Math.abs(dim - lastScrim) > 0.002) {
      lastScrim = dim;
      scrim.style.opacity = dim.toFixed(3);
    }
    setFlag(
      1,
      "in-record",
      recordEl ? story.scroll > recordY - story.vh * 0.45 : e > LIFT_FROM + 0.5,
    );
    setFlag(2, "past-first", P > PAST_FIRST);
    setFlag(4, "in-ending", e > END.sigAr[0]);
    // the header's night is on as soon as the record's top is on screen (before its opener passes under the name)
    setFlag(8, "rec-near", recordEl ? story.scroll > recordY - story.vh : e > LIFT_FROM);

    // ---- twice a second: where the record starts, the small hours, and the live readout (only while it is true:
    // a real count, frames actually being drawn)
    if (now - lastReadoutAt < 500) return;
    lastReadoutAt = now;
    if (recordEl) recordY = recordEl.offsetTop;
    if (now - lastLateAt > 30000) {
      lastLateAt = now;
      markLateNight();
    }
    if (readout) {
      const awake = isAwake();
      if (awake) notAwakeSince = 0;
      else if (!notAwakeSince) notAwakeSince = now;
      const truthful =
        shared.ready &&
        shared.simCount > 0 &&
        shared.fps > 1 &&
        !story.reducedMotion &&
        (awake || now - notAwakeSince < 1000) &&
        e < LIFT_FROM;
      if (truthful)
        readout.textContent = `${fmt.format(shared.simCount)} points · ${Math.round(shared.fps)} fps`;
      if (truthful !== readoutOn) {
        readoutOn = truthful;
        readout.classList.toggle("on", truthful);
      }
    }
  }, 5);

  // ---- the keyboard hold
  const onKeyDown = (e: KeyboardEvent) => {
    // (only while a figure invites a hold: a key left focused never holds where nothing answers)
    if (!holdKey?.classList.contains("open")) return;
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      keyHold(true);
    } else if (e.key === " " || e.key === "Enter") e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      keyHold(false);
    }
  };
  const onBlur = () => keyHold(false);
  holdKey?.addEventListener("keydown", onKeyDown);
  holdKey?.addEventListener("keyup", onKeyUp);
  holdKey?.addEventListener("blur", onBlur);
  // While the gate waits, Tab from the top of the page (nothing focused yet, or the first point Start over focuses)
  // comes to the hold key first, as a fresh visit's first Tab does, never on past the whole show into the record. In a
  // hold window after it (figs. 3, 5, 9, 10) the first Tab comes to the hold key too, wherever the focus is (a spine
  // link the visitor jumped with: Space on it would scroll them past the window); the next one goes on from the hold
  // key, so the key is offered once per window and never traps the focus.
  const onTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || !holdKey) return;
    // (not where the key is not shown at all, a phone's layout, nor out of the CV's dialog)
    if (!holdKey.classList.contains("open") || holdKey.getClientRects().length === 0) return;
    const a = document.activeElement;
    if (a === holdKey || a?.closest("dialog")) return;
    const fresh = !a || a === document.body || a === root || a.id === "top";
    if (!(holdFirst && fresh) && tabbedWin === holdOpen) return;
    e.preventDefault();
    tabbedWin = holdOpen;
    holdKey.focus();
  };
  window.addEventListener("keydown", onTab);

  // ---- keep your sky: a PNG souvenir of the visitor's own sky
  let saving = false;
  const onKeep = async () => {
    if (saving || !shared.captureSky) return;
    saving = true;
    keep?.setAttribute("aria-busy", "true");
    if (keepStatus) keepStatus.textContent = firstScreen.keepSkyBusy;
    wake(1500);
    try {
      const blob = await shared.captureSky();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "my-sky-over-riyadh.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        if (keepStatus) keepStatus.textContent = firstScreen.keepSkyDone;
      } else if (keepStatus) keepStatus.textContent = "";
    } catch {
      if (keepStatus) keepStatus.textContent = "";
    } finally {
      saving = false;
      keep?.removeAttribute("aria-busy");
      window.setTimeout(() => {
        if (keepStatus) keepStatus.textContent = "";
      }, 3500);
    }
  };
  keep?.addEventListener("click", onKeep);

  return () => {
    unFrame();
    unRestart();
    holdKey?.removeEventListener("keydown", onKeyDown);
    holdKey?.removeEventListener("keyup", onKeyUp);
    holdKey?.removeEventListener("blur", onBlur);
    window.removeEventListener("keydown", onTab);
    keep?.removeEventListener("click", onKeep);
    window.removeEventListener("resize", measureSpine);
    window.removeEventListener("resize", onChromeResize);
    cancelAnimationFrame(chromeRaf);
    holdKey?.removeAttribute("tabindex");
    (window as unknown as { __nuqtaLive?: boolean }).__nuqtaLive = false;
  };
}
