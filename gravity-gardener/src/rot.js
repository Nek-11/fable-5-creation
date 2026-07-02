import * as THREE from 'three';
import { CONFIG } from './config.js';

const R = CONFIG.rot;

const _q = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _axis = new THREE.Vector3();

export class RotSystem {
  constructor(scene, planet) {
    this.scene = scene;
    this.planet = planet;
    this.cores = [];
    this.purged = 0; // lifetime stat

    // shared spiky geometry — random rotations hide the repetition
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i);
      const jitter = 0.72 + Math.abs(Math.sin(_v.x * 7.7 + _v.y * 5.3 + _v.z * 9.1)) * 0.75;
      pos.setXYZ(i, _v.x * jitter, _v.y * jitter, _v.z * jitter);
    }
    geo.computeVertexNormals();
    this.coreGeo = geo;
  }

  spawn(dir) {
    if (this.cores.length >= R.maxCores) return null;
    const d = dir.clone().normalize();
    const surf = this.planet.surfaceRadius(d);

    const mat = new THREE.MeshStandardMaterial({
      color: '#12060f',
      roughness: 0.55,
      metalness: 0.25,
      emissive: '#ff2038',
      emissiveIntensity: 0.0,
    });
    const mesh = new THREE.Mesh(this.coreGeo, mat);
    mesh.position.copy(d).multiplyScalar(surf + 0.1);
    _q.setFromUnitVectors(Y, d);
    mesh.quaternion.copy(_q);
    mesh.rotateY(Math.random() * Math.PI * 2);
    mesh.scale.setScalar(0.01);
    this.scene.add(mesh);

    const core = {
      dir: d,
      mesh,
      age: 0,
      radius: R.radiusStart,
      listRadius: R.radiusStart,
      list: this.planet.vertsWithin(d, R.radiusStart),
      hp: R.hpBase,
      maxHp: R.hpBase,
      state: 'alive', // 'alive' | 'dying'
      dieT: 0,
      phase: Math.random() * Math.PI * 2,
    };
    this.cores.push(core);
    return core;
  }

  // try to grow the blight: offshoot from an existing core — or, sometimes,
  // a spore of darkness leaps to a random unlit spot anywhere on the planet
  trySpread() {
    if (this.cores.length === 0 || this.cores.length >= R.maxCores) return null;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (Math.random() < R.jumpChance) {
        _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      } else {
        const parent = this.cores[Math.floor(Math.random() * this.cores.length)];
        if (parent.state === 'dying') continue;
        _axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .cross(parent.dir).normalize();
        const arc = (4.0 + Math.random() * 6.0) / CONFIG.planet.radius;
        _v.copy(parent.dir).applyAxisAngle(_axis, arc).normalize();
      }
      if (this.planet.fieldAt(_v) > 0.2) continue; // light repels the rot
      // don't stack cores — spread the blight wide
      const cosSpace = Math.cos(R.coreSpacing / CONFIG.planet.radius);
      let crowded = false;
      for (const c of this.cores) {
        if (c.state !== 'dying' && c.dir.dot(_v) > cosSpace) { crowded = true; break; }
      }
      if (crowded) continue;
      return this.spawn(_v);
    }
    return null;
  }

  damageWithin(dir, radius, amount, ctx) {
    const cosT = Math.cos(radius / CONFIG.planet.radius);
    let hits = 0;
    for (const c of this.cores) {
      if (c.state === 'dying') continue;
      if (c.dir.dot(dir) > cosT) {
        c.hp -= amount;
        c.hitFlash = 1;
        hits++;
        if (c.hp <= 0) this.kill(c, ctx);
      }
    }
    return hits;
  }

  kill(core, ctx) {
    if (core.state === 'dying') return;
    core.state = 'dying';
    core.dieT = 0;
    this.purged++;
    ctx?.onRotPurged?.(core);
    ctx?.markSourcesDirty();
  }

  collectSources(out) {
    for (const c of this.cores) {
      if (c.state === 'dying') continue;
      const ramp = 1 + c.age * R.injectRamp;
      out.push({ list: c.list, rate: -R.injectRate * ramp });
    }
  }

  update(dt, time, ctx) {
    for (let i = this.cores.length - 1; i >= 0; i--) {
      const c = this.cores[i];

      if (c.state === 'dying') {
        c.dieT += dt / 0.7;
        const s = Math.max(0.001, (1 - c.dieT) * this.visualScale(c));
        c.mesh.scale.setScalar(s);
        c.mesh.material.emissiveIntensity = (1 - c.dieT) * 2.5;
        if (c.dieT >= 1) {
          this.scene.remove(c.mesh);
          c.mesh.material.dispose();
          this.cores.splice(i, 1);
        }
        continue;
      }

      c.age += dt;
      c.hp = Math.min(c.hp + 0, R.hpMax);
      c.maxHp = Math.min(R.hpBase + c.age * R.hpRamp, R.hpMax);

      // territory expands with age
      if (c.radius < R.radiusMax) {
        c.radius += R.radiusGrow * dt;
        if (c.radius - c.listRadius > 0.45) {
          c.listRadius = c.radius;
          c.list = this.planet.vertsWithin(c.dir, c.radius);
          ctx.markSourcesDirty();
        }
      }

      // visuals: slow menacing pulse + hit flash decay
      c.hitFlash = Math.max(0, (c.hitFlash || 0) - dt * 3);
      const pulse = 0.55 + 0.45 * Math.sin(time * 1.9 + c.phase);
      c.mesh.material.emissiveIntensity = 0.10 + pulse * 0.16 + c.hitFlash * 2.2;
      c.mesh.scale.setScalar(this.visualScale(c) * (1 + Math.sin(time * 2.6 + c.phase) * 0.06));
      c.mesh.rotation.y += dt * 0.15;

      // suffocated by surrounding light?
      if (this.planet.field[this.nearestVert(c)] > 0.55) {
        c.hp -= dt * 0.6;
        if (c.hp <= 0) this.kill(c, ctx);
      }
    }
  }

  visualScale(c) {
    // grows from pebble to boulder as it ages
    return 0.42 + Math.min(1, c.age / 60) * 0.75;
  }

  nearestVert(c) {
    if (c._nv !== undefined) return c._nv;
    const d = this.planet.dirs;
    let best = -2, bi = 0;
    for (let i = 0; i < this.planet.vertCount; i++) {
      const dot = c.dir.x * d[i * 3] + c.dir.y * d[i * 3 + 1] + c.dir.z * d[i * 3 + 2];
      if (dot > best) { best = dot; bi = i; }
    }
    return (c._nv = bi);
  }

  reset() {
    for (const c of this.cores) {
      this.scene.remove(c.mesh);
      c.mesh.material.dispose();
    }
    this.cores.length = 0;
    this.purged = 0;
  }
}
