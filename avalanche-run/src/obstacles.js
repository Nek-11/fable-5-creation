// Instanced pines and boulders, repopulated per terrain chunk.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CONFIG as C } from "./config.js";
import { mulberry32 } from "./noise.js";
import { terrainHeight } from "./terrain.js";

const MAX_TREES_PER_CHUNK = 50;
const MAX_ROCKS_PER_CHUNK = 12;

function paint(geo, color) {
  const c = new THREE.Color(color);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

function buildTreeGeometry() {
  const trunk = paint(new THREE.CylinderGeometry(0.28, 0.4, 1.6, 6), 0x4a3426);
  trunk.translate(0, 0.8, 0);
  const lower = paint(new THREE.ConeGeometry(2.5, 3.4, 8), 0x1e4d38);
  lower.translate(0, 3.0, 0);
  const upper = paint(new THREE.ConeGeometry(1.8, 3.0, 8), 0x265c42);
  upper.translate(0, 5.0, 0);
  const cap = paint(new THREE.ConeGeometry(1.1, 1.9, 8), 0xf4f9ff);
  cap.translate(0, 6.6, 0);
  return mergeGeometries([trunk, lower, upper, cap]);
}

export class Obstacles {
  constructor(scene) {
    const treeGeo = buildTreeGeometry();
    const treeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      flatShading: true,
    });
    this.trees = new THREE.InstancedMesh(
      treeGeo,
      treeMat,
      MAX_TREES_PER_CHUNK * C.CHUNKS,
    );
    this.trees.castShadow = true;
    this.trees.frustumCulled = false;
    scene.add(this.trees);

    const rockGeo = new THREE.IcosahedronGeometry(1.4, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x5a6472,
      roughness: 0.85,
      flatShading: true,
    });
    this.rocks = new THREE.InstancedMesh(
      rockGeo,
      rockMat,
      MAX_ROCKS_PER_CHUNK * C.CHUNKS,
    );
    this.rocks.castShadow = true;
    this.rocks.frustumCulled = false;
    scene.add(this.rocks);

    // One collider list per chunk slot.
    this.slots = [];
    this.dummy = new THREE.Object3D();
  }

  reset(terrain) {
    this.slots = terrain.chunks.map(() => ({ z0: 0, z1: 0, colliders: [] }));
    terrain.chunks.forEach((chunk, slot) => this.populate(slot, chunk));
  }

  populate(slot, chunk) {
    const s = this.slots[slot];
    s.z0 = chunk.z0;
    s.z1 = chunk.z1;
    s.colliders.length = 0;

    const rng = mulberry32(chunk.index * 7919 + 13);
    const dist = Math.max(-chunk.z1, 0);
    const treeCount = Math.min(
      C.TREES_MIN + Math.floor(dist / C.TREE_RAMP),
      C.TREES_MAX,
    );

    const treeBase = slot * MAX_TREES_PER_CHUNK;
    for (let i = 0; i < MAX_TREES_PER_CHUNK; i++) {
      if (i < treeCount) {
        let x = (rng() * 2 - 1) * (C.PLAY_HALF + 14);
        const z = chunk.z1 - rng() * C.CHUNK_LEN;
        // keep the first chunks' center corridor clear for the spawn
        if (chunk.index < 2 && Math.abs(x) < 10) x += Math.sign(x || 1) * 12;
        const y = terrainHeight(x, z);
        const sc = 0.8 + rng() * 0.7;
        this.dummy.position.set(x, y - 0.2, z);
        this.dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        this.dummy.scale.setScalar(sc);
        this.dummy.updateMatrix();
        this.trees.setMatrixAt(treeBase + i, this.dummy.matrix);
        s.colliders.push({ x, z, y, r: 1.0 * sc, h: 7 * sc });
      } else {
        this.dummy.position.set(0, -9999, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.trees.setMatrixAt(treeBase + i, this.dummy.matrix);
      }
    }

    const rockBase = slot * MAX_ROCKS_PER_CHUNK;
    for (let i = 0; i < MAX_ROCKS_PER_CHUNK; i++) {
      if (i < C.ROCKS_PER_CHUNK) {
        const x = (rng() * 2 - 1) * (C.PLAY_HALF - 4);
        const z = chunk.z1 - rng() * C.CHUNK_LEN;
        const y = terrainHeight(x, z);
        const sc = 0.7 + rng() * 1.3;
        this.dummy.position.set(x, y + 0.25 * sc, z);
        this.dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        this.dummy.scale.set(sc * (0.8 + rng() * 0.6), sc, sc * (0.8 + rng() * 0.6));
        this.dummy.updateMatrix();
        this.rocks.setMatrixAt(rockBase + i, this.dummy.matrix);
        if (chunk.index >= 1) s.colliders.push({ x, z, y, r: 1.3 * sc, h: 2 * sc });
      } else {
        this.dummy.position.set(0, -9999, 0);
        this.dummy.scale.setScalar(0.001);
        this.dummy.updateMatrix();
        this.rocks.setMatrixAt(rockBase + i, this.dummy.matrix);
      }
    }

    this.trees.instanceMatrix.needsUpdate = true;
    this.rocks.instanceMatrix.needsUpdate = true;
  }

  // Called with the chunks the terrain just recycled.
  repopulate(terrain, rebuiltChunks) {
    for (const chunk of rebuiltChunks) {
      const slot = terrain.chunks.indexOf(chunk);
      if (slot >= 0) this.populate(slot, chunk);
    }
  }

  // Returns the collider hit near (x, z) at height y, or null.
  collide(x, z, y, r) {
    for (const s of this.slots) {
      if (z > s.z1 + 5 || z < s.z0 - 5) continue;
      for (const o of s.colliders) {
        const dx = o.x - x;
        const dz = o.z - z;
        if (dx * dx + dz * dz < (o.r + r) * (o.r + r)) {
          if (y < o.y + o.h) return o;
        }
      }
    }
    return null;
  }
}
