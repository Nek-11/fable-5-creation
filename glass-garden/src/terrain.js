// Pure-math terrain shared by rendering, sim, and placement.
import { CFG } from './config.js';
import { fbm2, smoothstep, clamp } from './noise.js';

const { jar, pond } = CFG;

/** Height of the soil surface at (x, z) inside the jar. */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  let y = jar.soilBaseY
    + fbm2(x * 1.05 + 3.7, z * 1.05 + 9.1, 3) * 0.11
    + fbm2(x * 3.2 + 21, z * 3.2 + 5, 2) * 0.035;
  // soil banks up slightly against the glass
  y += smoothstep(1.35, jar.innerRadius, r) * 0.12;
  // pond depression
  const dp = Math.hypot(x - pond.x, z - pond.z);
  y -= (1 - smoothstep(0, pond.r + 0.42, dp)) * 0.42;
  return y;
}

export function distToPond(x, z) {
  return Math.hypot(x - pond.x, z - pond.z);
}

export function isInPond(x, z) {
  return distToPond(x, z) < pond.r;
}

/** Clamp a point to the walkable disc, avoiding the wall. */
export function clampToJar(p, margin = 0) {
  const max = jar.walkRadius - margin;
  const r = Math.hypot(p.x, p.z);
  if (r > max) {
    const s = max / r;
    p.x *= s;
    p.z *= s;
  }
  return p;
}

/** Random point on the soil (not in the pond). */
export function randomSoilPoint(maxR = jar.walkRadius - 0.1) {
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * maxR;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (distToPond(x, z) > pond.r + 0.14) return { x, z };
  }
  return { x: 0.9, z: -0.6 };
}

export { clamp };
