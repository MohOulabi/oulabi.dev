"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BOOT, bootProgress, watchReady } from "@/bridges/boot";
import { startCut } from "@/bridges/cut";
import { startInk } from "@/bridges/ink";
import { startRecord } from "@/bridges/record";
import { markLateNight, startShowDom } from "@/bridges/show-dom";
import { startSpine } from "@/bridges/spine";
import { startClock } from "@/lib/clock";
import { gate } from "@/lib/gate";
import { startHold } from "@/lib/hold";
import { isQA } from "@/lib/qa";
import { initLinks, initScroll, jumpTo, jumpToT } from "@/lib/scroll";
import { measureBeats, story } from "@/lib/story";
import { detectTier, type GLTier, prefersReducedMotion, type Tier } from "@/lib/tier";

const Stage = dynamic(
  () =>
    import("@/gl/stage").then((m) => {
      bootProgress(BOOT.stageModule);
      return m;
    }),
  { ssr: false },
);

/**
 * Boots the page: motion preference, GPU tier, natural scroll, the clock, the input writer, the DOM director, the ink
 * journal, the side spine and the WebGL stage. Reduced motion and the static tier keep the flow layout (the journal
 * printed: a plate per figure, the signature, then the record) and mount no WebGL.
 */
export function Experience() {
  const [tier, setTier] = useState<GLTier | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    bootProgress(BOOT.hydrated);
    cleanups.push(watchReady());

    let isStatic = root.classList.contains("no-stage");
    const applyMotion = () => {
      story.reducedMotion = prefersReducedMotion();
      root.classList.toggle("reduce-motion", story.reducedMotion);
      root.classList.toggle("flow", story.reducedMotion || isStatic);
      setStill(story.reducedMotion);
      requestAnimationFrame(() => measureBeats());
    };
    applyMotion();
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", applyMotion);
    window.addEventListener("motionpreference", applyMotion);
    cleanups.push(() => {
      mq.removeEventListener("change", applyMotion);
      window.removeEventListener("motionpreference", applyMotion);
    });

    cleanups.push(startRecord());
    markLateNight();

    (async () => {
      // the WebGL chunk loads while the GPU is checked, not after it (the Stage below takes the same module); only a
      // page that will print the journal (the static tier, reduced motion) never asks for it
      if (!isStatic && !story.reducedMotion) void import("@/gl/stage").catch(() => undefined);
      const t: Tier = isStatic ? "static" : await detectTier();
      if (disposed) return;
      bootProgress(BOOT.tier);
      root.dataset.tier = t;
      if (t === "static") {
        isStatic = true;
        root.classList.add("flow", "no-stage");
        // (no gate in the printed journal: the boot script's hold on the page while it loaded is let go)
        (window as unknown as { __nuqtaUnhold?: () => void }).__nuqtaUnhold?.();
        // the printed journal still takes its in-page links (no hash written, the name back to the top)
        cleanups.push(initLinks());
        return;
      }
      root.classList.add("stage");
      measureBeats();
      cleanups.push(initScroll());
      startClock();
      cleanups.push(startHold());
      cleanups.push(startShowDom());
      cleanups.push(startInk());
      cleanups.push(startSpine());
      cleanups.push(startCut());
      // QA hook used by scripts/shots.mjs: jump(T) sets story time (T > 11 reads on past the sky: the ending, the record).
      // Dev builds, or a production build opened with ?qa (src/lib/qa.ts, the switch for every QA hook).
      if (isQA()) {
        const w = window as unknown as { __story?: unknown };
        w.__story = {
          story,
          // (the first screen's gate: armed, passed, the attempts: src/lib/gate.ts)
          gate,
          jump: jumpToT,
          go: (id: string) => jumpTo(id, { immediate: true }),
          stats: () => (window as unknown as { __glStats?: () => unknown }).__glStats?.() ?? null,
        };
        cleanups.push(() => {
          delete w.__story;
        });
      }
      setTier(t);
    })();

    return () => {
      disposed = true;
      for (const c of cleanups) c();
    };
  }, []);

  return tier && !still ? <Stage tier={tier} /> : null;
}
