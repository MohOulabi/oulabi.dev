import { LAST_BEAT } from "./stations";

/**
 * Story time (docs/STORY.md, src/lib/journey.ts). `T` is the figure position derived from the natural scroll position
 * (0 … LAST_BEAT, fractional between the figures' `[data-beat]` markers: figure i spans [i, i + 1)). `Ts` is `T`
 * critically damped, and is what every animated thing reads. Scroll is never moved by the story: this module only
 * reads it. Mutable singleton: read it inside frame callbacks, never store it in React state.
 *
 * T saturates at the last figure (the sky). Past it, `after` counts viewport heights scrolled beyond the last
 * figure's marker: 0..1 is the sky's own stretch (its two lines), 1..1 + ending.screens the journal signed, and the
 * record rises in normal flow over the dimmed sky.
 *
 * The show position P = Ts + after follows the scroll's P = T + afterT as one value, so the two never part: a far cut
 * freezes both (nothing past the frozen figure flashes before the veil is down), and inside the show (below
 * `limitEnd`) P never moves faster than VMAX, however the page is moved (a scrollbar drag, a phone's fling, End).
 * What the page runs ahead of that is caught by the far-move cut in src/lib/scroll.ts.
 */
export const story = {
  /** Document scroll offset (px) of each `[data-beat]` marker. */
  beatPx: [] as number[],
  scroll: 0,
  /** Viewport heights scrolled past the last figure's marker (0 before the last figure), as shown (followed with Ts). */
  after: 0,
  /** The same, straight from the scroll (the follow's target, with T). */
  afterT: 0,
  T: 0,
  Ts: 0,
  /** Speed of Ts (story time per second; 0 past the last figure), and of the show position P = Ts + after. */
  vTs: 0,
  vP: 0,
  /** Show position P where the show's speed limit ends (the record's top at the bottom of the screen; src/lib/scroll.ts). */
  limitEnd: Number.POSITIVE_INFINITY,
  /** True when Ts has caught up with T. */
  settled: true,
  /** Ts holds still (a far cut is fading out: src/lib/scroll.ts); the follow resumes when it lands. */
  freeze: false,
  /**
   * Seconds Ts has rested where it is (0 while the visitor scrolls). Past a moment of rest, whatever the scroll left
   * half-written (a line mid-ramp, a note half-typed) finishes itself in place; the scroll position never moves.
   */
  rest: 0,
  vw: 1,
  vh: 1,
  reducedMotion: false,
};

/** Read `[data-beat]` markers and store their document scroll offsets. */
export function measureBeats() {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-beat]"));
  const px: number[] = [];
  const y0 = window.scrollY;
  for (const el of els) px[Number(el.dataset.beat)] = el.getBoundingClientRect().top + y0;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  for (let i = 0; i <= LAST_BEAT; i++) px[i] = Math.min(px[i] ?? max, max);
  story.beatPx = px;
  story.vw = window.innerWidth;
  story.vh = window.innerHeight;
}

/** Scroll px → story time: linear between figure markers, clamped to 0 … LAST_BEAT. */
export function scrollToT(scroll: number): number {
  const px = story.beatPx;
  if (px.length === 0 || scroll <= px[0]) return 0;
  for (let i = 0; i < px.length - 1; i++) {
    const a = px[i];
    const b = px[i + 1];
    if (scroll < b) return b > a ? i + (scroll - a) / (b - a) : i + 1;
  }
  return px.length - 1;
}

/** Story time → scroll px (inverse of scrollToT; T beyond LAST_BEAT adds viewport heights past the last marker). */
export function tToScroll(T: number): number {
  const px = story.beatPx;
  if (px.length === 0) return 0;
  const t = Math.max(0, T);
  if (t >= LAST_BEAT) return px[LAST_BEAT] + (t - LAST_BEAT) * story.vh;
  const i = Math.floor(t);
  return px[i] + (t - i) * (px[i + 1] - px[i]);
}

export function setScroll(scroll: number) {
  story.scroll = scroll;
  story.T = scrollToT(scroll);
  const end = story.beatPx[LAST_BEAT] ?? 0;
  story.afterT = Math.max(0, (scroll - end) / Math.max(1, story.vh));
}

/** Show the scroll's place at once (no follow, no flight): after a cut, a jump, a resize. */
export function syncShown() {
  story.Ts = story.T;
  story.after = story.afterT;
  story.vTs = 0;
  story.vP = 0;
}

let restScroll = 0;
/**
 * Still enough to count as rest: the scroll moving under REST_PX_S (px/s) and Ts within REST_T of T. Lenis's lerp
 * ends in a long sub-pixel tail (a notch's glide is visually over in ~0.5 s but exact only after ~1 s): waiting for
 * exact stillness would leave a half-written note on screen for a second or more after the page has visibly stopped.
 */
const REST_PX_S = 30;
const REST_T = 0.002;

/**
 * The show's speed limit (show position per second, about a figure and a half): the visitor either skips the show or
 * takes the journey at its pace. The wheel, the keys and a touch's fling are held at the input (src/lib/scroll.ts
 * LIMIT: 1.2 viewport heights a second through figs 1-3, easing to 0.7 from the sun's ignition on, and no figure is
 * shorter than a screen), so this never binds on them; it holds every other way of moving the page (a scrollbar drag, a
 * native fling, a finger faster than the pace, Home/End) to the journey's pace, and the far-move cut takes over when
 * the page runs ahead.
 */
const VMAX = 1.5;

/** How far the shown position trails the scroll's (show position units). */
export const lag = () => Math.abs(story.T + story.afterT - story.Ts - story.after);

/** Critically damped follow of the scroll's show position, speed-limited inside the show, frame-rate independent. */
export function updateStory(dt: number) {
  if (story.freeze) {
    story.vTs = 0;
    story.vP = 0;
    story.rest = 0;
    return;
  }
  const omega = story.reducedMotion ? 60 : 14; // ~0.3 s to settle
  const Pt = story.T + story.afterT;
  const P0 = story.Ts + story.after;
  const x = P0 - Pt;
  const v = story.vP;
  const exp = Math.exp(-omega * dt);
  let P = Pt + (x + (v + omega * x) * dt) * exp;
  let nv = (v - omega * (v + omega * x) * dt) * exp;
  if (!story.reducedMotion && Math.min(P0, Pt) < story.limitEnd) {
    const m = VMAX * dt;
    if (P - P0 > m) P = P0 + m;
    else if (P - P0 < -m) P = P0 - m;
    if (nv > VMAX) nv = VMAX;
    else if (nv < -VMAX) nv = -VMAX;
  }
  if (Math.abs(P - Pt) < 1e-4 && Math.abs(nv) < 1e-3) {
    P = Pt;
    nv = 0;
  }
  story.vP = nv;
  // biome-ignore lint/complexity/useMathMinMax: a NaN P falls to LAST_BEAT here, where Math.min would pass the NaN on
  story.Ts = P < LAST_BEAT ? P : LAST_BEAT;
  story.after = P > LAST_BEAT ? P - LAST_BEAT : 0;
  story.vTs = P < LAST_BEAT ? nv : 0;
  // (past the last figure T holds at its end while `after` carries on: the scroll itself says whether it moved)
  const still = Math.abs(story.scroll - restScroll) <= REST_PX_S * dt && Math.abs(P - Pt) < REST_T;
  story.rest = still ? story.rest + dt : 0;
  restScroll = story.scroll;
}
