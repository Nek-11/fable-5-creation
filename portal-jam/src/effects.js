import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COLORS } from './config.js';

export function makeComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.55, 0.5, 0.82
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom };
}

// ---------- confetti ----------
const CONFETTI_N = 140;

export class Confetti {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.09, 0.05),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
      CONFETTI_N
    );
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CONFETTI_N * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.parts = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3(1, 1, 1);

    const palette = [COLORS.cyan, COLORS.magenta, COLORS.gold, COLORS.ball, 0xffffff];
    this.palette = palette.map((c) => new THREE.Color(c));
  }

  burst(origin, n = CONFETTI_N) {
    this.parts.length = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 2.5 + Math.random() * 4;
      const out = 0.6 + Math.random() * 2.4;
      this.parts.push({
        pos: origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)),
        vel: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        rotVel: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
        life: 1.6 + Math.random() * 0.9,
        color: this.palette[i % this.palette.length],
      });
      this.mesh.instanceColor.setXYZ(i, 0, 0, 0);
    }
    for (let i = 0; i < n; i++) {
      const p = this.parts[i];
      this.mesh.instanceColor.setXYZ(i, p.color.r, p.color.g, p.color.b);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    if (!this.parts.length) { this.mesh.count = 0; return; }
    let anyAlive = false;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.life > 0) {
        anyAlive = true;
        p.life -= dt;
        p.vel.y -= 7.5 * dt;
        p.vel.multiplyScalar(0.995);
        p.pos.addScaledVector(p.vel, dt);
        p.rot.x += p.rotVel.x * dt;
        p.rot.y += p.rotVel.y * dt;
        p.rot.z += p.rotVel.z * dt;
      }
      const s = Math.max(0, Math.min(1, p.life));
      this._q.setFromEuler(p.rot);
      this._s.setScalar(s);
      this._m.compose(p.pos, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.count = this.parts.length;
    if (!anyAlive) this.parts.length = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- camera shake ----------
export class Shake {
  constructor() {
    this.amp = 0;
    this.offset = new THREE.Vector3();
  }
  kick(a) { this.amp = Math.max(this.amp, a); }
  update(dt) {
    this.amp = Math.max(0, this.amp - dt * 1.8);
    if (this.amp > 0.001) {
      this.offset.set(
        (Math.random() - 0.5) * this.amp,
        (Math.random() - 0.5) * this.amp,
        (Math.random() - 0.5) * this.amp * 0.4
      );
    } else {
      this.offset.set(0, 0, 0);
    }
  }
}

// ---------- ambient dust ----------
export function makeDust(scene) {
  const N = 260;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 44;
    pos[i * 3 + 1] = Math.random() * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x8ab6c9, size: 0.045, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}
