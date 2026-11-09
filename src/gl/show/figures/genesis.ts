/**
 * Genesis (docs/STORY.md figs 1-3): the hold, the crush and the bang; the core glow, the capped flash and the ember
 * shock ring; the cursor's pull on the sky before the bang, then (fig. 2 only) its stir and eddies through the nebula;
 * the gas and its young stars; fig. 2's hundred clumps (the versions); fig. 3's three knots, the visitor's choice and
 * the fall of everything into the chosen one; the collapse into the disk and the sun's ignition there (its flash, its
 * shock of first light, the cavity it clears), lit by journey HANDOFF.IGNITE. The disk's glow lingers faintly until the
 * camera dives to the world, and the sun shrinks to a star as the system becomes one (fig. 11).
 *
 * Fig. 3, the center (journey BEATS.center): three knots kindle in the nebula, dense cores each holding gas, dust and
 * motes by its mass (KNOTS: 0 the loud one, bright, light and flickering; 1 the heaviest, bigger, denser and steadier;
 * 2 between). A click in the choose window picks the knot nearest to it on screen (hovering lifts it); untouched, the
 * heaviest chooses itself as the window closes; the choice stays for the visit (shared.play.center, centerByVisitor).
 * Over the fall the other knots spiral into the chosen one, their outskirts trailing, and the whole field slides so
 * the chosen knot reaches the constant SUN, where the cloud collapses into the disk and the sun ignites; holding speeds
 * it all (the boost). The camera frames the three, then follows the chosen one in (poses/genesis.ts FOCUS). Everything
 * is a function of story time plus the choice and the boost, so scrolling back unwinds it.
 *
 * `pre` runs before the camera: it decides the bang (writes the frame's freed / live / bangAge / settle, and bangNow
 * / bangP on the frame it fires), reads the choice, drives the fall, the collapse and the ignition, places the knots
 * and writes the camera's FOCUS and the ignition kick. `frame` runs after it: the bang's springs and heat, the hold's
 * uniforms and lens, the core sprites, the knots' sprites, the stir. Writes anchor `center` while the sun is lit,
 * knot0..2 while the knots are there, clump0..3 in fig. 2, and the thread (anchor `yours`) before fig. 4
 * (./thread.ts): the hold point, the bang point, carried by the nebula, then its fall into the close orbit. No
 * allocations per frame.
 */
import { Vector3, type Vector4 } from "three";
import { shared } from "@/gl/shared";
import { ANCHOR, type Anchor, anchor, setAnchor } from "@/lib/anchors";
import { gateAnswer } from "@/lib/gate";
import { hold } from "@/lib/hold";
import { BEATS, F, HANDOFF, HOLDS } from "@/lib/journey";
import { clamp01 } from "@/lib/math";
import { CLICK_BANG } from "@/lib/show";
import { story } from "@/lib/story";
import { CAVITY_R, OBSERVER, SUN, SUN_R } from "../constants";
import { genesisPoint, inView, YOUNG } from "../cosmos";
import { damp, type Figure, type FrameCtx, ss, type Win } from "../frame";
import { FOCUS } from "../poses/genesis";
import { SYSTEM_T } from "./system";
import { closeOrbit, threadK } from "./thread";

/** Story times genesis owns. */
const GENESIS_T = {
  /** Only a bang before this plays out (the blast, the flash); later it just frees the sky. */
  bangBefore: F.versions,
  /** Scrolling through here fast-forwards the blast (it is over by fig. 3 however soon the visitor gets there). */
  blastOut: [F.versions, F.center] as Win,
  /**
   * Fig. 2's stir (journey BEATS.versions.stir, the "drag" hint inside it): the visitor's hand moves the gas and the
   * dust once the nebula has cooled, and lets go before fig. 3's knots kindle (GENESIS_T.knots): nothing in figs 3-12
   * moves with the pointer.
   */
  stir: [
    F.versions + BEATS.versions.stir[0] - 0.1,
    F.versions + BEATS.versions.stir[0] + 0.04,
  ] as Win,
  stirOut: [
    F.versions + BEATS.versions.stir[1] - 0.08,
    F.versions + BEATS.versions.stir[1] + 0.01,
  ] as Win,
  /** Fig. 2's version tags have their clumps (anchors clump0..3) over this. */
  clumps: [F.versions - 0.1, F.center + 0.05] as Win,
  /** Fig. 3: the knots kindle (BEATS.center.knots), the visitor may choose (choose), everything falls in (fall). */
  knots: [F.center - 0.05, F.center + BEATS.center.knots[1]] as Win,
  choose: [F.center + BEATS.center.choose[0], F.center + BEATS.center.choose[1]] as Win,
  /** ...and gather the dust around them, the heaviest from farthest (while the visitor looks them over). */
  gather: [F.center - 0.08, F.center + 0.3] as Win,
  fall: [F.center + BEATS.center.fall[0], F.center + BEATS.center.fall[1]] as Win,
  /** The collapse into the disk, after the choice: gathered (and the sun lit) by HANDOFF.IGNITE. */
  collapse: [F.center + BEATS.center.fall[0] + 0.08, HANDOFF.IGNITE] as Win,
  /** Holding here (once a knot is chosen) speeds the fall and the collapse, and it stays gathered. */
  hold: HOLDS.center,
  /** The rig's push in as the sun lights eases back over this. */
  kickOut: [HANDOFF.IGNITE + 0.02, F.gathering + 0.16] as Win,
  /** The arms wind on into rings and the planets sweep their gaps (journey BEATS.gathering.wind). */
  wind: [F.center + BEATS.center.ignite[0], F.gathering + BEATS.gathering.wind[1]] as Win,
  gap: [HANDOFF.IGNITE, F.gathering + BEATS.gathering.wind[1] + 0.02] as Win,
  /** The deep-space stars step back while the sun ignites, and come back as the system settles. */
  starsBack: [F.center + 0.6, HANDOFF.IGNITE] as Win,
  starsIn: [F.gathering + 0.36, F.alignment] as Win,
  /** Most of the gas goes into the planets; a faint zodiacal glow lingers until the camera dives to the world. */
  gasOut: [F.gathering + 0.18, F.gathering + 0.91] as Win,
  glowOut: [SYSTEM_T.dive[0], SYSTEM_T.dive[0] + 0.17] as Win,
  /** Behind the world (figs 8-10) the corona thins to a rim of light around its limb. */
  rim: [HANDOFF.ARRIVE - 0.2, HANDOFF.ARRIVE + 0.1] as Win,
  /** The sun shrinks to a point as the camera pulls away and the whole system becomes one star (fig. 11). */
  sunOut: [F.again + 0.25, HANDOFF.SYSTEM_STAR] as Win,
  /**
   * The camera's blend from the sky to the nebula is done by fig. 2 however fast the visitor scrolls (the blast's
   * own settle is in show time; this one is in story time, so the eye glides instead of cutting at F.versions).
   */
  settleBy: [F.point + 0.55, F.versions] as Win,
  /** The young star that does not become a knot steps back as the knots kindle out of the other three. */
  youngOut: [F.versions + 0.7, F.center + 0.1] as Win,
  /**
   * The shock of first light runs out through the disk in show time once the sun ignites (SHOCK_S), and whatever is
   * left of it is gone by here, before fig. 4's line has written in.
   */
  shockBy: [F.gathering - 0.03, F.gathering + 0.05] as Win,
  /** Your point drifts through the nebula to its place above the knots (fig. 2, while the versions are tagged). */
  home: [F.versions + 0.15, F.center - 0.05] as Win,
  /** Your point falls in with the rest and settles on its close orbit around the new sun by HANDOFF.IGNITE. */
  settle: [F.center + BEATS.center.fall[0] + 0.06, HANDOFF.IGNITE] as Win,
};

/* ---- fig. 3's knots and fig. 2's clumps (glsl/genesis.ts writes them into the shaders) ---- */

export type KnotDef = {
  /**
   * Rest offset from the sun (laid out in the view of fig. 3's camera: az 24°, el 22°): the young star of fig. 2 it
   * kindles out of (cosmos.ts YOUNG 0..2).
   */
  at: [number, number, number];
  /** The envelope: the radius of the gas, the dust and the motes gathered round it (world units). */
  env: number;
  /** Its visual radius (the ink's circle, anchor knot<i>). */
  r: number;
  /** Dust and glowing gas gathered in the envelope (the gas's density), and the share of the motes it holds. */
  dust: number;
  glow: number;
  share: number;
  /**
   * The dust it already holds turns round it: the disk's normal (in fig. 3's view), how flat (0 a ball, 1 a disk) and
   * how fast (rad per second at the envelope; faster inside, as an orbit is).
   */
  axis: [number, number, number];
  flat: number;
  spin: number;
  /** The colour of its light, how brightly it lights the gas and the dust round it, its own motes' brightness, its sprite. */
  col: [number, number, number];
  /** How far it gathers the dust around it as it kindles, in envelopes (the heavier, the farther). */
  sweep: number;
  /** How far its light reaches into the gas, in envelopes (an embedded core lights only its own heart). */
  reach: number;
  moteB: number;
  light: number;
  moteLight: number;
  spike: number;
  core: number;
  halo: number;
  /** How white-hot its core burns, and how bright its sprite is. */
  white: number;
  glowI: number;
  px: number;
};

const youngAt = (i: number): [number, number, number] => [YOUNG[i][0], YOUNG[i][1], YOUNG[i][2]];

/**
 * The three knots (ink KNOTS: 0 loud, 1 heavy, 2 between; masses m 0.6 / 2.4 / 1.1). Mass is what they gather (gas,
 * dust, motes); brightness says the opposite for the loud one: a hot blue-white point with spikes and little around
 * it, where the heaviest is a big, deep, steady amber glow in the thickest cocoon of dust.
 */
export const KNOTS: KnotDef[] = [
  {
    at: youngAt(0),
    axis: inView(24, 22, 0, 1, 0),
    flat: 0,
    spin: 0,
    sweep: 1.3,
    reach: 3.2,
    env: 4.2,
    r: 2.2,
    dust: 0.32,
    glow: 0.85,
    share: 0.007,
    col: [0.74, 0.86, 1.0],
    moteB: 3.0,
    light: 2.1,
    moteLight: 1.6,
    spike: 1,
    core: 0.045,
    halo: 0.11,
    white: 0.95,
    glowI: 1.25,
    px: 96,
  },
  {
    at: youngAt(1),
    axis: inView(24, 22, 0.16, 0.96, 0.24),
    flat: 0.92,
    spin: 0.16,
    sweep: 2.1,
    reach: 1.15,
    env: 9.5,
    r: 5.8,
    dust: 2.4,
    glow: 0.3,
    share: 0.045,
    col: [1.0, 0.52, 0.2],
    moteB: 2.6,
    light: 0.75,
    moteLight: 0.9,
    spike: 0,
    core: 0.15,
    halo: 0.2,
    white: 0.3,
    glowI: 0.7,
    px: 170,
  },
  {
    at: youngAt(2),
    axis: inView(24, 22, -0.26, 0.9, 0.35),
    flat: 0.75,
    spin: 0.12,
    sweep: 1.8,
    reach: 2.0,
    env: 6.2,
    r: 3.5,
    dust: 0.8,
    glow: 0.45,
    share: 0.016,
    col: [1.0, 0.78, 0.48],
    moteB: 2.6,
    light: 1.15,
    moteLight: 1.0,
    spike: 0.28,
    core: 0.085,
    halo: 0.15,
    white: 0.6,
    glowI: 0.85,
    px: 118,
  },
];
const HEAVY = 1;

/**
 * Fig. 2's hundred clumps, "a hundred versions": a share of the motes gathered into small balls through the cloud.
 * The first four (laid out in the view of fig. 2's camera, az 10°, el 16°) are the ones the ink tags, anchors
 * clump0..3; `tagged` is their share of the clumps' motes.
 */
export const CLUMPS = {
  n: 100,
  share: 0.1,
  tagged: 0.09,
  r: 3.2,
  at: [
    inView(10, 16, -36, -3, 8),
    inView(10, 16, 28, 17, -10),
    inView(10, 16, 38, -7, 2),
    inView(10, 16, -17, -12, 14),
  ],
};
/** A knot or a clump drifts as one, this far (world units; stilled as the disk forms). */
export const GROUP_DRIFT = 2.8;

/** The point the visitor's hold sits on: this far along the pointer's ray from the eye under the sky. */
const HOLD_DIST = 46;
/**
 * Your point's place in the nebula's rest space: first this far from the sun toward where it was made (the bang drives
 * the cloud out from the bang point, and the point rides it in to there, in view of figs 1-2), then (GENESIS_T.home)
 * its place above the knots in the view of fig. 3, clear of all three and of the lines of copy; and how far it drifts
 * with the nebula's slow currents in fig. 2 (world units; stilled as the disk forms).
 */
const HOME_R = 30;
const HOME = inView(24, 22, 12, 18, 4);
const DRIFT = 2.4;

const CRUSH_MS = 700;
/** How much of the bang's flash, core swell and shock ring a gentle one keeps (hold.gentle: the scroll let it go). */
const GENTLE = 0.35;
/**
 * The breath of a hold that answers a scroll attempt at the first screen's closed gate (src/lib/gate.ts), as hold.k at
 * the answer's full strength: the near sky leans into the point and the core glows a little, then lets go.
 */
const KNOCK_BREATH = 0.13;
/** The shock of first light: how long it runs (s), how far it reaches into the disk (world units from the sun). */
const SHOCK_S = 0.9;
const SHOCK_R = 56;
/**
 * Fig. 2: when the ink writes each tagged clump's version (content/ink.ts, versions: v.2 at k 0.14, then every 0.08),
 * the clump buds: it brightens as its tag writes and keeps a little of it.
 */
const BUD_AT = [0.14, 0.22, 0.3, 0.38].map((k) => F.versions + k);
/** How long a real bang plays out (s): the blast, its heat, the cloud gathering it in. */
const BLAST_S = 12;
/** The ignition flash never repeats inside this many ms (WCAG 2.3.1: far under three flashes a second). */
const FLASH_GAP_MS = 2500;
/**
 * Fig. 2's stir (see stir()). The hand sits on the pointer's ray this share of the way to the sun's nearest point on
 * it (where the gas the eye sees lies: the march's mean light depth runs at 0.8-0.95 of it), reaching STIR_R of its
 * depth across the ray and STIR_DEEP reaches along it. The stroke carries the gas STIR_LAG seconds of the pointer's
 * motion, softly bounded to STIR_HOVER (a hover) or STIR_DRAG (a drag) reaches, and parts it by STIR_PART of that
 * (bounded so the map never folds: its stretch stays well under 1).
 */
const STIR_DEPTH = 0.88;
const STIR_R = 0.15;
const STIR_DEEP = 2.2;
const STIR_LAG = 0.12;
const STIR_HOVER = 0.2;
const STIR_DRAG = 0.5;
const STIR_PART = 0.5;
/**
 * The pointer's speed is trusted up to this (CSS px/s); a move of more than this share of the short side in one frame
 * is an arrival, not a stroke.
 */
const STIR_VMAX = 4000;
const STIR_LEAP = 0.4;
/** How long a pointer that has just arrived (the window, a finger, a leap) is not yet a stroke (ms). */
const STIR_SETTLE_MS = 160;
/**
 * Leaving fig. 2 (GENESIS_T.stirOut, or back above GENESIS_T.stir) takes no new stroke, and what the hand left in the
 * gas lets go in show time at STIR_RELAX (per s), never at the scroll's pace (a capped scroll crosses that window in a
 * tenth of a second): only a long ramp of story time (STIR_WIDE up to fig. 2, then down to STIR_CUT, where fig. 3's
 * fall begins) bounds it, so even the fastest scroll lets the swirl go over half a second, and none of it reaches
 * the fall and the disk.
 */
const STIR_RELAX = 2.4;
const STIR_WIDE = F.point + 0.7;
const STIR_CUT = F.center + BEATS.center.fall[0];
/**
 * A drag's eddies, a pair either side of the stroke: from EDDY_PX of pointer speed (CSS px/s), full at EDDY_FULL; a pair
 * at most every EDDY_GAP ms and only into slots whose eddies are over (none is cut short); each lives EDDY_LIFE s
 * (a pair born while others still turn lives on until a third of a life after the last of them ends, up to
 * EDDY_LIFE_MAX, so a long drag's pairs end one at a time and its swirl stays up under the moving hand instead of
 * fading out all at once), winds up at EDDY_WIND per s, turns the gas at most EDDY_MAX rad, and eddies turning the
 * same way never add up past EDDY_CAP. Each reaches EDDY_DEEP of its radius along its axis (glsl/genesis.ts STIR).
 */
const VORTS = 6;
const EDDY_PX = 160;
const EDDY_FULL = 900;
const EDDY_GAP = 260;
const EDDY_LIFE = 3.4;
const EDDY_LIFE_MAX = 4.8;
const EDDY_WIND = 2.2;
const EDDY_MAX = 1.15;
const EDDY_CAP = 1.5;
export const EDDY_DEEP = 2.2;
/** The fall: how far the others lean toward the chosen knot when it is picked, the turn of their spiral in (rad). */
const LEAN = 0.06;
const SPIRAL = 1.4;
/** How far the cloud's own light steps back while the knots shine (fig. 3). */
const AMB_DIM = 0.45;
/**
 * Hovering lifts the knot a click would pick: its sprite's light and size swell by these shares (well clear of the loud
 * one's own flicker, so the lift reads as an answer to the pointer, not as noise). The sprite only: the knot's light in
 * the gas and the dust never follows the pointer. The lit knot keeps the pointer until another is HOVER_KEEP CSS px
 * nearer (so the line between two never flickers), and a click picks the lit one.
 */
const HOVER_LIGHT = 0.6;
const HOVER_PX = 0.22;
const HOVER_KEEP = 28;
/** The lift is full within this many ink-circle radii of the knot and gone beyond the second. */
const HOVER_NEAR = [1.2, 3.5] as const;

const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const x = t - 1;
  return 1 + (c1 + 1) * x * x * x + c1 * x * x;
};
const TAU = Math.PI * 2;
const wrapPi = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);

/** A knot's or a clump's drift at show time t (glsl/genesis.ts groupDrift), added to out. */
function addGroupDrift(c: Vector3, t: number, k: number, out: Vector3) {
  out.x += Math.sin(t * 0.11 + c.x * 0.07 + 1.3) * GROUP_DRIFT * k;
  out.y += 0.6 * Math.sin(t * 0.083 + c.z * 0.07) * GROUP_DRIFT * k;
  out.z += Math.cos(t * 0.097 + c.y * 0.07) * GROUP_DRIFT * k;
  return out;
}

/** An eddy: its centre, axis and radius (world), the most it turns the gas (rad, signed), its birth (ms; -1 none). */
type Vort = { p: Vector3; ax: Vector3; r: number; a: number; born: number; life: number };

export class Genesis implements Figure {
  /** The bang's share of the night: 0 before it, rising to 1 as the blast clears into space (the engine's look). */
  space = 0;
  /** The gas has something to draw this frame (the engine raymarches it only then). */
  gasOn = false;

  // the bang
  private bangSeen = false;
  private bangLive = false;
  private impulse = false;
  private freedAt = -1;
  private freedAge = 0;
  private crushing = false;
  private bangP = new Vector3();
  private bangK = 0;
  private bangK0 = 0;
  /**
   * The flash, core swell and shock ring's share (1 for the hold's bang, CLICK_BANG.fx for the click's, GENTLE where a
   * scroll let it go), and the blast's (the motes' kick: CLICK_BANG.kick for the click's).
   */
  private bangFx = 1;
  private kickK = 1;
  private bangStart = -1;
  private crushAt = -1;
  /** The crush before a burst: how long it takes (ms) and how far it draws the sky in (a full hold's gather is 1). */
  private crushMs = CRUSH_MS;
  private crushTo = 1;
  /** The gate's answer to a scroll attempt (src/lib/gate.ts), eased: the dust leans in, the point breathes. */
  private knock = 0;
  private holdP = new Vector3();
  private holdInit = false;
  // the collapse and the ignition
  private expand = 1;
  private boost = 0;
  private spinC = 0;
  private igA = 0;
  private igPrev = 0;
  private ignitedAt = -1;
  private flashAt = -1e9;
  private cavK = 0;
  private bangOff = new Vector3();
  // fig. 3: the knots, the choice, the fall
  private choice = -1;
  private byVisitor = false;
  private lastTap = -1;
  private chosenAt = -1e9;
  private lean = 0;
  private kn = 0;
  /** The fall's progress 0..1 (scroll, sped by holding), the field's slide, each knot's fall into the chosen one. */
  private u = 0;
  private slide = 0;
  private sIn = [0, 0, 0];
  private hover = [0, 0, 0];
  private knotOn = [0, 0, 0];
  private knotI = [0, 0, 0];
  private flick = [1, 1, 1];
  private knotK = KNOTS.map((k) => new Vector3(...k.at));
  private knotW = KNOTS.map(() => new Vector3());
  private knotD = KNOTS.map(() => new Vector3());
  private knotL = KNOTS.map(() => new Vector3());
  private leanV = KNOTS.map(() => new Vector3());
  private knotA: Anchor[] = KNOTS.map((_, i) => anchor(ANCHOR.knot(i)));
  private knotIds = KNOTS.map((_, i) => ANCHOR.knot(i));
  private fallOff = new Vector3();
  private clumpQ = CLUMPS.at.map((p) => new Vector3(...p));
  // your point's fall into the close orbit: the angle between the two, followed frame to frame
  private threadDa = 0;
  private threadSeen = false;
  private clumpIds = CLUMPS.at.map((_, i) => ANCHOR.clump(i));
  // fig. 2's stir: the hand (on the pointer's ray, in the gas), its stroke (world), how present it is and how much a
  // drag, whether the pointer was there last frame and where, until when it is still arriving, the eddies
  private stirP = new Vector3();
  private stirD = new Vector3();
  private stirEng = 0;
  private stirDrag = 0;
  private stirIn = false;
  private stirX = 0;
  private stirY = 0;
  private stirQuiet = 0;
  /** How much of the stir is on (fig. 2's window, let go in show time: STIR_RELAX). */
  private stirOn = 0;
  private vorts: Vort[] = [];
  private lastVort = 0;
  private hovered = -1;
  // scratch
  private v1 = new Vector3();
  private v2 = new Vector3();
  private v3 = new Vector3();
  private v4 = new Vector3();
  private v5 = new Vector3();
  private v6 = new Vector3();
  private sunV = new Vector3(...SUN);
  private yq = YOUNG.map(([x, y, z]) => new Vector3(x, y, z));

  constructor() {
    for (let i = 0; i < VORTS; i++)
      this.vorts.push({
        p: new Vector3(),
        ax: new Vector3(0, 0, 1),
        r: 1,
        a: 0,
        born: -1,
        life: EDDY_LIFE,
      });
  }

  /**
   * Start over (src/lib/restart.ts): the sky not yet freed and the bang not happened (hold.bangAt is -1 again), the
   * hold point straight ahead again, no knot chosen, no collapse, no sun, no stir: fig. 1 as on arrival.
   */
  reset() {
    this.space = 0;
    this.gasOn = false;
    this.bangSeen = false;
    this.bangLive = false;
    this.impulse = false;
    this.freedAt = -1;
    this.freedAge = 0;
    this.crushing = false;
    this.bangK = 0;
    this.bangK0 = 0;
    this.bangStart = -1;
    this.crushAt = -1;
    this.crushMs = CRUSH_MS;
    this.crushTo = 1;
    this.bangFx = 1;
    this.kickK = 1;
    this.knock = 0;
    this.holdInit = false;
    this.expand = 1;
    this.boost = 0;
    this.spinC = 0;
    this.igA = 0;
    this.igPrev = 0;
    this.ignitedAt = -1;
    this.flashAt = -1e9;
    this.cavK = 0;
    this.bangOff.set(0, 0, 0);
    this.choice = -1;
    this.byVisitor = false;
    this.lastTap = hold.tapAt;
    this.chosenAt = -1e9;
    this.lean = 0;
    this.kn = 0;
    this.u = 0;
    this.slide = 0;
    this.hovered = -1;
    for (let i = 0; i < KNOTS.length; i++) {
      this.sIn[i] = 0;
      this.hover[i] = 0;
      this.knotOn[i] = 0;
      this.knotI[i] = 0;
      this.flick[i] = 1;
      this.leanV[i].set(0, 0, 0);
    }
    this.fallOff.set(0, 0, 0);
    this.threadDa = 0;
    this.threadSeen = false;
    this.stirEng = 0;
    this.stirDrag = 0;
    this.stirIn = false;
    this.stirQuiet = 0;
    this.stirOn = 0;
    this.lastVort = 0;
    for (const v of this.vorts) {
      v.a = 0;
      v.born = -1;
      v.life = EDDY_LIFE;
    }
  }

  pre(f: FrameCtx) {
    const { T, now } = f;
    // until the visitor holds, the point is the one straight ahead of the first view (a deep link bangs there)
    if (!this.holdInit) {
      this.holdP
        .copy(f.rig.skyLook)
        .multiplyScalar(HOLD_DIST)
        .add(this.v1.set(...OBSERVER));
      this.holdInit = true;
    }
    // the bang (plays once per visit; only a bang in fig. 1 flashes). A short hold, ?bang=1, the visitor's click (the
    // first screen's gate: hold.click, a quicker crush to most of a hold's gather, then a smaller burst: CLICK_BANG) or
    // a scroll on past fig. 1's first beat where the gate is never closed (hold.gentle: its flash and ring are soft)
    // crush the sky first, so the release always reads as cause and effect. A quiet one (hold.quiet: the visitor
    // arrived past it, a reload or a deep link) only frees the sky.
    f.bangNow = false;
    if (!this.bangSeen && hold.bangAt >= 0) {
      this.bangSeen = true;
      // (one let go in the printed journal is not played when motion comes back: the sky is simply free, as on arrival)
      this.bangLive = T < GENESIS_T.bangBefore && !f.reduce && !hold.quiet && !hold.printed;
      // (on a touch screen the tap is the invitation, so it gives the whole bang: only a mouse's click is the smaller one)
      const small = hold.click && hold.pointerType !== "touch";
      this.bangFx = hold.gentle ? GENTLE : small ? CLICK_BANG.fx : 1;
      this.kickK = small ? CLICK_BANG.kick : 1;
      this.crushMs = hold.click ? CLICK_BANG.crushMs : CRUSH_MS;
      this.crushTo = hold.click ? CLICK_BANG.k : 1;
      // (a breath the gate's answer left in the point carries into the crush, so it never steps back first)
      this.bangK0 = Math.max(hold.k, this.breath());
      // a click's press and release can fall between two frames (a tap): the point is where it was made, not where
      // the pointer was on the last frame
      if (hold.click) {
        const cam = f.camera;
        this.v2.set(hold.bx, hold.by, 0.5).unproject(cam).sub(cam.position).normalize();
        this.holdP.copy(cam.position).addScaledVector(this.v2, HOLD_DIST);
      }
      this.bangP.copy(this.holdP);
      if (this.bangLive && this.bangK0 < 0.7) this.crushAt = now;
      else if (this.bangLive) this.explode(now, Math.max(0.5, hold.k));
      f.bangNow = true;
      f.bangP.copy(this.bangP);
    }
    if (this.crushAt >= 0 && now - this.crushAt >= this.crushMs) {
      this.crushAt = -1;
      this.explode(now, this.crushTo);
    }
    this.crushing = this.crushAt >= 0;
    // (the sky lets go only with the bang, which src/lib/hold.ts decides: the hold, the scroll on past freeT() where the
    // visitor sees it, or an arrival; never ahead of it, so a release held back under a far-move cut frees nothing)
    const freed = !this.crushing && this.bangSeen;
    if (freed && this.freedAt < 0) this.freedAt = now;
    if (!freed) this.freedAt = -1;
    const age = this.bangLive && this.bangStart >= 0 ? (now - this.bangStart) / 1000 : 1e3;
    this.freedAge = this.freedAt >= 0 ? (now - this.freedAt) / 1000 : 0;
    const live = this.bangLive && age < BLAST_S;
    // the blast belongs to figs 1-2: scrolling on fast-forwards it, so a jump ahead lands with it already cleared
    const bangAge = live
      ? Math.max(age, BLAST_S * ss(GENESIS_T.blastOut[0], GENESIS_T.blastOut[1], T))
      : age;
    f.freed = freed;
    f.live = live;
    f.bangAge = bangAge;
    const settleT = ss(GENESIS_T.settleBy[0], GENESIS_T.settleBy[1], T);
    f.settle = Math.max(
      live ? ss(0.4, 4.2, bangAge) : freed ? ss(0, 1.6, this.freedAge) : 0,
      freed ? settleT : 0,
    );

    this.choose(f);
    this.fall(f);
    this.collapse(f);
    this.place(f);
  }

  /**
   * Fig. 3, the choice: a click (a tap, not a hold) anywhere on the stage inside the choose window picks the knot
   * nearest to it on screen, by the anchors the projector placed last frame, so the hint ring's "click" always has an
   * answer wherever the pointer happens to be; hovering lifts the knot a click there would pick (the pick, shown before
   * it is made). Untouched, the heaviest chooses itself as the window closes. A new click back inside the window
   * chooses again, until the fall has begun.
   */
  private choose(f: FrameCtx) {
    const { T, now } = f;
    const [c0, c1] = GENESIS_T.choose;
    this.kn = f.freed ? ss(GENESIS_T.knots[0], GENESIS_T.knots[1], T) : 0;
    const open = f.freed && T >= c0 && T < c1 && this.kn > 0.5 && this.u < 0.02;
    const W = f.width / f.dpr;
    const H = f.height / f.dpr;
    if (hold.tapAt !== this.lastTap) {
      this.lastTap = hold.tapAt;
      if (open) {
        // (the knot the hover lit, if one is: what the pointer showed is what the click picks)
        const i = this.nearest((hold.tx + 1) * 0.5 * W, (1 - hold.ty) * 0.5 * H, this.hovered);
        if (i >= 0) {
          if (i !== this.choice || !this.byVisitor) this.chosenAt = now;
          this.choice = i;
          this.byVisitor = true;
        }
      }
    }
    if (f.freed && T >= c1 && this.choice < 0) {
      this.choice = HEAVY;
      this.byVisitor = false;
      this.chosenAt = f.snapping ? -1e9 : now;
    }
    shared.play.center = this.choice;
    shared.play.centerByVisitor = this.byVisitor;
    // the knot a click would pick: the ink circles it in gold (a quiet preview wherever the pointer is), and the knot
    // itself lifts only as the pointer comes to it (its sprite: the cloud round it never changes with the pointer),
    // eased, so a window opening under a resting pointer lights nothing. The aimed knot keeps the pointer until another
    // is HOVER_KEEP px nearer, so the line between two never flickers (a mouse over the stage only: a finger has no
    // hover, a control takes its own clicks)
    const hi =
      open && f.presence && hold.pointerType !== "touch" && hold.inside && hold.overStage
        ? this.nearest(hold.x, hold.y, this.hovered)
        : -1;
    this.hovered = hi;
    shared.play.centerAim = hi;
    let near = 0;
    if (hi >= 0) {
      const a = this.knotA[hi];
      const r = Math.max(16, a.sr) + 9;
      near = 1 - ss(HOVER_NEAR[0] * r, HOVER_NEAR[1] * r, Math.hypot(a.sx - hold.x, a.sy - hold.y));
    }
    for (let i = 0; i < KNOTS.length; i++) {
      const to = i === hi ? near : 0;
      this.hover[i] = f.snapping ? to : damp(this.hover[i], to, 5, f.dt);
    }
  }

  /**
   * The knot nearest to (x, y) CSS px on screen (any distance: the stage is theirs to pick from), or -1; `keep` counts
   * HOVER_KEEP px nearer than it is (the hover's hysteresis).
   */
  private nearest(x: number, y: number, keep = -1) {
    let best = -1;
    let bd = Number.POSITIVE_INFINITY;
    for (let i = 0; i < KNOTS.length; i++) {
      const a = this.knotA[i];
      if (!a.live || !a.vis || a.on < 0.3) continue;
      const d = Math.hypot(a.sx - x, a.sy - y) - (i === keep ? HOVER_KEEP : 0);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * Fig. 3, the fall (a function of story time, the choice and the boost): the others lean toward the chosen knot when
   * it is picked, then spiral into it, accelerating, their outskirts trailing; the field slides so the chosen knot
   * comes to the sun's place. Writes uFallOff and the knots' displacements for the motes and the gas.
   */
  private fall(f: FrameCtx) {
    const { T, dt } = f;
    const c = this.choice;
    // holding (once there is a choice) speeds the fall and the collapse; it eases off above the figure
    const holdable = f.freed && c >= 0 && T > GENESIS_T.hold[0] && T < GENESIS_T.hold[1];
    if (holdable && hold.pressing) this.boost = Math.min(1, this.boost + dt * 0.42);
    else if (T < GENESIS_T.hold[0] - 0.05) this.boost = f.snapping ? 0 : damp(this.boost, 0, 3, dt);
    const uS = c >= 0 ? ss(GENESIS_T.fall[0], GENESIS_T.fall[1], T) : 0;
    this.u = c >= 0 ? 1 - (1 - uS) * (1 - this.boost) : 0;
    // (the lean belongs to fig. 3: above it, where the knots are not lit, it lets go)
    const leanTo = c >= 0 ? this.kn : 0;
    this.lean = f.snapping ? leanTo : damp(this.lean, leanTo, 2.2, dt);
    this.slide = ss(0, 0.85, this.u);
    const K = this.knotK;
    if (c >= 0) this.fallOff.copy(K[c]).multiplyScalar(this.slide);
    else this.fallOff.set(0, 0, 0);
    const x = clamp01((this.u - 0.02) / 0.9);
    const xl = clamp01((this.u - 0.16) / 0.9);
    const s = x ** 2.2;
    const sl = xl ** 2.2;
    for (let i = 0; i < KNOTS.length; i++) {
      const D = this.knotD[i];
      const L = this.knotL[i];
      const lv = this.leanV[i];
      // the lean: a small step toward the chosen one, eased (a new choice turns it without a jump)
      if (c >= 0 && i !== c) this.v1.subVectors(K[c], K[i]).multiplyScalar(LEAN * this.kn);
      else this.v1.set(0, 0, 0);
      if (f.snapping) lv.copy(this.v1);
      else lv.lerp(this.v1, 1 - Math.exp(-dt * 2.2));
      if (c < 0 || i === c) {
        this.sIn[i] = 0;
        D.copy(lv);
        L.copy(lv);
        continue;
      }
      this.sIn[i] = s;
      this.spiral(K[i], K[c], s, lv, D);
      this.spiral(K[i], K[c], sl, lv, L);
    }
    // the cloud's own light steps back while the knots shine, and returns as the disk gathers
    const amb = 1 - AMB_DIM * this.kn * (1 - ss(0.3, 0.9, this.u));
    // as they kindle the knots gather the dust around them (uKnot[1].w; glsl/genesis.ts genHome)
    const gather = f.freed ? ss(GENESIS_T.gather[0], GENESIS_T.gather[1], T) : 0;
    for (const u of f.uSets) {
      (u.uFallOff.value as Vector3).copy(this.fallOff);
      const kv = u.uKnot.value as Vector4[];
      for (let i = 0; i < KNOTS.length; i++) {
        kv[i].set(
          this.knotD[i].x,
          this.knotD[i].y,
          this.knotD[i].z,
          i === 0 ? amb : i === 1 ? gather : 0,
        );
        kv[3 + i].set(this.knotL[i].x, this.knotL[i].y, this.knotL[i].z, 0);
      }
    }
  }

  /** Knot k's displacement when it has fallen s (0..1) of the way into knot c along a closing spiral (rest space). */
  private spiral(k: Vector3, c: Vector3, s: number, lean: Vector3, out: Vector3) {
    const a = SPIRAL * s;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rx = (k.x - c.x + lean.x) * (1 - s);
    const ry = (k.y - c.y + lean.y) * (1 - s);
    const rz = (k.z - c.z + lean.z) * (1 - s);
    // prograde with the disk to come (the angle atan2(z, x) grows)
    out.set(c.x + rx * ca - rz * sa - k.x, c.y + ry - k.y, c.z + rx * sa + rz * ca - k.z);
    return out;
  }

  /** What the field's slide adds to a rest offset outside the knots (glsl/genesis.ts fallMap, minus q). */
  private fallShift(out: Vector3) {
    return out.copy(this.fallOff).negate();
  }

  /**
   * The collapse (scroll after the choice, sped up by holding), the sun's ignition (a one-off flash, capped; the shock
   * of first light; the cavity it clears), the spin clock of the disk, the gas's light and fade, the young stars, the
   * sun.
   */
  private collapse(f: FrameCtx) {
    const { T, dt, now, freed, live, bangAge, snapping } = f;
    const G = f.G;
    const co = f.cosmos;
    const freedAge = this.freedAge;

    // the collapse: scroll gathers the cloud into the chosen knot; holding gathers it faster (and it stays gathered)
    const cS = this.choice >= 0 ? ss(GENESIS_T.collapse[0], GENESIS_T.collapse[1], T) : 0;
    const c = freed ? 1 - (1 - cS) * (1 - this.boost) : 0;
    // the spin clock runs while there is a disk to spin (and resets with none, where its value cannot show)
    if (c > 0.01) this.spinC += dt * c * f.motion;
    else this.spinC = 0;
    // ignition: the moment the disk is gathered; eased in time, so even a jump lands with a sun that grows
    const ig = freed ? ss(0.94, 1.0, c) : 0;
    this.igA = snapping ? ig : damp(this.igA, ig, ig > this.igA ? 2.6 : 4, dt);
    if (this.igPrev < 0.5 && this.igA >= 0.5 && !snapping && !story.reducedMotion) {
      this.ignitedAt = now;
      if (now - this.flashAt > FLASH_GAP_MS) this.flashAt = now;
    }
    if (this.igA < 0.3) this.ignitedAt = -1;
    this.igPrev = this.igA;
    this.cavK = snapping ? ig : damp(this.cavK, ig, ig > this.cavK ? 1.2 : 3, dt);
    const igAge = this.ignitedAt >= 0 ? (now - this.ignitedAt) / 1000 : 1e3;

    // after the bang the cloud grows from the bang point into place as it cools
    const expand = live ? 0.1 + 0.9 * (1 - Math.exp(-bangAge * 0.9)) * ss(0, 0.4, bangAge) : 1;
    this.expand = expand;
    this.bangOff.subVectors(this.bangP, this.sunV);
    if (!this.bangSeen) this.bangOff.set(0, 0, 0);

    for (const u of f.uSets) {
      u.uCollapse.value = c;
      u.uSpinC.value = this.spinC;
      u.uCavity.value = CAVITY_R * (1 - (1 - this.cavK) ** 2);
      u.uIgnite.value = this.igA;
      u.uExpand.value = expand;
      (u.uBangOff.value as Vector3).copy(this.bangOff);
      // the arms wind on into rings and the planets sweep their gaps as the orbits settle
      u.uWindK.value = ss(GENESIS_T.wind[0], GENESIS_T.wind[1], T);
      u.uGap.value = ss(GENESIS_T.gap[0], GENESIS_T.gap[1], T);
    }

    // the gas: it condenses out of the blast, lights from within, then clears as the planets take it
    const gasIn = live ? ss(0.2, 3.2, bangAge) : freed ? ss(0, 1.4, freedAge) : 0;
    // most of the disk goes into the planets; a faint zodiacal glow lingers until the camera leaves for the world
    const gasOut =
      1 -
      0.86 * ss(GENESIS_T.gasOut[0], GENESIS_T.gasOut[1], T) -
      0.14 * ss(GENESIS_T.glowOut[0], GENESIS_T.glowOut[1], T);
    G.uGas.value = 0.0145 * gasIn * gasOut;
    G.uHeatG.value = live ? Math.exp(-bangAge * 0.8) * 0.8 : 0;
    G.uTime.value = f.time;
    this.gasOn = (G.uGas.value as number) > 0.0002 && T < GENESIS_T.glowOut[1] + 0.03;
    // the young stars light it from within until the knots kindle (fig. 3) and the sun takes over
    const lights = G.uLight.value as Vector4[];
    const kn = this.kn;
    for (let i = 0; i < YOUNG.length; i++) {
      const [x, y, z, I] = YOUNG[i];
      lights[i].set(x, y, z, I * (1 - 0.85 * this.igA) * (1 - 0.6 * c) * (1 - 0.85 * kn));
    }

    // the young stars that light it, carried by the same map as the gas. Three of them become fig. 3's knots: each
    // drifts as its knot does and hands its light over as the knot kindles in its place (kn); the fourth steps back
    const youngI = gasIn * (1 - this.igA) * (1 - 0.5 * c) * gasOut;
    co.youngI = youngI;
    const bw = (1 - c) * f.motion;
    const out4 = 1 - ss(GENESIS_T.youngOut[0], GENESIS_T.youngOut[1], T);
    for (let i = 0; i < co.young.length; i++) {
      const s = co.young[i];
      const at = s.m.uniforms.uCenter.value as Vector3;
      genesisPoint(this.yq[i], c, this.spinC, expand, this.bangOff, at, this.fallShift(this.v6));
      const knot = i < KNOTS.length;
      if (knot) addGroupDrift(this.yq[i], f.time, bw, at);
      s.m.uniforms.uI.value = youngI * YOUNG[i][3] * 1.4 * (knot ? 1 - kn * kn : out4);
    }

    // the sun: grows out of the flash, overshoots a little, churns; behind the world in figs 8-10 as its rim; a star
    // again as the camera pulls away in fig. 11 (the thread sprite takes its place)
    co.ignite = this.igA;
    co.sunScale = this.igA > 0 ? easeOutBack(Math.min(1, this.igA)) : 0;
    co.hot = Math.exp(-igAge * 1.6) * (igAge < 1e2 ? 1 : 0);
    const sunOut = 1 - ss(GENESIS_T.sunOut[0], GENESIS_T.sunOut[1], T);
    co.sunVis = this.igA * sunOut;
    co.coronaI = this.igA * sunOut * (0.8 - 0.45 * ss(GENESIS_T.rim[0], GENESIS_T.rim[1], T));
    // the shock of first light runs out through the disk and clears it: seen in the dust it lights (uShock: radius,
    // strength, width), with a hairline front over it; in show time once lit, and over before fig. 4's line
    // (its progress: the time since first light, or how far the scroll has gone toward fig. 4's line, whichever is
    // further: a quick scroll sees it whole and over in time, a stop sees it run out, never held half way)
    const sk =
      this.ignitedAt >= 0
        ? Math.max(
            Math.min(1, igAge / SHOCK_S),
            ss(GENESIS_T.shockBy[0] - 0.1, GENESIS_T.shockBy[1], T),
          )
        : 1;
    const shock = sk < 1 ? ss(0, 0.06, sk) * (1 - sk) ** 1.6 : 0;
    const shockR = CAVITY_R * 0.7 + (SHOCK_R - CAVITY_R * 0.7) * (1 - (1 - sk) ** 2.2);
    co.shockI = 0.3 * shock;
    co.shockR = shockR;
    (f.U.uShock.value as Vector4).set(shockR, shock, 1.6 + 2.4 * sk, 0);
    f.rig.kick = ss(0.85, 1, c) * (1 - ss(GENESIS_T.kickOut[0], GENESIS_T.kickOut[1], T));
    f.U.uGenDim.value = 1;
    shared.sun[0] = SUN[0];
    shared.sun[1] = SUN[1];
    shared.sun[2] = SUN[2];
    shared.sunOn = co.sunVis;
  }

  /**
   * Fig. 3: where the knots are this frame (their cores carried by the same map as their motes; the chosen one comes to
   * the sun's place as the disk gathers, the others into it), how present each is, the light they throw on the gas
   * and the dust; and the camera's FOCUS: the middle of the three, and the chosen one it follows in.
   */
  private place(f: FrameCtx) {
    const { motion } = f;
    const c = f.U.uCollapse.value as number;
    const ch = this.choice;
    const kn = this.kn;
    const bw = (1 - c) * motion;
    const t = f.time;
    const ki = f.G.uKnotI.value as Vector3;
    const kv = f.U.uKnot.value as Vector4[];
    const gv = f.G.uKnot.value as Vector4[];
    // the loud one flickers, gently (1.6 and 2.7 Hz at most: well under 3, never a strobe); the heaviest barely breathes
    const flick = this.flick;
    flick[0] =
      1 +
      0.2 * Math.sin(t * 10.05) * (0.55 + 0.45 * Math.sin(t * 1.95 + 1.1)) +
      0.09 * Math.sin(t * 16.9 + 0.6);
    flick[1] = 1 + 0.05 * Math.sin(t * 0.75);
    flick[2] = 1 + 0.08 * Math.sin(t * 2.8 + 2.0);
    let flare = 0;
    for (let i = 0; i < KNOTS.length; i++)
      if (i !== ch && ch >= 0) flare += 0.7 * Math.exp(-(((this.sIn[i] - 0.97) / 0.06) ** 2));
    for (let i = 0; i < KNOTS.length; i++) {
      const w = this.knotW[i];
      genesisPoint(
        this.knotK[i],
        c,
        this.spinC,
        this.expand,
        this.bangOff,
        w,
        this.v1.subVectors(this.knotD[i], this.fallOff),
        true,
      );
      addGroupDrift(this.knotK[i], t, bw, w);
      const s = this.sIn[i];
      if (ch >= 0) w.lerp(this.sunV, i === ch ? c : c * s);
      // presence: the chosen one gives way to the heart of the disk (the core glow, then the sun); the others go as
      // they arrive
      const on = kn * (i === ch ? 1 - ss(0.7, 0.98, c) : 1 - ss(0.8, 1.0, s));
      this.knotOn[i] = on;
      const lit =
        i === ch
          ? (1 + 0.3 * this.lean + flare) * (1 - this.igA)
          : (1 - 0.3 * this.lean) * (1 - ss(0.85, 1, s)) * (1 + 0.5 * ss(0.3, 0.85, s));
      const L = kn * flick[i] * lit;
      this.knotI[i] = L;
      ki.setComponent(i, KNOTS[i].light * L);
      kv[6 + i].set(w.x, w.y, w.z, KNOTS[i].moteLight * L * (i === ch ? 1 - ss(0.4, 0.95, c) : 1));
      gv[6 + i].copy(kv[6 + i]);
    }
    // the camera: the middle of the three, and the chosen one (the heaviest until there is a choice) followed in
    FOCUS.frame.set(0, 0, 0);
    for (let i = 0; i < KNOTS.length; i++) FOCUS.frame.add(this.knotW[i]);
    FOCUS.frame.multiplyScalar(1 / KNOTS.length);
    // (eased, so a second thought in the choose window turns the camera instead of cutting it)
    const pickK = ch >= 0 ? Math.max(0.22 * this.lean, ss(0, 0.6, this.u)) : 0;
    const to = this.knotW[ch >= 0 ? ch : HEAVY];
    if (f.snapping || FOCUS.pickK < 0.002) FOCUS.pick.copy(to);
    else FOCUS.pick.lerp(to, 1 - Math.exp(-f.dt * 3.5)).lerp(to, ss(0.3, 1, this.u));
    FOCUS.pickK = pickK;
  }

  frame(f: FrameCtx) {
    const { U, T, now, freed, live, bangAge, presence } = f;
    const cam = f.camera;
    const freedAge = this.freedAge;

    // after the bang: the blast keeps its momentum for a moment, then the cloud gathers it in
    U.uSpring.value = live
      ? 0.16 + 0.84 * ss(0.5, 3.2, bangAge)
      : freed
        ? 0.35 + 0.65 * ss(0, 1.5, freedAge)
        : 1;
    U.uDrag.value = live ? 0.55 * (1 - ss(0.8, 3.4, bangAge)) : 0;
    U.uFreedK.value = live ? ss(0.7, 4.4, bangAge) : freed ? ss(0, 1.2, freedAge) : 0;
    // (the click's smaller blast burns a little cooler)
    U.uHeat.value = live ? Math.exp(-bangAge * 0.7) * (0.4 + 0.6 * this.kickK) : 0;

    // ---- fig. 1: the hold, the singularity, the bang ----
    // the gate's answer to a scroll attempt (src/lib/gate.ts): eased in and out, only while the light waits
    this.knock = damp(this.knock, freed || this.crushing ? 0 : gateAnswer(now), 7, f.dt);
    const crushK = this.crushing
      ? this.bangK0 +
        Math.max(0, this.crushTo - this.bangK0) * ((now - this.crushAt) / this.crushMs) ** 1.6
      : 0;
    // (an attempt at the closed gate is answered with a breath of the hold: the sky leans into the point a little and
    // lets it go again, so the visitor sees what a hold would do)
    const k = freed ? 0 : this.crushing ? crushK : Math.max(hold.k, this.breath());
    if (!freed && !this.crushing) {
      this.v1.copy(cam.position).addScaledVector(f.rayD, HOLD_DIST);
      if (hold.pressing || k > 0.01) this.holdP.lerp(this.v1, 1 - Math.exp(-f.dt * 9));
      else this.holdP.copy(this.v1);
    }
    U.uHoldK.value = k;
    U.uHoldP.value.copy(this.holdP);
    U.uHoldAxis.value.copy(f.rayD);
    U.uCoreR.value = 0.5 + 1.2 * k;
    U.uLensC.value.set(hold.nx, hold.ny);
    // gravity bends the starlight around the pointer, stronger as the sky is pulled in (the sky adds its own share)
    U.uLensE.value =
      (freed ? 0 : 0.036 + 0.07 * k + 0.02 * this.knock) *
      Math.max(presence, k > 0 ? 1 : 0) *
      (f.reduce ? 0 : 1);
    // before the bang the near dust drifts toward the pointer's ray (and leans in harder while the gate answers)
    U.uPointer.value =
      Math.max(presence * Math.min(1, 0.4 + hold.moving), 0.4 * this.knock) + 1.1 * this.knock;
    if (this.impulse) {
      U.uImpulse.value = this.kickK;
      U.uBangP.value.copy(this.bangP);
      this.impulse = false;
    } else U.uImpulse.value = 0;
    this.coreFx(f, k);

    // ---- fig. 2: the hand's currents in the gas and the dust ----
    this.stir(f);

    // the deep-space stars come in after the blast, and step back while the sun ignites
    const sb =
      ss(GENESIS_T.starsBack[0], GENESIS_T.starsBack[1], T) *
      (1 - ss(GENESIS_T.starsIn[0], GENESIS_T.starsIn[1], T));
    U.uStarDim.value = (live ? ss(1.0, 4.0, bangAge) : 1) * (1 - 0.35 * sb);
    // the night turns to space as the blast clears (the engine's look; the sky ends it)
    this.space = freed ? (live ? ss(0.1, 2.2, bangAge) : 1) : 0;

    // ink: the sun, once it is lit (fading where a body hides it: the world, from fig. 8)
    const co = f.cosmos;
    if (co.sunVis > 0.002 && co.sunScale > 0.001)
      setAnchor(
        ANCHOR.center,
        SUN[0],
        SUN[1],
        SUN[2],
        SUN_R * co.sunScale,
        co.sunVis * (1 - f.hidden(this.sunV)),
      );
    this.clumps(f);
    this.center(f);
    this.thread(f);
    // your point stands out from the dense dust of figs 2-3 (a deeper moat, a fine ring: fx.ts thread uK), and keeps a
    // lighter ring through figs 4-6 until it launches (./thread.ts threadK)
    f.fxs.thread.m.uniforms.uK.value = freed ? threadK(T) : 0;
  }

  /**
   * Fig. 2: the four clumps the ink tags (anchors clump0..3), carried by the same map and drift as their motes; each
   * buds as its tag writes (uClumpB: its motes brighten, then keep a little of it).
   */
  private clumps(f: FrameCtx) {
    const T = f.T;
    const on = f.freed
      ? ss(GENESIS_T.clumps[0], GENESIS_T.clumps[0] + 0.15, T) *
        (1 - ss(GENESIS_T.clumps[1] - 0.1, GENESIS_T.clumps[1], T))
      : 0;
    const bud = f.U.uClumpB.value as Vector4;
    if (on <= 0.002) {
      bud.set(0, 0, 0, 0);
      return;
    }
    for (let i = 0; i < 4; i++) {
      const a = BUD_AT[i];
      bud.setComponent(i, ss(a - 0.03, a + 0.05, T) * (1 - 0.55 * ss(a + 0.06, a + 0.3, T)) * on);
    }
    const c = f.U.uCollapse.value as number;
    const bw = (1 - c) * f.motion;
    for (let i = 0; i < this.clumpQ.length; i++) {
      const q = this.clumpQ[i];
      const p = genesisPoint(
        q,
        c,
        this.spinC,
        this.expand,
        this.bangOff,
        this.v4,
        this.fallShift(this.v6),
      );
      addGroupDrift(q, f.time, bw, p);
      setAnchor(this.clumpIds[i], p.x, p.y, p.z, CLUMPS.r, on);
    }
  }

  /**
   * Fig. 3, the center (BEATS.center knots / choose / fall / ignite): the knots' sprites, each its own character (the
   * loud one hot, small and flickering, with spikes; the heaviest wide, deep and steady), lifted when hovered, the
   * chosen one swelling as it is picked and as the others arrive; and anchors knot0..2 (world radius: the knot's).
   */
  private center(f: FrameCtx) {
    const { now } = f;
    const fk = f.fxs.knots;
    const ch = this.choice;
    const vf = Math.min(1.2, Math.max(0.42, f.vmin / 900));
    const swell =
      this.chosenAt > 0 && !f.snapping && !f.reduce ? Math.exp(-(now - this.chosenAt) / 650) : 0;
    const dim = f.U.uDim.value as number;
    for (let i = 0; i < KNOTS.length; i++) {
      const K = KNOTS[i];
      const s = fk[i];
      const on = this.knotOn[i];
      const w = this.knotW[i];
      // the light place() lit it with, the swell of being chosen, and the lift of a hover
      const I =
        this.knotI[i] * (i === ch ? 1 + 0.9 * swell : 1) * (1 + HOVER_LIGHT * this.hover[i]);
      if (on <= 0.002 || I <= 0.002) {
        s.mesh.visible = false;
        continue;
      }
      const px =
        K.px *
        vf *
        (1 + HOVER_PX * this.hover[i] + (i === ch ? 0.2 * swell : 0)) *
        (i === ch ? 1 : 1 - 0.45 * this.sIn[i]);
      const size = f.worldPx(w, px);
      s.m.uniforms.uCenter.value.copy(w);
      (s.m.uniforms.uSize.value as number[])[0] = size;
      (s.m.uniforms.uSize.value as number[])[1] = size;
      s.m.uniforms.uI.value = I * K.glowI * on * dim;
      s.m.uniforms.uWhite.value = K.white;
      (s.m.uniforms.uCol.value as Vector3).set(K.col[0], K.col[1], K.col[2]);
      s.m.uniforms.uSpike.value = K.spike;
      s.m.uniforms.uCore.value = K.core;
      s.m.uniforms.uHalo.value = K.halo;
      s.mesh.visible = true;
      setAnchor(this.knotIds[i], w.x, w.y, w.z, K.r * (i === ch ? 1 : 1 - 0.6 * this.sIn[i]), on);
    }
  }

  /**
   * Your point before fig. 4 (./thread.ts): the hold point until the bang (the ink's crosshair; the engine shows no
   * sprite before the sky is freed), then the bang point, carried by the genesis map: the blast drives it in with
   * the cloud to its home (HOME), it drifts with the nebula, it falls with the field into the chosen knot as the
   * disk forms; then (GENESIS_T.settle, sped by holding like the rest) a spiral fall into the close orbit around the
   * sun: the two points blended about the sun in polar terms (the angle the shorter way round, followed continuously
   * frame to frame so it never flips side; the radius eased; the height lerped), so it spirals in and never cuts
   * across the sun. The nebula's map carries it with its turn capped (cosmos.ts genesisPoint), so it never whips.
   */
  private thread(f: FrameCtx) {
    const T = f.T;
    if (T >= F.gathering) return;
    const p = this.v4;
    if (!f.freed) p.copy(this.holdP);
    else {
      const c = f.U.uCollapse.value as number;
      // the point as it was made, from the sun (the bang point, or the hold point if none yet), and its home
      const made = this.v5.subVectors(this.bangSeen ? this.bangP : this.holdP, this.sunV);
      // first where it was made (in view of figs 1-2 whatever the hold), then over fig. 2 it drifts to its place above
      // the knots (GENESIS_T.home)
      const home = this.v2
        .copy(made)
        .setLength(HOME_R)
        .lerp(this.v1.set(HOME[0], HOME[1], HOME[2]), ss(GENESIS_T.home[0], GENESIS_T.home[1], T));
      genesisPoint(home, c, this.spinC, this.expand, made, p, this.fallShift(this.v6), true);
      const d = DRIFT * (1 - c) * f.motion * ss(F.point + 0.5, F.versions, T);
      const t = f.time;
      p.x += Math.sin(t * 0.11 + 1.3) * d;
      p.y += Math.sin(t * 0.083) * d * 0.6;
      p.z += Math.cos(t * 0.097) * d;
      const k = Math.max(ss(GENESIS_T.settle[0], GENESIS_T.settle[1], T), ss(0.2, 1, c));
      const o = closeOrbit(T, f.time, this.v3);
      const S = this.sunV;
      const ag = Math.atan2(p.z - S.z, p.x - S.x);
      const raw = wrapPi(Math.atan2(o.z - S.z, o.x - S.x) - ag);
      // (the gap followed continuously: a jump lands on the shorter way)
      this.threadDa =
        f.snapping || !this.threadSeen ? raw : this.threadDa + wrapPi(raw - this.threadDa);
      this.threadSeen = true;
      if (k > 0) {
        const rg = Math.hypot(p.x - S.x, p.z - S.z);
        const ro = Math.hypot(o.x - S.x, o.z - S.z);
        const a = ag + this.threadDa * k;
        const r = rg + (ro - rg) * k;
        p.set(S.x + Math.cos(a) * r, p.y + (o.y - p.y) * k, S.z + Math.sin(a) * r);
      }
    }
    setAnchor(ANCHOR.yours, p.x, p.y, p.z, 0, 1);
  }

  /** The breath of a hold the gate's answer gives the point (as hold.k: the sky leans in a little, the core glows). */
  private breath() {
    return KNOCK_BREATH * this.knock;
  }

  private explode(now: number, k: number) {
    this.bangStart = now;
    this.impulse = true;
    this.bangK = k;
  }

  /** The core glow (the singularity, later the collapsing heart of the disk), the capped flashes, the shock ring. */
  private coreFx(f: FrameCtx, k: number) {
    const { freed, live, bangAge, presence, now } = f;
    const cam = f.camera;
    const fxs = f.fxs;
    const core = fxs.core;
    const c = f.U.uCollapse.value as number;
    const proto = freed && c > 0.05 ? ss(0.05, 0.9, c) * (1 - this.igA) : 0;
    if (!freed || (live && bangAge < 1.2)) {
      const after = freed ? Math.exp(-bangAge * 5) : 1;
      const kk = freed ? this.bangK : k;
      const px = 26 + 230 * kk * kk + (freed ? 200 * (1 - after) * after * 4 * this.bangFx : 0);
      const s = f.worldPx(freed ? this.bangP : this.holdP, px);
      core.m.uniforms.uCenter.value.copy(freed ? this.bangP : this.holdP);
      (core.m.uniforms.uSize.value as number[])[0] = s;
      (core.m.uniforms.uSize.value as number[])[1] = s;
      core.m.uniforms.uI.value =
        (0.32 + 2.4 * kk ** 1.4) *
        (presence || kk > 0 ? 1 : 0.6) *
        after *
        (1 + (freed ? 1.2 * this.bangFx : 0));
      core.m.uniforms.uHot.value = Math.min(1, kk * 1.3 + (freed ? after : 0));
      core.m.uniforms.uStreak.value = core.m.uniforms.uHot.value;
      core.mesh.visible = true;
    } else if (proto > 0.002) {
      // the collapsing heart of the disk (the chosen knot, on its way to the sun's place) glows hotter and hotter
      // before the sun ignites (kept in proportion on a phone)
      const at = this.choice >= 0 ? this.knotW[this.choice] : this.sunV;
      const vf = Math.min(1.2, Math.max(0.42, f.vmin / 900));
      const px = (40 + 260 * proto * proto) * vf;
      const s = f.worldPx(at, px);
      core.m.uniforms.uCenter.value.copy(at);
      (core.m.uniforms.uSize.value as number[])[0] = s;
      (core.m.uniforms.uSize.value as number[])[1] = s;
      core.m.uniforms.uI.value = 0.25 + 1.6 * proto * proto;
      core.m.uniforms.uHot.value = proto * proto;
      // (no glint on the disk's heart: it is a body gathering, not a lens)
      core.m.uniforms.uStreak.value = 0;
      core.mesh.visible = true;
    } else core.mesh.visible = false;

    // one capped flash for the bang, one for the sun's first light (never more than one every few seconds)
    let fl = 0;
    if (live && bangAge < 1.6) {
      const b = bangAge < 0.06 ? bangAge / 0.06 : Math.exp(-(bangAge - 0.06) * 5.2);
      fl = 0.3 * b * (0.5 + 0.5 * this.bangK) * this.bangFx;
      this.v1.copy(this.bangP).project(cam);
    }
    const fa = (now - this.flashAt) / 1000;
    if (fa >= 0 && fa < 1.4 && fl === 0) {
      const b = fa < 0.08 ? fa / 0.08 : Math.exp(-(fa - 0.08) * 4.2);
      // (the sun's first light: a gentle swell, so the disk and its shock are not washed out)
      fl = 0.12 * b;
      this.v1.copy(this.sunV).project(cam);
    }
    if (fl > 0.001) {
      fxs.flashM.uniforms.uI.value = fl;
      (fxs.flashM.uniforms.uC.value as number[])[0] = this.v1.x;
      (fxs.flashM.uniforms.uC.value as number[])[1] = this.v1.y;
      fxs.flashM.uniforms.uAspect.value = f.aspect;
      fxs.flash.visible = true;
    } else fxs.flash.visible = false;
    const ring = fxs.ring;
    if (live && bangAge < 2.0) {
      const r = 1.0 + 64 * (1 - Math.exp(-bangAge * 2.3));
      ring.m.uniforms.uCenter.value.copy(this.bangP);
      (ring.m.uniforms.uSize.value as number[])[0] = r;
      (ring.m.uniforms.uSize.value as number[])[1] = r;
      ring.m.uniforms.uI.value =
        Math.exp(-bangAge * 2.2) *
        (0.6 + 0.4 * this.bangK) *
        this.bangFx *
        ss(0, 0.05, bangAge) *
        (1 - ss(1.4, 2.0, bangAge));
      ring.m.uniforms.uW.value = 0.008 + 0.022 * bangAge;
      ring.mesh.visible = true;
    } else ring.mesh.visible = false;
  }

  /**
   * Fig. 2's stir (GENESIS_T.stir; glsl/genesis.ts STIR): a hand through smoke. The hand is where the pointer's ray
   * meets the gas the eye sees, and only the gas and the dust near it answer (a soft ellipsoid, never the whole ray,
   * so nothing from out of view is pulled in). Its stroke is the pointer's own motion (hold.vx / vy) carried to that
   * depth, so the camera's moves and a scroll stir nothing: it carries the gas along and parts it, at most a fraction
   * of the hand's reach (a hover gently, a drag further), eased in and let go. A drag also leaves a pair of eddies
   * either side of its stroke, which wind up, turn the gas a bounded angle and let it go again; none is cut short. A
   * pointer that has just arrived (entering the window, a new finger, a leap) is not a stroke yet. Outside fig. 2 it is
   * off: nothing in figs 3-12 moves with the pointer.
   */
  private stir(f: FrameCtx) {
    const { U, G, T, dt, now } = f;
    const cam = f.camera;
    // the window takes new strokes; what is already in the gas lets go in show time, inside a long ramp (a jump: at once)
    const can = f.freed && f.motion > 0;
    const onT = can
      ? ss(GENESIS_T.stir[0], GENESIS_T.stir[1], T) *
        (1 - ss(GENESIS_T.stirOut[0], GENESIS_T.stirOut[1], T))
      : 0;
    const wide = can
      ? ss(STIR_WIDE, GENESIS_T.stir[1], T) * (1 - ss(GENESIS_T.stirOut[0], STIR_CUT, T))
      : 0;
    // (coming back into the window, eddies still turning come back in show time too, a little quicker)
    this.stirOn = f.snapping
      ? onT
      : Math.min(
          onT >= this.stirOn ? onT : wide,
          damp(this.stirOn, onT, onT > this.stirOn ? STIR_RELAX * 1.7 : STIR_RELAX, dt),
        );
    if (this.stirOn < 0.002 && onT < 0.002) this.stirOn = 0;
    const on = this.stirOn;
    const taking = onT > 0.5;
    // the hand: on the pointer's ray, as deep as the gas the eye sees
    const P = this.stirP;
    const depth = Math.max(
      24,
      this.v1.subVectors(this.sunV, cam.position).dot(f.rayD) * STIR_DEPTH,
    );
    P.copy(cam.position).addScaledVector(f.rayD, depth);
    const R = depth * STIR_R;
    // is it there: a mouse over the stage (not over a control: its own clicks), or a finger down (it has no hover)
    const present =
      f.presence > 0 &&
      hold.inside &&
      hold.overStage &&
      (hold.pointerType !== "touch" || hold.down);
    const leap = Math.hypot(hold.x - this.stirX, hold.y - this.stirY) > STIR_LEAP * f.vmin;
    if (!present || !this.stirIn || leap) this.stirQuiet = now + STIR_SETTLE_MS;
    this.stirIn = present;
    this.stirX = hold.x;
    this.stirY = hold.y;
    const live = present && now >= this.stirQuiet;
    this.stirEng = damp(this.stirEng, live ? 1 : 0, live ? 3 : 2, dt);
    this.stirDrag = damp(this.stirDrag, live && hold.down ? 1 : 0, 5, dt);
    // the stroke: the pointer's own velocity (CSS px/s, y down), carried to the hand's depth, across the ray (outside
    // the window the hand is still: what it moved settles back as it does under a resting hand)
    let vx = live && taking ? hold.vx : 0;
    let vy = live && taking ? hold.vy : 0;
    const speed = Math.hypot(vx, vy);
    if (speed > STIR_VMAX) {
      vx *= STIR_VMAX / speed;
      vy *= STIR_VMAX / speed;
    }
    const wpp = f.worldPx(P);
    const vel = this.v2
      .copy(f.right)
      .multiplyScalar(vx * wpp)
      .addScaledVector(f.up, -vy * wpp);
    vel.addScaledVector(f.rayD, -vel.dot(f.rayD));
    // how far it carries the gas: STIR_LAG of that motion, softly bounded (a hover gently, a drag further)
    const dMax = R * (STIR_HOVER + (STIR_DRAG - STIR_HOVER) * this.stirDrag);
    const l = vel.length() * STIR_LAG;
    const to = this.v3
      .copy(vel)
      .multiplyScalar(l > 1e-5 ? (STIR_LAG * dMax * Math.tanh(l / dMax)) / l : 0);
    // eased in as the hand meets the gas, let go more slowly as it settles back
    this.stirD.lerp(to, 1 - Math.exp(-(to.lengthSq() > this.stirD.lengthSq() ? 7 : 2.6) * dt));

    // a drag leaves a pair of eddies either side of its stroke, turning opposite ways (each carries the gas along
    // the stroke on its near side)
    if (
      live &&
      taking &&
      hold.down &&
      this.stirDrag > 0.5 &&
      speed > EDDY_PX &&
      now - this.lastVort > EDDY_GAP
    ) {
      const a = this.freeVort(now, -1);
      const b = a >= 0 ? this.freeVort(now, a) : -1;
      if (b >= 0) {
        this.lastVort = now;
        const side = this.v4.crossVectors(f.rayD, this.v3.copy(vel).normalize()).normalize();
        const want =
          EDDY_MAX * (0.45 + 0.55 * Math.min(1, (speed - EDDY_PX) / (EDDY_FULL - EDDY_PX)));
        // (the pair ends a third of a life after the last pair still turning, so a long drag's pairs end in turn)
        let lastEnd = 0;
        for (let i = 0; i < VORTS; i++) {
          const o = this.vorts[i];
          if (o.born >= 0 && now - o.born < o.life * 1000)
            lastEnd = Math.max(lastEnd, o.born + o.life * 1000);
        }
        const life =
          lastEnd > 0
            ? Math.min(EDDY_LIFE_MAX, Math.max(EDDY_LIFE, (lastEnd - now) / 1000 + EDDY_LIFE / 3))
            : EDDY_LIFE;
        for (let j = 0; j < 2; j++) {
          const sign = j === 0 ? 1 : -1;
          const vt = this.vorts[j === 0 ? a : b];
          vt.p.copy(P).addScaledVector(side, sign * R * 0.75);
          // eddies already turning the same way here: this one adds only what keeps their sum bounded
          let near = 0;
          for (let i = 0; i < VORTS; i++) {
            const o = this.vorts[i];
            if (o === vt || o.born < 0 || now - o.born >= o.life * 1000 || o.a * sign <= 0)
              continue;
            near += Math.abs(o.a) * Math.exp(-o.p.distanceToSquared(vt.p) / (o.r * o.r));
          }
          const ang = Math.min(want, EDDY_CAP - near);
          vt.ax.copy(f.rayD);
          vt.r = R;
          vt.a = ang * sign;
          vt.life = life;
          vt.born = ang > 0.12 ? now : -1;
        }
      }
    }
    // each eddy winds up, turns the gas (and the dust's places) by its angle, and lets it go by the end of its life
    const A = U.uVortA.value as Vector4[];
    const B = U.uVortB.value as Vector4[];
    const GA = G.uVortA.value as Vector4[];
    const GB = G.uVortB.value as Vector4[];
    let eddies = false;
    for (let i = 0; i < VORTS; i++) {
      const vt = this.vorts[i];
      const age = vt.born >= 0 ? (now - vt.born) / 1000 : 1e3;
      const L = vt.life;
      const ang =
        age < L && on > 0
          ? vt.a * (1 - Math.exp(-age * EDDY_WIND)) * (1 - ss(L - EDDY_LIFE * 0.65, L, age)) * on
          : 0;
      if (ang !== 0) eddies = true;
      A[i].set(vt.p.x, vt.p.y, vt.p.z, vt.r);
      B[i].set(vt.ax.x, vt.ax.y, vt.ax.z, ang);
      GA[i].copy(A[i]);
      GB[i].copy(B[i]);
    }
    const amp = this.stirEng * on;
    const D = this.stirD;
    const dl = D.length() * amp;
    const off = on <= 0 || (dl < 0.005 && !eddies);
    const sets = f.uSets;
    for (let i = 0; i < sets.length; i++) {
      const u = sets[i];
      (u.uStirP.value as Vector4).set(P.x, P.y, P.z, off ? 0 : R);
      (u.uStirA.value as Vector4).set(f.rayD.x, f.rayD.y, f.rayD.z, R * STIR_DEEP);
      (u.uStirD.value as Vector4).set(D.x * amp, D.y * amp, D.z * amp, dl * STIR_PART);
    }
  }

  /** A slot whose eddy is over (or never was), other than `skip`, or -1. */
  private freeVort(now: number, skip: number) {
    for (let i = 0; i < VORTS; i++) {
      const vt = this.vorts[i];
      if (i !== skip && (vt.born < 0 || now - vt.born >= vt.life * 1000)) return i;
    }
    return -1;
  }
}
