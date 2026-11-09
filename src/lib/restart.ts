/**
 * Start over (the header name, "Start over" in the ending, "Back to the first point" in the record): the page cuts
 * to the top through the far-jump fade and the whole show is re-armed in the dark (src/lib/scroll.ts startOver): the
 * light back in the sky, the bang not happened, fig. 1's hold inviting again, every outcome of the visit (the
 * center, the alignment, the launch, the flock's freedom, the hovered star, the hints done, the ink, the sound's
 * cues) as on arrival. Scrolling back up by hand never calls it: what the visitor did stays done.
 *
 * Every module that keeps per-visit state registers its reset here and removes it on cleanup. The resets run in the
 * dark, after the page is at the top (story time 0, src/lib/hold.ts already re-armed), in registration order. What
 * outlives a visit by design keeps its own rule: the visitor's saved star (figures/sky.ts LS_POINT, replaced only by
 * a bang made with a real hold), the motion and sound choices.
 */
const resets = new Set<() => void>();

export function onRestart(fn: () => void) {
  resets.add(fn);
  return () => {
    resets.delete(fn);
  };
}

/** Run every reset (src/lib/scroll.ts startOver, inside the cut). */
export function restartShow() {
  for (const fn of resets) fn();
}
