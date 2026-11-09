/**
 * World layout of the core show (world units ≈ metres). The visitor stands at OBSERVER under the real sky over
 * Riyadh (figs 1 and 12), looking north toward the celestial pole; the nebula, the sun and the planets of figs 2-11
 * lie north of them in space, the world planet at journey PLANET.
 */
export const GROUND = -3;
/** Eye of the visitor under the sky (figs 1 and 12). */
export const OBSERVER: [number, number, number] = [0, GROUND + 1.7, 40];
/** Radius of the disc of horizon lights in the returning sky (glsl/finale.ts fieldHome). */
export const FIELD_R = 165;
/** Riyadh. */
export const LAT = 24.7136;
export const LON = 46.6753;

/** Mote roles in the sky texture (w channel). */
export const ROLE = { star: 0, milky: 1, faint: 2, dust: 3, horizon: 4 } as const;

/** The murmuration's motes per tier (fig. 10): the lowest ids of the sim (a 16:10 screen grid per tier). */
export const FLOCK_N = { high: 320 * 200, medium: 192 * 120, low: 128 * 80 } as const;

export const LS_POINT = "nuqta:point";

/*
 * Genesis (docs/STORY.md figs 2-4): the bang cools into a nebula around the sun's place, gravity flattens it into a
 * disk, the sun ignites at its centre, the disk clears into rings and the rings condense into planets. The world planet
 * (index WORLD) reaches journey PLANET.center at HANDOFF.ARRIVE: the sun sits 40 units behind it on -z, so the
 * world's night side faces +z, toward the camera of figs 8-10.
 */
/** The sun, the centre of the nebula, the disk and the orbits. */
export const SUN: [number, number, number] = [0, 0, -80];
export const SUN_R = 4.4;
/** Rest radius of the nebula (world units) and the bound of the gas volume. */
export const NEB_R = 96;
/** Disk radius after the collapse: r = r0 (1 - DISK_SHRINK c) + DISK_INNER c (linear, so the gas can invert it). */
export const DISK_SHRINK = 0.2;
export const DISK_INNER = 4;
/** The inner cavity the sun's light clears (radiation pressure), its rim a glowing ring. */
export const CAVITY_R = 9.5;

/**
 * Fig. 4's messy orbit (figures/orbits.ts): an ellipse around the sun, a little inclined, its periapsis precessing.
 * Fig. 5 aligns it into the clean ring (`orbit`, e 0, in the disk plane).
 */
type Mess = {
  /** Semi-major axis and eccentricity. */
  a: number;
  e: number;
  /** Longitude of periapsis at F.gathering (rad, from +x toward +z about the sun) and its precession per figure. */
  peri: number;
  prec: number;
  /** Inclination (rad) about the node line at longitude `node`. */
  inc: number;
  node: number;
};

export type PlanetDef = {
  /** The clean ring's radius around the sun (fig. 5 on). */
  orbit: number;
  /** Sphere radius. */
  r: number;
  /**
   * Longitude (rad, from +x toward +z about the sun) at F.gathering; the planet clock (figures/orbits.ts) turns it at
   * `ws` rad per figure (Kepler-like: the inner ones faster). The world's l0 is its rest longitude (journey PLANET,
   * from HANDOFF.WORLD_FROM).
   */
  l0: number;
  ws: number;
  /** Disk radii [from, to) whose dust condenses into this planet. */
  band: [number, number];
  mess: Mess;
  /**
   * Fig. 6-7: the longitude it waits at on the launch trajectory (its mark) at the moment your point swings past it
   * (figures/probe.ts); NaN for the world (your point's destination, at rest at journey PLANET).
   */
  mark: number;
};

const deg = (d: number) => (d * Math.PI) / 180;

/** Index of the world planet in PLANETS. */
export const WORLD = 2;
/**
 * 0 engineering (ember), 1 product (gold), 2 the world (who it's for), 3 data (the ringed giant), 4 operations (ice).
 * Orbits 0 and 1 cross in fig. 4 (engineering's eccentric orbit pokes out through product's) and the two planets head
 * for a near miss early in fig. 5 (closest about 6 units apart, centre to centre, untouched; a hold only widens it).
 */
export const PLANETS: PlanetDef[] = [
  // a young ember world close to the sun, lava on its night side
  {
    orbit: 14,
    r: 1.25,
    l0: 5.1708,
    ws: 2.6,
    band: [0, 18.5],
    mess: { a: 17, e: 0.45, peri: 4.1708, prec: 0.35, inc: 0.1, node: 2.1708 },
    mark: deg(310),
  },
  // a gold world under thick cloud
  {
    orbit: 24.5,
    r: 2.1,
    l0: 0.9876,
    ws: 1.15,
    band: [18.5, 31.5],
    mess: { a: 23.2, e: 0.13, peri: 0.3876, prec: 0.2, inc: 0.06, node: 4.1708 },
    mark: deg(255),
  },
  // the world: at rest at journey PLANET (0, 0, -40) from HANDOFF.WORLD_FROM, radius 6
  {
    orbit: 40,
    r: 6,
    l0: Math.PI / 2,
    ws: 0.55,
    band: [31.5, 46],
    mess: { a: 42, e: 0.12, peri: 2.0, prec: 0.15, inc: 0.05, node: 1.2 },
    mark: Number.NaN,
  },
  // a ringed giant
  {
    orbit: 58,
    r: 4.4,
    l0: 5.837,
    ws: 0.32,
    band: [52, 65],
    mess: { a: 61, e: 0.1, peri: 4.2, prec: 0.1, inc: 0.07, node: 0.3 },
    mark: deg(40),
  },
  // an ice world, the touch of cold blue
  {
    orbit: 74,
    r: 2.5,
    l0: 0.321,
    ws: 0.22,
    band: [65, 200],
    mess: { a: 78, e: 0.12, peri: 1.0, prec: 0.08, inc: 0.12, node: 3.4 },
    mark: deg(55),
  },
];
/** The asteroid belt, between the world and the giant: disk radii [46, 52) stay dust. */
export const BELT: [number, number] = [46, 52];
/** Tilt of the giant's rings (normal). */
export const GIANT_RING_N: [number, number, number] = [0.32, 0.92, 0.22];

/** The flock's home (fig. 10): above the world's night-side limb. */
export const FLOCK_HOME: [number, number, number] = [0, 11, -39];
