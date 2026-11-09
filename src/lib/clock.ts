import gsap from "gsap";
import { story, updateStory } from "./story";

type FrameFn = (time: number, dt: number) => void;
type Sub = { fn: FrameFn; priority: number };

const subs: Sub[] = [];
let render: ((timeMs: number) => void) | null = null;
let awakeUntil = 0;
let started = false;
let last = 0;

/** Register a per-frame callback. Lower priority runs first. Runs every tick, awake or not. */
export function addFrame(fn: FrameFn, priority = 0) {
  const sub = { fn, priority };
  subs.push(sub);
  subs.sort((a, b) => a.priority - b.priority);
  return () => {
    const i = subs.indexOf(sub);
    if (i >= 0) subs.splice(i, 1);
  };
}

/** The WebGL stage registers its render call here (R3F `advance`). */
export function setRender(fn: ((timeMs: number) => void) | null) {
  render = fn;
  wake(400);
}

/** Keep rendering for at least `ms` milliseconds. */
export function wake(ms = 600) {
  awakeUntil = Math.max(awakeUntil, performance.now() + ms);
}

export function isAwake() {
  return performance.now() < awakeUntil;
}

function tick(time: number) {
  const now = time * 1000;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  const before = story.Ts + story.after;
  for (const s of subs) if (s.priority < 0) s.fn(time, dt);
  updateStory(dt);
  const P = story.Ts + story.after;
  const settled = P === story.T + story.afterT;
  if (P !== before || !settled) wake(250);
  story.settled = settled;
  for (const s of subs) if (s.priority >= 0) s.fn(time, dt);
  if (render && now < awakeUntil) render(now);
}

export function startClock() {
  if (started) return;
  started = true;
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(tick);
  const onVis = () => {
    if (!document.hidden) wake(500);
  };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("resize", () => wake(800));
}
