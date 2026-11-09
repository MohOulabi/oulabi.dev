/**
 * The score of Gravity, "small wonder": a light film-score theme of wonder, hope and curiosity in D major at 88 bpm,
 * written out (not generative noodling) and arranged along the story. Web Audio only, everything synthesized: no
 * files, no noise beds, no held drones. On by default and started by the visitor's first gesture (./index.ts); built
 * once, then driven by story position P = story.Ts + story.after (figure i spans [i, i + 1); 12.. is the ending) and
 * by what the visitor does (src/lib/hold.ts, shared.play). Nothing here moves the page or the show.
 *
 * The band (every voice articulated and decaying: no voice holds one pitch for more than about 3.5 s, and nothing
 * sounds as a constant bed):
 *  - a celesta: the theme's voice (sine bars with a soft 2nd, a touch of the free bar's 2.76 and a quick 4th: a warm
 *    "ding" that rings ~2 s, never a beep; its highest notes darker and a touch softer, through a low-pass at 3.8 kHz);
 *  - a felt harp: the visitor's voice (every gesture cue): a soft, low plucked string, an octave or two under the theme
 *    (D3 to F#5, mostly D4 to D5), a 16 ms attack with the finger 25 dB under it, six partials of a plucked string
 *    (the low strings the richer, so their pitch carries on a phone's speaker) through a low-pass at 1.6 kHz, quieter
 *    than the theme, so a gesture is answered warmly and never with a twinkle;
 *  - a felt piano: broken chords, and the theme in its second colour (stretched partials, a soft hammer through a
 *    closing low-pass, a two-stage decay, a second string a hair sharp; damped at each chord like a pianist's pedal);
 *  - pizzicato strings: the gentle pulse (a plucked gut wavetable through a fast-closing low-pass, two players);
 *  - string swells: a section that rises and falls inside each chord (a sine² swell to its crest and a cosine² fall
 *    to rest by the next chord, under a vibrato and a low-pass that opens with it), never held across a change;
 *  - a warm low string on each chord change (cello with the bass an octave under, bowed in and let go);
 *  - a felt kick, low and dark, on a few downbeats.
 *
 * The piece. Main progression (8 bars, one chord a bar, a descending bass): D | A/C# | Bm7 | Gmaj7 | D/F# | G | Em7 |
 * Asus4 A. The hook, 4 bars on the celesta (a rising sixth that climbs in sequence, then falls home):
 *   A4 F#5 - E5 D5 E5 | C#5 A5 - G5 F#5 E5 | D5 B5 - A5 F#5 D5 | G5 F#5 E5 D5 -
 * answered by 4 more bars (the first bar again, B4 G5 - F#5 E5 D5, E5 G5 F#5 E5, E5 D5 C#5 -), then a variation
 * phrase (a slow descant), and the theme again. It returns in other colours through the story: the celesta, then the
 * piano, then all together (celesta, piano and strings) at the launch and at the end.
 *
 * The arrangement follows the story continuously, on one beat grid; a section's changes land on its bar lines:
 *   1  the point     before the light is let go, a few soft celesta notes (up to G5) and a low piano note. Hold: a
 *                    rising figure on the harp (D3 to F#5 on the sixteenths, following hold.k) over a string swell,
 *                    then a slow, soft harp tone while it is held full. The bang is the piece's first downbeat: a
 *                    rolled piano chord, a few celesta sparks (A5 down), a string bloom, a felt boom. Then the intro:
 *                    D | Gmaj9/D | D | Asus4, piano in quarters, the hook's first leap heard once as a question.
 *   2  versions      the pulse begins (soft pizzicato), and the celesta tries "versions" of the hook's first cell.
 *   3  the center    anticipation: Bm7 | Gmaj7 | Em7 | Asus4, the pizzicato walks, the swells grow. Choosing a knot:
 *                    a warm piano fifth under a harp tone (the heaviest), or a lighter harp tone. The ignition, on a
 *                    downbeat: a rolled D chord, celesta rising (to A5), a bloom, and the main progression begins.
 *   4  gathering     the hook, first time, on the celesta.
 *   5  alignment     suspended (Gmaj7 | Asus4 | Em7 | Asus4, the leap without its answer) until the orbits align; then
 *                    the hook returns on D at the next bar line.
 *   6  the window    the hook on the piano.
 *   7  assist        the launch: a rising run (harp and pizzicato, D3 to A4) into the next downbeat, then everyone
 *                    together; each slingshot, a harp tone one chord step higher (B3 to E5), the piano under it.
 *   8  first light   together, warm; cities lighting: sparse, soft harp tones of the chord (D4 to D5), spaced out.
 *   9  the storm     a darker variation in B minor (Bm | Gmaj7 | Em7 | F#sus4 F#), the theme low on the piano with the
 *                    cellos, a pulse of low pizzicato and the felt kick. The push (hold): the low strings drive eighths
 *                    on the root and a swell rises with the hold; let go, a soft harp sigh falling through the chord.
 *                    As the field holds, the aurora opens it to Gmaj7 | D/F# | Em7 | Asus4 A, lighter, the celesta.
 *   10 the flock     lighter: the hook on the celesta over staccato pizzicato, no low strings.
 *   11 again         open and wide: the main progression at half speed, the hook in augmentation, more room.
 *                    Hovering a platform star: one harp tone, each star its own tone of the chord (D4 to D5).
 *   12 the sky       the theme all together one last time, resolving to D, then a calm coda (D | Gmaj9/D, the
 *                    hook's first cell now and then). Dragging the sky: a few harp tones on the beats, stepping with
 *                    the drag (B3 to D5, at most four a drag).
 *   ending → record  the bed fades as the record rises; silent in the record (the context sleeps).
 * A visitor who rests hears the section go on calmly (its phrases loop; after a long rest every third phrase leaves
 * the melody out and the band plays a little softer).
 *
 * Gesture cues are in key and on the grid (the next eighth, or the next beat for the ignition and the launch), each
 * tone from the chord sounding at its own eighth (a split bar's second chord, the next bar), on the felt harp under the
 * theme and spaced out (a knot's choice at most once a second, a city every 1.4 s, a star every 1.1 s, a slingshot
 * every 0.5 s, the push's sigh every 2.5 s, the sky's drag on the beats, four a drag); no cue goes above A5. A hold sounds only
 * where a figure answers it (hold.live and journey holdKind, read every frame: a press outside the windows is silent,
 * a scroll out of one lets it go). Fig. 10's hold is silent (the flock answers it). Start over (src/lib/restart.ts,
 * restart() below) gives the music back its arrival: fig. 1 before the bang, every cue listening.
 *
 * Levels (measured offline, ./qa.ts): about -28 dBFS RMS through the main sections at the default volume, peaks
 * under -10 dBFS, a limiter on the master. A lookahead scheduler on the audio clock (the grid's eighths are written
 * 0.2 s ahead from the frame loop, a step whose moment has passed is skipped rather than played late); parameters are
 * written at most every 50 ms and only when they move (./synth.ts Knob); a cap on sounding voices (the oldest
 * accompaniment goes first). Reduced motion keeps the music and shortens the cues' tails. On a touch screen (a small
 * speaker) the master lifts its middle and lightens its lows.
 */
import { shared } from "@/gl/shared";
import { addFrame } from "@/lib/clock";
import { hold, holdNow } from "@/lib/hold";
import { F, HOLD_KIND } from "@/lib/journey";
import { clamp01, smooth } from "@/lib/math";
import { CLICK_BANG } from "@/lib/show";
import { story } from "@/lib/story";
import {
  BASS_WAVE,
  curve,
  db,
  hz,
  impulse,
  Knob,
  noise,
  PIZZ_WAVE,
  STR_WAVE,
  swellCurve,
  wave,
} from "./synth";

// ------------------------------------------------------------------------------------------------ time

const BPM = 88;
const BEAT = 60 / BPM;
const E8 = BEAT / 2;
const E16 = BEAT / 4;
const BAR = BEAT * 4;
/** Seconds between parameter writes. */
const STEP = 0.05;
/** How far ahead the grid is scheduled on the audio clock (s). */
const LOOK = 0.2;
/** How far ahead a cue is scheduled at the least (s): a start in the past would begin partway up its attack. */
const LEAD = 0.03;

/** Calibration (measured, see the QA levels): each instrument's peak at full velocity. */
const PIANO_GAIN = 0.17;
const BELL_GAIN = 0.175;
const HARP_GAIN = 0.09;
const PIZZ_GAIN = 0.2;
const STR_GAIN = 0.07;
const BASS_GAIN = 0.075;
const KICK_GAIN = 0.3;
const FOLLOW_GAIN = 0.06;
/** The master limiter's threshold (dBFS at the default volume): only a rare coincidence of attacks reaches it. */
const LIMIT = -12;
/** The felt piano's partial amplitudes (1st..6th). */
const PARTIALS = [1, 0.6, 0.38, 0.25, 0.16, 0.1];
/**
 * The felt harp's partials above the fundamental (2nd..6th, relative to the 2nd): a plucked string's, rolling off. The
 * 2nd's own level (against the fundamental) falls with pitch (harp()): the low strings are the rich ones, and their
 * 2nd to 4th are what carry the pitch on a small speaker, which plays little of a fundamental under ~450 Hz.
 */
const HARP_PARTIALS = [1, 0.75, 0.52, 0.32, 0.18];
/** Their phases (cycles; Schroeder's, n(n - 1) / 12): spread, so the partials never all crest at once (a softer peak). */
const HARP_PHASE = [1 / 6, 1 / 2, 0, 2 / 3, 1 / 2];

// ------------------------------------------------------------------------------------------------ the harmony

/**
 * A chord: the low string's note at the change, the felt piano's broken-chord voicing (low to high, pv[0] the left
 * hand), the pizzicato's tones (the root first, then its walk), the strings' swell voicing and its pitch classes (the
 * cues pick from them; C 0, C# 1, D 2, E 4, F# 6, G 7, A 9, A# 10, B 11).
 */
type Chord = {
  name: string;
  bass: number;
  pv: readonly number[];
  pz: readonly number[];
  st: readonly number[];
  pcs: readonly number[];
};
const chord = (
  name: string,
  bass: number,
  pv: number[],
  pz: number[],
  st: number[],
  pcs: number[],
): Chord => ({ name, bass, pv, pz, st, pcs });
const CHORDS: readonly Chord[] = [
  chord("D", 50, [50, 57, 62, 64, 66, 69], [50, 57, 62, 57], [62, 66, 69], [2, 6, 9, 4]),
  chord("A/C#", 49, [49, 57, 61, 64, 69, 71], [49, 57, 61, 57], [61, 64, 69], [9, 1, 4, 11]),
  chord("Bm7", 47, [47, 54, 59, 62, 66, 69], [47, 54, 59, 57], [59, 62, 66], [11, 2, 6, 9]),
  chord("Gmaj7", 43, [43, 50, 55, 59, 62, 66], [43, 50, 55, 54], [59, 62, 66], [7, 11, 2, 6]),
  chord("D/F#", 42, [42, 50, 57, 62, 64, 66], [42, 50, 54, 57], [57, 62, 66], [2, 6, 9, 4]),
  chord("G", 43, [43, 50, 57, 59, 62, 67], [43, 50, 55, 59], [59, 62, 67], [7, 11, 2, 9]),
  chord("Em7", 40, [40, 47, 55, 59, 62, 66], [40, 47, 52, 50], [59, 62, 67], [4, 7, 11, 2]),
  chord("Asus4", 45, [45, 52, 57, 62, 64, 69], [45, 52, 57, 50], [57, 62, 64], [9, 2, 4]),
  chord("A", 45, [45, 52, 57, 61, 64, 69], [45, 52, 57, 49], [57, 61, 64], [9, 1, 4]),
  chord("Gmaj9/D", 50, [50, 55, 57, 59, 62, 66], [50, 55, 59, 57], [59, 62, 67], [7, 11, 2, 9, 6]),
  chord("Bm", 47, [47, 54, 59, 62, 66, 71], [47, 54, 59, 54], [59, 62, 66], [11, 2, 6]),
  chord("F#sus4", 42, [42, 49, 54, 59, 61, 66], [42, 49, 54, 49], [59, 61, 66], [6, 11, 1]),
  chord("F#", 42, [42, 49, 54, 58, 61, 66], [42, 49, 54, 58], [58, 61, 66], [6, 10, 1]),
  chord("Gmaj7#11", 43, [43, 50, 57, 59, 61, 66], [43, 50, 55, 57], [59, 61, 66], [7, 11, 1, 6, 2]),
  chord("Dadd9", 50, [50, 57, 64, 66, 69, 74], [50, 57, 62, 57], [62, 66, 69], [2, 6, 9, 4]),
];
const D = 0;
const ACS = 1;
const BM7 = 2;
const GM7 = 3;
const DFS = 4;
const G = 5;
const EM7 = 6;
const ASUS = 7;
const A = 8;
const GD = 9;
const BM = 10;
const FSUS = 11;
const FS = 12;
const GM7S11 = 13;
const DADD9 = 14;

/** The D major scale's pitch classes (the "versions" step along it). */
const SCALE = [2, 4, 6, 7, 9, 11, 1];

type Prog = readonly (readonly number[])[];
/** A bar is one chord, or two (the second from beat 3). */
const MAIN: Prog = [[D], [ACS], [BM7], [GM7], [DFS], [G], [EM7], [ASUS, A]];
const PREP: Prog = [[DADD9], [DADD9], [GD], [DADD9]];
const INTRO: Prog = [[DADD9], [GD], [DADD9], [ASUS]];
const VERS: Prog = [[DADD9], [GD], [BM7], [ASUS]];
const ANTIC: Prog = [[BM7], [GM7], [EM7], [ASUS]];
const SUSP: Prog = [[GM7], [ASUS], [EM7], [ASUS], [GM7], [ASUS], [EM7], [ASUS]];
const STORM: Prog = [[BM], [GM7], [EM7], [FSUS, FS], [BM], [GM7], [EM7], [FS]];
const AURORA: Prog = [[GM7], [DFS], [EM7], [ASUS, A]];
const OPEN: Prog = [
  [D],
  [D],
  [ACS],
  [ACS],
  [BM7],
  [BM7],
  [GM7S11],
  [GM7],
  [DFS],
  [DFS],
  [G],
  [G],
  [EM7],
  [EM7],
  [ASUS],
  [A],
];
const SKY: Prog = [[D], [ACS], [BM7], [GM7], [DFS], [G], [EM7], [ASUS, A], [DADD9], [DADD9]];
const CODA: Prog = [[DADD9], [GD], [DADD9], [GD], [BM7], [GM7], [ASUS], [DADD9]];

// ------------------------------------------------------------------------------------------------ the melodies

/** A melody: per bar, flat triples [beat, MIDI, beats long, ...] (beats 0..4, on the eighths). */
type Mel = readonly (readonly number[])[];
/** The theme: the hook (bars 1-4) and its answer (5-8), over MAIN. */
const MEL_A: Mel = [
  [0, 69, 0.5, 0.5, 78, 1.5, 2, 76, 0.5, 2.5, 74, 0.5, 3, 76, 1],
  [0, 73, 0.5, 0.5, 81, 1.5, 2, 79, 0.5, 2.5, 78, 0.5, 3, 76, 1],
  [0, 74, 0.5, 0.5, 83, 1.5, 2, 81, 0.5, 2.5, 78, 0.5, 3, 74, 1],
  [0, 79, 1, 1, 78, 0.5, 1.5, 76, 0.5, 2, 74, 2],
  [0, 69, 0.5, 0.5, 78, 1.5, 2, 76, 0.5, 2.5, 74, 0.5, 3, 76, 1],
  [0, 71, 0.5, 0.5, 79, 1.5, 2, 78, 0.5, 2.5, 76, 0.5, 3, 74, 1],
  [0, 76, 1, 1, 79, 1, 2, 78, 1, 3, 76, 1],
  [0, 76, 1, 1, 74, 1, 2, 73, 2],
];
/** The variation: a slow descant over MAIN, the hook's leap recalled twice. */
const MEL_B: Mel = [
  [0, 78, 2, 2, 76, 1, 3, 74, 1],
  [0, 76, 3, 3, 73, 1],
  [0, 74, 2, 2, 73, 1, 3, 71, 1],
  [0, 71, 2, 2, 69, 2],
  [0, 69, 0.5, 0.5, 78, 1.5, 2, 76, 2],
  [0, 71, 0.5, 0.5, 79, 1.5, 2, 78, 2],
  [0, 79, 1, 1, 78, 1, 2, 76, 1, 3, 74, 1],
  [0, 76, 2, 2, 73, 2],
];
/** Fig. 5 before the orbits align: the leap without its answer, over SUSP. */
const MEL_SUS: Mel = [
  [0, 71, 0.5, 0.5, 79, 1.5, 2, 78, 0.5, 2.5, 76, 1.5],
  [0, 74, 2, 2, 76, 2],
  [0, 67, 0.5, 0.5, 76, 1.5, 2, 74, 0.5, 2.5, 71, 1.5],
  [0, 69, 2, 2, 74, 2],
  [0, 71, 0.5, 0.5, 79, 1.5, 2, 78, 0.5, 2.5, 76, 1.5],
  [0, 74, 2, 2, 76, 2],
  [0, 67, 0.5, 0.5, 76, 1.5, 2, 79, 1, 3, 78, 1],
  [0, 76, 4],
];
/** Fig. 9: the theme in B minor, a minor sixth for a sixth, over STORM. */
const MEL_STORM: Mel = [
  [0, 66, 0.5, 0.5, 74, 1.5, 2, 73, 0.5, 2.5, 71, 0.5, 3, 73, 1],
  [0, 71, 2, 2, 66, 2],
  [0, 67, 0.5, 0.5, 76, 1.5, 2, 74, 0.5, 2.5, 71, 0.5, 3, 74, 1],
  [0, 73, 1, 1, 71, 1, 2, 70, 2],
  [0, 66, 0.5, 0.5, 74, 1.5, 2, 73, 0.5, 2.5, 71, 0.5, 3, 73, 1],
  [0, 71, 0.5, 0.5, 79, 1.5, 2, 78, 0.5, 2.5, 76, 0.5, 3, 74, 1],
  [0, 79, 1, 1, 78, 0.5, 1.5, 76, 0.5, 2, 74, 1, 3, 73, 1],
  [0, 73, 2, 2, 70, 2],
];
/** Fig. 9 as the field holds: the hook opened out, over AURORA. */
const MEL_AURORA: Mel = [
  [0, 71, 0.5, 0.5, 79, 1.5, 2, 78, 0.5, 2.5, 74, 0.5, 3, 78, 1],
  [0, 69, 0.5, 0.5, 78, 1.5, 2, 76, 0.5, 2.5, 74, 0.5, 3, 76, 1],
  [0, 79, 1, 1, 78, 0.5, 1.5, 76, 0.5, 2, 74, 1, 3, 71, 1],
  [0, 76, 1, 1, 74, 1, 2, 73, 2],
];
/** Fig. 12: the theme, then home (a long D). */
const MEL_SKY: Mel = [...MEL_A, [0, 74, 4], []];
/** Fig. 1 after the bang: the hook's first leap, heard as a question (two versions, over INTRO). */
const SEED1: Mel = [[], [], [0, 69, 0.5, 0.5, 78, 3.5], []];
const SEED2: Mel = [[], [], [0, 69, 0.5, 0.5, 78, 1.5, 2, 76, 0.5, 2.5, 74, 1.5], []];
/** Fig. 3 before the ignition: a rising fifth, unanswered. */
const ANTIC_MEL: Mel = [[], [], [], [0, 69, 0.5, 0.5, 76, 1.5, 2, 74, 2]];
/** The coda under the sky: the hook's first cell, then home. */
const CODA_MEL: Mel = [
  [],
  [],
  [0, 69, 0.5, 0.5, 78, 1.5, 2, 76, 0.5, 2.5, 74, 1.5],
  [],
  [],
  [0, 71, 0.5, 0.5, 79, 1.5, 2, 78, 2],
  [],
  [0, 74, 4],
];

/** "Versions" (fig. 2): rhythms for the hook's first cell, as [beat, beats long] pairs. */
const CELLS: readonly (readonly number[])[] = [
  [0, 0.5, 0.5, 1.5, 2, 0.5, 2.5, 0.5, 3, 1],
  [0, 0.5, 0.5, 1, 1.5, 0.5, 2, 2],
  [1, 0.5, 1.5, 1.5, 3, 1],
  [0, 1, 1, 0.5, 1.5, 0.5, 2, 2],
];
const LEAPS = [9, 7, 5, 8];

// ------------------------------------------------------------------------------------------------ the patterns

/** Eight eighths a bar: an index into the chord's voicing (piano pv, pizzicato pz), or -1 for a rest. */
type Pat = readonly number[];
const P_PRE: Pat = [0, -1, -1, -1, -1, -1, -1, -1];
const P_INTRO: Pat = [0, -1, 3, -1, 4, -1, 2, -1];
const P_VERS: Pat = [0, -1, 2, 3, 4, -1, 3, -1];
const P_FULL: Pat = [0, 2, 3, 4, 5, 4, 3, 2];
const P_UNDER: Pat = [0, -1, 1, -1, 2, -1, 1, -1];
const P_STORM: Pat = [0, 1, 2, 1, 3, 1, 2, 1];
const P_LIGHT: Pat = [0, -1, 4, 3, -1, 5, 4, -1];
const P_OPEN: Pat = [0, -1, 2, -1, 5, -1, 3, -1];
const P_CODA: Pat = [0, -1, -1, 3, 4, -1, 2, -1];
const Z_Q: Pat = [0, -1, 1, -1, 2, -1, 1, -1];
const Z_LIGHT: Pat = [0, -1, -1, -1, 2, -1, -1, -1];
const Z_8: Pat = [0, -1, 1, 2, -1, 1, 2, 3];
const Z_STORM: Pat = [0, -1, 0, 1, -1, 0, 2, 1];
const K_ONE: Pat = [1, -1, -1, -1, -1, -1, -1, -1];
const K_TWO: Pat = [1, -1, -1, -1, 1, -1, -1, -1];

// the theme's colours
const M_BELL = 1;
const M_PIANO = 2;
const M_TUTTI = 3;
const M_STORM = 4;
const M_DUO = 5;

/**
 * A section of the arrangement: its family (moving to another family starts the new one's phrase from its top at the
 * next bar line; within a family the phrase carries on and only the colours change), progression, melody cycle (one
 * phrase each; null: none) and colour, and each instrument's pattern and level. `gen`: 1 twinkles (fig. 1 before the
 * light is let go), 2 versions (fig. 2). `aug`: the melody at half speed (two bars to each of its bars).
 */
type Sec = {
  name: string;
  fam: number;
  prog: Prog;
  mel: readonly (Mel | null)[];
  aug?: boolean;
  inst: number;
  mv: number;
  pp: Pat | null;
  pv: number;
  zp: Pat | null;
  zv: number;
  bv: number;
  bEvery: number;
  sv: number;
  sEvery: number;
  bright: number;
  kp: Pat | null;
  kv: number;
  gain: number;
  wet: number;
  gen?: number;
};
const sec = (s: Partial<Sec> & { name: string; fam: number; prog: Prog }): Sec => ({
  mel: [null],
  inst: M_BELL,
  mv: 0.5,
  pp: null,
  pv: 0.3,
  zp: null,
  zv: 0.4,
  bv: 0,
  bEvery: 1,
  sv: 0,
  sEvery: 1,
  bright: 0.5,
  kp: null,
  kv: 0.4,
  gain: 0,
  wet: 1,
  ...s,
});
const S_PRE = sec({
  name: "before the light",
  fam: 0,
  prog: PREP,
  pp: P_PRE,
  pv: 0.2,
  gain: -5,
  gen: 1,
  wet: 1.2,
});
const S_INTRO = sec({
  name: "intro",
  fam: 1,
  prog: INTRO,
  mel: [null, SEED1, null, SEED2],
  mv: 0.4,
  pp: P_INTRO,
  pv: 0.3,
  sv: 0.3,
  sEvery: 4,
  gain: -2.5,
  wet: 1.15,
});
const S_VERS = sec({
  name: "versions",
  fam: 1,
  prog: VERS,
  gen: 2,
  mv: 0.34,
  pp: P_VERS,
  pv: 0.29,
  zp: Z_LIGHT,
  zv: 0.32,
  bv: 0.28,
  bEvery: 2,
  sv: 0.32,
  sEvery: 2,
  gain: -1.5,
});
const S_ANTIC = sec({
  name: "the center",
  fam: 2,
  prog: ANTIC,
  mel: [null, ANTIC_MEL],
  mv: 0.4,
  pp: P_VERS,
  pv: 0.3,
  zp: Z_Q,
  zv: 0.38,
  bv: 0.4,
  sv: 0.45,
  bright: 0.4,
  gain: -2,
});
const S_BUILD = sec({
  name: "the build",
  fam: 3,
  prog: MAIN,
  pp: P_FULL,
  pv: 0.3,
  zp: Z_Q,
  zv: 0.44,
  bv: 0.5,
  sv: 0.55,
  bright: 0.6,
  kp: K_ONE,
  kv: 0.4,
  gain: -1,
});
const S_FULL = sec({
  name: "the theme (celesta)",
  fam: 4,
  prog: MAIN,
  mel: [MEL_A, MEL_B],
  mv: 0.58,
  pp: P_FULL,
  pv: 0.27,
  zp: Z_Q,
  zv: 0.42,
  bv: 0.5,
  sv: 0.42,
  sEvery: 2,
  gain: -1.5,
});
const S_SUS = sec({
  name: "suspended",
  fam: 5,
  prog: SUSP,
  mel: [MEL_SUS],
  mv: 0.54,
  pp: P_FULL,
  pv: 0.27,
  zp: Z_Q,
  zv: 0.38,
  bv: 0.45,
  sv: 0.5,
  bright: 0.45,
  gain: -1,
});
const S_PIANO = sec({
  name: "the theme (piano)",
  fam: 4,
  prog: MAIN,
  mel: [MEL_A, MEL_B],
  inst: M_PIANO,
  mv: 0.44,
  pp: P_UNDER,
  pv: 0.3,
  zp: Z_Q,
  zv: 0.42,
  bv: 0.5,
  sv: 0.48,
  sEvery: 2,
  gain: -1.5,
});
const S_TUTTI = sec({
  name: "the theme (together)",
  fam: 4,
  prog: MAIN,
  mel: [MEL_A, MEL_B],
  inst: M_TUTTI,
  mv: 0.56,
  pp: P_UNDER,
  pv: 0.28,
  zp: Z_Q,
  zv: 0.46,
  bv: 0.55,
  sv: 0.55,
  bright: 0.65,
  kp: K_ONE,
  kv: 0.26,
  gain: -3,
});
const S_THEIRS = sec({
  name: "first light",
  fam: 4,
  prog: MAIN,
  mel: [MEL_A, MEL_B],
  inst: M_DUO,
  mv: 0.5,
  pp: P_FULL,
  pv: 0.25,
  zp: Z_Q,
  zv: 0.4,
  bv: 0.5,
  sv: 0.45,
  sEvery: 2,
  gain: -1.3,
});
const S_STORM = sec({
  name: "the storm",
  fam: 6,
  prog: STORM,
  mel: [MEL_STORM],
  inst: M_STORM,
  mv: 0.46,
  pp: P_STORM,
  pv: 0.22,
  zp: Z_STORM,
  zv: 0.4,
  bv: 0.55,
  sv: 0.48,
  bright: 0.25,
  kp: K_TWO,
  kv: 0.36,
  gain: -1.8,
  wet: 1.1,
});
const S_AURORA = sec({
  name: "the aurora",
  fam: 7,
  prog: AURORA,
  mel: [MEL_AURORA, null],
  mv: 0.52,
  pp: P_LIGHT,
  pv: 0.27,
  zp: Z_LIGHT,
  zv: 0.34,
  bv: 0.4,
  sv: 0.5,
  bright: 0.75,
  gain: -1,
  wet: 1.25,
});
const S_LIGHT = sec({
  name: "the flock",
  fam: 8,
  prog: MAIN,
  mel: [MEL_A, MEL_B],
  mv: 0.5,
  pp: P_LIGHT,
  pv: 0.26,
  zp: Z_8,
  zv: 0.34,
  bv: 0.34,
  bEvery: 2,
  gain: -2,
});
const S_OPEN = sec({
  name: "again (open)",
  fam: 9,
  prog: OPEN,
  mel: [MEL_A, null],
  aug: true,
  mv: 0.5,
  pp: P_OPEN,
  pv: 0.3,
  bv: 0.38,
  sv: 0.42,
  bright: 0.55,
  gain: -2,
  wet: 1.4,
});
const S_SKY = sec({
  name: "the sky",
  fam: 10,
  prog: SKY,
  mel: [MEL_SKY],
  inst: M_TUTTI,
  mv: 0.48,
  pp: P_UNDER,
  pv: 0.27,
  zp: Z_Q,
  zv: 0.36,
  bv: 0.5,
  sv: 0.5,
  bright: 0.55,
  gain: -1.5,
  wet: 1.25,
});
const S_CODA = sec({
  name: "coda",
  fam: 11,
  prog: CODA,
  mel: [CODA_MEL, null],
  mv: 0.4,
  pp: P_CODA,
  pv: 0.27,
  bv: 0.3,
  bEvery: 2,
  sv: 0.3,
  sEvery: 2,
  gain: -4,
  wet: 1.3,
});

/** The bed over P: in from the first gesture, fading as the record rises over the sky (ending e = P - 12). */
const BED = [0, 1, 12.45, 1, 12.75, 0.55, 13.15, 0];

// ------------------------------------------------------------------------------------------------ the gestures

/** journey HOLD_KIND → the hold's voice: nothing, gather (fig. 1), pull (figs. 3, 5), field (fig. 9's push). */
const H_NONE = 0;
const H_GATHER = 1;
const H_PULL = 2;
const H_FIELD = 3;
const H_OF_KIND: Record<number, number> = {
  [HOLD_KIND.none]: H_NONE,
  [HOLD_KIND.gather]: H_GATHER,
  [HOLD_KIND.pull]: H_PULL,
  [HOLD_KIND.field]: H_FIELD,
  [HOLD_KIND.flock]: H_NONE,
};
/**
 * Fig. 9: the field holds the storm. The field is there from the storm's arrival at about half and strengthens on its
 * own, reaching this as the aurora pours in (about BEATS.storm.aurora's start, src/gl/world/layout.ts fieldRestAt);
 * a push against the storm takes it there sooner. The storm's dark phrase plays until then.
 */
const FIELD_HOLDS = 0.92;
/**
 * Fig. 1's rising figure on the harp (D3 to F#5 on the sixteenths, as hold.k fills), the string chord that swells
 * under it, and the slow tone at its top while it is held full (every other beat, softer each time).
 */
const RISE = [50, 54, 57, 62, 66, 69, 71, 74, 78];
const RISE_SWELL = [62, 66, 69];
const TOP = [69, 74, 71, 66];
/** The rising figure's level against the other cues (it is many notes close together: kept under the theme). */
const RISE_LV = 0.8;
/** Fig. 12: the sky takes drags from here (gl/show/figures/sky.ts SKY_T.dragFrom: the descent's end, F.sky + 0.1, less 0.03). */
const SKY_DRAG_FROM = F.sky + 0.07;
/** Cue notes waiting for their eighth (the grid is written ahead: a cue's tones come from the chord at its own eighth). */
const QUEUE = 16;

/** The instruments (QA: the held-pitch log names them). */
const I_PIANO = 0;
const I_BELL = 1;
const I_PIZZ = 2;
const I_STR = 3;
const I_BASS = 4;
const I_KICK = 5;
const I_HARP = 6;
export const INST_NAMES = [
  "piano",
  "celesta",
  "pizzicato",
  "strings",
  "low strings",
  "kick",
  "harp",
] as const;

/** A sounding voice: its output, when it ends, its sources, instrument, kind (K_*), pitch, start, accompaniment. */
type Voice = {
  out: GainNode;
  end: number;
  srcs: AudioScheduledSourceNode[];
  inst: number;
  kind: number;
  m: number;
  t: number;
  acc: boolean;
  log: number;
  /** Already let go (its output is gliding to silence). */
  rel: boolean;
};
const K_GEN = 0;
const K_BANG = 1;
const K_RISE = 2;
const K_KNOT = 3;
const K_IGNITE = 4;
const K_LAUNCH = 5;
const K_FLYBY = 6;
const K_CITY = 7;
const K_PULL = 8;
const K_PUSH = 9;
const K_STAR = 10;
const K_SKY = 11;
/** Voice kinds (QA counts): the arrangement, then the gesture cues. */
export const CUE_NAMES = [
  "note",
  "bang",
  "rise",
  "knot",
  "ignite",
  "launch",
  "flyby",
  "city",
  "pull",
  "push",
  "star",
  "sky",
] as const;
export type CueName = (typeof CUE_NAMES)[number];

/** Volume slider (0..1, 0.5 default) → master gain: 0 dB at the default, ±7.8 dB at a quarter and at the top. */
const volumeGain = (v: number) => (v <= 0.001 ? 0 : (2 * Math.min(1, v)) ** 1.3);

const rand = (a: number, b: number) => a + (b - a) * Math.random();
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const inPcs = (pcs: readonly number[], m: number) => pcs.indexOf(pcOf(m)) >= 0;

/** Has the page had a user activation yet (so a resume can succeed)? Where the browser cannot say, assume so. */
const activated = () =>
  typeof navigator === "undefined" ||
  (navigator as { userActivation?: UserActivation }).userActivation?.hasBeenActive !== false;

/**
 * How the score is built. `lite`: fewer partials, fewer voices at once, a smaller room (phones, few cores, the low
 * tier). `phone`: a small speaker (a touch screen): the master lifts its middle and lightens its lows. `deferRoom`:
 * the room's impulse is left for room() (the page builds the score in idle steps).
 */
export type ScoreOptions = {
  lite?: boolean;
  phone?: boolean;
  deferRoom?: boolean;
  /** QA: only this instrument sounds (INST_NAMES index), and/or no room (to measure each part and its cost). */
  only?: number;
  noRoom?: boolean;
};

function device() {
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8;
  const low =
    shared.tier === "low" ||
    (typeof location !== "undefined" && /[?&]q=low\b/.test(location.search));
  return { lite: coarse || cores <= 4 || low, phone: coarse };
}

/** The follow swell under a hold: a string chord whose level follows hold.k, fading once the hold is full. */
type Follow = {
  out: GainNode;
  k: Knob;
  srcs: OscillatorNode[];
  at: number;
  topAt: number;
  log: number;
};

export class Score {
  readonly ctx: AudioContext;
  private readonly lite: boolean;
  private readonly phone: boolean;
  private readonly maxVoices: number;
  private readonly only: number;
  /** Post-limiter output (the QA meter taps it). */
  readonly tap: GainNode;
  /** Voices started per kind, and chord changes (QA). */
  readonly counts = new Int32Array(CUE_NAMES.length);
  chordChanges = 0;
  /** QA, offline: the chord changes of a render ([time, chord]) and every voice's held time (flat [t, m, inst, s]). */
  readonly qaChords: [number, string][] = [];
  readonly qaLog: number[] = [];
  /** QA, offline: each chord as it starts sounding [t, chord, ...], and each harp note [t, MIDI, cue, sixteenths]. */
  readonly qaChordLine: number[] = [];
  readonly qaHarp: number[] = [];
  readonly qaSections: [number, string][] = [];
  /** QA, offline: voices that have ended, waiting for the render to pass their end (qaGc). */
  private qaEnded: Voice[] = [];

  private master: GainNode;
  private verbIn: GainNode;
  private verb: ConvolverNode;
  private roomBuilt = false;
  private pianoIn: GainNode;
  private bellIn: GainNode;
  private pizzIn: GainNode;
  private strIn: GainNode;
  private bassIn: GainNode;
  private kickIn: GainNode;
  private harpIn: GainNode;
  private wPizz: PeriodicWave;
  private wStr: PeriodicWave;
  private wBass: PeriodicWave;
  private noiseBuf: AudioBuffer | null = null;
  private swellC = swellCurve(96, 0.45);
  private noteC = swellCurve(64, 0.22);

  private k: Record<string, Knob> = {};
  private voices: Voice[] = [];
  private unFrame: (() => void) | null = null;
  private acc = 0;
  private snapNext = true;
  private volume = 0.5;
  private want = false;
  private hidden = false;
  private sleeping = false;
  private suspendTimer = 0;
  private napTimer = 0;
  private quietFor = 0;
  /** How long the frame loop has found the clock stopped (s). */
  private stalled = 0;
  private solo = false;
  /** QA: an offline render runs on a virtual clock (vt), stepped ahead before the audio is rendered. */
  private virtual = false;
  private vt = 0;
  private qaPost = false;

  // ---- the grid: eighth i sounds at t0 + i E8; a bar starts every 8 eighths, or where a cue forces one (on a beat)
  private gridOn = false;
  private t0 = 0;
  private si = 0;
  private barStart = 0;
  private forceBarAt = -1;
  private cueBarAt = -1;
  private cueBar = false;
  private restartNext = true;
  // ---- the conductor
  private sec: Sec = S_PRE;
  private bar = 0;
  private phrase = 0;
  private chA = DADD9;
  private chB = -1;
  private melBar: readonly number[] | null = null;
  private melLen = 0;
  private melAug = false;
  private melHalf = 0;
  private barAmp = 0;
  private skyDone = false;
  private lastChord = -1;
  private melPiano: Voice | null = null;
  private genMel = new Array<number>(15).fill(0);
  private lastTwinkle = -1;

  // ---- edge detection (what was true last frame)
  private lastBang = -1;
  private lastCenter = -1;
  private lastBy = false;
  private lastSun = 0;
  private lastLaunch = -1;
  private lastFlybys = 0;
  private lastCities = 0;
  private lastStar = "";
  // ---- the hold
  private holdOn = false;
  private holdMode = H_NONE;
  private follow: Follow | null = null;
  private riseT = 0;
  private riseIdx = -1;
  private topN = 0;
  // ---- the cues' memory and rate limits (audio clock, s)
  private at = new Float64Array(CUE_NAMES.length).fill(-1e9);
  private starTimes = new Float64Array(64).fill(-1e9);
  private lastStarNote = -1;
  private lastCityNote = -1;
  private cityGap = 1;
  private cityN = 0;
  private sighAt = -1e9;
  private flyM = 59;
  private dragM = 66;
  private dragN = 0;
  private dragLast = -1e9;
  private knotWant = -1;
  private knotLast = -1;
  private sighM = 76;
  // the bar before the one being written (a cue on an eighth already written may fall in it)
  private prevA = DADD9;
  private prevB = -1;
  private prevStart = -8;
  private qK = new Int8Array(QUEUE).fill(-1);
  private qS = new Int32Array(QUEUE);
  private qA = new Float64Array(QUEUE);
  private qB = new Float64Array(QUEUE);

  constructor(ctx: AudioContext, opts: ScoreOptions = {}) {
    this.ctx = ctx;
    const dev = device();
    this.lite = opts.lite ?? dev.lite;
    this.phone = opts.phone ?? dev.phone;
    this.maxVoices = this.lite ? 16 : 24;
    this.only = opts.only ?? -1;
    const t = ctx.currentTime;
    this.wPizz = wave(ctx, PIZZ_WAVE);
    this.wStr = wave(ctx, STR_WAVE);
    this.wBass = wave(ctx, BASS_WAVE);

    // ---- master: the band → dry + the generated room → (a small speaker's EQ) → limiter → volume × fade
    const mix = ctx.createGain();
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, t);
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.setValueAtTime(LIMIT, t);
    lim.knee.setValueAtTime(1, t);
    lim.ratio.setValueAtTime(20, t);
    lim.attack.setValueAtTime(0.001, t);
    lim.release.setValueAtTime(0.2, t);
    // a DynamicsCompressor adds its own makeup gain ((1 / its gain at 0 dBFS) ^ 0.6: +6.8 dB here); taken back out, so
    // it leaves everything under its threshold as it is and only holds the rare peak above it, at the default volume
    // (the volume and the fades come after it)
    const unmake = ctx.createGain();
    unmake.gain.setValueAtTime(db(0.6 * (LIMIT - LIMIT / 20)), t);
    this.tap = ctx.createGain();
    let pre: AudioNode = mix;
    if (this.phone) {
      // a phone's speaker plays little below ~300 Hz: less of what it cannot play, a little more of the middle it can
      const lows = ctx.createBiquadFilter();
      lows.type = "lowshelf";
      lows.frequency.setValueAtTime(140, t);
      lows.gain.setValueAtTime(-5, t);
      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.setValueAtTime(720, t);
      mid.Q.setValueAtTime(0.7, t);
      mid.gain.setValueAtTime(3, t);
      pre = pre.connect(lows).connect(mid);
    }
    pre
      .connect(lim)
      .connect(unmake)
      .connect(this.master)
      .connect(this.tap)
      .connect(ctx.destination);

    // the room: long, soft and dark (the largest single cost of the score, so the low tier gets a smaller one; its
    // impulse can be left for room(), so the page builds the score in two short idle steps)
    this.verb = ctx.createConvolver();
    this.verbIn = ctx.createGain();
    const verbOut = ctx.createGain();
    verbOut.gain.setValueAtTime(this.lite ? 0.55 : 0.75, t);
    this.verbIn.connect(this.verb).connect(verbOut).connect(mix);
    if (opts.noRoom) this.roomBuilt = true;
    else if (!opts.deferRoom) this.room();
    this.k.wet = new Knob(this.verbIn.gain, 0.01);

    // ---- each instrument's bus: its colour, dry to the mix, its share of the room
    const bus = (wet: number, ...fx: AudioNode[]) => {
      const g = ctx.createGain();
      let last: AudioNode = g;
      for (const f of fx) last = last.connect(f);
      last.connect(mix);
      const s = ctx.createGain();
      s.gain.setValueAtTime(wet, t);
      last.connect(s).connect(this.verbIn);
      return g;
    };
    const filter = (type: BiquadFilterType, f: number, q: number, gain = 0) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.setValueAtTime(f, t);
      b.Q.setValueAtTime(q, t);
      b.gain.setValueAtTime(gain, t);
      return b;
    };
    // the piano: a warm body, a softened top
    this.pianoIn = bus(0.34, filter("peaking", 220, 0.8, 1.5), filter("highshelf", 2400, 0.7, -6));
    // the celesta: its bars' sparkle kept under 3.8 kHz, a little less 3 kHz (warm, not glassy)
    this.bellIn = bus(0.55, filter("lowpass", 3800, 0.5), filter("peaking", 3000, 1, -3));
    this.pizzIn = bus(0.3, filter("highshelf", 2000, 0.7, -4));
    this.strIn = bus(0.5, filter("peaking", 350, 0.8, 1));
    this.bassIn = bus(0.16, filter("lowpass", 700, 0.6));
    this.kickIn = bus(0.06, filter("lowpass", 240, 0.6));
    // the felt harp (the gestures): a little low-pass, a little body, more of the room than the theme (it sits behind)
    this.harpIn = bus(0.62, filter("lowpass", 1600, 0.5), filter("peaking", 280, 0.8, 1.5));
  }

  /** The room's impulse (if the constructor left it): about 10 ms of main thread, once. */
  room() {
    if (this.roomBuilt) return;
    this.roomBuilt = true;
    this.verb.buffer = this.lite ? impulse(this.ctx, 2.4, 2.1) : impulse(this.ctx, 3.6, 3.2);
  }

  /** Start from what has already happened: a cue sounds only for what happens while the score listens. */
  private resync() {
    const play = shared.play;
    this.lastBang = hold.bangAt;
    this.lastCenter = play.center;
    this.lastBy = play.centerByVisitor;
    this.lastSun = shared.sunOn;
    this.lastLaunch = play.launchT;
    this.lastFlybys = play.flybys;
    this.lastCities = play.cities;
    this.lastStar = play.hoverStar;
    this.knotWant = -1;
    // (a hold already under way when the sound started rises from the next frame, where a figure answers it)
    this.holdOn = false;
    this.holdMode = H_NONE;
  }

  /** The grid's eighth `i` (audio clock). */
  private stepTime(i: number) {
    return this.t0 + i * E8;
  }

  /** Start the grid at `t`, with a new bar (and its section's phrase from the top) there. */
  private anchor(t: number) {
    this.gridOn = true;
    this.t0 = t;
    this.si = 0;
    this.barStart = 0;
    this.prevStart = -8;
    this.prevA = this.chA;
    this.prevB = this.chB;
    // (cue notes waiting on the old grid's eighths are let go)
    this.qK.fill(-1);
    this.forceBarAt = 0;
    this.cueBarAt = -1;
    this.restartNext = true;
  }

  /**
   * Start over (src/lib/restart.ts: in the dark of the cut, after the hold and the outcomes are re-armed): the music
   * as on arrival, fig. 1 before the bang, and every cue listening again. The switch and the volume stay as chosen.
   */
  restart() {
    const now = this.now();
    this.resync();
    this.followEnd(now, 0.2);
    // whatever still rings is let go under the cut
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (v.end > now + 0.4) this.release(v, Math.max(now, v.t), 0.3);
    }
    this.sec = S_PRE;
    this.skyDone = false;
    this.melPiano = null;
    this.anchor(now + 0.4);
    this.at.fill(-1e9);
    this.starTimes.fill(-1e9);
    this.lastStarNote = -1;
    this.lastCityNote = -1;
    this.cityN = 0;
    this.sighAt = -1e9;
    this.flyM = 59;
    this.dragM = 66;
    this.dragN = 0;
    this.knotWant = -1;
    this.knotLast = -1;
    this.sighM = 76;
  }

  // ------------------------------------------------------------------------------------------------ lifecycle

  /**
   * Start (the visitor's first gesture), come back on (the switch) or come back (a shown tab): fade in from wherever
   * the story is. `tc` is the fade's time constant: slow for the first start, so the music rises with the hold.
   */
  fadeIn(volume: number, tc = 0.45) {
    this.volume = volume;
    this.want = true;
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = 0;
    if (!this.unFrame) {
      this.resync();
      this.snapNext = true;
      this.acc = STEP;
      this.anchor(this.now() + 0.12);
      // on a touch screen the first gesture the browser accepts is the release, which is also the bang: answer it
      if (
        hold.bangAt >= 0 &&
        performance.now() - hold.bangAt < 900 &&
        story.Ts + story.after < 1.05
      )
        this.bangCue();
      this.unFrame = addFrame((_t, dt) => this.frame(dt), 40);
    }
    this.wakeUp();
    this.applyMaster(tc);
  }

  /** Turn off: fade out over 0.6 s, then the context sleeps and the score stops listening. */
  fadeOut() {
    this.want = false;
    const p = this.master.gain;
    const now = this.ctx.currentTime;
    const v = p.value;
    p.cancelScheduledValues(now);
    p.setValueAtTime(v, now);
    // an exponential fall over 0.6 s (-20 dB by 0.3 s), then a last short ramp to silence: it answers the click at
    // once and never sounds cut
    p.setTargetAtTime(0, now, 0.13);
    p.setValueAtTime(v * Math.exp(-0.6 / 0.13), now + 0.6);
    p.linearRampToValueAtTime(0, now + 0.66);
    this.sleepIn(900, true);
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.want) this.applyMaster(0.05);
  }

  /** The tab was hidden or shown. */
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!this.want) return;
    if (hidden) {
      this.applyMaster(0.08);
      this.sleepIn(350, false);
    } else {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = 0;
      this.wakeUp();
      this.applyMaster(0.3);
    }
  }

  /** QA: main-thread time spent by the score (frame callbacks), when timing is on. */
  timing = false;
  cpuMs = 0;
  frames = 0;

  /** QA: what the score is doing. */
  qaInfo() {
    return {
      section: this.sec.name,
      bar: this.bar,
      phrase: this.phrase,
      chord: CHORDS[this.chB >= 0 && this.si - this.barStart >= 4 ? this.chB : this.chA].name,
      holdMode: this.holdOn ? this.holdMode : H_NONE,
      voices: this.voices.length,
      chordChanges: this.chordChanges,
      sleeping: this.sleeping,
      msPerFrame: this.frames ? this.cpuMs / this.frames : 0,
      frames: this.frames,
    };
  }

  /** QA, offline: the longest any one voice held one pitch (above -20 dB of its own peak), and which. */
  qaHeld() {
    const L = this.qaLog;
    let best = 0;
    let at = 0;
    let m = 0;
    let inst = 0;
    for (let i = 0; i < L.length; i += 4) {
      if (L[i + 3] > best) {
        best = L[i + 3];
        at = L[i];
        m = L[i + 1];
        inst = L[i + 2];
      }
    }
    return {
      seconds: Math.round(best * 100) / 100,
      at: Math.round(at * 10) / 10,
      midi: m,
      instrument: INST_NAMES[inst],
      voices: L.length / 4,
    };
  }

  /**
   * QA, offline: the harp's notes (the gesture cues) against the chord sounding at each one's own time: how many are
   * not a tone of it, and how many sit a semitone from one of its tones (a clash), besides the rise's and the launch's
   * scale figures (their passing tones are written so); how many fell in the second chord of a split bar; and the
   * largest distance from the grid's sixteenths (ms).
   */
  qaKey() {
    const H = this.qaHarp;
    const L = this.qaChordLine;
    let n = 0;
    let notTone = 0;
    let clash = 0;
    let split = 0;
    let grid = 0;
    const list: string[] = [];
    for (let i = 0; i < H.length; i += 4) {
      const t = H[i];
      const m = H[i + 1];
      const kind = H[i + 2];
      grid = Math.max(grid, Math.abs(H[i + 3] - Math.round(H[i + 3])) * E16 * 1000);
      if (kind === K_RISE || kind === K_LAUNCH) continue;
      let c = -1;
      let at = 0;
      for (let j = 0; j < L.length && L[j] <= t + 1e-4; j += 2) {
        c = L[j + 1];
        at = L[j];
      }
      if (c < 0) continue;
      n++;
      if (c === A || c === FS) split++;
      const pcs = CHORDS[c].pcs;
      if (inPcs(pcs, m)) continue;
      notTone++;
      if (inPcs(pcs, m + 1) || inPcs(pcs, m - 1)) {
        clash++;
        if (list.length < 12)
          list.push(
            `${t.toFixed(2)}s ${CUE_NAMES[kind]} ${m} over ${CHORDS[c].name} (from ${at.toFixed(2)}s)`,
          );
      }
    }
    return {
      harpNotes: H.length / 4,
      checked: n,
      inSecondChordOfSplitBar: split,
      notChordTone: notTone,
      semitoneClash: clash,
      clashes: list.join(", "),
      gridMs: Math.round(grid * 100) / 100,
    };
  }

  /** QA, offline (the render suspended at `t`): the voices that ended before t leave the graph, as they do live. */
  qaGc(t: number) {
    const e = this.qaEnded;
    let j = 0;
    for (let i = 0; i < e.length; i++) {
      if (e[i].end + 0.25 < t) e[i].out.disconnect();
      else e[j++] = e[i];
    }
    e.length = j;
  }

  /** QA: mute the arrangement (to measure the cues alone). */
  soloCues(on: boolean) {
    this.solo = on;
  }

  /** QA: fire a cue by name. */
  fire(name: CueName, arg = 1) {
    const now = this.now();
    const C = CHORDS[this.chordAt(now)];
    if (name === "bang") this.bang(arg);
    else if (name === "knot") this.knot(Math.round(arg) % 3, true, false);
    else if (name === "ignite") this.ignite();
    else if (name === "launch") this.launch(true);
    else if (name === "flyby") this.flyby();
    else if (name === "city") this.city();
    else if (name === "star") this.star(`qa${arg}`);
    else if (name === "push") this.sigh(this.q8(now + LEAD));
    else if (name === "sky") this.queue(K_SKY, this.q8(now + LEAD), 1, 0);
    else if (name === "rise")
      for (let i = 0; i < RISE.length; i++) this.riseNote(i, now + LEAD + i * E16);
    else if (name === "pull")
      for (let i = 0; i < 4; i++)
        this.pizz(C.pz[0] < 45 ? C.pz[0] + 12 : C.pz[0], 0.45, now + LEAD + i * BEAT, K_PULL, 1);
    else if (name === "note") this.piano(C.pv[3], 0.4, now + LEAD, K_GEN, 1, false);
  }

  /** QA, offline: start a render on a virtual clock (the master at the default volume). `post`: fig. 1 as after the bang. */
  qaBegin(post = true) {
    this.virtual = true;
    this.qaPost = post;
    this.want = true;
    this.master.gain.setValueAtTime(volumeGain(0.5), 0);
    this.snapNext = true;
    this.resync();
    this.anchor(0.06);
  }

  /** QA, offline: one step of the live loop at virtual time t and story position P (what frame() does). */
  qaStep(t: number, P: number) {
    this.vt = t;
    this.events(P);
    this.conduct(t + LOOK, P);
    this.update(STEP, P);
  }

  /**
   * QA, offline: schedule `seconds` of the score at story position P on a virtual clock (the same steps the live
   * frame loop takes); the caller then renders the OfflineAudioContext. `cue` fires one gesture cue at 0.3 s over a
   * muted band; `post` treats fig. 1 as after the bang.
   */
  qaRender(seconds: number, P: number, cue?: CueName, post = true) {
    this.qaBegin(post);
    this.solo = !!cue;
    let fired = !cue;
    for (let t = 0; t < seconds; t += STEP) {
      this.vt = t;
      if (!fired && t >= 0.3) {
        fired = true;
        this.fire(cue as CueName, cue === "bang" ? 1 : cue === "flyby" ? 2 : 1);
      }
      this.conduct(t + LOOK, P);
      this.update(STEP, P);
    }
  }

  private now() {
    return this.virtual ? this.vt : this.ctx.currentTime;
  }

  private applyMaster(tc: number) {
    const on = this.want && !this.hidden;
    const g = on ? volumeGain(this.volume) : 0;
    const p = this.master.gain;
    p.cancelScheduledValues(this.ctx.currentTime);
    p.setTargetAtTime(g, this.ctx.currentTime, tc);
  }

  private sleepIn(ms: number, stop: boolean) {
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      this.suspendTimer = 0;
      if (stop) {
        this.unFrame?.();
        this.unFrame = null;
        this.followEnd(this.ctx.currentTime, 0.05);
      }
      if (this.ctx.state === "running") void this.ctx.suspend();
    }, ms);
  }

  private wakeUp() {
    if (this.virtual) return;
    this.quietFor = 0;
    if (this.sleeping) {
      // back from a nap (the record): the master returns at once (nothing was sounding)
      this.sleeping = false;
      window.clearTimeout(this.napTimer);
      this.napTimer = 0;
      this.applyMaster(0.04);
    }
    // (never before the page's first user activation: that resume could only fail, with a console warning)
    if (this.ctx.state !== "running" && !this.hidden && activated())
      void this.ctx.resume().catch(() => undefined);
  }

  /** Nothing to hear for a while (the record, its reverb tails gone): dip the master, then let the context sleep. */
  private nap() {
    if (this.virtual) return;
    this.sleeping = true;
    const p = this.master.gain;
    p.cancelScheduledValues(this.ctx.currentTime);
    p.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    window.clearTimeout(this.napTimer);
    this.napTimer = window.setTimeout(() => {
      this.napTimer = 0;
      if (this.sleeping && this.ctx.state === "running") void this.ctx.suspend();
    }, 250);
  }

  // ------------------------------------------------------------------------------------------------ every frame

  private frame(dt: number) {
    if (this.hidden || !this.want) return;
    if (this.ctx.state !== "running" && !this.sleeping) {
      // the clock is stopped (a resume on its way, or the system took the audio): nothing is scheduled on it, or it
      // would all sound at once, late, when it runs again; the edges wait, so what happens meanwhile is judged then
      // (inside its window, or not at all). It asks again now and then.
      this.stalled += dt;
      if (this.stalled > 1) {
        this.stalled = 0;
        this.wakeUp();
      }
      return;
    }
    this.stalled = 0;
    const t0 = this.timing ? performance.now() : 0;
    const P = story.Ts + story.after;
    this.events(P);
    this.conduct(this.ctx.currentTime + LOOK, P);
    this.acc += dt;
    if (this.acc >= STEP) {
      const step = this.acc;
      this.acc = 0;
      this.update(step, P);
    }
    if (this.timing) {
      this.cpuMs += performance.now() - t0;
      this.frames++;
    }
  }

  /** Before the light is let go (fig. 1): the twinkles, waiting for the hold. */
  private pre(P: number) {
    return P < 1 && hold.bangAt < 0 && !(this.virtual && this.qaPost);
  }

  /** The section at P (some figures turn on what the visitor did: the ignition, the alignment, the launch, the field). */
  private sectionFor(P: number): Sec {
    const play = shared.play;
    if (P < 10.95) this.skyDone = false;
    if (P < 1) return this.pre(P) ? S_PRE : S_INTRO;
    if (P < 2) return S_VERS;
    if (P < 3) return shared.sunOn >= 0.5 ? S_BUILD : S_ANTIC;
    if (P < 4) return S_FULL;
    if (P < 5) return play.aligned >= 0.95 ? S_FULL : S_SUS;
    if (P < 6) return S_PIANO;
    if (P < 7) return play.launchT >= 0 ? S_TUTTI : S_PIANO;
    if (P < 8) return S_THEIRS;
    if (P < 9) return play.field >= FIELD_HOLDS ? S_AURORA : S_STORM;
    if (P < 10) return S_LIGHT;
    if (P < 11) return S_OPEN;
    return this.skyDone ? S_CODA : S_SKY;
  }

  /** How loud the arrangement plays now: the section's level, the bed's fade at the end, a little softer after a long rest. */
  private ampAt(P: number, s: Sec) {
    if (this.solo) return 0;
    const calm = this.virtual ? 0 : smooth((story.rest - 30) / 30);
    return db(s.gain) * curve(BED, P) * (1 - 0.25 * calm);
  }

  /** The conductor: the grid's eighths up to `until` on the audio clock, and the hold's rising figure. */
  private conduct(until: number, P: number) {
    if (!this.gridOn) return;
    const now = this.now();
    // back from a long gap (a nap, a stalled thread): start a fresh bar a moment from now
    if (this.stepTime(this.si) < now - 2 * BAR) {
      const bar = this.bar;
      const phrase = this.phrase;
      this.anchor(now + 0.1);
      this.restartNext = false;
      this.bar = bar - 1;
      this.phrase = phrase;
    }
    for (;;) {
      const t = this.stepTime(this.si);
      if (t >= until) break;
      // (a step whose moment has passed is skipped, not played late: the state still moves on)
      this.stepAt(this.si, t, P, t < now - 0.02);
      this.si++;
    }
    this.riser(now);
  }

  /** The next eighth of the grid at or after x (x itself while the grid is not running). */
  private q8(x: number) {
    if (!this.gridOn) return x;
    return this.t0 + Math.ceil((x - this.t0) / E8 - 1e-6) * E8;
  }

  private q16(x: number) {
    if (!this.gridOn) return x;
    return this.t0 + Math.ceil((x - this.t0) / E16 - 1e-6) * E16;
  }

  /** The first beat not yet scheduled (an even eighth at or after the next one to schedule). */
  private nextBeat() {
    return this.si + (this.si & 1);
  }

  /** A new bar at eighth si: its section, its place in the phrase, its chords and melody, and its bar-long voices. */
  private beginBar(si: number, t: number, P: number, late: boolean) {
    this.prevA = this.chA;
    this.prevB = this.chB;
    this.prevStart = this.barStart;
    this.barStart = si;
    this.forceBarAt = -1;
    this.cueBar = si === this.cueBarAt;
    let s = this.sectionFor(P);
    if (s !== this.sec) {
      if (s.fam !== this.sec.fam) this.restartNext = true;
      this.sec = s;
      if (this.virtual) this.qaSections.push([Math.round(t * 10) / 10, s.name]);
    }
    if (this.restartNext) {
      this.restartNext = false;
      this.bar = 0;
      this.phrase = 0;
    } else if (++this.bar >= s.prog.length) {
      this.bar = 0;
      this.phrase++;
    }
    // the sky's statement plays once, then the coda (until the visitor leaves the sky)
    if (s === S_SKY && this.bar === 0 && this.phrase > 0) {
      this.skyDone = true;
      s = this.sec = S_CODA;
      this.phrase = 0;
      if (this.virtual) this.qaSections.push([Math.round(t * 10) / 10, s.name]);
    }
    const b = s.prog[this.bar];
    this.chA = b[0];
    this.chB = b.length > 1 ? b[1] : -1;
    this.noteChord(this.chA, t);
    if (this.virtual) this.qaChordLine.push(t, this.chA);
    // the melody of this bar
    this.melBar = null;
    this.melAug = !!s.aug;
    const calm = !this.virtual && story.rest > 45;
    const n = s.mel.length + (calm ? 1 : 0);
    const mel = this.phrase % n < s.mel.length ? s.mel[this.phrase % n] : null;
    if (mel) {
      if (s.aug) {
        this.melBar = mel[(this.bar >> 1) % mel.length];
        this.melHalf = this.bar & 1;
      } else this.melBar = mel[this.bar % mel.length];
      this.melLen = this.melBar.length;
    } else if (s.gen === 2 && !late && Math.random() < 0.6) this.versions(CHORDS[this.chA]);
    this.barAmp = this.ampAt(P, s);
    if (late || this.barAmp <= 0) return;
    this.chordVoices(this.chA, t, this.chB >= 0 ? BAR / 2 : BAR);
  }

  /** At a chord change: the pedal is changed, the low string enters, the strings swell (as the section asks). */
  private chordVoices(c: number, t: number, dur: number) {
    const s = this.sec;
    const C = CHORDS[c];
    const amp = this.barAmp;
    this.damper(c, t);
    if (this.cueBar) return;
    if (s.bv > 0 && this.bar % s.bEvery === 0)
      this.bass(C.bass, s.bv * rand(0.95, 1.03), t, dur - 0.06, K_GEN, amp);
    if (s.sv > 0 && this.bar % s.sEvery === 0) this.swell(C.st, t, dur, s.sv, s.bright, K_GEN, amp);
  }

  private noteChord(c: number, t: number) {
    if (c === this.lastChord) return;
    this.lastChord = c;
    this.chordChanges++;
    if (this.virtual) this.qaChords.push([Math.round(t * 10) / 10, CHORDS[c].name]);
  }

  /** One eighth of the grid: the bar's line, the patterns, the melody, the hold's figures. */
  private stepAt(si: number, t: number, P: number, late: boolean) {
    // (a bar a cue forces one eighth from now: the bar before stretches by that eighth rather than start a short one)
    if (si === this.forceBarAt || (si - this.barStart >= 8 && si !== this.forceBarAt - 1))
      this.beginBar(si, t, P, late);
    this.pending(
      si,
      t,
      CHORDS[this.chB >= 0 && si - this.barStart >= 4 ? this.chB : this.chA],
      late,
    );
    if (late) return;
    const pos = si - this.barStart;
    const s = this.sec;
    const amp = this.barAmp;
    const second = this.chB >= 0 && pos >= 4;
    const C = CHORDS[second ? this.chB : this.chA];
    if (pos === 4 && this.chB >= 0) {
      this.noteChord(this.chB, t);
      if (this.virtual) this.qaChordLine.push(t, this.chB);
      if (amp > 0) this.chordVoices(this.chB, t, BAR / 2);
    }
    // the hold's figures and the sky's drag sound whatever the band does (they are the visitor's)
    this.holdStep(pos, t, C);
    this.dragStep(pos, t, P, C);
    if (amp <= 0) return;
    const accent = pos === 0 ? 1.12 : pos & 1 ? 0.84 : 1;
    if (s.pp) {
      const k = s.pp[pos];
      if (k >= 0 && !(pos === 0 && this.cueBar) && !(s.gen === 1 && this.bar & 1)) {
        this.piano(C.pv[k], s.pv * accent * rand(0.93, 1.05), t + rand(0, 0.006), K_GEN, amp, true);
      }
    }
    if (s.zp) {
      const k = s.zp[pos];
      if (k >= 0) this.pizz(C.pz[k], s.zv * accent * rand(0.92, 1.05), t, K_GEN, amp);
    }
    if (s.kp && s.kp[pos] > 0 && !(pos === 0 && this.cueBar)) this.kick(s.kv, t, K_GEN, amp);
    if (s.gen === 1 && Math.random() < 0.085) {
      const m = this.randomTone(C, 66, 79, this.lastTwinkle);
      if (m > 0) {
        this.lastTwinkle = m;
        this.bell(m, rand(0.16, 0.22), t, K_GEN, amp);
      }
    }
    this.melodyAt(pos, t, amp);
  }

  /** The melody's notes that start on eighth `pos` of this bar. */
  private melodyAt(pos: number, t: number, amp: number) {
    const bar = this.melBar;
    if (!bar) return;
    for (let i = 0; i + 2 < this.melLen; i += 3) {
      let beat = bar[i];
      let dur = bar[i + 2];
      if (this.melAug) {
        beat = beat * 2 - this.melHalf * 4;
        dur *= 2;
        if (beat < 0 || beat >= 4) continue;
      }
      if (beat * 2 !== pos) continue;
      this.melNote(bar[i + 1], dur, t, amp, beat);
    }
  }

  /** One note of the theme, in the section's colour. */
  private melNote(m: number, dur: number, t: number, amp: number, beat: number) {
    const s = this.sec;
    const v = s.mv * (dur >= 1 ? 1 : 0.86) * (beat === 0 ? 1.04 : 1) * rand(0.95, 1.04);
    const len = Math.min(dur * BEAT, 3);
    switch (s.inst) {
      case M_BELL:
        this.bell(m, v, t, K_GEN, amp);
        break;
      case M_PIANO:
        this.melodyPiano(m, v, t, amp);
        break;
      case M_TUTTI:
        this.bell(m, v * 0.8, t, K_GEN, amp);
        this.melodyPiano(m, v * 0.64, t + 0.012, amp);
        if (dur >= 1) this.swell([m - 12], t, len, 0.55, s.bright, K_GEN, amp, true);
        break;
      case M_STORM:
        this.melodyPiano(m, v, t, amp);
        if (dur >= 1) this.swell([m - 12], t, len, 0.6, 0.2, K_GEN, amp, true);
        break;
      case M_DUO:
        this.bell(m, v * 0.82, t, K_GEN, amp);
        this.melodyPiano(m, v * 0.62, t + 0.012, amp);
        break;
    }
  }

  /** The theme on the piano, legato: the note before is let go as the next is struck. */
  private melodyPiano(m: number, v: number, t: number, amp: number) {
    const last = this.melPiano;
    if (last && last.m !== m && last.end > t) this.release(last, t + 0.04, 0.3);
    this.melPiano = this.piano(m, v, t, K_GEN, amp, false, Number.NaN, 0.9) ?? null;
  }

  /** Fig. 2: a new version of the hook's first cell on this bar's chord (a rhythm, a leap, steps down the scale). */
  private versions(C: Chord) {
    const R = CELLS[Math.floor(Math.random() * CELLS.length)];
    const g = this.genMel;
    let m = this.randomTone(C, 64, 71, -1);
    if (m <= 0) return;
    let n = 0;
    for (let i = 0; i < R.length; i += 2) {
      if (n === 1) {
        m += LEAPS[Math.floor(Math.random() * LEAPS.length)];
        for (let d = 0; d < 6 && !inPcs(C.pcs, m); d++) m += inPcs(C.pcs, m - 1) ? -1 : 1;
        if (m > 83) m -= 12;
      } else if (n > 1) {
        const dir = n === 4 ? 1 : -1;
        m += dir;
        while (!inPcs(SCALE, m)) m += dir;
      }
      g[n * 3] = R[i];
      g[n * 3 + 1] = m;
      g[n * 3 + 2] = R[i + 1];
      n++;
    }
    this.melBar = g;
    this.melLen = n * 3;
  }

  /** Edges that start cues: checked every frame (a few comparisons), so a cue lands on the grid right after its moment. */
  private events(P: number) {
    const play = shared.play;
    const now = this.now();

    // the hold sounds from the frame a figure answers it, and lets go on the frame it stops answering (a release,
    // or a scroll out of its window): a press where nothing answers it stays silent
    const mode = hold.live ? H_OF_KIND[holdNow()] : H_NONE;
    if (mode !== (this.holdOn ? this.holdMode : H_NONE)) {
      if (this.holdOn) this.letGo(now);
      if (mode !== H_NONE) this.press(mode, now);
    }

    if (hold.bangAt !== this.lastBang) {
      const was = this.lastBang;
      this.lastBang = hold.bangAt;
      if (was < 0 && hold.bangAt >= 0 && P < 1.05) this.bangCue();
    }
    if (play.center !== this.lastCenter || play.centerByVisitor !== this.lastBy) {
      this.lastCenter = play.center;
      this.lastBy = play.centerByVisitor;
      if (play.center >= 0 && P > 1.9 && P < 3.0) this.knotWant = play.center;
    }
    // a choice is answered at most once a second, and only if it differs from the last one answered: a visitor
    // re-picking hears where they settle, not every click; a choice changed again soon after is answered softer
    if (this.knotWant >= 0 && now - this.at[K_KNOT] >= 1) {
      const i = this.knotWant;
      this.knotWant = -1;
      const since = now - this.at[K_KNOT];
      if (P > 1.9 && P < 3.0 && (i !== this.knotLast || since > 4))
        this.knot(i, play.centerByVisitor, since < 4);
    }
    const sun = shared.sunOn;
    if (this.lastSun < 0.5 && sun >= 0.5 && P > 2.55 && P < 3.4 && now - this.at[K_IGNITE] > 15)
      this.ignite();
    this.lastSun = sun;
    if (play.launchT !== this.lastLaunch) {
      const was = this.lastLaunch;
      this.lastLaunch = play.launchT;
      if (was < 0 && play.launchT >= 0 && P > 5.95 && P < 7.1 && now - this.at[K_LAUNCH] > 2.5)
        this.launch(play.launchByVisitor);
    }
    if (play.flybys !== this.lastFlybys) {
      const n = play.flybys;
      const up = n > this.lastFlybys;
      this.lastFlybys = n;
      if (up && n > 0 && P > 6.05 && P < 7.08 && now - this.at[K_FLYBY] > 0.5) this.flyby();
    }
    if (play.cities !== this.lastCities) {
      const up = play.cities > this.lastCities;
      this.lastCities = play.cities;
      // (the world dark again, a scroll back: the next first lights are the loudest again)
      if (play.cities === 0) this.cityN = 0;
      if (up && P > 6.98 && P < 7.75 && now - this.at[K_CITY] > this.cityGap) this.city();
    }
    if (play.hoverStar !== this.lastStar) {
      const s = play.hoverStar;
      this.lastStar = s;
      if (s !== "") this.star(s);
    }
  }

  // ------------------------------------------------------------------------------------------------ the hold

  /** A hold sounds (a figure answers it): its follow swell, from the chord that is sounding. */
  private press(mode: number, now: number) {
    this.holdOn = true;
    this.holdMode = mode;
    this.wakeUp();
    const C = CHORDS[this.chordAt(now)];
    if (mode === H_GATHER) {
      this.riseIdx = -1;
      this.topN = 0;
      this.riseT = this.q16(now + LEAD);
      this.followStart(RISE_SWELL, 0.7, K_RISE);
    } else if (mode === H_PULL) this.followStart([C.bass + 12, C.bass + 19], 0.25, K_PULL);
    else this.followStart([C.bass + 12, C.bass + 19, C.bass + 24], 0.35, K_PUSH);
  }

  /** The hold lets go: the swell fades (the bang takes over in fig. 1); the push ends in a soft harp sigh (2.5 s apart). */
  private letGo(now: number) {
    const mode = this.holdMode;
    this.holdOn = false;
    this.holdMode = H_NONE;
    this.followEnd(now, mode === H_GATHER ? 0.3 : 0.5);
    if (mode === H_FIELD && now - this.sighAt > 2.5) {
      this.sighAt = now;
      this.sigh(this.q8(now + LEAD));
    }
  }

  /** Fig. 1's rising figure: one note a sixteenth as hold.k climbs, then a slow, soft tone at the top while held. */
  private riser(now: number) {
    if (!this.holdOn || this.holdMode !== H_GATHER) return;
    if (this.riseT < now + 0.01) this.riseT = this.q16(now + LEAD);
    // (scheduled only just ahead: it follows the finger)
    while (this.riseT < now + 0.07) {
      const top = RISE.length - 1;
      const target = Math.min(top, Math.floor(hold.k * top + 0.35));
      if (this.riseIdx < target) this.riseNote(++this.riseIdx, this.riseT);
      else if (this.riseIdx === top && hold.k >= 0.999) {
        // at the top, while held: a slow harp tone every other beat, softer each time (six at most)
        const s = Math.round((this.riseT - this.t0) / E16);
        if ((s & 7) === 0 && this.topN < 6) {
          this.harp(
            TOP[this.topN & 3],
            RISE_LV * Math.max(0.12, 0.28 * 0.86 ** this.topN),
            this.riseT,
            K_RISE,
            1,
          );
          this.topN++;
        }
      }
      this.riseT += E16;
    }
  }

  private riseNote(i: number, t: number) {
    const m = RISE[i];
    this.harp(m, RISE_LV * (0.26 + (0.16 * i) / (RISE.length - 1)), t, K_RISE, 1);
    if (i < 5 && (i & 1) === 0)
      this.piano(m - 12 >= 43 ? m - 12 : m, 0.24 * RISE_LV, t, K_RISE, 1, false);
  }

  /** The hold's figures on the grid: the pull's low heartbeat on the beats, the push's driving eighths. */
  private holdStep(pos: number, t: number, C: Chord) {
    if (!this.holdOn) return;
    const k = hold.k;
    if (this.holdMode === H_PULL && (pos & 1) === 0) {
      const m = C.pz[0] < 45 ? C.pz[0] + 12 : C.pz[0];
      this.pizz(m, 0.3 + 0.28 * k, t, K_PULL, 1);
    } else if (this.holdMode === H_FIELD) {
      this.bass(
        C.bass + 12,
        (0.3 + 0.38 * k) * (pos & 1 ? 0.82 : 1),
        t,
        E8 * 0.82,
        K_PUSH,
        1,
        true,
      );
    }
  }

  /** Fig. 12's drag: a few harp tones on the beats, stepping through the chord the way the sky turns (four a drag). */
  private dragStep(pos: number, t: number, P: number, C: Chord) {
    const drag =
      P > SKY_DRAG_FROM &&
      P < 12.6 &&
      hold.down &&
      !hold.pressing &&
      !story.reducedMotion &&
      Math.abs(hold.vx) > 40;
    if (!drag) {
      if (t - this.dragLast > 1.2) this.dragN = 0;
      return;
    }
    if (this.dragN >= 4 || pos & 1) return;
    this.skyTone(C, hold.vx > 0 ? 1 : -1, t, Math.max(-0.5, Math.min(0.5, hold.nx * 0.5)));
  }

  /** One tone of the sky's drag: the next tone of the chord (B3 to D5), softer with each. */
  private skyTone(C: Chord, dir: number, t: number, pan: number) {
    this.dragM = this.toneStep(C, this.dragM, dir, 59, 74);
    this.dragN++;
    this.dragLast = t;
    this.harp(this.dragM, 0.36 - 0.03 * this.dragN, t, K_SKY, 1, pan);
  }

  /** The follow swell: a string chord rising with hold.k; once the hold is full it fades (never a held tone). */
  private followStart(notes: readonly number[], bright: number, kind: number) {
    const ctx = this.ctx;
    const t = this.now();
    this.followEnd(t, 0.08);
    // (QA: a render of one other instrument leaves the strings' swell out)
    if (this.muted(I_STR)) return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.automationRate = "k-rate";
    lp.Q.setValueAtTime(0.5, t);
    lp.frequency.setValueAtTime(650 + 900 * bright, t);
    lp.connect(out).connect(this.strIn);
    const srcs: OscillatorNode[] = [];
    for (let i = 0; i < notes.length; i++) {
      for (let j = 0; j < 2; j++) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(this.wStr);
        o.frequency.setValueAtTime(hz(notes[i]), t);
        o.detune.setValueAtTime(j ? 5 : -4, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(1 / notes.length, t);
        o.connect(g).connect(lp);
        o.start(t);
        srcs.push(o);
      }
    }
    this.counts[kind]++;
    this.at[kind] = t;
    let log = -1;
    if (this.virtual) {
      log = this.qaLog.length;
      this.qaLog.push(t, notes[0], I_STR, 0);
    }
    this.follow = { out, k: new Knob(out.gain, 0.0003), srcs, at: t, topAt: -1, log };
  }

  private followSet(t: number) {
    const f = this.follow;
    if (!f) return;
    const k = hold.k;
    if (k >= 0.999 && f.topAt < 0) f.topAt = t;
    const decay = f.topAt >= 0 ? Math.exp(-(t - f.topAt) / 0.9) : 1;
    f.k.set(
      FOLLOW_GAIN * smooth(k) * decay * (1 + 0.15 * (this.holdMode === H_FIELD ? 1 : 0)),
      t,
      0.12,
    );
  }

  private followEnd(t: number, tc: number) {
    const f = this.follow;
    if (!f) return;
    this.follow = null;
    const g = f.out.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, tc);
    for (let i = 0; i < f.srcs.length; i++) f.srcs[i].stop(t + tc * 8);
    if (!this.virtual) window.setTimeout(() => f.out.disconnect(), (tc * 8 + 0.3) * 1000);
    if (f.log >= 0) {
      // above -20 dB of its crest: from about a third of the way up the hold to the fall (or the fade past the top)
      const end = Math.min(t + tc * 2.3, f.topAt >= 0 ? f.topAt + 2.07 : Number.POSITIVE_INFINITY);
      this.qaLog[f.log + 3] = Math.max(0, end - (f.at + 0.45));
    }
  }

  // ------------------------------------------------------------------------------------------------ the update

  /** Every STEP: the follow swell, the room, voices that have finished, and sleep when there is nothing to hear. */
  private update(step: number, P: number) {
    const t = this.now();
    const snap = this.snapNext;
    this.snapNext = false;
    if (snap) this.k.wet.snap(this.sec.wet, t);
    else this.k.wet.set(this.sec.wet, t, 1.5);
    this.followSet(t);

    const voices = this.voices;
    for (let i = voices.length - 1; i >= 0; i--) {
      if (t > voices[i].end + 0.1) {
        // (offline, the whole render is scheduled before it plays: a disconnect now would silence the voice; the
        // render disconnects it as it passes its end, qaGc)
        if (!this.virtual) voices[i].out.disconnect();
        else this.qaEnded.push(voices[i]);
        this.remove(i);
      }
    }
    if (this.virtual) return;
    let cues = 0;
    for (let i = 0; i < voices.length; i++) if (voices[i].kind !== K_GEN) cues++;
    const busy = curve(BED, P) > 0.001 || cues > 0 || hold.pressing || hold.down || !!this.follow;
    if (busy) {
      this.quietFor = 0;
      if (this.sleeping) this.wakeUp();
    } else if (!this.sleeping) {
      this.quietFor += step;
      if (this.quietFor > 4.5) this.nap();
    }
  }

  // ------------------------------------------------------------------------------------------------ the voices

  private remove(i: number) {
    const v = this.voices;
    for (let j = i; j < v.length - 1; j++) v[j] = v[j + 1];
    v.length--;
    if (this.melPiano && this.voices.indexOf(this.melPiano) < 0) this.melPiano = null;
  }

  /** A new voice's output (the cap: the oldest accompaniment that has started goes first, else the oldest). */
  private voice(
    inst: number,
    kind: number,
    m: number,
    t: number,
    len: number,
    dest: AudioNode,
    acc: boolean,
  ): Voice {
    const ctx = this.ctx;
    this.wakeUp();
    if (this.voices.length >= this.maxVoices) {
      const now = this.now();
      let idx = -1;
      for (let i = 0; i < this.voices.length && idx < 0; i++)
        if (this.voices[i].acc && this.voices[i].t <= now) idx = i;
      if (idx < 0) idx = 0;
      const old = this.voices[idx];
      // (a voice already let go is fading on its own: it only leaves the count; otherwise its output, still at 1, ramps out)
      if (!old.rel) {
        const g = old.out.gain;
        const at = Math.max(now, old.t);
        g.cancelScheduledValues(at);
        g.setValueAtTime(1, at);
        g.linearRampToValueAtTime(0, at + 0.05);
        for (let i = 0; i < old.srcs.length; i++) old.srcs[i].stop(at + 0.06);
        if (old.log >= 0)
          this.qaLog[old.log + 3] = Math.min(this.qaLog[old.log + 3], at + 0.05 - old.t);
        old.end = at + 0.06;
      }
      if (this.virtual) this.qaEnded.push(old);
      else window.setTimeout(() => old.out.disconnect(), Math.max(0, old.end - now + 0.2) * 1000);
      this.remove(idx);
    }
    const out = ctx.createGain();
    // whatever is left of the tail is faded out before the sources stop (never a step at the end)
    out.gain.setValueAtTime(1, t + len - 0.1);
    out.gain.linearRampToValueAtTime(0, t + len - 0.01);
    out.connect(dest);
    const v: Voice = { out, end: t + len, srcs: [], inst, kind, m, t, acc, log: -1, rel: false };
    this.voices.push(v);
    this.at[kind] = t;
    this.counts[kind]++;
    return v;
  }

  /** QA: log a voice's held time (seconds above -20 dB of its own peak). */
  private held(v: Voice, s: number) {
    if (!this.virtual) return;
    v.log = this.qaLog.length;
    this.qaLog.push(v.t, v.m, v.inst, s);
  }

  /** Let a voice go from `at`: its output glides to silence (time constant `tc`), then its sources stop. */
  private release(v: Voice, at: number, tc: number) {
    if (at < v.t) at = v.t;
    if (v.rel || v.end - 0.1 <= at) return;
    v.rel = true;
    const g = v.out.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(1, at);
    g.setTargetAtTime(0, at, tc);
    const end = at + tc * 6;
    for (let i = 0; i < v.srcs.length; i++) v.srcs[i].stop(end);
    v.end = end;
    if (v.log >= 0) this.qaLog[v.log + 3] = Math.min(this.qaLog[v.log + 3], at + tc * 2.3 - v.t);
  }

  /** The same key struck again: the string still ringing is damped as the new note starts. */
  private restrike(inst: number, m: number, t: number) {
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (v.inst === inst && v.m === m && v.t < t && v.end > t) this.release(v, t, 0.07);
    }
  }

  /**
   * A pianist changes the pedal at a new chord: an accompaniment note still ringing that is not in the new chord is
   * let go (a 0.16 s damper), so the harmony stays clear and the voices few.
   */
  private damper(c: number, at: number) {
    const C = CHORDS[c];
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      if (v.inst !== I_PIANO || !v.acc || v.t >= at || v.end <= at + 0.3) continue;
      if (!inPcs(C.pcs, v.m) && !inPcs(C.pv, v.m)) this.release(v, at, 0.16);
    }
  }

  /**
   * The felt piano at time t: partials with a gentle inharmonic stretch, a soft hammer (6-12 ms, softer when quieter)
   * through a low-pass that starts open and closes as the note rings, a two-stage decay (a quick fall, then the
   * aftersound; higher partials die sooner, lower notes ring longer), a second string a hair sharp on the fundamental,
   * and (for the theme and the cues) a damped low knock of the body under the strike. `acc`: accompaniment (fewer
   * partials, damped at chord changes). `tail` stretches the decay.
   */
  private piano(
    m: number,
    vel: number,
    at: number,
    kind: number,
    amp: number,
    acc: boolean,
    pan = Number.NaN,
    tail = 1,
  ) {
    if (amp <= 0.0005 || this.muted(I_PIANO)) return undefined;
    const ctx = this.ctx;
    const t = Math.max(at, this.now() + 0.01);
    const v = clamp01(vel);
    this.restrike(I_PIANO, m, t);
    const f0 = hz(m);
    // (the lowest strings ring a little shorter: under A2 the room and the low string carry them, never a held drone)
    const tau1 =
      Math.min(2.1 - 0.4 * clamp01((45 - m) / 3), Math.max(1.05, 2.25 - (m - 45) * 0.032)) *
      tail *
      (kind === K_GEN ? 1 : this.rm());
    const len = Math.min(11, 0.35 + 4.4 * tau1);
    const c = this.voice(I_PIANO, kind, m, t, len, this.pianoIn, acc);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.automationRate = "k-rate";
    lp.Q.setValueAtTime(0.45, t);
    const fc0 = Math.min(5200, 900 + f0 * (5 + 7 * v));
    const fc1 = Math.min(fc0, Math.max(f0 * 4, 1000 + 700 * v));
    lp.frequency.setValueAtTime(fc0, t);
    lp.frequency.exponentialRampToValueAtTime(fc1, t + 0.7);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(
      Number.isNaN(pan) ? Math.max(-0.45, Math.min(0.45, (m - 57) / 40 + rand(-0.1, 0.1))) : pan,
      t,
    );
    lp.connect(p).connect(c.out);
    const att = 0.012 - 0.006 * v;
    const peak = PIANO_GAIN * v ** 1.35 * amp;
    const det = rand(-1.2, 1.2);
    const np = this.lite ? 3 : acc ? 4 : 6;
    for (let n = 1; n <= np; n++) {
      const fn = n * f0 * Math.sqrt(1 + 0.00035 * n * n);
      if (fn > 4200) break;
      const a = PARTIALS[n - 1] * v ** (0.25 * (n - 1)) * peak;
      const tn = tau1 / (1 + 0.65 * (n - 1));
      this.partial(c, fn, det, a, t, att, tn, lp);
      if (n === 1) this.partial(c, fn * 1.00042, det, a * 0.5, t, att * 1.15, tn * 1.1, lp);
    }
    if (!acc && m >= 47) {
      // the body: a damped knock, felt more than heard
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(rand(92, 104), t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak * 0.14 * (1 - clamp01((m - 47) / 36)), t + 0.008);
      g.gain.setTargetAtTime(0, t + 0.008, 0.045);
      o.connect(g).connect(p);
      o.start(t);
      o.stop(t + 0.45);
      c.srcs.push(o);
    }
    this.held(c, att + 0.25 + 1.55 * tau1);
    return c;
  }

  /**
   * One partial: 0 → a over `att` (linear), a quick fall toward 45% (the prompt sound), then the long fall with time
   * constant `tau` (the aftersound). The gain is closed from the moment it exists.
   */
  private partial(
    c: Voice,
    f: number,
    det: number,
    a: number,
    t: number,
    att: number,
    tau: number,
    dest: AudioNode,
  ) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.detune.setValueAtTime(det, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + att);
    g.gain.setTargetAtTime(a * 0.45, t + att, 0.14);
    g.gain.setTargetAtTime(0, t + att + 0.25, tau);
    o.connect(g).connect(dest);
    o.start(t);
    // a partial stops once it has died away (-40 dB of its own peak), not with the note
    o.stop(Math.min(c.end, t + att + 0.25 + 4.5 * tau));
    c.srcs.push(o);
  }

  /**
   * The celesta: a struck steel bar over its resonator. The fundamental (a 3 ms mallet, a quick fall to 55%, then a
   * ~1 s ring), a soft octave (the box), a touch of the free bar's 2.76 and a quick double octave (the "ding"), less
   * of them up high; the highest notes (above E5) a little softer still, their upper modes most of all (B5: the note
   * -1 dB, its octave 3 dB less again, its 2.76 and double octave 6 dB less), so the top is warm, never glassy.
   * Rings about 2 s above -20 dB.
   */
  private bell(m: number, vel: number, at: number, kind: number, amp: number, pan = Number.NaN) {
    if (amp <= 0.0005 || this.muted(I_BELL)) return;
    const ctx = this.ctx;
    const t = Math.max(at, this.now() + 0.01);
    const up = clamp01((m - 76) / 7);
    const v = clamp01(vel) * (1 - 0.11 * up);
    this.restrike(I_BELL, m, t);
    const f = hz(m);
    const tau =
      Math.max(0.7, Math.min(1.35, 1.25 - (m - 69) * 0.025)) * (kind === K_GEN ? 1 : this.rm());
    const len = 0.2 + 5 * tau;
    const c = this.voice(I_BELL, kind, m, t, len, this.bellIn, false);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(
      Number.isNaN(pan)
        ? Math.max(-0.4, Math.min(0.5, 0.1 + (m - 76) / 45 + rand(-0.08, 0.08)))
        : pan,
      t,
    );
    p.connect(c.out);
    const peak = BELL_GAIN * v ** 1.2 * amp;
    const hi = clamp01((5200 - 4 * f) / 2600 + 0.25) * (1 - 0.5 * up);
    this.bar1(c, f, peak, t, 0.003, 0.55, tau, p);
    this.bar1(c, f * 2, peak * 0.1 * (1 - 0.3 * up), t, 0.003, 0.4, tau * 0.45, p);
    if (!this.lite) this.bar1(c, f * 2.756, peak * 0.05 * v * hi, t, 0.002, 0, 0.13, p);
    this.bar1(c, f * 4.0, peak * 0.17 * v ** 0.6 * hi, t, 0.002, 0, 0.2, p);
    this.held(c, 0.12 + 1.7 * tau);
  }

  /** One mode of the celesta's bar: up over `att`, a quick fall to `mid` of its peak (0: straight on), then `tau`. */
  private bar1(
    c: Voice,
    f: number,
    a: number,
    t: number,
    att: number,
    mid: number,
    tau: number,
    dest: AudioNode,
    ph = 0,
  ) {
    if (a <= 1e-6) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + att);
    if (mid > 0) {
      g.gain.setTargetAtTime(a * mid, t + att, 0.05);
      g.gain.setTargetAtTime(0, t + 0.12, tau);
    } else g.gain.setTargetAtTime(0, t + att, tau);
    o.connect(g).connect(dest);
    // (`ph`, in cycles: the mode's phase, by starting it that fraction of a period late; its gain is still closed)
    o.start(t + ph / f);
    o.stop(Math.min(c.end, t + 0.15 + 5 * tau));
    c.srcs.push(o);
  }

  /**
   * The felt harp, the visitor's voice (every gesture cue): a soft plucked string well under the theme. Six partials
   * of a plucked string (HARP_PARTIALS, a hair stretched; four in the lite build), each up over 16 ms (a felt pluck,
   * never a mallet's tick) with the finger leaving the string 25 dB under it, a quick fall to about half, then a ring
   * of about a second, the upper partials dying first (it rounds as it rings), through the harp bus's low-pass at
   * 1.6 kHz. The lower the string, the richer (its 2nd stronger than its fundamental from C4 down), so its pitch
   * carries on a small speaker as the band's does. `att` lengthens the pluck (the sigh's). Rings about 1.8 s above -20 dB.
   */
  private harp(
    m: number,
    vel: number,
    at: number,
    kind: number,
    amp: number,
    pan = Number.NaN,
    att = 0.016,
  ) {
    if (amp <= 0.0005 || this.muted(I_HARP)) return;
    const t = Math.max(at, this.now() + 0.01);
    const v = clamp01(vel);
    this.restrike(I_HARP, m, t);
    const f = hz(m);
    const tau =
      Math.max(0.75, Math.min(1.3, 1.2 - (m - 62) * 0.02)) * (kind === K_GEN ? 1 : this.rm());
    const len = 0.25 + 5 * tau;
    const c = this.voice(I_HARP, kind, m, t, len, this.harpIn, false);
    if (this.virtual) this.qaHarp.push(t, m, kind, (t - this.t0) / E16);
    const p = this.ctx.createStereoPanner();
    p.pan.setValueAtTime(
      Number.isNaN(pan) ? Math.max(-0.4, Math.min(0.4, (m - 64) / 40 + rand(-0.12, 0.12))) : pan,
      t,
    );
    p.connect(c.out);
    const peak = HARP_GAIN * v ** 1.2 * amp;
    // the lower the string, the less of its fundamental (-1.5 dB from D4 down) and the more of its 2nd (0.45 of the
    // fundamental from D5 up, 0.9 at D4, about 1.3 at D3)
    const r2 = 0.45 + 0.62 * Math.min(1.3, Math.max(0, (74 - m) / 15)) ** 1.4;
    const np = this.lite ? 4 : 6;
    this.bar1(c, f, peak * (1 - 0.16 * clamp01((71 - m) / 9)), t, att, 0.5, tau, p);
    for (let n = 2; n <= np; n++) {
      const fn = n * f * Math.sqrt(1 + 0.00012 * n * n);
      if (fn > 2600) break;
      const a = peak * r2 * HARP_PARTIALS[n - 2] * (0.86 + 0.14 * v) ** (n - 1);
      this.bar1(c, fn, a, t, att, 0.42, tau / (1 + 0.3 * (n - 1)), p, HARP_PHASE[n - 2]);
    }
    if (!this.lite) this.finger(c, f, peak, t, p);
    this.held(c, 0.12 + 1.7 * tau);
  }

  /**
   * The finger leaving the harp's string: about 4 ms of soft noise round its 3rd partial (under 1.4 kHz), its peak
   * 25 dB under the note's: the pluck's grain, never a tick (nothing of it reaches the highs: the harp bus's low-pass).
   */
  private finger(c: Voice, f: number, peak: number, t: number, dest: AudioNode) {
    const ctx = this.ctx;
    this.noiseBuf ??= noise(ctx, 0.03);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(Math.min(1400, 3 * f), t);
    bp.Q.setValueAtTime(0.8, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.setValueAtTime(0, t);
    // (over those few ms the band-passed noise peaks near 0.26 of full scale: 0.21 of the note's peak puts the finger's
    // own peak 25 dB under the note's, 28 dB at D3; above 7 kHz, nothing within 66 dB of the note)
    g.gain.linearRampToValueAtTime(peak * 0.21, t + 0.0015);
    g.gain.setTargetAtTime(0, t + 0.0015, 0.0012);
    src.connect(bp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.025);
    c.srcs.push(src);
  }

  /**
   * Pizzicato: two players' plucked gut strings (a hair apart) through a low-pass that closes in a tenth of a second
   * (bright as it is plucked, round as it rings), a 5 ms pluck and a short ring, longer low down.
   */
  private pizz(m: number, vel: number, at: number, kind: number, amp: number) {
    if (amp <= 0.0005 || this.muted(I_PIZZ)) return;
    const ctx = this.ctx;
    const t = Math.max(at, this.now() + 0.01);
    const v = clamp01(vel);
    this.restrike(I_PIZZ, m, t);
    const f = hz(m);
    const tau = Math.max(0.14, Math.min(0.32, 0.3 - (m - 45) * 0.006));
    const len = 0.1 + 6 * tau;
    const c = this.voice(I_PIZZ, kind, m, t, len, this.pizzIn, true);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.automationRate = "k-rate";
    lp.Q.setValueAtTime(0.8, t);
    lp.frequency.setValueAtTime(Math.min(4500, f * (9 + 6 * v)), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 380), t + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(PIZZ_GAIN * v ** 1.3 * amp, t + 0.005);
    env.gain.setTargetAtTime(0, t + 0.005, tau);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(Math.max(-0.5, Math.min(0.2, -0.3 + (m - 50) / 70)), t);
    lp.connect(env).connect(p).connect(c.out);
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(this.wPizz);
      o.frequency.setValueAtTime(f * (i ? 1.0029 : 1), t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(i ? 0.55 : 1, t);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + len);
      c.srcs.push(o);
    }
    this.held(c, 2.3 * tau);
  }

  /**
   * A string swell inside one chord (or one long note of the theme, `note`): each tone two players a few cents apart
   * (one with a gentle vibrato), panned apart, through a low-pass that opens with the swell; the level rises on a
   * sine² and falls on a cosine² to rest by the end (`dur`), so it is never held across a change.
   */
  private swell(
    notes: readonly number[],
    at: number,
    dur: number,
    lvl: number,
    bright: number,
    kind: number,
    amp: number,
    note = false,
  ) {
    if (amp <= 0.0005 || dur < 0.3 || this.muted(I_STR)) return;
    const ctx = this.ctx;
    const t = Math.max(at, this.now() + 0.01);
    const c = this.voice(I_STR, kind, notes[0], t, dur + 0.06, this.strIn, false);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.setValueCurveAtTime(note ? this.noteC : this.swellC, t, dur);
    const lvlG = ctx.createGain();
    lvlG.gain.setValueAtTime(STR_GAIN * lvl * amp * (note ? 1.6 : 1), t);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.automationRate = "k-rate";
    lp.Q.setValueAtTime(0.55, t);
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.setTargetAtTime(650 + 1100 * bright, t, dur * 0.16);
    lp.frequency.setTargetAtTime(560, t + dur * (note ? 0.3 : 0.45), dur * 0.2);
    lp.connect(env).connect(lvlG).connect(c.out);
    const pans = [-0.38, 0.38];
    const sides: GainNode[] = [];
    for (let s = 0; s < 2; s++) {
      const g = ctx.createGain();
      const pn = ctx.createStereoPanner();
      pn.pan.setValueAtTime(pans[s], t);
      g.connect(pn).connect(lp);
      sides.push(g);
    }
    // one vibrato for the section (5.2 Hz, ±5 cents, coming in after the onset)
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(rand(4.9, 5.4), t);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(5, t + Math.min(0.8, dur * 0.4));
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    c.srcs.push(lfo);
    for (let i = 0; i < notes.length; i++) {
      for (let s = 0; s < 2; s++) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(this.wStr);
        o.frequency.setValueAtTime(hz(notes[i]), t);
        o.detune.setValueAtTime(s ? 4 : -4, t);
        if (s === 0) depth.connect(o.detune);
        o.connect(sides[s]);
        o.start(t);
        o.stop(t + dur + 0.05);
        c.srcs.push(o);
      }
    }
    this.held(c, (note ? 0.86 : 0.795) * dur);
  }

  /**
   * The low string at a chord change: a cello bowed in (70 ms) with the bass an octave under (from A1 up), settling,
   * then let go just before the next chord. `short`: a détaché stroke (the storm's push).
   */
  private bass(
    m: number,
    vel: number,
    at: number,
    dur: number,
    kind: number,
    amp: number,
    short = false,
  ) {
    if (amp <= 0.0005 || this.muted(I_BASS)) return;
    const ctx = this.ctx;
    const t = Math.max(at, this.now() + 0.01);
    const v = clamp01(vel);
    this.restrike(I_BASS, m, t);
    const len = dur + (short ? 0.35 : 0.7);
    const c = this.voice(I_BASS, kind, m, t, len, this.bassIn, true);
    const env = ctx.createGain();
    const peak = BASS_GAIN * v * amp * (short ? 0.75 : 1);
    const att = short ? 0.014 : 0.07;
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + att);
    env.gain.setTargetAtTime(peak * 0.62, t + att, short ? 0.07 : 0.45);
    const rel = Math.max(t + att + 0.02, t + dur - (short ? 0.02 : 0.2));
    env.gain.setTargetAtTime(0, rel, short ? 0.05 : 0.13);
    env.connect(c.out);
    const f = hz(m);
    for (let i = 0; i < 2; i++) {
      if (i && m - 12 < 33) break;
      const o = ctx.createOscillator();
      o.setPeriodicWave(this.wBass);
      o.frequency.setValueAtTime(i ? f / 2 : f, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(i ? 0.4 : 1, t);
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + len);
      c.srcs.push(o);
    }
    this.held(c, rel - t + (short ? 0.12 : 0.3));
  }

  /** A felt kick: a low sine falling from 105 to 48 Hz under a short decay, kept under 240 Hz. */
  private kick(vel: number, at: number, kind: number, amp: number) {
    if (amp <= 0.0005 || this.muted(I_KICK)) return;
    const ctx = this.ctx;
    const t = Math.max(at, this.now() + 0.01);
    const c = this.voice(I_KICK, kind, 36, t, 0.7, this.kickIn, true);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(105, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(KICK_GAIN * clamp01(vel) * amp, t + 0.005);
    g.gain.setTargetAtTime(0, t + 0.005, 0.09);
    o.connect(g).connect(c.out);
    o.start(t);
    o.stop(t + 0.68);
    c.srcs.push(o);
    this.held(c, 0.2);
  }

  // ------------------------------------------------------------------------------------------------ the cues

  /**
   * Fig. 1, the light let go: the hold's bang at its strength, the click's (the first screen's gate) a little under
   * the softest hold's and as its burst comes (after the crush), the scroll's gentle release softer, a quiet arrival (a
   * deep link, a jump past fig. 1) nothing. The click is also the gesture that starts the music, a moment before: the
   * master comes up quickly then, so the chord is heard whole instead of rising under the first slow fade-in.
   */
  private bangCue() {
    if (hold.quiet) return;
    if (hold.gentle) this.bang(0, true);
    else if (hold.click) {
      if (this.want && !this.hidden) this.applyMaster(0.16);
      // (a phone's tap is its whole bang: a mouse's click a little under the softest hold's)
      this.bang(
        hold.pointerType === "touch" ? 0.75 : 0.2,
        false,
        Math.max(0, CLICK_BANG.crushMs - (performance.now() - hold.bangAt)) / 1000,
      );
    } else this.bang(hold.kRelease > 0.05 ? 0.55 + 0.45 * hold.kRelease : 0.5);
  }

  /**
   * Fig. 1, the bang: the piece's first downbeat (the grid starts here). A rolled piano chord from D2, a few celesta
   * sparks falling (A5 down: the theme's own register), a string bloom, a felt boom, and the intro begins. `soft`: the
   * scroll's gentle release.
   * The click (the first screen's gate) gets it a little under the softest hold's; `delay` (s): when its burst comes
   * (after the crush).
   */
  private bang(strength: number, soft = false, delay = 0) {
    const t = this.now() + LEAD + delay;
    const s = soft ? 0.55 : 0.7 + 0.3 * clamp01(strength);
    this.followEnd(t, 0.25);
    this.anchor(t);
    this.cueBarAt = 0;
    const NOTES = [38, 50, 57, 62, 66, 69];
    const ROLL = [0, 0.025, 0.05, 0.08, 0.11, 0.15];
    const VEL = [0.42, 0.37, 0.33, 0.3, 0.28, 0.26];
    for (let i = 0; i < NOTES.length; i++)
      this.piano(NOTES[i], VEL[i] * s, t + ROLL[i], K_BANG, 1, false);
    const SPARK = [81, 78, 74, 69];
    for (let i = 0; i < SPARK.length; i++)
      this.bell(SPARK[i], (0.36 - 0.04 * i) * s, t + E8 + i * E16, K_BANG, 1);
    this.swell([50, 57, 62, 66], t, 3.1, 0.5 * s, 0.6, K_BANG, 1);
    // (the low string is let go before the bar line: the next bar's D2 is a new note, never one held across it)
    this.bass(38, 0.55 * s, t, BAR - 0.55, K_BANG, 1);
    this.kick(0.5 * s, t, K_BANG, 1);
  }

  /**
   * Fig. 3, a knot chosen: a warm piano fifth under a harp tone (B3 to F#4) for the heaviest; a lighter harp tone (D4
   * to A4) for the others. `again`: the choice changed soon after the last answer (softer). From the chord at its eighth.
   */
  private knot(i: number, byVisitor: boolean, again: boolean) {
    const t = this.q8(this.now() + LEAD);
    this.knotLast = i;
    this.at[K_KNOT] = t;
    this.queue(K_KNOT, t, i, (byVisitor ? 1 : 0.7) * (again ? 0.7 : 1));
  }

  /** Fig. 3, the ignition, on the next downbeat: a rolled D chord, the celesta rising (A4 to A5), a bloom; the build. */
  private ignite() {
    const sb = this.nextBeat();
    const t = this.stepTime(sb);
    this.forceBarAt = sb;
    this.cueBarAt = sb;
    this.restartNext = true;
    const NOTES = [38, 50, 57, 66, 69, 74];
    const ROLL = [0, 0.03, 0.07, 0.11, 0.15, 0.2];
    const VEL = [0.44, 0.38, 0.34, 0.31, 0.29, 0.27];
    for (let i = 0; i < NOTES.length; i++)
      this.piano(NOTES[i], VEL[i], t + ROLL[i], K_IGNITE, 1, false);
    const UP = [69, 74, 78, 81];
    for (let i = 0; i < UP.length; i++)
      this.bell(UP[i], 0.3 + 0.03 * i, t + (i + 1) * E16, K_IGNITE, 1);
    this.swell([62, 66, 69, 74], t, BAR, 0.55, 0.75, K_IGNITE, 1);
    this.bass(38, 0.6, t, BAR - 0.55, K_IGNITE, 1);
    this.kick(0.55, t, K_IGNITE, 1);
  }

  /**
   * Fig. 7, the launch: a rising run (the harp and the pizzicato together on the sixteenths, D3 to A4, from the next
   * eighth) into the next downbeat, where everyone takes the theme from its top (its first note the run's last).
   */
  private launch(byVisitor: boolean) {
    const tr = this.q8(this.now() + LEAD);
    const sr = Math.round((tr - this.t0) / E8);
    let sb = Math.max(this.si, sr + 2);
    sb += sb & 1;
    this.forceBarAt = sb;
    this.cueBarAt = -1;
    this.restartNext = true;
    const tb = this.stepTime(sb);
    const n = Math.min(8, Math.max(2, Math.round((tb - tr) / E16)));
    const RUN = [50, 52, 54, 57, 59, 62, 66, 69];
    const lv = byVisitor ? 1 : 0.8;
    for (let i = 0; i < n; i++) {
      const m = RUN[RUN.length - n + i];
      const ti = tb - (n - i) * E16;
      this.harp(m, (0.3 + (0.14 * i) / n) * lv, ti, K_LAUNCH, 1);
      this.pizz(m, (0.27 + (0.11 * i) / n) * lv, ti, K_LAUNCH, 1);
    }
    this.flyM = 59;
  }

  /** Fig. 7, a slingshot: one harp tone, a chord step higher each pass (B3 to E5), the piano softly an octave under. */
  private flyby() {
    const t = this.q8(this.now() + LEAD);
    this.at[K_FLYBY] = t;
    this.queue(K_FLYBY, t, 0, 0);
  }

  /**
   * Fig. 8, a city lighting: a soft harp tone of the chord (D4 to D5, never the same twice running), 1.4 to 2.2 s
   * apart, each a little softer than the last (the first lights are the ones you hear).
   */
  private city() {
    const t = this.q8(this.now() + LEAD);
    this.at[K_CITY] = t;
    this.cityGap = rand(1.4, 2.2);
    this.queue(
      K_CITY,
      t,
      rand(0.32, 0.37) * Math.max(0.65, 0.95 ** this.cityN++),
      rand(-0.45, 0.45),
    );
  }

  /**
   * Fig. 9, the push let go: a soft harp sigh falling through the chord on the eighths (D5 down to about A3: the storm
   * turned aside), each pluck a little slower and softer, each from the chord at its own eighth.
   */
  private sigh(t: number) {
    this.sighM = 76;
    for (let i = 0; i < 4; i++) this.queue(K_PUSH, t + i * E8, i, 0);
  }

  /**
   * Fig. 11, a platform star under the pointer: one harp tone, the star's own tone of the chord (D4 to D5), on the
   * next eighth. Never a run: at least 1.1 s between star notes (softer when they come close), each star at most once
   * every 4 s, so a pointer swept across the platforms leaves a few notes, not an arpeggio.
   */
  private star(slug: string) {
    const t = this.q8(this.now() + LEAD);
    const gap = t - this.at[K_STAR];
    if (gap < 1.1) return;
    let h = 0;
    for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
    if (t - this.starTimes[h & 63] < 4) return;
    this.starTimes[h & 63] = t;
    this.at[K_STAR] = t;
    this.queue(K_STAR, t, h, 0.4 * (0.6 + 0.4 * smooth((gap - 1.1) / 2.5)));
  }

  // ------------------------------------------------------------------------------------------------ the cues' notes

  /**
   * The chord sounding at time t: the bar being written, or the one before it (the grid is written ahead of the
   * clock, so an eighth already written can still be in the bar before).
   */
  private chordAt(t: number) {
    if (!this.gridOn) return this.chA;
    const s = Math.round((t - this.t0) / E8 - 0.49);
    if (s >= this.barStart) return this.chB >= 0 && s - this.barStart >= 4 ? this.chB : this.chA;
    return this.prevB >= 0 && s - this.prevStart >= 4 ? this.prevB : this.prevA;
  }

  /**
   * A cue's note on eighth t: if that eighth is already written it sounds now, from the chord at t; otherwise it waits
   * for the grid to reach it (stepAt → pending), so its tone comes from the chord that eighth really has (a change in
   * the middle of a bar, a new bar or section).
   */
  private queue(kind: number, t: number, a: number, b: number) {
    const s = Math.round((t - this.t0) / E8);
    if (!this.gridOn || s < this.si) {
      this.cueNote(kind, t, CHORDS[this.chordAt(t)], a, b);
      return;
    }
    for (let i = 0; i < QUEUE; i++) {
      if (this.qK[i] >= 0) continue;
      this.qK[i] = kind;
      this.qS[i] = s;
      this.qA[i] = a;
      this.qB[i] = b;
      return;
    }
  }

  /** The grid writes eighth si: the cue notes waiting for it sound, from its chord (a skipped eighth lets them go). */
  private pending(si: number, t: number, C: Chord, late: boolean) {
    for (let i = 0; i < QUEUE; i++) {
      const k = this.qK[i];
      if (k < 0 || this.qS[i] > si) continue;
      this.qK[i] = -1;
      if (!late && this.qS[i] === si) this.cueNote(k, t, C, this.qA[i], this.qB[i]);
    }
  }

  /** One cue's notes at t over chord C (a, b: the cue's own arguments). */
  private cueNote(kind: number, t: number, C: Chord, a: number, b: number) {
    if (kind === K_KNOT) {
      if (a === 1) {
        this.piano(C.pv[0], 0.28 * b, t, K_KNOT, 1, false);
        this.piano(C.pv[1], 0.24 * b, t + 0.02, K_KNOT, 1, false);
        this.harp(C.pv[3], 0.48 * b, t + E16, K_KNOT, 1);
      } else this.harp(C.pv[a === 0 ? 4 : 5], 0.34 * b, t, K_KNOT, 1);
    } else if (kind === K_FLYBY) {
      const m = this.toneStep(C, this.flyM, 1, 59, 76);
      this.flyM = m;
      this.harp(m, 0.4, t, K_FLYBY, 1);
      // (the piano an octave under, or with it where that would sink under G3: a small speaker keeps it)
      this.piano(m - 12 >= 55 ? m - 12 : m, m - 12 >= 55 ? 0.12 : 0.1, t, K_FLYBY, 1, false);
    } else if (kind === K_CITY) {
      const m = this.randomTone(C, 62, 74, this.lastCityNote);
      if (m <= 0) return;
      this.lastCityNote = m;
      this.harp(m, a, t, K_CITY, 1, b);
    } else if (kind === K_PUSH) {
      this.sighM = this.toneStep(C, this.sighM, -1, 57, 74);
      this.harp(this.sighM, 0.36 - 0.04 * a, t, K_PUSH, 1, Number.NaN, 0.016 + 0.002 * a);
    } else if (kind === K_STAR) {
      let n = 0;
      let m = 0;
      for (let x = 62; x <= 74; x++) if (inPcs(C.pcs, x)) n++;
      if (!n) return;
      let k = a % n;
      for (let x = 62; x <= 74; x++) {
        if (!inPcs(C.pcs, x)) continue;
        if (k-- === 0) {
          m = x;
          break;
        }
      }
      if (m === this.lastStarNote) m = this.toneStep(C, m, 1, 62, 74);
      this.lastStarNote = m;
      this.harp(m, b, t, K_STAR, 1, Math.max(-0.5, Math.min(0.5, hold.nx * 0.5)));
    } else if (kind === K_SKY) this.skyTone(C, a, t, b);
  }

  // ------------------------------------------------------------------------------------------------ helpers

  /** The next tone of the chord from `m` in direction `dir`, folded by octaves into [lo, hi]. */
  private toneStep(C: Chord, m: number, dir: number, lo: number, hi: number) {
    let x = m + dir;
    for (let i = 0; i < 12 && !inPcs(C.pcs, x); i++) x += dir;
    while (x > hi) x -= 12;
    while (x < lo) x += 12;
    return x;
  }

  /** A random tone of the chord in [lo, hi] other than `avoid` (0: none). */
  private randomTone(C: Chord, lo: number, hi: number, avoid: number) {
    let n = 0;
    for (let x = lo; x <= hi; x++) if (inPcs(C.pcs, x) && x !== avoid) n++;
    if (!n) return 0;
    let k = Math.floor(Math.random() * n);
    for (let x = lo; x <= hi; x++) {
      if (!inPcs(C.pcs, x) || x === avoid) continue;
      if (k-- === 0) return x;
    }
    return 0;
  }

  /** QA: an instrument left out of this render. */
  private muted(inst: number) {
    return this.only >= 0 && this.only !== inst;
  }

  /** Cue tails are shorter under reduced motion. */
  private rm() {
    return story.reducedMotion ? 0.7 : 1;
  }
}

export function createScore(ctx: AudioContext, opts?: ScoreOptions) {
  return new Score(ctx, opts);
}
