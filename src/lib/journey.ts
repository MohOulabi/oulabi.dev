/**
 * Gravity (docs/STORY.md): the show's contract. Twelve figures of an astronomer's journal; figure i spans
 * story time T in [i, i + 1), scrubbed by natural scroll. The visitor's point is the idea, Mohammad is the gravity
 * that grows it into a world. The core show (src/gl/show), the world (src/gl/world), the DOM and the ink journal
 * (src/components, src/bridges) all read these ids, handoffs and windows, so they agree on every frame.
 *
 * Local progress inside figure f is k = T - F[f] (0..1). The BEATS below are each figure's inner beats: the owner
 * of a figure may tune its own beats, and the DOM (lines, hints, ink) reads them from here, never from literals.
 * HANDOFF values are cross-module promises: change one only together with every module that reads it.
 */
export const F = {
  /** Fig. 1. Dust drifts around the cursor; hold pulls it into one point; release bursts it. One light stays marked. */
  point: 0,
  /** Fig. 2. The burst cools into a nebula of gold dust and ember gas. Drag stirs it. */
  versions: 1,
  /** Fig. 3. Three bright knots. Click the one you think is heaviest; the others fall into it; a sun ignites there. */
  center: 2,
  /** Fig. 4. The disk spins up; planets condense on messy orbits; the ink names who is in the room. */
  gathering: 3,
  /** Fig. 5. Two orbits cross and the planets head for a near miss. Hold to deepen the center's pull. */
  alignment: 4,
  /** Fig. 6. The planets slide onto their marks along one launch trajectory, drawn in ink. */
  window: 5,
  /** Fig. 7. Your point launches and slingshots around each planet, faster at every pass, toward the world. */
  assist: 6,
  /** Fig. 8. It falls onto the world's night side and splits into city lights that spread and wire together. */
  theirs: 7,
  /** Fig. 9. A storm from deep space bends round the world's field and pours into the poles as aurora. Hold to push back. */
  storm: 8,
  /** Fig. 10. The lights lift into a murmuration that follows the cursor, then flies on in step without it. */
  flock: 9,
  /** Fig. 11. Pull back until the whole system is one star; fifty-odd others light up: the projects and platforms. */
  again: 10,
  /** Fig. 12. The real sky over Riyadh tonight, your point among the stars; the journal is signed. */
  sky: 11,
} as const;
export type FigureId = keyof typeof F;
export const FIGURES: FigureId[] = [
  "point",
  "versions",
  "center",
  "gathering",
  "alignment",
  "window",
  "assist",
  "theirs",
  "storm",
  "flock",
  "again",
  "sky",
];
export const FIGURE_COUNT = FIGURES.length;

/** Scroll length of each figure in viewport heights (natural scroll; never snap points). */
export const FIG_SCREENS: Record<FigureId, number> = {
  point: 1,
  versions: 1.1,
  center: 1.4,
  gathering: 1.1,
  alignment: 1.3,
  window: 1,
  assist: 1.6,
  theirs: 1.2,
  storm: 1.5,
  flock: 1.3,
  again: 1.3,
  sky: 1,
};

/** The world planet, in the show's world units. */
export const PLANET = {
  center: [0, 0, -40] as [number, number, number],
  radius: 6,
};

/**
 * Cross-module promises (story time T).
 *  - IGNITE: the sun has ignited at the chosen center by here (genesis -> system).
 *  - PLANETS_SOLID: the planets are solid bodies from here (system -> ink).
 *  - WINDOW_SET: the planets sit on their launch marks from here to the launch (system).
 *  - ARRIVE: your point (the probe) touches the world's night side at the hub, and the camera is at the world's
 *    approach pose, exactly here (system -> world).
 *  - WORLD_FROM / WORLD_TO: the world module draws in [WORLD_FROM, WORLD_TO); the world planet is the core show's
 *    sphere before WORLD_HANDOFF[1] and the world module's after WORLD_HANDOFF[0] (cross-faded between).
 *  - FLOCK_FROM: the flock's motes rise off the night side (world -> finale).
 *  - SYSTEM_STAR: from here the whole system reads as one star at the sun's place (finale).
 *  - SKY_FROM: everything flows back into the real sky over Riyadh from here (finale).
 */
export const HANDOFF = {
  IGNITE: F.center + 0.9,
  PLANETS_SOLID: F.gathering + 0.45,
  WINDOW_SET: F.window + 0.7,
  ARRIVE: F.theirs,
  WORLD_FROM: F.assist + 0.62,
  WORLD_HANDOFF: [F.assist + 0.86, F.theirs + 0.04] as [number, number],
  WORLD_TO: F.again + 0.4,
  FLOCK_FROM: F.flock,
  SYSTEM_STAR: F.again + 0.55,
  SKY_FROM: F.sky - 0.3,
};

type Win = [number, number];

/**
 * Inner beats per figure, as local progress k in 0..1. Owners tune their own; the DOM schedules lines, hints and ink
 * from these.
 */
export const BEATS = {
  point: { yours: [0.12, 0.9] as Win },
  versions: { stir: [0.08, 0.92] as Win },
  center: {
    knots: [0.0, 0.16] as Win,
    choose: [0.1, 0.44] as Win,
    fall: [0.44, 0.84] as Win,
    ignite: [0.84, 0.94] as Win,
  },
  gathering: { wind: [0.0, 0.3] as Win, condense: [0.12, 0.5] as Win, names: [0.42, 0.96] as Win },
  alignment: {
    cross: [0.0, 0.3] as Win,
    pull: [0.12, 0.62] as Win,
    settle: [0.3, 0.82] as Win,
    done: [0.8, 1.0] as Win,
  },
  window: { slide: [0.05, 0.62] as Win, plan: [0.3, 0.95] as Win },
  assist: {
    countdown: [0.0, 0.16] as Win,
    flight: [0.14, 0.86] as Win,
    approach: [0.8, 1.0] as Win,
  },
  // (network: the region wires first, then the trunks out of it, then the far webs: src/gl/world/layout.ts NET0)
  theirs: { impact: [0.0, 0.14] as Win, cities: [0.06, 0.6] as Win, network: [0.34, 0.98] as Win },
  storm: {
    front: [0.0, 0.24] as Win,
    hit: [0.18, 0.5] as Win,
    field: [0.16, 0.56] as Win,
    aurora: [0.46, 0.96] as Win,
  },
  flock: { rise: [0.0, 0.14] as Win, follow: [0.08, 0.5] as Win, free: [0.5, 0.96] as Win },
  again: { pull: [0.0, 0.48] as Win, stars: [0.28, 0.6] as Win, hover: [0.45, 0.8] as Win },
  sky: { settle: [0.0, 0.32] as Win, line: [0.26, 0.9] as Win },
};

/** Gesture verbs. Every one is optional: untouched, each figure plays out on its own as you scroll. */
export type Verb = "hold" | "drag" | "click" | "move" | "letgo" | "hover";

/**
 * Fig. 9's hold (local k): a push against the storm, answered while the storm blows (src/gl/world/storm.ts: the
 * streaks speed up, the field lines tighten and the aurora brightens with the push until the storm thins away; the
 * field itself is always there, so the push matters well after it has come up on its own).
 */
const STORM_HOLD: Win = [0.14, 0.6];

/**
 * Where the hint ring invites a gesture (local windows); `at` is an anchor id from src/lib/anchors.ts or the cursor.
 * A window covers only where the gesture is answered, visibly and at once: the ring never invites what will not
 * respond (the storm's hold, a push against it, runs while the storm is blowing; the flock's lead starts once it has
 * formed), and it goes at once when its window closes (src/bridges/show-dom.ts). Fig. 7's click is answered a
 * moment past its ring (SYSTEM_T.launchClick), so a click the ring asked for is never lost to the scroll. The owners
 * read their gesture's window from here (storm.ts through HOLDS, flock.ts, system-times.ts).
 */
export const HINTS: { fig: FigureId; verb: Verb; win: Win; at: "cursor" | string }[] = [
  { fig: "point", verb: "hold", win: [0, 0.12], at: "cursor" },
  { fig: "versions", verb: "drag", win: [0.18, 0.7], at: "cursor" },
  { fig: "center", verb: "click", win: [0.14, 0.44], at: "cursor" },
  { fig: "gathering", verb: "drag", win: [0.5, 0.9], at: "cursor" },
  { fig: "alignment", verb: "hold", win: [0.12, 0.6], at: "cursor" },
  { fig: "assist", verb: "click", win: [0.02, 0.22], at: "cursor" },
  { fig: "theirs", verb: "drag", win: [0.5, 0.9], at: "cursor" },
  { fig: "storm", verb: "hold", win: STORM_HOLD, at: "cursor" },
  { fig: "flock", verb: "move", win: [0.16, 0.46], at: "cursor" },
  { fig: "flock", verb: "letgo", win: [0.5, 0.7], at: "cursor" },
  { fig: "again", verb: "hover", win: [0.5, 0.78], at: "cursor" },
  { fig: "sky", verb: "drag", win: [0.4, 0.9], at: "cursor" },
];

/** Local progress of figure `f` at story time T (unclamped: below 0 before it, above 1 after). */
export const figK = (f: FigureId, T: number) => T - F[f];

/**
 * Where a press-and-hold is answered (story time T). Before fig. 1's bang a press gathers the light (only the hold
 * makes the big bang; a click makes a smaller one, and until one of them the first screen's gate holds the page there:
 * src/lib/gate.ts, src/lib/hold.ts); after it only
 * these windows answer a hold, and src/lib/hold.ts starts one only inside them, so the hold ring never fills for
 * nothing and the score's hold voice never sounds for nothing. The owners read their windows from here (genesis,
 * system, storm, flock). Fig. 3's needs a chosen knot (holding speeds its fall); fig. 9's is the push against the
 * storm; fig. 10's gathers the flock.
 */
export const HOLDS = {
  center: [F.center + BEATS.center.choose[0], F.center + 0.9] as Win,
  alignment: [F.alignment + BEATS.alignment.pull[0], F.alignment + BEATS.alignment.pull[1]] as Win,
  storm: [F.storm + STORM_HOLD[0], F.storm + STORM_HOLD[1]] as Win,
  flock: [F.flock + 0.19, F.again + 0.06] as Win,
};

/**
 * What a hold does: nothing, gathers the light (fig. 1), pulls (figs. 3 and 5), pushes back against the storm (9, the
 * field), gathers the flock (10).
 */
export const HOLD_KIND = { none: 0, gather: 1, pull: 2, field: 3, flock: 4 } as const;

/** The hold a press answers at story time T: `banged` once fig. 1's light is let go, `center` fig. 3's chosen knot (-1 none). */
export function holdKind(T: number, banged: boolean, center: number): number {
  if (!banged) return T < F.versions ? HOLD_KIND.gather : HOLD_KIND.none;
  const H = HOLDS;
  if (T > H.center[0] && T < H.center[1]) return center >= 0 ? HOLD_KIND.pull : HOLD_KIND.none;
  if (T >= H.alignment[0] && T <= H.alignment[1]) return HOLD_KIND.pull;
  if (T >= H.storm[0] && T <= H.storm[1]) return HOLD_KIND.field;
  if (T >= H.flock[0] && T <= H.flock[1]) return HOLD_KIND.flock;
  return HOLD_KIND.none;
}
