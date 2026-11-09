/**
 * QA for the score (dev builds, or a production build opened with ?qa): window.__sound.
 *  - levels(): RMS, peak (dBFS) and spectral centroid (Hz) of the last ~85 ms at the output (after the limiter).
 *  - meter(): from now on, a worklet measures every sample: RMS, peak, clipped samples and discontinuities (a 1 ms
 *    frame whose peak second difference jumps far above the running level: a click), and an analyser adds the
 *    spectrum ten times a second, all bucketed by tag(name). report(): the buckets (with each one's centroid).
 *  - figures(seconds, opts): the whole score rendered offline at each figure (the same steps the live loop takes, on a
 *    virtual clock): RMS, peak, centroid, energy above 1 kHz and 3 kHz, clicks, the DSP cost (CPU ms per second of
 *    audio), and the level a laptop (150 Hz high-pass) and a phone (450 Hz) would play. opts: { phone, lite } builds
 *    the score as on those devices. cues(): each gesture cue alone, offline: its peak and centroid.
 *  - held(seconds): at each figure, offline, the longest any one voice held one pitch (above -20 dB of its own peak:
 *    no voice of the score holds one for more than about 3.5 s), and how much the mix beats (in each third-octave band
 *    from 80 Hz to 1 kHz, every 2 s window's envelope searched for a modulation at 4-40 Hz: the worst depth, %).
 *  - journey(seconds): the whole show walked offline through the real score (story position, the hold, the bang and
 *    the visitor's outcomes driven as the page drives them, ~7 s a figure, cues along the way), at 44.1 kHz: levels per
 *    figure, the held-pitch log, the sections and chords it played; the WAV is left for wav(i). hook(seconds): the
 *    main section (fig. 4, the theme on the celesta) from the top of its phrase, the same way. reel(seconds, P): the
 *    gesture cues in turn (a knot, the launch and its slingshots, city lights, the push let go, stars, the sky's drag)
 *    over the band held at P (fig. 8 by default), the same way.
 *  - rec(true|false) records the output; wav(i) hands back a 16-bit WAV in base64 chunks.
 *  - click(): injects a deliberate click (an unramped step), to prove the detector sees one.
 *  - state(), info(): the context, the switch, the chord and palette, the note counts.
 */
import { shared } from "@/gl/shared";
import { hold, holdNow } from "@/lib/hold";
import { HOLD_KIND } from "@/lib/journey";
import { smooth } from "@/lib/math";
import { LAST_BEAT } from "@/lib/stations";
import { story } from "@/lib/story";
import { sound } from "./index";
import { CUE_NAMES, type CueName, type Score } from "./score";

const WORKLET = `
class QAMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.p1 = [0, 0]; this.p2 = [0, 0];
    this.fi = 0; this.fpk = 0; this.base = 0;
    // the first 50 ms only learn the running level (the history starts at zero: a false step otherwise)
    this.warmup = 50;
    this.ss = 0; this.n = 0; this.peak = 0; this.clip = 0; this.clicks = 0; this.worst = 0;
    this.rec = false; this.buf = null; this.bi = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'rec1') { this.rec = true; }
      if (e.data === 'rec0') { this.rec = false; this.flushRec(); }
    };
  }
  flushRec() {
    if (this.buf && this.bi > 0) this.port.postMessage({ rec: [this.buf[0].slice(0, this.bi), this.buf[1].slice(0, this.bi)] });
    this.buf = null; this.bi = 0;
  }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || !inp[0]) return true;
    const L = inp[0], R = inp[1] || inp[0];
    for (let i = 0; i < L.length; i++) {
      for (let c = 0; c < 2; c++) {
        const x = c ? R[i] : L[i];
        const a = Math.abs(x);
        this.ss += x * x; this.n++;
        if (a > this.peak) this.peak = a;
        if (a >= 0.999) this.clip++;
        const d2 = Math.abs(x - 2 * this.p1[c] + this.p2[c]);
        if (d2 > this.fpk) this.fpk = d2;
        this.p2[c] = this.p1[c]; this.p1[c] = x;
      }
      if (++this.fi === 48) {
        const r = this.fpk / Math.max(this.base, 0.002);
        if (this.warmup > 0) this.warmup--;
        else {
          if (this.fpk > 0.012 && r > 6) { this.clicks++; }
          if (r > this.worst && this.fpk > 0.012) this.worst = r;
        }
        this.base += (this.fpk - this.base) * (this.fpk > this.base ? 0.08 : 0.02);
        this.fi = 0; this.fpk = 0;
      }
    }
    if (this.rec) {
      if (!this.buf) { this.buf = [new Float32Array(8192), new Float32Array(8192)]; this.bi = 0; }
      this.buf[0].set(L, this.bi); this.buf[1].set(R, this.bi); this.bi += L.length;
      if (this.bi >= 8192) { this.port.postMessage({ rec: this.buf }); this.buf = null; }
    }
    if (currentFrame % 2048 < 128) {
      this.port.postMessage({ ss: this.ss, n: this.n, peak: this.peak, clip: this.clip, clicks: this.clicks, worst: this.worst });
      this.ss = 0; this.n = 0; this.peak = 0; this.clip = 0; this.clicks = 0; this.worst = 0;
    }
    return true;
  }
}
registerProcessor('qa-meter', QAMeter);
`;

type Bucket = {
  ss: number;
  n: number;
  peak: number;
  clip: number;
  clicks: number;
  worst: number;
  fNum: number;
  fDen: number;
};

const dB = (x: number) => (x > 0 ? Math.round(2000 * Math.log10(x)) / 100 : -200);

let current: Score | null = null;
let analyser: AnalyserNode | null = null;
let td: Float32Array<ArrayBuffer> | null = null;
let fd: Float32Array<ArrayBuffer> | null = null;
let node: AudioWorkletNode | null = null;
let tag = "untagged";
const buckets = new Map<string, Bucket>();
let recL: Float32Array[] = [];
let recR: Float32Array[] = [];
let wavB64: string[] = [];

export function attachQA(s: Score) {
  current = s;
  analyser = s.ctx.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0;
  td = new Float32Array(analyser.fftSize);
  fd = new Float32Array(analyser.frequencyBinCount);
  s.tap.connect(analyser);
}

function bucket() {
  let b = buckets.get(tag);
  if (!b) {
    b = { ss: 0, n: 0, peak: 0, clip: 0, clicks: 0, worst: 0, fNum: 0, fDen: 0 };
    buckets.set(tag, b);
  }
  return b;
}

/** The power-weighted spectral centroid of the analyser's current frame: [Σ f·p, Σ p]. */
function spectrum(): [number, number] {
  if (!analyser || !fd || !current) return [0, 0];
  analyser.getFloatFrequencyData(fd);
  const binHz = current.ctx.sampleRate / analyser.fftSize;
  let num = 0;
  let den = 0;
  for (let k = 1; k < fd.length; k++) {
    const p = 10 ** (fd[k] / 10);
    num += k * binHz * p;
    den += p;
  }
  return [num, den];
}

async function meter() {
  const s = current;
  if (!s || node) return !!node;
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
  await s.ctx.audioWorklet.addModule(url);
  node = new AudioWorkletNode(s.ctx, "qa-meter", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 2,
    channelCountMode: "explicit",
  });
  node.port.onmessage = (e) => {
    const d = e.data;
    if (d.rec) {
      recL.push(d.rec[0]);
      recR.push(d.rec[1]);
      return;
    }
    const b = bucket();
    b.ss += d.ss;
    b.n += d.n;
    b.peak = Math.max(b.peak, d.peak);
    b.clip += d.clip;
    b.clicks += d.clicks;
    b.worst = Math.max(b.worst, d.worst);
  };
  s.tap.connect(node);
  window.setInterval(() => {
    if (s.ctx.state !== "running") return;
    const [num, den] = spectrum();
    const b = bucket();
    b.fNum += num;
    b.fDen += den;
  }, 100);
  return true;
}

// ---- offline analysis: an FFT over the rendered buffer

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    const h = len >> 1;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < h; k++) {
        const c = Math.cos(a * k);
        const s = Math.sin(a * k);
        const xr = re[i + k + h] * c - im[i + k + h] * s;
        const xi = re[i + k + h] * s + im[i + k + h] * c;
        re[i + k + h] = re[i + k] - xr;
        im[i + k + h] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
}

/** RMS, peak, centroid, energy above 1 and 3 kHz, and clicks of a rendered buffer from `from` seconds (to `to`). */
function analyze(buf: AudioBuffer, from = 0, to = Number.POSITIVE_INFINITY) {
  const sr = buf.sampleRate;
  const L0 = buf.getChannelData(0);
  const R0 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L0;
  const end = Math.min(L0.length, Math.floor(to * sr));
  const L = L0.subarray(0, end);
  const R = R0.subarray(0, end);
  const i0 = Math.floor(from * sr);
  const n = L.length;
  const laptopDb = highpass(L, R, i0, sr, 150);
  const phoneDb = highpass(L, R, i0, sr, 450);
  let ss = 0;
  let pk = 0;
  let pkAt = 0;
  for (let i = i0; i < n; i++) {
    ss += L[i] * L[i] + R[i] * R[i];
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > pk) {
      pk = a;
      pkAt = i;
    }
  }
  const N = 4096;
  const pow = new Float64Array(N / 2);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let s = i0; s + N <= n; s += N / 2) {
    for (let i = 0; i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      re[i] = 0.5 * (L[s + i] + R[s + i]) * w;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 1; k < N / 2; k++) pow[k] += re[k] * re[k] + im[k] * im[k];
  }
  let num = 0;
  let den = 0;
  let a1 = 0;
  let a3 = 0;
  const band = [0, 0, 0, 0];
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N;
    num += f * pow[k];
    den += pow[k];
    if (f > 1000) a1 += pow[k];
    if (f > 3000) a3 += pow[k];
    band[f < 150 ? 0 : f < 400 ? 1 : f < 1000 ? 2 : 3] += pow[k];
  }
  // clicks: the same detector as the live meter, over the left channel
  let base = 0;
  let clicks = 0;
  let p1 = 0;
  let p2 = 0;
  let fpk = 0;
  let fi = 0;
  let warm = 50;
  const F = Math.round(sr / 1000);
  for (let i = i0; i < n; i++) {
    const x = L[i];
    const d2 = Math.abs(x - 2 * p1 + p2);
    p2 = p1;
    p1 = x;
    if (d2 > fpk) fpk = d2;
    if (++fi === F) {
      const r = fpk / Math.max(base, 0.002);
      if (warm > 0) warm--;
      else if (fpk > 0.012 && r > 6) clicks++;
      base += (fpk - base) * (fpk > base ? 0.08 : 0.02);
      fi = 0;
      fpk = 0;
    }
  }
  return {
    rmsDb: dB(Math.sqrt(ss / Math.max(1, 2 * (n - i0)))),
    peakDb: dB(pk),
    peakAt: Math.round((pkAt / sr) * 100) / 100,
    centroidHz: Math.round(num / Math.max(1e-20, den)),
    over1k: Math.round((1000 * a1) / Math.max(1e-20, den)) / 10,
    over3k: Math.round((1000 * a3) / Math.max(1e-20, den)) / 10,
    /** Energy share (%) below 150 Hz, 150-400, 400-1000 and above 1 kHz. */
    bands: band.map((x) => Math.round((100 * x) / Math.max(1e-20, den))).join("/"),
    /** The level through a laptop's speaker (150 Hz high-pass) and a phone's (450 Hz), dBFS RMS (mono sum). */
    laptopDb,
    phoneDb,
    clicks,
  };
}

/** A 4th-order high-pass (two RBJ biquads, Q 0.707) of the mono sum: what a small speaker can play. */
function highpass(L: Float32Array, R: Float32Array, i0: number, sr: number, fc: number) {
  const n = L.length;
  let y = new Float64Array(n - i0);
  for (let i = i0; i < n; i++) y[i - i0] = 0.5 * (L[i] + R[i]);
  for (let stage = 0; stage < 2; stage++) {
    const w0 = (2 * Math.PI * fc) / sr;
    const al = Math.sin(w0) / (2 * Math.SQRT1_2);
    const c = Math.cos(w0);
    const a0 = 1 + al;
    const b0 = (1 + c) / 2 / a0;
    const b1 = -(1 + c) / a0;
    const a1 = (-2 * c) / a0;
    const a2 = (1 - al) / a0;
    const o = new Float64Array(y.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = b0 * y[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = y[i];
      y2 = y1;
      y1 = v;
      o[i] = v;
    }
    y = o;
  }
  let ss = 0;
  for (let i = 0; i < y.length; i++) ss += y[i] * y[i];
  return dB(Math.sqrt(ss / Math.max(1, y.length)));
}

/**
 * How much a rendered buffer beats: third-octave bands 80 Hz-1 kHz (RBJ band-passes), each band's 1 ms RMS envelope,
 * 2 s windows (hop 0.5 s, detrended, Hann), the deepest modulation at 4-40 Hz (% of the window's mean envelope). Bands
 * more than 30 dB under the window's loudest band are skipped (nothing to hear there).
 */
function beating(buf: AudioBuffer, from = 0) {
  const sr = buf.sampleRate;
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const i0 = Math.floor(from * sr);
  const n = L.length - i0;
  const FR = Math.round(sr / 1000);
  const nf = Math.floor(n / FR);
  const bands = [80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000];
  const envs = bands.map((fc) => {
    const w0 = (2 * Math.PI * fc) / sr;
    const q = 4.32;
    const al = Math.sin(w0) / (2 * q);
    const a0 = 1 + al;
    const b0 = al / a0;
    const a1 = (-2 * Math.cos(w0)) / a0;
    const a2 = (1 - al) / a0;
    const e = new Float64Array(nf);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let f = 0; f < nf; f++) {
      let ss = 0;
      for (let k = 0; k < FR; k++) {
        const x = 0.5 * (L[i0 + f * FR + k] + R[i0 + f * FR + k]);
        const v = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = v;
        ss += v * v;
      }
      e[f] = Math.sqrt(ss / FR);
    }
    return e;
  });
  const W = 2000;
  const hann = new Float64Array(W);
  let hs = 0;
  for (let i = 0; i < W; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (W - 1));
    hs += hann[i];
  }
  // the probe frequencies' cosines and sines, once
  const NFQ = 73;
  const cs = new Float64Array(NFQ * W);
  const sn = new Float64Array(NFQ * W);
  for (let q = 0; q < NFQ; q++) {
    const k = (2 * Math.PI * (4 + q * 0.5)) / 1000;
    for (let i = 0; i < W; i++) {
      cs[q * W + i] = Math.cos(k * i);
      sn[q * W + i] = Math.sin(k * i);
    }
  }
  const depths: number[] = [];
  let worst = 0;
  let where = "";
  const d = new Float64Array(W);
  for (let s0 = 0; s0 + W <= nf; s0 += 500) {
    const means = envs.map((e) => {
      let m = 0;
      for (let i = 0; i < W; i++) m += e[s0 + i];
      return m / W;
    });
    const loud = Math.max(...means);
    for (let b = 0; b < bands.length; b++) {
      const e = envs[b];
      const mean = means[b];
      if (mean < loud * 0.0316 || mean <= 0) continue;
      // detrend (a crossfade's slow slope is not a beat)
      let sx = 0;
      let sxy = 0;
      for (let i = 0; i < W; i++) {
        sx += i;
        sxy += i * e[s0 + i];
      }
      const xm = sx / W;
      let vx = 0;
      for (let i = 0; i < W; i++) vx += (i - xm) * (i - xm);
      const slope = (sxy - xm * mean * W) / vx;
      for (let i = 0; i < W; i++) d[i] = (e[s0 + i] - mean - slope * (i - xm)) * hann[i];
      let best = 0;
      let bestF = 0;
      for (let q = 0; q < NFQ; q++) {
        let re = 0;
        let im = 0;
        const o = q * W;
        for (let i = 0; i < W; i++) {
          re += d[i] * cs[o + i];
          im += d[i] * sn[o + i];
        }
        const a = (2 * Math.hypot(re, im)) / hs / mean;
        if (a > best) {
          best = a;
          bestF = 4 + q * 0.5;
        }
      }
      depths.push(best);
      if (best > worst) {
        worst = best;
        where = `${bands[b]} Hz band, ${bestF} Hz, at ${((s0 + W / 2) / 1000 + from).toFixed(1)} s`;
      }
    }
  }
  depths.sort((a, b) => a - b);
  const pct = (q: number) =>
    Math.round(1000 * (depths[Math.min(depths.length - 1, Math.floor(q * depths.length))] ?? 0)) /
    10;
  return { worstPct: Math.round(1000 * worst) / 10, p95Pct: pct(0.95), medianPct: pct(0.5), where };
}

type RenderOpts = { phone?: boolean; lite?: boolean; sr?: number; only?: number; noRoom?: boolean };

/** Render the score offline at P (or one cue at 0.3 s over a muted band). */
async function renderAt(seconds: number, P: number, cue?: CueName, o: RenderOpts = {}) {
  const { Score } = await import("./score");
  const sr = o.sr ?? 48000;
  const c = new OfflineAudioContext(2, Math.round(sr * seconds), sr);
  const s = new Score(c as unknown as AudioContext, {
    phone: !!o.phone,
    lite: !!o.lite,
    only: o.only,
    noRoom: o.noRoom,
  });
  s.qaRender(seconds, P, cue);
  return finish(s, c, seconds);
}

/**
 * Render. Every `every` seconds the render pauses: the voices that have ended leave the graph (as they do live), and
 * `advance` (a streamed render) schedules the next stretch, so the graph holds what the live loop holds (the next
 * fraction of a second, not the whole render) and the cost measured is the live score's. `cpuMs` counts the render's
 * own time only (the pauses left out).
 */
async function finish(
  s: Score,
  c: OfflineAudioContext,
  seconds: number,
  advance?: (until: number) => void,
  every = 3,
) {
  let render = 0;
  let tw = 0;
  const win: number[] = [];
  let winMs = 0;
  advance?.(every);
  for (let x = every; x < seconds - 1e-3; x += every) {
    void c.suspend(x).then(() => {
      const d = performance.now() - tw;
      render += d;
      winMs += d;
      if (Math.round(x / every) % Math.max(1, Math.round(3 / every)) === 0) {
        win.push(Math.round(winMs / 3));
        winMs = 0;
      }
      s.qaGc(x);
      advance?.(x + every);
      tw = performance.now();
      return c.resume();
    });
  }
  tw = performance.now();
  const buf = await c.startRendering();
  render += performance.now() - tw;
  return {
    buf,
    cpuMsPerSec: Math.round((render / seconds) * 10) / 10,
    /** The render's cost per second of audio in each 3 s window. */
    cpuWindows: win.join(" "),
    notes: Array.from(s.counts).reduce((a, b) => a + b, 0),
    chords: s.chordChanges,
    changes: (s.qaChords ?? []).map(([t, c]) => `${t}s ${c}`).join(", "),
    sections: (s.qaSections ?? []).map(([t, n]) => `${t}s ${n}`).join(", "),
    held: s.qaHeld(),
    /** The harp's notes (the gesture cues) against the chord at each one's time, and the grid (Score.qaKey). */
    key: s.qaKey(),
    /** The celesta's notes ("seconds:MIDI"), to read the theme back from the render. */
    celesta: celestaNotes(s),
  };
}

/** The celesta's notes of a render, from the score's voice log. */
function celestaNotes(s: Score) {
  const L = s.qaLog;
  const out: string[] = [];
  for (let i = 0; i < L.length; i += 4)
    if (L[i + 2] === 1) out.push(`${L[i].toFixed(2)}:${L[i + 1]}`);
  return out.join(" ");
}

// ---- the journey walked offline: the page's own singletons (story, hold, shared.play) driven as the show drives them

/**
 * Seconds per figure in the walk (about 7 each: less for figs. 2, 10 and 11, more for the storm, so its dark
 * phrase is heard before the aurora), 84 s in all, then 6 s of the record rising; the walk's story position at time t.
 */
const FIG = 7;
const FIGS = [7, 5, 7, 7, 7, 7, 7, 7, 11, 6, 6, 7];
function walkP(t: number) {
  let a = 0;
  for (let f = 0; f < FIGS.length; f++) {
    if (t < a + FIGS[f]) return f + (t - a) / FIGS[f];
    a += FIGS[f];
  }
  return 12 + ((t - a) / 6) * 1.25;
}
/** When the walk reaches figure f (s). */
const figAt = (f: number) => FIGS.slice(0, f).reduce((a, b) => a + b, 0);
/** The visitor's moments, in story position: slingshots, platform stars under the pointer. */
const FLYBYS = [6.26, 6.43, 6.6, 6.77];
const STARS: [number, string][] = [
  [10.29, "nuqta"],
  [10.51, "wafra"],
  [10.74, "steer"],
];

/** The walk's own visitor between steps (the page's hold module runs between the streamed stretches). */
type Walker = { k: number; banged: boolean; push: number };

/** The visitor of the walk at time t: fig. 1's hold and bang, a knot chosen, the launch, the storm's push, stars, the sky's drag. */
function drive(t: number, P: number, dt: number, w: Walker) {
  const play = shared.play;
  story.Ts = Math.min(P, LAST_BEAT);
  story.after = Math.max(0, P - LAST_BEAT);
  story.T = story.Ts;
  story.afterT = story.after;
  story.vTs = 1 / FIG;
  story.rest = 0;
  const gather = t >= 0.8 && t < 3.0;
  const push = P >= 8.39 && P < 8.58;
  const drag = P >= 11.36 && P < 11.66;
  // the release of fig. 1's hold is the bang (src/lib/hold.ts triggerBang)
  if (t >= 3.0 && !w.banged) {
    w.banged = true;
    hold.kRelease = w.k;
  }
  hold.bangAt = w.banged ? 1 : -1;
  hold.releaseAt = w.banged ? 1 : -1;
  hold.gentle = false;
  hold.quiet = false;
  hold.pressing = gather || push;
  hold.down = hold.pressing || drag;
  hold.live = hold.pressing && holdNow() !== HOLD_KIND.none;
  w.k = hold.live ? Math.min(1, w.k + dt / 1.4) : Math.max(0, w.k - dt * 1.6);
  hold.k = w.k;
  hold.vx = drag ? 320 : 0;
  hold.nx = drag ? 0.2 : 0;
  play.center = P >= 2.3 ? 1 : -1;
  play.centerByVisitor = P >= 2.3;
  shared.sunOn = P >= 2.9 ? 1 : 0;
  play.aligned = P >= 4.55 ? 1 : 0.4;
  play.launchT = P >= 6.11 ? 6.11 : -1;
  play.launchByVisitor = P >= 6.11;
  let fly = 0;
  for (const x of FLYBYS) if (x <= P) fly++;
  play.flybys = fly;
  play.cities = P >= 7.04 ? Math.min(40, Math.floor((P - 7.04) / 0.05) + 1) : 0;
  // fig. 9: the field at rest strengthens over the figure (layout.ts fieldRestAt), the push takes it toward full
  const k9 = P - 8;
  const rest = k9 < 0 ? 0 : 0.48 + 0.52 * smooth((k9 - 0.16) / 0.4);
  w.push = push ? Math.min(1, w.push + dt / 0.4) : Math.max(0, w.push - dt);
  play.field = rest + (1 - rest) * w.push;
  let star = "";
  for (const [at, slug] of STARS) if (P >= at && P < at + 0.08) star = slug;
  play.hoverStar = star;
}

/**
 * Render the walk (or, with `P`, one place held still: a visitor resting there) offline through the real score,
 * streamed: each stretch is scheduled with the page's singletons set to the walk's visitor, and given back after.
 */
async function walk(
  seconds: number,
  sr: number,
  P?: number,
  only?: number,
  fires?: readonly Fire[],
  solo = false,
  o: RenderOpts = {},
) {
  const { Score } = await import("./score");
  const c = new OfflineAudioContext(2, Math.round(sr * seconds), sr);
  const dt = 0.05;
  const w: Walker = { k: 0, banged: P !== undefined, push: 0 };
  let i = 0;
  let s: Score | null = null;
  const stretch = (fn: () => void) => {
    const saved = {
      hold: { ...hold },
      play: { ...shared.play },
      sunOn: shared.sunOn,
      story: { ...story },
    };
    try {
      fn();
    } finally {
      Object.assign(hold, saved.hold);
      Object.assign(shared.play, saved.play);
      shared.sunOn = saved.sunOn;
      Object.assign(story, saved.story);
    }
  };
  stretch(() => {
    Object.assign(hold, {
      bangAt: P === undefined ? -1 : 1,
      k: 0,
      kRelease: 0,
      pressing: false,
      down: false,
      live: false,
      gentle: false,
      quiet: false,
    });
    Object.assign(shared.play, {
      center: -1,
      centerByVisitor: false,
      launchT: -1,
      flybys: 0,
      cities: 0,
      field: 0,
      aligned: 0,
      hoverStar: "",
    });
    shared.sunOn = 0;
    story.rest = 0;
    s = new Score(c as unknown as AudioContext, { phone: !!o.phone, lite: !!o.lite, only });
    s.qaBegin(P !== undefined);
    s.soloCues(solo);
  });
  const score = s as unknown as Score;
  const advance = (until: number) =>
    stretch(() => {
      for (; i * dt < Math.min(until, seconds); i++) {
        const t = i * dt;
        const p = P ?? walkP(t);
        if (P === undefined) drive(t, p, dt, w);
        else {
          story.Ts = Math.min(P, LAST_BEAT);
          story.after = Math.max(0, P - LAST_BEAT);
          story.rest = 0;
          hold.pressing = hold.down = hold.live = false;
        }
        score.qaStep(t, p);
        // (the reel: a gesture cue fired at its moment, over the band, after the step that reaches it)
        if (fires)
          for (const [at, name, arg] of fires) if (at >= t && at < t + dt) score.fire(name, arg);
      }
    });
  return finish(score, c, seconds, advance, 1);
}

/** A gesture cue fired at a moment of a reel: [seconds, cue, argument]. */
type Fire = readonly [number, CueName, number];
/**
 * The reel (reel()): every gesture cue in turn over one section of the band (fig. 8 by default), as the visitor would
 * set them off: a knot chosen, the launch and four slingshots, city lights, the push let go, platform stars (1.5 s
 * apart: the score keeps 1.1 s between star notes, after each is put on its eighth), the drag.
 */
const REEL: readonly Fire[] = [
  [0.6, "knot", 1],
  [2.0, "launch", 1],
  [3.4, "flyby", 1],
  [4.5, "flyby", 2],
  [5.6, "flyby", 3],
  [6.7, "flyby", 4],
  [8.0, "city", 1],
  [9.4, "city", 1],
  [10.9, "city", 1],
  [12.0, "push", 1],
  [13.7, "star", 1],
  [15.2, "star", 2],
  [16.7, "star", 3],
  [17.6, "sky", 1],
  [18.3, "sky", 1],
  [19.0, "sky", 1],
];

/** A 16-bit stereo WAV of a rendered buffer, kept in base64 chunks for wav(i); returns the chunk count. */
function wavOf(buf: AudioBuffer) {
  const n = buf.length;
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const out = new ArrayBuffer(44 + n * 4);
  const v = new DataView(out);
  header(v, n, buf.sampleRate);
  let o = 44;
  for (let i = 0; i < n; i++) {
    v.setInt16(o, Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), true);
    v.setInt16(o + 2, Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), true);
    o += 4;
  }
  return chunk(new Uint8Array(out));
}

function header(v: DataView, n: number, sr: number) {
  const str = (o: number, x: string) => {
    for (let i = 0; i < x.length; i++) v.setUint8(o + i, x.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 4, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 4, true);
}

function chunk(bytes: Uint8Array) {
  wavB64 = [];
  const CH = 3 << 20;
  for (let i = 0; i < bytes.length; i += CH) {
    let bin = "";
    const end = Math.min(bytes.length, i + CH);
    for (let j = i; j < end; j += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(j, Math.min(end, j + 0x8000)));
    wavB64.push(btoa(bin));
  }
  return wavB64.length;
}

/** Levels of a render: the whole, the music (past the start), each figure's stretch of a walk. */
function report(r: Awaited<ReturnType<typeof finish>>, perFig: boolean) {
  const out: Record<string, unknown> = {
    whole: analyze(r.buf, 0),
    music: analyze(r.buf, perFig ? 3 : 2, perFig ? figAt(12) : Number.POSITIVE_INFINITY),
    held: r.held,
    cpuMsPerSec: r.cpuMsPerSec,
    cpuWindows: r.cpuWindows,
    voices: r.notes,
    sections: r.sections,
    celesta: r.celesta,
    chords: r.changes,
    beating: beating(r.buf, perFig ? 3 : 2),
  };
  if (perFig) {
    const figs: Record<string, unknown> = {};
    for (let f = 0; f < 12; f++) {
      const a = analyze(r.buf, figAt(f), figAt(f + 1));
      figs[`fig ${f + 1}`] = {
        rmsDb: a.rmsDb,
        peakDb: a.peakDb,
        centroidHz: a.centroidHz,
        clicks: a.clicks,
      };
    }
    const e = analyze(r.buf, figAt(12));
    figs.ending = { rmsDb: e.rmsDb, peakDb: e.peakDb };
    out.figures = figs;
  }
  return out;
}

export function exposeQA(getScore: () => Score | null, getCtx: () => AudioContext | null) {
  (window as unknown as { __sound: unknown }).__sound = {
    state: () => {
      const s = getScore();
      const c = getCtx();
      const counts: Record<string, number> = {};
      if (s)
        CUE_NAMES.forEach((name, i) => {
          counts[name] = s.counts[i];
        });
      return {
        ctx: c?.state ?? "none",
        on: sound.on,
        waiting: sound.waiting,
        playing: sound.playing,
        volume: sound.volume,
        chordChanges: s?.chordChanges ?? 0,
        counts,
      };
    },
    levels: () => {
      if (!analyser || !td) return null;
      analyser.getFloatTimeDomainData(td);
      let ss = 0;
      let pk = 0;
      for (let i = 0; i < td.length; i++) {
        ss += td[i] * td[i];
        pk = Math.max(pk, Math.abs(td[i]));
      }
      const [num, den] = spectrum();
      return {
        rmsDb: dB(Math.sqrt(ss / td.length)),
        peakDb: dB(pk),
        centroidHz: Math.round(num / Math.max(1e-20, den)),
      };
    },
    meter,
    tag: (name: string) => {
      tag = name;
    },
    report: () => {
      const out: Record<string, unknown> = {};
      for (const [k, b] of buckets)
        out[k] = {
          rmsDb: dB(Math.sqrt(b.ss / Math.max(1, b.n))),
          peakDb: dB(b.peak),
          centroidHz: Math.round(b.fNum / Math.max(1e-20, b.fDen)),
          clipped: b.clip,
          clicks: b.clicks,
          worst: Math.round(b.worst * 10) / 10,
          seconds: Math.round((b.n / 2 / (current?.ctx.sampleRate ?? 48000)) * 10) / 10,
        };
      return out;
    },
    reset: () => buckets.clear(),
    rec: (on: boolean) => node?.port.postMessage(on ? "rec1" : "rec0"),
    wav: (i: number) => (i < 0 ? encodeWav() : (wavB64[i] ?? null)),
    solo: (on: boolean) => getScore()?.soloCues(on),
    info: () => getScore()?.qaInfo(),
    timing: (on: boolean) => {
      const s = getScore();
      if (!s) return;
      s.timing = on;
      s.cpuMs = 0;
      s.frames = 0;
    },
    fire: (name: CueName, arg?: number) => getScore()?.fire(name, arg),
    /** Every figure rendered offline (from 2 s on, a section held still: its phrases loop as a resting visitor hears them). */
    figures: async (seconds = 24, o: RenderOpts = {}) => {
      const out: Record<string, unknown> = {};
      for (const P of [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.3]) {
        const r = await renderAt(seconds, P, undefined, o);
        out[`fig ${P < 12 ? Math.floor(P) + 1 : "end"} (P ${P})`] = {
          ...analyze(r.buf, 2),
          cpuMsPerSec: r.cpuMsPerSec,
          voices: r.notes,
          held: r.held.seconds,
        };
      }
      return out;
    },
    /** One place, each instrument alone and all of them (with and without the room): level, balance, DSP cost. */
    parts: async (seconds = 20, P = 6.5, o: RenderOpts = {}) => {
      const { INST_NAMES } = await import("./score");
      const out: Record<string, unknown> = {};
      const row = (r: Awaited<ReturnType<typeof renderAt>>) => {
        const a = analyze(r.buf, 2);
        return {
          rmsDb: a.rmsDb,
          peakDb: a.peakDb,
          centroidHz: a.centroidHz,
          bands: a.bands,
          cpuMsPerSec: r.cpuMsPerSec,
          voices: r.notes,
        };
      };
      out.all = row(await renderAt(seconds, P, undefined, o));
      out["all, no room"] = row(await renderAt(seconds, P, undefined, { ...o, noRoom: true }));
      for (let i = 0; i < INST_NAMES.length; i++)
        out[INST_NAMES[i]] = row(await renderAt(seconds, P, undefined, { ...o, only: i }));
      return out;
    },
    /** At each figure: the longest held pitch (one voice, above -20 dB of its peak) and how much the mix beats. */
    held: async (seconds = 32, o: RenderOpts = {}) => {
      const out: Record<string, unknown> = {};
      for (const P of [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5]) {
        const r = await renderAt(seconds, P, undefined, o);
        out[`fig ${Math.floor(P) + 1} (P ${P})`] = {
          held: r.held,
          beating: beating(r.buf, 2),
          sections: r.sections,
        };
      }
      return out;
    },
    /** The show walked offline (44.1 kHz): levels per figure, held pitches, sections; then wav(i) hands back the WAV. */
    journey: async (seconds = 90, only?: number) => {
      const r = await walk(seconds, 44100, undefined, only);
      const out = report(r, true);
      out.wavChunks = wavOf(r.buf);
      return out;
    },
    /** The main section with the hook (fig. 4: the theme on the celesta, from the top of its phrase), offline at 44.1 kHz. */
    hook: async (seconds = 30, P = 3.5, only?: number) => {
      const r = await walk(seconds, 44100, P, only);
      const out = report(r, false);
      out.wavChunks = wavOf(r.buf);
      return out;
    },
    /**
     * The gesture cues in turn over the band held at P (fig. 8 by default; `solo`: the band muted; opts: { phone, lite }
     * builds the score as on those devices), offline; then wav(i).
     */
    reel: async (seconds = 20, P = 7.5, solo = false, o: RenderOpts = {}) => {
      const r = await walk(seconds, 44100, P, undefined, REEL, solo, o);
      const out = report(r, false);
      out.wavChunks = wavOf(r.buf);
      return out;
    },
    /**
     * The gesture cues against the harmony: the band held at P, the band muted, a cue fired every 0.29 s (across the
     * eighths, so cues land on every place of the bar: the split bars' second chords too), in turn a city, the push's
     * sigh, a star, a slingshot, a knot, the sky's drag; every harp note is checked against the chord sounding at its
     * own time (Score.qaKey).
     */
    keys: async (seconds = 40, P = 7.5) => {
      const names: CueName[] = ["city", "push", "star", "flyby", "knot", "sky"];
      const fires: Fire[] = [];
      for (let k = 0, t = 0.7; t < seconds - 2; k++, t += 0.29)
        fires.push([t, names[k % names.length], k]);
      const r = await walk(seconds, 22050, P, undefined, fires, true);
      return { P, ...r.key, sections: r.sections };
    },
    /** Each gesture cue alone, rendered offline over a muted band. */
    cues: async (seconds = 10) => {
      const out: Record<string, unknown> = {};
      const at: Record<string, number> = {
        bang: 0.5,
        rise: 0.3,
        knot: 2.5,
        ignite: 2.86,
        launch: 6.1,
        flyby: 6.5,
        city: 7.3,
        pull: 4.3,
        push: 8.4,
        star: 10.6,
        sky: 11.5,
      };
      for (const name of CUE_NAMES) {
        if (name === "note") continue;
        const r = await renderAt(seconds, at[name] ?? 4.5, name);
        out[name] = { ...analyze(r.buf, 0), notes: r.notes };
      }
      return out;
    },
    /** One cue alone at story position P, rendered offline (its WAV left for wav(i); opts as figures()). */
    cue: async (name: CueName, P: number, seconds = 8, o: RenderOpts = {}) => {
      const r = await renderAt(seconds, P, name, { sr: 44100, ...o });
      return { ...analyze(r.buf, 0), notes: r.notes, wavChunks: wavOf(r.buf) };
    },
    click: () => {
      // a deliberate fault: a 0.05 step switched on and off without a ramp
      const s = getScore();
      if (!s) return;
      const ctx = s.ctx;
      const src = ctx.createConstantSource();
      const g = ctx.createGain();
      g.gain.value = 0.05;
      src.connect(g).connect(s.tap);
      const t = ctx.currentTime + 0.02;
      src.start(t);
      src.stop(t + 0.03);
    },
  };
}

function encodeWav() {
  const s = current;
  if (!s) return 0;
  let n = 0;
  for (const a of recL) n += a.length;
  const sr = s.ctx.sampleRate;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  header(v, n, sr);
  let o = 44;
  for (let k = 0; k < recL.length; k++) {
    const L = recL[k];
    const R = recR[k];
    for (let i = 0; i < L.length; i++) {
      v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true);
      o += 4;
    }
  }
  recL = [];
  recR = [];
  return chunk(new Uint8Array(buf));
}
