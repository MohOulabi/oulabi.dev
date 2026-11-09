import { shared } from "@/gl/shared";
import { addFrame, wake } from "./clock";
import { gateClosed, knock, VIA } from "./gate";
import { BEATS, F, HOLD_KIND, holdKind } from "./journey";
import { HOLD } from "./show";
import { lag, scrollToT, story } from "./story";

/**
 * Fig. 1's "This one is yours." (BEATS.point.yours). On a staged visit that starts at the top the page cannot be
 * scrolled past the first screen until the visitor lets the light go themselves (src/lib/gate.ts): their hold makes the
 * big bang, a click, a tap or a press of the hold key a smaller one (`click`). One who arrives past here (a deep link,
 * an explicit jump, a far-move cut; a reload always lands at the top, src/app/page.tsx) finds it already let go
 * (`quiet`: freed as a deep link is, nothing played). Only where the gate is open with the light still waiting (an
 * explicit near jump's glide, the flow layout of reduced motion where the stage does not play) can a move on past here
 * without a gesture still let it go (`gentle`). Where exactly is freeT().
 */
export const FREE_AT = F.point + BEATS.point.yours[0];
/**
 * The scroll never lets the light go within this of the top (CSS px), whatever the screen's height: a wheel's one
 * notch (100 px in Chrome and Edge on Windows, a little more on a scaled display) is more than FREE_AT of a laptop's
 * short screen (92 px at 768 px tall), and one notch is not a scroll on past the line (no first-wheel trigger). Two
 * notches are.
 */
const FREE_PX = 180;
/** Story time where the visitor's scroll lets the light go: FREE_AT, and never within FREE_PX of the top. */
function freeT() {
  return Math.max(FREE_AT, scrollToT((story.beatPx[0] ?? 0) + FREE_PX));
}
/**
 * Shown position crossed in one frame that is an arrival, not the visitor's scroll (a cut landing, a jump): the shown
 * position moves at most the journey's pace (story.ts VMAX) otherwise, a fortieth of a figure a frame.
 */
const ARRIVE_JUMP = 0.25;
/**
 * The release is decided on the shown position (what the visitor sees), and only once the show is where the page is:
 * shown within FREE_LAG of the scroll and the page under FREE_V figures a second. A page running ahead of the journey's
 * pace (a phone's native flick from the top) may yet be cut through the far-move fade (src/lib/scroll.ts), and the
 * light is never let go behind the veil: such a move lands as an arrival (quiet). Past FREE_LATE it is decided as it
 * is, so the gentle release still plays inside fig. 1.
 */
const FREE_LAG = 0.25;
const FREE_V = 2;
const FREE_LATE = F.point + 0.6;

/**
 * Press-and-hold, the visitor's gestures and the big bang (docs/STORY.md, Fig. 1: "You bring the point"). The DOM owns
 * the input (pointer/touch, the hold ring, the keyboard's hold key) and writes here; the WebGL show reads it every
 * frame (the holds of figs. 1, 5 and 9, the drags, the clicks).
 *
 * Input rules: the hold is a stationary long-press (HOLD.longPressMs, cancelled beyond HOLD.cancelPx of travel)
 * anywhere on the stage that is not a control, and only where a figure answers one (journey HOLDS, holdKind): fig.
 * 1 before the bang, fig. 3 once a knot is chosen, fig. 5's pull, fig. 9's push against the storm, fig. 10's flock.
 * Elsewhere a press stays a press (a drag, a click). The ring fills over HOLD.fullMs while the hold is answered
 * (`live`); release fires the bang. The bang never fires by itself: no timer, no wheel. Only the visitor fires it: the
 * release of their hold (the big bang), or before it their click, tap or quick press of the hold key (a smaller bang,
 * CLICK_BANG in ./show.ts), and the ?bang=1 QA switch. The scroll is held at the first screen until then
 * (src/lib/gate.ts, src/lib/scroll.ts); nothing here calls preventDefault on wheel or touch.
 *
 * At the gate a press is read as a hand makes it (HOLD.tapPx, tapTouchPx, settlePx): a press that drifts as it settles
 * is not given up, it becomes the hold once it rests (the long-press counts again from there); a click or a tap that
 * wanders a little is still a click, however long the finger stayed; a press that wandered off into a drag is answered
 * as a scroll attempt is (gate.ts knock). Whatever the visitor does there, something answers. A hold only begins once
 * the stage is drawing (a press made while it loads becomes the hold when it is), and a click made while it loads is
 * kept: its bang comes as the stage appears (pendingClick).
 */
export const hold = {
  /** Pointer in CSS px and NDC (-1..1, y up). */
  x: 0,
  y: 0,
  nx: 0,
  ny: 0,
  /** 0..1 pointer activity, damped by the show. Set to 1 on move. */
  moving: 0,
  lastMove: 0,
  /** Pointer velocity in CSS px per second (damped, decays to 0 when the pointer rests). */
  vx: 0,
  vy: 0,
  /** A pointer button or finger is down on the stage (any duration: drags read this). */
  down: false,
  /** The visitor is holding (after the stationary long-press threshold, where a figure answers a hold). */
  pressing: false,
  /** Holding, and a figure answers it now (the window it began in may have closed under a scroll since): the ring and
   *  the score follow this. */
  live: false,
  /** Hold progress 0..1 (fills over HOLD.fullMs while pressing, eases back once released). */
  k: 0,
  /** Hold progress at the moment of the last release (the bang's strength). */
  kRelease: 0,
  /** performance.now() of the last release of a hold (-1 before any): flock bursts and the like. */
  releaseAt: -1,
  /**
   * performance.now() of the bang (-1 until it happens). Plays once per visit (scrolling back up keeps the field
   * freed); only starting over (rearmHold) gives the light back to the sky.
   */
  bangAt: -1,
  /**
   * The bang was spent without being played: the visitor arrived past FREE_AT (a reload, a deep link, a restored
   * position). The show frees the sky as it does for a deep link (no crush, no blast, no flash) and the score stays
   * silent; the DOM still treats it as the bang (the first line has left, "This one is yours." follows).
   */
  quiet: false,
  /**
   * The visitor's scroll let the light go (on past FREE_AT without a gesture, only where the gate is never closed): the
   * show draws the sky into the point as for a short hold, then bursts gently (a soft flash and ring).
   */
  gentle: false,
  /**
   * The visitor let it go with a click, a tap or a quick press of the hold key (the first screen's gate): the sky is
   * drawn into the point quickly, then a smaller bang than the hold's (CLICK_BANG in ./show.ts), still the visitor's own.
   */
  click: false,
  /**
   * It was let go in the printed journal (reduced motion: the stage was not drawing, the scroll on past the line let it
   * go): the stage, when motion comes back, finds the sky already freed and plays nothing (as for `quiet`).
   */
  printed: false,
  /** NDC point the bang happened at (where the sky was crushed). */
  bx: 0,
  by: 0,
  /** A click/tap that is not a hold (ripples in the field, flock bursts): performance.now() and NDC. */
  tapAt: -1,
  tx: 0,
  ty: 0,
  /** "mouse" | "touch" | "pen" of the last pointer seen ("" before any). */
  pointerType: "" as string,
  /** The pointer is over the page (false after it leaves the window). */
  inside: false,
  /**
   * The pointer is over the stage, not over a control (a link, a button, the record): the stage's gestures only start
   * there, so the hint ring only invites there.
   */
  overStage: true,
};

/**
 * Fire the bang (once per visit): by the visitor's release (""), their click (`click`), the ?bang=1 QA switch, or `how`
 * the scroll let it go.
 */
export function triggerBang(
  nx = hold.nx,
  ny = hold.ny,
  how: "" | "quiet" | "gentle" | "click" = "",
) {
  if (hold.bangAt >= 0) return;
  hold.bangAt = performance.now();
  hold.quiet = how === "quiet";
  hold.gentle = how === "gentle";
  hold.click = how === "click";
  hold.printed = story.reducedMotion;
  hold.bx = nx;
  hold.by = ny;
  hold.pressing = false;
  pendingClick = false;
  wake(4000);
  // (the visitor's own release or click: the music starts with it)
  if (how === "" || how === "click") gateGesture();
}

/** The input writer's own per-visit state (startHold sets it), re-armed. */
let rearmInput: (() => void) | null = null;
/** A hold made with the hold key is in progress (its key-up or blur ends only that hold, never a pointer's). */
let keyHolding = false;
/** When the hold key went down (a press shorter than HOLD.longPressMs before the bang is a click, not a hold). */
let keyDownAt = 0;
/**
 * A click (a tap, a quick press of the hold key) made at the gate while the stage was still loading, where and when: it
 * is the visitor's start all the same, so its bang comes as soon as the stage is drawn (REVEAL_MS after it is ready, so
 * the sky is seen before it is drawn in). A stage that is still not drawing STAGE_WAIT_MS after the click (it failed)
 * never keeps the visitor waiting: the light is let go quietly and the page opens. A new press, an explicit jump or
 * Start over forgets it.
 */
let pendingClick = false;
let pendingX = 0;
let pendingY = 0;
let pendingAt = 0;
const REVEAL_MS = 300;
const STAGE_WAIT_MS = 6000;

/**
 * The visitor's own gesture at the first screen (fig. 1 before the bang): a hold beginning, or the light let go by their
 * hold or click (a click made while the stage loads too). src/audio starts the music with it: at the closed gate
 * nothing else does, so the music never plays while the page still waits for the visitor.
 */
const gestureFns = new Set<() => void>();
export function onGateGesture(fn: () => void) {
  gestureFns.add(fn);
  return () => {
    gestureFns.delete(fn);
  };
}
function gateGesture() {
  for (const fn of gestureFns) fn();
}

/** Fig. 1 before the bang: a press here gathers the light, and its release or its click lets it go. */
function atGate() {
  return hold.bangAt < 0 && holdNow() === HOLD_KIND.gather;
}

/**
 * Start over (src/lib/restart.ts, src/lib/scroll.ts startOver): the light back in the sky, the bang not happened, no
 * hold under way; only the visitor's own gesture (a hold, a click) lets it go again (the gate is closed again with
 * it). Runs in the dark of the cut, with the page already at the top. The pointer (where it is, whether it is over the
 * page) and the last tap are kept: they are the visitor's hand, not the visit.
 */
export function rearmHold() {
  hold.down = false;
  hold.pressing = false;
  hold.live = false;
  hold.quiet = false;
  hold.gentle = false;
  hold.click = false;
  hold.printed = false;
  keyHolding = false;
  hold.k = 0;
  hold.kRelease = 0;
  hold.releaseAt = -1;
  hold.bangAt = -1;
  hold.bx = 0;
  hold.by = 0;
  hold.vx = 0;
  hold.vy = 0;
  pendingClick = false;
  document.documentElement.classList.remove("holding");
  rearmInput?.();
}

function tap(nx: number, ny: number) {
  hold.tapAt = performance.now();
  hold.tx = nx;
  hold.ty = ny;
  wake(2500);
}

/** The stage takes input until the record has risen over it. */
export function inShow() {
  return story.after < 0.92 && !story.reducedMotion;
}

/** The hold a press answers here and now (journey HOLD_KIND; none outside the figures' hold windows). */
export function holdNow() {
  return holdKind(story.Ts, hold.bangAt >= 0, shared.play.center);
}

const CONTROL =
  "a, button, input, textarea, select, label, summary, dialog, [role=button], [role=link], [data-no-hold]";

function onStage(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el?.closest) return true;
  if (el.closest("[data-hold-ok]")) return true;
  return !el.closest(CONTROL) && !el.closest("#record");
}

/** Where the pointer is, in CSS px (NDC follows). */
export function setPointer(x: number, y: number) {
  hold.x = x;
  hold.y = y;
  hold.nx = (x / Math.max(1, window.innerWidth)) * 2 - 1;
  hold.ny = 1 - (y / Math.max(1, window.innerHeight)) * 2;
}

/** A hold let go: the bang (before it; `quick`, a press of the hold key too short to be a hold, makes the click's). */
function release(now: number, quick = false) {
  if (!hold.pressing) return;
  hold.pressing = false;
  hold.kRelease = hold.k;
  hold.releaseAt = now;
  document.documentElement.classList.remove("holding");
  triggerBang(hold.nx, hold.ny, quick ? "click" : "");
  wake(2500);
}

/**
 * Fig. 1 before the bang: a click or a tap on the stage lets the light go too (the first screen's gate: a single click
 * is enough), a smaller bang than the hold's. A click made while the stage is still loading is kept
 * (pendingClick) and plays as soon as the stage is drawn; the music starts with the click itself.
 */
function clickBang() {
  if (!atGate()) return;
  if (!shared.ready) {
    pendingClick = true;
    pendingX = hold.nx;
    pendingY = hold.ny;
    pendingAt = performance.now();
    gateGesture();
    wake(600);
    return;
  }
  triggerBang(hold.nx, hold.ny, "click");
}

/** The hold key's press becomes the hold, once the stage is drawing (until then it waits: startHold's frame). */
function pressKey() {
  if (!keyHolding || hold.pressing || !shared.ready || !inShow() || holdNow() === HOLD_KIND.none)
    return;
  hold.pressing = true;
  document.documentElement.classList.add("holding");
  if (atGate()) gateGesture();
  wake(600);
}

/**
 * Keyboard hold (the hold button): Space down gathers at the last pointer position, Space up lets go. Before the bang
 * a press shorter than a long-press is the keyboard's click (the smaller bang), a longer one the hold's.
 */
export function keyHold(on: boolean) {
  if (on) {
    if (hold.pressing || keyHolding || !inShow() || holdNow() === HOLD_KIND.none) return;
    if (!hold.inside) setPointer(window.innerWidth / 2, window.innerHeight / 2);
    keyHolding = true;
    keyDownAt = performance.now();
    hold.down = true;
    pendingClick = false;
    pressKey();
    wake(600);
  } else {
    // (the hold key loses focus when the visitor presses on the stage: that blur must not end their pointer's hold)
    if (!keyHolding) return;
    keyHolding = false;
    hold.down = false;
    const now = performance.now();
    const quick = hold.bangAt < 0 && now - keyDownAt < HOLD.longPressMs;
    if (hold.pressing) release(now, quick && shared.ready);
    // (pressed and let go while the stage was still loading: the keyboard's click, kept until it is drawn)
    else if (atGate()) clickBang();
  }
}

/** Attach the input writer. Returns a cleanup. */
export function startHold() {
  let downAt = 0;
  let downX = 0;
  let downY = 0;
  /** Where the press last came to rest (at the gate a drift moves it; elsewhere it is where the press went down). */
  let restX = 0;
  let restY = 0;
  /** The furthest the press has wandered from where it went down (px). */
  let maxTravel = 0;
  let downId = -1;
  let travelled = false;
  let timer = 0;
  /** The press has been held still past the long-press threshold (it becomes a hold where one is answered). */
  let longPress = false;
  let lastT = 0;
  let lastX = -1;
  let lastY = -1;
  let lastTarget: EventTarget | null = null;
  /** The shown position P = Ts + after on the last frame (-1 before the first). */
  let lastP = -1;
  /** The scroll's position P = T + afterT on the last frame (-1 before the first), and its speed (figures/s, eased). */
  let lastPt = -1;
  let pageV = 0;
  /** When the stage was first seen drawing (performance.now(); -1 before): a click kept from the load plays after it. */
  let readyAt = -1;

  // the inline boot script followed the pointer before hydration: start from where it is
  const boot = (window as unknown as { __nuqtaPointer?: { x: number; y: number; seen: boolean } })
    .__nuqtaPointer;
  if (boot?.seen) {
    setPointer(boot.x, boot.y);
    hold.inside = true;
    hold.pointerType = document.documentElement.classList.contains("has-pointer")
      ? "mouse"
      : "touch";
  } else setPointer(window.innerWidth / 2, window.innerHeight / 2);

  const begin = () => {
    timer = 0;
    if (!hold.down || travelled) return;
    longPress = true;
    tryHold();
  };
  /**
   * A still press past the threshold becomes a hold once a figure answers one (it may scroll into a window) and the
   * stage is drawing (a press made while it loads becomes the hold when it is).
   */
  const tryHold = () => {
    if (
      !longPress ||
      hold.pressing ||
      !hold.down ||
      travelled ||
      !shared.ready ||
      !inShow() ||
      holdNow() === HOLD_KIND.none
    )
      return;
    hold.pressing = true;
    document.documentElement.classList.add("holding");
    // (the music rises with the first hold)
    if (atGate()) gateGesture();
    wake(600);
  };

  const onMove = (e: PointerEvent) => {
    const now = performance.now();
    hold.pointerType = e.pointerType;
    hold.inside = true;
    if (e.target !== lastTarget) {
      lastTarget = e.target;
      hold.overStage = onStage(e.target);
    }
    if (e.pointerType === "mouse" || hold.down) {
      // (a pointer back after a while away, or a new finger, is not a stroke yet: no speed from the old place)
      if (lastX >= 0 && now > lastT && now - lastT < 120) {
        const dt = Math.max(8, now - lastT) / 1000;
        hold.vx += ((e.clientX - lastX) / dt - hold.vx) * 0.35;
        hold.vy += ((e.clientY - lastY) / dt - hold.vy) * 0.35;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
      setPointer(e.clientX, e.clientY);
      hold.moving = 1;
      hold.lastMove = now;
    }
    if (hold.down && e.pointerId === downId && !travelled) {
      const d = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (d > maxTravel) maxTravel = d;
      if (Math.hypot(e.clientX - restX, e.clientY - restY) > HOLD.cancelPx) {
        longPress = false;
        if (timer) {
          window.clearTimeout(timer);
          timer = 0;
        }
        if (atGate() && maxTravel <= HOLD.settlePx) {
          // at the gate a press that drifts as it settles is not given up: the long-press counts again from where it
          // comes to rest (one that wanders further is a drag)
          restX = e.clientX;
          restY = e.clientY;
          if (!hold.pressing) timer = window.setTimeout(begin, HOLD.longPressMs);
        } else travelled = true;
      }
    }
    wake(250);
  };

  const onDown = (e: PointerEvent) => {
    hold.pointerType = e.pointerType;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!e.isPrimary || !onStage(e.target) || !inShow()) return;
    // a press on the page's own scrollbar is the scrollbar's (its drag sends the page no moves: it would read as a
    // still long press, a hold)
    const de = document.documentElement;
    if (e.clientX >= de.clientWidth || e.clientY >= de.clientHeight) return;
    hold.inside = true;
    setPointer(e.clientX, e.clientY);
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = performance.now();
    hold.down = true;
    downId = e.pointerId;
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
    restX = downX;
    restY = downY;
    maxTravel = 0;
    travelled = false;
    longPress = false;
    // (a new press is the visitor's newest word: a click still waiting for the stage is superseded by it)
    pendingClick = false;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(begin, HOLD.longPressMs);
    wake(600);
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    const now = performance.now();
    downId = -1;
    longPress = false;
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    const wasDown = hold.down;
    hold.down = false;
    if (hold.pressing) {
      release(now);
      return;
    }
    if (e.type !== "pointerup" || !wasDown || !inShow()) return;
    if (atGate()) {
      // the first screen's gate: a click or a tap lets the light go, one that wandered a little and however long it
      // stayed down included; a press that wandered off into a drag is answered as an attempt to move on
      if (maxTravel <= (e.pointerType === "touch" ? HOLD.tapTouchPx : HOLD.tapPx)) {
        tap(hold.nx, hold.ny);
        clickBang();
      } else if (gateClosed()) knock(VIA.press);
      return;
    }
    if (!travelled && now - downAt < HOLD.longPressMs) tap(hold.nx, hold.ny);
  };

  const onLeave = () => {
    hold.inside = false;
  };

  // Long-press menus (Android fires contextmenu on a long touch): never on the stage's holds, only there.
  const onContext = (e: MouseEvent) => {
    if ((hold.pressing || hold.pointerType === "touch") && onStage(e.target) && inShow())
      e.preventDefault();
  };

  // A wheel tells where a mouse is before it has moved (a visitor who only scrolls): the hint ring finds it there.
  const onWheel = (e: WheelEvent) => {
    if (hold.pointerType === "touch" || (hold.inside && hold.pointerType !== "")) return;
    lastTarget = e.target;
    hold.overStage = onStage(e.target);
    setPointer(e.clientX, e.clientY);
    hold.inside = true;
    if (hold.pointerType === "") hold.pointerType = "mouse";
  };

  // Switching away mid-press (another tab, another window) never leaves a hold stuck down: it is let go quietly.
  // Before the bang it gives the gathered light back (the bang is never spent unseen); after it, an ordinary release.
  const cancel = () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    downId = -1;
    keyHolding = false;
    longPress = false;
    hold.down = false;
    if (!hold.pressing) return;
    if (hold.bangAt < 0) {
      hold.pressing = false;
      document.documentElement.classList.remove("holding");
    } else release(performance.now());
  };
  const onVisibility = () => {
    if (document.hidden) cancel();
  };

  // The CV sheet (src/components/full-cv.tsx, always in the page): while it is open the stage behind answers nothing.
  const cvDialog = document.querySelector<HTMLDialogElement>("dialog.cv");

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("contextmenu", onContext);
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", onVisibility);

  // A visitor who arrives mid-page (a reload, a deep link, a restored position) has already let the light go: quietly.
  if (story.T > freeT() || story.afterT > 0) triggerBang(0, 0, "quiet");

  rearmInput = () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    downId = -1;
    travelled = false;
    longPress = false;
    maxTravel = 0;
    lastP = story.Ts + story.after;
    lastPt = story.T + story.afterT;
    pageV = 0;
  };

  const unFrame = addFrame((_t, dt) => {
    const now = performance.now();
    // under the open CV nothing on the stage answers the pointer (its stars stay quiet), however the sheet was
    // opened; the first move after it closes reads the stage again
    if (cvDialog?.open) {
      hold.overStage = false;
      lastTarget = null;
    }
    if (longPress) tryHold();
    if (keyHolding && !hold.pressing) pressKey();
    // a click made while the stage loaded: its bang once the stage has been seen (still the first screen, still waiting)
    if (shared.ready && readyAt < 0) readyAt = now;
    if (pendingClick) {
      if (readyAt >= 0 && now - readyAt >= REVEAL_MS) {
        pendingClick = false;
        if (atGate() && !hold.pressing && inShow()) triggerBang(pendingX, pendingY, "click");
      } else if (readyAt < 0 && now - pendingAt > STAGE_WAIT_MS) {
        pendingClick = false;
        if (atGate() && inShow()) triggerBang(pendingX, pendingY, "quiet");
      } else wake(300);
    }
    // the ring fills only while a figure answers the hold (a scroll out of its window lets it ease back)
    hold.live = hold.pressing && holdNow() !== HOLD_KIND.none;
    if (hold.live) {
      hold.k = Math.min(1, hold.k + (dt * 1000) / HOLD.fullMs);
      wake(200);
    } else if (hold.k > 0) {
      hold.k = Math.max(0, hold.k - dt * 1.6);
      wake(200);
    }
    // pointer velocity decays when the pointer rests
    if (now - hold.lastMove > 40) {
      const f = Math.exp(-dt * 10);
      hold.vx *= f;
      hold.vy *= f;
      if (Math.abs(hold.vx) < 0.5) hold.vx = 0;
      if (Math.abs(hold.vy) < 0.5) hold.vy = 0;
    }
    // Past "This one is yours." without the visitor's gesture. On a fresh visit (and after Start over) the gate never
    // lets the page get here first (src/lib/gate.ts); only where it is open (an explicit near jump, the printed journal
    // of reduced motion) can a page arrive here with the light still waiting, and then: a glide at the journey's pace
    // lets it go gently (the show draws the sky into the point first, fast, then a soft burst); a hold still gathering
    // is released with what it gathered. It is decided where the visitor sees it (the shown position, FREE_LAG): while
    // a far-move cut fades (story.freeze) nothing is decided, and a cut's landing or a jump past it is an arrival,
    // freed quietly (genesis plays no bang past fig. 1 either way), a hold under way let go with it, unplayed.
    const Pt = story.T + story.afterT;
    const v = lastPt >= 0 && dt > 0 ? Math.abs(Pt - lastPt) / dt : 0;
    pageV += (v - pageV) * (1 - Math.exp(-dt * (v > pageV ? 30 : 8)));
    lastPt = Pt;
    const P = story.Ts + story.after;
    if (hold.bangAt < 0 && !story.freeze && (story.Ts > freeT() || story.after > 0)) {
      if (lastP < 0 || Math.abs(P - lastP) > ARRIVE_JUMP || story.Ts >= F.versions) {
        if (hold.pressing) {
          hold.pressing = false;
          document.documentElement.classList.remove("holding");
        }
        triggerBang(hold.nx, hold.ny, "quiet");
      } else if (P > FREE_LATE || (lag() < FREE_LAG && pageV < FREE_V)) {
        if (hold.pressing) release(now);
        else triggerBang(hold.nx, hold.ny, "gentle");
      }
    }
    lastP = P;
  }, -5);

  return () => {
    unFrame();
    rearmInput = null;
    if (timer) window.clearTimeout(timer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("contextmenu", onContext);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("blur", cancel);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
