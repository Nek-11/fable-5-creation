// The drowned world: a canyon of sand and basalt walled by cliffs, grown
// over with kelp forests, coral gardens and bioluminescent anemones.
// Everything static is painted with vertex colors + emissive/sway attributes
// and merged into a single mesh drawn by the sonar-light shader.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG as C } from './config.js';
import { getGlowTexture } from './glow.js';

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

// deterministic world-space noise (also used for collision-consistent dunes)
function vn(x, y, z) {
  return (
    (Math.sin(x * 1.7 + Math.sin(y * 2.3 + 1.3)) +
      Math.sin(y * 1.9 + Math.sin(z * 1.7 + 4.2)) +
      Math.sin(z * 2.3 + Math.sin(x * 1.3 + 2.1))) /
    3
  );
}

const COL = new THREE.Color();

function paint(geo, fn) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const emissive = new Float32Array(pos.count);
  const sway = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const r = fn(pos.getX(i), pos.getY(i), pos.getZ(i), i);
    colors[i * 3] = r.c.r;
    colors[i * 3 + 1] = r.c.g;
    colors[i * 3 + 2] = r.c.b;
    emissive[i] = r.e || 0;
    sway[i] = r.s || 0;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aEmissive', new THREE.BufferAttribute(emissive, 1));
  geo.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  return geo;
}

const CORAL_PALETTE = ['#ff5a8a', '#ff9a3c', '#c06aff', '#2ee6c8', '#ff6a5e', '#ffd166'];
const ANEMONE_PALETTE = ['#9fe8ff', '#ffd98a', '#ff9adf', '#a8ffcf'];

export class World {
  constructor(def, seed) {
    this.def = def;
    this.R = def.radius;
    this.rng = mulberry32(seed);
    this.seedOff = this.rng() * 100;
    this.obstacles = []; // {x, z, r, h} cylinders
    this.clusters = [];
    this.group = null;

    // layout: spawn on one side, gate on the far side
    const spawnAngle = this.rng() * Math.PI * 2;
    const sr = this.R * 0.72;
    this.spawnPos = new THREE.Vector3(Math.cos(spawnAngle) * sr, 0, Math.sin(spawnAngle) * sr);
    this.spawnPos.y = this.floorHeight(this.spawnPos.x, this.spawnPos.z) + 4;

    const gateAngle = spawnAngle + Math.PI + (this.rng() - 0.5) * 0.7;
    const gr = this.R * 0.68;
    this.gatePos = new THREE.Vector3(Math.cos(gateAngle) * gr, 0, Math.sin(gateAngle) * gr);
    this.gatePos.y = this.floorHeight(this.gatePos.x, this.gatePos.z) + 2.9;
  }

  floorHeight(x, z) {
    const s = this.seedOff;
    let h =
      1.3 * Math.sin(x * 0.09 + s) * Math.sin(z * 0.075 + s * 0.7) +
      0.6 * Math.sin(x * 0.21 + 2.1) * Math.sin(z * 0.18 + s) +
      0.25 * vn(x * 0.5, s, z * 0.5);
    // the seafloor rises into the cliff base near the rim
    const r = Math.hypot(x, z);
    const edge = Math.max(0, r - this.R * 0.8);
    h += edge * edge * 0.045;
    return h;
  }

  samplePoint(minR, maxR, avoid = [], minDist = 8) {
    for (let tries = 0; tries < 40; tries++) {
      const a = this.rng() * Math.PI * 2;
      const r = minR + this.rng() * (maxR - minR);
      const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (avoid.every((q) => Math.hypot(p.x - q.x, p.z - q.z) > minDist)) return p;
    }
    const a = this.rng() * Math.PI * 2;
    const r = minR + this.rng() * (maxR - minR);
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }

  randomPoint(yMin = 2, yMax = C.MAXY - 4) {
    const a = this.rng() * Math.PI * 2;
    const r = Math.sqrt(this.rng()) * this.R * 0.9;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = Math.max(this.floorHeight(x, z) + 2, yMin + this.rng() * (yMax - yMin));
    return new THREE.Vector3(x, y, z);
  }

  // ----- collision -----

  collide(pos, r) {
    // rim
    const rr = Math.hypot(pos.x, pos.z);
    const maxR = this.R - 1.2;
    if (rr > maxR) {
      pos.x *= maxR / rr;
      pos.z *= maxR / rr;
    }
    // floor & ceiling
    const fh = this.floorHeight(pos.x, pos.z);
    if (pos.y < fh + r + 0.35) pos.y = fh + r + 0.35;
    if (pos.y > C.MAXY - 1) pos.y = C.MAXY - 1;
    // rock spires
    for (const o of this.obstacles) {
      if (pos.y > o.h) continue;
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + r;
      if (d < min && d > 1e-6) {
        pos.x = o.x + (dx / d) * min;
        pos.z = o.z + (dz / d) * min;
      }
    }
  }

  losBlocked(a, b) {
    for (const o of this.obstacles) {
      if (Math.min(a.y, b.y) > o.h) continue;
      // 2D segment vs circle
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      if (len2 < 1e-6) continue;
      let t = ((o.x - a.x) * abx + (o.z - a.z) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
      const dx = a.x + abx * t - o.x;
      const dz = a.z + abz * t - o.z;
      if (Math.hypot(dx, dz) < o.r * 0.85) return true;
    }
    return false;
  }

  // ----- geometry -----

  build(scene, pings) {
    this.worldMat = pings.material({ world: true, touch: [0.05, 0.09, 0.12] });
    const group = new THREE.Group();
    const geos = [];
    const R = this.R;
    const rng = this.rng;

    // --- seafloor ---
    const size = (R + 24) * 2;
    const floor = new THREE.PlaneGeometry(size, size, 130, 130);
    floor.rotateX(-Math.PI / 2);
    {
      const pos = floor.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, this.floorHeight(pos.getX(i), pos.getZ(i)));
      floor.computeVertexNormals();
      const sand = new THREE.Color('#c2ae83');
      const silt = new THREE.Color('#5d6e66');
      paint(floor, (x, y, z) => {
        const t = Math.min(1, Math.max(0, 0.5 + vn(x * 0.3, 9.1, z * 0.3) * 0.7));
        return { c: COL.copy(sand).lerp(silt, t).clone() };
      });
      geos.push(floor);
    }

    // --- rim cliffs ---
    {
      const cliff = new THREE.CylinderGeometry(R + 9, R + 4, C.MAXY + 26, 110, 9, true);
      cliff.translate(0, (C.MAXY + 26) / 2 - 4, 0);
      const pos = cliff.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const bump = vn(x * 0.18, y * 0.14, z * 0.18) * 3.2 + vn(x * 0.6, y * 0.5, z * 0.6) * 0.9;
        const rr = Math.hypot(x, z);
        pos.setX(i, x + (x / rr) * bump);
        pos.setZ(i, z + (z / rr) * bump);
      }
      cliff.computeVertexNormals();
      const dark = new THREE.Color('#1d2634');
      const veined = new THREE.Color('#3a3350');
      paint(cliff, (x, y, z) => {
        const t = Math.max(0, vn(x * 0.4, y * 0.35, z * 0.4));
        return { c: COL.copy(dark).lerp(veined, t).clone() };
      });
      geos.push(cliff);
    }

    // --- rock spires (the maze of the open water) ---
    const spireSpots = [];
    for (let i = 0; i < this.def.pillars; i++) {
      const p = this.samplePoint(R * 0.15, R * 0.85, [this.spawnPos, this.gatePos, ...spireSpots], 11);
      spireSpots.push(p);
      const h = 9 + rng() * 15;
      const rTop = 0.5 + rng() * 1.3;
      const rBot = 2.2 + rng() * 2.2;
      const spire = new THREE.CylinderGeometry(rTop, rBot, h, 9, 5);
      const fy = this.floorHeight(p.x, p.z);
      spire.translate(p.x, fy + h / 2 - 0.8, p.z);
      const pos = spire.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j);
        const y = pos.getY(j);
        const z = pos.getZ(j);
        pos.setX(j, x + vn(x * 0.5 + 7, y * 0.4, z * 0.5) * 0.9);
        pos.setZ(j, z + vn(x * 0.5, y * 0.4, z * 0.5 + 3) * 0.9);
      }
      spire.computeVertexNormals();
      const rock = new THREE.Color('#2c3547');
      const vein = new THREE.Color('#5a4a78');
      paint(spire, (x, y, z) => {
        const t = Math.max(0, vn(x * 0.7, y * 0.5, z * 0.7)) * 0.8;
        return { c: COL.copy(rock).lerp(vein, t).clone() };
      });
      geos.push(spire);
      this.obstacles.push({ x: p.x, z: p.z, r: rBot * 0.75, h: fy + h });
    }

    // --- boulders ---
    for (let i = 0; i < 26; i++) {
      const p = this.samplePoint(R * 0.1, R * 0.9, [this.gatePos], 6);
      const s = 0.7 + rng() * 1.8;
      const rock = new THREE.IcosahedronGeometry(s, 1);
      rock.scale(1, 0.65 + rng() * 0.4, 1);
      const pos = rock.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const d = 1 + vn(pos.getX(j) * 1.3 + i, pos.getY(j) * 1.3, pos.getZ(j) * 1.3) * 0.28;
        pos.setXYZ(j, pos.getX(j) * d, pos.getY(j) * d, pos.getZ(j) * d);
      }
      rock.computeVertexNormals();
      rock.translate(p.x, this.floorHeight(p.x, p.z) + s * 0.3, p.z);
      const base = new THREE.Color('#334052');
      paint(rock, (x, y, z) => ({ c: COL.copy(base).multiplyScalar(0.8 + vn(x, y, z) * 0.3).clone() }));
      geos.push(rock);
    }

    // --- life clusters: kelp, grass, coral and anemones gather in gardens ---
    const NC = 9;
    for (let i = 0; i < NC; i++)
      this.clusters.push(this.samplePoint(R * 0.15, R * 0.8, this.clusters, 12));

    const clusterPt = (spread) => {
      const c = this.clusters[(rng() * this.clusters.length) | 0];
      const a = rng() * Math.PI * 2;
      const r = rng() * spread;
      return new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
    };

    // kelp: tall ribbons, rooted dark green, glowing faintly teal at the tips
    for (let i = 0; i < this.def.kelp; i++) {
      const p = clusterPt(9);
      const h = 6 + rng() * 9;
      const kelp = new THREE.PlaneGeometry(0.45 + rng() * 0.25, h, 1, 9);
      kelp.translate(0, h / 2, 0);
      kelp.rotateY(rng() * Math.PI);
      const fy = this.floorHeight(p.x, p.z);
      kelp.translate(p.x, fy - 0.1, p.z);
      const root = new THREE.Color('#14432c');
      const tip = new THREE.Color('#5fd99a');
      paint(kelp, (x, y, z) => {
        const t = Math.min(1, Math.max(0, (y - fy) / h));
        return { c: COL.copy(root).lerp(tip, t * t).clone(), e: t * t * 0.05, s: Math.pow(t, 1.4) };
      });
      geos.push(kelp);
    }

    // sea grass tufts
    for (let i = 0; i < this.def.grass; i++) {
      const p = clusterPt(12);
      const h = 0.7 + rng() * 1.1;
      const blade = new THREE.PlaneGeometry(0.14, h, 1, 3);
      blade.translate(0, h / 2, 0);
      blade.rotateY(rng() * Math.PI);
      const fy = this.floorHeight(p.x, p.z);
      blade.translate(p.x, fy - 0.05, p.z);
      const g1 = new THREE.Color('#1d5c3e');
      const g2 = new THREE.Color('#3f9a68');
      paint(blade, (x, y, z) => {
        const t = Math.min(1, Math.max(0, (y - fy) / h));
        return { c: COL.copy(g1).lerp(g2, t).clone(), s: t * 0.6 };
      });
      geos.push(blade);
    }

    // corals: branching trees and fans in vivid reef colors
    for (let i = 0; i < this.def.coral; i++) {
      const p = clusterPt(8);
      const fy = this.floorHeight(p.x, p.z);
      const color = new THREE.Color(CORAL_PALETTE[(rng() * CORAL_PALETTE.length) | 0]);
      const deep = color.clone().multiplyScalar(0.35);
      if (rng() < 0.55) {
        // branching coral: a small fan of tilted cones
        const branches = [];
        const nB = 6 + ((rng() * 8) | 0);
        for (let b = 0; b < nB; b++) {
          const bh = 0.5 + rng() * 1.3;
          const cone = new THREE.ConeGeometry(0.05 + rng() * 0.07, bh, 5);
          cone.translate(0, bh / 2, 0);
          cone.rotateX((rng() - 0.5) * 1.3);
          cone.rotateZ((rng() - 0.5) * 1.3);
          cone.translate((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5);
          branches.push(cone);
        }
        const coral = mergeGeometries(branches, false);
        coral.translate(p.x, fy, p.z);
        paint(coral, (x, y, z) => {
          const t = Math.min(1, (y - fy) / 1.6);
          return { c: COL.copy(deep).lerp(color, t).clone(), e: t * 0.12, s: t * 0.06 };
        });
        geos.push(coral);
      } else {
        // fan coral: a thin arc swaying in the current
        const fan = new THREE.CircleGeometry(0.8 + rng() * 0.9, 14, Math.PI * 0.15, Math.PI * 0.7);
        fan.rotateY(rng() * Math.PI);
        fan.translate(p.x, fy + 0.05, p.z);
        paint(fan, (x, y, z) => {
          const t = Math.min(1, (y - fy) / 1.7);
          return { c: COL.copy(deep).lerp(color, 0.3 + t * 0.7).clone(), e: t * 0.1, s: t * 0.35 };
        });
        geos.push(fan);
      }
    }

    // anemones: the living lamps of the reef
    for (let i = 0; i < this.def.anemones; i++) {
      const p = clusterPt(10);
      const fy = this.floorHeight(p.x, p.z);
      const glowCol = new THREE.Color(ANEMONE_PALETTE[(rng() * ANEMONE_PALETTE.length) | 0]);
      const body = new THREE.Color('#5c3a6e');
      const parts = [new THREE.SphereGeometry(0.22 + rng() * 0.12, 8, 6)];
      parts[0].scale(1, 0.6, 1);
      const nT = 8 + ((rng() * 6) | 0);
      for (let k = 0; k < nT; k++) {
        const th = 0.35 + rng() * 0.3;
        const tent = new THREE.ConeGeometry(0.035, th, 4);
        tent.translate(0, th / 2 + 0.08, 0);
        tent.rotateX((rng() - 0.5) * 1.2);
        tent.rotateZ((rng() - 0.5) * 1.2);
        parts.push(tent);
      }
      const anem = mergeGeometries(parts, false);
      anem.translate(p.x, fy, p.z);
      paint(anem, (x, y, z) => {
        const t = Math.min(1, Math.max(0, (y - fy) / 0.7));
        return { c: COL.copy(body).lerp(glowCol, t).clone(), e: Math.pow(t, 2.2) * 0.85, s: t * 0.25 };
      });
      geos.push(anem);
    }

    // normalize indexing before merging (mergeGeometries refuses a mix)
    const world = new THREE.Mesh(
      mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false),
      this.worldMat,
    );
    group.add(world);

    // --- the gate: a ring of worked stone that answers to lanternfish light ---
    this.gateGroup = new THREE.Group();
    this.gateRingMat = new THREE.MeshBasicMaterial({
      color: 0x571318,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.gateDiscMat = new THREE.MeshBasicMaterial({
      color: 0x30090c,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.13, 10, 48), this.gateRingMat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.15, 40), this.gateDiscMat);
    this.gateGroup.add(ring, disc);

    // light column: once open, a beam rises to the surface — a landmark
    // visible from anywhere in the canyon
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0x7fd8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beamH = C.MAXY + 10 - this.gatePos.y;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, beamH, 18, 1, true), this.beamMat);
    beam.position.y = beamH / 2;
    this.gateGroup.add(beam);

    // soft halo sprite so the gate glows through the murk
    this.gateHaloMat = new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0x8a1a1a,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Sprite(this.gateHaloMat);
    halo.scale.setScalar(7);
    this.gateGroup.add(halo);

    this.gateGroup.position.copy(this.gatePos);
    this.gateGroup.lookAt(new THREE.Vector3(0, this.gatePos.y, 0));
    group.add(this.gateGroup);

    this.group = group;
    scene.add(group);

    // fish prisons: lanternfish shelter in the gardens, far from the spawn
    this.fishSpots = [];
    const farClusters = this.clusters
      .filter((c) => Math.hypot(c.x - this.spawnPos.x, c.z - this.spawnPos.z) > 16)
      .sort(() => rng() - 0.5);
    for (let i = 0; i < this.def.fish; i++) {
      const c = farClusters[i % farClusters.length] || this.samplePoint(R * 0.2, R * 0.8);
      const p = new THREE.Vector3(c.x + (rng() - 0.5) * 5, 0, c.z + (rng() - 0.5) * 5);
      p.y = this.floorHeight(p.x, p.z) + 1.6 + rng() * 3;
      this.fishSpots.push(p);
    }

    // predators start away from the player
    this.creatureSpawns = [];
    for (let i = 0; i < this.def.lurkers + this.def.wraiths; i++) {
      let p;
      do {
        p = this.randomPoint(3, C.MAXY - 8);
      } while (p.distanceTo(this.spawnPos) < 22);
      this.creatureSpawns.push(p);
    }
  }

  setGateOpen(open) {
    if (open) {
      this.gateRingMat.color.set(0x86f0ff);
      this.gateDiscMat.color.set(0x2a95b8);
      this.gateHaloMat.color.set(0x4fd0e0);
    }
  }

  pulseGate(time, open) {
    const s = Math.sin(time * (open ? 3.0 : 1.3)) * 0.5 + 0.5;
    this.gateRingMat.opacity = open ? 0.55 + s * 0.4 : 0.2 + s * 0.15;
    this.gateDiscMat.opacity = open ? 0.28 + s * 0.25 : 0.08 + s * 0.07;
    this.gateHaloMat.opacity = open ? 0.45 + s * 0.3 : 0.18 + s * 0.1;
    this.beamMat.opacity = open ? 0.07 + s * 0.05 : 0;
  }

  dispose(scene) {
    if (!this.group) return;
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.worldMat.dispose();
    this.gateRingMat.dispose();
    this.gateDiscMat.dispose();
    this.beamMat.dispose();
    this.gateHaloMat.dispose();
    this.group = null;
  }
}
