export type Tier = "high" | "medium" | "low" | "static";

export type GLTier = Exclude<Tier, "static">;

function softwareRenderer(gl: WebGL2RenderingContext) {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

export async function detectTier(): Promise<Tier> {
  const forced = new URLSearchParams(location.search).get("q");
  if (forced === "high" || forced === "medium" || forced === "low" || forced === "static")
    return forced;

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    failIfMajorPerformanceCaveat: true,
    powerPreference: "high-performance",
  });
  if (!gl) return "static";
  const lose = () => gl.getExtension("WEBGL_lose_context")?.loseContext();
  if (softwareRenderer(gl)) {
    lose();
    return "static";
  }

  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData;
  if (saveData) {
    lose();
    return "low";
  }

  let gpuTier = 2;
  let isApple = false;
  try {
    const { getGPUTier } = await import("@pmndrs/detect-gpu");
    const r = await Promise.race([
      getGPUTier({ glContext: gl, benchmarksURL: "/benchmarks" }),
      new Promise<null>((res) => setTimeout(() => res(null), 1200)),
    ]);
    if (r) {
      gpuTier = r.tier;
      isApple = /apple/i.test(r.gpu ?? "");
    }
  } catch {
    // keep the default
  }
  lose();

  // Safari masks the GPU as "Apple GPU": trust Apple silicon desktops.
  if (isApple && !coarse && cores >= 8) return "high";
  if (gpuTier === 0) return "static";
  if (coarse) return gpuTier >= 3 ? "medium" : "low";
  return gpuTier >= 3 ? "high" : gpuTier === 2 ? "medium" : "low";
}

const MOTION_KEY = "launch-night:motion";

export function prefersReducedMotion(): boolean {
  try {
    const v = localStorage.getItem(MOTION_KEY);
    if (v === "reduce") return true;
    if (v === "full") return false;
  } catch {
    // storage blocked
  }
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function setMotionPreference(v: "reduce" | "full") {
  try {
    localStorage.setItem(MOTION_KEY, v);
  } catch {
    // storage blocked
  }
}
