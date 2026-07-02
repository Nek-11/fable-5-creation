// Shared paper-craft helpers: seeded RNG, vertex-colored geometry, materials.
import * as THREE from "three";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashChunk(cx, cz) {
  let h = (cx * 374761393 + cz * 668265263) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// Pastel construction-paper palette for buildings.
export const BUILDING_COLORS = [
  0xe8a598, // coral
  0xa8c5a0, // sage
  0x9fbcd4, // sky
  0xe6d3a0, // butter
  0xd4a8c0, // rose
  0xc4b8d8, // lilac
  0xe0c4a0, // sand
  0xb8d0c8, // mint
].map((c) => new THREE.Color(c));

export const PAPER_WHITE = new THREE.Color(0xf6f1e3);

// Fill (or create) a per-vertex color attribute on a geometry.
export function colorize(geometry, color) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// One material for all merged, vertex-colored papercraft geometry.
export const paperMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.95,
  metalness: 0,
});

// White fold-line edges drawn over the papercraft meshes.
export const foldLineMaterial = new THREE.LineBasicMaterial({
  color: 0xfffdf5,
  transparent: true,
  opacity: 0.55,
});
