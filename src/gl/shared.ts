import type { Texture } from "three";
import type { GLTier } from "@/lib/tier";

/** Mutable state shared between the WebGL show and the DOM (read in frame callbacks, never React state). */
export const shared = {
  tier: "high" as GLTier,
  /** Set after shaders are compiled and the first frame is drawn. */
  ready: false,
  /** Live readout (written by the show): the real sim mote count and the measured fps (rolling). */
  simCount: 0,
  fps: 0,
  /** Sky: save the visitor's sky as a PNG (set by the show when the sky chapter is ready). */
  captureSky: null as null | (() => Promise<Blob | null>),
  /**
   * The sun's position in world units (written by the core show; it sits 40 units behind journey PLANET on -z, so
   * the world's day side faces -z and its night side faces +z, toward the camera of figs. 7-10) and how lit it is,
   * 0..1 (0 before the ignition). Light the world with it.
   */
  sun: [0, 0, -80] as [number, number, number],
  sunOn: 0,
  /**
   * Earth's surface, as the world module baked it (src/gl/world/world.ts: a cube map of the land, the cloud and the
   * lights, in the planet's rest frame) and when (performance.now(), -1 not yet), and the turn of its cloud (rad about
   * y). The core show's world planet (figs 4-7, cosmos.ts) reads it, so the planet the probe dives at is the same
   * Earth the world module draws from fig. 8 on, and their cross-fade never shows two maps. `turn`: how far the
   * visitor's drag has turned the world about its axis (rad, east positive), so the flock waits over the lights where
   * they are (figures/flock.ts).
   */
  earth: { surf: null as Texture | null, at: -1, cloud: 0, turn: 0 },
  /**
   * Fig. 11: the star card's box on screen while it shows (CSS px, written by src/bridges/star-card.ts): the pointer
   * over it keeps its star named, and a click or a tap on it opens that star (figures/galaxy.ts).
   */
  starCard: { on: false, x0: 0, y0: 0, x1: 0, y1: 0 },
  /**
   * Gravity (docs/STORY.md, src/lib/journey.ts): what the visitor did and how each figure turned out. The GL module
   * that owns a figure writes its fields; the DOM (lines, hints, the ink journal) reads them. -1 / 0 mean "not yet".
   */
  play: {
    /** Fig. 3: the knot chosen as the center (0..2), and whether the visitor chose it (false: it chose itself). */
    center: -1,
    centerByVisitor: false,
    /** Fig. 3: the knot a click would pick now, under a mouse (-1: none, or no hover: a finger); the ink circles it. */
    centerAim: -1,
    /** Fig. 5: how much the visitor's hold has pulled the orbits together (0..1), and the alignment reached (0..1). */
    pull: 0,
    aligned: 0,
    /** Fig. 5: the orbits settled with the visitor's help (true) or on their own (false), once aligned reaches 1. */
    alignedByVisitor: false,
    /** Fig. 7: story time of the launch (-1 before), whether the visitor launched it, and its timing 0..1 (1 = on the window). */
    launchT: -1,
    launchByVisitor: false,
    launchTiming: 0,
    /** Fig. 7: your point's speed (km/s as the ink shows it) and how many planets it has borrowed from so far. */
    speed: 0,
    flybys: 0,
    /** Fig. 8: city lights lit so far (the ink's quiet count). */
    cities: 0,
    /**
     * Fig. 9: the field's strength against the storm 0..1, how hard the storm is hitting 0..1, how hard the visitor's
     * hold is pushing back 0..1 (damped: in over ~0.4 s, out over ~1 s), lights that went dark (always 0 in the end).
     */
    field: 0,
    hit: 0,
    push: 0,
    lightsLost: 0,
    /** Fig. 10: how free the flock is of the cursor, 0 (following) .. 1 (on its own). */
    autonomy: 0,
    /** Fig. 11: the platform star under the pointer (project slug, "" for none). */
    hoverStar: "",
  },
};

/** The visitor's outcomes as on arrival. */
const PLAY0 = { ...shared.play };

/** Start over (src/lib/restart.ts): every outcome back to "not yet", in place (the ink holds the object itself). */
export function resetPlay() {
  Object.assign(shared.play, PLAY0);
}
