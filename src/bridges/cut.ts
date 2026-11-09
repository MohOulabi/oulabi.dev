import gsap from "gsap";
import { wake } from "@/lib/clock";
import { onCut } from "@/lib/scroll";

/**
 * Far jumps (a nav link, a distant project) do not fly through every station: scroll.goTo fades to
 * najd-night for 340 ms, cuts story time, and fades back. This is the veil. Explicitly time-based.
 */
export function startCut() {
  const veil = document.createElement("div");
  veil.className = "cut-veil";
  veil.setAttribute("aria-hidden", "true");
  document.body.appendChild(veil);

  const off = onCut((phase) => {
    wake(1200);
    gsap.killTweensOf(veil);
    if (phase === "out") gsap.to(veil, { opacity: 1, duration: 0.3, ease: "power1.in" });
    else gsap.to(veil, { opacity: 0, duration: 0.34, ease: "power1.out", delay: 0.02 });
  });

  return () => {
    off();
    gsap.killTweensOf(veil);
    veil.remove();
  };
}
