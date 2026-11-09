/**
 * Again (docs/STORY.md fig. 11): the camera pulls back from the world out of the system (poses/finale.ts againPose)
 * until the sun is one star, and the motes light up around it as a galaxy: the Milky Way seen from outside, a barred
 * spiral at three quarters, our system's star out on one of its arms, its core glowing. Fifty-one platform stars light
 * up across it, from our star outward: the fifteen site.ts names (the nine projects and the also-shipped list) and
 * thirty-six quieter unnamed ones (the record's "50+"). The named ones breathe in the journal's gold and ring as the
 * pointer comes near; hover names one (its card: src/bridges/star-card.ts), a click jumps to it in Work. An unnamed
 * one answers too, as quietly as it shines: it brightens, its card says only that it is one of the 50+ not named
 * here, and a click goes to Work's heading. In fig. 12 the camera falls
 * back into our star and home to the observer, and the galaxy, seen from inside, settles into tonight's sky
 * (figures/sky.ts).
 *
 * How it is drawn: every mote has a home in the galaxy on its own line of sight from our star (glsl/finale.ts
 * GAL_HOME, set in the real galactic frame at the visit's sidereal time: sky.ts GAL), lit by the timeline's galaxy
 * weight (glsl/timeline.ts); this controller writes the galaxy's frame and light, draws its disk's glow, its core and
 * the platform stars, and answers the pointer. As the eye starts to fall in fig. 12 the galaxy's origin slides from
 * the sun's place to the observer's, taking our star (the thread) and what the eye falls toward with it, so nothing
 * moves on screen and at home every mote is on the observer's own line of sight to its star.
 *
 * Writes anchor `system` and the thread (`yours`) at our star, the platform stars (`star:<slug>`, ink.ts STARS) and
 * shared.play.hoverStar. No allocation per frame.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Mesh,
  PlaneGeometry,
  Points,
  type Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import { STARS } from "@/content/ink";
import { projects } from "@/content/site";
import { shared } from "@/gl/shared";
import { ANCHOR, setAnchor } from "@/lib/anchors";
import { hold } from "@/lib/hold";
import { BEATS, F, HANDOFF } from "@/lib/journey";
import { jumpTo } from "@/lib/scroll";
import { OBSERVER, SUN, SUN_R } from "../constants";
import { damp, type Figure, type FrameCtx, ss, type Win } from "../frame";
import {
  GALAXY_CORE_FRAG,
  GALAXY_DISK_FRAG,
  GALAXY_DISK_VERT,
  PLATFORM_FRAG,
  PLATFORM_VERT,
} from "../glsl/finale";
import { GAL, galArms } from "../sky";
import { FLOCK_T } from "./flock";
import { SKY_T } from "./sky";

const [D0, D1] = SKY_T.descent;
const DL = D1 - D0;

/** Story times the galaxy owns (glsl/timeline.ts writes form, formDeep, formFlock and deep into GLSL). */
export const GALAXY_T = {
  /** The deep-space stars go dark as the camera starts to pull back, and light again at their place in the galaxy. */
  deep: [F.again + 0.03, F.again + 0.2] as Win,
  formDeep: [F.again + 0.2, F.again + 0.42] as Win,
  /** The galaxy lights its motes where they belong as the camera pulls back through it. */
  form: [F.again + 0.05, F.again + 0.4] as Win,
  /** The flock's motes join once they have settled back onto the world (figures/flock.ts land). */
  formFlock: [FLOCK_T.land[1], FLOCK_T.land[1] + 0.18] as Win,
  /**
   * The whole system, one last time: the team planets (stepped back since fig. 8, system-times othersOut) come back with
   * their faint orbits as the camera pulls out past the world, and shrink with the rest into one star.
   */
  system: [F.again + 0.03, F.again + 0.15] as Win,
  systemOut: [F.again + 0.26, F.again + 0.42] as Win,
  /** The system becomes one star at the sun's place (your point marks it) as the sun shrinks away. */
  star: [F.again + 0.2, HANDOFF.SYSTEM_STAR - 0.05] as Win,
  /** The disk's glow and the core come up as the galaxy comes into view (its core well in the frame by then). */
  glow: [F.again + 0.3, F.again + 0.5] as Win,
  /** The platform stars light one by one (journey BEATS.again.stars) and answer the pointer (BEATS.again.hover). */
  stars: [F.again + BEATS.again.stars[0], F.again + BEATS.again.stars[1]] as Win,
  hover: [F.again + BEATS.again.hover[0], F.again + BEATS.again.hover[1]] as Win,
  /**
   * As the eye falls back in (SKY_T.descent): the galaxy's origin (and our star, the thread, and what the eye falls
   * toward with it: poses/finale.ts) slides from the sun's place to the observer's, all together, so nothing moves on
   * screen; from home, every mote then lies on the observer's own line of sight to its star...
   */
  shift: [D0, D0 + 0.3 * DL] as Win,
  /**
   * ...the platform stars go out, the glow goes as the eye enters the disk, the knots fade as the motes settle (into
   * the sky's return, not before it, so the fall never passes through a dark frame).
   */
  starsOut: [D0 + 0.12 * DL, D0 + 0.4 * DL] as Win,
  glowOut: [D0 + 0.2 * DL, D0 + 0.5 * DL] as Win,
  near: [D0 + 0.68 * DL, D0 + 0.86 * DL] as Win,
  /** The thread goes to the sky (figures/sky.ts rise). */
  out: SKY_T.rise[0],
};

/** How bright the planets' faint orbits come back in the pull-back (the system's own peak is 0.42). */
const ORBITS_BACK = 0.3;
/** The camera sees this far while the galaxy is out (world units): the disk, and the far field behind it. */
const FAR = 14000;
const FAR_WIN: Win = [F.again - 0.03, D1 + 0.1];
/**
 * The pointer finds a platform star within PICK CSS px (a finger: PICK_TOUCH), keeps it until it is KEEP px away (or
 * over its card), and hands it to a neighbour only when that one is clearly closer: no flicker between two stars.
 * Within NEAR px the nearest star brightens and rings, so hovering is found on its own.
 */
const PICK = 34;
const PICK_TOUCH = 46;
const KEEP = 56;
const NEAR = 120;
/** A platform star's light: its size (CSS px) and brightness; webook's three are the brightest. */
const LOOK = {
  webook: [31, 1.0],
  project: [25, 0.72],
  more: [20, 0.5],
  unnamed: [17, 0.36],
} as const;
const WEBOOK = new Set(["webook", "riyadhseason", "visitsaudi"]);

const S = new Vector3(...SUN);
const OBS = new Vector3(...OBSERVER);

/** The galaxy's origin at story time T: our star, sliding to the observer while the eye is far in fig. 12. */
export function galaxyOrigin(T: number, out: Vector3) {
  return out.lerpVectors(S, OBS, ss(GALAXY_T.shift[0], GALAXY_T.shift[1], T));
}

/** Seeded PRNG (mulberry32): the platform stars sit in the same places on every visit. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The platform stars' places (local galactic, world units): on the arms, spread across the disk, clear of the core
 * and of our star (its circle). Galactocentric q -> local: ((q.x + 1) RS, q.y RS).
 */
function placeStars(n: number) {
  const r = rng(0x9a1a7);
  const q: number[] = [];
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let bx = 0;
    let by = 0;
    let bs = -1;
    for (let c = 0; c < 80; c++) {
      const R = 0.36 + 1.18 * Math.sqrt(r());
      const a = r() * Math.PI * 2;
      const x = R * Math.cos(a);
      const y = R * Math.sin(a);
      let md = Math.hypot(x + 1, y) * 0.8;
      for (let j = 0; j < q.length; j += 2) md = Math.min(md, Math.hypot(x - q[j], y - q[j + 1]));
      const s = (0.2 + galArms(x, y)) * Math.min(1, md / 0.34) ** 2 * (0.75 + 0.25 * r());
      if (s > bs) {
        bs = s;
        bx = x;
        by = y;
      }
    }
    q.push(bx, by);
    out[i * 3] = (bx + 1) * GAL.RS;
    out[i * 3 + 1] = by * GAL.RS;
    out[i * 3 + 2] = (r() - 0.5) * 0.02 * GAL.RS;
  }
  return out;
}

/** The platform stars' homes (local galactic, world units; ink.ts STARS order): the same on every visit. */
export const STAR_HOMES = placeStars(STARS.length);

/**
 * The free stage the platform stars keep to while they can be hovered and tapped (viewport CSS px, measured on resize;
 * w 0 until measured): under the frame's controls at the top (the name, the fast lane, Skip, a phone's sound switch),
 * above the caption, clear of the spine's column at the right edge. poses/finale.ts frames the galaxy so every star
 * is on it, which a tall narrow screen needs (it pulls back; a wide one already holds them).
 */
export const STAGE = { w: 0, h: 0, top: 0, bottom: 0, left: 0, right: 0 };

function measureStage() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  STAGE.w = vw;
  STAGE.h = vh;
  STAGE.top = 0;
  for (const el of document.querySelectorAll<HTMLElement>(
    ".chrome .ident, .chrome .lane, .skip-show, .corner-bl",
  )) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top + r.bottom < vh)
      STAGE.top = Math.max(STAGE.top, r.bottom);
  }
  const cap = document.querySelector<HTMLElement>(".caption")?.getBoundingClientRect();
  STAGE.bottom = cap && cap.top > vh * 0.3 ? cap.top : vh * (vw <= 760 ? 0.6 : 0.71);
  STAGE.left = 0;
  STAGE.right = vw;
  const mark = document.querySelector<HTMLElement>(".spine .spine-mark")?.getBoundingClientRect();
  if (mark && mark.width > 0 && mark.left > vw * 0.6) STAGE.right = mark.left;
}

const BILLBOARD = /* glsl */ `
uniform vec3 uCenter;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 mv = viewMatrix * vec4(uCenter, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;

/** The point (CSS px) is on the star card's box (with a margin), while the card shows. */
function onCard(x: number, y: number, pad: number) {
  const c = shared.starCard;
  return c.on && x > c.x0 - pad && x < c.x1 + pad && y > c.y0 - pad && y < c.y1 + pad;
}

/**
 * The point is on the way from the named star at (sx, sy) to its card (the span of both, the star's KEEP around it):
 * a card out beside the galaxy stays while the pointer follows its hairline out to it.
 */
function toCard(sx: number, sy: number, x: number, y: number, pad: number) {
  const c = shared.starCard;
  return (
    c.on &&
    x > Math.min(sx - KEEP, c.x0 - pad) &&
    x < Math.max(sx + KEEP, c.x1 + pad) &&
    y > Math.min(sy - KEEP, c.y0 - pad) &&
    y < Math.max(sy + KEEP, c.y1 + pad)
  );
}

export class Galaxy implements Figure {
  private group = new Group();
  private disk: Mesh;
  private diskM: ShaderMaterial;
  private core: Mesh;
  private coreM: ShaderMaterial;
  private stars: Points;
  private starsM: ShaderMaterial;
  private local: Float32Array;
  private live: Float32Array;
  private liveAttr: BufferAttribute;
  /** Lighting order (nearest our star first, a ripple outward) and each star's moment in it, 0..1. */
  private at: Float32Array;
  private hov: Float32Array;
  private near: Float32Array;
  /** Each platform star's distance to the pointer this frame (CSS px; 1e9 when it cannot be picked). */
  private dist: Float32Array;
  /** Each platform star's place on the page this frame (CSS px, x then y). */
  private scr: Float32Array;
  private hover = -1;
  private touchSel = -1;
  /** The platform stars were in their figure last frame (their live attribute is uploaded only while they are). */
  private wasAny = false;
  private lastTap: number;
  private o = new Vector3();
  private v1 = new Vector3();
  private v2 = new Vector3();
  private jumpIds: string[];

  constructor() {
    // the named platforms first, then the unnamed (ink.ts STARS order: the record names nine of 50+ and lists six
    // more; the rest light too, quieter, so the galaxy holds fifty-something as the line says)
    const n = STARS.length;
    this.local = STAR_HOMES;
    this.live = new Float32Array(n * 3);
    this.hov = new Float32Array(n);
    this.near = new Float32Array(n);
    this.dist = new Float32Array(n).fill(1e9);
    this.scr = new Float32Array(n * 2);
    this.at = new Float32Array(n);
    // size, brightness, and the breath's phase (the named ones only; seeded, the same on every visit)
    const look = new Float32Array(n * 3);
    const phase = rng(0x5ea7);
    for (let i = 0; i < n; i++) {
      const l = !STARS[i].named
        ? LOOK.unnamed
        : WEBOOK.has(STARS[i].slug)
          ? LOOK.webook
          : i < projects.length
            ? LOOK.project
            : LOOK.more;
      look[i * 3] = l[0];
      look[i * 3 + 1] = l[1];
      look[i * 3 + 2] = STARS[i].named ? phase() : -1;
    }
    // light them from our star outward
    const order = [...Array(n).keys()].sort(
      (a, b) =>
        Math.hypot(this.local[a * 3], this.local[a * 3 + 1]) -
        Math.hypot(this.local[b * 3], this.local[b * 3 + 1]),
    );
    for (let k = 0; k < n; k++) this.at[order[k]] = k / Math.max(1, n - 1);
    this.jumpIds = STARS.map((s, i) =>
      !s.named ? "work" : i < projects.length ? `work-${s.slug}` : "work-more",
    );
    this.lastTap = hold.tapAt;

    const frame = () => ({ uGalM: { value: GAL.M }, uGalO: { value: this.o } });
    // the disk's glow: a quad in the galaxy's plane (RS units around the centre)
    this.diskM = new ShaderMaterial({
      uniforms: { ...frame(), uI: { value: 0 }, uArms: { value: 0.05 } },
      vertexShader: GALAXY_DISK_VERT,
      fragmentShader: GALAXY_DISK_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.disk = new Mesh(new PlaneGeometry(4.1, 4.1, 1, 1), this.diskM);
    this.disk.frustumCulled = false;
    this.disk.renderOrder = 1;
    // the core: the bulge's glow, facing the eye
    this.coreM = new ShaderMaterial({
      uniforms: { uCenter: { value: new Vector3() }, uSize: { value: [1, 1] }, uI: { value: 0 } },
      vertexShader: BILLBOARD,
      fragmentShader: GALAXY_CORE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.core = new Mesh(new PlaneGeometry(2, 2), this.coreM);
    this.core.frustumCulled = false;
    this.core.renderOrder = 1;
    // the platform stars
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(this.local, 3));
    g.setAttribute("aLook", new BufferAttribute(look, 3));
    this.liveAttr = new BufferAttribute(this.live, 3);
    this.liveAttr.setUsage(DynamicDrawUsage);
    g.setAttribute("aLive", this.liveAttr);
    this.starsM = new ShaderMaterial({
      uniforms: { ...frame(), uDpr: { value: 1 }, uI: { value: 0 }, uTime: { value: 0 } },
      vertexShader: PLATFORM_VERT,
      fragmentShader: PLATFORM_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.stars = new Points(g, this.starsM);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = 3;
    this.group.add(this.disk, this.core, this.stars);
    this.disk.visible = false;
    this.core.visible = false;
    this.stars.visible = false;
    measureStage();
    window.addEventListener("resize", this.onResize);
  }

  /** (once per frame however many resizes a window drag or a phone's address bar reports) */
  private resizeRaf = 0;
  private onResize = () => {
    if (!this.resizeRaf)
      this.resizeRaf = requestAnimationFrame(() => {
        this.resizeRaf = 0;
        measureStage();
      });
  };

  mount(scene: Scene) {
    scene.add(this.group);
  }

  unmount(scene: Scene) {
    scene.remove(this.group);
  }

  /**
   * The camera sees far while the galaxy is out (the rig's pose is placed after this). The system comes back whole
   * as the camera pulls out of it (GALAXY_T.system: after the system's own pre, so this wins for those frames).
   */
  pre(f: FrameCtx) {
    const T = f.T;
    const far = T > FAR_WIN[0] && T < FAR_WIN[1] ? FAR : 2000;
    if (f.camera.far !== far) {
      f.camera.far = far;
      f.camera.updateProjectionMatrix();
    }
    if (T < GALAXY_T.system[0] || T > GALAXY_T.systemOut[1]) return;
    const back =
      ss(GALAXY_T.system[0], GALAXY_T.system[1], T) *
      (1 - ss(GALAXY_T.systemOut[0], GALAXY_T.systemOut[1], T));
    const co = f.cosmos;
    co.othersFade = Math.max(co.othersFade, back);
    co.ringFade = Math.min(co.planetFade, co.othersFade);
    co.orbitsI = Math.max(co.orbitsI, ORBITS_BACK * back);
  }

  frame(f: FrameCtx) {
    const { T, U, dt } = f;
    const n = STARS.length;
    galaxyOrigin(T, this.o);
    (U.uGalO.value as Vector3).copy(this.o);
    U.uGalM.value.copy(GAL.M);
    // fewer motes on the lower tiers: each carries more of the light; a small screen packs them closer: less each
    const tierK = Math.sqrt(262144 / Math.max(1, U.uN.value as number));
    const area = (f.width * f.height) / (f.dpr * f.dpr);
    U.uGalI.value = 0.85 * tierK * Math.min(1, Math.max(0.62, (area / 1.3e6) ** 0.3));
    U.uGalNear.value = ss(GALAXY_T.near[0], GALAXY_T.near[1], T);

    // the disk's glow and the core: up as the galaxy comes into view, out as the eye enters it
    const glow =
      ss(GALAXY_T.glow[0], GALAXY_T.glow[1], T) *
      (1 - ss(GALAXY_T.glowOut[0], GALAXY_T.glowOut[1], T));
    // on the lower tiers (fewer motes) the disk's glow carries more of the arms; the core stays as it is
    this.diskM.uniforms.uI.value = glow * f.U.uDim.value;
    this.diskM.uniforms.uArms.value = 0.05 * (1 + 0.6 * (tierK - 1));
    this.disk.visible = glow > 0.002;
    const gI = glow;
    const c = this.v1.set(GAL.RS, 0, 0).applyMatrix3(GAL.M).add(this.o);
    (this.coreM.uniforms.uCenter.value as Vector3).copy(c);
    const cs = this.coreM.uniforms.uSize.value as number[];
    cs[0] = cs[1] = GAL.RS * 0.42;
    // the core's glow is the galaxy's from afar; up close the bulge's own stars carry it
    const cI = gI * ss(1.3 * GAL.RS, 2.4 * GAL.RS, c.distanceTo(f.camera.position));
    this.coreM.uniforms.uI.value = cI * f.U.uDim.value;
    this.core.visible = cI > 0.002;

    this.platforms(f, n, dt);
    this.thread(f);
  }

  /** The platform stars: they light one by one, answer the pointer, and go out as the eye falls back in. */
  private platforms(f: FrameCtx, n: number, dt: number) {
    const T = f.T;
    const [a, b] = GALAXY_T.stars;
    const out = 1 - ss(GALAXY_T.starsOut[0], GALAXY_T.starsOut[1], T);
    const any = T > a && out > 0.002;
    this.starsM.uniforms.uI.value = out * f.U.uDim.value;
    this.starsM.uniforms.uDpr.value = f.dpr;
    // (the show's own time: it stands still under reduced motion, and so does the breath)
    this.starsM.uniforms.uTime.value = f.U.uTime.value;
    this.stars.visible = any;
    const hoverOn = any && T > GALAXY_T.hover[0] && T < GALAXY_T.hover[1] && !f.snapping;
    const cam = f.camera;
    const W = f.width / f.dpr;
    const H = f.height / f.dpr;
    const touch = hold.pointerType === "touch";
    const pick = touch ? PICK_TOUCH : PICK;
    const M = GAL.M;
    // a tap (a click that is not a hold): on a star, it jumps to it in Work (on touch: the first tap names it)
    let tapped = -1;
    const tap = hold.tapAt > this.lastTap && f.now - hold.tapAt < 600;
    if (hold.tapAt > this.lastTap) this.lastTap = hold.tapAt;
    if (!any) {
      // out of their figure: nothing lit, nothing to upload (the stars are not drawn)
      if (this.wasAny) {
        this.hov.fill(0);
        this.near.fill(0);
        this.hover = -1;
        this.touchSel = -1;
        shared.play.hoverStar = "";
      }
      this.wasAny = false;
      return;
    }
    this.wasAny = true;
    // only a pointer over the stage itself (not a control, nor the CV sheet over it) lights a star, as in fig. 3 (the
    // star card lets the pointer through, so over it the stage is still under the pointer)
    const pointer = !touch && hold.inside && hold.overStage && hoverOn;
    const tx = (hold.tx * 0.5 + 0.5) * W;
    const ty = (0.5 - hold.ty * 0.5) * H;
    let nearest = -1;
    let nearestD = 1e9;
    let tapD = pick;
    for (let i = 0; i < n; i++) {
      const lit = ss(0, 0.16, (T - a) / (b - a) - this.at[i] * 0.84);
      const p = this.v2
        .set(this.local[i * 3], this.local[i * 3 + 1], this.local[i * 3 + 2])
        .applyMatrix3(M)
        .add(this.o);
      this.live[i * 3] = lit;
      this.dist[i] = 1e9;
      // every lit star carries the ink and answers the pointer (an unnamed one says so, and opens Work)
      const on = lit * out;
      if (on > 0.01) setAnchor(STARS[i].id, p.x, p.y, p.z, 0, on);
      if (!hoverOn || lit < 0.5) continue;
      p.project(cam);
      if (p.z > 1) continue;
      const sx = (p.x * 0.5 + 0.5) * W;
      const sy = (0.5 - p.y * 0.5) * H;
      this.scr[i * 2] = sx;
      this.scr[i * 2 + 1] = sy;
      if (pointer) {
        const d = Math.hypot(sx - hold.x, sy - hold.y);
        this.dist[i] = d;
        if (d < nearestD) {
          nearestD = d;
          nearest = i;
        }
      }
      if (tap) {
        const d = Math.hypot(sx - tx, sy - ty);
        if (d < tapD) {
          tapD = d;
          tapped = i;
        }
      }
    }
    // the card beside the star it names: the pointer over it keeps that star, a click or a tap on it opens it
    const pad = touch ? 10 : 4;
    if (tap && this.hover >= 0 && onCard(tx, ty, pad)) tapped = this.hover;
    let h = this.hover;
    if (touch) {
      // on touch the first tap on a star names it, a second tap on it (or on its card) goes there; a tap elsewhere
      // lets go
      if (tap) {
        if (tapped >= 0 && tapped === this.touchSel) this.go(tapped);
        this.touchSel = tapped;
      }
      if (!hoverOn) this.touchSel = -1;
      h = this.touchSel;
    } else {
      if (tap && tapped >= 0) this.go(tapped);
      if (!pointer) h = -1;
      else {
        // (over its card, or on the way out to it, the star stays named, unless the pointer is right on another star)
        const held =
          h >= 0 &&
          this.dist[h] < 1e8 &&
          toCard(this.scr[h * 2], this.scr[h * 2 + 1], hold.x, hold.y, pad) &&
          !(nearest !== h && nearestD < PICK * 0.5);
        if (h >= 0 && !held && this.dist[h] > KEEP) h = -1;
        if (h >= 0 && !held && nearest !== h && nearestD < PICK && nearestD < this.dist[h] * 0.5)
          h = nearest;
        if (h < 0 && nearestD < PICK) h = nearest;
      }
    }
    this.hover = hoverOn ? h : -1;
    shared.play.hoverStar = this.hover >= 0 ? STARS[this.hover].slug : "";
    // the nearest star within NEAR px brightens (a platform the site names also rings) as the pointer comes (the one
    // named by the pointer: fully)
    const nearK =
      nearest >= 0 ? Math.min(1, Math.max(0, (NEAR - nearestD) / (NEAR - PICK))) ** 0.7 : 0;
    for (let i = 0; i < n; i++) {
      this.hov[i] = damp(this.hov[i], i === this.hover ? 1 : 0, 9, dt);
      this.near[i] = damp(this.near[i], i === this.hover ? 1 : i === nearest ? nearK : 0, 8, dt);
      this.live[i * 3 + 1] = this.hov[i];
      this.live[i * 3 + 2] = this.near[i];
    }
    this.liveAttr.needsUpdate = true;
  }

  /** Start over (src/lib/restart.ts): no star hovered or named, no tap pending. */
  reset() {
    this.hov.fill(0);
    this.near.fill(0);
    this.dist.fill(1e9);
    this.hover = -1;
    this.touchSel = -1;
    this.lastTap = hold.tapAt;
    shared.play.hoverStar = "";
  }

  /** Go to the star's platform in Work (the scroll API the fast lane uses). */
  private go(i: number) {
    jumpTo(this.jumpIds[i], { focus: true });
  }

  /**
   * The thread at our star (the galaxy's origin: the sun's place, then the observer's as the eye falls home), the
   * star your point has become (anchor `yours`), and anchor `system` (the whole system as one star) on the same spot,
   * until the sky takes the thread (figures/sky.ts rise).
   */
  private thread(f: FrameCtx) {
    const T = f.T;
    if (T < F.again || T >= GALAXY_T.out) return;
    const on = ss(GALAXY_T.star[0], GALAXY_T.star[1], T);
    if (on <= 0.002) return;
    const o = this.o;
    // the sun hides behind the world early in the pull-back: so does the star it becomes
    const vis = on * (1 - f.hidden(o));
    // the ink's circle sits around the sun's body, not on the point
    setAnchor(ANCHOR.system, o.x, o.y, o.z, SUN_R, vis);
    setAnchor(ANCHOR.yours, o.x, o.y, o.z, 0, vis);
  }

  dispose() {
    window.removeEventListener("resize", this.onResize);
    cancelAnimationFrame(this.resizeRaf);
    this.disk.geometry.dispose();
    this.diskM.dispose();
    this.core.geometry.dispose();
    this.coreM.dispose();
    this.stars.geometry.dispose();
    this.starsM.dispose();
  }
}
