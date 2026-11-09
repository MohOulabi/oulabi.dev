/**
 * The planetary system (docs/STORY.md figs 4-7).
 *
 * Fig. 4, gathering: as the arms wind into rings the disk's dust condenses into the planets (the motes stream along
 * their orbits into each ball, then the solid sphere takes over, solid by journey HANDOFF.PLANETS_SOLID). They arrive
 * on messy orbits (./orbits.ts): eccentric, a little inclined, precessing, the dust lanes following them (uOrb). The
 * drag turns the camera around the system.
 *
 * Fig. 5, alignment: engineering's orbit crosses product's and the two planets head for a near miss (never closer than
 * about 6 units, centre to centre). Holding (hold.pressing inside SYSTEM_T.pull) deepens the sun's pull: the sun swells
 * and brightens a touch, the belt tightens, every orbit contracts toward its clean ring and the two paths separate.
 * Untouched, they settle on their own, slower, by the end of SYSTEM_T.settle. Writes shared.play pull, aligned and
 * alignedByVisitor (the hold did most of the work: it pulled at least half way).
 *
 * Fig. 6, the window: the planet clock slows and each planet slides along its orbit onto its mark on the one launch
 * trajectory (./probe.ts), there by HANDOFF.WINDOW_SET; your point slides onto its launch mark on its close orbit.
 *
 * Fig. 7, gravity assist: your point launches at the end of the countdown, or at the visitor's click in it (the click
 * fires a burn in show time, KICK, so the launch is seen at once, at rest), and slingshots past product, engineering, data and operations onto the world's night side, touching the hub exactly at
 * HANDOFF.ARRIVE (./probe.ts). The world planet is at rest at journey PLANET from HANDOFF.WORLD_FROM, so the world
 * module's sphere fades in exactly over it (HANDOFF.WORLD_HANDOFF).
 *
 * `pre` runs before the camera: the alignment, the planets (the sim and the gas read them this frame), the orbit
 * lanes, the drag's yaw and the launch (the rig's chase reads ./probe.ts FLIGHT). `frame` writes the ink: planet0..4
 * and orbit0..4 (the real current ellipses) while each planet is present, `world`, the flight (`probe`, `assist`,
 * `trail`) and the thread (anchor `yours`) from fig. 4 to the hub. No allocations per frame.
 */

import type { Scene } from "three";
import { Vector3, type Vector4 } from "three";
import { shared } from "@/gl/shared";
import { HUB as HUB_DIR, presenceAt as worldPresence } from "@/gl/world/layout";
import { ANCHOR, PATH, type Path, path, setAnchor, touchPath } from "@/lib/anchors";
import { wake } from "@/lib/clock";
import { hold } from "@/lib/hold";
import { F, HANDOFF, PLANET } from "@/lib/journey";
import { PLANETS, SUN, SUN_R, WORLD } from "../constants";
import { damp, type Figure, type FrameCtx, ss } from "../frame";
import { Drag } from "./drag";
import { Orbits, POINT_DRIFT, pointAngle, SLIDE_D, slideOn, wrapPi } from "./orbits";
import { FLIGHT, L_DEF, ORDER, type Plan, setLaunch, Trail } from "./probe";
import { BODIES, SYSTEM_T } from "./system-times";
import { CLOSE, closeOrbitAt } from "./thread";

export { SYSTEM_T };

/** Points per orbit path (the ink's dashed orbits): a closed polyline, the last point on the first. */
const ORBIT_PTS = 64;
/**
 * Seconds of holding that align the orbits all the way (the visitor's pull). The pull answers at once and lands
 * gently (an ease-out of the held time), so the first moment of the hold already moves the paths apart.
 */
const PULL_S = 1.4;
/**
 * Fig. 7: a visitor's launch is felt the moment they click. The flight itself is scrubbed by the scroll, so at rest it
 * would not move; the click fires a burn in show time instead: your point leaves its close orbit and runs this far
 * along its trajectory (world units of arc, a little short of the first flyby) over KICK_S seconds, its trail drawn
 * behind it. The scroll then carries the flight on from wherever it is ahead (max of the two: never a step back).
 */
const KICK = 12;
const KICK_S = 1.3;
/** Scrolling back before the launch takes the burn back over this much story time (no jump onto the orbit). */
const KICK_BACK = 0.04;

const PLANET_IDS = PLANETS.map((_, i) => ANCHOR.planet(i));
const TAU = Math.PI * 2;

export class System implements Figure {
  private drag: Drag;
  private dragLive = false;
  private yaw = 0;
  private yawV = 0;
  private planetC = new Vector3(...PLANET.center);
  private sunP = new Vector3(...SUN);
  readonly orbits = new Orbits();
  /** QA: the flight and the planets' slides onto their marks. */
  readonly flightQA = FLIGHT;
  readonly slideQA = SLIDE_D;
  private orbitPaths: Path[];
  private assistPath: Path;
  private trailPath: Path;
  private trail: Trail;
  // fig. 5: the visitor's pull (recorded, 0..1), the hold's live response, the outcome
  private pull = 0;
  private press = 0;
  private aligned = 0;
  private byVisitor = false;
  private done = false;
  // your point: its show-time drift on the close orbit (held through the slide, so the slide never pops)
  private drift = 0;
  private held = false;
  private lastTap = -1;
  /** performance.now() of the visitor's launch click (-1: none), for the burn it fires. */
  private kickAt = -1;
  /** Where your point was on its flight (arc length, 0 before the launch) when the burn fired. */
  private kickFrom = 0;
  // scratch
  private v1 = new Vector3();
  private v2 = new Vector3();

  constructor() {
    this.drag = new Drag(() => this.dragLive);
    this.orbitPaths = PLANETS.map((_, k) => path(PATH.orbit(k), ORBIT_PTS));
    this.assistPath = path(PATH.assist, FLIGHT.plan.assistS.length);
    this.trailPath = path(PATH.trail, FLIGHT.plan.trailS.length);
    this.trail = new Trail(shared.tier);
    this.lastTap = hold.tapAt;
  }

  /**
   * Start over (src/lib/restart.ts): no launch (the default plan), no pull or alignment of the visitor's, the drag
   * let go and the system unturned, your point's drift on its close orbit from its own start (./thread.ts CLOSE).
   */
  reset() {
    setLaunch(-1);
    this.kickAt = -1;
    this.kickFrom = 0;
    this.lastTap = hold.tapAt;
    this.pull = 0;
    this.press = 0;
    this.aligned = 0;
    this.byVisitor = false;
    this.done = false;
    this.drift = 0;
    this.held = false;
    CLOSE.off = 0;
    this.drag.release();
    this.dragLive = false;
    this.yaw = 0;
    this.yawV = 0;
  }

  mount(scene: Scene) {
    this.trail.mount(scene);
  }
  unmount(scene: Scene) {
    this.trail.unmount(scene);
  }

  pre(f: FrameCtx) {
    const { T, dt } = f;
    const co = f.cosmos;
    const [h0, h1] = SYSTEM_T.worldHandoff;

    // the planets: the disk's dust condenses into them; the world hands over to the world module
    co.planetFade = ss(SYSTEM_T.solid[0], SYSTEM_T.solid[1], T);
    co.worldFade = 1 - ss(h0, h1, T);
    // the world's silhouette hides what is behind it while the world module draws it opaque
    co.occluderOn = T > h0 && worldPresence(T) > 0.5;
    co.othersFade = 1 - ss(SYSTEM_T.othersOut[0], SYSTEM_T.othersOut[1], T);
    co.ringFade = Math.min(co.planetFade, co.othersFade);
    co.orbitsI =
      0.42 *
      ss(SYSTEM_T.orbitsIn[0], SYSTEM_T.orbitsIn[1], T) *
      (1 - 0.6 * ss(SYSTEM_T.orbitsThin[0], SYSTEM_T.orbitsThin[1], T)) *
      (1 - ss(SYSTEM_T.orbitsOut[0], SYSTEM_T.orbitsOut[1], T));
    // the dust dims as its sphere takes over (a touch after the sphere, so no planet is ever empty)
    f.U.uPlanetSolid.value = ss(SYSTEM_T.solid[0] + 0.02, SYSTEM_T.solid[1] + 0.02, T);

    this.alignment(f);
    this.place(f);
    this.launch(f);
    this.bodies(f);

    // the drag turns the system; it coasts, and lets go as fig. 5 begins
    const on = T > SYSTEM_T.drag[0] && T < SYSTEM_T.drag[1] && !f.reduce;
    this.dragLive = on;
    if (!on) this.drag.release();
    const w = Math.max(1, window.innerWidth);
    if (this.drag.dragging && on) {
      this.yawV = damp(this.yawV, (this.drag.v / w) * 2.2, 10, dt);
      this.drag.v *= Math.exp(-dt * 6);
    } else this.yawV = damp(this.yawV, 0, 1.4, dt);
    this.yaw += this.yawV * dt * f.motion;
    if (!on) this.yaw = damp(this.yaw, 0, 2.5, dt);
    f.rig.yaw = this.yaw * (1 - ss(SYSTEM_T.yawOut[0], SYSTEM_T.yawOut[1], T));
  }

  /**
   * Fig. 5: the alignment, 0 (messy) .. 1 (clean rings). Untouched it follows SYSTEM_T.settle; the visitor's hold in
   * SYSTEM_T.pull adds its own share (recorded: scrolling back inside fig. 5 keeps it, back into fig. 4 forgets it).
   */
  private alignment(f: FrameCtx) {
    const { T, dt } = f;
    const [p0, p1] = SYSTEM_T.pull;
    if (T < F.alignment - 0.02) {
      this.pull = 0;
      this.byVisitor = false;
    }
    const holding = hold.pressing && T >= p0 && T <= p1 && !f.reduce;
    if (holding) this.pull = Math.min(1, this.pull + dt / PULL_S);
    this.press = f.snapping
      ? holding
        ? 1
        : 0
      : damp(this.press, holding ? 1 : 0, holding ? 3.2 : 1.5, dt);
    const nat = ss(SYSTEM_T.settle[0], SYSTEM_T.settle[1], T);
    const u = 1 - this.pull;
    const P = 1 - u * u;
    const A = 1 - (1 - nat) * (1 - P * ss(p0 - 0.1, p0, T));
    this.aligned = A;
    if (A >= 0.999 && !this.done) {
      this.done = true;
      this.byVisitor = this.pull >= 0.5;
    } else if (A < 0.98) this.done = false;
    const play = shared.play;
    play.pull = this.pull;
    play.aligned = A;
    play.alignedByVisitor = this.done && this.byVisitor;
    // the hold, felt: the sun swells and brightens a touch, the belt tightens
    f.cosmos.sunBoost = this.press;
    f.U.uPull.value = this.press;
  }

  /** The planets this frame (the world at rest at journey PLANET from HANDOFF.WORLD_FROM) and their orbits' lanes. */
  private place(f: FrameCtx) {
    const co = f.cosmos;
    const o = this.orbits;
    o.update(f.T, this.aligned);
    if (f.T >= HANDOFF.WORLD_FROM) o.pos[WORLD].copy(this.planetC);
    co.place(o);
    const pv = f.U.uPlanet.value as Vector4[];
    const gv = f.G.uPlanet.value as Vector4[];
    const ou = f.U.uOrb.value as Vector4[];
    const og = f.G.uOrb.value as Vector4[];
    for (let k = 0; k < PLANETS.length; k++) {
      pv[k].copy(co.planetV[k]);
      gv[k].copy(co.planetV[k]);
      // the lane: (a (1 - e²), e cos ϖ, e sin ϖ, a), see glsl/system.ts ORBITS
      const a = o.el[k * 5];
      const e = o.el[k * 5 + 1];
      const w = o.el[k * 5 + 2];
      ou[k].set(a * (1 - e * e), e * Math.cos(w), e * Math.sin(w), a);
      og[k].copy(ou[k]);
    }
  }

  /** The bright bodies this frame for the rig's framing (./system-times.ts BODIES). */
  private bodies(f: FrameCtx) {
    const co = f.cosmos;
    const v = BODIES.v;
    v[0] = SUN[0];
    v[1] = SUN[1];
    v[2] = SUN[2];
    v[3] = SUN_R * co.sunScale * 1.5;
    v[4] = co.sunVis;
    for (let k = 0; k < PLANETS.length; k++) {
      const p = co.planetV[k];
      const o = (k + 1) * 5;
      v[o] = p.x;
      v[o + 1] = p.y;
      v[o + 2] = p.z;
      v[o + 3] = PLANETS[k].r * (k === 3 ? 2.1 : 1.05);
      v[o + 4] = co.planetFade * (k === WORLD ? co.worldFade : co.othersFade);
    }
  }

  /**
   * Fig. 7: a click in the countdown (a tap, not a hold) launches your point then, and fires its burn (KICK); a click
   * just after the default launch (SYSTEM_T.launchClick: the visitor clicked as the ring asked, still scrolling) is
   * the default launch, fired by them, its burn from where the point already is. Scrolling back before the countdown
   * gives the launch back (the default plan).
   */
  private launch(f: FrameCtx) {
    const T = f.T;
    const [c0] = SYSTEM_T.countdown;
    if (T < c0 - 0.02 && FLIGHT.clickT >= 0) {
      setLaunch(-1);
      this.kickAt = -1;
    }
    if (hold.tapAt !== this.lastTap) {
      this.lastTap = hold.tapAt;
      const [k0, k1] = SYSTEM_T.launchClick;
      if (T >= k0 && T < k1 && FLIGHT.clickT < 0 && !f.reduce) {
        this.kickFrom = T > L_DEF ? Math.max(0, FLIGHT.plan.sAt(T)) : 0;
        setLaunch(Math.min(T, L_DEF));
        this.kickAt = f.now;
        wake(KICK_S * 1000 + 400);
      }
    }
  }

  /**
   * Your point's arc length on the flight this frame: the scroll's (`sT`), carried ahead by the burn of a visitor's
   * launch (show time, eased out over KICK_S) until the scroll overtakes it; before the launch the burn is taken back
   * over KICK_BACK, so scrolling either way never jumps.
   */
  private flown(pl: Plan, T: number, sT: number, now: number) {
    if (this.kickAt < 0 || FLIGHT.clickT < 0) return sT;
    const x = Math.min(1, (now - this.kickAt) / (KICK_S * 1000));
    const k = (this.kickFrom + KICK * (1 - (1 - x) ** 3)) * ss(pl.L - KICK_BACK, pl.L, T);
    return sT + Math.max(0, k - Math.max(0, sT));
  }

  frame(f: FrameCtx) {
    const T = f.T;
    const co = f.cosmos;
    const o = this.orbits;
    // riding close past the sun the camera stops down a little (it never does anywhere else: it is never that close)
    co.sunExposure = 0.72 + 0.28 * ss(26, 80, f.camera.position.distanceTo(this.sunP));
    // ink: each planet while it is present, and its orbit (the real ellipse, closed) with it
    for (let k = 0; k < PLANETS.length; k++) {
      const on = co.planetFade * (k === WORLD ? co.worldFade : co.othersFade);
      if (on <= 0.002) continue;
      const p = o.pos[k];
      setAnchor(PLANET_IDS[k], p.x, p.y, p.z, PLANETS[k].r, on);
      const op = this.orbitPaths[k];
      const w = op.world;
      for (let i = 0; i < ORBIT_PTS; i++) {
        o.at(k, (i / (ORBIT_PTS - 1)) * TAU, this.v1);
        w[i * 3] = this.v1.x;
        w[i * 3 + 1] = this.v1.y;
        w[i * 3 + 2] = this.v1.z;
      }
      op.n = ORBIT_PTS;
      touchPath(op, on);
    }
    // the world: the core show's sphere until the hand-off, then the world module's (it sits at journey PLANET)
    const wOn = Math.max(co.planetFade * co.worldFade, worldPresence(T));
    if (wOn > 0.002) {
      const w = o.pos[WORLD];
      setAnchor(ANCHOR.world, w.x, w.y, w.z, PLANET.radius, wOn);
    }
    this.flight(f);
  }

  /**
   * Your point from fig. 4 to fig. 8: on its close orbit around the sun (sliding onto its launch mark in fig. 6), then
   * the flight (./probe.ts), then at the hub from HANDOFF.ARRIVE, fading into the first city. The plan and the trail
   * for the ink from fig. 6; the ribbon and the ripples in GL; what the ink measures.
   */
  private flight(f: FrameCtx) {
    const T = f.T;
    const play = shared.play;
    const pl = FLIGHT.plan;
    this.trail.setView(f.width, f.height, f.dpr);
    if (T < F.gathering || T >= SYSTEM_T.hub[1] + 0.3) {
      this.trail.frame(pl, 0, 0, T, f.proj, f.dpr, 1, this.centre, f.worldPx);
      if (T < F.assist) this.idle(play);
      return;
    }
    // the show-time drift on the close orbit runs until the slide, then holds while the slide takes it away; coming
    // back before the slide it runs on from where it was held (a phase offset, shared with genesis's close orbit so
    // its hand-over at F.gathering never pops either: ./thread.ts CLOSE)
    if (slideOn(T)) this.held = true;
    else {
      if (this.held) CLOSE.off = wrapPi(this.drift - POINT_DRIFT * f.time);
      this.held = false;
      this.drift = wrapPi(POINT_DRIFT * f.time + CLOSE.off);
    }
    const p = this.v1;
    const sT = pl.sAt(T);
    const s = this.flown(pl, T, sT, f.now);
    const flying = T >= pl.L || s !== sT;
    if (T >= HANDOFF.ARRIVE)
      p.set(this.planetC.x, this.planetC.y, this.planetC.z).addScaledVector(HUB_DIR, PLANET.radius);
    else if (flying) pl.at(s, p);
    else closeOrbitAt(pointAngle(T, this.drift), p);
    if (T < SYSTEM_T.hub[1])
      setAnchor(ANCHOR.yours, p.x, p.y, p.z, 0, 1 - ss(SYSTEM_T.hub[0], SYSTEM_T.hub[1], T));

    // the plan, for the ink (figs 6-7)
    if (T >= F.window && T < HANDOFF.ARRIVE + 0.05) {
      const ap = this.assistPath;
      const S = pl.assistS;
      for (let i = 0; i < S.length; i++) {
        pl.at(S[i], this.v2);
        ap.world[i * 3] = this.v2.x;
        ap.world[i * 3 + 1] = this.v2.y;
        ap.world[i * 3 + 2] = this.v2.z;
      }
      ap.n = S.length;
      touchPath(ap, 1 - ss(HANDOFF.ARRIVE - 0.08, HANDOFF.ARRIVE + 0.05, T));
    }

    // the flight: the probe, the trail it has flown (fixed points, growing from its head), what the ink measures
    if (flying) {
      const on = 1 - ss(HANDOFF.ARRIVE + 0.02, HANDOFF.ARRIVE + 0.2, T);
      if (T < HANDOFF.ARRIVE + 0.1) {
        setAnchor(ANCHOR.probe, p.x, p.y, p.z, 0, on);
        const tp = this.trailPath;
        const S = pl.trailS;
        let n = 0;
        const head = Math.min(s, pl.total);
        while (n < S.length - 1 && S[n] < head) {
          pl.at(S[n], this.v2);
          tp.world[n * 3] = this.v2.x;
          tp.world[n * 3 + 1] = this.v2.y;
          tp.world[n * 3 + 2] = this.v2.z;
          n++;
        }
        tp.world[n * 3] = p.x;
        tp.world[n * 3 + 1] = p.y;
        tp.world[n * 3 + 2] = p.z;
        tp.n = n + 1;
        touchPath(tp, on);
      }
      play.launchT = pl.L;
      play.launchByVisitor = FLIGHT.clickT >= 0;
      play.launchTiming =
        FLIGHT.clickT >= 0
          ? 1 - Math.min(1, Math.abs(L_DEF - FLIGHT.clickT) / (L_DEF - SYSTEM_T.countdown[0]))
          : 1;
      play.speed = pl.km(Math.min(s, pl.total));
      play.flybys = pl.flybys(s);
      this.trail.frame(
        pl,
        Math.min(s, pl.total + 0.01),
        on,
        T,
        f.proj,
        f.dpr,
        f.U.uDim.value as number,
        this.centre,
        f.worldPx,
      );
    } else {
      this.idle(play);
      this.trail.frame(pl, 0, 0, T, f.proj, f.dpr, 1, this.centre, f.worldPx);
    }
  }

  /** Before the launch: nothing flown yet. */
  private idle(play: typeof shared.play) {
    play.launchT = -1;
    play.launchByVisitor = false;
    play.launchTiming = 0;
    play.speed = 0;
    play.flybys = 0;
  }

  /** Flyby k's planet, where it is now (the ripples swell out from it). */
  private centre = (k: number) => this.orbits.pos[ORDER[k]];

  dispose() {
    this.drag.dispose();
    this.trail.dispose();
  }
}
