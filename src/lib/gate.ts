import { wake } from "./clock";
import { hold, setPointer } from "./hold";
import { story } from "./story";

/**
 * The first screen's gate: scrolling alone never moves on from the first screen or sets off the big bang. The visitor
 * holds, or at least clicks once, which starts the music and lets them play a little before the show goes on as normal.
 *
 * Until the light is let go (hold.bangAt < 0) on a visit that starts at the top (a fresh load, a reload, Start over),
 * the page stays on the first screen: the wheel, a trackpad, the scroll keys, a finger and the scrollbar cannot move it
 * on (src/lib/scroll.ts holds each of them at the top; nothing they asked for is kept, so nothing replays once the gate
 * opens). The way through is the visitor's own gesture: a hold (the big bang) or a single click, tap or press of the
 * hold key (a smaller bang, src/lib/hold.ts "click"); the music starts with it (src/audio). Each scroll attempt at the
 * closed gate is answered where the visitor looks (knock below): the hint ring and its words come forward with a soft
 * pulse (src/bridges/show-dom.ts), the sky's dust leans toward the pointer and the point breathes (genesis), and a
 * second attempt is answered a little more strongly, never more than that.
 *
 * Always open: an explicit jump (Skip the show, the header's fast lane, a deep link, a platform star, QA's jump) passes
 * it (`passed`) and frees the sky quietly where it lands; the flow layout (reduced motion, ?q=static) and a
 * page without the stage are never gated. Start over (src/lib/scroll.ts startOver: rearmHold, rearmGate) closes it
 * again, and a reload always lands at the top, closed (the inline boot script in src/app/page.tsx holds the page there
 * while the stage loads).
 */
export const gate = {
  /** The stage's scroll is live (src/lib/scroll.ts initScroll): only a staged page is gated. */
  armed: false,
  /** An explicit jump took the page past the first screen (until Start over). */
  passed: false,
  /** The visitor's scroll attempts at the closed gate: when the current one began and last moved (performance.now()). */
  tryAt: -1,
  lastAt: -1,
  /** Attempts in a row (a new one after ATTEMPT_GAP of quiet; the count forgets after FORGET_MS). */
  tries: 0,
  /** How the last attempt came: 0 wheel or trackpad, 1 a scroll key, 2 a finger, 3 the scrollbar, 4 a press that
   *  wandered off into a drag (neither a click nor a hold). */
  via: 0,
};

/** Input this close to the last is the same attempt (a trackpad's fling is one attempt, not sixty). */
const ATTEMPT_GAP = 420;
/** After this long without an attempt the next one is a first again. */
const FORGET_MS = 9000;
/** The answer rises over RISE_MS from an attempt's start and fades over FADE_MS once the input stops. */
const RISE_MS = 140;
const FADE_MS = 1500;

export const VIA = { wheel: 0, key: 1, touch: 2, bar: 3, press: 4 } as const;

/** The gate holds the first screen now. */
export function gateClosed() {
  return gate.armed && !gate.passed && hold.bangAt < 0 && !story.reducedMotion;
}

/** A scroll attempt at the closed gate (src/lib/scroll.ts): the show answers it (gateAnswer). */
export function knock(via: number) {
  const now = performance.now();
  if (gate.lastAt < 0 || now - gate.lastAt > ATTEMPT_GAP) {
    gate.tries = gate.lastAt >= 0 && now - gate.lastAt < FORGET_MS ? gate.tries + 1 : 1;
    gate.tryAt = now;
  }
  gate.lastAt = now;
  gate.via = via;
  // (the answer plays out over the fade after the last input)
  wake(FADE_MS + 700);
  // a desktop visitor who has not moved the mouse yet (the keys): the invitation comes to the middle of the screen,
  // where the point is
  if (!hold.inside && hold.pointerType !== "touch") {
    setPointer(window.innerWidth / 2, window.innerHeight / 2);
    hold.inside = true;
    if (hold.pointerType === "") hold.pointerType = "mouse";
  }
}

/**
 * How strongly the show answers the visitor's attempt now, 0..1: it rises at once, holds while they keep trying and
 * eases away a moment after they stop; a first attempt answers at 0.7, a repeated one in full.
 */
export function gateAnswer(now: number) {
  if (gate.tryAt < 0) return 0;
  const rise = Math.min(1, (now - gate.tryAt) / RISE_MS);
  const fade = Math.max(0, 1 - (now - gate.lastAt) / FADE_MS);
  const f = fade * fade * (3 - 2 * fade);
  return (gate.tries > 1 ? 1 : 0.7) * rise * f;
}

/** Start over: closed again, no attempt remembered. */
export function rearmGate() {
  gate.passed = false;
  gate.tryAt = -1;
  gate.lastAt = -1;
  gate.tries = 0;
}
