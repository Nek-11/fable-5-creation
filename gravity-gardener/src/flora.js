import * as THREE from 'three';
import { CONFIG } from './config.js';

const FL = CONFIG.flora;
const SP = CONFIG.spore;

export const PALETTE = [
  new THREE.Color('#7dffd0'), // mint
  new THREE.Color('#6ad6ff'), // aqua
  new THREE.Color('#b8ff7a'), // chartreuse
  new THREE.Color('#ff9be0'), // spore pink
];
const GREY = new THREE.Color('#3a4444');

const _q = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _qSway = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _axis = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function easeOutBack(t) {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

export class FloraSystem {
  constructor(scene, planet) {
    this.planet = planet;
    this.plants = [];
    this.bloomCount = 0; // lifetime stat

    // --- instanced plant parts ---
    const stemGeo = new THREE.CylinderGeometry(0.045, 0.16, 1.5, 6);
    stemGeo.translate(0, 0.75, 0);
    const stemMat = new THREE.MeshStandardMaterial({
      color: '#12463c', roughness: 0.7, metalness: 0,
      emissive: '#0d3a2e', emissiveIntensity: 0.55,
    });
    this.stems = new THREE.InstancedMesh(stemGeo, stemMat, FL.max);

    const bulbGeo = new THREE.IcosahedronGeometry(0.30, 1);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, FL.max);

    const discGeo = new THREE.CircleGeometry(1.35, 26);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.discs = new THREE.InstancedMesh(discGeo, discMat, FL.max);

    for (const im of [this.stems, this.bulbs, this.discs]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      im.frustumCulled = false;
      scene.add(im);
    }
    // allocate instanceColor buffers up-front
    this.bulbs.setColorAt(0, PALETTE[0]);
    this.discs.setColorAt(0, PALETTE[0]);

    // --- spores ---
    const sporeGeo = new THREE.IcosahedronGeometry(0.14, 1);
    const sporeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.sporeMesh = new THREE.InstancedMesh(sporeGeo, sporeMat, SP.poolSize);
    this.sporeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sporeMesh.count = 0;
    this.sporeMesh.frustumCulled = false;
    this.sporeMesh.setColorAt(0, PALETTE[0]);
    scene.add(this.sporeMesh);
    this.spores = [];
  }

  get aliveCount() {
    return this.plants.filter((p) => p.state !== 'dying').length;
  }

  countNear(dir, radius) {
    const cosT = Math.cos(radius / CONFIG.planet.radius);
    let n = 0;
    for (const p of this.plants) {
      if (p.state === 'dying') continue;
      if (p.dir.dot(dir) > cosT) n++;
    }
    return n;
  }

  canPlantAt(dir) {
    if (this.plants.length >= FL.max) return false;
    return this.countNear(dir, FL.crowdRadius) === 0;
  }

  plant(dir, colorIdx = -1) {
    if (this.plants.length >= FL.max) return null;
    const d = dir.clone().normalize();
    const r = this.planet.surfaceRadius(d);
    const p = {
      dir: d,
      pos: d.clone().multiplyScalar(r),
      age: 0,
      state: 'growing',
      dieT: 0,
      exposure: 0,
      phase: Math.random() * Math.PI * 2,
      yaw: Math.random() * Math.PI * 2,
      colorIdx: colorIdx >= 0 ? colorIdx : Math.floor(Math.random() * PALETTE.length),
      sporeTimer: FL.sporeIntervalMin + Math.random() * (FL.sporeIntervalMax - FL.sporeIntervalMin),
      list: this.planet.vertsWithin(d, FL.radius),
      heightScale: 0.85 + Math.random() * 0.45,
    };
    this.plants.push(p);
    this.bloomCount++;
    return p;
  }

  // gathers reaction-diffusion sources for the planet
  collectSources(out) {
    for (const p of this.plants) {
      if (p.state === 'dying') continue;
      const maturity = Math.min(1, p.age / FL.growTime);
      if (maturity < 0.35) continue;
      out.push({ list: p.list, rate: FL.injectRate * maturity });
    }
  }

  launchSpore(from, colorIdx) {
    if (this.spores.length >= SP.poolSize) return;
    const up = from.dir;
    // random tangent direction
    _axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .cross(up).normalize();
    const long = Math.random() < SP.longThrowChance;
    const [tMin, tMax] = long ? SP.longVTan : SP.vTan;
    const vT = tMin + Math.random() * (tMax - tMin);
    const vU = SP.vUp[0] + Math.random() * (SP.vUp[1] - SP.vUp[0]);
    const vel = _axis.clone().multiplyScalar(vT).addScaledVector(up, vU);
    this.spores.push({
      pos: from.pos.clone().addScaledVector(up, 1.6),
      vel,
      age: 0,
      trail: 0,
      colorIdx: colorIdx ?? from.colorIdx,
    });
  }

  update(dt, time, ctx) {
    const planet = this.planet;

    // --- plants ---
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i];
      p.age += dt;

      if (p.state === 'growing' && p.age >= FL.growTime) {
        p.state = 'alive';
        ctx.onBloomMature?.(p);
      }

      if (p.state === 'dying') {
        p.dieT += dt / 0.8;
        if (p.dieT >= 1) {
          this.plants.splice(i, 1);
          ctx.markSourcesDirty();
        }
        continue;
      }

      // rot exposure → death
      const f = planet.field[p.nearestVert ?? (p.nearestVert = this.nearestVert(p.dir))];
      if (f < FL.dieBelow) {
        p.exposure += dt;
        if (p.exposure > FL.dieGrace) {
          p.state = 'dying';
          p.dieT = 0;
          ctx.onFloraDeath?.(p);
          ctx.markSourcesDirty();
        }
      } else {
        p.exposure = Math.max(0, p.exposure - dt * 2);
      }

      // spore launching
      if (p.state === 'alive') {
        p.sporeTimer -= dt;
        if (p.sporeTimer <= 0) {
          const crowded = this.countNear(p.dir, 3.2) > FL.crowdMax;
          if (!crowded && this.plants.length < FL.max) {
            this.launchSpore(p);
            ctx.onSporeLaunch?.(p);
          }
          p.sporeTimer = FL.sporeIntervalMin + Math.random() * (FL.sporeIntervalMax - FL.sporeIntervalMin);
        }
      }
    }

    // --- spores ---
    for (let i = this.spores.length - 1; i >= 0; i--) {
      const s = this.spores[i];
      s.age += dt;
      // central gravity
      _v.copy(s.pos).normalize();
      s.vel.addScaledVector(_v, -SP.gravity * dt);
      s.pos.addScaledVector(s.vel, dt);

      // sparkle trail
      s.trail -= dt;
      if (s.trail <= 0) {
        s.trail = 0.045;
        ctx.effects?.sparkle(s.pos, PALETTE[s.colorIdx], 0.35, 0.06);
      }

      const rSurf = planet.surfaceRadius(_v);
      const r = s.pos.length();
      if (r <= rSurf + 0.1 && s.vel.dot(_v) < 0) {
        this.spores.splice(i, 1);
        ctx.onSporeLand?.(s.pos.clone().normalize(), s.colorIdx);
        continue;
      }
      if (s.age > SP.maxAge || r > CONFIG.planet.radius * 3) {
        this.spores.splice(i, 1);
      }
    }

    this.writeInstances(time);
  }

  nearestVert(dir) {
    const d = this.planet.dirs;
    let best = -2, bi = 0;
    for (let i = 0; i < this.planet.vertCount; i++) {
      const dot = dir.x * d[i * 3] + dir.y * d[i * 3 + 1] + dir.z * d[i * 3 + 2];
      if (dot > best) { best = dot; bi = i; }
    }
    return bi;
  }

  writeInstances(time) {
    const n = this.plants.length;
    for (let i = 0; i < n; i++) {
      const p = this.plants[i];
      let grow = p.state === 'growing' ? easeOutBack(Math.min(1, p.age / FL.growTime)) : 1;
      if (p.state === 'dying') grow = Math.max(0, 1 - p.dieT);
      const scale = Math.max(0.001, grow) * p.heightScale;

      _q.setFromUnitVectors(Y, p.dir);
      _qYaw.setFromAxisAngle(Y, p.yaw);
      _q.multiply(_qYaw);
      // gentle sway around a tangent axis
      const sway = Math.sin(time * 1.4 + p.phase) * 0.07;
      _axis.set(1, 0, 0).cross(p.dir);
      if (_axis.lengthSq() < 0.001) _axis.set(0, 0, 1);
      else _axis.normalize();
      _qSway.setFromAxisAngle(_axis, sway);
      _q.premultiply(_qSway);

      // stem
      _s.set(scale * 0.9, scale, scale * 0.9);
      _m.compose(p.pos, _q, _s);
      this.stems.setMatrixAt(i, _m);

      // bulb, pulsing at the stem tip
      const pulse = 1 + Math.sin(time * 2.2 + p.phase) * 0.13;
      _v.copy(p.pos).addScaledVector(p.dir, 1.5 * scale);
      _s.setScalar(Math.max(0.001, scale * pulse));
      _m.compose(_v, _q, _s);
      this.bulbs.setMatrixAt(i, _m);

      // light pool on the ground
      _v.copy(p.pos).addScaledVector(p.dir, 0.07);
      const dp = scale * (1.05 + 0.14 * Math.sin(time * 1.1 + p.phase));
      _s.set(dp, dp, dp);
      _m.compose(_v, _q, _s);
      this.discs.setMatrixAt(i, _m);

      const col = p.state === 'dying'
        ? _color.copy(PALETTE[p.colorIdx]).lerp(GREY, p.dieT)
        : PALETTE[p.colorIdx];
      this.bulbs.setColorAt(i, col);
      this.discs.setColorAt(i, col);
    }
    this.stems.count = n;
    this.bulbs.count = n;
    this.discs.count = n;
    this.stems.instanceMatrix.needsUpdate = true;
    this.bulbs.instanceMatrix.needsUpdate = true;
    this.discs.instanceMatrix.needsUpdate = true;
    if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
    if (this.discs.instanceColor) this.discs.instanceColor.needsUpdate = true;

    // spores
    const m = this.spores.length;
    for (let i = 0; i < m; i++) {
      const s = this.spores[i];
      const wob = 1 + Math.sin(time * 9 + i) * 0.2;
      _s.setScalar(wob);
      _m.compose(s.pos, _q.identity(), _s);
      this.sporeMesh.setMatrixAt(i, _m);
      this.sporeMesh.setColorAt(i, PALETTE[s.colorIdx]);
    }
    this.sporeMesh.count = m;
    this.sporeMesh.instanceMatrix.needsUpdate = true;
    if (this.sporeMesh.instanceColor) this.sporeMesh.instanceColor.needsUpdate = true;
  }

  reset() {
    this.plants.length = 0;
    this.spores.length = 0;
    this.bloomCount = 0;
    this.stems.count = 0;
    this.bulbs.count = 0;
    this.discs.count = 0;
    this.sporeMesh.count = 0;
  }
}

const _color = new THREE.Color();
