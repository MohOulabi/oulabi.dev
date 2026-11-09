/**
 * A horizontal drag on the page for a figure that turns something (the orbits, the sky): its velocity in CSS px per
 * second while a button or finger is down, taken only while the figure says it is live. Vertical scroll stays
 * native; the drag never calls preventDefault. One per figure, so each owner keeps its own state; no allocation
 * after construction.
 */
import { wake } from "@/lib/clock";

export class Drag {
  /** A drag is in progress (released by pointerup or by the figure going quiet). */
  dragging = false;
  /** Smoothed horizontal velocity, CSS px per second (the figure decays it as it consumes it). */
  v = 0;
  private x = 0;
  private t = 0;

  constructor(private live: () => boolean) {
    window.addEventListener("pointerdown", this.onDown, { passive: true });
    window.addEventListener("pointermove", this.onMove, { passive: true });
    window.addEventListener("pointerup", this.onUp, { passive: true });
    window.addEventListener("pointercancel", this.onUp, { passive: true });
  }

  private onDown = (e: PointerEvent) => {
    if (!this.live() || e.button > 0) return;
    this.dragging = true;
    this.x = e.clientX;
    this.t = performance.now();
    this.v = 0;
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - this.t) / 1000;
    const dx = e.clientX - this.x;
    this.x = e.clientX;
    this.t = now;
    this.v = this.v * 0.6 + (dx / dt) * 0.4;
    wake(600);
  };
  private onUp = () => {
    this.dragging = false;
  };

  /** Let go (the figure stopped taking drags). */
  release() {
    this.dragging = false;
  }

  dispose() {
    window.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
  }
}
