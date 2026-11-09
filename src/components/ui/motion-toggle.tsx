"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion, setMotionPreference } from "@/lib/tier";

/**
 * Reduce motion: the show becomes the journal printed (a still plate per figure). Every copy stays in sync through the
 * motionpreference event. Without JavaScript the page is already printed, so the switch is hidden (globals.css).
 */
export function MotionToggle({ className }: { className?: string }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    const sync = () => setReduced(prefersReducedMotion());
    window.addEventListener("motionpreference", sync);
    return () => window.removeEventListener("motionpreference", sync);
  }, []);

  const toggle = () => {
    const next = !reduced;
    setReduced(next);
    setMotionPreference(next ? "reduce" : "full");
    window.dispatchEvent(new CustomEvent("motionpreference", { detail: next }));
  };

  return (
    <button
      type="button"
      className={className ?? "motion-toggle"}
      aria-pressed={reduced}
      onClick={toggle}
    >
      {reduced ? "Motion reduced" : "Reduce motion"}
    </button>
  );
}
