/**
 * Your point's gravity assist (docs/STORY.md figs 6-7): the launch plan, the flight, its trail and the planets'
 * ripples.
 *
 * The plan is one trajectory from your point's close orbit, swinging past product, engineering, data and operations
 * in turn, then falling onto the world's night side at the hub (src/gl/world/layout.ts HUB), touching it exactly at
 * journey HANDOFF.ARRIVE. Each flyby is a real slingshot bend: an arc around the planet at its periapsis distance,
 * the planet on the inside of the turn, joined to the next by smooth Hermite legs. The flight is scrubbed by story
 * time from the launch (shared.play.launchT) to ARRIVE: a monotone cubic clock through the events (the launch, each
 * periapsis at its flyby time, the hub), faster on every leg.
 *
 * The planets' marks (constants.ts PLANETS mark) are where they wait for your point on the default plan (launched at
 * the end of the countdown); the default plan sets each planet's slide onto its mark (orbits.ts SLIDE_D) and your
 * point's (POINT_D) at module load. A visitor's click in the countdown launches earlier: the plan is rebuilt once for
 * that launch from where the planets really are at its flyby times (they creep: the planets make up for it).
 *
 * Draws the flown trail as a luminous ribbon that fades along its length (white at the head to gold, additive; it
 * tapers off at the head, so no blob: the thread sprite is the head) and a faint ripple at each planet as your point
 * borrows its pull. Writes anchor `probe` (and `yours` in flight), paths `assist` (the plan, 64 points, figs 6-7)
 * and `trail` (the flown part, fixed points growing from its head), shared.play launchT / launchByVisitor /
 * launchTiming / speed / flybys. No allocations per frame (a plan is rebuilt into preallocated buffers on a launch).
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  type Scene,
  ShaderMaterial,
  Vector3,
  Vector4,
} from "three";
import { HUB } from "@/gl/world/layout";
import { HANDOFF, PLANET } from "@/lib/journey";
import type { GLTier } from "@/lib/tier";
import { PLANETS, SUN } from "../constants";
import { ss } from "../frame";
import { clock, POINT_D, planetAt, SLIDE_D, wrap2pi } from "./orbits";
import { SYSTEM_T } from "./system-times";
import { CLOSE_SPEED, closeOrbitAt, closeOrbitBase, closeOrbitDir, ORBIT_R } from "./thread";

/** The flybys in order: product, engineering, data, operations (then the world). */
export const ORDER = [1, 0, 3, 4] as const;
const NF = ORDER.length;
/** Periapsis distance at each flyby (world units: clear of the body; the giant's rings reach 2.45 of its radius). */
const QF = [5.6, 3.6, 16, 6.6];
/** The least each flyby bends your point's path (rad): a real slingshot turn, more where the path asks for it. */
const BEND = [1.05, 1.35, 1.0, 1.7];
/** Your point's speed as the ink reads it (km/s): at the launch and after each flyby; and falling onto the world. */
const KM = [11, 17, 24, 36, 42];
const KM_END = 46;
/** Relative speed (world units per story time) of each leg, launch to hub: faster after every pass. */
const VREL = [1, 1.3, 1.65, 2.05, 2.45];
/** Where your point leaves its close orbit (its angle there, ./thread.ts): heading out toward product. */
const LAUNCH_A = 0.8;
/** The fall onto the hub: the direction it arrives in (into the night side, from up and to the right of the camera). */
const U_END = new Vector3(-0.42, -0.3, -0.86).normalize();

/** The default launch (the end of the countdown) and the arrival. */
export const L_DEF = SYSTEM_T.launch[0];
const ARR = HANDOFF.ARRIVE;
/** The hub on the world at rest (journey PLANET), where your point lands. */
export const HUB_P = new Vector3(...PLANET.center).addScaledVector(HUB, PLANET.radius);

/** Upper bounds of a plan's samples, the ink's points. */
const NMAX = 1400;
const ASSIST_N = 64;
const TRAIL_N = 128;

const UP = new Vector3(0, 1, 0);

/** A launch plan: the dense trajectory, its arc lengths, its flybys and its clock. */
export class Plan {
  L = -1;
  n = 0;
  total = 0;
  readonly p = new Float32Array(NMAX * 3);
  readonly cum = new Float32Array(NMAX);
  /** Per flyby: the planet's centre then, its flyby time, and the arc's start, periapsis and end (arc length). */
  readonly C = ORDER.map(() => new Vector3());
  readonly tk = new Float32Array(NF);
  readonly sIn = new Float32Array(NF);
  readonly sPeri = new Float32Array(NF);
  readonly sOut = new Float32Array(NF);
  /** The clock's events: the launch, each periapsis, the hub (time, arc length, speed in units per story time). */
  readonly tEv = new Float32Array(NF + 2);
  readonly sEv = new Float32Array(NF + 2);
  readonly vEv = new Float32Array(NF + 2);
  /** The launch point and direction (on the close orbit). */
  readonly s0 = new Vector3();
  readonly u0 = new Vector3();
  readonly launchA = { value: LAUNCH_A };
  /** The ink's sample positions (arc length): the plan (64) and the trail (128), denser around each flyby. */
  readonly assistS = new Float32Array(ASSIST_N);
  readonly trailS = new Float32Array(TRAIL_N);
  /** Bumped on every rebuild (the ribbon re-uploads). */
  version = 0;

  /** Arc length of your point at story time T (negative before the launch: back along its close orbit). */
  sAt(T: number) {
    if (T <= this.L) return -CLOSE_SPEED * (this.L - T);
    if (T >= ARR) return this.total + (T - ARR) * this.vEv[NF + 1];
    let j = 0;
    while (j < NF && T > this.tEv[j + 1]) j++;
    const ta = this.tEv[j];
    const h = this.tEv[j + 1] - ta;
    const u = (T - ta) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * this.sEv[j] +
      (u3 - 2 * u2 + u) * h * this.vEv[j] +
      (-2 * u3 + 3 * u2) * this.sEv[j + 1] +
      (u3 - u2) * h * this.vEv[j + 1]
    );
  }

  /** The point at arc length s (before 0: back along the close orbit; past the end: on at the hub). */
  at(s: number, out: Vector3) {
    if (s <= 0) return closeOrbitAt(this.launchA.value + s / ORBIT_R, out);
    if (s >= this.total) return out.copy(HUB_P);
    const cum = this.cum;
    let lo = 0;
    let hi = this.n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const f = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
    const p = this.p;
    const a = lo * 3;
    const b = hi * 3;
    return out.set(
      p[a] + (p[b] - p[a]) * f,
      p[a + 1] + (p[b + 1] - p[a + 1]) * f,
      p[a + 2] + (p[b + 2] - p[a + 2]) * f,
    );
  }

  /** Your point's speed at arc length s as the ink reads it (km/s). */
  km(s: number) {
    if (s <= this.sIn[0]) return KM[0];
    for (let k = 0; k < NF; k++) {
      if (s < this.sIn[k]) return KM[k];
      if (s <= this.sOut[k]) return KM[k] + (KM[k + 1] - KM[k]) * ss(this.sIn[k], this.sOut[k], s);
    }
    return KM[NF] + (KM_END - KM[NF]) * ss(this.sOut[NF - 1], this.total, s) ** 1.6;
  }

  /** Flybys done by arc length s (0..4: counted as your point leaves each arc). */
  flybys(s: number) {
    let n = 0;
    for (let k = 0; k < NF; k++) if (s >= this.sOut[k]) n++;
    return n;
  }
}

/* ---------------------------------------------------------------- building a plan */

const v4 = new Vector3();
const din = new Vector3();
const dout = new Vector3();
const bis = new Vector3();
const axis = new Vector3();
const vecs = () => Array.from({ length: NF }, () => new Vector3());
const uIn = vecs();
const uOut = vecs();
const ax = vecs();
const bend = new Float32Array(NF);
const entry = vecs();
const exit = vecs();

/** v ⟂ m rotated about the unit axis m by angle a. */
function rot(v: Vector3, m: Vector3, a: number, out: Vector3) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  // m × v
  const x = m.y * v.z - m.z * v.y;
  const y = m.z * v.x - m.x * v.z;
  const z = m.x * v.y - m.y * v.x;
  return out.set(v.x * c + x * s, v.y * c + y * s, v.z * c + z * s);
}

function push(pl: Plan, x: number, y: number, z: number) {
  if (pl.n >= NMAX) return;
  const i = pl.n * 3;
  if (pl.n > 0) {
    const dx = x - pl.p[i - 3];
    const dy = y - pl.p[i - 2];
    const dz = z - pl.p[i - 1];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-4) return;
    pl.cum[pl.n] = pl.cum[pl.n - 1] + d;
  } else pl.cum[0] = 0;
  pl.p[i] = x;
  pl.p[i + 1] = y;
  pl.p[i + 2] = z;
  pl.n++;
}

/** A Hermite leg from a (direction ua) to b (direction ub), its tangents scaled to the chord. */
function leg(pl: Plan, a: Vector3, ua: Vector3, b: Vector3, ub: Vector3) {
  const len = a.distanceTo(b);
  const m = len * 1.05;
  const n = Math.min(240, Math.max(12, Math.ceil(len / 0.42)));
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = (u3 - 2 * u2 + u) * m;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = (u3 - u2) * m;
    push(
      pl,
      h00 * a.x + h10 * ua.x + h01 * b.x + h11 * ub.x,
      h00 * a.y + h10 * ua.y + h01 * b.y + h11 * ub.y,
      h00 * a.z + h10 * ua.z + h01 * b.z + h11 * ub.z,
    );
  }
}

/** The flyby arc around C: the direction turns from uIn about m by `bend`, the planet on the inside (radius q). */
function arc(pl: Plan, C: Vector3, q: number, u: Vector3, m: Vector3, b: number) {
  const n = Math.min(90, Math.max(10, Math.ceil((q * b) / 0.28)));
  for (let i = 1; i <= n; i++) {
    rot(u, m, (b * i) / n, v4);
    // P = C + q (u × m)
    push(
      pl,
      C.x + q * (v4.y * m.z - v4.z * m.y),
      C.y + q * (v4.z * m.x - v4.x * m.z),
      C.z + q * (v4.x * m.y - v4.y * m.x),
    );
  }
}

/** Fill `out` with `count` arc lengths along the plan, the flyby arcs given `perArc` each, the legs the rest by length. */
function samples(pl: Plan, out: Float32Array, perArc: number) {
  const count = out.length;
  const legLen = (j: number) =>
    j === 0 ? pl.sIn[0] : j === NF ? pl.total - pl.sOut[NF - 1] : pl.sIn[j] - pl.sOut[j - 1];
  let legsTotal = 0;
  for (let j = 0; j <= NF; j++) legsTotal += legLen(j);
  const legPts = count - 1 - perArc * NF;
  let i = 0;
  out[i++] = 0;
  let used = 0;
  for (let j = 0; j <= NF; j++) {
    const a = j === 0 ? 0 : pl.sOut[j - 1];
    const len = legLen(j);
    const n = j === NF ? legPts - used : Math.max(3, Math.round((legPts * len) / legsTotal));
    used += n;
    for (let q = 1; q <= n && i < count; q++) out[i++] = a + (len * q) / n;
    if (j < NF)
      for (let q = 1; q <= perArc && i < count; q++)
        out[i++] = pl.sIn[j] + ((pl.sOut[j] - pl.sIn[j]) * q) / perArc;
  }
  while (i < count) out[i++] = pl.total;
}

/**
 * Build the plan for a launch at story time L into `pl`. `C` gives the planets' centres at their flyby times (the
 * default plan: their marks; a visitor's: where they really are then); `U` the flyby times as fractions of the flight.
 */
function build(pl: Plan, L: number, U: Float32Array, marks: boolean) {
  pl.L = L;
  pl.n = 0;
  // the launch: your point on its close orbit at L, heading on along it
  const a0 = launchAngle(L);
  pl.launchA.value = a0;
  closeOrbitAt(a0, pl.s0);
  closeOrbitDir(a0, pl.u0);
  for (let k = 0; k < NF; k++) {
    const t = L + U[k] * (ARR - L);
    pl.tk[k] = t;
    const i = ORDER[k];
    if (marks) {
      const p = PLANETS[i];
      pl.C[k].set(SUN[0] + Math.cos(p.mark) * p.orbit, SUN[1], SUN[2] + Math.sin(p.mark) * p.orbit);
    } else planetAt(i, t, 1, pl.C[k]);
  }
  // each flyby's turn: around the bisector of the way in and the way out, about their common normal
  for (let k = 0; k < NF; k++) {
    const C = pl.C[k];
    const prev = k === 0 ? pl.s0 : pl.C[k - 1];
    const next = k === NF - 1 ? HUB_P : pl.C[k + 1];
    din.subVectors(C, prev).normalize();
    dout.subVectors(next, C).normalize();
    bis.addVectors(din, dout).normalize();
    axis.crossVectors(din, dout);
    if (axis.lengthSq() < 1e-6) axis.copy(UP);
    axis.addScaledVector(bis, -axis.dot(bis)).normalize();
    const nat = Math.acos(Math.min(1, Math.max(-1, din.dot(dout))));
    bend[k] = Math.max(BEND[k], nat * 1.15);
    ax[k].copy(axis);
    rot(bis, axis, -bend[k] / 2, uIn[k]);
    rot(bis, axis, bend[k] / 2, uOut[k]);
    const q = QF[k];
    // entry = C + q (uIn × m), exit = C + q (uOut × m)
    entry[k].crossVectors(uIn[k], axis).multiplyScalar(q).add(C);
    exit[k].crossVectors(uOut[k], axis).multiplyScalar(q).add(C);
  }
  // the samples: leg, arc, leg, arc, ..., the fall onto the hub
  push(pl, pl.s0.x, pl.s0.y, pl.s0.z);
  for (let k = 0; k < NF; k++) {
    if (k === 0) leg(pl, pl.s0, pl.u0, entry[0], uIn[0]);
    else leg(pl, exit[k - 1], uOut[k - 1], entry[k], uIn[k]);
    pl.sIn[k] = pl.cum[pl.n - 1];
    arc(pl, pl.C[k], QF[k], uIn[k], ax[k], bend[k]);
    pl.sOut[k] = pl.cum[pl.n - 1];
    pl.sPeri[k] = (pl.sIn[k] + pl.sOut[k]) / 2;
  }
  leg(pl, exit[NF - 1], uOut[NF - 1], HUB_P, U_END);
  pl.total = pl.cum[pl.n - 1];

  // the clock: launch, periapses, hub
  pl.tEv[0] = L;
  pl.sEv[0] = 0;
  for (let k = 0; k < NF; k++) {
    pl.tEv[k + 1] = pl.tk[k];
    pl.sEv[k + 1] = pl.sPeri[k];
  }
  pl.tEv[NF + 1] = ARR;
  pl.sEv[NF + 1] = pl.total;
  // speeds: from the close orbit's at the launch; at each periapsis a little over the faster of its two legs (it is
  // fastest there), within what keeps the clock monotone; still gaining as it falls onto the world
  pl.vEv[0] = CLOSE_SPEED;
  for (let j = 1; j <= NF; j++) {
    const a = (pl.sEv[j] - pl.sEv[j - 1]) / (pl.tEv[j] - pl.tEv[j - 1]);
    const b = (pl.sEv[j + 1] - pl.sEv[j]) / (pl.tEv[j + 1] - pl.tEv[j]);
    pl.vEv[j] = Math.min(1.22 * Math.max(a, b), 2.6 * Math.min(a, b));
  }
  const last = (pl.sEv[NF + 1] - pl.sEv[NF]) / (pl.tEv[NF + 1] - pl.tEv[NF]);
  pl.vEv[NF + 1] = Math.min(1.25 * last, 2.6 * last);
  samples(pl, pl.assistS, 4);
  samples(pl, pl.trailS, 8);
  pl.version++;
}

/** Your point's angle on its close orbit at a launch at L (it is on its mark at the default launch). */
function launchAngle(L: number) {
  return closeOrbitBase(L) + POINT_D.value;
}

/* ---------------------------------------------------------------- the default plan, the slides onto the marks */

/** Flyby times as fractions of the flight, from the default plan (the legs' lengths over their relative speeds). */
const U_DEF = new Float32Array(NF);

function initDefault(pl: Plan) {
  // the planets sit on their marks; the flight's legs take their time by length over their relative speed
  POINT_D.value = wrap2pi(LAUNCH_A - closeOrbitBase(L_DEF));
  for (let k = 0; k < NF; k++) U_DEF[k] = (k + 1) / (NF + 1);
  build(pl, L_DEF, U_DEF, true);
  let sum = 0;
  const d = new Float32Array(NF + 1);
  for (let j = 0; j <= NF; j++) {
    d[j] = (pl.sEv[j + 1] - pl.sEv[j]) / VREL[j];
    sum += d[j];
  }
  let acc = 0;
  for (let k = 0; k < NF; k++) {
    acc += d[k];
    U_DEF[k] = acc / sum;
  }
  build(pl, L_DEF, U_DEF, true);
  // each planet slides onto its mark (forward) by its flyby time
  for (let k = 0; k < NF; k++) {
    const i = ORDER[k];
    const p = PLANETS[i];
    SLIDE_D[i] = wrap2pi(p.mark - (p.l0 + p.ws * clock(pl.tk[k])));
  }
}

/** The default plan (launched at the end of the countdown), built once at load. */
export const DEFAULT = new Plan();
initDefault(DEFAULT);

/**
 * The flight the show is on: the default plan, or the plan of the visitor's own launch (rebuilt once per click).
 * The rig (poses/system.ts) reads it for the chase.
 */
export const FLIGHT = {
  plan: DEFAULT,
  /** Story time of the visitor's launch click (-1: none, the default launch). */
  clickT: -1,
};
const VISITOR = new Plan();

/**
 * Launch at the visitor's click (story time T in the countdown), or back to the default plan (T < 0). A click at the
 * default launch's moment flies the default plan itself (the planets are on their marks for it).
 */
export function setLaunch(T: number) {
  if (T < 0) {
    FLIGHT.clickT = -1;
    FLIGHT.plan = DEFAULT;
    return;
  }
  FLIGHT.clickT = Math.min(T, L_DEF);
  if (T >= L_DEF) {
    FLIGHT.plan = DEFAULT;
    return;
  }
  build(VISITOR, T, U_DEF, false);
  FLIGHT.plan = VISITOR;
}

/* ---------------------------------------------------------------- the trail and the ripples */

const RIBBON_VERT = /* glsl */ `
attribute vec3 aT;
attribute float aS;
attribute float aSide;
uniform float uHead;
uniform float uProj;
uniform float uDpr;
uniform float uPx;
varying float vD;
varying float vSide;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 t = (modelViewMatrix * vec4(aT, 0.0)).xyz;
  vec3 side = cross(t, normalize(mv.xyz));
  float sl = length(side);
  side = sl > 1e-5 ? side / sl : vec3(0.0, 1.0, 0.0);
  float d = uHead - aS;
  float depth = max(-mv.z, 0.1);
  // a few CSS px wide whatever the distance, thinning along its length
  float px = uPx * mix(1.0, 0.45, smoothstep(0.0, 90.0, d));
  mv.xyz += side * aSide * px * uDpr * depth / uProj;
  gl_Position = projectionMatrix * mv;
  vD = d;
  vSide = aSide;
}
`;

/**
 * The page's own places, in device px (uView: width, height, the band's top from the top, its half-width; uSpine: where
 * the side spine's column begins): the copy's band (the figure's lines and the hint ring) and the spine. The trail and
 * the ripples are GL, under the ink's own mask, so they dim themselves there: to a quarter in the band, almost away
 * under the spine's ticks and names.
 */
const PAGE_MASK = /* glsl */ `
uniform vec4 uView;
uniform float uSpine;
float pageMask() {
  vec2 p = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  float f = 40.0 * uView.y / 900.0;
  float band = smoothstep(uView.z - f, uView.z + f, p.y) * (1.0 - smoothstep(uView.w - f, uView.w + f, abs(p.x - uView.x * 0.5)));
  float spine = smoothstep(uSpine - f * 1.5, uSpine + f * 0.5, p.x);
  return (1.0 - 0.75 * band) * (1.0 - 0.97 * spine);
}
`;

const RIBBON_FRAG = /* glsl */ `
uniform float uI;
uniform float uFade;
varying float vD;
varying float vSide;
${PAGE_MASK}
void main() {
  if (vD < 0.0) discard;
  // a hot core and a soft glow across it
  float x2 = vSide * vSide;
  float across = (exp(-x2 * 9.0) * 0.75 + exp(-x2 * 2.2) * 0.3) * (1.0 - x2);
  // white at the head, gold behind it, a deep amber far back; it fades along its length but never quite goes
  vec3 white = vec3(1.0, 0.95, 0.86);
  vec3 gold = vec3(0.95, 0.62, 0.26);
  vec3 amber = vec3(0.72, 0.3, 0.09);
  vec3 c = mix(gold, white, exp(-vD / 5.0));
  c = mix(amber, c, exp(-vD / 90.0));
  float fall = 0.14 + 0.86 * exp(-vD / uFade);
  // no blob at the head: the thread sprite is the head; the ribbon grows out of it
  float head = smoothstep(0.0, 1.6, vD);
  gl_FragColor = vec4(c * across * fall * head * uI * pageMask(), 1.0);
}
`;

/** A flyby's ripple: one hairline swelling a little way out from the planet, faint (never a reticle). */
const RIPPLE_FRAG = /* glsl */ `
uniform float uR;
uniform float uW;
uniform float uI;
uniform vec3 uCol;
varying vec2 vUv;
${PAGE_MASK}
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float x = (r - uR) / uW;
  float ring = exp(-x * x);
  float fill = smoothstep(uR * 0.7, uR, r) * step(r, uR) * 0.03;
  float v = (ring + fill) * (1.0 - smoothstep(0.86, 1.0, r));
  gl_FragColor = vec4(uCol * v * uI * pageMask(), 1.0);
}
`;

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

/** The ripple's tint per planet (its own light, warmed toward gold). */
const RIPPLE_COL: [number, number, number][] = [
  [1.0, 0.55, 0.3],
  [1.0, 0.8, 0.5],
  [0.6, 0.75, 1.0],
  [1.0, 0.82, 0.6],
  [0.66, 0.88, 1.0],
];
/** A ripple's life in story time (it swells out from the planet as your point swings past). */
const RIPPLE_T = 0.075;

export class Trail {
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  readonly ripples: { mesh: Mesh; m: ShaderMaterial }[] = [];
  private geo: BufferGeometry;
  private pos: Float32Array;
  private tan: Float32Array;
  private sArr: Float32Array;
  private version = -1;
  private planRef: Plan | null = null;
  private stride: number;
  private rippleOn: boolean;
  /** The page's places in device px (PAGE_MASK): one uniform each, shared by the ribbon and the ripples. */
  private viewU = { value: new Vector4(1, 1, 1e5, 0) };
  private spineU = { value: 1e5 };

  constructor(tier: GLTier) {
    // the low tier draws every third sample of the plan, the medium every second
    this.stride = tier === "high" ? 1 : tier === "medium" ? 2 : 3;
    this.rippleOn = tier !== "low";
    const n = Math.ceil(NMAX / this.stride);
    this.pos = new Float32Array(n * 2 * 3);
    this.tan = new Float32Array(n * 2 * 3);
    this.sArr = new Float32Array(n * 2);
    const side = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
    }
    const idx = new Uint16Array((n - 1) * 6);
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
    this.geo = new BufferGeometry();
    this.geo.setAttribute("position", new BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aT", new BufferAttribute(this.tan, 3));
    this.geo.setAttribute("aS", new BufferAttribute(this.sArr, 1));
    this.geo.setAttribute("aSide", new BufferAttribute(side, 1));
    this.geo.setIndex(new BufferAttribute(idx, 1));
    this.geo.setDrawRange(0, 0);
    this.mat = new ShaderMaterial({
      uniforms: {
        uHead: { value: 0 },
        uProj: { value: 1000 },
        uDpr: { value: 1 },
        uPx: { value: tier === "low" ? 1.8 : 2.4 },
        uI: { value: 0 },
        uFade: { value: 48 },
        uView: this.viewU,
        uSpine: this.spineU,
      },
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 4;
    for (let k = 0; k < NF; k++) {
      const m = new ShaderMaterial({
        uniforms: {
          uCenter: { value: new Vector3() },
          uSize: { value: [1, 1] },
          uR: { value: 0.3 },
          uW: { value: 0.05 },
          uI: { value: 0 },
          uCol: { value: new Vector3(...RIPPLE_COL[ORDER[k]]) },
          uView: this.viewU,
          uSpine: this.spineU,
        },
        vertexShader: BILLBOARD,
        fragmentShader: RIPPLE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(new PlaneGeometry(2, 2), m);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.ripples.push({ mesh, m });
    }
  }

  mount(scene: Scene) {
    scene.add(this.mesh);
    for (const r of this.ripples) scene.add(r.mesh);
  }
  unmount(scene: Scene) {
    scene.remove(this.mesh);
    for (const r of this.ripples) scene.remove(r.mesh);
  }

  /**
   * The page's places this frame (device px): the canvas, the copy's band (its top from the top, 67 % of the height
   * on a desktop and 56 % on a phone; its half-width, the lines' measure, the whole width on a phone) and the side
   * spine's column (the last 250 CSS px; a phone has none).
   */
  setView(width: number, height: number, dpr: number) {
    const phone = width / Math.max(1, height) < 0.95;
    this.viewU.value.set(
      width,
      height,
      height * (phone ? 0.555 : 0.665),
      phone ? width : Math.min(width * 0.36, 560 * dpr),
    );
    this.spineU.value = phone ? 1e5 : width - 250 * dpr;
  }

  /** Upload a plan's samples (on a new plan only). */
  private upload(pl: Plan) {
    const st = this.stride;
    let m = 0;
    for (let i = 0; i < pl.n; i += st) {
      const j = Math.min(i, pl.n - 1);
      const a = Math.max(0, j - 1) * 3;
      const b = Math.min(pl.n - 1, j + 1) * 3;
      let tx = pl.p[b] - pl.p[a];
      let ty = pl.p[b + 1] - pl.p[a + 1];
      let tz = pl.p[b + 2] - pl.p[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      for (let s = 0; s < 2; s++) {
        const o = (m * 2 + s) * 3;
        this.pos[o] = pl.p[j * 3];
        this.pos[o + 1] = pl.p[j * 3 + 1];
        this.pos[o + 2] = pl.p[j * 3 + 2];
        this.tan[o] = tx;
        this.tan[o + 1] = ty;
        this.tan[o + 2] = tz;
        this.sArr[m * 2 + s] = pl.cum[j];
      }
      m++;
    }
    this.geo.setDrawRange(0, Math.max(0, (m - 1) * 6));
    (this.geo.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("aT") as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("aS") as BufferAttribute).needsUpdate = true;
  }

  /**
   * One frame: the ribbon to the head (arc length `s`), `on` 0..1; the ripples at the planets (`centre(k)` gives each
   * flyby planet's centre now) as story time T passes their flyby times.
   */
  frame(
    pl: Plan,
    s: number,
    on: number,
    T: number,
    proj: number,
    dpr: number,
    dim: number,
    centre: (k: number) => Vector3,
    worldPx: (p: Vector3, px: number) => number,
  ) {
    if (this.planRef !== pl || this.version !== pl.version) {
      this.planRef = pl;
      this.version = pl.version;
      this.upload(pl);
    }
    const u = this.mat.uniforms;
    this.mesh.visible = on > 0.002 && s > 0;
    u.uHead.value = s;
    u.uProj.value = proj;
    u.uDpr.value = dpr;
    u.uI.value = on * 1.15 * dim;
    for (let k = 0; k < NF; k++) {
      const r = this.ripples[k];
      const age = (T - pl.tk[k]) / RIPPLE_T;
      const I = this.rippleOn ? ss(-0.25, 0.05, age) * (1 - ss(0.2, 1, age)) * on : 0;
      r.mesh.visible = I > 0.003;
      if (!r.mesh.visible) continue;
      const c = centre(k);
      const R = PLANETS[ORDER[k]].r;
      const g = Math.max(0, age);
      // it swells from the limb (the giant's from beyond its rings) a little way out, a hairline, faint
      const giant = ORDER[k] === 3;
      const r0 = R * (giant ? 2.5 : 1.15);
      const reach = R * (giant ? 2.85 : 2.3);
      const rr = r0 + (reach - r0) * (1 - (1 - Math.min(1, g)) ** 2);
      const size = rr * 1.25;
      const m = r.m.uniforms;
      m.uCenter.value.copy(c);
      m.uSize.value[0] = size;
      m.uSize.value[1] = size;
      m.uR.value = rr / size;
      m.uW.value = worldPx(c, 0.9 + 0.5 * g) / size;
      m.uI.value = I * (giant ? 0.05 : 0.065) * dim;
    }
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    for (const r of this.ripples) {
      r.mesh.geometry.dispose();
      r.m.dispose();
    }
  }
}
