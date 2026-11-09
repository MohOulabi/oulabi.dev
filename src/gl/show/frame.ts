/**
 * The frame context: one preallocated object the engine (./engine.ts) fills every frame and hands to every figure
 * controller (./figures), so each owner reads the same clock, pointer, camera and uniforms without reaching into the
 * engine or another figure. Plain fields only; nothing in here allocates per frame.
 *
 * Order of a frame (engine.ts): the clock, the pointer and the snap are written; every figure's `pre` runs (genesis
 * decides the bang and writes freed / live / bangAge / settle, the collapse and the ignition kick; the system places
 * the planets and turns the orbit drag into the rig's yaw); the camera is placed from `rig` and fwd / right / up /
 * rayD / proj are written; every figure's `frame` runs (uniforms, sprites, anchors); then the shared look, the thread
 * sprite, the gas, the sim step, and, after the frame is drawn, the anchors projector (src/gl/project.ts).
 */
import { type IUniform, PerspectiveCamera, type Scene, Vector3 } from "three";
import { presenceAt as worldPresence } from "@/gl/world/layout";
import { PLANET } from "@/lib/journey";
import type { RigCtx } from "./camera";
import { PLANETS, SUN, SUN_R, WORLD } from "./constants";
import type { Cosmos } from "./cosmos";
import type { FX } from "./fx";

type Uniforms = Record<string, IUniform>;

export type FrameCtx = {
  /** The camera of this frame (placed by the rig between the `pre` and `frame` hooks). */
  camera: PerspectiveCamera;
  /** Seconds since the last frame (clamped to 1/240 .. 1/20) and performance.now() of this frame (ms). */
  dt: number;
  now: number;
  /** Story time (story.Ts, read on past the last figure by story.after). */
  T: number;
  /** Show time in seconds: stops with reduced motion, slows while the record is read (twinkle, spin, flock). */
  time: number;
  /** 0 with reduced motion, else 1 (multiply time-based motion by it); reduce: story.reducedMotion. */
  motion: number;
  reduce: boolean;
  /** 1 on the frame story time jumped (a nav cut, a deep link), 2 on the frame after, else 0. */
  snap: number;
  /** Land at once this frame (reduced motion, or a jump). */
  snapping: boolean;
  /** How far the visitor has read into the record under the show, 0..1 (the show dims and slows under it). */
  read: number;

  /** 1 once the pointer has moved on the page, else 0. */
  presence: number;
  /** The pointer, damped: px / py in -1..1 (0 with no pointer), speed in CSS px per second. */
  px: number;
  py: number;
  speed: number;

  /** The bang, written by genesis in its `pre` hook. freed: the sky has let go of its stars (bang or scroll). */
  freed: boolean;
  /** A real bang is playing out (bangAge < 12 s), seconds since it fired (1e3 when none), 0..1 the blast settling. */
  live: boolean;
  bangAge: number;
  settle: number;
  /** True on the one frame the bang fires; bangP is where (world units), valid from that frame on. */
  bangNow: boolean;
  bangP: Vector3;

  /** The sim's uniforms (shared by its two passes and the points draw), the gas's, and both (the genesis inputs). */
  U: Uniforms;
  G: Uniforms;
  uSets: Uniforms[];
  /** The solid things of genesis (sun, planets, orbits, young stars) and the sprites around the motes. */
  cosmos: Cosmos;
  fxs: FX;
  /** The rig's inputs (figures write kick and yaw in `pre`; the engine the rest). */
  rig: RigCtx;

  /** Camera basis (unit, world) and the pointer's ray direction from the camera, written after the camera. */
  fwd: Vector3;
  right: Vector3;
  up: Vector3;
  rayD: Vector3;
  /** Canvas size in device px, its aspect, the pixel ratio and the shorter side in CSS px. */
  width: number;
  height: number;
  aspect: number;
  dpr: number;
  vmin: number;
  /** Device px per world unit at unit view depth (the points shader's uProj), for this frame's camera. */
  proj: number;
  /** World size of `cssPx` CSS pixels at p (view depth along fwd), for this frame's camera. */
  worldPx: (p: Vector3, cssPx?: number) => number;
  /**
   * How hidden p is from this frame's camera behind a solid body drawn this frame (the sun, the planets, the world
   * module's planet), 0..1, softened at the limb. A point on or inside a body is never hidden by it (it is that body).
   * Valid in `frame` (it reads the camera and the bodies placed in `pre`). The projector's `vis` ignores occlusion.
   */
  hidden: (p: Vector3) => number;
};

/**
 * A figure controller: it owns its state and its slice of the show, and reads everything else from the frame
 * context. `pre` runs before the camera is placed (state the rig reads this frame), `frame` after it.
 */
export interface Figure {
  pre?(f: FrameCtx): void;
  frame(f: FrameCtx): void;
  /** Add and remove what it draws in the main scene (most figures draw through the sim, the gas and the cosmos). */
  mount?(scene: Scene): void;
  unmount?(scene: Scene): void;
  /**
   * Start over (src/lib/restart.ts): forget what the visitor did and what the figure latched this visit, as on
   * arrival. Runs in the dark, the story at T 0; the engine snaps the next frame, so nothing eases back on screen.
   */
  reset?(): void;
  dispose?(): void;
}

export function createFrameCtx(
  init: Pick<FrameCtx, "U" | "G" | "cosmos" | "fxs" | "rig">,
): FrameCtx {
  const d = new Vector3();
  const sun = new Vector3(...SUN);
  const world = new Vector3(...PLANET.center);
  const oc = new Vector3();
  const pc = new Vector3();
  const body = new Vector3();
  /** How much the sphere (c, r), present w, hides p from the camera at o: 0 unless it lies between them. */
  const behind = (p: Vector3, c: Vector3, r: number, w: number) => {
    if (w <= 0.002 || r <= 0) return 0;
    const o = f.camera.position;
    if (pc.subVectors(p, c).length() < r * 1.02) return 0;
    d.subVectors(p, o);
    const L = d.length();
    if (L < 1e-4) return 0;
    d.divideScalar(L);
    const tca = oc.subVectors(c, o).dot(d);
    // the body's centre is behind the eye, or beyond the point (then the segment misses it: p is outside it)
    if (tca <= 0 || tca >= L) return 0;
    const b = Math.sqrt(Math.max(0, oc.lengthSq() - tca * tca));
    return w * (1 - ss(r * 0.92, r * 1.04, b));
  };
  const f: FrameCtx = {
    camera: new PerspectiveCamera(),
    dt: 1 / 60,
    now: 0,
    T: 0,
    time: 0,
    motion: 1,
    reduce: false,
    snap: 0,
    snapping: false,
    read: 0,
    presence: 0,
    px: 0,
    py: 0,
    speed: 0,
    freed: false,
    live: false,
    bangAge: 1e3,
    settle: 0,
    bangNow: false,
    bangP: new Vector3(),
    U: init.U,
    G: init.G,
    uSets: [init.U, init.G],
    cosmos: init.cosmos,
    fxs: init.fxs,
    rig: init.rig,
    fwd: new Vector3(0, 0, -1),
    right: new Vector3(1, 0, 0),
    up: new Vector3(0, 1, 0),
    rayD: new Vector3(0, 0, -1),
    width: 1,
    height: 1,
    aspect: 1.6,
    dpr: 1,
    vmin: 900,
    proj: 1000,
    worldPx: (p, cssPx = 1) => {
      const depth = d.subVectors(p, f.camera.position).dot(f.fwd);
      return (cssPx * f.dpr * Math.max(depth, 0.1)) / f.proj;
    },
    hidden: (p) => {
      const co = f.cosmos;
      let h = behind(p, sun, SUN_R * co.sunScale, co.sunVis);
      for (let k = 0; k < PLANETS.length; k++) {
        const v = co.planetV[k];
        const w = co.planetFade * (k === WORLD ? co.worldFade : co.othersFade);
        if (w > 0.002) h = Math.max(h, behind(p, body.set(v.x, v.y, v.z), PLANETS[k].r, w));
      }
      return Math.max(h, behind(p, world, PLANET.radius, worldPresence(f.T)));
    },
  };
  return f;
}

/* ---- the small math every controller uses ---- */

export const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential approach of `cur` to `to`. */
export const damp = (cur: number, to: number, rate: number, dt: number) =>
  to + (cur - to) * Math.exp(-rate * dt);
/** A story-time window [from, to). */
export type Win = [number, number];
