"use client";

/**
 * The world (docs/STORY.md figs 8-11, src/lib/journey.ts): Earth at PLANET, seen from orbit over the Middle East at
 * night (./layout.ts, ./places.ts). Fig. 8: your point lands on its night side at the hub, Riyadh (HANDOFF.ARRIVE), and
 * a soft ring of light spreads over the ground from it; the
 * night side lights up city by city outward from the hub, and a network of luminous great-circle arcs wires them
 * together from that first city, then runs out through the region's gateways and wires the world beyond it, region by
 * region (BEATS.theirs; ./layout.ts FAR_ARCS). Fig. 9 (./storm.ts): a storm sweeps in from deep space, the lights
 * flicker, the world's field comes up (the visitor's hold raises it sooner), the storm bends round it and pours into
 * both poles as aurora. The flock rises off it in fig. 10 (the core show); it fades out as the camera pulls away in
 * fig. 11.
 *
 * Mount: <World tier={tier} /> inside the Canvas, after the core show (so it reads this frame's camera). It reads
 * story.Ts, hold.* and journey.ts itself, draws nothing outside T in [HANDOFF.WORLD_FROM, HANDOFF.WORLD_TO), and sets
 * its own visibility. Six draws (planet, air + hub light, arcs, far arcs, flow, far markers) and, in fig. 9, three
 * more (the streaks, the field's loops, the aurora); the surface is baked once into a cube map when the main thread is idle (or at once if
 * the visitor lands inside the window), from the map (public/data/earth.png) once it has loaded. Writes anchors `hub`, `world`, `storm`, `poleN`, `poleS`, paths `field0..3`
 * (src/lib/anchors.ts) and shared.play cities, field, hit, lightsLost.
 *
 * The visitor: horizontal drag turns the planet a little and it springs back (vertical scroll stays native); a tap
 * launches a wave of light from the nearest lit city to the hub; a hold in the storm raises the field. Reduced
 * motion: all lights on, the network drawn, no flicker, the storm and the curtains still. The surge is kept
 * dormant in ./world.ts.
 *
 * Camera: the core show owns it (src/gl/show/poses/world.ts, one path from HANDOFF.ARRIVE to F.again).
 *
 * Draw order: the planet is transparent with renderOrder 1 (it writes depth once fully present, so the sim's motes
 * and the storm behind it are hidden when drawn after it); the air 1.5, the loops 2.2, the aurora 2.4, the streaks
 * 2.6, the arcs and the far arcs 3, the flow and the far markers 4 are additive.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { PerspectiveCamera } from "three";
import { precompile } from "@/gl/precompile";
import { addFrame, wake } from "@/lib/clock";
import { onRestart } from "@/lib/restart";
import { story } from "@/lib/story";
import type { GLTier } from "@/lib/tier";
import { SHOW_FROM, SHOW_TO } from "./layout";
import { WorldGL } from "./world";

const near = () => story.Ts > SHOW_FROM - 0.6 && story.Ts < SHOW_TO;
const inside = () => story.Ts >= SHOW_FROM && story.Ts < SHOW_TO;

export default function World({ tier }: { tier: GLTier }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const world = useMemo(() => new WorldGL(tier), [tier]);

  useEffect(() => {
    let alive = true;
    const unRestart = onRestart(() => world.reset());
    // a restored WebGL context has lost the baked surface: bake it again (on the next frame inside the window)
    const restored = () => world.rebake();
    gl.domElement.addEventListener("webglcontextrestored", restored);
    const prepare = () => {
      if (!alive) return;
      world.bake(gl);
      // compile its programs now, not on the first frame of the figure (as the post chain draws them: precompile)
      precompile(gl, world.group, camera, scene).catch(() => {
        // compiled on first use instead
      });
      wake(300);
    };
    const w = window as Window & {
      requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    let handle = 0;
    let timer = 0;
    if (inside()) prepare();
    else if (w.requestIdleCallback) handle = w.requestIdleCallback(prepare, { timeout: 4000 });
    else timer = window.setTimeout(prepare, 2500);
    return () => {
      alive = false;
      unRestart();
      gl.domElement.removeEventListener("webglcontextrestored", restored);
      if (handle && w.cancelIdleCallback) w.cancelIdleCallback(handle);
      if (timer) window.clearTimeout(timer);
      world.dispose();
    };
  }, [world, gl, camera, scene]);

  // the pulses, the flow and the spring of the drag run in time: keep frames coming while the world is on screen
  useEffect(
    () =>
      addFrame(() => {
        if (near() && !story.reducedMotion) wake(200);
      }, 5),
    [],
  );

  useFrame(() => {
    if (inside()) world.bake(gl);
    world.update(gl, camera);
  }, 0);

  return <primitive object={world.group} />;
}
