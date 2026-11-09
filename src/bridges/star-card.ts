import { STARS, starIndex } from "@/content/ink";
import { starCard as COPY, projects, proof, record, tapAgain, work } from "@/content/site";
import { shared } from "@/gl/shared";
import { ANCHOR, anchor } from "@/lib/anchors";
import { hold } from "@/lib/hold";
import { smooth } from "@/lib/math";

/**
 * Fig. 11's star card (src/components/ui/star-card.tsx): beside the platform star the pointer names (shared.play.hoverStar,
 * written by src/gl/show/figures/galaxy.ts), the platform's own words from src/content/site.ts and how to open it. A
 * star the site does not name (ink.ts STARS, `named` false) gets a minimal card: only its honest label ("one of the
 * 50+ · not named here") and how to open Work.
 *
 * It runs inside the ink's frame (src/bridges/ink.ts), right after the projector, so it sits beside its star in the
 * same frame as the galaxy turns. One card at a time: a new star (or a side that no longer fits) fades the card out
 * (OUT_S), then it is filled and fades in at its star (IN_S); the galaxy's hysteresis keeps it from flickering between
 * neighbours. It takes the place that hides the fewest other stars: beside its star (right, left, above, below on a
 * tie) or, when that would cover the galaxy, out in the empty sky to the right or left of the whole galaxy with the
 * hairline running in to its star (a journal's callout); always inside the page's free frame: under the chrome, above the caption, clear of the spine (only where the
 * spine is) and of the "this one" mark. On a phone there is no room beside a star without covering the galaxy, so the
 * card docks full width in the free band between the caption and the fast lane (else under the chrome), and the
 * star's gold ring names it. A platform of Work shows its own picture (Project.image, preloaded and decoded once the
 * galaxy lights, faded in, never popped). The pointer over it keeps its star named, and a click or a tap on it opens
 * that star (shared.starCard). Its size is measured only when its words change; per frame it writes a transform and
 * an opacity, only when they move. No allocation per frame beyond the strings it writes.
 */

/** Fades (s). */
const IN_S = 0.15;
const OUT_S = 0.2;
/** From the star to the card's near edge (CSS px): clear of the star's ring (galaxy ring 14 to 17 px). */
const GAP = 30;
const RING = 19;
/** The card slides this far out from its star as it appears (CSS px). */
const NUDGE = 6;

/** Sides: right, left, above, below. */
const R = 0;
const L = 1;
const A = 2;
const B = 3;
/** Docked full width (a phone). */
const D = 4;
/** Right or left of the whole galaxy, out in the empty sky, the hairline running in to its star (a callout). */
const RF = 5;
const LF = 6;
const SIDE_NAME = ["r", "l", "a", "b", "d", "r", "l"] as const;
/** A small preference among the places, when they hide as many stars (px of score). */
const SIDE_PREF = [0, 6, 12, 18, 0, 10, 16];
/** Each px the callout's hairline runs past the near place (score): a hidden star weighs as much as ~500 px. */
const FAR_COST = 0.12;
/** The galaxy's edge beyond its outermost named stars (CSS px). */
const RIM = 52;

// biome-ignore lint/complexity/useMathMinMax: for b < a the ternary gives a, Math.min gives b; NaN bounds differ too
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export type StarCard = { update: (dt: number) => void; dispose: () => void };

export function createStarCard(): StarCard | null {
  const el = document.getElementById("nq-star-card");
  const box = el?.querySelector<HTMLElement>(".sc-box");
  const lead = el?.querySelector<HTMLElement>(".sc-lead");
  const kickerEl = el?.querySelector<HTMLElement>(".sc-kicker");
  const nameEl = el?.querySelector<HTMLElement>(".sc-name");
  const lineEl = el?.querySelector<HTMLElement>(".sc-line");
  const roleEl = el?.querySelector<HTMLElement>(".sc-role");
  const openEn = el?.querySelector<HTMLElement>(".sc-open-en");
  const openAr = el?.querySelector<HTMLElement>(".sc-open-ar");
  const img = el?.querySelector<HTMLImageElement>(".sc-img");
  if (
    !el ||
    !box ||
    !lead ||
    !kickerEl ||
    !nameEl ||
    !lineEl ||
    !roleEl ||
    !openEn ||
    !openAr ||
    !img
  )
    return null;
  const root = document.documentElement;
  const card = shared.starCard;
  const system = anchor(ANCHOR.system);

  // ---- the page's free frame, measured on resize (the ink's: under the chrome, above the caption) and when a card is
  // filled (the spine: clear of its ticks in their own band, and of the current figure's name beside its tick;
  // elsewhere the card may go to the page's edge)
  const spineEl = document.querySelector<HTMLElement>(".spine-list");
  const laneEl = document.querySelector<HTMLElement>(".lane");
  let phone = false;
  let top = 84;
  let left = 28;
  let right = window.innerWidth - 24;
  let spineRight = window.innerWidth - 244;
  let spineTop = 1e9;
  let spineBottom = -1e9;
  let nameRight = window.innerWidth;
  let nameTop = 1e9;
  let nameBottom = -1e9;
  let bottom = window.innerHeight * 0.7;
  /** A phone: the top of the fast lane (the dock stays above it). */
  let laneTop = window.innerHeight;
  const capEl = document.querySelector<HTMLElement>(".caption");
  const measure = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    phone = vw <= 760;
    top = phone ? 96 : 84;
    // inside the page's gutters (the caption's sides: a notch's safe-area inset on a phone held sideways) and above the
    // caption, wherever the page puts it (lower on a phone held sideways)
    const cr = capEl?.getBoundingClientRect();
    const has = cr !== undefined && cr.width > 0;
    left = phone ? Math.max(16, has ? cr.left : 0) : Math.max(28, vw * 0.04, has ? cr.left : 0);
    right = vw - Math.max(phone ? 16 : 24, has ? vw - cr.right : 0);
    measureSpine();
    laneTop = vh;
    if (laneEl && phone) {
      const r = laneEl.getBoundingClientRect();
      if (r.height > 0 && r.top > vh * 0.5) laneTop = r.top;
    }
    bottom = (has ? cr.top : (phone ? 0.6 : vh <= 760 ? 0.69 : 0.71) * vh) - 22;
    side = -1;
  };
  /** The spine's ticks (their column, in their band) and the current figure's name beside its tick. */
  function measureSpine() {
    spineTop = 1e9;
    spineBottom = -1e9;
    nameTop = 1e9;
    nameBottom = -1e9;
    if (!spineEl || phone) return;
    const r = spineEl.getBoundingClientRect();
    if (r.height <= 0) return;
    spineTop = r.top - 20;
    spineBottom = r.bottom + 20;
    spineRight = r.right - 24 - 28;
    const mark = spineEl.querySelector<HTMLElement>(".spine-mark");
    if (mark) spineRight = mark.getBoundingClientRect().left - 28;
    const name = spineEl.querySelector<HTMLElement>(".spine-tick[aria-current] .spine-name");
    if (name && Number(getComputedStyle(name).opacity) > 0.05) {
      const n = name.getBoundingClientRect();
      if (n.width > 0) {
        nameRight = n.left - 20;
        nameTop = n.top - 16;
        nameBottom = n.bottom + 16;
      }
    }
  }
  /** The free frame's right edge for a card from y0 to y1: clear of the spine's ticks and its name only beside them. */
  const rightAt = (y0: number, y1: number) => {
    let r = right;
    if (y0 < spineBottom && y1 > spineTop && spineRight < r) r = spineRight;
    if (y0 < nameBottom && y1 > nameTop && nameRight < r) r = nameRight;
    return r;
  };

  // ---- the platforms' pictures (Project.image): fetched and decoded once, when the galaxy first lights its stars
  const ready = new Uint8Array(projects.length);
  let preloaded = false;
  const preload = () => {
    preloaded = true;
    for (let i = 0; i < projects.length; i++) {
      const im = new Image();
      im.decoding = "async";
      im.src = projects[i].image;
      im.decode().then(
        () => {
          ready[i] = 1;
        },
        () => {},
      );
    }
  };
  /** The picture shown fades in once it is decoded (at once when it already is). */
  let imgFor = -1;
  const showImg = (i: number) => {
    img.classList.remove("in");
    imgFor = i;
    img.src = projects[i].image;
    if (img.complete && ready[i]) {
      img.classList.add("in");
      return;
    }
    img.decode().then(
      () => {
        if (imgFor === i) img.classList.add("in");
      },
      () => {},
    );
  };

  /** The star shown, its words' language (touch or not), how shown 0..1, its side and size. */
  let shown = -1;
  let touchShown = false;
  let o = 0;
  let side = -1;
  let w = 0;
  let h = 0;
  let lastX = -1e9;
  let lastY = -1e9;
  let lastO = -1;
  let lastLead = "";
  let onStar = false;

  /** Where the card sits on side s of a star at (sx, sy): written into px, py. */
  let px = 0;
  let py = 0;
  /** The dock's top (a phone), chosen when the card is filled. */
  let dockY = 0;
  /** The galaxy's span across the page this frame (its named stars and a rim). */
  let gx0 = 0;
  let gx1 = 0;
  const bounds = () => {
    gx0 = 1e9;
    gx1 = -1e9;
    for (let j = 0; j < STARS.length; j++) {
      const a = anchor(STARS[j].id);
      if (!a.live || a.on < 0.3) continue;
      if (a.sx < gx0) gx0 = a.sx;
      if (a.sx > gx1) gx1 = a.sx;
    }
    gx0 -= RIM;
    gx1 += RIM;
  };
  const at = (s: number, sx: number, sy: number) => {
    if (s === D) {
      px = left;
      py = dockY;
    } else if (s === R || s === L || s === RF || s === LF) {
      py = clamp(sy - h * 0.38, top, Math.max(top, bottom - h));
      px =
        s === R
          ? sx + GAP
          : s === L
            ? sx - GAP - w
            : s === RF
              ? Math.max(sx + GAP, gx1)
              : Math.min(sx - GAP - w, gx0 - w);
      // (a callout steps past the "this one" mark when it is level with it)
      if (
        (s === RF || s === LF) &&
        system.live &&
        system.on > 0.2 &&
        py < system.sy + 26 &&
        py + h > system.sy - 46
      ) {
        px = s === RF ? Math.max(px, system.sx + 112) : Math.min(px, system.sx - 34 - w);
      }
    } else {
      px = clamp(sx - w / 2, left, Math.max(left, right - w));
      py = s === A ? sy - GAP - h : sy + GAP;
    }
  };
  /** The card on side s fits the free frame and keeps off the "this one" mark (the circle, its words up and right). */
  const onSystem = () =>
    system.live &&
    system.on > 0.2 &&
    px < system.sx + 104 &&
    px + w > system.sx - 26 &&
    py < system.sy + 26 &&
    py + h > system.sy - 46;
  /**
   * The hairline from star (sx, sy) to the card on side s (where px, py put it) runs through the "this one" mark
   * (a segment against its box, Liang-Barsky).
   */
  const leadOnSystem = (s: number, sx: number, sy: number) => {
    if (!system.live || system.on <= 0.2 || s === D) return false;
    let ex: number;
    let ey: number;
    if (s === R || s === RF || s === L || s === LF) {
      ex = s === R || s === RF ? px : px + w;
      ey = clamp(sy, py + 12, py + h - 12);
    } else {
      ex = clamp(sx, px + 14, px + w - 14);
      ey = s === A ? py + h : py;
    }
    const d = Math.hypot(ex - sx, ey - sy);
    if (d <= RING) return false;
    const x0 = sx + ((ex - sx) / d) * RING;
    const y0 = sy + ((ey - sy) / d) * RING;
    const dx = ex - x0;
    const dy = ey - y0;
    let t0 = 0;
    let t1 = 1;
    const edge = (p: number, q: number) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    };
    return (
      edge(-dx, x0 - (system.sx - 22)) &&
      edge(dx, system.sx + 100 - x0) &&
      edge(-dy, y0 - (system.sy - 40)) &&
      edge(dy, system.sy + 22 - y0) &&
      t0 <= t1
    );
  };
  const fits = (s: number, sx: number, sy: number) => {
    at(s, sx, sy);
    if (s === D) return true;
    if (px < left || px + w > rightAt(py, py + h) || py < top || py + h > bottom) return false;
    return !onSystem() && !leadOnSystem(s, sx, sy);
  };
  /** Keep the card where at() put it inside the free frame (written into px, py); how far it had to move. */
  const keepIn = () => {
    const x0 = px;
    const y0 = py;
    py = clamp(py, top, Math.max(top, bottom - h));
    px = clamp(px, left, Math.max(left, rightAt(py, py + h) - w));
    return Math.abs(px - x0) + Math.abs(py - y0);
  };
  /** How far past its near place a callout's hairline runs (px). */
  const far = (s: number, sx: number) =>
    s === RF ? Math.max(0, px - sx - GAP) : s === LF ? Math.max(0, sx - GAP - w - px) : 0;
  /** How many other platform stars the card would hide where at() put it. */
  const hides = (i: number) => {
    let n = 0;
    for (let j = 0; j < STARS.length; j++) {
      if (j === i) continue;
      const a = anchor(STARS[j].id);
      if (
        a.live &&
        a.on > 0.3 &&
        a.sx > px - 10 &&
        a.sx < px + w + 10 &&
        a.sy > py - 10 &&
        a.sy < py + h + 10
      )
        n++;
    }
    return n;
  };
  /**
   * How bad side s is for star i at (sx, sy), once kept inside the frame: the stars it hides weigh most, then how far
   * the frame pushed it off its place, then the order right, left, above, below. Covering its own star or the "this
   * one" mark is out of the question.
   */
  const score = (i: number, s: number, sx: number, sy: number) => {
    at(s, sx, sy);
    let v = keepIn() * 2 + SIDE_PREF[s] + far(s, sx) * FAR_COST;
    if (sx > px - RING && sx < px + w + RING && sy > py - RING && sy < py + h + RING) v += 1e5;
    if (onSystem() || leadOnSystem(s, sx, sy)) v += 1e4;
    return v + hides(i) * 60;
  };
  /**
   * The side for star i at (sx, sy): the current one while it still fits (it never hops while shown), else the best
   * scored (a side that no longer fits is kept, inside the frame, while it is about as good: no flicker between two).
   */
  const pick = (i: number, sx: number, sy: number, cur: number) => {
    if (phone) return D;
    if (cur >= 0 && cur !== D && fits(cur, sx, sy)) return cur;
    let best = -1;
    let bestV = 1e9;
    for (let s = R; s <= LF; s++) {
      if (s === D) continue;
      const v = score(i, s, sx, sy);
      if (v < bestV) {
        bestV = v;
        best = s;
      }
    }
    if (cur >= 0 && cur !== D && best !== cur && score(i, cur, sx, sy) < bestV + 40) return cur;
    return best;
  };
  /**
   * A phone: the dock between the caption and the fast lane, centred in that band, when the card fits there (the
   * galaxy and the copy stay clear); else under the chrome or just over the caption, whichever hides fewer stars.
   */
  const dock = (i: number) => {
    let capTop = bottom + 22;
    let capBottom = capTop;
    // (the figure's label shown, and every line of that figure: they share one place, the longest sets the bottom)
    const labels = document.querySelectorAll<HTMLElement>(".caption .cap-label");
    let fig = "";
    for (let k = 0; k < labels.length && fig === ""; k++) {
      if (Number(getComputedStyle(labels[k]).opacity) >= 0.05) fig = labels[k].dataset.fig ?? "";
    }
    const parts = document.querySelectorAll<HTMLElement>(`.caption [data-fig="${fig}"]`);
    for (let k = 0; k < parts.length; k++) {
      const r = parts[k].getBoundingClientRect();
      if (r.height <= 0) continue;
      capTop = Math.min(capTop, r.top);
      capBottom = Math.max(capBottom, r.bottom);
    }
    const lo = capBottom + 12;
    const hi = laneTop - 12;
    if (hi - lo >= h) {
      dockY = lo + (hi - lo - h) * 0.5;
      return;
    }
    // (a short phone: never on the "this one" mark)
    px = left;
    py = top;
    const vTop = hides(i) * 60 + (onSystem() ? 1e4 : 0);
    py = capTop - 12 - h;
    const vOver = py >= top ? hides(i) * 60 + (onSystem() ? 1e4 : 0) : 1e9;
    dockY = vOver < vTop ? capTop - 12 - h : top;
  };

  /** Write a star's words (only when the star or the language changes), then measure the card once. */
  const fill = (i: number, touch: boolean) => {
    const pic = i < projects.length;
    el.classList.toggle("has-img", pic);
    if (pic) showImg(i);
    else {
      imgFor = -1;
      img.classList.remove("in");
    }
    const unnamed = !STARS[i].named;
    el.classList.toggle("is-unnamed", unnamed);
    if (i < projects.length) {
      const p = projects[i];
      kickerEl.textContent = proof.sector[p.slug] ?? "";
      nameEl.textContent = p.name;
      lineEl.textContent = p.line;
      roleEl.textContent = proof.role[p.slug] ?? "";
    } else if (!unnamed) {
      kickerEl.textContent = record.work.more;
      nameEl.textContent = work.more[i - projects.length].label;
      lineEl.textContent = "";
      roleEl.textContent = "";
    } else {
      // one of the platforms the site does not name: a minimal card with the journal's honest label (ink.ts STARS),
      // and how to open Work, where the 50+ are counted
      kickerEl.textContent = "";
      nameEl.textContent = "";
      lineEl.textContent = "";
      roleEl.textContent = STARS[i].text;
    }
    nameEl.hidden = nameEl.textContent === "";
    kickerEl.hidden = kickerEl.textContent === "";
    lineEl.hidden = lineEl.textContent === "";
    roleEl.hidden = roleEl.textContent === "";
    const open = touch ? tapAgain : COPY.open;
    openEn.textContent = open.en;
    openAr.textContent = open.ar;
    el.dataset.side = phone ? SIDE_NAME[D] : SIDE_NAME[R];
    measureSpine();
    w = box.offsetWidth;
    h = box.offsetHeight;
    if (phone) dock(i);
  };

  const update = (dt: number) => {
    if (!preloaded && anchor(STARS[0].id).live) preload();
    bounds();
    const touch = hold.pointerType === "touch";
    let want = starIndex(shared.play.hoverStar);
    if (want >= 0) {
      const a = anchor(STARS[want].id);
      if (!a.live || a.on < 0.3) want = -1;
    }
    const s = shown >= 0 ? anchor(STARS[shown].id) : null;
    const live = s?.live && s.on > 0.05;
    const nextSide = live && s ? pick(shown, s.sx, s.sy, side) : side;
    if (want !== shown || touch !== touchShown || !live || nextSide !== side) {
      // one card at a time: out first, then the next one in at its own star
      o = Math.max(0, o - dt / OUT_S);
      if (o === 0) {
        shown = want;
        touchShown = touch;
        side = -1;
        if (shown >= 0) {
          fill(shown, touch);
          const n = anchor(STARS[shown].id);
          side = pick(shown, n.sx, n.sy, -1);
          el.dataset.side = SIDE_NAME[side];
        }
      }
    } else o = Math.min(1, o + dt / IN_S);

    // the pointer over a named star: the page's own pointer says it opens
    const pointerOn = !touch && want >= 0;
    if (pointerOn !== onStar) {
      onStar = pointerOn;
      root.classList.toggle("on-star", pointerOn);
    }

    const e = smooth(o);
    const s2 = shown >= 0 ? anchor(STARS[shown].id) : null;
    if (s2 && side >= 0 && e > 0) {
      at(side, s2.sx, s2.sy);
      // (a side kept although it no longer fits cleanly stays inside the frame)
      if (side !== D) keepIn();
      // it slides out from its star as it appears (and back as it goes)
      const k = (1 - e) * NUDGE;
      const toR = side === R || side === RF;
      const toL = side === L || side === LF;
      const x = px + (toR ? -k : toL ? k : 0);
      const y = py + (side === A ? k : side === B || side === D ? -k : 0);
      if (Math.abs(x - lastX) > 0.05 || Math.abs(y - lastY) > 0.05) {
        lastX = x;
        lastY = y;
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        // the hairline from the star's ring to the card's near edge (in the card's own space)
        let ex: number;
        let ey: number;
        if (toR || toL) {
          ex = toR ? x : x + w;
          ey = clamp(s2.sy, y + 12, y + h - 12);
        } else {
          ex = clamp(s2.sx, x + 14, x + w - 14);
          ey = side === A ? y + h : y;
        }
        const dx = ex - s2.sx;
        const dy = ey - s2.sy;
        const d = Math.hypot(dx, dy);
        const len = Math.max(0, d - RING);
        const ax = s2.sx + (dx / Math.max(1, d)) * RING - x;
        const ay = s2.sy + (dy / Math.max(1, d)) * RING - y;
        const t = `translate3d(${ax.toFixed(1)}px,${ay.toFixed(1)}px,0) rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${(len / 100).toFixed(3)})`;
        if (t !== lastLead) {
          lastLead = t;
          lead.style.transform = t;
        }
        card.x0 = x;
        card.y0 = y;
        card.x1 = x + w;
        card.y1 = y + h;
      }
    }
    card.on = shown >= 0 && o > 0.3;
    if (Math.abs(e - lastO) > 0.004 || (e === 0) !== (lastO === 0)) {
      lastO = e;
      el.style.opacity = e.toFixed(3);
      el.style.visibility = e > 0 ? "visible" : "hidden";
    }
  };

  measure();
  window.addEventListener("resize", measure);
  return {
    update,
    dispose: () => {
      window.removeEventListener("resize", measure);
      root.classList.remove("on-star");
      card.on = false;
    },
  };
}
