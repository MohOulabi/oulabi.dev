"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { loopPath, pick, rng, seedOf, wobble } from "@/bridges/ink-geom";
import { PRINT, type PrintMark } from "@/content/ink";
import type { FigureId } from "@/lib/journey";

/**
 * The journal printed (docs/STORY.md, "Lovely details": reduced motion, the static tier or no JavaScript): a still per
 * figure in the plate's 16:10, its bodies painted in CSS gradients (globals.css .still-<id>, and here the planets that
 * sit on the planned route), its ink drawn over it (src/content/ink.ts PRINT: hairlines in an SVG, the words as text
 * at 11 px whatever the plate's size), then its caption and lines (src/components/sections/show.tsx).
 *
 * The dense art (the murmuration, the sky's long-exposure trails) is drawn from a seeded generator on the client only
 * while html.flow is set, so the staged page carries none of it; without JS the CSS stills stand in.
 */

const f1 = (v: number) => Math.round(v * 10) / 10;

/** The plate's units: the still is 1600 × 1000. */
const W = 1600;
const H = 1000;

/* ---------------------------------------------------------------- the planned route (Fig. 6, 7), in plate units */

const SUN: [number, number] = [800, 520];
const U = 500;
const ROUTE = [
  [-0.1, 0.04],
  [-0.34, 0.2],
  [-0.12, 0.36],
  [0.26, 0.3],
  [0.56, 0.08],
  [0.8, -0.24],
];
/**
 * Where each planet waits on the route (0 ember, 1 gold, 2 the world at its end, 3 the ringed giant, 4 ice), in the
 * GL's flyby order (figures/probe.ts ORDER): product (gold) first, then engineering (ember), data, operations.
 */
const MARKS = [0.42, 0.2, 1, 0.62, 0.8];
const PLANET_LOOK: [number, string, string][] = [
  [11, "rgb(255 150 100)", "rgb(255 106 61 / 0.35)"],
  [16, "rgb(240 200 130)", "rgb(233 184 102 / 0.3)"],
  [24, "rgb(140 175 255)", "rgb(90 140 255 / 0.3)"],
  [26, "rgb(214 182 140)", "rgb(201 164 122 / 0.26)"],
  [14, "rgb(190 228 255)", "rgb(150 210 255 / 0.3)"],
];

/** A point on the route at t (0..1), Catmull-Rom through ROUTE. */
function route(t: number): [number, number] {
  const n = ROUTE.length - 1;
  const f = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(f);
  const s = f - i;
  const p0 = ROUTE[Math.max(0, i - 1)];
  const p1 = ROUTE[i];
  const p2 = ROUTE[i + 1];
  const p3 = ROUTE[Math.min(n, i + 2)];
  const c = (k: 0 | 1) =>
    0.5 *
    (2 * p1[k] +
      (-p0[k] + p2[k]) * s +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s * s +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s ** 3);
  return [SUN[0] + c(0) * U, SUN[1] + c(1) * U];
}

/** A body as a CSS gradient that stays round in the 16:10 plate. */
const body = (x: number, y: number, r: number, core: string, glow: string) =>
  `radial-gradient(${f1((r / W) * 100)}% ${f1((r / H) * 100)}% at ${f1((x / W) * 100)}% ${f1((y / H) * 100)}%, ${core} 0 42%, ${glow} 62%, transparent 100%)`;

/** The planets on their marks along the route (Fig. 6 and 7), as gradients over the still's own. */
function routeBodies(id: FigureId): CSSProperties | undefined {
  if (id !== "window" && id !== "assist") return undefined;
  return { backgroundImage: MARKS.map((m, i) => body(...route(m), ...PLANET_LOOK[i])).join(", ") };
}

/* ---------------------------------------------------------------- the printed ink */

type Word = { x: number; y: number; text: string; gold?: boolean; end?: boolean; wrap?: boolean };

/** A bowed hairline from (x0, y0) to (x1, y1), as an SVG path. */
function bowed(seed: number, x0: number, y0: number, x1: number, y1: number, bow: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const w = wobble(seed, 13, 1.4);
  let d = "";
  for (let q = 0; q <= 12; q++) {
    const t = q / 12;
    const b = 4 * t * (1 - t) * bow + w[q] * Math.sin(Math.PI * t);
    d += `${q ? "L" : "M"}${f1(x0 + dx * t - (dy / l) * b)} ${f1(y0 + dy * t + (dx / l) * b)}`;
  }
  return d;
}

/** A pen's ellipse, a little uneven, as an SVG path. */
function ellipse(seed: number, x: number, y: number, rx: number, ry: number, rot: number) {
  const w = wobble(seed, 73, 1.6);
  let d = "";
  for (let q = 0; q <= 72; q++) {
    const a = (q / 72) * Math.PI * 2;
    const ex = (rx + w[q]) * Math.cos(a);
    const ey = (ry + w[q] * 0.5) * Math.sin(a);
    d += `${q ? "L" : "M"}${f1(x + ex * Math.cos(rot) - ey * Math.sin(rot))} ${f1(y + ex * Math.sin(rot) + ey * Math.cos(rot))}`;
  }
  return d;
}

/** The route from t0 to t1, run `offset` units to its left, with a bracket's ends if asked. */
function routePath(t0: number, t1: number, offset: number, bracket: boolean) {
  const pts: [number, number][] = [];
  const steps = Math.max(8, Math.round((t1 - t0) * 80));
  for (let q = 0; q <= steps; q++) {
    const t = t0 + ((t1 - t0) * q) / steps;
    const [x, y] = route(t);
    const [ax, ay] = route(Math.max(0, t - 0.005));
    const [bx, by] = route(Math.min(1, t + 0.005));
    const l = Math.hypot(bx - ax, by - ay) || 1;
    pts.push([x + ((by - ay) / l) * offset, y - ((bx - ax) / l) * offset]);
  }
  let d = pts.map(([x, y], q) => `${q ? "L" : "M"}${f1(x)} ${f1(y)}`).join("");
  if (bracket) {
    for (const t of [t0, t1]) {
      const [x, y] = route(t);
      const [ax, ay] = route(Math.max(0, t - 0.005));
      const [bx, by] = route(Math.min(1, t + 0.005));
      const l = Math.hypot(bx - ax, by - ay) || 1;
      d += `M${f1(x + ((by - ay) / l) * offset)} ${f1(y - ((bx - ax) / l) * offset)}L${f1(x + ((by - ay) / l) * offset * 0.4)} ${f1(y - ((bx - ax) / l) * offset * 0.4)}`;
    }
  }
  // the bracket's word sits outside it, on whichever side it runs
  const [mx, my] = route((t0 + t1) / 2);
  const [ax, ay] = route(Math.max(0, (t0 + t1) / 2 - 0.005));
  const [bx, by] = route(Math.min(1, (t0 + t1) / 2 + 0.005));
  const l = Math.hypot(bx - ax, by - ay) || 1;
  const out = offset + (offset < 0 ? -26 : 26);
  return { d, mid: [mx + ((by - ay) / l) * out, my - ((bx - ax) / l) * out] as [number, number] };
}

/** The world's field: two loops each side of it, as a dipole's lines, hidden where they pass behind it (Fig. 9). */
function arcs(x: number, y: number, r: number) {
  let d = "";
  for (const L of [1.55, 2.2]) {
    for (const side of [-1, 1]) {
      let pen = false;
      for (let q = 0; q <= 48; q++) {
        const th = 0.2 + (q / 48) * (Math.PI - 0.4);
        const rho = L * r * Math.sin(th) ** 2;
        if (rho < r * 1.04) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${f1(x + side * rho * Math.sin(th))} ${f1(y - rho * Math.cos(th))}`;
        pen = true;
      }
    }
  }
  return d;
}

function marks(id: FigureId) {
  const strokes: { d: string; gold?: boolean; dash?: boolean; fine?: boolean; tr?: string }[] = [];
  const words: Word[] = [];
  PRINT[id].forEach((m: PrintMark, i) => {
    const seed = seedOf(`print:${id}:${i}`);
    switch (m.kind) {
      case "circle": {
        strokes.push({
          d: loopPath(seed),
          gold: m.gold,
          tr: `translate(${m.x} ${m.y}) scale(${m.r})`,
        });
        if (m.text) {
          const a = ((m.angle ?? -40) * Math.PI) / 180;
          words.push({
            x: m.x + Math.cos(a) * (m.r + 14),
            y: m.y + Math.sin(a) * (m.r + 14),
            text: m.text,
            gold: m.gold,
            end: Math.cos(a) < 0,
          });
        }
        break;
      }
      case "label": {
        const lx = m.tx + (m.end ? 10 : -10);
        const dx = lx - m.x;
        const dy = m.ty - m.y;
        const l = Math.hypot(dx, dy) || 1;
        let d = bowed(
          seed,
          m.x + (dx / l) * 12,
          m.y + (dy / l) * 12,
          lx,
          m.ty,
          (pick(seed, 0, 1) < 0.5 ? -1 : 1) * pick(seed + 1, 5, 12),
        );
        if (m.mark === "x")
          d += `M${m.x - 7} ${m.y - 7}L${m.x + 7} ${m.y + 7}M${m.x + 7} ${m.y - 7}L${m.x - 7} ${m.y + 7}`;
        strokes.push({ d, gold: m.gold });
        words.push({ x: m.tx, y: m.ty, text: m.text, gold: m.gold, end: m.end });
        break;
      }
      case "arrow": {
        const bend = m.bend ?? 14;
        const d = bowed(seed, m.x0, m.y0, m.x1, m.y1, bend);
        // the head along the line's last direction
        const dx = m.x1 - m.x0;
        const dy = m.y1 - m.y0;
        const l = Math.hypot(dx, dy) || 1;
        const cx = -dx / l;
        const cy = -dy / l;
        const hs = 13;
        const ca = Math.cos(0.42);
        const sa = Math.sin(0.42);
        const h1 = `M${m.x1} ${m.y1}L${f1(m.x1 + (cx * ca - cy * sa) * hs)} ${f1(m.y1 + (cx * sa + cy * ca) * hs)}`;
        const h2 = `M${m.x1} ${m.y1}L${f1(m.x1 + (cx * ca + cy * sa) * hs)} ${f1(m.y1 + (-cx * sa + cy * ca) * hs)}`;
        strokes.push({ d: d + h1 + h2, gold: m.gold });
        break;
      }
      case "ellipse":
        strokes.push({
          d: ellipse(seed, m.x, m.y, m.rx, m.ry, m.rot ?? 0),
          gold: m.gold,
          dash: m.dash,
        });
        break;
      case "route": {
        const r = routePath(m.from, m.to, m.offset ?? 0, m.bracket ?? false);
        strokes.push({ d: r.d, gold: m.gold, dash: m.dash });
        if (m.text) words.push({ x: r.mid[0], y: r.mid[1], text: m.text, end: true });
        break;
      }
      case "ticks": {
        let d = "";
        m.at.forEach((t, j) => {
          const [x, y] = route(t);
          const [ax, ay] = route(Math.max(0, t - 0.005));
          const [bx, by] = route(Math.min(1, t + 0.005));
          const l = Math.hypot(bx - ax, by - ay) || 1;
          const nx = (by - ay) / l;
          const ny = -(bx - ax) / l;
          d += `M${f1(x - nx * 9)} ${f1(y - ny * 9)}L${f1(x + nx * 14)} ${f1(y + ny * 14)}`;
          words.push({ x: x + nx * 34, y: y + ny * 34, text: m.text[j], end: nx < 0 });
        });
        strokes.push({ d, fine: true });
        break;
      }
      case "arcs":
        strokes.push({ d: arcs(m.x, m.y, m.r), fine: true });
        break;
      case "note":
        strokes.push({ d: bowed(seed, m.x - 40, m.y, m.x - 14, m.y, 0.6) });
        words.push({ x: m.x, y: m.y, text: m.text, gold: m.gold, wrap: true });
        break;
    }
  });
  return { strokes, words };
}

/** A still's ink, printed: hairlines that keep 1 px at any plate size, and the words at the page's own 11 px. */
export function StillInk({ id }: { id: FigureId }) {
  const { strokes, words } = marks(id);
  const bodies = routeBodies(id);
  return (
    <>
      {bodies ? <div className="still-bodies" style={bodies} /> : null}
      <svg
        className="still-ink"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {strokes.map((s, i) => (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed marks
            key={i}
            d={s.d}
            transform={s.tr}
            className={`pi${s.gold ? " pi-gold" : ""}${s.dash ? " pi-dash" : ""}${s.fine ? " pi-fine" : ""}`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="still-words">
        {words.map((w, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed marks
            key={i}
            className={`pw${w.gold ? " pw-gold" : ""}${w.end ? " pw-end" : ""}${w.wrap ? " pw-wrap" : ""}`}
            style={{ left: `${f1((w.x / W) * 100)}%`, top: `${f1((w.y / H) * 100)}%` }}
          >
            {w.text}
          </span>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- dense art, client only (flow) */

type Dot = [number, number, number, number, number];

function flockDots(): Dot[] {
  const r = rng(11);
  const out: Dot[] = [];
  const g = () => (r() + r() + r() - 1.5) / 1.5;
  for (let i = 0; i < 560; i++) {
    const u = r();
    const pinch = 0.18 + Math.abs(Math.cos(Math.PI * (u * 1.4 + 0.1)));
    const x = 300 + 1000 * u + g() * 34;
    const y =
      360 +
      80 * Math.sin(Math.PI * 2 * (u * 0.9 + 0.1)) -
      70 * u +
      g() * (30 + 90 * pinch * Math.sin(Math.PI * u));
    const rad = 0.6 + r() * 1.1;
    out.push([
      f1(x),
      f1(y),
      f1(rad),
      r() < 0.85 ? 3 : 1,
      Math.round((0.45 + r() * 0.55) * 100) / 100,
    ]);
  }
  return out;
}

type Arc = [string, number, number, number];

function trails(): Arc[] {
  const r = rng(23);
  const out: Arc[] = [];
  const px = 420;
  const py = -80;
  const sweep = (17 * Math.PI) / 180;
  for (let i = 0; i < 240; i++) {
    const rad = 60 + 1700 * Math.sqrt(r());
    const a0 = Math.PI * (0.02 + r() * 0.9);
    const x0 = px + rad * Math.cos(a0);
    const y0 = py + rad * Math.sin(a0);
    const x1 = px + rad * Math.cos(a0 + sweep);
    const y1 = py + rad * Math.sin(a0 + sweep);
    if (y0 > H + 40 && y1 > H + 40) continue;
    const c = r();
    out.push([
      `M${f1(x0)} ${f1(y0)}A${f1(rad)} ${f1(rad)} 0 0 1 ${f1(x1)} ${f1(y1)}`,
      c < 0.62 ? 3 : c < 0.82 ? 4 : 1,
      f1(0.6 + r() * 1.3),
      Math.round((0.18 + r() * 0.62) * 100) / 100,
    ]);
  }
  return out;
}

const FILL = ["#ffe6bf", "#e9b866", "#ffffff", "#eef2f8", "#cfdcff"];

function Art({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      className={`still-art ${className ?? ""}`}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function FlockArt() {
  const dots = flockDots();
  return (
    <Art className="art-flock">
      {dots.map(([x, y, rad, c, a], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static art
        <circle key={i} cx={x} cy={y} r={rad} fill={FILL[c]} opacity={a} />
      ))}
    </Art>
  );
}

function SkyArt() {
  const arcs = trails();
  return (
    <Art className="art-sky">
      <g fill="none" strokeLinecap="round">
        {arcs.map(([d, c, w, a], i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static art
          <path key={i} d={d} stroke={FILL[c]} strokeWidth={w} opacity={a} />
        ))}
      </g>
    </Art>
  );
}

/** Renders a figure's dense art only while the flow layout is active. */
export function StillArt({ kind }: { kind: "flock" | "sky" }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setOn(root.classList.contains("flow"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  if (!on) return null;
  return kind === "flock" ? <FlockArt /> : <SkyArt />;
}
