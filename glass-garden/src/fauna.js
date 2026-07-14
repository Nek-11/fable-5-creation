// ============================================================
// fauna.js — instanced beetles and articulated mantises.
// Deaths are tender: creatures curl up and sink away.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from './config.js';
import { groundHeight } from './terrain.js';
import { clamp, rand } from './noise.js';

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

// ---------------- beetle geometry (one merged shell) ----------------
function makeBeetleGeometry() {
  const body = new THREE.SphereGeometry(0.075, 10, 8);
  body.scale(1, 0.68, 1.3);
  body.translate(0, 0.05, 0);
  const head = new THREE.SphereGeometry(0.042, 8, 6);
  head.translate(0, 0.04, 0.105);
  const merged = mergeGeometries([body, head]);
  body.dispose();
  head.dispose();
  return merged;
}

// ---------------- mantis parts (shared) ----------------
const mantisMat = new THREE.MeshStandardMaterial({ color: '#84b56b', roughness: 0.55 });
const mantisDarkMat = new THREE.MeshStandardMaterial({ color: '#5d8a4a', roughness: 0.6 });
const eyeMat = new THREE.MeshStandardMaterial({ color: '#2a2418', roughness: 0.3 });
const geoCache = {};
function G(key, make) { return geoCache[key] || (geoCache[key] = make()); }

class MantisVisual {
  constructor(m) {
    this.group = new THREE.Group();
    this.seed = m.seed;

    const abdomen = new THREE.Mesh(G('mAb', () => new THREE.CapsuleGeometry(0.05, 0.2, 4, 8)), mantisMat);
    abdomen.rotation.x = Math.PI / 2 - 0.5;
    abdomen.position.set(0, 0.115, -0.14);
    const thorax = new THREE.Mesh(G('mTh', () => new THREE.CapsuleGeometry(0.032, 0.13, 4, 8)), mantisMat);
    thorax.rotation.x = Math.PI / 2 + 0.5;
    thorax.position.set(0, 0.14, 0.02);
    const head = new THREE.Mesh(G('mHd', () => new THREE.ConeGeometry(0.042, 0.075, 8)), mantisDarkMat);
    head.rotation.x = -Math.PI / 2 + 0.3;
    head.position.set(0, 0.185, 0.1);
    this.head = head;

    const eyeGeo = G('mEy', () => new THREE.SphereGeometry(0.017, 6, 5));
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.032, 0.2, 0.115);
    eyeR.position.set(0.032, 0.2, 0.115);

    // raptorial forearms, folded in prayer
    const armGeo = G('mAr', () => new THREE.CapsuleGeometry(0.012, 0.09, 3, 6));
    this.arms = [];
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(armGeo, mantisDarkMat);
      upper.position.set(side * 0.035, 0.12, 0.09);
      upper.rotation.set(0.9, 0, side * 0.25);
      const fore = new THREE.Mesh(armGeo, mantisMat);
      fore.scale.set(0.8, 0.85, 0.8);
      fore.position.set(side * 0.045, 0.09, 0.135);
      fore.rotation.set(-1.15, 0, side * 0.15);
      this.group.add(upper, fore);
      this.arms.push(upper, fore);
    }

    // walking legs
    const legGeo = G('mLg', () => new THREE.CylinderGeometry(0.006, 0.005, 0.16, 4));
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const leg = new THREE.Mesh(legGeo, mantisDarkMat);
        leg.position.set(side * 0.075, 0.065, -0.03 - i * 0.09);
        leg.rotation.set(0.35 - i * 0.5, 0, side * 1.05);
        this.group.add(leg);
      }
    }

    this.group.add(abdomen, thorax, head, eyeL, eyeR);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.dieT = -1;
    this.snap = null;
  }

  update(m, time) {
    this.group.position.set(m.x, groundHeight(m.x, m.z), m.z);
    const dir = Math.atan2(Math.cos(m.heading), Math.sin(m.heading));
    this.group.rotation.y = dir;

    let s = 1, crouch = 0;
    const bobSpeed = m.state === 'feast' ? 5 : 2;
    const bob = Math.sin(time * bobSpeed + this.seed) * 0.008;
    if (m.state === 'stalk') crouch = 0.03 + Math.sin(time * 6 + this.seed) * 0.004;
    if (m.state === 'pounce') { this.group.scale.set(0.92, 0.92, 1.3); }
    else this.group.scale.set(1, 1, 1);
    if (this.dieT >= 0) {
      s = Math.max(0, 1 - this.dieT / 1.6);
      this.group.scale.setScalar(Math.max(s, 0.001));
      this.group.rotation.z = this.dieT * 0.8; // curls onto its side
    }
    this.group.position.y += bob - crouch - (this.dieT >= 0 ? this.dieT * 0.02 : 0);
    this.head.rotation.z = Math.sin(time * 1.3 + this.seed * 3) * 0.18;
  }

  dispose() {
    this.group.removeFromParent();
  }
}

// ============================================================
export class Fauna {
  constructor(scene) {
    this.scene = scene;

    const beetleGeo = makeBeetleGeometry();
    this.beetleMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.25 });
    const cap = CFG.caps.beetles + 10; // headroom for death fades
    this.beetles = new THREE.InstancedMesh(beetleGeo, this.beetleMat, cap);
    this.beetles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beetles.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.beetles.castShadow = true;
    this.beetles.count = 0;
    scene.add(this.beetles);

    this.mantisVisuals = new Map();
    this.dyingMantises = [];
    this.dyingBeetles = [];
  }

  beetleDied(b) {
    this.dyingBeetles.push({ x: b.x, z: b.z, seed: b.seed, heading: b.heading, t: 0 });
  }

  mantisDied(m) {
    const v = this.mantisVisuals.get(m.id);
    if (!v) return;
    this.mantisVisuals.delete(m.id);
    v.dieT = 0;
    v.snap = { x: m.x, z: m.z, heading: m.heading, state: 'idle' };
    this.dyingMantises.push(v);
  }

  sync(sim, time, dt) {
    // ---------- beetles (instanced) ----------
    let idx = 0;
    const capacity = this.beetles.instanceMatrix.count;
    for (const b of sim.beetles) {
      if (idx >= capacity) break;
      const moving = b.state !== 'feed';
      const bob = moving ? Math.sin(time * 9 + b.seed * 7) * 0.008 : Math.sin(time * 3 + b.seed) * 0.004;
      const hatch = clamp((sim.time - b.born) * 2.2, 0.25, 1); // pop-in on birth
      _dummy.position.set(b.x, groundHeight(b.x, b.z) + 0.012 + bob, b.z);
      _dummy.rotation.set(0, Math.atan2(Math.cos(b.heading), Math.sin(b.heading)), 0);
      if (b.state === 'feed') _dummy.rotateX(0.25 * (0.5 + 0.5 * Math.sin(time * 6 + b.seed)));
      _dummy.scale.setScalar(hatch * (0.85 + (b.seed % 1) * 0.3));
      _dummy.updateMatrix();
      this.beetles.setMatrixAt(idx, _dummy.matrix);
      // shell tint — well-fed beetles shine a little greener
      const h = 0.06 + (b.seed % 0.09);
      _col.setHSL(h, 0.5, 0.14 + (b.energy / 100) * 0.1);
      this.beetles.setColorAt(idx, _col);
      idx++;
    }
    // dying beetles curl up and fade into the soil
    for (let i = this.dyingBeetles.length - 1; i >= 0; i--) {
      const d = this.dyingBeetles[i];
      d.t += dt;
      if (d.t > 1.4) { this.dyingBeetles.splice(i, 1); continue; }
      if (idx >= capacity) continue;
      const s = Math.max(0.001, (1 - d.t / 1.4) * 0.9);
      _dummy.position.set(d.x, groundHeight(d.x, d.z) + 0.012 - d.t * 0.02, d.z);
      _dummy.rotation.set(0, Math.atan2(Math.cos(d.heading), Math.sin(d.heading)), d.t * 1.2);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.beetles.setMatrixAt(idx, _dummy.matrix);
      _col.setHSL(0.08, 0.3, 0.12);
      this.beetles.setColorAt(idx, _col);
      idx++;
    }
    this.beetles.count = idx;
    this.beetles.instanceMatrix.needsUpdate = true;
    if (this.beetles.instanceColor) this.beetles.instanceColor.needsUpdate = true;

    // ---------- mantises ----------
    for (const m of sim.mantises) {
      let v = this.mantisVisuals.get(m.id);
      if (!v) {
        v = new MantisVisual(m);
        this.mantisVisuals.set(m.id, v);
        this.scene.add(v.group);
      }
      v.update(m, time);
    }
    if (this.mantisVisuals.size > sim.mantises.length) {
      const ids = new Set(sim.mantises.map((m) => m.id));
      for (const [id, v] of this.mantisVisuals) {
        if (!ids.has(id)) { this.mantisVisuals.delete(id); v.dispose(); }
      }
    }
    for (let i = this.dyingMantises.length - 1; i >= 0; i--) {
      const v = this.dyingMantises[i];
      v.dieT += dt;
      v.update(v.snap, time);
      if (v.dieT > 1.8) {
        v.dispose();
        this.dyingMantises.splice(i, 1);
      }
    }
  }

  reset() {
    this.beetles.count = 0;
    this.dyingBeetles = [];
    for (const [, v] of this.mantisVisuals) v.dispose();
    this.mantisVisuals.clear();
    for (const v of this.dyingMantises) v.dispose();
    this.dyingMantises = [];
  }
}

export function randMantisOffset() { return rand(-0.2, 0.2); }
