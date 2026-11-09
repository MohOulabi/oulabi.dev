/**
 * The planets' orbits (docs/STORY.md figs 4-7), as pure functions of story time and the alignment (0 messy, 1 clean).
 *
 * Fig. 4: each planet arrives on its messy orbit (constants.ts PLANETS mess): an ellipse around the sun, a little
 * inclined, its periapsis precessing. Fig. 5: the alignment draws every orbit into its clean ring (e 0, in the disk
 * plane, radius `orbit`); a planet keeps its longitude as its orbit changes shape (it moves along its radius, never
 * backward). Fig. 6: the planet clock slows to CREEP of story time over the window's slide (the planets keep orbiting,
 * slowly: your point will be far faster than they are) and each planet slides onto its mark (SLIDE_D, set once by the
 * launch plan in ./probe.ts) so the launch trajectory threads them; the world comes to rest at journey PLANET by
 * HANDOFF.WORLD_FROM. Your point's close orbit slides onto its launch mark the same way (POINT_D).
 *
 * No show-time drift: the planets are a function of story time alone, so a near miss is a near miss on every visit
 * and scrolling back replays them backwards. No allocations per frame.
 */
import { Vector3 } from "three";
import { F, HANDOFF } from "@/lib/journey";
import { PLANETS, SUN, WORLD } from "../constants";
import { ss } from "../frame";
import { SYSTEM_T } from "./system-times";
import { CLOSE_DRIFT, closeOrbitBase } from "./thread";

const TAU = Math.PI * 2;
/** An angle into [0, 2π) and into [-π, π). */
export const wrap2pi = (a: number) => a - TAU * Math.floor(a / TAU);
export const wrapPi = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

/** The planet clock's rate once the window is set, as a share of story time. */
const CREEP = 0.12;
const [S0, S1] = SYSTEM_T.slide;
const SW = S1 - S0;
/** ∫ smoothstep (the clock's slowing over the slide), continued linearly past its end. */
const ssInt = (x: number) => (x <= 0 ? 0 : x >= 1 ? x - 0.5 : x * x * x - 0.5 * x * x * x * x);
/** The planet clock: figures of planet time since F.gathering (story time, slowed to CREEP over the window's slide). */
export const clock = (T: number) => T - F.gathering - (1 - CREEP) * SW * ssInt((T - S0) / SW);

/** The world eases to rest at journey PLANET by HANDOFF.WORLD_FROM over 2 EASE of story time (after the slide). */
const REST = HANDOFF.WORLD_FROM;
const EASE = 0.3;
const REST_C = clock(REST - 2 * EASE);
/** The world's clock: the planet clock brought to a smooth stop at REST (it meets 0 with zero speed). */
function worldClock(T: number) {
  if (T >= REST) return 0;
  if (T > REST - 2 * EASE) return (-CREEP * (REST - T) ** 2) / (4 * EASE);
  return clock(T) - REST_C - CREEP * EASE;
}

/** Each planet's slide onto its mark over SYSTEM_T.slide (rad, never backward), and your point's; set by ./probe.ts. */
export const SLIDE_D = new Float32Array(PLANETS.length);
export const POINT_D = { value: 0 };

/** Mean longitude of planet k at story time T (rad, from +x toward +z about the sun). */
export function longitude(k: number, T: number) {
  const p = PLANETS[k];
  if (k === WORLD) return p.l0 + p.ws * worldClock(T);
  return p.l0 + p.ws * clock(T) + SLIDE_D[k] * ss(S0, S1, T);
}

/**
 * Your point's angle on its close orbit (./thread.ts): the story-time angle genesis hands over, the show-time drift
 * (`drift`, rad: held still and let go of across the slide by the caller, so it never pops), and its slide onto the
 * launch mark.
 */
export function pointAngle(T: number, drift: number) {
  const k = ss(S0, S1, T);
  return closeOrbitBase(T) + drift * (1 - k) + POINT_D.value * k;
}
/** The close orbit's drift per second of show time (rad), for the caller's latch. */
export const POINT_DRIFT = CLOSE_DRIFT;
/** Where the latch must hold: the slide is under way (from its start). */
export const slideOn = (T: number) => T > S0;

/* ---- the orbit's shape ---- */

/** Orbit elements of planet k at story time T for alignment A (written into `out`: a, e, peri, inc, node). */
function elements(k: number, T: number, A: number, out: Float32Array, o = 0) {
  const p = PLANETS[k];
  const m = p.mess;
  out[o] = m.a + (p.orbit - m.a) * A;
  out[o + 1] = m.e * (1 - A);
  out[o + 2] = m.peri + m.prec * (T - F.gathering);
  out[o + 3] = m.inc * (1 - A);
  out[o + 4] = m.node;
  return out;
}

/** Tilt v about the node line (longitude `node`, in the disk plane) by `inc` (Rodrigues). */
function tilt(v: Vector3, inc: number, node: number) {
  if (inc === 0) return v;
  const nx = Math.cos(node);
  const nz = Math.sin(node);
  const c = Math.cos(inc);
  const s = Math.sin(inc);
  const d = nx * v.x + nz * v.z;
  const cx = -nz * v.y;
  const cy = nz * v.x - nx * v.z;
  const cz = nx * v.y;
  return v.set(
    v.x * c + cx * s + nx * d * (1 - c),
    v.y * c + cy * s,
    v.z * c + cz * s + nz * d * (1 - c),
  );
}

/** The orbit's frame: P toward periapsis, Q a quarter turn on, both tilted by the inclination. */
function orbitFrame(peri: number, inc: number, node: number, P: Vector3, Q: Vector3) {
  const c = Math.cos(peri);
  const s = Math.sin(peri);
  tilt(P.set(c, 0, s), inc, node);
  tilt(Q.set(-s, 0, c), inc, node);
}

/** Radius of an ellipse (a, e) at angle nu from its periapsis. */
const orbitR = (a: number, e: number, nu: number) => (a * (1 - e * e)) / (1 + e * Math.cos(nu));

const EL = new Float32Array(5);
const PP = new Vector3();
const QQ = new Vector3();

/** Planet k's position (world) at story time T for alignment A: on its ellipse at its longitude. */
export function planetAt(k: number, T: number, A: number, out: Vector3) {
  elements(k, T, A, EL);
  orbitFrame(EL[2], EL[3], EL[4], PP, QQ);
  const nu = longitude(k, T) - EL[2];
  const r = orbitR(EL[0], EL[1], nu);
  const c = Math.cos(nu) * r;
  const s = Math.sin(nu) * r;
  return out.set(
    SUN[0] + PP.x * c + QQ.x * s,
    SUN[1] + PP.y * c + QQ.y * s,
    SUN[2] + PP.z * c + QQ.z * s,
  );
}

/**
 * The orbits this frame: each planet's elements, frame, angle from periapsis and position, for the planets, the
 * orbit trails (cosmos.ts), the dust lanes (glsl/system.ts gapR) and the ink's orbit paths.
 */
export class Orbits {
  readonly pos = PLANETS.map(() => new Vector3());
  readonly P = PLANETS.map(() => new Vector3());
  readonly Q = PLANETS.map(() => new Vector3());
  /** Per planet: a, e, peri, inc, node (stride 5), and its angle from periapsis. */
  readonly el = new Float32Array(PLANETS.length * 5);
  readonly nu = new Float32Array(PLANETS.length);

  update(T: number, A: number) {
    const el = this.el;
    for (let k = 0; k < PLANETS.length; k++) {
      const o = k * 5;
      elements(k, T, A, el, o);
      const P = this.P[k];
      const Q = this.Q[k];
      orbitFrame(el[o + 2], el[o + 3], el[o + 4], P, Q);
      const nu = longitude(k, T) - el[o + 2];
      this.nu[k] = nu;
      this.at(k, nu, this.pos[k]);
    }
  }

  /** The point of orbit k at angle nu from its periapsis (world). */
  at(k: number, nu: number, out: Vector3) {
    const o = k * 5;
    const r = orbitR(this.el[o], this.el[o + 1], nu);
    const c = Math.cos(nu) * r;
    const s = Math.sin(nu) * r;
    const P = this.P[k];
    const Q = this.Q[k];
    return out.set(
      SUN[0] + P.x * c + Q.x * s,
      SUN[1] + P.y * c + Q.y * s,
      SUN[2] + P.z * c + Q.z * s,
    );
  }
}
