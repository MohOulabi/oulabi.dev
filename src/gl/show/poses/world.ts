/**
 * World poses (docs/STORY.md figs 8-10): one path for the camera from your point's landing (HANDOFF.ARRIVE) to the
 * start of the pull-back of fig. 11 (F.again), a cubic through keys (Catmull-Rom tangents, at rest at both ends), so
 * its speed never jumps at a figure's edge:
 *
 *   theirs        the approach pose the dive lands on (system's divePose reads worldPose(0)), the sun just behind
 *                 the world's limb; then the glide in over the night side as the cities light and wire together
 *   storm + 0.3   wide and slow: the whole world with both poles, room on the right for the storm sweeping in
 *   storm + 0.88  settled low, looking up the world toward the north pole, its limb across the frame, the aurora
 *                 standing on it and the lit Middle East under it, above the copy
 *   flock         the flight over the night side for the murmuration (flight(), its eye lowered), at rest
 *                 by F.again, where the finale's againPose starts from flightPose(1)
 *
 * Positions are interpolated around the world (direction and distance from its centre), so the camera never cuts
 * through it; targets and fov are cubic too. Narrow screens keep a horizontal fov (fovFor) and centre the wide
 * shot's offset world.
 *
 * The copy band: the lines of copy sit fixed under the middle of the frame (globals.css .caption: 71 % of the height
 * on a desktop, 60 % on a phone), and the world's lights are the brightest thing on screen, so the camera's pitch is
 * solved on screen, not keyed (frameWorld): every key says where the world sits relative to the copy, as one of
 *   above   the whole world above the line `lo` (its lower limb no lower than lo of the height): figs 8 and 9 wide, and
 *           every figure on a phone (its tall page has room above the copy for the world and the flock over it)
 *   limb    the world's upper limb exactly at `hi` (the planet fills the frame below it, the aurora and the flock in
 *           the sky above): the close shots of figs 9 and 10 on a desktop, where the world is too big to sit above
 * and the two blend between keys, so the pitch moves as smoothly as the rest of the path. The yaw and the distance
 * stay the keys'. Pure functions of story time; no allocation per call.
 */
import { Vector3 } from "three";
import { F, PLANET } from "@/lib/journey";
import { fovFor, type Pose, type RigCtx } from "../camera";

const C = new Vector3(...PLANET.center);
const UP = new Vector3(0, 1, 0);
/** The world's radius on screen includes its air (the limb's glow). */
const R_SEEN = PLANET.radius * 1.05;

/**
 * Where the world sits relative to the copy (see the header): mode m (0 above, 1 limb), the lines lo and hi as
 * fractions of the height from the top; then the same three on a phone.
 */
type Frame = [m: number, lo: number, hi: number, mN: number, loN: number, hiN: number];
/** Above the copy (desktop and phone), with no line at all on the approach (the dive lands there as it is). */
const ABOVE: Frame = [0, 0.655, 0.5, 0, 0.545, 0.3];
const FREE: Frame = [0, 0.71, 0.5, 0, 0.585, 0.3];

type Key = {
  t: number;
  dir: Vector3;
  dist: number;
  target: Vector3;
  v: number;
  h: number;
  side: number;
  ph: number;
  fr: Frame;
};

/**
 * A key from a camera offset and a target offset (from the world's centre). On phones (fovFor keeps a horizontal fov,
 * so the vertical one opens up to its cap) `ph` dollies the camera in, and `side` brings the target's x back toward
 * the middle.
 */
function key(
  t: number,
  pos: [number, number, number],
  target: [number, number, number],
  v: number,
  h: number,
  side: number,
  ph: number,
  fr: Frame,
): Key {
  const d = new Vector3(...pos);
  const dist = d.length();
  return { t, dir: d.divideScalar(dist), dist, target: new Vector3(...target), v, h, side, ph, fr };
}

/**
 * The flight (fig. 10) at t in 0..1: a slow arc over the night side (its framing is kept on the keys), the eye
 * lowered by FLIGHT_DROP: the hub (where the lights are) sits 10 degrees up the world, and seen from a
 * little below it the lights lie just under the limb, so the flock lifts off them straight into the sky above it.
 */
const FLIGHT_DROP = 6.5;
function flight(t: number, out: Vector3, target: Vector3) {
  const a = -0.02 + 0.22 * t;
  const d = 22 + 1.5 * Math.sin(t * Math.PI);
  out.set(Math.sin(a) * d, 2.4 + 1.6 * t - FLIGHT_DROP, Math.cos(a) * d);
  target.set(
    Math.sin(a) * 2,
    5.2 + 2.0 * Math.min(1, t * 2) ** 2 * (3 - 2 * Math.min(1, t * 2)),
    0,
  );
}
const fp = new Vector3();
const ft = new Vector3();
/** Over the night side, its limb low across the frame on a desktop, the murmuration in the sky above it. */
const FLIGHT_FR: Frame = [1, 0.655, 0.585, 0, 0.545, 0.3];
const flightKey = (t: number) => {
  flight(t, fp, ft);
  return key(F.flock + t, [fp.x, fp.y, fp.z], [ft.x, ft.y, ft.z], 44, 62, 0, 1.15, FLIGHT_FR);
};

/** The approach pose's eye (world): the dive (poses/system.ts) settles onto it as your point lands at the hub. */
const APPROACH: [number, number, number] = [13, 6.5, 46];
export const APPROACH_EYE = new Vector3(...APPROACH).add(C);

/**
 * Each turn of the camera (in, out, in) is a beat where it settles while something happens: the network wired at the
 * end of fig. 8, the field coming up in the wide shot, the aurora; between them it eases, never rushes.
 */
const KEYS: Key[] = [
  // fig. 8: the approach (the dive lands here at HANDOFF.ARRIVE), the glide in over the night side, coming round
  // until the Arabian Peninsula is near the middle of the world (Riyadh, the hub, a little above it: the peninsula
  // lies south of it). The eye rises to 10 degrees above the planet's equator at most: any higher and the sun (behind
  // the world, constants.ts SUN) shows over its upper limb. It stops a little farther out than the network's whole
  // span, so the wired world sits whole above the copy
  key(F.theirs, APPROACH, [0, 0.5, 0], 40, 60, 0, 0.72, FREE),
  key(F.theirs + 0.5, [2.76, 5.59, 31.59], [0.2, 2.9, 0], 42, 60, 0, 0.62, ABOVE),
  key(F.theirs + 0.86, [1.54, 5.17, 29.31], [0.5, 4.3, 0], 44, 60, 0, 0.64, ABOVE),
  // fig. 9: wide and slow as the storm sweeps in from the right and the field comes up, both poles in frame, the
  // peninsula still facing the eye (it stays on the sun's side of the world, so the sun's glare sits behind its upper
  // right limb, where its light is)
  key(F.storm + 0.3, [2.55, 6.11, 36.4], [5.0, 0.6, 0], 40, 64, 1, 0.56, ABOVE),
  key(F.storm + 0.52, [2.02, 5.83, 33.03], [4.2, 1.4, 0], 40, 64, 1, 0.6, ABOVE),
  // the aurora: settled low, looking up the world toward the north pole (the field's leans east), its limb across the
  // frame with the aurora standing on it, the lit Middle East just under the limb, clear above the copy (on a phone
  // the whole world, the aurora on top of it, above the copy)
  key(
    F.storm + 0.88,
    [0.6, -5.8, 17.1],
    [1.4, 6.3, 0],
    44,
    62,
    0,
    1.08,
    [1, 0.655, 0.37, 0, 0.545, 0.3],
  ),
  // fig. 10: lifting off the aurora into the flight (its framing from here), at rest at its end for the
  // finale's pull-back
  flightKey(0.3),
  flightKey(0.65),
  flightKey(1),
];

const zero = (): Key => ({
  t: 0,
  dir: new Vector3(),
  dist: 0,
  target: new Vector3(),
  v: 0,
  h: 0,
  side: 0,
  ph: 0,
  fr: [0, 0, 0, 0, 0, 0],
});
// Catmull-Rom tangents per unit of story time (non-uniform keys), zero at both ends
const TAN = KEYS.map((_, i) => {
  const out = zero();
  if (i === 0 || i === KEYS.length - 1) return out;
  const p = KEYS[i - 1];
  const n = KEYS[i + 1];
  const dt = n.t - p.t;
  out.dir.copy(n.dir).sub(p.dir).divideScalar(dt);
  out.dist = (n.dist - p.dist) / dt;
  out.target.copy(n.target).sub(p.target).divideScalar(dt);
  out.v = (n.v - p.v) / dt;
  out.h = (n.h - p.h) / dt;
  out.side = (n.side - p.side) / dt;
  out.ph = (n.ph - p.ph) / dt;
  for (let j = 0; j < 6; j++) out.fr[j] = (n.fr[j] - p.fr[j]) / dt;
  return out;
});

/** Cubic Hermite of scalars over a span of h. */
function herm(a: number, ma: number, b: number, mb: number, u: number, h: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * a +
    (u3 - 2 * u2 + u) * h * ma +
    (-2 * u3 + 3 * u2) * b +
    (u3 - u2) * h * mb
  );
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const fwd = new Vector3();
const right = new Vector3();
const camUp = new Vector3();
const toC = new Vector3();

/**
 * Pitch the pose so the world sits where its frame says (see the header): `m` blends between keeping its lower limb
 * above the line lo (only ever lifts it, eased in) and putting its upper limb on the line hi (both ways). Lines are
 * fractions of the height from the top. Angles are measured in the camera's vertical plane, which is exact for a
 * world in the middle of the frame and close for one off to the side.
 */
function frameWorld(out: Pose, m: number, lo: number, hi: number) {
  fwd.subVectors(out.target, out.pos);
  const L = fwd.length();
  fwd.divideScalar(L);
  right.crossVectors(fwd, UP).normalize();
  camUp.crossVectors(right, fwd);
  toC.subVectors(C, out.pos);
  const dist = toC.length();
  const alpha = Math.asin(Math.min(0.999, R_SEEN / dist));
  // the world's centre, below the axis (radians, positive down the screen)
  const phiC = Math.atan2(-toC.dot(camUp), toC.dot(fwd));
  const tanH = Math.tan((out.fov * Math.PI) / 360);
  const phiLo = Math.atan((2 * lo - 1) * tanH);
  const phiHi = Math.atan((2 * hi - 1) * tanH);
  // above: lift it by what its lower limb overshoots the line (a soft max, so the lift eases in and out)
  const over = phiC + alpha - phiLo;
  const k = 0.03;
  const lift = 0.5 * (over + Math.sqrt(over * over + k * k)) - 0.5 * k;
  // limb: its upper limb onto the line
  const limb = phiC - alpha - phiHi;
  const d = (1 - m) * lift + m * limb;
  if (Math.abs(d) < 1e-6) return;
  // look down by d (the world rises on screen by d), keeping the yaw and the distance to the target
  const c = Math.cos(d);
  const s = Math.sin(d);
  fwd.multiplyScalar(c).addScaledVector(camUp, -s);
  out.target.copy(out.pos).addScaledVector(fwd, L);
}

/** The camera at story time T (clamped to [F.theirs, F.again]). */
function worldPath(T: number, c: RigCtx, out: Pose) {
  const t = Math.min(F.again, Math.max(F.theirs, T));
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1].t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const h = b.t - a.t;
  const u = Math.min(1, Math.max(0, (t - a.t) / h));
  const ta = TAN[i];
  const tb = TAN[i + 1];
  // how much of a phone this screen is (0 from aspect 1.3 up, 1 at 0.7 and below)
  const narrow = 1 - Math.min(1, Math.max(0, (c.aspect - 0.7) / 0.6));
  const ph = 1 + (herm(a.ph, ta.ph, b.ph, tb.ph, u, h) - 1) * narrow;
  out.pos
    .set(
      herm(a.dir.x, ta.dir.x, b.dir.x, tb.dir.x, u, h),
      herm(a.dir.y, ta.dir.y, b.dir.y, tb.dir.y, u, h),
      herm(a.dir.z, ta.dir.z, b.dir.z, tb.dir.z, u, h),
    )
    .normalize()
    .multiplyScalar(Math.max(PLANET.radius * 2, herm(a.dist, ta.dist, b.dist, tb.dist, u, h) * ph))
    .add(C);
  // narrow screens: the wide shot's world comes back toward the middle (its storm then comes in from the top right)
  const side = herm(a.side, ta.side, b.side, tb.side, u, h) * narrow;
  const tx = herm(a.target.x, ta.target.x, b.target.x, tb.target.x, u, h);
  out.target.set(
    C.x + tx * (1 - 0.7 * side),
    C.y + herm(a.target.y, ta.target.y, b.target.y, tb.target.y, u, h) + 1.5 * side,
    C.z + herm(a.target.z, ta.target.z, b.target.z, tb.target.z, u, h),
  );
  out.fov = fovFor(herm(a.v, ta.v, b.v, tb.v, u, h), herm(a.h, ta.h, b.h, tb.h, u, h), c.aspect);
  // where the world sits relative to the copy: the mode by how narrow the screen is (a tall screen has room above the
  // copy), the lines by where the copy is (the phone layout's sits higher; a tablet's is a desktop's)
  const f = (j: number) => herm(a.fr[j], ta.fr[j], b.fr[j], tb.fr[j], u, h);
  const m = clamp01(f(0) + (f(3) - f(0)) * narrow);
  frameWorld(out, m, c.phone ? f(4) : f(1), c.phone ? f(5) : f(2));
  return out;
}

/** Fig. 8 (t: 0 at HANDOFF.ARRIVE, the approach pose the dive lands on; 1 at the end of the figure). */
export function worldPose(t: number, c: RigCtx, out: Pose) {
  return worldPath(F.theirs + t, c, out);
}

/** Fig. 9, the storm (story time T): wide for the front and the field, then low toward the north pole's aurora. */
export function stormPose(T: number, c: RigCtx, out: Pose) {
  return worldPath(T, c, out);
}

/** Fig. 10 (t: 0..1): the flight over the night side; at rest at t = 1, where the finale's pull-back begins. */
export function flightPose(t: number, c: RigCtx, out: Pose) {
  return worldPath(F.flock + t, c, out);
}
