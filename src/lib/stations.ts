import { FIG_SCREENS, FIGURES, type FigureId } from "./journey";

type StationId = FigureId;

export type Station = { id: StationId; beats: number; screens: number };

/**
 * The show (docs/STORY.md, src/lib/journey.ts): twelve figures scrubbed by natural scroll. Figure i spans story time T
 * in [i, i + 1); T saturates at the last figure while the visitor reads the record below the show (story.after).
 * Beats are scroll markers, never snap points; `screens` is each figure's scroll length in viewport heights.
 */
export const STATIONS: Station[] = FIGURES.map((id) => ({
  id,
  beats: 1,
  screens: FIG_SCREENS[id],
}));

const BEAT_COUNT = STATIONS.reduce((n, s) => n + s.beats, 0);
export const LAST_BEAT = BEAT_COUNT - 1;

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
