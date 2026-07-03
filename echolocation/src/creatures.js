// The demons of the deep. They cannot be killed — only heard, fled, stunned.
// Lurkers are bulk and jaws behind a dangling red lure; they hunt by ear.
// Wraiths are ribbon-bodied horrors that hunt with their own red sonar.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { getGlowTexture } from './glow.js';

export const TYPES = {
  lurker: {
    speed: { wander: 1.6, investigate: 3.0, hunt: 4.4 },
    hearMult: 1.0,
    killDist: 1.5,
    senseR: 4.2,
    sightR: 9,
    albedo: [0.66, 0.58, 0.46], // pale corpse-flesh under your light
    spikeAlbedo: [0.42, 0.38, 0.42],
    eyeColor: 0xc9ffd4,
    lureColor: 0xff3a22,
    deathText: 'the lurker’s jaws closed around your echo.',
  },
  wraith: {
    speed: { wander: 2.1, investigate: 3.4, hunt: 5.2 },
    hearMult: 1.6,
    killDist: 1.5,
    senseR: 4.6,
    sightR: 12,
    albedo: [0.5, 0.36, 0.62], // bruised violet ribbon
    spikeAlbedo: [0.6, 0.45, 0.65],
    eyeColor: 0xff2b33,
    pingInterval: [5, 8],
    deathText: 'the wraith sang your own echo back at you.',
  },
};

function displace(geo, amt, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const d =
      1 +
      ((Math.sin(x * 3.1 + seed) + Math.sin(y * 3.7 + seed * 2.0) + Math.sin(z * 4.1 + seed * 0.7)) / 3) * amt;
    p.setXYZ(i, x * d, y * d, z * d);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Creature {
  constructor(type, world, pings, pos, id) {
    this.type = type;
    this.T = TYPES[type];
    this.id = id;
    this.world = world;
    this.state = 'wander';
    this.target = pos.clone();
    this.vel = new THREE.Vector3();
    this.stunT = 0;
    this.huntT = 0;
    this.wanderT = 0;
    this.growlT = 1 + Math.random() * 3;
    this.snapT = 0;
    this.pingT = this.T.pingInterval ? 2 + Math.random() * 4 : Infinity;
    this.animPhase = Math.random() * 10;

    this.bodyMat = pings.material({ albedo: this.T.albedo });
    this.spikeMat = pings.material({ albedo: this.T.spikeAlbedo });
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.trail = []; // for the wraith's ribbon body
    if (type === 'lurker') this.buildLurker();
    else this.buildWraith();
  }

  buildLurker() {
    const g = this.group;
    // bulk: a lumpy hunger, wider than it is tall, gaping forward (+z)
    const body = displace(new THREE.IcosahedronGeometry(0.9, 2), 0.3, this.id * 3);
    body.scale(1.0, 0.85, 1.5);
    this.body = new THREE.Mesh(body, this.bodyMat);
    g.add(this.body);

    // underslung jaw and needle teeth
    const jaw = new THREE.Mesh(
      displace(new THREE.IcosahedronGeometry(0.45, 1), 0.2, this.id * 5),
      this.bodyMat,
    );
    jaw.scale.set(1.1, 0.5, 1.1);
    jaw.position.set(0, -0.5, 0.85);
    g.add(jaw);
    const toothGeo = new THREE.ConeGeometry(0.035, 0.28, 4);
    for (let i = 0; i < 9; i++) {
      const tooth = new THREE.Mesh(toothGeo, this.spikeMat);
      const a = (i / 8 - 0.5) * 1.9;
      tooth.position.set(Math.sin(a) * 0.55, -0.28, 0.85 + Math.cos(a) * 0.5);
      tooth.rotation.x = Math.PI * (i % 2 ? 0.92 : 0.08);
      g.add(tooth);
    }

    // jagged dorsal spikes
    for (let i = 0; i < 6; i++) {
      const h = 0.35 + Math.random() * 0.5;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, h, 5), this.spikeMat);
      spike.position.set((Math.random() - 0.5) * 0.5, 0.65 + Math.random() * 0.15, 0.7 - i * 0.3);
      spike.rotation.x = -0.4 + Math.random() * 0.3;
      g.add(spike);
    }

    // tail fin
    this.tail = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.15), this.bodyMat);
    this.tail.material = this.bodyMat;
    this.tail.position.set(0, 0, -1.45);
    this.tail.rotation.x = 0.2;
    g.add(this.tail);

    // the lure: a red light on a stalk, always faintly burning in the dark
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.0, 5), this.spikeMat);
    stalk.position.set(0, 0.85, 0.9);
    stalk.rotation.x = 0.8;
    g.add(stalk);
    this.lureMat = new THREE.MeshBasicMaterial({
      color: this.T.lureColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lure = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), this.lureMat);
    this.lure.position.set(0, 1.15, 1.35);
    g.add(this.lure);
    this.lureHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color: this.T.lureColor,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.lureHalo.scale.setScalar(0.9);
    this.lureHalo.position.copy(this.lure.position);
    g.add(this.lureHalo);

    this.addEyes(0.32, 0.25, 1.05, 0.09);
  }

  buildWraith() {
    const g = this.group;
    // head: horned, eyeless-pale until it looks at you
    const head = displace(new THREE.IcosahedronGeometry(0.5, 2), 0.25, this.id * 7);
    head.scale(0.85, 0.9, 1.25);
    this.body = new THREE.Mesh(head, this.bodyMat);
    g.add(this.body);
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.55, 5), this.spikeMat);
      horn.position.set(side * 0.28, 0.42, 0.1);
      horn.rotation.z = -side * 0.55;
      horn.rotation.x = -0.3;
      g.add(horn);
    }
    this.addEyes(0.2, 0.08, 0.5, 0.08);

    // ribbon body: segments that follow the head's wake
    this.segments = [];
    this.segMats = [];
    for (let i = 0; i < 9; i++) {
      const s = 0.42 * (1 - i / 10);
      const segGeo = new THREE.SphereGeometry(s, 8, 6);
      segGeo.scale(0.7, 1.25, 1);
      const seg = new THREE.Mesh(segGeo, this.bodyMat);
      seg.position.copy(this.group.position);
      this.segments.push(seg);
    }
    // a translucent fin ridge down the spine would be nice; the spikes serve
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), this.spikeMat);
      spike.position.set(0, 0.4, -0.1 - i * 0.12);
      spike.rotation.x = -0.5;
      g.add(spike);
    }
  }

  addEyes(spread, y, z, size) {
    this.eyeMat = new THREE.MeshBasicMaterial({
      color: this.T.eyeColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const geo = new THREE.SphereGeometry(size, 8, 8);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(geo, this.eyeMat);
      eye.position.set(side * spread, y, z);
      this.group.add(eye);
    }
  }

  addTo(scene) {
    scene.add(this.group);
    if (this.segments) for (const s of this.segments) scene.add(s);
  }

  removeFrom(scene) {
    scene.remove(this.group);
    if (this.segments) for (const s of this.segments) scene.remove(s);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    if (this.segments) for (const s of this.segments) s.geometry.dispose();
    this.bodyMat.dispose();
    this.spikeMat.dispose();
    this.eyeMat.dispose();
    if (this.lureMat) this.lureMat.dispose();
  }

  distTo(v) {
    return this.group.position.distanceTo(v);
  }

  startHunt(g) {
    if (this.state === 'stunned') return;
    if (this.state !== 'hunt') g.onHuntStart(this);
    this.state = 'hunt';
    this.huntT = 8;
  }

  hear(pos, radius, isPlayer, g) {
    if (this.state === 'stunned') return;
    const d = this.distTo(pos);
    if (d > radius * this.T.hearMult) return;
    if (isPlayer && d < radius * this.T.hearMult * 0.65) {
      this.startHunt(g);
    } else if (this.state !== 'hunt') {
      this.state = 'investigate';
      this.target.copy(pos);
    }
  }

  stun(away) {
    this.state = 'stunned';
    this.stunT = C.SHRIEK_STUN;
    this.vel.copy(away).multiplyScalar(5); // knocked back, reeling
  }

  steer(dt, speed) {
    const pos = this.group.position;
    const desired = this.target.clone().sub(pos);
    const d = desired.length();
    if (d > 0.1) desired.normalize().multiplyScalar(speed);

    // obstacle avoidance: spires, rim, floor, ceiling
    for (const o of this.world.obstacles) {
      if (pos.y > o.h) continue;
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const od = Math.hypot(dx, dz);
      if (od < o.r + 2.5 && od > 1e-5) {
        const push = (o.r + 2.5 - od) * 2.2;
        desired.x += (dx / od) * push;
        desired.z += (dz / od) * push;
      }
    }
    const rr = Math.hypot(pos.x, pos.z);
    if (rr > this.world.R - 5) {
      desired.x -= (pos.x / rr) * 3;
      desired.z -= (pos.z / rr) * 3;
    }
    const fh = this.world.floorHeight(pos.x, pos.z);
    if (pos.y < fh + 2.2) desired.y += 3;
    if (pos.y > C.MAXY - 3) desired.y -= 3;

    this.vel.lerp(desired, 1 - Math.exp(-dt * 2.2));
    pos.addScaledVector(this.vel, dt);
    this.world.collide(pos, 0.7);
    return d;
  }

  update(dt, g) {
    const t = g.time;
    const pos = this.group.position;
    const playerPos = g.player.pos;
    const pd = this.distTo(playerPos);

    const hunting = this.state === 'hunt';
    const pulse = 1 + Math.sin(t * (hunting ? 9 : 2.2) + this.animPhase) * (hunting ? 0.06 : 0.03);
    this.body.scale.setScalar(pulse);
    this.bodyMat.uniforms.uAmbient.value = hunting ? 0.03 : 0;

    if (this.state === 'stunned') {
      this.stunT -= dt;
      this.vel.multiplyScalar(1 - dt * 2);
      pos.addScaledVector(this.vel, dt);
      this.world.collide(pos, 0.7);
      this.group.rotation.z = Math.sin(t * 22) * 0.25;
      this.eyeMat.opacity *= 0.9;
      if (this.lureMat) this.lureMat.opacity = 0.15;
      this.updateTailAndTrail(dt, t);
      if (this.stunT <= 0) {
        this.state = 'investigate';
        this.target.copy(playerPos);
      }
      return;
    }
    this.group.rotation.z = 0;
    if (this.lureMat)
      this.lureMat.opacity = 0.65 + Math.sin(t * (hunting ? 11 : 2.6) + this.animPhase) * 0.3;

    // direct senses: pressure-sense up close, sight of movement in the open
    if (
      pd < this.T.senseR ||
      (pd < this.T.sightR &&
        (g.player.moving || g.presence > 0.5) &&
        !this.world.losBlocked(pos, playerPos))
    ) {
      this.startHunt(g);
    }

    let speed = this.T.speed.wander;
    if (this.state === 'hunt') {
      speed = this.T.speed.hunt;
      this.huntT -= dt;
      this.target.copy(playerPos);
      if (this.huntT <= 0) this.state = 'investigate';
      if (pd < this.T.killDist) {
        g.caught(this);
        return;
      }
    } else if (this.state === 'investigate') {
      speed = this.T.speed.investigate;
    }

    // wraith sonar: it hunts the way you see
    if ((this.pingT -= dt) <= 0) {
      const [a, b] = this.T.pingInterval;
      this.pingT = (a + Math.random() * (b - a)) * (hunting ? 0.55 : 1);
      g.pings.emit(pos, 'demon');
      g.audio.demonPing(pd);
    }

    // proximity dread
    if (pd < 18 && (this.growlT -= dt) <= 0) {
      this.growlT = 2 + Math.random() * 3;
      g.audio.growl(pd);
    }
    if (hunting && this.type === 'lurker' && (this.snapT -= dt) <= 0) {
      this.snapT = 0.7;
      g.audio.jawSnap(pd);
    }

    const remaining = this.steer(dt, speed);
    if (this.state !== 'hunt' && (remaining < 1.2 || (this.wanderT -= dt) <= 0)) {
      if (this.state === 'investigate' && remaining < 1.5) this.state = 'wander';
      this.wanderT = 4 + Math.random() * 4;
      this.target.copy(this.world.randomPoint());
    }

    // face the way we swim (the wraith faces you when it hunts)
    const face = hunting
      ? playerPos.clone()
      : pos.clone().add(this.vel.lengthSq() > 0.01 ? this.vel : new THREE.Vector3(0, 0, 1));
    this.group.lookAt(face);

    this.updateTailAndTrail(dt, t);

    // eyes: pinpoints in the dark, only when it can see you back
    const see = pd < 28 && !this.world.losBlocked(pos, playerPos);
    const flicker = 0.6 + 0.4 * Math.sin(t * 13 + this.animPhase * 5);
    this.eyeMat.opacity = see ? Math.max(0, 1 - pd / 28) * flicker : 0;
  }

  updateTailAndTrail(dt, t) {
    if (this.tail) this.tail.rotation.y = Math.sin(t * 6 + this.animPhase) * 0.6;
    if (this.segments) {
      // the ribbon body follows the head's wake
      const head = this.group.position;
      const last = this.trail[this.trail.length - 1];
      if (!last || last.distanceTo(head) > 0.22) this.trail.push(head.clone());
      if (this.trail.length > 40) this.trail.shift();
      for (let i = 0; i < this.segments.length; i++) {
        const idx = this.trail.length - 2 - i * 2;
        if (idx >= 0) {
          this.segments[i].position.lerp(this.trail[idx], 1 - Math.exp(-dt * 10));
          this.segments[i].position.y += Math.sin(t * 5 + i * 0.9 + this.animPhase) * 0.04;
        }
      }
    }
  }
}
