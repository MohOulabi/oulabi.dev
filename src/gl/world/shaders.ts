/**
 * GLSL of the world module: the one-off bake of the planet's surface into a cube map, the planet itself, the
 * atmosphere and hub glow (one fullscreen pass, analytic), the instanced arcs of the network and the one points
 * draw of the flow. Linear light out; the post chain blooms what is above 1 and tone maps (AgX).
 */
import { BAND } from "./band";
import { MAX_CITIES, NODES } from "./layout";

export const COMMON = /* glsl */ `
#define PI 3.14159265
const vec3 GOLD = vec3(0.815, 0.479, 0.133);
const vec3 STAR = vec3(0.855, 0.886, 0.937);

uint pcgW(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hw(float id, uint k) { return float(pcgW(uint(id) ^ (k * 2654435769u))) * 2.3283064e-10; }
vec3 hash33(vec3 p) {
  uvec3 q = uvec3(ivec3(p) + 32768);
  uint a = pcgW(q.x ^ pcgW(q.y ^ pcgW(q.z)));
  uint b = pcgW(a ^ 0x9e3779b9u);
  uint c = pcgW(b ^ 0x85ebca6bu);
  return vec3(float(a), float(b), float(c)) * 2.3283064e-10;
}
`;

/**
 * Fig. 9: a city's light as the storm hits it (k = hit x (1 - field), 0 calm): slow irregular dips, each city at its
 * own moments (key), a little flutter while it dips, and a faint sag everywhere. Dims and recovers; never a strobe.
 */
const FLICKER = /* glsl */ `
float flicker(float key, float t, float k) {
  if (k <= 0.0) return 1.0;
  float a = sin(t * 2.3 + key * 41.3) + 0.6 * sin(t * 5.9 + key * 17.9) + 0.4 * sin(t * 13.7 + key * 7.1);
  float dip = smoothstep(0.2, 1.25, a);
  float flutter = 0.5 + 0.5 * sin(t * 29.0 + key * 13.0);
  return 1.0 - k * (0.16 + 0.68 * dip + 0.12 * dip * flutter);
}
`;

const NOISE = /* glsl */ `
// simplex noise 3D (Ashima Arts, MIT)
vec4 permuteW(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 tisW(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permuteW(permuteW(permuteW(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = tisW(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p, int oct) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`;

/** Great-circle arc from a to b (unit, base frame) at s in 0..1, lifted by h * sin(pi s) above radius r. */
const ARC = /* glsl */ `
vec3 arcDir(vec3 a, vec3 b, float s) {
  float c = clamp(dot(a, b), -1.0, 1.0);
  float om = acos(c);
  float so = sin(om);
  if (so < 1e-4) return a;
  return (sin((1.0 - s) * om) * a + sin(s * om) * b) / so;
}
vec3 arcPos(vec3 a, vec3 b, float s, float h, float r) {
  return arcDir(a, b, s) * (r + 0.004 + h * sin(PI * clamp(s, 0.0, 1.0)));
}
/** A hop from the hub out to a node: low, and swirled a little (every hop turns the same way). */
vec3 hopPos(vec3 hub, vec3 nd, float s, float r) {
  float ang = acos(clamp(dot(hub, nd), -1.0, 1.0));
  vec3 p = arcPos(hub, nd, s, r * 0.05 * ang, r);
  vec3 side = normalize(cross(hub, nd));
  return p + side * sin(PI * s) * ang * r * 0.32;
}
`;

// ---------------------------------------------------------------------------------------------------------------
// bake: the surface, once. R = the land, as a signed distance about the coast (0.5; public/data/earth.png's R),
// G = cloud, B = city light, A = the switch-on order.

export const BAKE_VERT = /* glsl */ `
varying vec3 vP;
void main() {
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BAKE_FRAG = /* glsl */ `
${COMMON}
${NOISE}
/**
 * Every city the world lights, the region's then the far ones (world.ts bake), one column each: row 0 its direction
 * and light (size), row 1 its switch-on order and seed. A table, not uniform arrays, so their number costs the
 * uniform budget nothing.
 */
uniform sampler2D uCities;
uniform int uNC;
/** The map (scripts/bake-earth.mjs): R the land's signed distance about the coast, G where people live. */
uniform sampler2D uEarth;
/** The geographic frame (layout.ts GEO_*): base direction -> latitude and longitude. */
uniform vec3 uGeoX;
uniform vec3 uGeoY;
uniform vec3 uGeoZ;
uniform float uLon0;
varying vec3 vP;

/** The map at base direction p (equirectangular, north up; read at its own resolution, so no seam at the wrap). */
vec4 earth(vec3 p) {
  float lon = uLon0 + atan(dot(p, uGeoY), dot(p, uGeoX));
  float lat = asin(clamp(dot(p, uGeoZ), -1.0, 1.0));
  return textureLod(uEarth, vec2(fract(lon / (2.0 * PI) + 0.5), lat / PI + 0.5), 0.0);
}

void main() {
  vec3 p = normalize(vP);

  // the land, from the map; lights only a little inland of the coast, never on the water
  vec4 e = earth(p);
  float R = e.r;
  float onLand = smoothstep(0.497, 0.512, R);

  // weather: warped, banded a little by latitude, and thin over the subtropical deserts (Arabia, the Sahara, Iran)
  vec3 cq = p * 2.1;
  vec3 cw = vec3(fbm(cq + 21.0, 3), fbm(cq + 37.0, 3), fbm(cq + 53.0, 3));
  float cl = fbm(cq * 1.5 + cw * 1.3, 6);
  float sl = dot(p, uGeoZ);
  cl = smoothstep(0.12, 0.66, cl + 0.12 * sin(sl * 9.0));
  cl *= 1.0 - 0.8 * exp(-pow((abs(sl) - 0.42) / 0.17, 2.0));

  // city light: cores, sprawl and arteries, the towns along the region's corridors, and towns near the cities; and
  // the nearest city's order (what its towns and glow switch on with), in the same pass over the table
  float L = 0.0;
  float A = 0.0;
  float W = 1e-5;
  float bestD = 1e3;
  float nearOrder = 1.0;
  for (int i = 0; i < uNC; i++) {
    vec4 ca = texelFetch(uCities, ivec2(i, 0), 0);
    vec3 c = ca.xyz;
    float s = ca.w;
    float d = distance(p, c);
    float r0 = 0.0028 + 0.0068 * s;
    bool nearer = d < bestD;
    if (!nearer && d >= r0 * 9.0) continue;
    vec4 cb = texelFetch(uCities, ivec2(i, 1), 0);
    if (nearer) {
      bestD = d;
      nearOrder = cb.x;
    }
    if (d < r0 * 9.0) {
      float sd = cb.y;
      float core = exp(-d * d / (r0 * r0));
      float n1 = snoise(p * 48.0 + sd * 40.0);
      float sprawl = exp(-pow(d / (r0 * 2.6), 1.3)) * (0.45 + 0.55 * smoothstep(-0.5, 0.6, n1));
      vec3 t1 = normalize(cross(c, vec3(0.0, 1.0, 0.0)));
      vec3 t2 = cross(c, t1);
      vec3 v = p - c * dot(p, c);
      float ang = atan(dot(v, t2), dot(v, t1));
      float k = sd < 0.5 ? 4.0 : 6.0;
      float perp = d * abs(sin((ang - sd * 6.283) * k * 0.5));
      float arms = exp(-perp * perp / (0.0018 * 0.0018)) * exp(-d / (r0 * 4.0)) * smoothstep(r0 * 0.4, r0 * 1.4, d);
      float li = (core * 1.2 + sprawl * 0.5 + arms * 0.35) * (0.45 + 0.55 * s);
      L += li;
      // each city grows outward from its core
      A += li * (cb.x + 0.07 * smoothstep(0.0, r0 * 5.0, d));
      W += li;
    }
  }
  float bestNear = exp(-bestD / 0.06);
  // where the map says people live, a faint broken ribbon of light (the Nile, the Levant's coast, the Gulf's shore
  // read as lines from orbit; the planet breaks it into points up close), lit just after its nearest city
  float rib = 0.5 * pow(e.g, 1.3) * (0.5 + 0.5 * smoothstep(-0.4, 0.6, snoise(p * 140.0)));
  L += rib;
  A += rib * min(0.99, nearOrder + 0.03);
  W += rib;
  // and the towns on it: one to a cell (about 40 km), as many as it says; a town stands where its centre is on land,
  // whole or not at all
  vec3 gt = p * 150.0;
  vec3 ct = floor(gt);
  vec3 ht = hash33(ct + 101.0);
  vec3 jt = 0.25 + 0.5 * hash33(ct + 57.0);
  vec4 et = earth(normalize(ct + jt));
  if (ht.x < et.g * 0.95 && et.r > 0.512) {
    float dc = length(fract(gt) - jt);
    float li = exp(-dc * dc / 0.04) * (0.1 + 0.42 * ht.y * ht.y) * (0.6 + 0.7 * et.g);
    L += li;
    A += li * min(0.99, nearOrder + 0.025 + 0.08 * ht.z);
    W += li;
  }
  // and a few larger ones round the cities
  vec3 g = p * 60.0;
  vec3 cell = floor(g);
  vec3 hh = hash33(cell);
  if (hh.x < 0.3 * bestNear * bestNear) {
    vec3 jit = 0.3 + 0.4 * hash33(cell + 17.0);
    float dc = length(fract(g) - jit);
    float li = exp(-dc * dc / 0.03) * (0.06 + 0.3 * hh.y * hh.y);
    L += li;
    A += li * min(0.99, nearOrder + 0.09 + 0.2 * (0.5 + 0.5 * snoise(p * 30.0 + 7.0)));
    W += li;
  }
  L *= onLand;
  // where there is no light, the order of the nearest city (so the blurred glow switches on with it)
  float ord = L < 0.002 ? min(0.99, nearOrder + 0.02) : A / W;
  gl_FragColor = vec4(R, cl, clamp(L, 0.0, 1.0), clamp(ord, 0.0, 1.0));
}
`;

// ---------------------------------------------------------------------------------------------------------------
// the planet

export const PLANET_VERT = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const PLANET_FRAG = /* glsl */ `
${COMMON}
${NOISE}
${FLICKER}
${BAND}
uniform samplerCube uSurf;
uniform vec3 uMoon;
uniform mat3 uRotT;
uniform vec3 uC;
uniform float uR;
uniform vec3 uSun;
uniform float uCityK;
uniform float uAlpha;
uniform float uTime;
uniform vec3 uHub;
uniform float uHubGlow;
/** How much of the cities' light is still on the ground (it lifts off into the flock in fig. 10). */
uniform float uLit;
uniform vec3 uImpact;
uniform float uFlick;
/** Geographic north (layout.ts AXIS) and the field's axis (MAG), round which the aurora's ovals stand. */
uniform vec3 uAx;
uniform vec3 uMag;
uniform float uOval;
uniform float uAurG;
/** The baked surface's presence: 0 before the map has loaded and been baked, easing to 1 after. */
uniform float uSurfK;
/** The cloud's turn about y (rad). */
uniform float uCloud;
varying vec3 vW;

vec3 rotAxisY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

/** Lights on the ground: one jittered spot per cell, lit with probability k, radius r of the cell. */
float spots(vec3 p, float r, float k) {
  vec3 c = floor(p);
  vec3 f = fract(p) - 0.5;
  vec3 hh = hash33(c);
  vec3 j = (hh - 0.5) * 0.45;
  float d = length(f - j);
  return step(hh.x, k) * smoothstep(r, 0.0, d) * (0.45 + hh.y);
}

void main() {
  vec3 N = normalize(vW - uC);
  vec3 P = uRotT * N;
  vec3 V = normalize(cameraPosition - vW);
  vec4 s = texture(uSurf, P);
  // (until the surface is baked from the map, a plain dark sea that the land and its lights fade in over)
  s.b *= uSurfK;
  float aa = fwidth(s.r) + 0.0015;
  float land = smoothstep(0.5 - aa, 0.5 + aa, s.r) * uSurfK;
  float elev = clamp((s.r - 0.5) * 2.2, 0.0, 1.0);
  float sunD = dot(N, uSun);
  float day = smoothstep(-0.03, 0.2, sunD);
  float cl = texture(uSurf, rotAxisY(P, uCloud)).g * uSurfK;

  // night: Earth, kinda visible. The sea deep and cold; the land a faint cool tone above it, the subtropical
  // deserts (Arabia, the Sahara) a breath warmer and lighter inland; the coasts catch a little skylight on both
  // sides, so the Red Sea and the Gulf read as dark channels between lit shores; the cloud a breath lighter; all
  // under a faint cold skylight that gives the sphere its form
  float sinLat = dot(P, uAx);
  float desert = exp(-pow((abs(sinLat) - 0.42) / 0.16, 2.0)) * smoothstep(0.62, 0.9, s.r);
  vec3 ground = mix(vec3(0.0052, 0.0064, 0.0090), vec3(0.0080, 0.0074, 0.0070), desert);
  vec3 col = mix(vec3(0.0009, 0.0016, 0.0038), ground, land);
  float shore = exp(-pow((s.r - 0.5) / 0.2, 2.0)) * uSurfK;
  col += mix(vec3(0.0010, 0.0018, 0.0034), vec3(0.0034, 0.0044, 0.0062), land) * shore;
  col = mix(col, vec3(0.0062, 0.0068, 0.0086), cl * 0.55);
  float sky = max(dot(N, uMoon), 0.0);
  col += mix(vec3(0.0010, 0.0022, 0.0048), vec3(0.0040, 0.0043, 0.0050), max(land, cl)) * sky * sky;

  // day, a crescent at most: the land by its climate (as the core show's Earth, cosmos.ts: sand in the subtropical
  // deserts, deep green elsewhere, ice at the poles), deep sea, white cloud; the sea catches the sun
  float sl = abs(sinLat);
  float dry = exp(-pow((sl - 0.42) / 0.17, 2.0)) * smoothstep(0.52, 0.7, s.r);
  vec3 dayL = mix(vec3(0.07, 0.085, 0.04), mix(vec3(0.22, 0.14, 0.075), vec3(0.34, 0.26, 0.17), elev), dry);
  dayL = mix(dayL, vec3(0.37, 0.385, 0.4), smoothstep(0.84, 0.93, sl));
  vec3 dayC = mix(vec3(0.005, 0.016, 0.042), dayL, land);
  dayC = mix(dayC, vec3(0.82, 0.84, 0.88), cl);
  vec3 sunC = mix(vec3(1.0, 0.34, 0.09), vec3(1.0, 0.93, 0.84), smoothstep(0.0, 0.35, sunD));
  col += dayC * sunC * max(sunD, 0.0) * 2.6;
  vec3 Hh = normalize(uSun + V);
  col += sunC * pow(max(dot(N, Hh), 0.0), 180.0) * (1.0 - land) * (1.0 - cl) * day * 3.0;
  float twi = exp(-pow(sunD / 0.07, 2.0));
  col += vec3(0.45, 0.13, 0.03) * twi * 0.06 * (0.3 + 0.7 * cl);

  // city light, switching on cluster by cluster as uCityK passes each one's order; it steps down under the copy and
  // as it lifts off into the flock
  vec3 base = col;
  float on = smoothstep(s.a - 0.04, s.a + 0.015, uCityK);
  float fresh = on * (1.0 - smoothstep(s.a + 0.015, s.a + 0.12, uCityK));
  float night = 1.0 - 0.97 * day;
  // seen through the long path of air near the limb, the lights on the ground fade
  float seen = smoothstep(0.02, 0.42, dot(N, V));
  // the faintest tail of the baked light is dropped, so no city casts a stain beyond its last houses
  float Lb = max(s.b - 0.025, 0.0) / 0.975;
  if (Lb * on > 0.002) {
    // the fine pattern, per pixel: neighbourhoods switch on where the baked density is high, and inside them the
    // grain of streets and houses; both fade to their mean where they are smaller than a pixel
    vec3 q = P * uR;
    float fq = length(fwidth(q));
    float n = snoise(q * 18.0);
    float hood = 0.8 + 0.2 * n * clamp(1.6 - fq * 50.0, 0.0, 1.0);
    // the denser the light, the more of the ground is lit: sparse points in the country, a carpet in the city
    float k = clamp(Lb * 1.9 + 0.04, 0.0, 1.0);
    vec3 g1 = q * 70.0;
    vec3 g2 = q * 26.0;
    float fw = fq * 70.0;
    float dots = 1.5 * spots(g1, 0.36, k) + 0.7 * spots(g2, 0.3, k * 0.8);
    float grain = mix(0.6 * k, dots / max(k, 0.25), clamp(1.4 - fw * 0.9, 0.0, 1.0));
    float lights = pow(Lb, 0.4) * on * (1.0 + 1.6 * fresh) * night * (1.0 - 0.45 * cl) * flicker(s.a * 97.0, uTime, uFlick);
    vec3 lc = mix(GOLD * 1.25, vec3(1.0, 0.8, 0.52) * 1.35, smoothstep(0.5, 1.0, Lb));
    col += lc * lights * grain * hood * 1.35 * seen;
  }
  // their glow in the air, and on the cloud above them
  vec4 sb = textureLod(uSurf, P, 4.5);
  float onB = smoothstep(sb.a - 0.04, sb.a + 0.04, uCityK);
  col += GOLD * sb.b * uSurfK * onB * (0.022 + 0.16 * cl) * night * seen * flicker(sb.a * 97.0, uTime, uFlick);

  // the platform: a warm pool of light at the hub
  float rho = acos(clamp(dot(P, uHub), -1.0, 1.0));
  col += GOLD * (exp(-rho * rho / (0.012 * 0.012)) * 0.8 + exp(-rho / 0.03) * 0.05) * uHubGlow * night * seen;
  // fig. 8: your point lands: a soft ring of light spreads out over the ground from the hub, and fades
  if (uImpact.z > 0.0) {
    float dr = (rho - uImpact.x) / uImpact.y;
    // a crisp leading edge, a soft wash fading behind it; it lights the land more than the sea, and the cloud
    float ring = exp(-dr * dr) * (dr > 0.0 ? 1.0 : 0.7) + 0.1 * exp(dr * 0.5) * step(rho, uImpact.x);
    float ground = 0.6 + 0.3 * land + 0.15 * cl;
    col += mix(GOLD * 1.35, vec3(1.0, 0.86, 0.66), 0.3) * ring * ground * uImpact.z * (0.35 + 0.65 * night) * seen * 0.2;
  }
  col = base + (col - base) * uLit * bandDim();
  // fig. 9: the aurora's light on the ground and the cloud beneath each oval
  if (uAurG > 0.0) {
    float co = acos(clamp(abs(dot(N, uMag)), 0.0, 1.0));
    float g = exp(-pow((co - uOval) / 0.06, 2.0)) + 0.25 * exp(-pow((co - uOval) / 0.16, 2.0));
    col += vec3(0.05, 0.34, 0.24) * g * uAurG * (0.04 + 0.08 * cl) * night;
  }

  gl_FragColor = vec4(col, uAlpha);
}
`;

// ---------------------------------------------------------------------------------------------------------------
// the air and the hub's light: one fullscreen pass, analytic

export const AIR_VERT = /* glsl */ `
varying vec2 vNdc;
void main() {
  vNdc = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const AIR_FRAG = /* glsl */ `
${COMMON}
${BAND}
uniform mat4 uInvVP;
uniform vec3 uC;
uniform float uR;
uniform vec3 uSun;
uniform float uI;
uniform vec2 uRes;
uniform vec3 uHubP;
uniform vec4 uHubA;
uniform vec4 uStorm;
uniform vec4 uAur;
uniform float uOvalA;
varying vec2 vNdc;

void main() {
  vec4 wp = uInvVP * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(wp.xyz / wp.w - cameraPosition);
  vec3 o = cameraPosition - uC;
  float b = dot(o, dir);
  float h2 = max(dot(o, o) - b * b, 0.0);
  float hm = sqrt(h2);
  vec3 col = vec3(0.0);
  // a thin shell of air: a crisp line at the limb (thin), a soft glow above it (glow), a faint veil further out
  float H = uR * 0.013;
  if (b < 0.0 && hm < uR * 1.5) {
    vec3 X;
    float thin;
    float glow;
    float alt = max(hm - uR, 0.0);
    float hit = step(hm, uR);
    if (hit < 0.5) {
      X = o + dir * (-b);
      float fade = 1.0 - smoothstep(uR * 0.25, uR * 0.48, alt);
      thin = exp(-alt / H) * fade;
      glow = (0.11 * exp(-alt / (H * 5.0)) + 0.006 * exp(-alt / (H * 16.0))) * fade;
    } else {
      X = o + dir * (-b - sqrt(uR * uR - h2));
      float mu = sqrt(max(0.0, 1.0 - h2 / (uR * uR)));
      thin = 1.0 / (1.0 + mu * 46.0);
      glow = 0.116 / (1.0 + mu * 46.0);
    }
    vec3 n = normalize(X);
    float sd = dot(n, uSun);
    float lit = smoothstep(-0.16, 0.24, sd);
    float twi = exp(-pow((sd + 0.03) / 0.12, 2.0));
    float fwd = max(dot(dir, uSun), 0.0);
    vec3 blue = vec3(0.09, 0.28, 1.0);
    vec3 fire = vec3(1.0, 0.36, 0.07);
    // the line: blue where sunlit, fire at the terminator, a cold airglow all the way round the night side
    col += (blue * lit * 0.95 + fire * twi * 0.75 * (0.35 + 0.65 * fwd) + vec3(0.14, 0.34, 0.66) * 0.26) * thin;
    // the glow above it: the same, softer, and a little warm light scattered forward toward the sun
    col += (blue * lit * 0.7 + fire * twi * 0.35 + vec3(0.14, 0.34, 0.66) * 0.2) * glow;
    col += vec3(1.0, 0.66, 0.36) * pow(fwd, 24.0) * (lit + twi) * exp(-alt / (H * 2.2)) * 0.5;
    // fig. 9: where the storm strikes the air it glows a cold violet blue (the side that faces it)
    if (uStorm.w > 0.0) {
      float face = max(dot(n, -uStorm.xyz), 0.0);
      col += vec3(0.34, 0.42, 1.0) * face * face * (thin * 0.9 + glow * 5.0) * uStorm.w;
    }
    // fig. 9: the aurora lights the air round each oval a faint green
    if (uAur.w > 0.0) {
      float co = acos(clamp(abs(dot(n, uAur.xyz)), 0.0, 1.0));
      float ring = exp(-pow((co - uOvalA) / 0.11, 2.0));
      col += vec3(0.08, 0.62, 0.42) * ring * (thin * 0.5 + glow * 4.0) * uAur.w;
    }
    // the dawn: a thread of fire in the lowest air where the sun is about to rise, and the sun's light on the edge
    if (hit < 0.5) {
      col += fire * twi * exp(-alt / (H * 0.45)) * (0.6 + 2.2 * pow(fwd, 3.0));
      col += vec3(1.0, 0.8, 0.56) * pow(fwd, 60.0) * exp(-alt / (uR * 0.035)) * 1.4;
    }
  }

  // the hub: a calm core, a warm halo and a faint horizontal glint (stepping down under the copy)
  if (uHubP.z > 0.001) {
    vec2 px = (vNdc - uHubP.xy) * uRes * 0.5;
    float d = length(px);
    float core = exp(-pow(d / uHubA.x, 2.0)) * 5.0;
    float halo = exp(-d / uHubA.y) * 0.5 + exp(-d / (uHubA.y * 2.6)) * 0.035;
    float streak = exp(-abs(px.y) / (uHubA.x * 0.3)) * exp(-abs(px.x) / (uHubA.y * 1.8)) * 0.16 * uHubA.w;
    vec3 hc = mix(GOLD * 1.5, vec3(1.0, 0.94, 0.86) * 1.8, exp(-d / (uHubA.x * 1.6)));
    col += hc * (core + halo + streak) * uHubA.z * uHubP.z * bandDim();
  }
  gl_FragColor = vec4(col * uI, 1.0);
}
`;

// ---------------------------------------------------------------------------------------------------------------
// the network: instanced ribbons along great circles, lifted into arches

export const ARC_VERT = /* glsl */ `
${COMMON}
${ARC}
attribute vec3 aA;
attribute vec3 aB;
attribute vec4 aP;
attribute vec4 aQ;
attribute vec2 aI;
uniform mat3 uRot;
uniform vec3 uC;
uniform float uR;
uniform vec2 uRes;
uniform float uProj;
uniform float uDpr;
uniform float uNetK;
uniform float uRouteK;
uniform vec4 uNode[${NODES}];
varying float vS;
varying float vX;
varying float vDraw;
varying vec4 vP;
varying vec4 vQ;
varying vec2 vI;
varying float vPx;
varying float vVis;

void main() {
  float aS = position.x;
  float aSide = position.y;
  float kind = aP.y;
  float draw;
  if (kind < 0.5) draw = clamp((uNetK - aP.z) / 0.16, 0.0, 1.0);
  else if (kind < 1.5) draw = clamp((uRouteK - aP.z * 0.5) / 0.35, 0.0, 1.0);
  else {
    draw = uNode[int(aI.y + 0.5)].w;
  }
  vDraw = draw;
  vS = aS;
  vX = aSide;
  vP = aP;
  vQ = aQ;
  vI = aI;
  if (draw <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float e = aS < 0.99 ? 0.01 : -0.01;
  vec3 p0 = uC + uRot * (kind > 1.5 ? hopPos(aA, aB, aS, uR) : arcPos(aA, aB, aS, aP.x, uR));
  vec3 p1 = uC + uRot * (kind > 1.5 ? hopPos(aA, aB, aS + e, uR) : arcPos(aA, aB, aS + e, aP.x, uR));
  vec4 c0 = projectionMatrix * viewMatrix * vec4(p0, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(p1, 1.0);
  if (c0.w < 0.05 || c1.w < 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 s0 = c0.xy / c0.w * uRes * 0.5;
  vec2 s1 = c1.xy / c1.w * uRes * 0.5;
  vec2 t = (s1 - s0) * sign(e);
  t = length(t) > 1e-4 ? normalize(t) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-t.y, t.x);
  // half-width in px: a world-sized ribbon, kept between a hairline and a soft glow
  float px = clamp(0.022 * uProj / c0.w, 2.5 * uDpr, 10.0 * uDpr);
  if (kind > 1.5) px *= 0.7;
  vPx = px;
  // an arc whose both ends are round the back of the planet is not drawn (no fragments over the horizon)
  vec3 wa = uRot * aA;
  vec3 wb = uRot * aB;
  float fa = dot(wa, normalize(cameraPosition - (uC + wa * uR)));
  float fb = dot(wb, normalize(cameraPosition - (uC + wb * uR)));
  vVis = smoothstep(-0.14, 0.06, max(fa, fb)) * mix(1.0, smoothstep(-0.3, 0.02, min(fa, fb)), 0.7);
  c0.xy += nrm * aSide * px / (uRes * 0.5) * c0.w;
  gl_Position = c0;
}
`;

export const ARC_FRAG = /* glsl */ `
${COMMON}
${FLICKER}
${BAND}
uniform float uFlick;
uniform float uTime;
uniform float uFlow;
uniform float uCalm;
uniform float uDpr;
uniform float uFade;
uniform float uNetDim;
uniform vec4 uWave[4];
varying float vS;
varying float vX;
varying float vDraw;
varying vec4 vP;
varying vec4 vQ;
varying vec2 vI;
varying float vPx;
varying float vVis;

void main() {
  if (vS > vDraw + 0.002 || vVis <= 0.0) discard;
  float x = abs(vX);
  // a fine line of light (about two pixels) inside a soft glow
  float core = exp(-pow(x * vPx / (0.75 * uDpr), 2.0));
  float glow = exp(-x * 3.5) * (1.0 - x);
  float ends = smoothstep(0.0, 0.035, vS) * smoothstep(1.0, 0.965, vS);
  float kind = vP.y;
  float toHub = vP.w;
  // pulses running from a to b, and the bright head while it draws on
  float sp = vQ.x;
  float ph = vQ.y;
  float pulse = 0.0;
  for (int k = 0; k < 2; k++) {
    // a comet: a sharp head and a long fading tail behind it
    float q = fract(uTime * sp * 0.8 + ph + float(k) * 0.5);
    float dq = vS - q;
    pulse += dq > 0.0 ? exp(-pow(dq / 0.007, 2.0)) : exp(dq / 0.07) * 0.55 + exp(-pow(dq / 0.007, 2.0)) * 0.45;
  }
  float head = vDraw < 1.0 ? exp(-pow((vS - vDraw) / 0.012, 2.0)) * 2.2 : 0.0;
  // a tap sends a wave from its city along every route out of it
  float wave = 0.0;
  for (int k = 0; k < 4; k++) {
    vec4 wv = uWave[k];
    float age = uTime - wv.y;
    if (wv.z <= 0.0 || age < 0.0 || age > 6.0) continue;
    float s = -1.0;
    if (abs(wv.x - vI.x) < 0.5) s = age * 0.42;
    else if (abs(wv.x - vI.y) < 0.5 && kind < 1.5) s = 1.0 - age * 0.42;
    if (s < -0.5) continue;
    float dq = (vS - s) / 0.03;
    wave += exp(-dq * dq) * wv.z * (1.0 - age / 6.0);
  }
  float base = kind < 0.5 ? 0.36 : kind < 1.5 ? 0.26 : 0.2;
  // (the surge is dormant: uFlow, uCalm and uNetDim are held at 0, 0, 1, and kinds 1 and 2 are not drawn) the
  // routes to the hub carry the surge: brighter as the flow rises, steadier once it held
  float carry = toHub * uFlow;
  float line = base * (1.0 + carry * 0.9 * (1.0 - 0.35 * uCalm)) * vQ.z;
  // in the surge the network steps back and the routes into the hub lead
  if (toHub < 0.5) line *= uNetDim;
  float pulseK = (kind < 1.5 ? 1.0 : 0.6) * (1.0 - 0.75 * carry) * (1.0 - 0.4 * uCalm);
  float comet = pulse * 2.4 * pulseK * vQ.z * (toHub < 0.5 ? uNetDim : 1.0);
  float lit = line + comet + head + wave * 3.0;
  vec3 c = mix(GOLD * 1.3, STAR * 1.1, 0.2 + 0.4 * core + 0.25 * carry);
  float gl = (line * 0.3 + comet * 0.45 + head * 0.5 + wave) * (0.14 + 0.22 * carry);
  vec3 col = c * (lit * core + gl * glow * 2.5) * ends * uFade * vVis * flicker(vP.z * 97.0 + 0.5, uTime, uFlick * 1.15);
  gl_FragColor = vec4(col * bandDim(), 1.0);
}
`;

// ---------------------------------------------------------------------------------------------------------------
// the flow: city markers, node markers, the flood itself and the wave packets, in one points draw. Figs 8-10 draw
// the city markers and, while a tap's wave runs, the wave packets (world.ts sets the draw range); the node markers
// and the flood belong to the surge, dormant (no nodes lit, no flood particles budgeted).

export const FLOW_VERT = /* glsl */ `
${COMMON}
${ARC}
${FLICKER}
uniform float uFlick;
uniform mat3 uRot;
uniform vec3 uC;
uniform float uR;
uniform float uProj;
uniform float uDpr;
uniform float uTime;
uniform float uCityK;
uniform float uNC;
uniform float uFlowN;
uniform float uWaveN;
uniform vec4 uCity[${MAX_CITIES}];
uniform vec4 uCityI[${MAX_CITIES}];
uniform vec4 uNode[${NODES}];
uniform float uF;
uniform float uCalm;
uniform float uFade;
uniform float uMarks;
uniform float uPeak;
uniform vec4 uWave[4];
varying vec3 vCol;
varying float vKind;

void hide() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  vCol = vec3(0.0);
  vKind = 0.0;
}

void main() {
  float id = position.x;
  vec3 base;
  vec3 col;
  float wpx;
  float kind = 0.0;
  float nMarks = uNC + ${NODES}.0;
  if (id < uNC) {
    // a city: lights when its turn comes, flashes as it switches on, brightens with a tap's wave
    vec4 c = uCity[int(id)];
    vec4 ci = uCityI[int(id)];
    float on = smoothstep(ci.x - 0.01, ci.x + 0.03, uCityK);
    float fresh = on * (1.0 - smoothstep(ci.x + 0.03, ci.x + 0.16, uCityK));
    float wave = 0.0;
    for (int k = 0; k < 4; k++) {
      float age = uTime - uWave[k].y;
      if (uWave[k].z > 0.0 && abs(uWave[k].x - id) < 0.5 && age >= 0.0 && age < 2.0) wave += (1.0 - age / 2.0) * uWave[k].z;
    }
    float tw = 0.9 + 0.1 * sin(uTime * (0.7 + hw(id, 3u)) + id * 2.1);
    float I = on * (0.42 + 0.36 * c.w) * tw * (1.0 + 2.2 * fresh + 2.0 * wave + 0.6 * uF) * uMarks * flicker(ci.x * 97.0, uTime, uFlick);
    if (id < 0.5) I *= 0.5;
    base = c.xyz * (uR + 0.03);
    col = mix(GOLD * 1.4, vec3(1.0, 0.9, 0.72) * 1.6, 0.4 + 0.3 * fresh) * I;
    wpx = (0.05 + 0.075 * c.w) * (1.0 + 0.5 * wave);
    kind = 1.0;
  } else if (id < nMarks) {
    // a node of the platform: it ignites with the load, then breathes with all the others
    vec4 nd = uNode[int(id - uNC)];
    float g = nd.w;
    if (g <= 0.001) {
      hide();
      return;
    }
    float ig = g * (1.0 + 1.6 * g * (1.0 - g) * 4.0 * (1.0 - uCalm));
    float br = mix(0.9 + 0.1 * sin(uTime * 2.3 + id * 1.7), 0.88 + 0.12 * sin(uTime * 1.1), uCalm);
    base = nd.xyz * (uR + 0.02);
    col = mix(GOLD * 1.6, vec3(1.0, 0.95, 0.88) * 1.8, 0.5) * ig * br * (0.7 + 0.5 * uPeak) * uMarks;
    wpx = 0.08 + 0.03 * uPeak;
    kind = 1.0;
  } else if (id < nMarks + uFlowN) {
    // (dormant) the flood: particle i rides the route of city c to the hub; once the load is spread, it hops on
    float i = id - nMarks;
    float c = 1.0 + floor(hw(i, 1u) * (uNC - 1.0));
    vec4 ci = uCityI[int(c)];
    if (hw(i, 2u) > uF * ci.w) {
      hide();
      return;
    }
    vec3 a = uCity[int(c)].xyz;
    vec3 hub = uCity[0].xyz;
    float sp = ci.z * (0.8 + 0.4 * hw(i, 3u));
    float s = fract(uTime * sp + hw(i, 4u));
    int j = int(hw(i, 5u) * ${NODES}.0);
    vec4 nd = uNode[j];
    bool routed = hw(i, 6u) < nd.w * 0.88;
    float split = 0.86;
    float spread = 0.006 + 0.014 * (1.0 - uCalm);
    vec3 nrm = normalize(cross(a, hub));
    float r1 = sqrt(-2.0 * log(max(hw(i, 7u), 1e-4)));
    float th = hw(i, 8u) * 6.2831853;
    vec2 off = vec2(cos(th), sin(th) * 0.6) * r1 * spread;
    float I;
    if (routed && s > split) {
      float u = (s - split) / (1.0 - split);
      base = hopPos(hub, nd.xyz, u, uR);
      base += normalize(base) * off.y * 0.2;
      I = 1.1 * smoothstep(1.0, 0.85, u);
    } else {
      float sm = routed ? s / split : s;
      float env = pow(sin(PI * sm), 0.7);
      base = arcPos(a, hub, sm, ci.y, uR);
      base += (nrm * off.x + normalize(base) * off.y) * env;
      I = smoothstep(0.0, 0.06, sm) * (0.55 + 0.6 * sm) * (routed ? 1.0 : smoothstep(1.0, 0.94, sm));
    }
    float white = step(0.72, hw(i, 9u));
    col = mix(GOLD * 1.5, STAR * 1.3, white) * I * (0.8 / (0.5 + uF * 0.7));
    wpx = 0.009 + 0.005 * hw(i, 10u);
    kind = 0.0;
  } else {
    // a wave packet: a dense burst of light from the tapped city along its route to the hub
    float i = id - nMarks - uFlowN;
    int k = int(i / uWaveN);
    vec4 wv = uWave[k];
    float age = uTime - wv.y;
    if (wv.z <= 0.0 || age < 0.0 || age > 7.0) {
      hide();
      return;
    }
    float c = wv.x;
    if (c < 0.5) {
      hide();
      return;
    }
    vec4 ci = uCityI[int(c)];
    vec3 a = uCity[int(c)].xyz;
    vec3 hub = uCity[0].xyz;
    // dense at the head, thinning into a tail
    float s = age * ci.z * 1.6 - pow(hw(i, 11u), 2.2) * 0.3;
    if (s < 0.0 || s > 1.0) {
      hide();
      return;
    }
    vec3 nrm = normalize(cross(a, hub));
    float r1 = sqrt(-2.0 * log(max(hw(i, 12u), 1e-4)));
    float th = hw(i, 13u) * 6.2831853;
    base = arcPos(a, hub, s, ci.y, uR);
    base += (nrm * cos(th) + normalize(base) * sin(th) * 0.6) * r1 * 0.018 * pow(sin(PI * s), 0.6);
    col = mix(vec3(1.0, 0.9, 0.7), GOLD * 1.4, hw(i, 14u)) * 1.6 * wv.z * smoothstep(1.0, 0.92, s) * smoothstep(0.0, 0.04, s);
    wpx = 0.02;
    kind = 0.0;
  }
  vec3 wpos = uC + uRot * base;
  // markers on the surface fade out at the limb (no lights floating over the horizon)
  if (kind > 0.5) col *= smoothstep(0.02, 0.22, dot(normalize(wpos - uC), normalize(cameraPosition - wpos)));
  vec4 mv = viewMatrix * vec4(wpos, 1.0);
  float dist = max(-mv.z, 0.05);
  float px = wpx * uProj / dist;
  float minPx = kind > 0.5 ? 2.5 * uDpr : 1.3 * uDpr;
  float bright = 1.0;
  if (px < minPx) {
    bright = (px * px) / (minPx * minPx);
    px = minPx;
  }
  px = min(px, (kind > 0.5 ? 46.0 : 7.0) * uDpr);
  col *= bright * uFade;
  if (max(col.r, max(col.g, col.b)) < 0.0005) {
    hide();
    return;
  }
  gl_Position = projectionMatrix * mv;
  gl_PointSize = px;
  vCol = col;
  vKind = kind;
}
`;

export const FLOW_FRAG = /* glsl */ `
${BAND}
varying vec3 vCol;
varying float vKind;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float a = vKind < 0.5 ? exp(-r2 * 4.5) * (1.0 - r2) : (exp(-r2 * 36.0) * 1.8 + exp(-r2 * 5.0) * 0.22) * (1.0 - r2);
  gl_FragColor = vec4(vCol * a * bandDim(), 1.0);
}
`;

// ---------------------------------------------------------------------------------------------------------------
// the far lights' markers (layout.ts FAR): one point each, from their own attributes (no uniform arrays), drawn as
// the region's city markers are but smaller and softer, so the region's lights lead. They switch on with their
// baked ground light (the same order, the same flicker in the storm) and step down with it as the flock rises.

export const FAR_VERT = /* glsl */ `
${COMMON}
${FLICKER}
/** x its light (./places.ts w), y its switch-on order, z its seed; position is its base direction. */
attribute vec3 aF;
uniform float uFlick;
uniform mat3 uRot;
uniform vec3 uC;
uniform float uR;
uniform float uProj;
uniform float uDpr;
uniform float uTime;
uniform float uCityK;
uniform float uFade;
uniform float uMarks;
varying vec3 vCol;

void main() {
  float on = smoothstep(aF.y - 0.01, aF.y + 0.03, uCityK);
  vec3 wpos = uC + uRot * (position * (uR + 0.03));
  // on the surface it fades out toward the limb (no light floating over the horizon)
  float face = smoothstep(0.04, 0.3, dot(normalize(wpos - uC), normalize(cameraPosition - wpos)));
  if (on * face * uMarks * uFade <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vCol = vec3(0.0);
    return;
  }
  float fresh = on * (1.0 - smoothstep(aF.y + 0.03, aF.y + 0.14, uCityK));
  float tw = 0.9 + 0.1 * sin(uTime * (0.7 + aF.z) + aF.z * 61.0);
  float I = on * face * (0.22 + 0.3 * aF.x) * tw * (1.0 + 1.6 * fresh) * uMarks * uFade * flicker(aF.y * 97.0, uTime, uFlick);
  vec4 mv = viewMatrix * vec4(wpos, 1.0);
  float px = (0.035 + 0.06 * aF.x) * uProj / max(-mv.z, 0.05);
  float minPx = 2.0 * uDpr;
  if (px < minPx) {
    I *= (px * px) / (minPx * minPx);
    px = minPx;
  }
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(px, 22.0 * uDpr);
  vCol = mix(GOLD * 1.4, vec3(1.0, 0.9, 0.72) * 1.5, 0.3 + 0.3 * fresh) * I;
}
`;

export const FAR_FRAG = /* glsl */ `
${BAND}
varying vec3 vCol;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  // a soft core in a faint halo (the region's markers have a harder, brighter core)
  float a = (exp(-r2 * 22.0) * 1.2 + exp(-r2 * 5.0) * 0.16) * (1.0 - r2);
  gl_FragColor = vec4(vCol * a * bandDim(), 1.0);
}
`;

// ---------------------------------------------------------------------------------------------------------------
// the far network (layout.ts FAR_ARCS): the region's ribbons, from their own attributes (no uniform arrays), finer
// and fainter so the region's network leads (on screen its lines are a little over half as bright as the region's,
// and dimmer the farther out the network reaches them). Each link draws on from the end the network reached first
// at the front's pace (aP.y delay, aP.z its share of netK), with the same bright head as it grows and one packet
// riding it (two on the region's links); it fades toward the limb as the far markers do, never stands up over it,
// and goes out under the copy.

export const FAR_ARC_VERT = /* glsl */ `
${COMMON}
${ARC}
attribute vec3 aA;
attribute vec3 aB;
/** x height, y delay (netK), z its draw (netK), w kind (0 web, 1 trunk, 2 bridge) */
attribute vec4 aP;
/** x packet speed, y phase, z brightness, w 1 when a packet rides it */
attribute vec4 aQ;
uniform mat3 uRot;
uniform vec3 uC;
uniform float uR;
uniform vec2 uRes;
uniform float uProj;
uniform float uDpr;
uniform float uNetK;
varying float vS;
varying float vX;
varying float vDraw;
varying vec4 vP;
varying vec4 vQ;
varying float vPx;
varying float vVis;

void main() {
  float aS = position.x;
  float draw = clamp((uNetK - aP.y) / aP.z, 0.0, 1.0);
  vDraw = draw;
  vS = aS;
  vX = position.y;
  vP = aP;
  vQ = aQ;
  if (draw <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float e = aS < 0.99 ? 0.01 : -0.01;
  vec3 b0 = arcPos(aA, aB, aS, aP.x, uR);
  vec3 p0 = uC + uRot * b0;
  vec3 p1 = uC + uRot * arcPos(aA, aB, aS + e, aP.x, uR);
  vec4 c0 = projectionMatrix * viewMatrix * vec4(p0, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(p1, 1.0);
  if (c0.w < 0.05 || c1.w < 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 s0 = c0.xy / c0.w * uRes * 0.5;
  vec2 s1 = c1.xy / c1.w * uRes * 0.5;
  vec2 t = (s1 - s0) * sign(e);
  t = length(t) > 1e-4 ? normalize(t) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-t.y, t.x);
  // finer than the region's (half-width in px)
  float px = clamp(0.014 * uProj / c0.w, 1.3 * uDpr, 6.0 * uDpr);
  vPx = px;
  // the ground under this point of the arc: it fades toward the limb (no line of light along the horizon)
  vec3 g = normalize(uRot * b0);
  float face = dot(g, normalize(cameraPosition - (uC + g * uR)));
  // and the arc itself never stands up over the limb: the line of sight to this point must meet the planet (seen
  // against the night side), never pass beside it (seen against the sky); a close camera sees over a low arch
  vec3 ray = normalize(p0 - cameraPosition);
  vec3 toC = uC - cameraPosition;
  float miss = length(toC - ray * dot(toC, ray));
  vVis = smoothstep(0.03, 0.34, face) * (1.0 - smoothstep(0.98 * uR, 0.998 * uR, miss));
  c0.xy += nrm * position.y * px / (uRes * 0.5) * c0.w;
  gl_Position = c0;
}
`;

export const FAR_ARC_FRAG = /* glsl */ `
${COMMON}
${FLICKER}
${BAND}
uniform float uFlick;
uniform float uTime;
uniform float uDpr;
uniform float uFade;
varying float vS;
varying float vX;
varying float vDraw;
varying vec4 vP;
varying vec4 vQ;
varying float vPx;
varying float vVis;

/**
 * Under the copy the far network goes out altogether (the region's only steps down there: it is the thing to see),
 * and stays out a margin round the band's box: wider at the sides (a long line of the serif can run up to 80 px past
 * it on a desktop), a few px above and below; it comes back over a little more than that, so it is out only where
 * the copy is.
 */
float farBand() {
  vec2 d = abs(gl_FragCoord.xy - uBand.xy) - uBand.zw;
  return 1.0 - (1.0 - smoothstep(0.45 * uBandK.x, 1.0 * uBandK.x, d.x)) * (1.0 - smoothstep(0.1 * uBandK.y, 0.7 * uBandK.y, d.y));
}

void main() {
  if (vS > vDraw + 0.002 || vVis <= 0.0) discard;
  float x = abs(vX);
  // a finer line of light inside a softer glow
  float core = exp(-pow(x * vPx / (0.5 * uDpr), 2.0));
  float glow = exp(-x * 3.8) * (1.0 - x);
  float ends = smoothstep(0.0, 0.05, vS) * smoothstep(1.0, 0.95, vS);
  // one packet (a comet: a sharp head, a fading tail) where the region's links carry two
  float q = fract(uTime * vQ.x * 0.8 + vQ.y);
  float dq = vS - q;
  float pulse = (dq > 0.0 ? exp(-pow(dq / 0.008, 2.0)) : exp(dq / 0.08) * 0.55 + exp(-pow(dq / 0.008, 2.0)) * 0.45) * vQ.w;
  // the bright head while it grows
  float head = vDraw < 1.0 ? exp(-pow((vS - vDraw) / 0.02, 2.0)) * 1.2 : 0.0;
  float line = (vP.w > 0.5 ? 0.1 : 0.07) * vQ.z;
  float comet = pulse * 0.9 * vQ.z;
  float lit = line + comet + head;
  vec3 c = mix(GOLD * 1.3, STAR * 1.1, 0.18 + 0.4 * core);
  float gl = (line * 0.3 + comet * 0.45 + head * 0.5) * 0.12;
  vec3 col = c * (lit * core + gl * glow * 2.5) * ends * uFade * vVis * flicker(vP.y * 97.0 + 0.3, uTime, uFlick * 1.15);
  gl_FragColor = vec4(col * farBand(), 1.0);
}
`;
