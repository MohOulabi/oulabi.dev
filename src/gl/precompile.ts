import {
  type Camera,
  type Object3D,
  type Scene,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";

/**
 * Compiles every program `root` holds (hidden objects too: three's compile walks them all) before it is first drawn,
 * in the variant it is drawn in. The scene and the overlay are drawn into the post chain's buffer
 * (src/gl/post/effects.tsx), never straight to the screen, and three keys a program on where it draws: into a render
 * target in linear colour with no tone mapping, to the screen in sRGB with the renderer's tone mapping. Compiled with
 * no target bound, every material would be compiled again on its first frame, a hitch the first time each figure is
 * reached. A 1 px target stands in for the chain's buffer while the programs are made (the variant is fixed then; the
 * wait for the driver is the promise).
 */
export function precompile(
  gl: WebGLRenderer,
  root: Object3D,
  camera: Camera,
  scene?: Scene,
): Promise<unknown> {
  const rt = new WebGLRenderTarget(1, 1);
  const prev = gl.getRenderTarget();
  gl.setRenderTarget(rt);
  let done: Promise<unknown>;
  try {
    done = gl.compileAsync(root, camera, scene ?? null);
  } finally {
    gl.setRenderTarget(prev);
  }
  return done.finally(() => rt.dispose());
}
