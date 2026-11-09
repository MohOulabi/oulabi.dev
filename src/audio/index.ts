/**
 * The sound's controller (the score itself is ./score.ts). Sound is ON by default, and an explicit "off" is remembered.
 * Browsers let audio start only after a user gesture, and creating the first audio context of a browser session costs
 * the main thread ~150 ms. So that the gesture stays light, the context is created while the page loads (suspended:
 * nothing sounds, nothing renders) and the score is built in two short idle steps; the visitor's first real gesture (a
 * mouse press, a finger's lift from a tap or a hold, or a plain key; never a wheel, a swipe, a finger landing, a
 * shortcut or Tab: the browser's own list of user activations) only resumes it, and the music fades in once the
 * context really runs. The first figure's hold (or click: the first screen's gate, src/lib/gate.ts, waits for one of
 * them) is the natural start: the music rises with the hold, or comes with the click's bang (on a touch screen the
 * browser lets it start only when the finger lifts). While the gate is closed nothing else starts it
 * (src/lib/hold.ts onGateGesture: the hold beginning, the light let go), so the music never plays while the page still
 * waits; only the switch and an explicit jump on (a fast-lane link, Skip the show) start it there too. Opening the CV,
 * and anything done inside its sheet, is not a gesture toward the show: the music waits (the switch is out of reach
 * under the sheet). Until then the switch shows a play mark ("ready") and the first screen's hold hint says "with
 * sound" (html.sound-ready, globals.css); a visitor who scrolls where the gate is open (a deep link) is told once,
 * beside the switch, that a click or a tap anywhere starts it (sound.nudge). Clicking the switch while it waits starts
 * the music; while it plays, turns it off (a 0.6 s fade); while off, turns it on.
 * The volume line let go at zero is "off". Hidden tab: faded out and suspended; shown again: resumed and faded in.
 * The static tier (?q=static, or a device the tier sends there: html.no-stage) has no score: no context is made, no
 * gesture is waited for, and the switch is hidden. Start over (src/lib/restart.ts) gives the score back its arrival:
 * the music glides back to fig. 1 and the cues listen again (the switch and the volume stay as chosen).
 */
import { gateClosed } from "@/lib/gate";
import { onGateGesture } from "@/lib/hold";
import { isQA } from "@/lib/qa";
import { onRestart } from "@/lib/restart";
import type { Score } from "./score";

/** Only an explicit "off" is stored (a new key: the old switch was off by default, its stored state means nothing now). */
const KEY = "gravity:sound";
const OLD_KEY = "launch-night:sound";
const VOL_KEY = "launch-night:volume";
const DEFAULT_VOLUME = 0.5;
/** How long the "click anywhere" line stays beside the switch after the first scroll (ms). */
const NUDGE_MS = 11000;

/**
 * What the switch shows. `on`: wanted (the default). `waiting`: on, but no gesture has started it yet. `playing`: the
 * music is running. `nudge`: the visitor scrolled while it waits (the switch says once that any click starts it).
 */
export const sound = {
  on: true,
  waiting: true,
  playing: false,
  volume: DEFAULT_VOLUME,
  nudge: false,
};

const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;
let score: Score | null = null;
let mod: typeof import("./score") | null = null;
let loading: Promise<typeof import("./score")> | null = null;
let inited = false;
let gateOn = false;
/** A gesture has asked the context to run (until then a context that runs by itself is held suspended). */
let gestured = false;
/** The context has run since that gesture (until then a switch that is on is still waiting). */
let started = false;
/** The last volume let go at a level worth hearing (the line let go at zero turns the sound off; the next "on" comes back here). */
let audible = DEFAULT_VOLUME;
let nudged = false;
let nudgeTimer = 0;
/**
 * The time constant of the fade waiting for the context to run (-1: none waits). The score is faded in only on a
 * running context: one that cannot run yet (no activation) has a stopped clock, so a source started on it only earns
 * a console warning, and every cue scheduled on it would wait there and sound late, all at once, when it finally runs.
 */
let fadeTc = -1;

const load = () => {
  loading ??= import("./score").then((m) => (mod = m));
  return loading;
};

type Idle = (fn: () => void, o?: { timeout: number }) => number;
const idle = (fn: () => void, timeout = 3000) => {
  const ric = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback;
  if (ric) ric(fn, { timeout });
  else window.setTimeout(fn, 60);
};

function emit() {
  sound.playing = sound.on && started && !!score;
  sound.waiting = sound.on && !sound.playing;
  if (!sound.waiting) sound.nudge = false;
  const root = document.documentElement;
  root.classList.toggle("sound-ready", sound.waiting);
  root.classList.toggle("sound-playing", sound.playing);
  for (const fn of listeners) fn();
}

/** Re-render on change (the switch). */
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function save() {
  try {
    if (sound.on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
    localStorage.setItem(VOL_KEY, String(Math.round(sound.volume * 100) / 100));
  } catch {
    // storage blocked: the choice lasts for this visit
  }
}

/** The static tier (and no stage) has no score to hear: the switch is hidden there, and nothing waits for a gesture. */
const noStage = () => document.documentElement.classList.contains("no-stage");

/** Read the remembered choice once (the switch mounts), get the music ready and wait for the visitor's first gesture. */
export function initSound() {
  if (inited) return;
  inited = true;
  let off = false;
  try {
    off = localStorage.getItem(KEY) === "off";
    localStorage.removeItem(OLD_KEY);
    // (a stored line at zero is not a volume to come back to: that visitor gets the default)
    const v = Number.parseFloat(localStorage.getItem(VOL_KEY) ?? "");
    if (Number.isFinite(v) && v >= 0.05) sound.volume = Math.min(1, v);
  } catch {
    // storage blocked
  }
  audible = sound.volume;
  sound.on = !off;
  document.addEventListener("visibilitychange", onVisibility);
  // start over (src/lib/restart.ts): the music and its cues as on arrival (the switch and the volume stay as chosen)
  onRestart(() => score?.restart());
  // the first screen's gate: the visitor's own hold or click is the start (src/lib/hold.ts)
  onGateGesture(onGateStart);
  // (no stage: nothing to hear, so nothing is made and nothing waits for a gesture)
  if (sound.on && !noStage()) {
    armGate();
    prepare();
  } else if (!noStage()) idle(() => void load(), 4000);
  qaHook();
  emit();
}

/**
 * While the page loads, in its idle time (the show is not on screen yet, so the context's one long step is not seen):
 * the context (held suspended until a gesture), then the score's graph and its room (two steps of about 10 ms). The
 * gesture then only resumes it. (A gesture that comes first creates it itself.)
 */
function prepare() {
  void load();
  idle(() => {
    // (the tier may have sent the page to the static journal since: then there is nothing to make)
    if (!ctx && sound.on && !noStage()) createContext();
    if (!ctx) return;
    void load().then(() =>
      idle(() => {
        build();
        idle(() => score?.room());
      }),
    );
  }, 1200);
}

function createContext() {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC({ latencyHint: "playback" });
  } catch {
    ctx = null;
    return;
  }
  ctx.addEventListener("statechange", onState);
  // a browser that lets it run without a gesture: hold it until one (nothing renders, nothing sounds before the visitor acts)
  if (ctx.state === "running" && !gestured) void ctx.suspend();
}

function build() {
  if (score || !mod || !ctx) return;
  score = mod.createScore(ctx, { deferRoom: true });
  qa?.(score);
}

/** The switch's click (a user gesture): waiting → start; playing → off; off → on. */
export function toggleSound() {
  if (sound.on && sound.playing) turnOff();
  else {
    sound.on = true;
    start(0.45);
  }
  save();
  emit();
}

function turnOff() {
  sound.on = false;
  disarmGate();
  score?.fadeOut();
}

export function setVolume(v: number, persist = false) {
  sound.volume = Math.min(1, Math.max(0, v));
  if (persist && sound.volume >= 0.05) audible = sound.volume;
  score?.setVolume(sound.volume);
  // the line let go at (or next to) nothing: that is "off", and the next "on" comes back at the last audible level
  if (persist && sound.volume < 0.02 && sound.on) {
    sound.volume = audible;
    turnOff();
  }
  if (persist) save();
  emit();
}

/**
 * Inside a user activation (the gate checked it; the switch's click is one). Prepared (the usual case): the context
 * resumes, and the music fades in as soon as it runs (go). Otherwise (the sound was off when the page loaded) the
 * context is created here and the score is built just after. (The resume is asked for even when the context still
 * says "running": a suspend asked for a moment ago, by the switch turned off, may not have landed yet.)
 */
function start(tc: number) {
  gestured = true;
  if (!ctx) createContext();
  if (!ctx) return;
  fadeTc = tc;
  void ctx.resume().then(onState, () => undefined);
  onState();
}

function go() {
  if (fadeTc < 0 || !ctx || ctx.state !== "running") return;
  if (!sound.on) {
    fadeTc = -1;
    return;
  }
  if (!score) {
    // (the score is built just after the handler that got here returns; built twice, it is built once)
    if (mod)
      window.setTimeout(() => {
        build();
        go();
      }, 0);
    else void load().then(go);
    return;
  }
  const tc = fadeTc;
  fadeTc = -1;
  score.room();
  score.setHidden(document.hidden);
  score.fadeIn(sound.volume, tc);
  emit();
}

/**
 * Running after a gesture: the switch stops waiting and the music fades in. Interrupted by the system (a call): the
 * next gesture resumes it.
 */
function onState() {
  if (!ctx) return;
  const state = ctx.state as string;
  if (state === "running" && gestured) {
    if (!started) {
      started = true;
      emit();
    }
    disarmGate();
    go();
  } else if (state === "interrupted" && sound.on) armGate();
}

// ---- the first-gesture gate: the events that can be a user activation (a wheel never is)
const GATE_EVENTS = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;
/** Keys that are not a gesture toward the page: a lone modifier, Escape, Tab moving the focus (to the switch, say). */
const NOT_A_GESTURE = new Set([
  "Escape",
  "Tab",
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Fn",
]);
/** A scroll (a wheel, a swipe that scrolls) is not activation: while waiting, the first one shows the nudge. */
const SCROLL_EVENTS = ["wheel", "touchmove"] as const;
/**
 * Not toward the show: the switch (it handles its own click: it may be turning the sound off) and the CV's sheet (a
 * visitor who came for the CV reads it in quiet, and the switch is out of reach under it). Its openers too, when they
 * are pressed (a click, Enter, Space); an arrow key while the focus is still on one (it comes back there when the
 * sheet closes) is for the page.
 */
const NOT_THE_SHOW = "[data-sound], dialog.cv";
const CV_OPENER = '[aria-haspopup="dialog"]';

/**
 * Is this event a user activation (so the context may start)? The browser says so where it can: on a touch screen a
 * finger landing is not one, nor a swipe's lift, only the lift of a tap or a hold. Without that API, the spec's own
 * list: a pointer pressed is one only for a mouse (its lift is one for a finger or a pen).
 */
function activates(e: Event) {
  const ua = (navigator as { userActivation?: UserActivation }).userActivation;
  if (ua) return ua.isActive;
  if (e.type === "pointerdown") return (e as PointerEvent).pointerType === "mouse";
  if (e.type === "pointerup") return (e as PointerEvent).pointerType !== "mouse";
  return true;
}

/** An explicit jump on past the first screen (the fast lane, Skip the show, the spine): it passes the gate, so it is a start. */
const JUMP = "a[href^='#']:not([data-restart]):not([href='#']):not([href='#top'])";

function onGesture(e: Event) {
  const el = e.target as Element | null;
  // the switch handles its own click (it may be turning the sound off); the CV's sheet is read in quiet
  if (el?.closest?.(NOT_THE_SHOW)) return;
  // At the first screen's closed gate the music starts with the light (a hold beginning, a click or a tap, Space or
  // Enter on the hold key: onGateStart, from src/lib/hold.ts), never with a press that turns out to be none of them
  // (a drag, a swipe, the scrollbar, another button), a scroll key or a click on another control; an explicit jump on
  // past the first screen is the visitor's start too.
  if (gateClosed() && !(e.type === "click" && el?.closest?.(JUMP))) return;
  const key = e.type === "keydown" ? (e as KeyboardEvent) : null;
  if (el?.closest?.(CV_OPENER) && (!key || key.key === "Enter" || key.key === " ")) return;
  if (key) {
    // a shortcut (Cmd+F, Ctrl+C...) is meant for the browser, not the page
    if (key.metaKey || key.ctrlKey || key.altKey || NOT_A_GESTURE.has(key.key)) return;
  }
  // (not one: the gate stays armed for the event that is, the finger's lift)
  if (!activates(e)) return;
  begin();
}

/** The visitor's own gesture at the first screen's gate (src/lib/hold.ts onGateGesture): the music starts with it. */
function onGateStart() {
  if (!gateOn) return;
  // (only inside a gesture the browser counts: the ?bang=1 QA switch on load is not one)
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  if (ua && !ua.hasBeenActive) return;
  begin();
}

function begin() {
  if (!sound.on || noStage()) return disarmGate();
  if (ctx && started && score) void ctx.resume().catch(() => undefined);
  else start(0.9);
}

function onScrollIntent(e: Event) {
  // (at the first screen's gate the page answers a scroll itself: its invitation says a click begins, and the click
  // is also what starts the music; the line beside the switch is for a page that scrolls without one, a deep link's)
  if (gateClosed()) return;
  // (scrolling the CV's sheet is reading the CV: the nudge waits for the show)
  if ((e.target as Element | null)?.closest?.("dialog.cv")) return;
  removeScroll();
  if (nudged || !sound.waiting) return;
  nudged = true;
  sound.nudge = true;
  emit();
  nudgeTimer = window.setTimeout(() => {
    sound.nudge = false;
    emit();
  }, NUDGE_MS);
}

function removeScroll() {
  for (const t of SCROLL_EVENTS) window.removeEventListener(t, onScrollIntent, { capture: true });
}

function armGate() {
  if (gateOn) return;
  gateOn = true;
  for (const t of GATE_EVENTS)
    window.addEventListener(t, onGesture, { capture: true, passive: true });
  if (!nudged)
    for (const t of SCROLL_EVENTS)
      window.addEventListener(t, onScrollIntent, { capture: true, passive: true });
}

function disarmGate() {
  if (!gateOn) return;
  gateOn = false;
  for (const t of GATE_EVENTS) window.removeEventListener(t, onGesture, { capture: true });
  removeScroll();
  window.clearTimeout(nudgeTimer);
}

function onVisibility() {
  score?.setHidden(document.hidden);
}

// ---- QA (dev, or a production build opened with ?qa): window.__sound
let qa: ((s: Score) => void) | null = null;
function qaHook() {
  if (!isQA()) return;
  void import("./qa").then((m) => {
    qa = (s) => m.attachQA(s);
    if (score) qa(score);
    m.exposeQA(
      () => score,
      () => ctx,
    );
  });
}
