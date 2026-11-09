/**
 * Real load progress for the loader ring (the inline boot script in page.tsx owns the ring). Milestones only move
 * forward and are never faked: parsed (0.1), DOM ready (0.16), fonts (0.22), hydrated, GPU tier, the WebGL module,
 * shaders compiled and the first frame drawn (gl-ready).
 */
export const BOOT = { hydrated: 0.32, tier: 0.5, stageModule: 0.72, ready: 1 } as const;

export function bootProgress(v: number) {
  (window as unknown as { __nuqtaBoot?: (v: number) => void }).__nuqtaBoot?.(v);
}

/** Resolve the ring when the stage reports its first frame (html.gl-ready). */
export function watchReady(): () => void {
  const root = document.documentElement;
  if (root.classList.contains("gl-ready")) {
    bootProgress(BOOT.ready);
    return () => undefined;
  }
  const mo = new MutationObserver(() => {
    if (root.classList.contains("gl-ready")) {
      bootProgress(BOOT.ready);
      mo.disconnect();
    }
  });
  mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
