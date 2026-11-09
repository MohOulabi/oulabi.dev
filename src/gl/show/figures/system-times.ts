/**
 * Story times the planetary system owns (docs/STORY.md figs 4-7), in one leaf module so the system's parts
 * (./system.ts, ./orbits.ts, ./probe.ts, ../poses/system.ts) and the readers outside it (glsl/timeline.ts writes
 * condense and park into GLSL; genesis fades its glow as the camera leaves the overview; the rig dispatches on dive)
 * share them without an import cycle. ./system.ts re-exports SYSTEM_T. Every window derives from journey.ts F, BEATS
 * and HANDOFF.
 */
import { BEATS, F, HANDOFF, HINTS, HOLDS } from "@/lib/journey";

type Win = [number, number];
const at = (f: number, w: readonly [number, number]): Win => [f + w[0], f + w[1]];

const LAUNCH = F.assist + BEATS.assist.countdown[1];
/** Fig. 7's click ring (journey HINTS assist click) closes here; a click is still taken a little after it. */
const CLICK_RING =
  F.assist + (HINTS.find((h) => h.fig === "assist" && h.verb === "click")?.win[1] ?? 0.2);

export const SYSTEM_T = {
  /** Fig. 4: the disk's dust streams along its orbits into the planets and gathers into each ball. */
  condense: at(F.gathering, BEATS.gathering.condense),
  /** The planets materialise grain by grain out of their dust: solid bodies by HANDOFF.PLANETS_SOLID. */
  solid: [HANDOFF.PLANETS_SOLID - 0.2, HANDOFF.PLANETS_SOLID] as Win,
  /** The faint orbit trails come in once the planets are solid; they thin as your point flies and go before the world. */
  orbitsIn: [HANDOFF.PLANETS_SOLID - 0.05, HANDOFF.PLANETS_SOLID + 0.2] as Win,
  orbitsThin: [LAUNCH - 0.1, LAUNCH + 0.12] as Win,
  orbitsOut: [F.assist + 0.6, F.assist + 0.82] as Win,
  /** The drag turns the camera around the system in fig. 4 (HINTS gathering); the turn eases back as fig. 5 begins. */
  drag: [F.gathering + BEATS.gathering.condense[0], F.alignment + 0.1] as Win,
  yawOut: [F.alignment - 0.05, F.alignment + 0.25] as Win,
  /** Fig. 5: the crossing, the hold that deepens the sun's pull, the orbits settling on their own (journey BEATS). */
  cross: at(F.alignment, BEATS.alignment.cross),
  pull: HOLDS.alignment,
  settle: at(F.alignment, BEATS.alignment.settle),
  /** Fig. 6: the planets (and your point) slide onto their marks; on them from HANDOFF.WINDOW_SET. */
  slide: at(F.window, BEATS.window.slide),
  /** Fig. 7: the countdown; the launch by default at its end (a click in it launches then); the flight to the hub. */
  countdown: at(F.assist, BEATS.assist.countdown),
  /**
   * A click launches your point from the countdown's start until a moment past the click ring (a visitor who clicks
   * as the ring asks, still scrolling, is never too late): inside the countdown it launches then; after the default
   * launch it is the default launch, fired by the click (its burn from where the point is).
   */
  launchClick: [F.assist + BEATS.assist.countdown[0], CLICK_RING + 0.08] as Win,
  launch: [LAUNCH, HANDOFF.ARRIVE] as Win,
  /** The camera leaves the overview: it closes in on your point for the launch, rides with it, lands on the approach. */
  dive: [F.window + 0.7, HANDOFF.ARRIVE] as Win,
  /** The genesis motes park on the world's night side as your point falls to it (they hand over to the world). */
  park: [HANDOFF.ARRIVE - 0.3, HANDOFF.ARRIVE + 0.02] as Win,
  /** The world planet cross-fades into the world module's (journey HANDOFF.WORLD_HANDOFF). */
  worldHandoff: HANDOFF.WORLD_HANDOFF,
  /** The other planets step back once the camera is at the world (they would crowd figs 8-10). */
  othersOut: [HANDOFF.ARRIVE + 0.12, HANDOFF.ARRIVE + 0.4] as Win,
  /** At the hub (the first city of fig. 8) your point fades into its light. */
  hub: [HANDOFF.ARRIVE + 0.06, HANDOFF.ARRIVE + 0.2] as Win,
};

/**
 * The bright bodies of figs 4-7 this frame, for the rig's framing (poses/system.ts keeps them clear of the copy):
 * per body x, y, z (world), its radius as it reads on screen (the sun's with its glow, the giant's with its rings),
 * and how present it is (0..1). 0 is the sun, 1..5 the planets (constants.ts PLANETS). Written by figures/system.ts
 * in `pre`, before the rig reads it.
 */
export const BODIES = { n: 6, v: new Float32Array(6 * 5) };
