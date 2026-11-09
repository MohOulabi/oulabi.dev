/**
 * The flock (docs/STORY.md fig. 10): the motes that waited on the world's night side rise into a murmuration (from
 * journey HANDOFF.FLOCK_FROM). At first it follows the cursor, trailing it like birds (BEATS.flock.follow); then it
 * stops needing you (BEATS.flock.free): its own long figure of eight over the night side takes over, changing formation
 * as it goes (a stream, a sheet, a vortex, two flocks in step), and if the cursor comes near, it parts around it and
 * heals behind (glsl/finale.ts flockAccel). A visitor who was leading it and stops (the "let go" hint) frees it there
 * and then, in show time (LETGO). Untouched, it flies on its own the whole time. Holding gathers it into a
 * sphere, letting go bursts it; a tap bursts it where it struck. As the camera pulls away in fig. 11 the motes settle
 * back onto the night side, hidden, until the galaxy lights them (glsl/timeline.ts land, figures/galaxy.ts).
 *
 * Time-based (its spring, its path, its formations) with weights that are functions of story time; the sim draws it
 * from uFlock*, uForm, uAvoid, uBurst*. Writes anchor `flock` (its centre) while it flies, and shared.play.autonomy.
 */
import { Euler, Matrix3, Matrix4, Vector3, type Vector4 } from "three";
import { shared } from "@/gl/shared";
import { axisTurn } from "@/gl/world/layout";
import { ANCHOR, setAnchor } from "@/lib/anchors";
import { wake } from "@/lib/clock";
import { hold } from "@/lib/hold";
import { BEATS, F, HANDOFF, HINTS } from "@/lib/journey";
import { FLOCK_HOME } from "../constants";
import { damp, type Figure, type FrameCtx, ss, type Win } from "../frame";

/** Story times the flock owns. glsl/timeline.ts writes rise and land into GLSL. */
export const FLOCK_T = {
  /** The flock's motes rise off the world's night side into the murmuration (journey BEATS.flock.rise). */
  rise: [HANDOFF.FLOCK_FROM + BEATS.flock.rise[0], F.flock + BEATS.flock.rise[1] + 0.2] as Win,
  /** It flies (the spring, the cursor's lead, the hold) between these: fades in, fades out. */
  in: [HANDOFF.FLOCK_FROM + 0.06, F.flock + 0.28] as Win,
  out: [F.again, F.again + 0.14] as Win,
  /** It stops needing you (journey BEATS.flock.free): the cursor's lead hands over to its own path and formations. */
  free: [F.flock + BEATS.flock.free[0], F.flock + BEATS.flock.free[0] + 0.17] as Win,
  /** The motes settle back onto the night side, hidden, as the camera pulls away (fig. 11). */
  land: [F.again + 0.02, F.again + 0.3] as Win,
};

/** Rough half-length of the murmuration at flockS = 1 (world units), the anchor's radius. */
const FLOCK_R = 8;
/**
 * Its own path: a long figure of eight over the night side (world units around FLOCK_HOME), swooping up and down,
 * the figure itself turning slowly; w: its pace (rad per second of show time).
 */
const PATH = { x: 5.2, y: 1.3, z: 4.4, w: 0.2, dy: -2.3 };
/**
 * The formations it flies on its own, slot by slot (seconds of show time each; the cloud between them), crossfaded:
 * -1 the cloud, 0 a stream, 1 a sheet, 2 a vortex, 3 two flocks. The order reads as a conversation, not a cycle.
 */
const FORMS = [-1, 0, -1, 1, 2, -1, 3, 0, 1, -1, 2, 3];
const SLOT = 6.5;
const XFADE = 2.8;
/** The cursor's reach while the flock is free (CSS px): the birds part around it. */
const AVOID_PX = 78;
/**
 * "Let go" (journey HINTS flock letgo): inside its window, a flock that is following you and a pointer that stops
 * leading it (a mouse at rest this long, or a finger lifted, at once) lets it go: it frees itself in show time over LETGO_S
 * instead of waiting for the scroll (BEATS.flock.free), so letting go is answered where the visitor let go.
 */
const LETGO_WIN = (HINTS.find((h) => h.fig === "flock" && h.verb === "letgo")?.win ?? [
  0.5, 0.7,
]) as readonly [number, number];
const LETGO_MS = 550;
const LETGO_S = 1.1;
/**
 * The line its body stays above (fraction of the height from the top; desktop and tablet, phone layout: poses/world.ts
 * keeps the world under the first, and above the copy on a phone), and its body's half-height as a share of FLOCK_R.
 */
const COPY_LINE = [0.66, 0.31] as const;
const BODY_H = 0.5;

export class Flock implements Figure {
  private flockC = new Vector3(...FLOCK_HOME);
  private flockV = new Vector3();
  private gather = 0;
  private wasPressing = false;
  private lead = 0;
  /** The visitor let it go (latched inside the let-go window), and how far it has freed itself since, 0..1. */
  private released = false;
  private letGo = 0;
  private avoid = 0;
  private head = new Vector3(1, 0, 0.15);
  private bank = 0;
  private lastTap: number;
  private v1 = new Vector3();
  private v2 = new Vector3();
  private v3 = new Vector3();
  private vq = new Vector3();
  private vx = new Vector3();
  private vy = new Vector3();
  private vz = new Vector3();
  private hv = new Vector3();
  private m4 = new Matrix4();
  private tumble = new Matrix3();
  private eul = new Euler();

  constructor() {
    this.lastTap = hold.tapAt;
  }

  /** Start over (src/lib/restart.ts): following again, never let go, nothing gathered; at home over the night side. */
  reset() {
    this.flockC.set(...FLOCK_HOME);
    this.flockV.set(0, 0, 0);
    this.gather = 0;
    this.wasPressing = false;
    this.lead = 0;
    this.released = false;
    this.letGo = 0;
    this.avoid = 0;
    this.bank = 0;
    this.lastTap = hold.tapAt;
  }

  frame(f: FrameCtx) {
    const { U, T, dt, time, now, presence } = f;
    const cam = f.camera;
    const on = ss(FLOCK_T.in[0], FLOCK_T.in[1], T) * (1 - ss(FLOCK_T.out[0], FLOCK_T.out[1], T));
    // free by the scroll, or sooner where the visitor let it go (scrolling back above the window takes that back)
    const kf = T - F.flock;
    if (kf < LETGO_WIN[0] - 0.06) {
      this.released = false;
      this.letGo = 0;
    } else if (
      !this.released &&
      !f.reduce &&
      kf >= LETGO_WIN[0] &&
      kf <= LETGO_WIN[1] &&
      this.lead > 0.2 &&
      this.leftGo(now)
    ) {
      this.released = true;
      wake(LETGO_S * 1000 + 600);
    }
    if (this.released) this.letGo = f.snapping ? 1 : Math.min(1, this.letGo + dt / LETGO_S);
    const lg = this.letGo * ss(LETGO_WIN[0] - 0.06, LETGO_WIN[0], kf);
    const free = Math.max(ss(FLOCK_T.free[0], FLOCK_T.free[1], T), lg * lg * (3 - 2 * lg));
    shared.play.autonomy = free;
    const home = this.v1.set(...FLOCK_HOME);
    const narrow = f.aspect < 1;
    const scale = narrow ? 0.42 : 0.56;

    // its own path, untouched: the figure of eight over the night side
    const path = this.ownPath(time, narrow ? 0.62 : 1, this.v3);

    // at first the cursor leads it: a point on a plane through the flock, facing the camera
    const recent = presence && now - hold.lastMove < 2500 && on > 0.2;
    this.lead = damp(this.lead, recent ? 1 - free : 0, recent ? 3 : 1.2, dt);
    if (this.lead > 0.001) {
      const denom = f.rayD.dot(f.fwd);
      const t = denom > 1e-4 ? this.v2.subVectors(home, cam.position).dot(f.fwd) / denom : 30;
      this.v2.copy(cam.position).addScaledVector(f.rayD, t).sub(home).clampLength(0, 11).add(home);
      path.lerp(this.v2, this.lead);
    }

    // free, it swerves a little from a cursor that comes close (the birds part around it in the sim)
    const here = !f.reduce && (hold.pointerType === "touch" ? hold.down : hold.inside) ? 1 : 0;
    this.avoid = damp(this.avoid, free * here * (on > 0.5 ? 1 : 0), 4, dt);
    U.uAvoid.value = this.avoid;
    U.uAvoidR.value = (AVOID_PX * f.dpr) / f.proj;
    if (this.avoid > 0.01) {
      const rel = this.v2.subVectors(this.flockC, cam.position);
      const along = Math.max(0, rel.dot(f.rayD));
      rel.addScaledVector(f.rayD, -along);
      const d = rel.length();
      const R = U.uAvoidR.value * along * 1.8;
      if (d < R && d > 1e-3) path.addScaledVector(rel, ((R - d) / d) * 0.35 * this.avoid);
    }

    // led or free, it flies above the lines of copy (its lower edge may come down to them, never onto them)
    this.aboveCopy(f, path, scale, f.width / f.dpr <= 760);

    // a soft spring: the flock trails its lead like birds, not like a cursor
    const acc = this.v2
      .subVectors(path, this.flockC)
      .multiplyScalar(2.2)
      .addScaledVector(this.flockV, -2.4);
    this.flockV.addScaledVector(acc, dt);
    this.flockC.addScaledVector(this.flockV, dt);
    if (on <= 0 || f.snapping) {
      this.flockC.copy(on <= 0 ? home : path);
      this.flockV.set(0, 0, 0);
    }
    // the motes that wait on the night side wait over the lights where the visitor's drag has turned the world
    axisTurn(U.uWorldTurn.value as Matrix3, shared.earth.turn);
    U.uFlockC.value.copy(this.flockC);
    this.orient(f, acc, U.uFlockM.value as Matrix3);
    U.uFlockS.value = scale;
    U.uFlockT.value = time;
    this.formations(free, time, U.uForm.value as Vector4);

    // hold gathers it into a sphere; release bursts it everywhere; a tap bursts it where it struck (one frame each)
    const pressing = hold.pressing && on > 0.6;
    this.gather = damp(this.gather, pressing ? 1 : 0, pressing ? 2.4 : 7, dt);
    if (U.uBurst.value > 0) U.uBurst.value = 0;
    if (this.wasPressing && !pressing && this.gather > 0.35 && on > 0.6) {
      U.uBurst.value = 1.4;
      U.uBurstP.value.copy(this.flockC);
      U.uBurstR.value = 1e4;
    }
    this.wasPressing = pressing;
    if (hold.tapAt > this.lastTap) {
      this.lastTap = hold.tapAt;
      if (on > 0.6 && now - hold.tapAt < 600 && !pressing) this.tapBurst(f, scale);
    }
    U.uGather.value = this.gather;

    if (on > 0)
      setAnchor(ANCHOR.flock, this.flockC.x, this.flockC.y, this.flockC.z, FLOCK_R * scale, on);
  }

  /** The visitor stopped leading: a mouse at rest LETGO_MS, or a finger lifted (at once: lifting it is the letting go). */
  private leftGo(now: number) {
    return hold.pointerType === "touch" ? !hold.down : now - hold.lastMove > LETGO_MS;
  }

  /**
   * Lift the flock's lead `p` (world) so its body's lower edge stays above the copy's line on screen (COPY_LINE: the
   * caption's top on a desktop; on a phone, the top of the world, which sits above the copy there).
   */
  private aboveCopy(f: FrameCtx, p: Vector3, scale: number, phone: boolean) {
    const cam = f.camera;
    const depth = this.vq.subVectors(p, cam.position).dot(f.fwd);
    if (depth < 1) return;
    const y = this.vq.copy(p).project(cam).y;
    const ext = (2 * BODY_H * FLOCK_R * scale * f.proj) / (depth * f.height);
    const under = 1 - 2 * COPY_LINE[phone ? 1 : 0] - (y - ext);
    if (under > 0) p.addScaledVector(f.up, (under * depth * f.height) / (2 * f.proj));
  }

  /** The flock's own path at show time `time` (a figure of eight, turning slowly; `wide` narrows it on a phone). */
  private ownPath(time: number, wide: number, out: Vector3) {
    const s = time * PATH.w;
    const x = PATH.x * wide * Math.sin(s);
    const z = PATH.z * Math.sin(2 * s) * 0.5 * (1 + 0.25 * Math.sin(time * 0.07));
    const y = PATH.y * Math.sin(2 * s + 0.9) + 0.8 * Math.sin(time * 0.11 + 1.3);
    const turn = 0.32 * Math.sin(time * 0.043);
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    return out.set(
      FLOCK_HOME[0] + x * c - z * sn,
      FLOCK_HOME[1] + PATH.dy + y,
      FLOCK_HOME[2] + x * sn + z * c,
    );
  }

  /**
   * Its body turns along its heading (the stream runs the way it flies) and banks into its turns, with a slow wobble;
   * while it hangs still it keeps the last heading it had.
   */
  private orient(f: FrameCtx, acc: Vector3, out: Matrix3) {
    const k = 1 - Math.exp(-f.dt * 1.4);
    const sp = this.flockV.length();
    if (sp > 0.05)
      this.head.lerp(this.hv.copy(this.flockV).divideScalar(sp), k * Math.min(1, sp / 1.2));
    const X = this.vx.copy(this.head);
    if (X.lengthSq() < 1e-4) X.set(1, 0, 0);
    X.normalize();
    // keep the long axis off the vertical
    X.y *= 0.55;
    X.normalize();
    const Z = this.vz.set(0, 1, 0).cross(X).multiplyScalar(-1);
    if (Z.lengthSq() < 1e-6) Z.set(0, 0, 1);
    Z.normalize();
    const Y = this.vy.crossVectors(Z, X).normalize();
    const lateral = acc.dot(Z);
    this.bank = damp(this.bank, Math.max(-0.5, Math.min(0.5, -lateral * 0.16)), 2.2, f.dt);
    const roll = this.bank + 0.16 * Math.sin(f.time * 0.37) * f.motion;
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    // roll Y and Z about X
    this.v1.copy(Y).multiplyScalar(c).addScaledVector(Z, s);
    Z.multiplyScalar(c).addScaledVector(Y, -s);
    Y.copy(this.v1);
    out.set(X.x, Y.x, Z.x, X.y, Y.y, Z.y, X.z, Y.z, Z.z);
    // a slow tumble of the cloud's own shape on top (as before), so it never looks rigid
    this.eul.set(
      Math.sin(f.time * 0.21) * 0.22,
      Math.sin(f.time * 0.13) * 0.35,
      Math.sin(f.time * 0.17) * 0.12,
    );
    this.m4.makeRotationFromEuler(this.eul);
    out.multiply(this.tumble.setFromMatrix4(this.m4));
  }

  /**
   * The formations' weights: led, it streams when you lead it fast; free, it flies its own sequence, slot by slot,
   * crossfaded (time-based, so it never repeats on the beat of the scroll).
   */
  private formations(free: number, time: number, out: Vector4) {
    out.set(0, 0, 0, 0);
    const slot = time / SLOT;
    const i = Math.floor(slot);
    const x = ss(1 - XFADE / SLOT, 1, slot - i);
    const n = FORMS.length;
    const a = FORMS[((i % n) + n) % n];
    const b = FORMS[(((i + 1) % n) + n) % n];
    const wa = (1 - x) * free;
    const wb = x * free;
    if (a >= 0) out.setComponent(a, out.getComponent(a) + wa);
    if (b >= 0) out.setComponent(b, out.getComponent(b) + wb);
    // led fast, it draws out into a stream behind you
    const stream = ss(3, 12, this.flockV.length()) * 0.6 * (1 - free);
    out.x += stream;
  }

  /** A tap bursts the flock where it struck: the tap's ray meets the plane through the flock, facing the camera. */
  private tapBurst(f: FrameCtx, scale: number) {
    const U = f.U;
    const cam = f.camera;
    const d = this.v2.set(hold.tx, hold.ty, 0.5).unproject(cam).sub(cam.position).normalize();
    const denom = d.dot(f.fwd);
    if (denom < 1e-4) return;
    const t = this.v1.subVectors(this.flockC, cam.position).dot(f.fwd) / denom;
    const p = this.v1
      .copy(cam.position)
      .addScaledVector(d, t)
      .sub(this.flockC)
      .clampLength(0, FLOCK_R * scale * 1.3)
      .add(this.flockC);
    U.uBurst.value = 0.6;
    U.uBurstP.value.copy(p);
    U.uBurstR.value = 5 * scale + 1.5;
  }
}
