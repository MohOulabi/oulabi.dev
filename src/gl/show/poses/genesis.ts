/**
 * Genesis poses (docs/STORY.md figs 1-3): under the Riyadh sky before the bang, a slow glide in through the nebula's
 * outer layers as it breathes; in fig. 3 the three knots framed above the lines of copy, the camera turning to the
 * chosen one and riding it in to the sun's place as the cloud falls into it; then over the disk as it spins up, pushed
 * in as the sun lights (the rig's kick) and eased back to fig. 4's opening.
 */
import { Vector3 } from "three";
import { F } from "@/lib/journey";
import { ease, fitDistance, fovFor, lerp, type Pose, type RigCtx, ss, sunOrbit } from "../camera";
import { OBSERVER, SUN } from "../constants";

/**
 * Where fig. 3 wants the camera, written by figures/genesis.ts in its `pre` (before the rig reads it): the middle of
 * the three knots as they are this frame, and the chosen knot (on its way to the sun) with how much the camera
 * follows it (0..1). Both are SUN once the fall is over.
 */
export const FOCUS = {
  frame: new Vector3(...SUN),
  pick: new Vector3(...SUN),
  pickK: 0,
};

/** The knots' frame: the half-extent (world units) the camera keeps in view, and how far above the middle they sit. */
const FRAME_W = 36;
const FRAME_H = 22;
/** Fraction of the half-height the knots sit above the middle (the lines of copy live below). */
const FRAME_LIFT = 0.24;
const D_FRAME = [80, 100] as const;
/** The camera leans in on the chosen knot as the others fall into it. */
const D_PICK = 70;
/** The push in as the sun lights (the rig's kick), as a share of the distance: 42 units at fig. 4's opening (d 128). */
const KICK = 42 / 128;

const S = new Vector3(...SUN);
const tgt = new Vector3();
const up = new Vector3();
const DEG = Math.PI / 180;

/** Fig. 1: the observer under the sky, looking where the sky data says (skyLook). */
export function skyPose(c: RigCtx, out: Pose) {
  out.pos.set(...OBSERVER);
  out.target.copy(c.skyLook).multiplyScalar(100).add(out.pos);
  out.fov = fovFor(58, 64, c.aspect);
  return out;
}

/** The nebula (T 0..2): a slow glide in through the cloud's outer layers, the cloud breathing around it. */
export function nebulaPose(T: number, c: RigCtx, out: Pose) {
  const k = ss(F.point, F.center, T);
  const drift = Math.sin(c.time * 0.05) * 2.5 * c.motion;
  const az = lerp(-14, 22, k) + drift;
  const el = lerp(9, 21, k) + Math.sin(c.time * 0.037) * 1.2 * c.motion;
  const d = lerp(168, 112, ease(k));
  return sunOrbit(az, el, d, lerp(10, 2, k), 52, c, out);
}

/**
 * Fig. 3 (T 2..3): from where the nebula's glide left off, the knots framed (still, so they can be chosen), then the
 * chosen one followed in to the sun's place, then up over the disk to fig. 4's opening (az 36°, el 30°, d 128 at
 * F.gathering, minus the ignition's push in). Continuous with nebulaPose at F.center and pure in T beyond FOCUS.
 */
export function ignitionPose(T: number, c: RigCtx, out: Pose) {
  const k = Math.min(1, Math.max(0, T - F.center));
  const still = 1 - ss(0, 0.3, k);
  const drift = Math.sin(c.time * 0.05) * 2.5 * c.motion * still;
  const wob = Math.sin(c.time * 0.037) * 1.2 * c.motion * still;
  const fr = ss(0, 0.16, k);
  const pk = FOCUS.pickK * ss(0, 0.12, k);
  const end = ss(0.5, 1, k);
  const fovV = lerp(52, 50, end);
  const fov = fovFor(fovV, fovV * 1.35, c.aspect);
  // a phone's narrow frame comes in closer (its width is the limit); a wide one stands back and lets the cloud show
  const dFrame = Math.min(
    D_FRAME[1],
    Math.max(
      D_FRAME[0],
      1.1 * fitDistance(2 * FRAME_W, 2 * FRAME_H, fov, c.aspect),
      lerp(D_FRAME[0], D_FRAME[1], ss(0.6, 1.4, c.aspect)),
    ),
  );

  const az = lerp(lerp(lerp(22 + drift, 24, fr), 28, pk), 36, end) * DEG;
  const el = lerp(lerp(lerp(21 + wob, 22, fr), 24, pk), 30, end) * DEG;
  const d = lerp(lerp(lerp(112, dFrame, fr), D_PICK, pk), 128, end) * (1 - KICK * c.kick);
  const sa = Math.sin(az);
  const ca = Math.cos(az);
  const se = Math.sin(el);
  const ce = Math.cos(el);
  // the knots' middle, the camera rigidly lowered so they sit above the lines of copy
  up.set(-sa * se, ce, -ca * se);
  const lift = FRAME_LIFT * dFrame * Math.tan((fov * DEG) / 2) * (1 - pk);
  tgt.copy(FOCUS.frame).addScaledVector(up, -lift);
  out.target
    .set(S.x, S.y + 2, S.z)
    .lerp(tgt, fr)
    .lerp(FOCUS.pick, pk)
    .lerp(S, end);
  // the nebula orbits the sun and looks 2 units over it: the eye keeps that offset until the knots take over
  const base = 2 * (1 - fr) * (1 - pk) * (1 - end);
  out.pos
    .set(sa * ce, se, ca * ce)
    .multiplyScalar(d)
    .add(out.target);
  out.pos.y -= base;
  out.fov = fov;
  return out;
}
