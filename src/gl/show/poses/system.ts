/**
 * System poses (docs/STORY.md figs 4-7), all pure functions of story time and the visitor's launch (figures/probe.ts
 * FLIGHT), damped by construction (eased blends, the chase smoothed along the path), never rolled (world up).
 *
 *   orbitPose  fig. 4  up and back over the whole system as the planets condense (the drag turns it)
 *              fig. 5  down over the inner system, so the crossing and the near miss read (desktop and portrait)
 *              fig. 6  back out over the whole launch trajectory, a slow move along it as the planets slide on
 *   divePose   fig. 7  in to your point on its close orbit for the countdown; then the chase: riding with your point
 *                      on its sunward side and above it, swinging part of the way with its heading, looking a little
 *                      toward the planet ahead so the planet and your point are both in frame (your point swings
 *                      around each planet inside the frame while the camera glides); after the giant it settles by
 *                      itself onto the world's approach pose (poses/world.ts worldPose(0)), there exactly at
 *                      HANDOFF.ARRIVE, so the hand-off has no pop
 *
 * Measured over figs 4-7 (story time in steps of 0.004): the look turns at most ~260° per unit of story time (at the
 * giant), typically under 120°, with no step; portrait phones frame the scene a little higher, above the copy.
 *
 * The copy's band (the lower middle of the frame: the figure's lines and the hint ring) is never a body's place:
 * clearCopy pans every pose of figs 4-7 up just enough that the sun, the planets and the giant's rings stay above it
 * (or beside it), the overview's moves swing round the system at its distance, fig. 5's eye keeps the world at the
 * side, and the chase stands off the planets and the giant.
 */
import { MathUtils, Vector3 } from "three";
import { F, HANDOFF } from "@/lib/journey";
import { blend, ease, fovFor, lerp, type Pose, type RigCtx, ss } from "../camera";
import { PLANETS, SUN, WORLD } from "../constants";
import { longitude } from "../figures/orbits";
import { DEFAULT, FLIGHT, HUB_P, type Plan } from "../figures/probe";
import { BODIES, SYSTEM_T } from "../figures/system-times";
import { APPROACH_EYE, worldPose } from "./world";

const A: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
const B: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
const C: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
const D: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
/** How long (story time) the eye takes to settle onto the chase of a visitor's own launch. */
const CLICK_EASE = 0.035;
const t1 = new Vector3();
const t2 = new Vector3();

/**
 * The moves between poses, long and eased with a gentle smoothstep (its peak rate is 1.5 times its mean): fig. 4 to 5
 * the overview turns down over the inner system; fig. 5 to 6 back out over the trajectory; fig. 6 to 7 in to your
 * point (the chase takes over); the chase converges on the approach pose by itself, and the last few hundredths of
 * story time only correct the look onto the world's centre.
 */
const TO_ALIGN: [number, number] = [F.alignment - 0.22, F.alignment + 0.3];
const TO_WINDOW: [number, number] = [F.alignment + 0.72, F.window + 0.32];
const IN: [number, number] = [SYSTEM_T.dive[0], SYSTEM_T.countdown[0] + 0.04];
const LAND: [number, number] = [HANDOFF.ARRIVE - 0.1, HANDOFF.ARRIVE];

/**
 * The overview's poses as orbits of the eye: around a centre, by azimuth (degrees, 0 = from +z), elevation (degrees),
 * distance and vertical fov (and the narrowest horizontal fov it keeps on a narrow screen). The moves between them
 * blend these, not the eye's position, so the eye swings round the system at its distance instead of cutting through
 * it (where it would pass right over a planet).
 */
type Orb = { c: Vector3; az: number; el: number; d: number; fov: number; fovH: number };
const orb = (): Orb => ({ c: new Vector3(), az: 0, el: 0, d: 1, fov: 46, fovH: 62 });
const OA = orb();
const OB = orb();
const OC = orb();

/**
 * Fig. 4: up and back over the whole system; the drag turns it. Low enough (28°) that the near side of the outer
 * orbits stays above the copy once the framing lifts the scene (clearCopy).
 */
function gatherOrb(T: number, c: RigCtx, o: Orb) {
  const k = ss(F.gathering, F.alignment, T);
  o.c.set(SUN[0], SUN[1], SUN[2]);
  o.az = lerp(36, 50, k) + MathUtils.radToDeg(c.yaw);
  o.el = lerp(30, 28, k);
  o.d = lerp(128, 172, ease(k));
  o.fov = 48;
  o.fovH = 48 * 1.35;
  return o;
}

/** The world's longitude in degrees (as constants.ts PLANETS: from +x toward +z). */
const worldLonDeg = (T: number) => MathUtils.radToDeg(longitude(WORLD, T));

/**
 * Fig. 5: down over the inner system, a little toward the crossing (engineering's and product's orbits, around the
 * far end of engineering's eccentric orbit, which pokes out through product's), close enough that the near miss
 * reads, high enough that the ellipses read as ellipses (48-51°: higher, and the far side of the outer orbits, where
 * the ringed giant rides, climbs under the page's header). The eye keeps 77° of longitude ahead of the world as it
 * moves on (an azimuth of 90° less the eye's longitude), so the big blue world rides at the side of the frame, never
 * under the copy, and the giant passes between the header's name and its links, never under them.
 */
function alignOrb(T: number, o: Orb) {
  const k = ss(F.alignment, F.window, T);
  const m = PLANETS[0].mess;
  const apo = m.peri + m.prec * (T - F.gathering) + Math.PI;
  o.c.set(SUN[0] + Math.cos(apo) * 7, SUN[1], SUN[2] + Math.sin(apo) * 7);
  o.az = 90 - (worldLonDeg(T) + 77);
  o.el = lerp(48, 51, k);
  o.d = lerp(102, 96, k);
  o.fov = 46;
  o.fovH = 46 * 1.35;
  return o;
}

/** The trajectory's middle (world): the camera of fig. 6 frames the whole route, the sun to the world. */
const ROUTE_C = new Vector3(16, 0, -60);

/** Fig. 6: back out over the whole launch trajectory, a slow move along it while the planets slide onto their marks. */
function windowOrb(T: number, o: Orb) {
  const k = ss(F.window, SYSTEM_T.dive[0] + 0.1, T);
  o.c.copy(ROUTE_C);
  o.az = lerp(-4, 8, k);
  o.el = lerp(52, 47, k);
  o.d = lerp(166, 154, k);
  o.fov = 46;
  o.fovH = 64;
  return o;
}

/** a to b by k: the azimuth the shorter way round, the rest straight. */
function blendOrb(a: Orb, b: Orb, k: number, out: Orb) {
  let da = b.az - a.az;
  da -= 360 * Math.floor((da + 180) / 360);
  out.c.lerpVectors(a.c, b.c, k);
  out.az = a.az + da * k;
  out.el = lerp(a.el, b.el, k);
  out.d = lerp(a.d, b.d, k);
  out.fov = lerp(a.fov, b.fov, k);
  out.fovH = lerp(a.fovH, b.fovH, k);
  return out;
}

/** The eye of an orbit pose. */
function placeOrb(o: Orb, c: RigCtx, out: Pose) {
  const a = MathUtils.degToRad(o.az);
  const e = MathUtils.degToRad(o.el);
  out.target.copy(o.c);
  out.pos.set(
    o.c.x + Math.sin(a) * Math.cos(e) * o.d,
    o.c.y + Math.sin(e) * o.d,
    o.c.z + Math.cos(a) * Math.cos(e) * o.d,
  );
  out.fov = fovFor(o.fov, o.fovH, c.aspect);
  return out;
}

/** Figs 4-6 (from the ignition's pose, which the rig blends from as fig. 4 begins) until the camera closes in. */
export function orbitPose(T: number, c: RigCtx, out: Pose) {
  return clearCopy(portrait(c, overview(T, c, out), 1), c, 1);
}

/* ---- the copy's band ---- */

/**
 * The lower middle of the frame belongs to the copy (the figure's lines, from the caption's top, 71 % of the height
 * on a desktop and 60 % on a phone) and the hint ring under it. Its top in NDC (y up, a little above the caption) and
 * its half-width (NDC x, desktop; a phone's copy spans the width).
 */
const BAND_TOP = { desk: 1 - 2 * 0.665, phone: 1 - 2 * 0.555 };
const BAND_HALF_W = 0.7;
/** The most the framing lifts the scene (NDC: 0.4 is a fifth of the height), and the clearance it keeps (NDC). */
const LIFT_MAX = { desk: 0.5, phone: 0.38 };
const LIFT_PAD = 0.03;
/**
 * The header's row on a desktop (NDC y: the name and the fast lane sit in the top ~9 % of the height), which the sun's
 * disc stays under; and how much wider the sun's body in BODIES is than its disc (its glow: figures/system.ts bodies).
 */
const SUN_CEIL = 0.78;
const SUN_GLOW = 1.5;
const cf = new Vector3();
const cr = new Vector3();
const cu = new Vector3();
const cd = new Vector3();
const WUP = new Vector3(0, 1, 0);

/**
 * Keeps the copy clear: no bright body of figs 4-7 (figures/system-times.ts BODIES: the sun with its glow, the planets,
 * the giant with its rings) sits in the copy's band. For each body in the band, the pan (eye and look moved together
 * along the camera's up, so nothing turns) that lifts its disc just clear of the band; the camera takes the largest,
 * by `w`, up to LIFT_MAX. A body leaving the band sideways, or fading, asks less and less, so the pan is continuous.
 * Pure in the bodies' positions (functions of story time and the alignment): no state.
 */
function clearCopy(out: Pose, c: RigCtx, w: number, maxK = 1) {
  if (w <= 0) return out;
  const phone = c.aspect < 0.95;
  const top = phone ? BAND_TOP.phone : BAND_TOP.desk;
  const tanV = Math.tan((out.fov * Math.PI) / 360);
  const tanH = tanV * c.aspect;
  cf.subVectors(out.target, out.pos);
  const zt = cf.length();
  cf.divideScalar(zt);
  cr.crossVectors(cf, WUP).normalize();
  cu.crossVectors(cr, cf);
  const v = BODIES.v;
  const max = (phone ? LIFT_MAX.phone : LIFT_MAX.desk) * maxK * zt * tanV;
  let lift = 0;
  for (let i = 0; i < BODIES.n; i++) {
    const o = i * 5;
    const on = v[o + 4];
    if (on < 0.02) continue;
    cd.set(v[o] - out.pos.x, v[o + 1] - out.pos.y, v[o + 2] - out.pos.z);
    const z = cd.dot(cf);
    if (z < 2) continue;
    const y = cd.dot(cu) / (z * tanV);
    const x = cd.dot(cr) / (z * tanH);
    const ry = v[o + 3] / (z * tanV);
    const rx = v[o + 3] / (z * tanH);
    const need = top + LIFT_PAD - (y - ry);
    if (need <= 0) continue;
    // (eased over a third of the half-width, so a body swinging out sideways lets the frame down gently)
    const wx = phone ? 1 : 1 - ss(BAND_HALF_W - 0.08, BAND_HALF_W + 0.25, Math.abs(x) - rx);
    // (a body still below the frame is out of the picture, not in the copy: it asks as much as it shows, eased over
    // a good part of the frame so a small one rising into view does not jerk the camera)
    const shown = ss(0, 1, (y + ry + 1) / Math.max(2 * ry, 0.35));
    // (...and one about to pass beside the eye fades out of the reckoning, rather than dropping out of it)
    const k = Math.min(1, on * 1.4) * wx * shown * ss(2, 10, z);
    if (k <= 0) continue;
    lift = Math.max(lift, need * z * tanV * k);
  }
  // ...and the sun never rides up under the page's header: on a desktop the top of its disc (its radius without the
  // glow) stays below the header's row, on a phone (whose copy sits higher and needs the lift) its disc's centre stays
  // below the top tenth
  if (lift > 0 && v[4] > 0.02) {
    cd.set(v[0] - out.pos.x, v[1] - out.pos.y, v[2] - out.pos.z);
    const z = cd.dot(cf);
    if (z > 2) {
      const top = cd.dot(cu) / (z * tanV) + (phone ? 0 : v[3] / SUN_GLOW / (z * tanV));
      lift = Math.min(lift, Math.max(0, (phone ? 0.86 : SUN_CEIL) - top) * z * tanV);
    }
  }
  // (a soft ceiling: past 70 % of the limit it eases into it instead of stopping at it)
  const knee = 0.7 * max;
  if (lift > knee) lift = knee + (max - knee) * (1 - Math.exp(-(lift - knee) / (max - knee)));
  lift *= w;
  out.pos.addScaledVector(cu, -lift);
  out.target.addScaledVector(cu, -lift);
  return out;
}

/**
 * Portrait phones: the figure's copy sits in the lower half of the page, so the scene is framed higher (the eye tilts
 * down a touch, by w of the full tilt).
 */
function portrait(c: RigCtx, out: Pose, w: number) {
  const k = ss(0.95, 0.55, c.aspect) * w;
  if (k > 0) out.target.y -= k * 0.27 * out.pos.distanceTo(out.target);
  return out;
}

function overview(T: number, c: RigCtx, out: Pose) {
  if (T < TO_ALIGN[0]) return placeOrb(gatherOrb(T, c, OA), c, out);
  if (T < TO_ALIGN[1])
    return placeOrb(
      blendOrb(gatherOrb(T, c, OA), alignOrb(T, OB), ss(TO_ALIGN[0], TO_ALIGN[1], T), OC),
      c,
      out,
    );
  if (T < TO_WINDOW[0]) return placeOrb(alignOrb(T, OB), c, out);
  return placeOrb(
    blendOrb(alignOrb(T, OA), windowOrb(T, OB), ss(TO_WINDOW[0], TO_WINDOW[1], T), OC),
    c,
    out,
  );
}

/* ---- the chase ---- */

/**
 * How the camera rides. Your point flies out from the sun toward the world's night side and loops back onto it, so a
 * camera locked behind it would have to turn right round in the fast last legs. This one rides on your point's
 * sunward side and above it, holding a sunward heading that swings part of the way with your point's own (smoothed
 * over a long stretch of path), around an anchor that follows your point smoothed over the bends: your point swings
 * around each planet inside the frame while the camera glides. It looks a little toward the planet ahead. After the
 * giant it settles, by itself, onto the approach pose (poses/world.ts worldPose(0)): its distance, height and heading
 * become the approach's and the anchor comes to rest on the hub, so it arrives with your point.
 * Distances (world units) and heights (degrees above the anchor): at the launch, under way, and at the approach (the
 * approach pose's eye seen from the hub, where your point lands: set by approachEnd, once, on first use, since the
 * pose modules run nothing at import time).
 */
const DIST: [number, number, number] = [40, 30, 0];
const ELEV: [number, number, number] = [46, 25, 0];
/** Near the sun the camera looks past it, away from it, so it sits at the edge of the frame, not in its middle. */
const SUN_P = new Vector3(...SUN);
const AWAY = 10;
const CLEAR = 38;
/**
 * Around the giant the eye stands this much farther off (world units), so the giant and its rings fit above the copy;
 * it closes in again as your point leaves the giant (farther back, it would brush the ice world, the next flyby).
 */
const GIANT_BACK = 24;
const giantK = (pl: Plan, s: number) =>
  ss(pl.sIn[2] - 100, pl.sIn[2], s) * (1 - ss(pl.sPeri[2], pl.sOut[2] + 25, s));
const SWING = 0.32;
/**
 * How far (world units) the look leans toward the planet ahead, per flyby: further toward the ice world, which your
 * point reaches from below the eye (so it comes up into the frame, not under the copy).
 */
const LOOK = [4.5, 4.5, 4.5, 14];
const HEAD: [number, number] = [28, 52];
/** The sunward heading under way, and the approach pose's (from its eye to the hub, flattened). */
const HOME = new Vector3(-0.2, 0, -1).normalize();
const HOME_END = new Vector3();
let approachSet = false;
/** The approach's distance, height and heading, from its eye (poses/world.ts APPROACH_EYE) and the hub (HUB_P). */
function approachEnd() {
  approachSet = true;
  const d = HOME_END.subVectors(APPROACH_EYE, HUB_P);
  const L = d.length();
  DIST[2] = L;
  ELEV[2] = MathUtils.radToDeg(Math.asin(d.y / L));
  HOME_END.set(-d.x, 0, -d.z).normalize();
}
const t3 = new Vector3();
const t4 = new Vector3();
const t5 = new Vector3();

/** The camera's path: the plan, extended straight back from the launch along its first direction (no orbit loops). */
function camPath(pl: Plan, s: number, out: Vector3) {
  if (s >= 0) return pl.at(s, out);
  return out.copy(pl.s0).addScaledVector(pl.u0, s);
}
/** The mean of five points of the camera's path around s (±w). */
function mean(pl: Plan, s: number, w: number, out: Vector3) {
  out.set(0, 0, 0);
  for (let j = -2; j <= 2; j++) out.add(camPath(pl, s + (j * w) / 2, t4));
  return out.multiplyScalar(0.2);
}

/** How much the camera looks toward flyby k's planet at arc length s (a wide bump: from well before it to after it). */
function toward(pl: Plan, k: number, s: number) {
  return (
    ss(pl.sIn[k] - LEAD[k], pl.sIn[k] - 10, s) * (1 - ss(pl.sPeri[k] - 10, pl.sOut[k] + 90, s))
  );
}
/** How early (arc length) the look starts leaning toward each flyby's planet: the ice world from the giant on. */
const LEAD = [110, 110, 110, 240];

/** Riding with your point: on its sunward side and above it, swinging a little with it, settling onto the approach. */
function chasePose(T: number, c: RigCtx, out: Pose, pl: Plan = FLIGHT.plan) {
  if (!approachSet) approachEnd();
  const s = pl.sAt(T);
  const sh = Math.max(s, 0);
  // under way, and settling for the fall onto the world (from the giant on)
  const k1 = ss(0, 80, s);
  const k2 = ss(pl.sIn[2], pl.total, s);
  // the anchor: your point smoothed over the bends (before the launch: circling toward its mark)
  const p = s < 0 ? pl.at(s, t1) : mean(pl, s, 26 * ss(0, 45, s) * (1 - k2), t1);
  // your point's heading, from well behind to ahead, each end averaged over a stretch of path, flattened
  mean(pl, sh + HEAD[0], 40, t2);
  mean(pl, sh - HEAD[1], 40, t3);
  t2.sub(t3);
  t2.y = 0;
  t2.normalize();
  // the camera's heading: sunward, swung part of the way toward your point's, then the approach's
  t5.lerpVectors(HOME, HOME_END, k2)
    .normalize()
    .addScaledVector(t2, SWING * (1 - k2))
    .normalize();
  const d = lerp(lerp(DIST[0], DIST[1], k1) + GIANT_BACK * giantK(pl, s), DIST[2], k2);
  const e = MathUtils.degToRad(lerp(lerp(ELEV[0], ELEV[1], k1), ELEV[2], k2));
  out.pos.copy(p).addScaledVector(t5, -d * Math.cos(e));
  out.pos.y += d * Math.sin(e);
  // never ride right over the sun: a soft clearance pushes the eye out from it when it would come close
  t4.subVectors(out.pos, SUN_P);
  const dc = t4.length();
  const clear = Math.sqrt(dc * dc + CLEAR * CLEAR * (1 - ss(40, 75, dc)));
  if (dc > 1e-3) out.pos.copy(SUN_P).addScaledVector(t4, clear / dc);
  // ...nor brush a planet on the way (it would loom up under the copy): the same soft clearance round each (the
  // world's lets go as the eye settles onto its approach)
  for (let k = 0; k < PLANETS.length; k++) {
    const o = (k + 1) * 5;
    const C = (k === 3 ? 34 : k === WORLD ? 40 : k === 4 ? 32 : 22) * (1 - k2);
    if (BODIES.v[o + 4] < 0.02 || C <= 0) continue;
    t4.set(out.pos.x - BODIES.v[o], out.pos.y - BODIES.v[o + 1], out.pos.z - BODIES.v[o + 2]);
    const dp = t4.length();
    if (dp < 1e-3 || dp > 2 * C) continue;
    out.pos.addScaledVector(t4, (Math.sqrt(dp * dp + C * C * (1 - ss(C, 2 * C, dp))) - dp) / dp);
  }
  // look at the anchor, drawn toward the planet ahead, and away from the sun while it is close
  out.target.copy(p);
  for (let j = 0; j < pl.C.length; j++) {
    const w = toward(pl, j, s) * (1 - k2);
    if (w <= 0) continue;
    t4.subVectors(pl.C[j], p);
    const L = t4.length();
    if (L > 1e-3) out.target.addScaledVector(t4, (LOOK[j] * w * Math.min(1, L / 16)) / L);
  }
  t4.subVectors(p, SUN_P);
  const ds = Math.hypot(t4.x, t4.z);
  t4.y = 0;
  if (ds > 1e-3) out.target.addScaledVector(t4, (AWAY * (1 - ss(16, 36, ds))) / ds);
  out.fov = lerp(fovFor(50, 66, c.aspect), fovFor(40, 60, c.aspect), k2);
  // (the chase may lift the scene further than the overview: your point rides high, the sun under it)
  return clearCopy(portrait(c, out, 1 - k2), c, 1 - k2, 1.6);
}

/** Fig. 7: in from the window to your point, the chase through the flybys, onto the world's approach pose at ARRIVE. */
export function divePose(T: number, c: RigCtx, out: Pose) {
  chasePose(T, c, C);
  // a visitor's launch swaps the plan the chase reads (its heading, the planet ahead): the eye eases from the default
  // plan's pose to the new one's, so the click never nudges the camera
  if (FLIGHT.clickT >= 0 && T < FLIGHT.clickT + CLICK_EASE) {
    chasePose(T, c, D, DEFAULT);
    blend(D, C, ss(FLIGHT.clickT, FLIGHT.clickT + CLICK_EASE, T), C);
  }
  if (T < IN[1]) {
    orbitPose(T, c, A);
    const k = ss(IN[0], IN[1], T);
    blend(A, C, k, out);
    // turn to your point a little early, so the move in reads as one look
    out.target.lerpVectors(A.target, C.target, ss(0, 0.8, k));
    // (both ends keep the copy clear; the move between them is cleared too, coming in from nothing at its start)
    return clearCopy(out, c, ss(0, 0.3, k), 1.6);
  }
  if (T < LAND[0]) return blend(C, C, 0, out);
  worldPose(0, c, B);
  return blend(C, B, ss(LAND[0], LAND[1], T), out);
}
