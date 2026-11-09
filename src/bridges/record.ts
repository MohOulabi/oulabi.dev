/**
 * The record's quiet motion: content settles in once as it enters (time-based, never scroll-jacked), the plates
 * catch a soft light that follows the cursor, and the fast lane marks the section being read.
 */
export function startRecord() {
  const root = document.documentElement;
  const cleanups: (() => void)[] = [];

  // ---- reveals (once; content is visible without JS and in reduced motion)
  // Nothing is hidden on load: the reveals arm only once the visitor has scrolled and the record is within two screens
  // of the viewport. A renderer that never scrolls (a search engine's, however tall its viewport) reads the record as
  // it is printed, never at opacity 0; a visitor still sees each block settle in as it enters.
  const recordEl = document.getElementById("record");
  if (recordEl && "IntersectionObserver" in window) {
    const items = Array.from(recordEl.querySelectorAll<HTMLElement>("[data-reveal]"));
    let scrolled = false;
    let near = false;
    let armed = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );
    const nearIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) near = e.isIntersecting || e.boundingClientRect.top < 0;
        arm();
      },
      { rootMargin: "0px 0px 200% 0px" },
    );
    const onScroll = () => {
      scrolled = true;
      window.removeEventListener("scroll", onScroll);
      arm();
    };
    function arm() {
      if (armed || !scrolled || !near) return;
      armed = true;
      nearIO.disconnect();
      // in the same frame as the class: what is already on screen (or above it) never fades out
      for (const el of items) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
        else io.observe(el);
      }
      root.classList.add("reveals");
    }
    nearIO.observe(recordEl);
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      nearIO.disconnect();
      io.disconnect();
    });
  }

  // ---- plate light: a soft glow that follows the cursor across the screenshot
  const plates = document.querySelector<HTMLElement>("#work .plates");
  if (plates) {
    let raf = 0;
    let target: HTMLElement | null = null;
    let mx = 0;
    let my = 0;
    const apply = () => {
      raf = 0;
      if (!target) return;
      target.style.setProperty("--mx", `${mx.toFixed(1)}%`);
      target.style.setProperty("--my", `${my.toFixed(1)}%`);
    };
    const onMove = (e: PointerEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.(".plate-link") as HTMLElement | null;
      const shot = link?.querySelector<HTMLElement>(".plate-shot");
      if (!link || !shot) return;
      const r = shot.getBoundingClientRect();
      target = link;
      mx = ((e.clientX - r.left) / Math.max(1, r.width)) * 100;
      my = ((e.clientY - r.top) / Math.max(1, r.height)) * 100;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    plates.addEventListener("pointermove", onMove, { passive: true });
    cleanups.push(() => {
      plates.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    });
  }

  // ---- the fast lane marks the section being read
  const lane = Array.from(document.querySelectorAll<HTMLAnchorElement>(".lane a[data-lane]"));
  const sections = lane
    .map((a) => document.getElementById(a.dataset.lane ?? ""))
    .filter(Boolean) as HTMLElement[];
  if (sections.length && "IntersectionObserver" in window) {
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        let current = "";
        for (const s of sections) if (visible.get(s.id)) current = current || s.id;
        for (const a of lane) {
          if (a.dataset.lane === current) a.setAttribute("aria-current", "location");
          else a.removeAttribute("aria-current");
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const s of sections) io.observe(s);
    cleanups.push(() => io.disconnect());
  }

  return () => {
    for (const c of cleanups) c();
  };
}
