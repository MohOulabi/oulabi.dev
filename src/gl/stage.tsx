"use client";

// The show (docs/STORY.md, src/lib/journey.ts): one Canvas, frameloop "never" driven by the clock (setRender +
// advance), DPR by tier (≤ 2 desktop, ≤ 1.25 on phones), every program compiled before the reveal, QA stats on
// window.__glStats. The core show owns the camera; the world module (figs 8-11) draws into the same scene with it.
import { advance, Canvas } from "@react-three/fiber";
import { useCallback, useLayoutEffect } from "react";
import { setRender, wake } from "@/lib/clock";
import type { GLTier } from "@/lib/tier";
import Effects from "./post/effects";
import { shared } from "./shared";
import Show from "./show/show";
import World from "./world";

function Director() {
  useLayoutEffect(() => {
    setRender((t) => advance(t));
    return () => setRender(null);
  }, []);
  return null;
}

const DPR_CAP: Record<GLTier, number> = { high: 2, medium: 1.5, low: 1.25 };

function pickDpr(tier: GLTier) {
  const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const cap = coarse ? Math.min(1.25, DPR_CAP[tier]) : DPR_CAP[tier];
  const d = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(cap, Math.max(1, d));
}

export default function Stage({ tier }: { tier: GLTier }) {
  shared.tier = tier;
  const onReady = useCallback(() => {
    // one real frame, then reveal
    advance(performance.now());
    shared.ready = true;
    wake(1200);
    requestAnimationFrame(() => document.documentElement.classList.add("gl-ready"));
  }, []);
  return (
    <Canvas
      className="gl-canvas"
      frameloop="never"
      dpr={pickDpr(tier)}
      gl={{
        antialias: false,
        alpha: false,
        stencil: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      camera={{ fov: 50, near: 0.1, far: 2000, position: [0, 0, 10] }}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <color attach="background" args={["#06070B"]} />
      <Director />
      <Show tier={tier} onReady={onReady} />
      <World tier={tier} />
      <Effects tier={tier} />
    </Canvas>
  );
}
