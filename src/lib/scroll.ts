import Lenis, { type VirtualScrollData } from "lenis";
import { resetPlay, shared } from "@/gl/shared";
import { addFrame, wake } from "./clock";
import { gate, gateClosed, knock, rearmGate, VIA } from "./gate";
import { hold, rearmHold } from "./hold";
import { BEATS, F } from "./journey";
import { restartShow } from "./restart";
import { HOLD } from "./show";
import { easeInOut } from "./stations";
import { lag, measureBeats, scrollToT, setScroll, story, syncShown, tToScroll } from "./story";

/**
 * Natural smooth scroll (docs/STORY.md "Natural scroll only"). Lenis smooths the wheel; the page moves only when the
 * visitor scrolls. There is no snapping, no pinning and no auto-advance anywhere. Inside the show the visitor's own
 * scrolling has a speed limit (LIMIT below), about a figure a second through figs 1-3 and slower from the sun's
 * ignition on, so the system's motion reads: what goes faster is dropped, never queued.
 * The only programmatic scroll is an explicit jump: the visitor activates an in-page link (the spine, the fast lane,
 * "Skip the show", a platform star, a deep link on load) and the page goes there. Near jumps glide; far jumps cut
 * through a short fade so the show does not fast-forward. Whatever moves the page, the show itself never plays
 * faster than the journey's pace (src/lib/story.ts VMAX); a move the visitor makes natively that runs ahead of it
 * (Home, End, a scrollbar drag, a phone's native fling) cuts through the same fade, the veil staying down until the
 * page has calmed. A resize keeps the visitor's place in the story (a figure's length is in viewport heights, so a new
 * height moves every marker).
 *
 * A reload starts the journey again at the top: the browser never restores the old scroll position (the inline boot
 * script sets history.scrollRestoration to "manual" before the first paint, src/app/page.tsx), and no in-page jump
 * ever writes a hash into the address (the spine, the fast lane, "Skip the show": onClick). Only a link the visitor
 * opens with a hash (#work, #skills, #record ...) lands there, on load and on reload, until the visitor scrolls back
 * into the show by hand: then the hash is dropped (dropHash), so a reload from there starts at the top again. Starting
 * over (startOver: the header name, "Start over" in the ending) cuts to the top and re-arms the whole show in the dark
 * (src/lib/restart.ts).
 *
 * The first screen's gate (src/lib/gate.ts): until the visitor lets the light go with their own gesture (a hold, a
 * click), a visit that starts at the top stays there. The wheel and a trackpad (limitWheel), the scroll keys with End
 * and Cmd+Down (onKey), a finger (the gated touchmove, and html.gated's touch-action and overscroll-behavior: no pan,
 * no pull-to-refresh, pinch-zoom kept) and the scrollbar, a middle-click's autoscroll or a selection dragged past the
 * edge (the scroll guard: a native move the visitor's own hands make, held where the gate holds, gateHold) cannot take
 * it on, and what they asked for is dropped, never queued, so nothing replays when the gate opens: the rest of a wheel
 * stream or a held key the gate was holding is dropped too until it stops (gateStream, keyStream). Each attempt is
 * answered by the show (knock). An explicit jump passes the gate (gate.passed): a link, a deep link or #work typed in
 * the address, and a native move no hand on the page made (find in page, a screen reader's cursor, Tab into the record).
 */

let lenis: Lenis | null = null;
/** Set when the visitor scrolls by hand: deep-link corrections stop once they have. */
let touched = false;
/**
 * Where the closed gate holds the page (scroll px): the top, or where the page already was when it closed (the motion
 * toggle back from the printed journal), lowered as the visitor scrolls up. The gate never moves the page itself.
 */
let gateHold = 0;
/** Keys that take the page to its end natively (End, and Cmd+Down on a Mac): the gate holds them too. */
function endKey(e: KeyboardEvent) {
  return e.key === "End" || (e.metaKey && e.key === "ArrowDown");
}
/**
 * The visitor's hands on the page, for the gate's scroll guard: pointer buttons down (a scrollbar's drag, a selection),
 * fingers down, a middle press (its autoscroll runs on after the button is up, until the next press or key), and when
 * the last wheel and scroll key came. A native move while any of them is at work is the visitor's own scroll attempt;
 * one with none of them (find in page, a screen reader's cursor, the address's #hash) is an explicit move.
 */
const hands = { buttons: 0, fingers: 0, middle: false, keyAt: -1e9 };
/**
 * A native scroll already gliding as the gate took over (a wheel or a key the browser took before the page's script
 * could hold it): the visitor's hand too, until it has rested (no scroll for FLIGHT_MS). `flightAt`: its last move.
 */
let flight = false;
let flightAt = -1e9;
const FLIGHT_MS = 200;
/** Within this of the last wheel or scroll key (ms) a native move is still theirs (a fling's tail, a key's glide). */
const HANDS_MS = 400;
/** A wheel stream (a spin, a trackpad's fling and its momentum) goes on while its events come closer than this (ms). */
const STREAM_GAP = 220;
/** When the last wheel came (performance.now()), and whether its stream began while the gate was holding the page. */
let wheelAt = -1e9;
let gateStream = false;
/** A scroll key the gate held is still down (its repeats after the gate opens are dropped until it is let go). */
let keyStream = false;

const cutListeners = new Set<(phase: "out" | "in") => void>();
/** Listeners for the fade used on far jumps (src/bridges/cut.ts draws it). */
export function onCut(fn: (phase: "out" | "in") => void) {
  cutListeners.add(fn);
  return () => {
    cutListeners.delete(fn);
  };
}

export function getLenis() {
  return lenis;
}

/** An element's top in the document, from layout (offsetTop): never the record's reveal offset or any transform. */
function docTop(el: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null)
    y += n.offsetTop;
  return y;
}

/** Where a jump to `el` lands: its top, under the fixed header (its scroll-margin-top, globals.css). */
function targetY(el: HTMLElement | null): number {
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  if (!el) return 0;
  const margin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return Math.min(max, Math.max(0, docTop(el) - margin));
}

function focusTarget(el: HTMLElement | null, star: string) {
  if (!el) return;
  // Fig. 11's also-shipped stars all land on the one row: the link of the star the visitor chose takes the focus
  const lit = star ? el.querySelector<HTMLElement>(`[data-star="${CSS.escape(star)}"]`) : null;
  if (lit) {
    lit.classList.add("lit");
    window.setTimeout(() => lit.classList.remove("lit"), 2600);
    lit.focus({ preventScroll: true });
    return;
  }
  const f = el.querySelector<HTMLElement>("[data-jump-focus]") ?? el;
  if (!f.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(f.tagName))
    f.setAttribute("tabindex", "-1");
  f.focus({ preventScroll: true });
}

/**
 * Where the visitor last was under a settled layout (scroll px and show position P). A resize's own scroll events
 * (the browser clamping the page as it shrinks) never write it, so a resize restores the place from here.
 */
let goodY = 0;
let goodP = 0;

/** Sync the story to the scroll position at once (no fly-through after a cut). */
function syncStory(y: number) {
  endGlide();
  setScroll(y);
  syncShown();
  story.freeze = false;
  // (a programmatic landing is not the page's own speed: the far-move cut's calm reads only what the visitor moves)
  speedY = y;
  goodY = y;
  goodP = story.T + story.afterT;
  wake(1500);
}

/** A cut in progress (a far jump or a far native move): it owns the veil until it is done. */
let cutting = false;
/** Where the cut in progress lands, in the dark: a request made during its fade replaces it (one fade, one landing). */
let cutLand: () => void = () => {};
/** The cut in progress waits for the page to calm before it lands (a native move still under way). */
let cutCalm = false;

/** The page's own speed lately (viewport heights per second, eased), whatever moves it: the far-move cut reads it. */
let pageSpeed = 0;
/** Where the page was on the last frame (scroll px), for pageSpeed. */
let speedY = 0;
/**
 * Under the veil, a native move waits until the page has calmed below this (vh/s), however long the visitor keeps it
 * running inside the show (a scrollbar dragged on for seconds): landing while it still runs would only cut again half
 * a second later, the veil lifting and dropping mid-drag. Once the page is past the show (the record, where nothing
 * holds its pace) it lands at once. CALM_MAX_MS is only a safety.
 */
const CALM = 1.6;
const CALM_MAX_MS = 10000;

/**
 * Fade out, run `land` in the dark, fade back in. `calm`: a native move still under way (a scrollbar dragged on, a
 * fling's momentum) keeps the veil down until the page has slowed to the journey's pace, so it lands once, where the
 * visitor stops, instead of fading in and out again on the way. Asked again while the veil is still down (a second
 * link clicked during the fade: the name after "Skills"; Start over during a native move's wait), the cut keeps its
 * one fade and lands where it was asked last, waiting for calm only if that last request does.
 */
function cut(land: () => void, calm = false) {
  cutLand = land;
  cutCalm = calm;
  if (cutting) return;
  cutting = true;
  for (const fn of cutListeners) fn("out");
  const t0 = performance.now();
  const tryLand = () => {
    if (
      cutCalm &&
      pageSpeed > CALM &&
      story.T + story.afterT < story.limitEnd &&
      performance.now() - t0 < CALM_MAX_MS
    ) {
      wake(200);
      window.setTimeout(tryLand, 60);
      return;
    }
    cutLand();
    cutting = false;
    for (const fn of cutListeners) fn("in");
  };
  window.setTimeout(tryLand, 320);
}

export type JumpOptions = { focus?: boolean; immediate?: boolean };

/**
 * Go to an in-page target ("top", an element id or an element). Only ever called from an explicit activation.
 */
export function jumpTo(target: string | HTMLElement, opts: JumpOptions = {}) {
  const el =
    typeof target === "string"
      ? target === "top"
        ? null
        : document.getElementById(target)
      : target;
  if (typeof target === "string" && target !== "top" && !el) return;
  // the star under the pointer when the visitor clicked it (Fig. 11), for the also-shipped row
  const star = el?.id === "work-more" ? shared.play.hoverStar : "";
  // a record item that has not been revealed yet: reveal it now, so it does not slide up under the visitor's eyes
  if (el?.hasAttribute("data-reveal")) el.classList.add("in");
  const y = targetY(el);
  // an explicit jump past the first screen passes the gate (the sky is freed quietly where it lands)
  if (y > gateHold + 1) gate.passed = true;
  const done = () => {
    if (opts.focus) focusTarget(el ?? document.getElementById("top"), star);
  };
  if (!lenis) {
    window.scrollTo({ top: y, behavior: "auto" });
    done();
    return;
  }
  endGlide();
  const from = lenis.scroll;
  const dist = Math.abs(y - from);
  const vh = Math.max(1, window.innerHeight);
  wake(2000);
  if (opts.immediate || story.reducedMotion || dist < 2) {
    lenis.scrollTo(y, { immediate: true, force: true });
    syncStory(y);
    done();
    return;
  }
  if (dist > vh * 1.6) {
    cut(() => {
      lenis?.scrollTo(targetY(el), { immediate: true, force: true });
      syncStory(targetY(el));
      done();
    });
    return;
  }
  lenis.scrollTo(y, {
    duration: Math.min(1.3, 0.75 + (dist / vh) * 0.35),
    easing: easeInOut,
    force: true,
    onComplete: done,
  });
}

/**
 * Start over: the page cuts to the top through the far-jump fade, and in the dark the whole show is re-armed as on
 * arrival (the light back in the sky waiting for the hold, every outcome of the visit undone: src/lib/restart.ts).
 * Only ever called from an explicit activation (a link marked data-restart); scrolling back up by hand resets nothing.
 */
function startOver() {
  const top = document.getElementById("top");
  // the printed journal (the static tier: no stage, no smooth scroll): there is no show to re-arm, only the top
  if (!lenis) {
    window.scrollTo(0, 0);
    focusTarget(top, "");
    return;
  }
  const land = () => {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
    syncStory(0);
    // the speed limit and the governor as on arrival: a full burst, no direction yet, the page at rest
    budget = LIMIT.burst;
    budgetAt = performance.now();
    lastDir = 0;
    pageSpeed = 0;
    // the gate closed again at the top (the visitor's gesture is the way on, as on arrival)
    gateHold = 0;
    gateStream = false;
    keyStream = false;
    rearmGate();
    rearmHold();
    resetPlay();
    restartShow();
    focusTarget(top, "");
  };
  wake(2000);
  // a jump still fading (the name clicked right after "Skills"): the restart takes over its landing, in the same dark
  if (cutting) {
    cut(land);
    return;
  }
  // already at the first point with the light still waiting: there is nothing to start over
  if (hold.bangAt < 0 && lenis.scroll < 2) {
    focusTarget(top, "");
    return;
  }
  // (no show to fade: the printed journal of reduced motion)
  if (story.reducedMotion) land();
  else cut(land);
}

/** Whether the address carries a hash (one the visitor opened, or typed): read from the flag, never per frame. */
let hashed = false;
/** Set once a deep link on load has been honoured (or there was none): only then may scrolling drop the hash. */
let deepDone = false;

/**
 * Take the hash out of the address (an in-page jump, or the visitor back in the show by hand), so that a reload starts
 * the journey at the top. The page does not move.
 */
function dropHash() {
  hashed = false;
  if (!location.hash) return;
  try {
    history.replaceState(null, "", location.pathname + location.search);
  } catch {
    // ignore
  }
}

function onHashChange() {
  hashed = location.hash.length > 1;
  // a place the visitor asked for in the address (#work typed, a link from elsewhere in the same page): an explicit
  // jump, as a deep link on load is (it passes the first screen's gate; the hash stays, so a reload lands there too)
  if (!lenis || !hashed) return;
  let id = "";
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  if (id === "top" || !document.getElementById(id)) return;
  jumpTo(id, { focus: true });
}

function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  const a = (e.target as HTMLElement | null)?.closest?.("a[href^='#']") as HTMLAnchorElement | null;
  if (!a) return;
  const id = a.getAttribute("href")?.slice(1) ?? "";
  const el = id === "top" ? null : document.getElementById(id);
  if (id !== "top" && !el) return;
  e.preventDefault();
  if (a.hasAttribute("data-restart")) startOver();
  else jumpTo(id, { focus: true });
  // an in-page jump never writes its place into the address (a reload starts at the top: see the header)
  dropHash();
}

/**
 * In-page links (every tier): jumps, Start over, and no hash written. initScroll installs them on a stage; the static
 * tier (the printed journal, no smooth scroll) installs them alone.
 */
export function initLinks() {
  hashed = location.hash.length > 1;
  document.addEventListener("click", onClick);
  window.addEventListener("hashchange", onHashChange);
  return () => {
    document.removeEventListener("click", onClick);
    window.removeEventListener("hashchange", onHashChange);
  };
}

/** Keys that scroll the page natively. */
const SCROLL_KEYS = new Set([" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);

/**
 * The show's speed limit (the visitor either skips the show or takes the journey at its pace). From the top of the page
 * until the record's top reaches the screen, the visitor's own scrolling moves at most `rate` viewport heights a second
 * (about a figure a second) through figs 1-3, easing down to `slow` from fig. 3's ignition into fig. 4 (SLOW: from
 * where the system starts forming to the end of the show, where every motion wants to be read, above all as the solar
 * system forms). A time-based budget in viewport heights (a token bucket) refills at the cap where the page is and
 * holds at most `burst`, so a wheel notch, a short swipe and reading-pace scrolling pass whole and at once, while a
 * hard spin or a long fling is held to the cap. Input the budget cannot pay for is discarded, never queued, and `lead`
 * caps how far Lenis's target may run ahead of the page: the glide after the last input is a fifth of a screen at most,
 * nearly all of it within 0.3 s, and the page never keeps going on its own. The lead is also the page's top speed
 * (Lenis closes about six leads a second), and the burst is spent at that speed: so where the cap slows, the lead slows
 * with it (`lead` is given at `rate`) and the burst eases down to `slowBurst` (a notch). Kept at their figs 1-3 values
 * there, they would let the first half screen of every fling run at 1.4 viewport heights a second, and a hard spin
 * would carry the faster pace a third of a figure past the ignition (measured). Turning round refills the budget (turn:
 * a notch back after a spin answers at once). The scroll keys, Option+arrow included, glide at the same cap (GLIDE
 * below; under reduced motion they jump, and a fresh press may borrow `keyDebt` and what the burst gave up, so it still
 * moves a whole page). Touch from fig. 2 on follows the finger one to one and only its fling is paid from the budget
 * (TOUCH below). Explicit navigation (the spine, the fast lane, "Skip the show", a platform star, a deep link) never
 * passes through here.
 *
 * What the cap cannot see is held at the show instead (story.ts VMAX, the show-wide governor): Home, End, a scrollbar
 * drag, a native fling (a gesture that starts in fig. 1 or in the record), a finger dragged faster than the journey's
 * pace. The shown position never plays faster than VMAX (1.5 figures a second), and a page that runs FAR ahead of it
 * goes through the far-move fade (FAR in initScroll). The numbers agree: the cap's top speed is the lead's, at most
 * 1.6 viewport heights a second for the half screen of a burst in figs 1-3 (1.2 held) and under 1 from the ignition on
 * (0.7 held), and no figure is shorter than a screen, so capped wheel, key and touch scrolling stay at or under the
 * governor's pace and trail the page by the follow's own lag (a fifth of a figure at most), never near FAR.
 */
const LIMIT = {
  rate: 1.2,
  slow: 0.7,
  burst: 0.6,
  slowBurst: 0.2,
  lead: 0.25,
  keyDebt: 0.4,
} as const;
/**
 * Story time over which the cap eases from `rate` to `slow` and the burst from `burst` to `slowBurst` (smoothstep, so
 * the page decelerates without a step): from the ignition's first light (BEATS.center.ignite) to where fig. 4's planets
 * have begun to condense.
 */
const SLOW = [F.center + BEATS.center.ignite[0], F.gathering + 0.2] as const;
/** How far into the slow part of the show scroll `y` is, 0..1 (past the last figure T holds at its end: 1). */
function slowK(y: number) {
  const k = Math.min(1, Math.max(0, (scrollToT(y) - SLOW[0]) / (SLOW[1] - SLOW[0])));
  return k * k * (3 - 2 * k);
}
/** The limit where the page is (written by paceAt, read at once; no allocation): cap (vh/s), burst and lead (vh). */
const pace = {
  cap: LIMIT.rate as number,
  burst: LIMIT.burst as number,
  lead: LIMIT.lead as number,
};
/** Set `pace` for the page at scroll `page` (inside the show), and refill the budget up to now at that cap. */
function paceAt(page: number, now: number) {
  const k = slowK(page);
  pace.cap = LIMIT.rate + (LIMIT.slow - LIMIT.rate) * k;
  pace.burst = LIMIT.burst + (LIMIT.slowBurst - LIMIT.burst) * k;
  pace.lead = (LIMIT.lead * pace.cap) / LIMIT.rate;
  budget = Math.min(pace.burst, budget + (Math.max(0, now - budgetAt) / 1000) * pace.cap);
  budgetAt = now;
}
/** Where the page is, inside the show (scroll px). */
function pageY() {
  return Math.min(showEnd, Math.max(0, lenis ? lenis.animatedScroll : window.scrollY));
}
/** The budget left (viewport heights; below 0 only while a page key's debt is repaid) and when it was last refilled. */
let budget: number = LIMIT.burst;
let budgetAt = 0;
/** The direction of the last limited move (1 down, -1 up, 0 none yet). */
let lastDir = 0;
/** Scroll px where the show's limit ends: the record's top at the bottom of the screen. */
let showEnd = Number.POSITIVE_INFINITY;

/** Where the show's limit ends, in show position P (story.limitEnd: the shown position's speed limit ends there too). */
function setShowEnd(px: number) {
  showEnd = px;
  const end = story.beatPx[story.beatPx.length - 1] ?? 0;
  story.limitEnd = !Number.isFinite(px)
    ? px
    : px >= end
      ? story.beatPx.length - 1 + (px - end) / Math.max(1, window.innerHeight)
      : scrollToT(px);
}

/**
 * The visitor turned round (a notch back after a spin): what was still ahead of the page the old way is dropped, so
 * the page answers the new direction at once, and the budget is theirs again. Returns where the new move starts.
 */
function turn(s: number, from: number): number {
  const was = lastDir;
  lastDir = s;
  if (was === 0 || was === s || !lenis) return from;
  budget = Math.max(budget, LIMIT.burst);
  const page = lenis.animatedScroll;
  if ((lenis.targetScroll - page) * s < 0) {
    lenis.targetScroll = page;
    return page;
  }
  return from;
}

/** Whether a move of `d` px from `from` passes through the show (the part of the page the limit covers). */
function touchesShow(from: number, d: number) {
  return d > 0 ? from < showEnd : from + d < showEnd;
}

/**
 * How much of a move of `d` px from scroll `from` the visitor may make now: the part outside the show is free, the
 * part inside is paid from the budget (and kept within `lead` of the page); the rest is dropped. A move that cannot be
 * paid in full inside the show stops there (it never skips the end of the show). `page` (a fresh press of a page key
 * under reduced motion, where keys jump) may borrow a page against the budget; nothing else borrows, so a held key's
 * repeats are paid at the cap like a wheel.
 */
function limitMove(from: number, d: number, page = false): number {
  if (d === 0 || !touchesShow(from, d)) return d;
  const vh = Math.max(1, window.innerHeight);
  const s = d > 0 ? 1 : -1;
  const a = Math.abs(d);
  // moving up from below the show: the stretch down to its end is free
  const free0 = s < 0 ? Math.max(0, from - showEnd) : 0;
  const inside = s > 0 ? Math.min(a, showEnd - from) : a - free0;
  const free1 = a - free0 - inside;
  // where the page is (inside the show): the cap there, the burst and the lead
  const at = pageY();
  paceAt(at, performance.now());
  const have = Math.max(0, budget + (page ? LIMIT.keyDebt + LIMIT.burst - pace.burst : 0)) * vh;
  // how far the target already runs ahead of the page, inside the show (from where the paid part starts)
  const lead = s * (from + s * free0 - at);
  const room = Math.max(0, (page ? Math.max(pace.lead, inside / vh) : pace.lead) * vh - lead);
  const pay = Math.min(inside, have, room);
  budget -= pay / vh;
  return s * (free0 + pay + (pay >= inside - 0.5 ? free1 : 0));
}

/** Pinch-zoomed in (a phone's visual viewport larger than the page's): one finger pans the zoomed view there. */
function zoomedIn() {
  return (window.visualViewport?.scale ?? 1) > 1.01;
}

/** The visitor's own hands are moving the page now (the gate's scroll guard: `hands`). */
function handsOnPage() {
  const now = performance.now();
  if (hands.buttons !== 0 || hands.fingers > 0 || hands.middle) return true;
  if (now - wheelAt < HANDS_MS || now - hands.keyAt < HANDS_MS) return true;
  // a mouse at the page's right edge: its scrollbar (an overlay scrollbar takes no width and may send no press)
  return (
    hold.inside &&
    hold.pointerType !== "touch" &&
    hold.x >= Math.min(document.documentElement.clientWidth, window.innerWidth - 18)
  );
}

/**
 * Lenis's virtualScroll hook (lenis.mjs onVirtualScroll: it reads `data.deltaY` after this returns, and a `false`
 * return skips the event, default action included, so a dropped wheel event is prevented here). Wheel and trackpad,
 * and the fling at the end of a touch Lenis drives (TOUCH); pinch-zoom (ctrl), native touch, a stopped Lenis (the CV)
 * and nested scrollers pass untouched.
 */
function limitWheel(data: VirtualScrollData): boolean {
  const e = data.event;
  if (!lenis) return true;
  if (e.type.startsWith("touch")) return lenis.options.syncTouch ? limitTouch(data) : true;
  if (e.type !== "wheel") return true;
  // (one stream while its events keep coming: a gap ends it)
  const now = performance.now();
  if (now - wheelAt > STREAM_GAP) gateStream = false;
  wheelAt = now;
  if ((e as WheelEvent).ctrlKey || lenis.isStopped || data.deltaY === 0) return true;
  endGlide();
  const t = e.target as HTMLElement | null;
  if (t?.closest?.("[data-lenis-prevent], [data-lenis-prevent-wheel], dialog")) return true;
  // the first screen's gate: no further down than where it holds (what is asked beyond is dropped, never kept)
  if (data.deltaY > 0 && gateClosed()) {
    gateStream = true;
    const room = gateHold - lenis.targetScroll;
    if (room < 0.5) {
      knock(VIA.wheel);
      if (e.cancelable) e.preventDefault();
      return false;
    }
    data.deltaY = Math.min(data.deltaY, room);
  } else if (gateStream && data.deltaY > 0) {
    // the gate has just opened under a stream it was holding (a fling's momentum, a wheel still spinning as the visitor
    // clicked): its rest is dropped too, so it never carries the page past the bang; the next stream scrolls
    if (e.cancelable) e.preventDefault();
    return false;
  }
  if (story.reducedMotion) {
    // no smoothing: Lenis leaves the wheel to the browser, so inside the show the page is moved here, at once
    const from = window.scrollY;
    if (!touchesShow(from, data.deltaY)) return true;
    if (e.cancelable) e.preventDefault();
    lastDir = Math.sign(data.deltaY);
    const d = limitMove(from, data.deltaY, false);
    if (d !== 0) lenis.scrollTo(from + d, { immediate: true, force: true });
    return false;
  }
  const from = turn(Math.sign(data.deltaY), lenis.targetScroll);
  const d = limitMove(from, data.deltaY, false);
  if (d === data.deltaY) return true;
  if (Math.abs(d) < 0.5) {
    if (e.cancelable) e.preventDefault();
    return false;
  }
  data.deltaY = d;
  return true;
}

/**
 * Touch inside the show, from fig. 2 on (TOUCH_FROM, to the show's end): a one-finger gesture that starts there is
 * driven by Lenis (syncTouch, decided per gesture at touchstart in initScroll). The page follows the finger one to one
 * (a limit under the finger would leave the picture slipping under it: measured, it reads as broken), and only the
 * fling after the finger lifts is paid from the budget like a wheel's: a short coast at the cap, at most the lead,
 * glided out with Lenis's touch lerp. Native momentum carried a single flick through two screens of the solar system
 * at up to six viewport heights a second (measured). Gestures that start in fig. 1 (the hold, the address bar,
 * pull-to-refresh) or in the record, and a second finger (pinch-zoom), stay native. The gesture keeps the stage's
 * touch-action (pan-y): it scrolls only once the finger has set off up or down (TOUCH_SLOP), a sideways one stays a
 * drag on the stage and never moves the page, and a scroll cancels the stage's pointer as the browser's own pan does
 * (pointercancel: the holds let go, the drags stop, no tap).
 */
const TOUCH_FROM = F.versions;
const TOUCH_SLOP = 10;
/**
 * The gesture Lenis drives: where the finger went down, its pointer (to cancel), its axis (0 undecided, 1 y, 2 x), and
 * whether that finger is still down (the far-move cut reads it: a finger Lenis drives is never a native move).
 */
const touch = { x0: 0, y0: 0, axis: 0, pid: -1, target: null as EventTarget | null, down: false };
/** The touch is a scroll: the stage's pointer is cancelled, as the browser does when its own pan takes a finger. */
function cancelPointer() {
  if (touch.pid < 0) return;
  const el = touch.target instanceof Node && touch.target.isConnected ? touch.target : window;
  el.dispatchEvent(
    new PointerEvent("pointercancel", {
      pointerId: touch.pid,
      pointerType: "touch",
      isPrimary: true,
      bubbles: true,
    }),
  );
  touch.pid = -1;
}
/** Lenis's touch events while it drives the gesture: hold still inside the slop, sideways never scrolls, the fling paid. */
function limitTouch(data: VirtualScrollData): boolean {
  const e = data.event as TouchEvent;
  if (e.type === "touchend") return limitFling(data);
  if (e.type !== "touchmove") return true;
  const p = e.touches[0];
  if (!p) return true;
  if (touch.axis === 0) {
    const dx = p.clientX - touch.x0;
    const dy = p.clientY - touch.y0;
    if (Math.hypot(dx, dy) >= TOUCH_SLOP) {
      touch.axis = Math.abs(dy) >= Math.abs(dx) ? 1 : 2;
      if (touch.axis === 1) cancelPointer();
    }
  }
  if (touch.axis === 1) return true;
  if (e.cancelable) e.preventDefault();
  return false;
}
/** Lenis's own fling (lenis.mjs onVirtualScroll: |velocity| ** touchInertiaExponent), paid from the budget here. */
function limitFling(data: VirtualScrollData): boolean {
  if (!lenis || lenis.isStopped || data.deltaY === 0) return true;
  const v = Math.abs(lenis.velocity);
  const want = Math.sign(data.deltaY) * v ** lenis.options.touchInertiaExponent;
  const d = touchesShow(lenis.targetScroll, want) ? limitMove(lenis.targetScroll, want) : want;
  if (Math.abs(d) >= 0.5)
    lenis.scrollTo(lenis.targetScroll + d, {
      programmatic: false,
      lerp: lenis.options.syncTouchLerp,
    });
  return false;
}

/**
 * A scroll key's glide inside the show (keys move through Lenis there, not natively): the distance the key still asks
 * for (px, signed) and the page's speed (px/s). A fresh press asks for its whole step (a page, an arrow's 40 px) and
 * glides it at the cap where the page is, easing in and out (`accel`, vh/s²); a second press while it glides adds
 * nothing (input over the cap is never queued), and a held key's repeats only keep `keep` (vh) ahead, so it runs at
 * the cap while held and stops within a fraction of a second of the key's release. The wheel, a touch, a jump or
 * another key ends it; past the show's end the rest is free (Lenis glides it, as it does any key below the show).
 */
const GLIDE = { accel: 8, keep: 0.1 } as const;
const glide = { left: 0, v: 0 };
function endGlide() {
  glide.left = 0;
  glide.v = 0;
}
function keyGlide(step: number, repeat: boolean) {
  const vh = Math.max(1, window.innerHeight);
  const s = step > 0 ? 1 : -1;
  if (glide.left * s < 0) endGlide();
  // (a repeat keeps the glide `keep` ahead whatever the key: an arrow's 40 px would hold it under the cap of figs 1-3,
  // a page would leave a page to glide after the key is let go)
  const ask = repeat ? GLIDE.keep * vh : Math.abs(step);
  glide.left = s * Math.max(Math.abs(glide.left), ask);
}
function stepGlide(dt: number) {
  if (glide.left === 0) return;
  if (!lenis || lenis.isStopped) return endGlide();
  const from = lenis.targetScroll;
  if (!touchesShow(from, glide.left)) {
    lenis.scrollTo(from + glide.left, { programmatic: false, lerp: 0.1 });
    return endGlide();
  }
  const vh = Math.max(1, window.innerHeight);
  paceAt(pageY(), performance.now());
  const a = GLIDE.accel * vh;
  const left = Math.abs(glide.left);
  // below the show (moving up out of the record) the glide is not held to the cap
  const vMax = Math.min(
    lenis.animatedScroll > showEnd ? Number.POSITIVE_INFINITY : pace.cap * vh,
    Math.sqrt(2 * a * left),
  );
  glide.v = Math.min(vMax, glide.v + a * dt);
  const d = Math.min(left, glide.v * dt) * (glide.left > 0 ? 1 : -1);
  lenis.scrollTo(from + d, { programmatic: false, lerp: 0.1 });
  const moved = lenis.targetScroll - from;
  // (the page's end: nothing left to glide)
  if (Math.abs(moved) < 0.01 && Math.abs(d) >= 0.01) return endGlide();
  glide.left = Math.abs(glide.left - moved) < 0.5 ? 0 : glide.left - moved;
  if (glide.left === 0) glide.v = 0;
  // what the glide moves is paid like a wheel's, so mixing wheel and keys keeps the cap
  budget = Math.max(0, budget - Math.abs(moved) / vh);
  wake(300);
}

/** Inside the show, the scroll keys move through Lenis under the same cap: the step (px) a key asks for, or 0. */
function keyStep(e: KeyboardEvent): number {
  if (e.ctrlKey || e.metaKey) return 0;
  const t = e.target as HTMLElement | null;
  if (
    t?.closest?.(
      "input, textarea, select, [contenteditable], dialog, [role=slider], [role=listbox]",
    )
  )
    return 0;
  const vh = window.innerHeight;
  const page = Math.max(vh * 0.875, vh - 40);
  // Option+arrow is the Mac's page key: a page, under the same budget
  if (e.altKey)
    return e.shiftKey ? 0 : e.key === "ArrowDown" ? page : e.key === "ArrowUp" ? -page : 0;
  switch (e.key) {
    case " ":
      // Space on a button (the hold key, the CV, the motion toggle) presses it
      if (
        t?.closest?.(
          "button, summary, [role=button], [role=checkbox], [role=switch], [role=tab], [role=menuitem]",
        )
      )
        return 0;
      return e.shiftKey ? -page : page;
    case "PageDown":
      return e.shiftKey ? 0 : page;
    case "PageUp":
      return e.shiftKey ? 0 : -page;
    case "ArrowDown":
      return e.shiftKey ? 0 : 40;
    case "ArrowUp":
      return e.shiftKey ? 0 : -40;
    default:
      return 0;
  }
}

export function initScroll() {
  // a reload starts at the top (the inline boot script set this before the first paint; this keeps it so)
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch {
    // ignore
  }
  lenis = new Lenis({
    autoRaf: false,
    lerp: story.reducedMotion ? 1 : 0.1,
    smoothWheel: !story.reducedMotion,
    syncTouch: false,
    anchors: false,
    respectReducedMotion: false,
    virtualScroll: limitWheel,
  });
  touched = false;
  budget = LIMIT.burst;
  budgetAt = performance.now();
  endGlide();
  measureBeats();

  // the layout the markers were measured in (the resize observer below moves these when it measures again)
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  let lastDocH = document.documentElement.scrollHeight;

  deepDone = false;
  lenis.on("scroll", (l: Lenis) => {
    // The first screen's gate holds the page against a native move the visitor's hands make (the scrollbar dragged, a
    // middle-click's autoscroll, a selection dragged past the edge, the browser's own keys): back where it holds, at
    // once, before the show reads the new place (this re-enters with the held place). A native move no hand on the page
    // made is an explicit one, as a link is (find in page, a screen reader's cursor, #work typed in the address): it
    // passes the gate, and the far-move fade takes the show there (the sky freed quietly where it lands). Scrolling up
    // lowers the hold.
    if (flight) {
      const now = performance.now();
      if (now - flightAt > FLIGHT_MS) flight = false;
      else flightAt = now;
    }
    if (gateClosed()) {
      if (l.scroll > gateHold + 1) {
        if (flight || handsOnPage()) {
          knock(VIA.bar);
          l.scrollTo(gateHold, { immediate: true, force: true });
          return;
        }
        gate.passed = true;
      } else if (l.scroll < gateHold) gateHold = Math.max(0, l.scroll);
    }
    setScroll(l.scroll);
    // back in the show by hand (the record's top below the screen) after a deep link: a reload from here starts over
    if (hashed && deepDone && l.scroll < showEnd) dropHash();
    // (a scroll while the viewport is not the one measured is the resize's own: the browser clamping the page)
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) {
      goodY = l.scroll;
      goodP = story.T + story.afterT;
    }
    wake(300);
  });
  setScroll(window.scrollY);
  syncShown();
  goodY = window.scrollY;
  goodP = story.T + story.afterT;

  const unFrame = addFrame((time, dt) => {
    stepGlide(dt);
    lenis?.raf(time * 1000);
  }, -10);

  // A move that runs ahead of the show's pace (Home, End, a scrollbar drag, a phone's native fling, Tab into the
  // record): the shown position never plays faster than VMAX (story.ts), so the page runs ahead of it; once it is FAR
  // ahead the show holds still, fades to night, waits for the page to calm, and comes back at the new place (as a far
  // link jump does). The wheel and the keys are limited at the input and never trail by this much. A move Lenis drives
  // (a wheel's or a key's glide, an explicit near glide, a finger from fig. 2 on and its paid fling) may trail more
  // before it cuts (FAR_SMOOTH: a finger is followed one to one, so a hard swipe can outrun the pace for a moment), and
  // the lag it leaves drains at that allowance (`drain`) unless the page runs on ahead again on its own.
  const FAR = 0.5;
  const FAR_SMOOTH = 1.1;
  speedY = window.scrollY;
  pageSpeed = 0;
  /** The lag a Lenis-driven move left, while it drains (0: none, or the page moved ahead again natively). */
  let drain = 0;
  const unFar = addFrame((_t, dt) => {
    const y = lenis ? lenis.scroll : window.scrollY;
    const vh = Math.max(1, window.innerHeight);
    const v = dt > 0 ? Math.abs(y - speedY) / vh / dt : 0;
    speedY = y;
    pageSpeed += (v - pageSpeed) * (1 - Math.exp(-dt * (v > pageSpeed ? 30 : 8)));
    if (cutting || story.reducedMotion) {
      drain = 0;
      return;
    }
    const P = story.Ts + story.after;
    if (Math.min(P, story.T + story.afterT) >= story.limitEnd) {
      drain = 0;
      return;
    }
    const L = lag();
    const driven =
      lenis?.isScrolling === "smooth" || (touch.down && lenis?.options.syncTouch === true);
    if (driven) drain = L;
    else if (L <= drain + 0.02) drain = Math.min(drain, L);
    else drain = 0;
    if (L < (driven || drain > 0 ? FAR_SMOOTH : FAR)) return;
    drain = 0;
    story.freeze = true;
    cut(() => syncStory(lenis ? lenis.scroll : window.scrollY), true);
  }, -8);

  // (a wheel the closed gate dropped moved nothing: a deep link still waiting for the fonts is still honoured)
  const markTouched = () => {
    if (!gateClosed()) touched = true;
  };

  // ---- the first screen's gate (src/lib/gate.ts): its class (touch-action, overscroll-behavior: globals.css), a
  // finger's swipe held, Tab into the record let through
  const root = document.documentElement;
  gate.armed = true;
  gateHold = Math.max(0, window.scrollY);
  gateStream = false;
  keyStream = false;
  // (a button already down as the gate takes over, a scrollbar dragged while the page loaded, or a scroll still gliding:
  // the boot script saw them)
  const bootPtr = (window as unknown as { __nuqtaPointer?: { b?: number; s?: number } })
    .__nuqtaPointer;
  hands.buttons = bootPtr?.b ?? 0;
  flightAt = bootPtr?.s ?? -1e9;
  flight = performance.now() - flightAt < FLIGHT_MS;
  hands.fingers = 0;
  hands.middle = false;
  // (the inline boot script held the page while the stage loaded: from here the gate does, src/app/page.tsx)
  (window as unknown as { __nuqtaUnhold?: () => void }).__nuqtaUnhold?.();
  let gatedOn = false;
  const unGate = addFrame(() => {
    // (not under the open CV sheet: its own scroll is the visitor's there; not while pinch-zoomed in, where one finger
    // pans the zoomed view: the scroll guard still holds the page itself)
    const on = gateClosed() && !lenis?.isStopped && !zoomedIn();
    if (on === gatedOn) return;
    gatedOn = on;
    root.classList.toggle("gated", on);
    // closed again where the page already is (the motion toggle back from the printed journal): held from there
    if (on) gateHold = Math.max(0, lenis ? lenis.scroll : window.scrollY);
  }, -9);
  /** A finger at the closed gate never pans the page (a phone where touch-action cannot say so: html.gated). */
  const onGateTouch = (e: TouchEvent) => {
    if (e.touches.length !== 1 || !gateClosed() || lenis?.isStopped || zoomedIn()) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("dialog, [data-lenis-prevent], [data-lenis-prevent-touch]")) return;
    const p = e.touches[0];
    const dy = p ? Math.abs(p.clientY - touch.y0) : 0;
    // (a tap on a link that trembles a little is still a tap: only a real move on a control is held)
    if (e.cancelable && (dy > 6 || !t?.closest?.("a, button, [role=button], label, summary")))
      e.preventDefault();
    // (a tap that wanders a little is still the tap that begins: src/lib/hold.ts; a swipe beyond it is an attempt)
    if (dy > HOLD.tapTouchPx) knock(VIA.touch);
  };
  window.addEventListener("touchmove", onGateTouch, { passive: false, capture: true });
  // the visitor's hands (the scroll guard reads them: handsOnPage)
  const onHandDown = (e: PointerEvent) => {
    hands.buttons = e.buttons;
    hands.middle = e.pointerType === "mouse" && e.button === 1;
  };
  const onHandUp = (e: PointerEvent) => {
    hands.buttons = e.type === "pointercancel" ? 0 : e.buttons;
  };
  const onHandMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") hands.buttons = e.buttons;
  };
  const onFingers = (e: TouchEvent) => {
    hands.fingers = e.touches.length;
  };
  const onKeyUp = () => {
    keyStream = false;
  };
  window.addEventListener("pointerdown", onHandDown, { passive: true, capture: true });
  window.addEventListener("pointerup", onHandUp, { passive: true, capture: true });
  window.addEventListener("pointercancel", onHandUp, { passive: true, capture: true });
  window.addEventListener("pointermove", onHandMove, { passive: true, capture: true });
  for (const t of ["touchstart", "touchend", "touchcancel"] as const)
    window.addEventListener(t, onFingers, { passive: true, capture: true });
  window.addEventListener("keyup", onKeyUp);
  // Tab into the record is the keyboard's way there (an explicit move, as a link is): the gate lets it pass
  const recordEl = document.getElementById("record");
  const onFocusIn = (e: FocusEvent) => {
    if (gateClosed() && recordEl && e.target instanceof Node && recordEl.contains(e.target))
      gate.passed = true;
  };
  document.addEventListener("focusin", onFocusIn);
  window.addEventListener("wheel", markTouched, { passive: true });
  // TOUCH: Lenis drives a one-finger gesture that starts inside the show from fig. 2 on (decided here, in the capture
  // phase, before Lenis's own touchstart listener reads it); everything else stays native
  const onTouchStart = (e: TouchEvent) => {
    touched = true;
    endGlide();
    if (!lenis) return;
    const p = e.touches[0];
    touch.x0 = p ? p.clientX : 0;
    touch.y0 = p ? p.clientY : 0;
    touch.axis = 0;
    const y = lenis.isScrolling === "smooth" ? lenis.animatedScroll : window.scrollY;
    const t = e.target as HTMLElement | null;
    lenis.options.syncTouch =
      !story.reducedMotion &&
      !lenis.isStopped &&
      e.touches.length === 1 &&
      y < showEnd &&
      scrollToT(y) >= TOUCH_FROM &&
      !t?.closest?.("[data-lenis-prevent], [data-lenis-prevent-touch], dialog, #record");
    touch.down = lenis.options.syncTouch;
  };
  window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) touch.down = false;
  };
  window.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });
  // (the finger's pointer, which a scroll cancels: pointerdown comes before touchstart)
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || !e.isPrimary) return;
    touch.pid = e.pointerId;
    touch.target = e.target;
  };
  window.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });

  const onKey = (e: KeyboardEvent) => {
    // (any key ends a middle-click's autoscroll; a scroll key is the visitor's hand on the page for a moment)
    hands.middle = false;
    if (SCROLL_KEYS.has(e.key) || endKey(e)) hands.keyAt = performance.now();
    if (!e.repeat) keyStream = false;
    // The first screen's gate: a key that would take the page on (a page, an arrow, Space, End) stays here, and the
    // show answers it (the hold key, Space or Enter on it, is the keyboard's way through: src/bridges/show-dom.ts)
    if (
      lenis &&
      !e.defaultPrevented &&
      !lenis.isStopped &&
      gateClosed() &&
      (keyStep(e) > 0 || endKey(e))
    ) {
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.("input, textarea, select, [contenteditable], dialog")) {
        e.preventDefault();
        keyStream = true;
        knock(VIA.key);
        wake(600);
        return;
      }
    }
    // (a key the gate was holding, still held as the gate opens: its repeats are dropped until it is let go)
    if (keyStream && e.repeat && !gateClosed() && (keyStep(e) > 0 || endKey(e))) {
      e.preventDefault();
      return;
    }
    touched = true;
    if (!lenis || e.defaultPrevented) return;
    // Inside the show a scroll key glides through Lenis at the speed limit (GLIDE; held keys included). Under reduced
    // motion it jumps, paid from the budget (a fresh page key may borrow a page). Home and End stay native (the far-move
    // fade).
    const step = lenis.isStopped ? 0 : keyStep(e);
    if (step !== 0 && touchesShow(lenis.targetScroll, step)) {
      e.preventDefault();
      if (story.reducedMotion) {
        const from = window.scrollY;
        lastDir = Math.sign(step);
        const d = limitMove(from, step, !e.repeat && Math.abs(step) > 100);
        if (d !== 0) lenis.scrollTo(from + d, { immediate: true, force: true });
      } else {
        // (turning round drops what the old direction still had ahead of the page, so the key answers at once)
        turn(Math.sign(step), lenis.targetScroll);
        keyGlide(step, e.repeat);
      }
      wake(600);
      return;
    }
    // (a scroll key the glide does not take, Home or End: it gives way)
    if (SCROLL_KEYS.has(e.key)) endGlide();
    // Below the show: a scroll key pressed while Lenis is still gliding (a link jump, the wheel's smoothing) would be
    // overwritten by the glide's next frame: the glide gives way, and the browser scrolls natively from where it is.
    if (lenis.isScrolling !== "smooth" || !SCROLL_KEYS.has(e.key)) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input, textarea, select, [contenteditable], dialog")) return;
    lenis.stop();
    lenis.start();
  };
  window.addEventListener("keydown", onKey);

  // ---- resize: keep the visitor's place in the story, not in pixels
  // Figures are viewport heights long, so a new height moves every marker: the show keeps its position P. The record
  // is ordinary flow that reflows: it keeps the element at the top of the screen where it was. By the time a resize is
  // reported the layout is already new, so where the visitor was is read from what was known before it: story time
  // (still mapped through the old markers), the record's old top, and the element remembered at the last rest.
  const record = document.getElementById("record");
  let recTop = record ? docTop(record) : Number.POSITIVE_INFINITY;
  setShowEnd(recTop - window.innerHeight);
  /** Inside the record, at the last rest: the first element on screen and its top (viewport px), at this scroll. */
  let restEl: HTMLElement | null = null;
  let restElTop = 0;
  let restAt = -1;
  let rested = false;
  const remember = () => {
    restEl = null;
    const y = window.scrollY;
    if (!record || y < recTop) return;
    // the first of the record's small blocks (a heading, a plate, a role) that starts on screen; else the one across
    // the screen's top; its sections only past the last of them
    let across: HTMLElement | null = null;
    let acrossTop = 0;
    for (const sel of ["[data-reveal]", "section, footer"]) {
      for (const el of record.querySelectorAll<HTMLElement>(sel)) {
        const t = docTop(el) - y;
        if (t + el.offsetHeight <= 0) continue;
        if (t >= -8) {
          restEl = el;
          restElTop = t;
          restAt = y;
          return;
        }
        if (!across) {
          across = el;
          acrossTop = t;
        }
      }
      if (across) {
        restEl = across;
        restElTop = acrossTop;
        restAt = y;
        return;
      }
    }
  };
  const unRest = addFrame(() => {
    if (story.rest > 0.15) {
      // (rest begins in the glide's last pixels: remember again if the page crept on since)
      if (!rested || (restEl && Math.abs(window.scrollY - restAt) >= 1)) remember();
      rested = true;
    } else rested = false;
  }, 8);

  /** Saved before the layout is measured again: show position P, or the record's element and offset. */
  let savedP = 0;
  let savedRec = -1;
  let savedEl: HTMLElement | null = null;
  let savedElTop = 0;
  let pending = 0;
  const save = () => {
    const y = goodY;
    savedP = goodP;
    savedRec = y >= recTop ? y - recTop : -1;
    savedEl = savedRec >= 0 && restEl && Math.abs(restAt - y) < 1 ? restEl : null;
    savedElTop = restElTop;
  };
  const restore = () => {
    pending = 0;
    measureBeats();
    lenis?.resize();
    recTop = record ? docTop(record) : Number.POSITIVE_INFINITY;
    setShowEnd(recTop - window.innerHeight);
    let y = savedEl
      ? docTop(savedEl) - savedElTop
      : savedRec >= 0
        ? recTop + savedRec
        : tToScroll(savedP);
    y = Math.max(
      0,
      Math.min(Math.max(0, document.documentElement.scrollHeight - window.innerHeight), y),
    );
    if (lenis && Math.abs(lenis.scroll - y) > 0.5)
      lenis.scrollTo(y, { immediate: true, force: true });
    else if (!lenis && Math.abs(window.scrollY - y) > 0.5) window.scrollTo(0, y);
    syncStory(y);
    if (savedEl) remember();
    wake(400);
  };
  const remeasure = () => {
    // a live window drag reports every frame: keep the place saved at its start, apply once per frame
    if (!pending) {
      save();
      pending = requestAnimationFrame(restore);
    }
  };
  const ro = new ResizeObserver(() => {
    // Ignore the mobile URL bar: only react to width changes, large height changes or a new document height.
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (
      w === lastW &&
      Math.abs(h - lastH) < 120 &&
      document.documentElement.scrollHeight === lastDocH
    )
      return;
    lastW = w;
    lastH = h;
    lastDocH = document.documentElement.scrollHeight;
    remeasure();
  });
  ro.observe(document.body);

  // A deep link (#work …) is an explicit request: honour it once the fonts have settled the layout.
  const hash = location.hash.slice(1);
  const deep = hash && document.getElementById(hash) ? hash : "";
  const settled = () => {
    if (pending) {
      cancelAnimationFrame(pending);
      pending = 0;
    }
    save();
    restore();
    if (deep && !touched) jumpTo(deep, { immediate: true });
    deepDone = true;
  };
  if (document.fonts) document.fonts.ready.then(settled);
  else settled();

  const unLinks = initLinks();

  // The in-page motion toggle and the OS setting can change at any time.
  const onMotion = () => {
    if (!lenis) return;
    lenis.options.lerp = story.reducedMotion ? 1 : 0.1;
    lenis.options.smoothWheel = !story.reducedMotion;
  };
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("motionpreference", onMotion);
  mq.addEventListener("change", onMotion);
  queueMicrotask(onMotion);

  return () => {
    unFrame();
    unFar();
    unRest();
    unGate();
    gate.armed = false;
    root.classList.remove("gated");
    window.removeEventListener("touchmove", onGateTouch, { capture: true });
    window.removeEventListener("pointerdown", onHandDown, { capture: true });
    window.removeEventListener("pointerup", onHandUp, { capture: true });
    window.removeEventListener("pointercancel", onHandUp, { capture: true });
    window.removeEventListener("pointermove", onHandMove, { capture: true });
    for (const t of ["touchstart", "touchend", "touchcancel"] as const)
      window.removeEventListener(t, onFingers, { capture: true });
    window.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("focusin", onFocusIn);
    if (pending) cancelAnimationFrame(pending);
    ro.disconnect();
    window.removeEventListener("wheel", markTouched);
    window.removeEventListener("touchstart", onTouchStart, { capture: true });
    window.removeEventListener("touchend", onTouchEnd, { capture: true });
    window.removeEventListener("touchcancel", onTouchEnd, { capture: true });
    touch.down = false;
    window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    touch.target = null;
    window.removeEventListener("keydown", onKey);
    unLinks();
    window.removeEventListener("motionpreference", onMotion);
    mq.removeEventListener("change", onMotion);
    lenis?.destroy();
    setShowEnd(Number.POSITIVE_INFINITY);
    lenis = null;
  };
}

/**
 * QA and deep links: jump straight to story time T (no flight, no damping). T beyond the last figure adds viewport
 * heights past it (T = 12.5 is half a viewport into the ending, after the sky's own screen).
 */
export function jumpToT(T: number) {
  const y = Math.min(
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    tToScroll(T),
  );
  if (y > gateHold + 1) gate.passed = true;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
  syncStory(y);
}
