// Endless mountainside: a pure height function sampled by recycled plane chunks.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";
import { fbm } from "./noise.js";

// Pure height function of world (x, z). Downhill is -z.
export function terrainHeight(x, z) {
  let h = z * C.SLOPE;
  h += (fbm(x * 0.008, z * 0.008, 3) - 0.5) * 2 * 15; // big rollers
  h += (fbm(x * 0.031 + 7.3, z * 0.031 + 3.7, 2) - 0.5) * 2 * 3.6; // moguls
  // Valley walls funnel the rider back toward the middle.
  const t = Math.min(
    Math.max((Math.abs(x) - C.PLAY_HALF) / (C.TERRAIN_WIDTH / 2 - C.PLAY_HALF), 0),
    1,
  );
  h += Math.pow(t, 2.2) * C.WALL_HEIGHT;
  return h;
}

// Finite-difference gradient (dh/dx, dh/dz).
export function terrainGradient(x, z, out) {
  const d = 0.6;
  out.x = (terrainHeight(x + d, z) - terrainHeight(x - d, z)) / (2 * d);
  out.y = (terrainHeight(x, z + d) - terrainHeight(x, z - d)) / (2 * d);
  return out;
}

const SNOW_BRIGHT = new THREE.Color(0xffffff);
const SNOW_SHADE = new THREE.Color(0xc9d7ef);
const SUN_DIR = new THREE.Vector3(0.45, 0.75, 0.35).normalize();

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.chunks = [];
    this.uniforms = { uTime: { value: 0 } };

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
    });
    // Sparkle glints: tiny cells of the snowpack twinkle over time.
    const uniforms = this.uniforms;
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSnowW;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvSnowW = (modelMatrix * vec4(transformed, 1.0)).xyz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vSnowW;
          uniform float uTime;
          float snowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            vec2 cell = floor(vSnowW.xz * 13.0);
            float h = snowHash(cell);
            float tw = smoothstep(0.998, 1.0, sin(h * 6283.0 + uTime * (1.0 + h * 4.0)) * 0.5 + 0.5);
            // fade glints out with distance so they don't read as white squares
            float fade = 1.0 - smoothstep(30.0, 110.0, length(vSnowW - cameraPosition));
            diffuseColor.rgb += tw * 0.28 * fade;
          }`,
        );
    };

    for (let i = 0; i < C.CHUNKS; i++) {
      const geo = new THREE.PlaneGeometry(
        C.TERRAIN_WIDTH,
        C.CHUNK_LEN,
        C.CHUNK_SEGS_X,
        C.CHUNK_SEGS_Z,
      );
      geo.rotateX(-Math.PI / 2);
      const count = geo.attributes.position.count;
      geo.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(count * 3), 3),
      );
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // vertices move; default bounds go stale
      scene.add(mesh);
      this.chunks.push({ mesh, index: -1, z0: 0, z1: 0 });
    }
  }

  // Lay chunks out starting near the player's spawn.
  reset() {
    const startZ = 80; // some slope visible behind the rider
    for (let i = 0; i < this.chunks.length; i++) {
      this.buildChunk(this.chunks[i], i, startZ - i * C.CHUNK_LEN);
    }
  }

  buildChunk(chunk, index, z1) {
    chunk.index = index;
    chunk.z1 = z1; // near (uphill) edge
    chunk.z0 = z1 - C.CHUNK_LEN; // far (downhill) edge
    const centerZ = (chunk.z0 + chunk.z1) / 2;
    chunk.mesh.position.set(0, 0, centerZ);

    const pos = chunk.mesh.geometry.attributes.position;
    const col = chunk.mesh.geometry.attributes.color;
    const nrm = chunk.mesh.geometry.attributes.normal;
    const grad = new THREE.Vector2();
    const n = new THREE.Vector3();
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i) + centerZ;
      const h = terrainHeight(wx, wz);
      pos.setY(i, h);

      terrainGradient(wx, wz, grad);
      n.set(-grad.x, 1, -grad.y).normalize();
      nrm.setXYZ(i, n.x, n.y, n.z);

      // Slope-lit snow: sunny faces bright white, steep faces cool blue.
      const light = Math.max(n.dot(SUN_DIR), 0);
      c.copy(SNOW_SHADE).lerp(SNOW_BRIGHT, Math.pow(light, 1.4));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    nrm.needsUpdate = true;
  }

  // Recycle chunks that fell behind; returns list of freshly built chunks
  // so obstacles can repopulate them.
  update(playerZ, time) {
    this.uniforms.uTime.value = time;
    const rebuilt = [];
    let minZ0 = Infinity;
    let maxIndex = -1;
    for (const ch of this.chunks) {
      minZ0 = Math.min(minZ0, ch.z0);
      maxIndex = Math.max(maxIndex, ch.index);
    }
    for (const ch of this.chunks) {
      if (ch.z1 > playerZ + C.AV_MAX_GAP + 90) {
        this.buildChunk(ch, ++maxIndex, minZ0);
        minZ0 = ch.z0;
        rebuilt.push(ch);
      }
    }
    return rebuilt;
  }
}
