/**
 * The thread (docs/STORY.md "Your point is the thread"): anchor `yours`, the visitor's point, from the hold to the sky.
 * No figure owns all of it: each owner writes `yours` every frame of its own window (src/lib/anchors.ts), and the
 * engine draws the thread sprite wherever it was set (engine.ts thread()). The windows never overlap:
 *
 *   genesis  [0, F.gathering)               the hold point; the bang point; carried by the nebula's map, drifting
 *                                           to its place above the knots (fig. 2, GENESIS_T.home); the slide and
 *                                           the fall with the rest into the chosen knot, now the sun's place, and
 *                                           into the close orbit around it (fig. 3, GENESIS_T.settle)
 *   system   [F.gathering, SYSTEM_T.hub[1])  the close orbit (its show-time drift held, then slid onto the launch
 *                                           mark in fig. 6, orbits.ts pointAngle); the gravity assist from the
 *                                           launch (shared.play.launchT) to the hub (fig. 7, probe.ts); at the hub,
 *                                           fading into the first city (fig. 8)
 *   (none)   storm and flock                  your point has become the world's lights
 *   galaxy   [F.again, SKY_T.rise[0])        our star: the sun's place as the whole system becomes one star (fig. 11),
 *                                           riding the galaxy's origin home to the observer's place as the eye falls
 *                                           back in (fig. 12, GALAXY_T.shift: everything moves with it, unseen)
 *   sky      [SKY_T.rise[0], end)            ahead of the eye it rises out to the saved star in the real sky
 *                                           (sky.ts myPoint), the one star that stays sharp
 *
 * This file keeps what the owners share: the close orbit genesis falls into, the system keeps and launches from.
 * Pure functions of story time and show time; no allocation.
 */
import { Vector3 } from "three";
import { BEATS, F } from "@/lib/journey";
import { SUN } from "../constants";

/** Radius of the close orbit (world units): inside the cavity the sun clears (CAVITY_R), outside its body (SUN_R). */
export const ORBIT_R = 7.5;
/** Its angle at F.center, its turn per unit of story time and per second of show time (slow: it is waiting). */
const A0 = 2.2;
const W_T = 0.9;
const W_TIME = 0.06;
/**
 * The orbit's plane: tilted 45° out of the disk toward the cameras of figs 3-7 (they look at the sun from azimuth
 * 10-50°, 20-35° up), so its outline seen from them stays wider than the sun's disc and your point never crosses in
 * front of the sun or behind it. Prograde with the disk (E1 × E2 = -N; the disk turns about -y).
 */
const N = new Vector3(
  Math.sin(Math.PI / 6) * Math.SQRT1_2,
  Math.SQRT1_2,
  Math.cos(Math.PI / 6) * Math.SQRT1_2,
);
const E1 = new Vector3().crossVectors(N, new Vector3(0, 1, 0)).normalize();
const E2 = new Vector3().crossVectors(E1, N);

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const LAUNCH = F.assist + BEATS.assist.countdown[1];
/**
 * The thread's mark (fx.ts thread uK): a deeper moat and a fine gold ring round your point. Full in the dense dust
 * of figs 2-3; from the sun's ignition it eases to a lighter ring that stays (docs/STORY.md: one marked light you can
 * always find) through figs 4-6 beside the sun and the planets, until it launches and the trail marks it. A pure
 * function of story time (figures/genesis.ts writes it every frame once the sky is freed).
 */
export function threadK(T: number) {
  return (
    ss(F.point + 0.3, F.versions, T) *
    (1 - 0.45 * ss(F.center + 0.8, F.gathering + 0.1, T)) *
    (1 - ss(LAUNCH - 0.04, LAUNCH + 0.08, T))
  );
}

/**
 * The show-time drift's phase offset (rad): the system holds the drift through fig. 6's slide and, scrolling back
 * before it, lets it run on from where it was held (figures/system.ts); genesis's close orbit carries the same offset,
 * so your point never jumps along its orbit, in either direction, at either hand-over.
 */
export const CLOSE = { off: 0 };

/** Your point on its close orbit around the sun at story time T (`time`: show seconds, 0 under reduced motion). */
export function closeOrbit(T: number, time: number, out: Vector3) {
  return closeOrbitAt(A0 + W_T * (T - F.center) + W_TIME * time + CLOSE.off, out);
}

/**
 * System (figs 4-7): the close orbit's parts, so the system can hold your point's phase still in time and slide it
 * onto its launch mark (figures/system.ts): the story-time angle, the show-time drift per second, the point at an
 * angle and its direction of travel there (unit), and its speed in world units per unit of story time.
 */
export const closeOrbitBase = (T: number) => A0 + W_T * (T - F.center);
export const CLOSE_DRIFT = W_TIME;
export const CLOSE_SPEED = W_T * ORBIT_R;
export function closeOrbitAt(a: number, out: Vector3) {
  const c = Math.cos(a) * ORBIT_R;
  const s = Math.sin(a) * ORBIT_R;
  return out.set(
    SUN[0] + E1.x * c + E2.x * s,
    SUN[1] + E1.y * c + E2.y * s,
    SUN[2] + E1.z * c + E2.z * s,
  );
}
export function closeOrbitDir(a: number, out: Vector3) {
  const c = -Math.sin(a);
  const s = Math.cos(a);
  return out.set(E1.x * c + E2.x * s, E1.y * c + E2.y * s, E1.z * c + E2.z * s);
}
