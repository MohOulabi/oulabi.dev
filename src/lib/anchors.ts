/**
 * Anchors: the bridge between the 3D universe and the ink journal drawn over it (docs/STORY.md, "A journal over the
 * universe"). A GL module that owns a figure writes the world position of the things the ink points at (the knots,
 * the planets, the probe, the poles, the platform stars, your point) every frame it is active; once the camera is
 * placed, the projector (src/gl/project.ts) writes their CSS-pixel screen positions; the DOM ink layer reads those
 * and pins its lines and notes to them. Paths are polylines the same way (orbits, the launch trajectory, field lines).
 *
 * Rules: set an anchor every frame it should be live (the projector stamps the frame; an anchor not set this frame
 * is not live, so a module that stops drawing never leaves stale ink behind). Ids are the ANCHOR / PATH names below,
 * or `star:<project slug>` for the platform stars of Fig. 11. No allocation per frame after an id's first use.
 * Plain TypeScript (no three.js): safe to import from the DOM.
 */

export type Anchor = {
  /** World position (world units) and world radius of the thing (0 for a point). */
  x: number;
  y: number;
  z: number;
  r: number;
  /** 0..1 how present it is (the ink fades with it). */
  on: number;
  /** Frame number of the last set (the projector compares it with `frame`). */
  stamp: number;
  /** Written by the projector: CSS px from the viewport's top-left, projected radius (CSS px), view depth. */
  sx: number;
  sy: number;
  sr: number;
  depth: number;
  /** Written by the projector: set this frame, in front of the camera and within the viewport (plus a margin). */
  live: boolean;
  vis: boolean;
};

export type Path = {
  /** Points used this frame (≤ max). */
  n: number;
  max: number;
  /** World xyz per point, then (projector) CSS px xy per point and a 0/1 in-front flag. */
  world: Float32Array;
  screen: Float32Array;
  front: Uint8Array;
  on: number;
  stamp: number;
  live: boolean;
};

export const ANCHOR = {
  /** The visitor's point, the thread of the whole story (Fig. 1 to Fig. 12). */
  yours: "yours",
  /** The sun once it has ignited at the chosen center. */
  center: "center",
  /** Fig. 2: a few clumps of the nebula, 0..3 (the ink's version tags). */
  clump: (i: number) => `clump${i}`,
  /** Fig. 3: the three knots, 0..2 (0 the loud one, m 0.6; 1 the heaviest, m 2.4; 2 m 1.1). */
  knot: (i: number) => `knot${i}`,
  /**
   * Planets by index (src/gl/show/constants.ts PLANETS): 0 engineering (ember), 1 product (gold), 2 the world (who it's
   * for), 3 data (the ringed giant), 4 operations (ice). Orbits 0 and 1 are the pair that cross in fig. 5.
   */
  planet: (i: number) => `planet${i}`,
  /** Fig. 7: your point in flight. */
  probe: "probe",
  /** Fig. 8 on: the world and the hub (where your point landed: the first city). */
  world: "world",
  hub: "hub",
  /** Fig. 9: the storm front and the world's poles (the aurora). */
  storm: "storm",
  poleN: "poleN",
  poleS: "poleS",
  /** Fig. 10: the flock's centre. */
  flock: "flock",
  /** Fig. 11: the whole system as one star, and the platform stars. */
  system: "system",
  star: (slug: string) => `star:${slug}`,
} as const;

export const PATH = {
  /** Planet orbits, 0..4. */
  orbit: (i: number) => `orbit${i}`,
  /** Fig. 6 and 7: the planned launch trajectory, and the trail your point has flown. */
  assist: "assist",
  trail: "trail",
  /** Fig. 9: the world's field lines. */
  field: (i: number) => `field${i}`,
} as const;

/**
 * The frame counter the projector advances once per rendered frame, and `projected`: what the DOM ink runs as soon as
 * this frame's anchors are projected (src/gl/project.ts calls it last), so the ink sits on its bodies in the same frame.
 */
export const ink = { frame: 0, projected: null as (() => void) | null };

const anchorMap = new Map<string, Anchor>();
const pathMap = new Map<string, Path>();

export function anchor(id: string): Anchor {
  let a = anchorMap.get(id);
  if (!a) {
    a = {
      x: 0,
      y: 0,
      z: 0,
      r: 0,
      on: 0,
      stamp: -1,
      sx: 0,
      sy: 0,
      sr: 0,
      depth: 0,
      live: false,
      vis: false,
    };
    anchorMap.set(id, a);
  }
  return a;
}

/** Set an anchor for this frame (world position, world radius, presence 0..1). */
export function setAnchor(id: string, x: number, y: number, z: number, r = 0, on = 1) {
  const a = anchor(id);
  a.x = x;
  a.y = y;
  a.z = z;
  a.r = r;
  a.on = on;
  a.stamp = ink.frame;
  return a;
}

export function path(id: string, max = 64): Path {
  let p = pathMap.get(id);
  if (!p) {
    p = {
      n: 0,
      max,
      world: new Float32Array(max * 3),
      screen: new Float32Array(max * 2),
      front: new Uint8Array(max),
      on: 0,
      stamp: -1,
      live: false,
    };
    pathMap.set(id, p);
  }
  return p;
}

/** Mark a path as written this frame (after filling `world` and `n`). */
export function touchPath(p: Path, on = 1) {
  p.on = on;
  p.stamp = ink.frame;
  return p;
}

export const allAnchors = () => anchorMap;
export const allPaths = () => pathMap;
