// ============================================================
// flora.js — procedural plants (per-plant instanced leaves),
// glowing mushrooms and detritus patches.
// ============================================================
import * as THREE from 'three';
import { CFG } from './config.js';
import { SPECIES } from './sim.js';
import { groundHeight } from './terrain.js';
import { clamp, easeOutBack, easeOutCubic, rand } from './noise.js';

const _dummy = new THREE.Object3D();

// ---------------- shared geometry builders ----------------
function makeLeafGeometry(length, width, bend, tipPow = 0.8) {
  const g = new THREE.PlaneGeometry(width, length, 1, 6);
  g.translate(0, length / 2, 0); // base at origin, grows +y
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    // clamp: float32 rounding can leave the base row a hair below zero,
    // and Math.pow(negative, 1.7) would be NaN
    const t = Math.min(Math.max(pos.getY(i) / length, 0), 1);
    // leaf silhouette
    pos.setX(i, pos.getX(i) * Math.pow(Math.sin(Math.PI * Math.min(t * 0.92 + 0.08, 1)), tipPow));
    // arch away from the stem
    pos.setZ(i, Math.pow(t, 1.7) * bend);
  }
  g.computeVertexNormals();
  return g;
}

function makeHelixStem(height, radius, turns) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const a = t * Math.PI * 2 * turns;
    pts.push(new THREE.Vector3(Math.cos(a) * radius * (0.4 + t * 0.6), t * height, Math.sin(a) * radius * (0.4 + t * 0.6)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016, 5);
}

// per-species shared assets (built once)
function buildAssets() {
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: '#3f7d46', roughness: 0.62, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: '#57a058', roughness: 0.58, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: '#5aa86e', roughness: 0.6, side: THREE.DoubleSide }),
  ];
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4a6b3a', roughness: 0.7 });
  return {
    leafGeos: [
      makeLeafGeometry(0.78, 0.1, 0.3, 0.55),   // fern frond
      makeLeafGeometry(0.3, 0.24, 0.1, 1.4),    // broadleaf
      makeLeafGeometry(0.2, 0.15, 0.08, 1.2),   // vine leaf
    ],
    leafMats,
    stemGeos: [
      new THREE.ConeGeometry(0.05, 0.12, 6).translate(0, 0.06, 0),
      new THREE.CylinderGeometry(0.018, 0.03, 0.36, 6).translate(0, 0.18, 0),
      makeHelixStem(1.35, 0.14, 1.6),
    ],
    stemMat,
    flowerGeo: new THREE.SphereGeometry(0.035, 8, 6),
    flowerMat: new THREE.MeshStandardMaterial({
      color: '#e88aa8', roughness: 0.5,
      emissive: '#e86a9a', emissiveIntensity: 0.35,
    }),
  };
}

// ---------------- one plant ----------------
class PlantVisual {
  constructor(plant, assets) {
    const def = SPECIES[plant.species];
    this.species = plant.species;
    this.leafCount = def.leafCount;

    this.group = new THREE.Group();
    this.group.position.set(plant.x, groundHeight(plant.x, plant.z) - 0.02, plant.z);
    this.group.rotation.y = Math.random() * Math.PI * 2;
    this.group.rotation.x = rand(-0.05, 0.05);
    this.group.rotation.z = rand(-0.05, 0.05);

    this.inner = new THREE.Group();
    this.group.add(this.inner);

    this.stem = new THREE.Mesh(assets.stemGeos[plant.species], assets.stemMat);
    this.stem.castShadow = true;
    this.inner.add(this.stem);

    this.leaves = new THREE.InstancedMesh(assets.leafGeos[plant.species], assets.leafMats[plant.species], def.leafCount);
    this.leaves.castShadow = true;
    this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inner.add(this.leaves);

    // base transform per leaf, species-specific arrangement
    this.bases = [];
    const n = def.leafCount;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      let pos, tilt, yaw, scale;
      if (plant.species === 0) {
        // fern: radial fronds from the base, arching outward
        yaw = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
        tilt = rand(0.55, 0.95); // from vertical
        pos = new THREE.Vector3(Math.cos(yaw) * 0.04, 0.05, Math.sin(yaw) * 0.04);
        scale = rand(0.8, 1.15);
      } else if (plant.species === 1) {
        // sprout: rosette of round leaves near the stem top
        yaw = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
        tilt = rand(0.7, 1.05);
        pos = new THREE.Vector3(Math.cos(yaw) * 0.03, 0.3 - (i % 2) * 0.09, Math.sin(yaw) * 0.03);
        scale = rand(0.85, 1.2);
      } else {
        // vine: leaves spiral up the helix stem
        const a = t * Math.PI * 2 * 1.6;
        const r = 0.14 * (0.4 + t * 0.6);
        pos = new THREE.Vector3(Math.cos(a) * r, t * 1.3 + 0.06, Math.sin(a) * r);
        yaw = a + Math.PI / 2 + rand(-0.4, 0.4);
        tilt = rand(0.5, 1.1);
        scale = rand(0.8, 1.1) * (1 - t * 0.25);
      }
      this.bases.push({ pos, tilt, yaw, scale, phase: rand(0, Math.PI * 2) });
    }

    // flowering vine tips
    this.flowers = null;
    if (plant.species === 2) {
      this.flowers = new THREE.InstancedMesh(assets.flowerGeo, assets.flowerMat, 3);
      this.flowers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.inner.add(this.flowers);
      this.flowerBases = [];
      for (let i = 0; i < 3; i++) {
        const a = rand(0, Math.PI * 2);
        this.flowerBases.push(new THREE.Vector3(Math.cos(a) * 0.12, 1.28 - i * 0.14, Math.sin(a) * 0.12));
      }
    }

    this.dieT = -1; // >= 0 while fading out
  }

  update(plant, time) {
    const g = easeOutCubic(clamp(plant.growth, 0, 1));
    let s = 0.08 + 0.92 * g;
    if (this.dieT >= 0) s *= Math.max(0, 1 - this.dieT / 1.4);
    this.inner.scale.set(0.55 + 0.45 * s, s, 0.55 + 0.45 * s);
    // gentle curl-down while dying
    if (this.dieT >= 0) this.inner.rotation.x = this.dieT * 0.35;

    const n = this.leafCount;
    for (let i = 0; i < n; i++) {
      const b = this.bases[i];
      const reveal = easeOutBack(clamp(plant.growth * (n + 1.5) - i * 0.9, 0, 1));
      const biomass = plant.leaves ? plant.leaves[i] : 1;
      const ls = Math.max(b.scale * reveal * (0.12 + 0.88 * biomass), 0.001);
      const sway = Math.sin(time * 1.1 + b.phase) * 0.05;
      _dummy.position.copy(b.pos);
      _dummy.rotation.set(0, b.yaw, 0);
      _dummy.rotateZ(-b.tilt + sway);
      _dummy.scale.setScalar(ls);
      _dummy.updateMatrix();
      this.leaves.setMatrixAt(i, _dummy.matrix);
    }
    this.leaves.instanceMatrix.needsUpdate = true;

    if (this.flowers) {
      const bloom = clamp((plant.growth - 0.88) / 0.12, 0, 1);
      for (let i = 0; i < 3; i++) {
        _dummy.position.copy(this.flowerBases[i]);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.setScalar(Math.max(bloom * (0.9 + Math.sin(time * 2 + i) * 0.12), 0.001));
        _dummy.updateMatrix();
        this.flowers.setMatrixAt(i, _dummy.matrix);
      }
      this.flowers.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.leaves.dispose();
    if (this.flowers) this.flowers.dispose();
    this.group.removeFromParent();
  }
}

// ============================================================
export class Flora {
  constructor(scene) {
    this.scene = scene;
    this.assets = buildAssets();
    this.visuals = new Map();   // plant id -> PlantVisual
    this.dying = [];            // fading-out visuals (with a frozen plant snapshot)

    // ---- mushrooms (two instancers sharing transforms) ----
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.16, 7).translate(0, 0.08, 0);
    const capGeo = new THREE.SphereGeometry(0.085, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.13, 0);
    capGeo.scale(1, 0.85, 1);
    this.mushStemMat = new THREE.MeshStandardMaterial({ color: '#ddd2ba', roughness: 0.8 });
    this.mushCapMat = new THREE.MeshStandardMaterial({
      color: '#b8907a', roughness: 0.55,
      emissive: new THREE.Color('#3fe8c0'), emissiveIntensity: 0,
    });
    this.mushStems = new THREE.InstancedMesh(stemGeo, this.mushStemMat, CFG.caps.mushrooms);
    this.mushCaps = new THREE.InstancedMesh(capGeo, this.mushCapMat, CFG.caps.mushrooms);
    for (const m of [this.mushStems, this.mushCaps]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.count = 0;
      scene.add(m);
    }

    // ---- detritus patches ----
    const detGeo = new THREE.CircleGeometry(0.16, 10).rotateX(-Math.PI / 2);
    this.detMat = new THREE.MeshStandardMaterial({
      color: '#1c1209', roughness: 1, transparent: true, opacity: 0.85,
      polygonOffset: true, polygonOffsetFactor: -1,
    });
    this.detritus = new THREE.InstancedMesh(detGeo, this.detMat, CFG.caps.detritus);
    this.detritus.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.detritus.count = 0;
    this.detritus.receiveShadow = true;
    scene.add(this.detritus);
  }

  plantDied(plant) {
    const v = this.visuals.get(plant.id);
    if (!v) return;
    this.visuals.delete(plant.id);
    v.dieT = 0;
    // freeze a snapshot so the fade keeps the last shape
    this.dying.push({ v, snap: { growth: plant.growth, leaves: plant.leaves ? [...plant.leaves] : null } });
  }

  sync(sim, time, dt, nightFactor) {
    // ---- plants ----
    for (const p of sim.plants) {
      let v = this.visuals.get(p.id);
      if (!v) {
        v = new PlantVisual(p, this.assets);
        this.visuals.set(p.id, v);
        this.scene.add(v.group);
      }
      v.update(p, time);
    }
    // sim removed a plant without an event? clean up defensively
    if (this.visuals.size > sim.plants.length) {
      const ids = new Set(sim.plants.map((p) => p.id));
      for (const [id, v] of this.visuals) {
        if (!ids.has(id)) { this.visuals.delete(id); v.dispose(); }
      }
    }
    // fading out the departed
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.v.dieT += dt;
      d.v.update(d.snap, time);
      if (d.v.dieT > 1.5) {
        d.v.dispose();
        this.dying.splice(i, 1);
      }
    }

    // ---- mushrooms ----
    const shrooms = sim.mushrooms;
    const n = Math.min(shrooms.length, CFG.caps.mushrooms);
    for (let i = 0; i < n; i++) {
      const m = shrooms[i];
      const s = easeOutBack(clamp(m.growth, 0, 1)) * (0.85 + Math.sin(m.seed * 10) * 0.25);
      _dummy.position.set(m.x, groundHeight(m.x, m.z) - 0.01, m.z);
      _dummy.rotation.set(Math.sin(m.seed) * 0.15, m.seed, Math.cos(m.seed * 2) * 0.15);
      _dummy.scale.setScalar(Math.max(s, 0.001));
      _dummy.updateMatrix();
      this.mushStems.setMatrixAt(i, _dummy.matrix);
      this.mushCaps.setMatrixAt(i, _dummy.matrix);
    }
    this.mushStems.count = n;
    this.mushCaps.count = n;
    this.mushStems.instanceMatrix.needsUpdate = true;
    this.mushCaps.instanceMatrix.needsUpdate = true;
    // bioluminescence — mushrooms breathe light at night
    this.mushCapMat.emissiveIntensity = nightFactor * (0.9 + Math.sin(time * 1.7) * 0.25);

    // ---- detritus ----
    const det = sim.detritus;
    const dn = Math.min(det.length, CFG.caps.detritus);
    for (let i = 0; i < dn; i++) {
      const d = det[i];
      const s = clamp(Math.sqrt(d.amount) * 0.55, 0.2, 1.6);
      _dummy.position.set(d.x, groundHeight(d.x, d.z) + 0.015, d.z);
      _dummy.rotation.set(0, d.id * 1.7, 0);
      _dummy.scale.set(s, 1, s * 0.8);
      _dummy.updateMatrix();
      this.detritus.setMatrixAt(i, _dummy.matrix);
    }
    this.detritus.count = dn;
    this.detritus.instanceMatrix.needsUpdate = true;
  }

  reset() {
    for (const [, v] of this.visuals) v.dispose();
    this.visuals.clear();
    for (const d of this.dying) d.v.dispose();
    this.dying = [];
    this.mushStems.count = 0;
    this.mushCaps.count = 0;
    this.detritus.count = 0;
  }
}
