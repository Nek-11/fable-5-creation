// Endless papercraft city: deterministic chunks of merged, vertex-colored
// building geometry, fold-line edges, collision AABBs, and updraft vents.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CONFIG as C } from "./config.js";
import {
  mulberry32,
  hashChunk,
  colorize,
  BUILDING_COLORS,
  PAPER_WHITE,
  paperMaterial,
  foldLineMaterial,
} from "./paper.js";

const TREE_GREEN = new THREE.Color(0x8fb07c);
const TRUNK_BROWN = new THREE.Color(0xb99a72);
const VENT_GRAY = new THREE.Color(0xc9c2b2);
const TOWER_COLOR = new THREE.Color(0x9fb4c8);

function makeGroundTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#e9e2cf";
  ctx.fillRect(0, 0, size, size);

  // street grid along tile edges
  ctx.strokeStyle = "#d5cdb8";
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, size, size);
  ctx.strokeStyle = "#ded6c1";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // paper fiber speckles
  const rng = mulberry32(7);
  ctx.fillStyle = "rgba(120,110,90,0.08)";
  for (let i = 0; i < 260; i++) {
    ctx.fillRect(rng() * size, rng() * size, 1.6, 1.6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const GROUND_TILE = 45; // world units per texture tile
const GROUND_SIZE = 1440;

export class City {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map(); // "cx,cz" -> chunk record

    const groundTex = makeGroundTexture();
    groundTex.repeat.set(GROUND_SIZE / GROUND_TILE, GROUND_SIZE / GROUND_TILE);
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    scene.add(this.ground);
  }

  chunkKey(cx, cz) {
    return `${cx},${cz}`;
  }

  update(playerPos) {
    const pcx = Math.round(playerPos.x / C.CHUNK_SIZE);
    const pcz = Math.round(playerPos.z / C.CHUNK_SIZE);
    const R = C.CHUNK_RADIUS;

    const needed = new Set();
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const key = this.chunkKey(pcx + dx, pcz + dz);
        needed.add(key);
        if (!this.chunks.has(key)) {
          this.chunks.set(key, this.buildChunk(pcx + dx, pcz + dz));
        }
      }
    }
    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        this.scene.remove(chunk.group);
        chunk.mesh.geometry.dispose();
        if (chunk.lines) chunk.lines.geometry.dispose();
        this.chunks.delete(key);
      }
    }

    // keep the ground under the player, snapped so the texture doesn't swim
    this.ground.position.x = Math.round(playerPos.x / GROUND_TILE) * GROUND_TILE;
    this.ground.position.z = Math.round(playerPos.z / GROUND_TILE) * GROUND_TILE;
  }

  buildChunk(cx, cz) {
    const rng = mulberry32(hashChunk(cx, cz));
    const originX = cx * C.CHUNK_SIZE;
    const originZ = cz * C.CHUNK_SIZE;
    const geos = [];
    const edgeGeos = [];
    const buildings = [];
    const vents = [];

    const nearSpawn = Math.abs(cx) <= 1 && Math.abs(cz) <= 1;

    const addBox = (x, y, z, w, h, d, color, withEdges = true) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(x, y + h / 2, z);
      colorize(geo, color);
      geos.push(geo);
      if (withEdges) edgeGeos.push(new THREE.EdgesGeometry(geo));
    };

    const addCone = (x, y, z, radius, h, color, segments = 4) => {
      const geo = new THREE.ConeGeometry(radius, h, segments);
      geo.rotateY(Math.PI / 4);
      geo.translate(x, y + h / 2, z);
      colorize(geo, color);
      geos.push(geo);
      edgeGeos.push(new THREE.EdgesGeometry(geo));
    };

    const addVent = (x, z, top) => {
      const geo = new THREE.CylinderGeometry(0.9, 1.3, 1.8, 8);
      geo.translate(x, top + 0.9, z);
      colorize(geo, VENT_GRAY);
      geos.push(geo);
      vents.push({ x, z, top: top + 1.8 });
    };

    // The office tower you were thrown from — chunk (0,0) only.
    if (cx === 0 && cz === 0) {
      addBox(0, 0, 16, 15, 72, 15, TOWER_COLOR);
      buildings.push({ x0: -7.5, x1: 7.5, y1: 72, z0: 8.5, z1: 23.5 });
      addCone(0, 72, 16, 11, 8, PAPER_WHITE);
    }

    // Buildings on a 3x3 street grid inside the chunk.
    const CELL = C.CHUNK_SIZE / 3;
    for (let gx = 0; gx < 3; gx++) {
      for (let gz = 0; gz < 3; gz++) {
        if (rng() > 0.62) continue; // empty lot
        const jx = (rng() - 0.5) * (CELL * 0.3);
        const jz = (rng() - 0.5) * (CELL * 0.3);
        const x = originX + (gx - 1) * CELL + jx;
        const z = originZ + (gz - 1) * CELL + jz;

        // keep the launch corridor clear
        if (cx === 0 && cz === 0 && Math.hypot(x, z - 4) < 30) continue;

        const w = 8 + rng() * 10;
        const d = 8 + rng() * 10;
        let h = 8 + rng() * 32;
        if (nearSpawn) h = Math.min(h, 24);

        const color = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
        addBox(x, 0, z, w, h, d, color);
        buildings.push({
          x0: x - w / 2,
          x1: x + w / 2,
          y1: h,
          z0: z - d / 2,
          z1: z + d / 2,
        });

        const roofRoll = rng();
        if (roofRoll < 0.4) {
          // folded pyramid roof
          addCone(x, h, z, Math.max(w, d) * 0.62, 3 + rng() * 4, PAPER_WHITE);
        } else if (roofRoll < 0.68) {
          // rooftop vent -> updraft column
          addVent(x + (rng() - 0.5) * w * 0.4, z + (rng() - 0.5) * d * 0.4, h);
        }
      }
    }

    // Street-level steam grates (low updrafts to catch when desperate).
    if (rng() < 0.5 && !(cx === 0 && cz === 0)) {
      addVent(
        originX + (rng() - 0.5) * C.CHUNK_SIZE * 0.8,
        originZ + (rng() - 0.5) * C.CHUNK_SIZE * 0.8,
        0,
      );
    }

    // Paper trees along the streets.
    const treeCount = Math.floor(rng() * 4);
    for (let i = 0; i < treeCount; i++) {
      const x = originX + (rng() - 0.5) * C.CHUNK_SIZE * 0.9;
      const z = originZ + (rng() - 0.5) * C.CHUNK_SIZE * 0.9;
      addBox(x, 0, z, 0.7, 2, 0.7, TRUNK_BROWN, false);
      addCone(x, 1.6, z, 2 + rng() * 1.5, 4 + rng() * 3, TREE_GREEN, 5);
    }

    const group = new THREE.Group();
    let mesh = null;
    let lines = null;
    if (geos.length > 0) {
      const merged = mergeGeometries(geos, false);
      mesh = new THREE.Mesh(merged, paperMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      for (const g of geos) g.dispose();
    }
    if (edgeGeos.length > 0) {
      const mergedEdges = mergeGeometries(edgeGeos, false);
      lines = new THREE.LineSegments(mergedEdges, foldLineMaterial);
      group.add(lines);
      for (const g of edgeGeos) g.dispose();
    }
    this.scene.add(group);

    return { group, mesh, lines, buildings, vents };
  }

  *nearbyChunks(pos) {
    const pcx = Math.round(pos.x / C.CHUNK_SIZE);
    const pcz = Math.round(pos.z / C.CHUNK_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const chunk = this.chunks.get(this.chunkKey(pcx + dx, pcz + dz));
        if (chunk) yield chunk;
      }
    }
  }

  // Returns true if a sphere at pos with radius r hits any building.
  collide(pos, r) {
    for (const chunk of this.nearbyChunks(pos)) {
      for (const b of chunk.buildings) {
        if (
          pos.x > b.x0 - r &&
          pos.x < b.x1 + r &&
          pos.z > b.z0 - r &&
          pos.z < b.z1 + r &&
          pos.y < b.y1 + r
        ) {
          return true;
        }
      }
    }
    return false;
  }

  // Upward lift from the strongest vent column at this position.
  updraftAt(pos) {
    let lift = 0;
    for (const chunk of this.nearbyChunks(pos)) {
      for (const v of chunk.vents) {
        const d = Math.hypot(pos.x - v.x, pos.z - v.z);
        if (d > C.VENT_RADIUS) continue;
        const above = pos.y - v.top;
        if (above < -2 || above > C.VENT_HEIGHT) continue;
        const radial = 1 - (d / C.VENT_RADIUS) * 0.7;
        const fade = THREE.MathUtils.clamp(1 - above / C.VENT_HEIGHT, 0, 1);
        lift = Math.max(lift, C.VENT_LIFT * radial * fade);
      }
    }
    return lift;
  }

  // Vents near a position (for the updraft particle system).
  nearbyVents(pos, maxDist) {
    const out = [];
    for (const chunk of this.nearbyChunks(pos)) {
      for (const v of chunk.vents) {
        if (Math.hypot(pos.x - v.x, pos.z - v.z) < maxDist) out.push(v);
      }
    }
    return out;
  }
}
