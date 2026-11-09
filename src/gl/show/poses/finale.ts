/**
 * Finale poses (docs/STORY.md figs 11-12), powers of ten both ways.
 *
 * Fig. 11 (againPose): from the flight over the world (the world module's flightPose at F.again) the camera pulls back
 * out of the system, through our neighbourhood, out of the galaxy's disk, until the galaxy is in view at three quarters
 * (galaxyView: our star on its spur, the core glowing, turning slowly). Fig. 12 (descentPose, the rig's SKY_T.descent):
 * it falls back in, into our star, and home to the observer under the returning sky (polePose: looking a little below
 * the celestial pole so it sits in the upper third, still while the record is read over it).
 *
 * Both moves are one fall along a line of sight (powers): the eye's distance from what it looks at changes on a log
 * scale (every power of ten takes the same scroll), its bearing swings smoothly, and what it looks at slides from the
 * near subject through the sun to the galaxy's centre as the distance grows (and back as it shrinks). One calm,
 * continuous move: no late turn of the head.
 */
import { MathUtils, Quaternion, Vector3 } from "three";
import { BEATS, F } from "@/lib/journey";
import { fitDistance, fovFor, lerp, type Pose, type RigCtx, ss } from "../camera";
import { OBSERVER, SUN } from "../constants";
import { galaxyOrigin, STAGE, STAR_HOMES } from "../figures/galaxy";
import { SKY_T, skyFov, skyPitch } from "../figures/sky";
import { GAL } from "../sky";
import { flightPose } from "./world";

type Win = [number, number];

const A: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
const B: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
const tmp = new Vector3();
const UP = new Vector3(0, 1, 0);

/** The pull-back (journey BEATS.again.pull). */
const PULL: Win = [F.again + BEATS.again.pull[0], F.again + BEATS.again.pull[1]];
/** The galaxy in view: its elevation above the disk (deg), how far the disk reaches on screen (RS), its turn (rad/T). */
const ELEV = 32;
const REACH = 1.85;
const DRIFT = 0.16;
/**
 * What the galaxy's view frames: its centre, nudged toward our star (local x, RS units); its margin; how high it sits
 * (a share of its height on screen: its lower arm clears the lines of copy under it).
 */
const FRAME_X = 0.9;
const FIT = 1.58;
const FIT_NARROW = 1.12;
const LIFT = 0.2;
const LIFT_NARROW = 0.3;
/**
 * The bearing the galaxy's view prefers (it swings least on the way home from there): south of what it frames and a
 * little below. (The sky's own rest view pitches by the screen: figures/sky.ts skyPitch.)
 */
const VIEW_PITCH = MathUtils.degToRad(13.5);

/**
 * The galaxy's view, solved once from the galactic frame of the visit (sky.ts GAL): the bearing (unit, from what the
 * view frames to the eye) that sees the disk at three quarters with its long axis level on screen if it can (tilted a
 * little if it must), keeps the camera above the disk and clear of the zenith, and swings least on the way home.
 */
const view = { v: -1, U: new Vector3(), n: new Vector3() };

function solveView() {
  if (view.v === GAL.version) return;
  view.v = GAL.version;
  const want = new Vector3(0, -Math.sin(VIEW_PITCH), Math.cos(VIEW_PITCH));
  const n = new Vector3();
  const H = new Vector3();
  const K = new Vector3();
  const U = new Vector3();
  let best = -Infinity;
  for (const side of [1, -1]) {
    n.copy(GAL.gn).multiplyScalar(side);
    H.copy(UP).addScaledVector(n, -UP.dot(n));
    if (H.lengthSq() < 1e-6) H.copy(GAL.gx);
    H.normalize();
    K.crossVectors(n, H);
    for (const e of [28, 32, 36]) {
      const se = Math.sin(MathUtils.degToRad(e));
      const ce = Math.cos(MathUtils.degToRad(e));
      for (let psi = -70; psi <= 70; psi += 5) {
        const p = MathUtils.degToRad(psi);
        U.copy(n)
          .multiplyScalar(se)
          .addScaledVector(H, ce * Math.cos(p))
          .addScaledVector(K, ce * Math.sin(p));
        if (U.y < 0.28 || U.y > 0.86) continue;
        const score = U.dot(want) - 0.00035 * psi * psi - 0.002 * (e - ELEV) ** 2;
        if (score > best) {
          best = score;
          view.U.copy(U);
          view.n.copy(n);
        }
      }
    }
  }
  if (best === -Infinity) {
    view.U.set(0, 0.5, 0.87).normalize();
    view.n.copy(GAL.gn);
  }
}

const qd = new Quaternion();
const dirv = new Vector3();
const right = new Vector3();
const camUp = new Vector3();
const major = new Vector3();

/**
 * Every platform star stays on the free stage while it can be hovered or tapped (figures/galaxy.ts STAGE: clear of the
 * header's controls, the spine and the caption), this far inside it (CSS px: a star's glow and a finger's reach). A
 * tall narrow screen cannot hold the disk's own fit and its stars both: the frame slides first, then the eye steps
 * back as far as it must, never closer than the disk's fit.
 */
const STAR_PAD = 20;
/** The platform stars from what the view frames (world units), refreshed with the galactic frame. */
const starRel = new Float32Array(STAR_HOMES.length);
let starRelV = -1;
/** The same, along the view's axes this frame: the screen's right, its up, toward the eye. */
const starCam = new Float32Array(STAR_HOMES.length);
/** The free stage in NDC this frame. */
const box = { xl: -1, xr: 1, yb: -1, yt: 1 };
/** The slides (world units along the screen's right and up) that keep every star on it, at a given distance. */
const span = { loX: 0, hiX: 0, loY: 0, hiY: 0 };

function stageBox(aspect: number) {
  const W = STAGE.w;
  const H = STAGE.h;
  if (W <= 0 || H <= 0) {
    // not measured yet: the frame's usual controls and caption (globals.css), as fractions of the screen
    box.xl = -0.9;
    box.xr = 0.82;
    box.yt = 0.76;
    box.yb = 1 - 2 * (aspect < 1 ? 0.56 : 0.66);
    return;
  }
  box.xl = -1 + (2 * (STAGE.left + STAR_PAD)) / W;
  box.xr = -1 + (2 * (STAGE.right - STAR_PAD)) / W;
  box.yt = 1 - (2 * (STAGE.top + STAR_PAD)) / H;
  // (a wide screen's caption is a narrow column in the middle: its stars may sit beside it, as they always have)
  box.yb = 1 - (2 * ((aspect < 1 ? STAGE.bottom : H) - STAR_PAD)) / H;
}

/** The shifts that keep every star on the stage with the eye L from what it frames (lo > hi: none does). */
function starSpan(L: number, tH: number, tV: number) {
  span.loX = -Infinity;
  span.hiX = Infinity;
  span.loY = -Infinity;
  span.hiY = Infinity;
  for (let i = 0; i < starCam.length; i += 3) {
    const x = starCam[i];
    const y = starCam[i + 1];
    const z = Math.max(1, L - starCam[i + 2]);
    span.loX = Math.max(span.loX, box.xl * tH * z - x);
    span.hiX = Math.min(span.hiX, box.xr * tH * z - x);
    span.loY = Math.max(span.loY, box.yb * tV * z - y);
    span.hiY = Math.min(span.hiY, box.yt * tV * z - y);
  }
  return span.loX <= span.hiX && span.loY <= span.hiY;
}

const fitOut = { L: 0, lift: 0, side: 0 };

/**
 * The view's distance and its slides (lift: up, side: right, world units) that keep every platform star on the free
 * stage: the disk's own fit (L0, lift0, no side) where it already does, else the least change that does.
 */
function fitStars(d: Vector3, fov: number, aspect: number, L0: number, lift0: number) {
  if (starRelV !== GAL.version) {
    starRelV = GAL.version;
    for (let i = 0; i < starRel.length; i += 3) {
      tmp
        .set(STAR_HOMES[i] - FRAME_X * GAL.RS, STAR_HOMES[i + 1], STAR_HOMES[i + 2])
        .applyMatrix3(GAL.M);
      starRel[i] = tmp.x;
      starRel[i + 1] = tmp.y;
      starRel[i + 2] = tmp.z;
    }
  }
  for (let i = 0; i < starRel.length; i += 3) {
    const x = starRel[i];
    const y = starRel[i + 1];
    const z = starRel[i + 2];
    starCam[i] = x * right.x + y * right.y + z * right.z;
    starCam[i + 1] = x * camUp.x + y * camUp.y + z * camUp.z;
    starCam[i + 2] = x * d.x + y * d.y + z * d.z;
  }
  stageBox(aspect);
  const tV = Math.tan((fov * Math.PI) / 360);
  const tH = tV * aspect;
  let L = L0;
  if (!starSpan(L0, tH, tV)) {
    let lo = L0;
    let hi = L0 * 1.5;
    while (!starSpan(hi, tH, tV) && hi < L0 * 12) hi *= 1.5;
    for (let k = 0; k < 22; k++) {
      const mid = 0.5 * (lo + hi);
      if (starSpan(mid, tH, tV)) hi = mid;
      else lo = mid;
    }
    L = hi;
    starSpan(L, tH, tV);
  }
  fitOut.L = L;
  fitOut.lift = span.loY <= span.hiY ? Math.min(Math.max(lift0, span.loY), span.hiY) : lift0;
  fitOut.side = span.loX <= span.hiX ? Math.min(Math.max(0, span.loX), span.hiX) : 0;
  return fitOut;
}

/** The galaxy at three quarters (its framing point as target), turning slowly about its axis with story time. */
function galaxyView(T: number, c: RigCtx, out: Pose) {
  solveView();
  const o = galaxyOrigin(T, tmp);
  out.target
    .set(FRAME_X * GAL.RS, 0, 0)
    .applyMatrix3(GAL.M)
    .add(o);
  qd.setFromAxisAngle(view.n, DRIFT * (T - F.again));
  const d = dirv.copy(view.U).applyQuaternion(qd);
  const fov = fovFor(50, 64, c.aspect);
  // fit the disk's ellipse as it lies on screen (its long axis may be tilted a little)
  right.crossVectors(d, UP).multiplyScalar(-1).normalize();
  camUp.crossVectors(right, d).multiplyScalar(-1);
  major.crossVectors(view.n, d).normalize();
  const om = Math.atan2(major.dot(camUp), major.dot(right));
  const a = REACH * GAL.RS;
  const b = a * Math.abs(d.dot(view.n));
  const cw = Math.cos(om);
  const sw = Math.sin(om);
  const w = 2 * Math.sqrt(a * a * cw * cw + b * b * sw * sw);
  const h = 2 * Math.sqrt(a * a * sw * sw + b * b * cw * cw);
  // (a phone's narrow page is all width: it can hold the disk closer)
  const fit = c.aspect < 1 ? FIT_NARROW : FIT;
  const L0 = fitDistance(w * fit, h * fit * 1.12, fov, c.aspect);
  // sit it high, clear of the lines of copy under it; every platform star on the free stage (fitStars)
  const { L, lift, side } = fitStars(d, fov, c.aspect, L0, h * (c.aspect < 1 ? LIFT_NARROW : LIFT));
  out.pos.copy(out.target).addScaledVector(d, L);
  out.target.addScaledVector(camUp, -lift).addScaledVector(right, -side);
  out.pos.addScaledVector(camUp, -lift).addScaledVector(right, -side);
  out.fov = fov;
  return out;
}

const uA = new Vector3();
const uB = new Vector3();
const piv = new Vector3();
const qs = new Quaternion();
const qi = new Quaternion();
const S = new Vector3(...SUN);
const home = new Vector3();
const lift = new Vector3();
const L: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };

/**
 * One fall along a line of sight from pose a to pose b (k 0..1): the distance on a log scale, the bearing swung over
 * `swing` of it, and the subject by distance: `far` (the galaxy's centre) when farther than `farWin` (multiples of its
 * distance from our star, on a log scale; or, `linear`, shares of the way from a's distance to b's), our star `star`
 * at the system's scale, `near` (the subject of the near pose) up close.
 */
function powers(
  a: Pose,
  b: Pose,
  near: Vector3,
  star: Vector3,
  far: Vector3,
  k: number,
  swing: Win,
  farWin: Win,
  out: Pose,
  linear = false,
) {
  const dA = uA.subVectors(a.pos, a.target).length();
  const dB = uB.subVectors(b.pos, b.target).length();
  uA.divideScalar(dA);
  uB.divideScalar(dB);
  const e = ss(0, 1, k);
  const ld = lerp(Math.log(dA), Math.log(dB), e);
  const d = Math.exp(ld);
  const G = Math.max(1, far.distanceTo(star));
  const dn = Math.min(dA, dB);
  const wF = linear
    ? ss(farWin[0], farWin[1], (d - dA) / Math.max(1e-6, dB - dA))
    : ss(Math.log(farWin[0] * G), Math.log(Math.max(farWin[1], farWin[0] * 1.2) * G), ld);
  const wN = 1 - ss(Math.log(1.3 * dn), Math.log(4 * dn), ld);
  piv.lerpVectors(star, near, wN).lerp(far, wF);
  qs.setFromUnitVectors(uA, uB);
  qi.identity().slerp(qs, ss(swing[0], swing[1], e));
  out.pos.copy(uA).applyQuaternion(qi).multiplyScalar(d).add(piv);
  out.target.copy(piv);
  out.fov = lerp(a.fov, b.fov, e);
  return out;
}

/** Fig. 11: from the flight over the world, out of the system and the galaxy's disk until the galaxy is in view. */
export function againPose(T: number, c: RigCtx, out: Pose) {
  galaxyView(T, c, B);
  const k = (T - PULL[0]) / (PULL[1] - PULL[0]);
  if (k >= 1) {
    out.pos.copy(B.pos);
    out.target.copy(B.target);
    out.fov = B.fov;
    return out;
  }
  flightPose(1, c, A);
  // the eye leaves our star for the galaxy's centre in step with the distance (linear in it, so the turn is slow while
  // the eye is near): our star, the whole system now, stays in the frame all the way out, and the galaxy's core comes
  // in from the side toward the middle as the galaxy grows round it, never half cut at the frame's edge
  return powers(A, B, A.target, S, B.target, Math.max(0, k), [0.06, 0.86], [0, 1], out, true);
}

/**
 * Fig. 12 (SKY_T.descent): from the galaxy back into our star and home to the observer, in one fall. The eye finds our
 * star first (it comes to the centre as the fall begins), then falls into it.
 */
export function descentPose(T: number, c: RigCtx, out: Pose) {
  galaxyView(T, c, A);
  polePose(0, c, B);
  // the fall comes home level (the eye never dips under the lights on the horizon), and the gaze lifts to the pole
  // as it settles
  L.pos.copy(B.pos);
  L.target.set(B.pos.x, B.pos.y, B.pos.z - 100);
  L.fov = B.fov;
  const k = Math.min(
    1,
    Math.max(0, (T - SKY_T.descent[0]) / (SKY_T.descent[1] - SKY_T.descent[0])),
  );
  // our star rides the galaxy's origin home (figures/galaxy.ts shift), so the eye falls toward it all the way
  const star = galaxyOrigin(T, home);
  const G = Math.max(1, A.target.distanceTo(star));
  // the subject leaves the galaxy's centre for our star once the eye is inside 0.97 of where it starts, so the fall
  // begins exactly on the galaxy's view: on a narrow screen that view is nearer than 1.5 of our star's distance from
  // what it frames, and the hand-off starts nearer too (it would otherwise begin part-way, a jump of the whole galaxy)
  const hiW = (0.97 * A.pos.distanceTo(A.target)) / G;
  powers(A, L, L.target, star, A.target, k, [0.08, 0.9], [Math.min(1.5, hiW / 1.25), hiW], out);
  out.target.addScaledVector(lift.subVectors(B.target, L.target), ss(0.5, 1, k));
  return out;
}

export function polePose(_t: number, c: RigCtx, out: Pose) {
  out.pos.set(...OBSERVER);
  // still while the record is read over it, so the long exposure keeps drawing; looking north, below the pole so it
  // sits in the upper third, the horizon just above the lines of copy (figures/sky.ts skyPitch)
  const pitch = skyPitch(c.aspect);
  tmp.set(0, Math.sin(pitch), -Math.cos(pitch));
  out.target.copy(tmp).multiplyScalar(100).add(out.pos);
  out.fov = skyFov(c.aspect);
  return out;
}
