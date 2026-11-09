"use client";

import { advance, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { PerspectiveCamera } from "three";
import { precompile } from "@/gl/precompile";
import { shared } from "@/gl/shared";
import { wake } from "@/lib/clock";
import { hold, triggerBang } from "@/lib/hold";
import { isQA } from "@/lib/qa";
import type { GLTier } from "@/lib/tier";
import { Engine } from "./engine";

/**
 * Mounts the core show's engine in the R3F scene, compiles every program before the reveal, and runs it every frame:
 * the engine's frame first (priority 0, before the world module reads the camera), and once the post
 * chain has drawn (priority 2, after Effects at 1), the anchors projector, so anchors any GL module set this frame
 * reach the ink in CSS px. A lost WebGL context (iOS under memory pressure, a tab in the background) comes back
 * empty, and the engine's one-off bakes (the noise volume, the sim's state, the nebula's and the galaxy's homes) live
 * only on the GPU: when the context is restored, the engine is built again.
 */
export default function Show({ tier, onReady }: { tier: GLTier; onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const setDpr = useThree((s) => s.setDpr);
  const ref = useRef<Engine | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [gen, setGen] = useState(0);

  useEffect(() => {
    const c = gl.domElement;
    const restored = () => setGen((g) => g + 1);
    c.addEventListener("webglcontextrestored", restored);
    return () => c.removeEventListener("webglcontextrestored", restored);
  }, [gl]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: gen rebuilds the engine on a restored WebGL context
  useEffect(() => {
    let alive = true;
    let eng: Engine | null = null;
    Engine.create(gl, tier).then(async (e) => {
      if (!alive) {
        e.dispose();
        return;
      }
      eng = e;
      ref.current = e;
      e.mount(scene);
      e.setDpr = setDpr;
      e.setBaseDpr(gl.getPixelRatio());
      shared.captureSky = () => e.capture(() => advance(performance.now()));
      // the engine's stats (window.__story.stats() reads them)
      (window as unknown as { __glStats: () => unknown }).__glStats = () => e.stats();
      devHooks();
      if (isQA()) {
        // QA: the bench: render n frames back to back, each forced to finish on the GPU (1-pixel readback); ms per frame
        const px = new Uint8Array(4);
        (window as unknown as { __bench: (n: number) => number }).__bench = (n: number) => {
          const ctx = gl.getContext();
          const t0 = performance.now();
          for (let i = 0; i < n; i++) {
            advance(performance.now());
            ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
          }
          return (performance.now() - t0) / n;
        };
      }
      e.frame(camera, scene);
      // compile every program of the whole show (the world module's, hidden till its figures, included; sprites too)
      // before the reveal, as the post chain draws them (../precompile.ts), so neither the bang nor any later figure
      // hitches on its first frame
      try {
        await Promise.all([precompile(gl, scene, camera), precompile(gl, e.fxs.overlay, camera)]);
        await e.gas.compile(gl);
      } catch {
        // compile on first use instead
      }
      if (!alive) return;
      wake(1000);
      readyRef.current();
    });
    return () => {
      alive = false;
      if (eng) {
        eng.unmount(scene);
        eng.dispose();
      }
      ref.current = null;
    };
  }, [gl, scene, camera, tier, setDpr, gen]);

  useFrame(() => {
    ref.current?.frame(camera, scene);
  }, 0);
  useFrame(() => {
    ref.current?.project();
  }, 2);

  return null;
}

/** QA hooks (src/lib/qa.ts): ?hold=1 simulates a full hold at the centre, ?bang=1 bangs on load. */
function devHooks() {
  if (!isQA()) return;
  const q = new URLSearchParams(location.search);
  if (q.get("hold") === "1") {
    hold.pressing = true;
    hold.k = 1;
  }
  if (q.get("bang") === "1") window.setTimeout(() => triggerBang(0, 0), 400);
}
