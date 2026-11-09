/**
 * The camera rig: one pure function of story time per stretch of the show (plus the bang's settle, the orbit drag,
 * the ignition kick and a damped pointer parallax). The light moves more than the camera. The poses live with their
 * owners in ./poses (genesis: the sky, the nebula, the ignition; system: the overview and the dive to the world;
 * world: the world, the storm and the flight; finale: the pull-back of fig. 11 and the pole). This file keeps the
 * rig's types and kit (blend, fovFor, fitDistance, sunOrbit, ss / ease / lerp), applyRig, and rigAt, the
 * dispatcher that picks and blends the owners' poses by story time (journey.ts F and HANDOFF).
 *
 * The pose modules import the kit from here and this file imports the poses: the cycle is safe because every helper
 * is a hoisted function declaration and nothing runs at import time.
 */
import { MathUtils, type PerspectiveCamera, Vector3 } from "three";
import { F, HANDOFF } from "@/lib/journey";
import { SUN } from "./constants";
import { SKY_T } from "./figures/sky";
import { SYSTEM_T } from "./figures/system";
import { againPose, descentPose, polePose } from "./poses/finale";
import { ignitionPose, nebulaPose, skyPose } from "./poses/genesis";
import { divePose, orbitPose } from "./poses/system";
import { flightPose, stormPose, worldPose } from "./poses/world";

export type Pose = { pos: Vector3; target: Vector3; fov: number };

export type RigCtx = {
  aspect: number;
  /** The page's phone layout (CSS width at most 760 px, globals.css): its lines of copy sit higher (60 % not 71 %). */
  phone: boolean;
  /** Fig. 1 view direction (unit, from the observer). */
  skyLook: Vector3;
  /** 0 before the bang, 1 once the blast has settled (time-based). */
  settle: number;
  /** Damped pointer, -1..1. */
  px: number;
  py: number;
  motion: number;
  /** Seconds of show time (slow drifts). */
  time: number;
  /** The orbit drag: yaw (rad) the visitor turned the system by (written by the system figure). */
  yaw: number;
  /** Ignition kick 0..1, the push in as the sun lights (written by the genesis figure). */
  kick: number;
};

const A: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
const B: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
const S = new Vector3(...SUN);
const right = new Vector3();
const up = new Vector3();
const fwd = new Vector3();
const UP = new Vector3(0, 1, 0);

/* ---- the rig's kit ---- */

export function ss(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function blend(a: Pose, b: Pose, k: number, out: Pose) {
  out.pos.lerpVectors(a.pos, b.pos, k);
  out.target.lerpVectors(a.target, b.target, k);
  out.fov = a.fov + (b.fov - a.fov) * k;
  return out;
}

/** Vertical fov that keeps a horizontal fov of at least `h` degrees on narrow screens. */
export function fovFor(v: number, h: number, aspect: number) {
  const need = 2 * Math.atan(Math.tan((h * Math.PI) / 360) / aspect) * (180 / Math.PI);
  return Math.min(Math.max(v, need), 92);
}

export function fitDistance(w: number, h: number, fov: number, aspect: number) {
  const t = Math.tan((fov * Math.PI) / 360);
  return Math.max(h / (2 * t), w / (2 * t * aspect));
}

/** A camera around the sun: azimuth (deg, 0 = from +z), elevation (deg), distance; looking at the sun + lift. */
export function sunOrbit(
  az: number,
  el: number,
  d: number,
  lift: number,
  fov: number,
  c: RigCtx,
  out: Pose,
) {
  const a = MathUtils.degToRad(az);
  const e = MathUtils.degToRad(el);
  out.pos.set(
    S.x + Math.sin(a) * Math.cos(e) * d,
    S.y + Math.sin(e) * d,
    S.z + Math.cos(a) * Math.cos(e) * d,
  );
  out.target.set(S.x, S.y + lift, S.z);
  out.fov = fovFor(fov, fov * 1.35, c.aspect);
  return out;
}

/* ---- the dispatcher ---- */

/** The ignition pose hands over to the system's overview as it pulls back. */
const TO_OVERVIEW = [F.gathering, F.gathering + 0.36] as const;

/** The pose for story time T (journey.ts F: figure i spans [i, i + 1); past F.sky, the sky read on into the record). */
export function rigAt(T: number, c: RigCtx, out: Pose) {
  if (T < F.versions) {
    skyPose(c, A);
    nebulaPose(T, c, B);
    // the bang's settle is in time; a quick first scroll must still arrive at the nebula by F.versions, never cut to it
    blend(A, B, Math.max(ease(c.settle), ss(F.point + 0.4, F.versions, T)), out);
  } else if (T < F.center) {
    nebulaPose(T, c, out);
  } else if (T < F.gathering) {
    ignitionPose(T, c, out);
  } else if (T < SYSTEM_T.dive[0]) {
    ignitionPose(F.gathering, c, A);
    orbitPose(T, c, B);
    blend(A, B, ss(TO_OVERVIEW[0], TO_OVERVIEW[1], T), out);
  } else if (T < HANDOFF.ARRIVE) {
    // down to the world: at its approach pose exactly at HANDOFF.ARRIVE
    divePose(T, c, out);
  } else if (T < F.storm) {
    worldPose(T - F.theirs, c, out);
  } else if (T < F.flock) {
    stormPose(T, c, out);
  } else if (T < F.again) {
    flightPose(T - F.flock, c, out);
  } else if (T < SKY_T.descent[0]) {
    againPose(T, c, out);
  } else if (T < SKY_T.descent[1]) {
    // from the galaxy back into our star and home to the observer under the returning sky, in one fall
    descentPose(T, c, out);
  } else {
    // T beyond F.sky is the sky read on into the record (story.after)
    polePose(Math.min(1, T - F.sky), c, out);
  }
  return out;
}

/**
 * How far the eye follows the pointer (world units at 40 units' distance) at story time T: generous under the sky,
 * less in genesis, less again from the system on, still in the sky (the long exposure). Eased between, so a change of
 * figure never moves the camera.
 */
export function parallaxAt(T: number) {
  return (
    0.9 -
    0.3 * ss(F.versions - 0.15, F.versions + 0.15, T) -
    0.25 * ss(F.alignment - 0.2, F.alignment + 0.2, T) -
    0.35 * ss(SKY_T.descent[0], SKY_T.descent[1], T)
  );
}

/** Apply a pose to the camera with the pointer parallax (the eye moves, the subject stays). */
export function applyRig(cam: PerspectiveCamera, p: Pose, c: RigCtx, amount: number) {
  fwd.subVectors(p.target, p.pos).normalize();
  right.crossVectors(fwd, UP).normalize();
  up.crossVectors(right, fwd);
  const dist = p.pos.distanceTo(p.target);
  const a = amount * c.motion * Math.min(1, dist / 40);
  cam.position
    .copy(p.pos)
    .addScaledVector(right, c.px * a)
    .addScaledVector(up, c.py * a * 0.6);
  cam.up.set(0, 1, 0);
  cam.lookAt(p.target);
  if (Math.abs(cam.fov - p.fov) > 1e-4 || Math.abs(cam.aspect - c.aspect) > 1e-4) {
    cam.fov = p.fov;
    cam.aspect = c.aspect;
    cam.updateProjectionMatrix();
  }
  cam.updateMatrixWorld();
}
