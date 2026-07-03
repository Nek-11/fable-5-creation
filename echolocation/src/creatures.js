// The things in the dark. They cannot be killed — only heard, fled, stunned.
// Crawlers hunt by ear. Stalkers hunt with their own red sonar.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';

export const TYPES = {
  crawler: {
    speed: { wander: 1.5, investigate: 2.7, hunt: 3.9 },
    hearMult: 1.0,
    killDist: 1.1,
    senseR: 3.2,
    sightR: 7,
    eyeColor: 0xffb35c,
    tint: [1.55, 0.5, 0.42],
    scale: [1.25, 0.62, 1.35],
    bodyR: 0.72,
    baseY: 0.55,
    eyeY: 0.62,
    deathText: 'a crawler dragged you into the silence.',
  },
  stalker: {
    speed: { wander: 1.9, investigate: 3.1, hunt: 4.8 },
    hearMult: 1.6,
    killDist: 1.15,
    senseR: 3.6,
    sightR: 10,
    eyeColor: 0xff2b33,
    tint: [1.35, 0.38, 0.52],
    scale: [0.52, 2.1, 0.52],
    bodyR: 0.8,
    baseY: 1.45,
    eyeY: 2.05,
    pingInterval: [5, 8],
    deathText: "the stalker's echo found you first.",
  },
};

function vnBody(x, y, z) {
  return (
    (Math.sin(x * 3.1 + Math.sin(y * 4.3)) +
      Math.sin(y * 3.7 + Math.sin(z * 3.1)) +
      Math.sin(z * 4.1 + Math.sin(x * 2.7))) /
    3
  );
}

export class Creature {
  constructor(type, level, pings, cell, id) {
    this.type = type;
    this.T = TYPES[type];
    this.id = id;
    this.level = level;
    this.state = 'wander';
    this.path = null;
    this.stunT = 0;
    this.huntT = 0;
    this.repathT = 0;
    this.growlT = 1 + Math.random() * 3;
    this.skitterT = 0;
    this.pingT = this.T.pingInterval ? 2 + Math.random() * 4 : Infinity;
    this.animPhase = Math.random() * 10;

    const g = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(this.T.bodyR, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const d = 1 + vnBody(x + id * 7, y, z) * 0.3;
      p.setXYZ(i, x * d, y * d, z * d);
    }
    geo.scale(...this.T.scale);
    geo.computeVertexNormals();
    this.bodyMat = pings.material({ tint: this.T.tint });
    this.body = new THREE.Mesh(geo, this.bodyMat);
    g.add(this.body);

    this.eyeMat = new THREE.MeshBasicMaterial({
      color: this.T.eyeColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, this.eyeMat);
      eye.position.set(side * 0.15, this.T.eyeY - this.T.baseY, this.T.scale[2] * this.T.bodyR * 0.7);
      g.add(eye);
    }

    const w = level.worldFromCell(...cell);
    g.position.set(w.x, this.T.baseY, w.z);
    this.group = g;
  }

  addTo(scene) {
    scene.add(this.group);
  }

  removeFrom(scene) {
    scene.remove(this.group);
    this.body.geometry.dispose();
    this.bodyMat.dispose();
    this.eyeMat.dispose();
  }

  xzDistTo(v) {
    return Math.hypot(this.group.position.x - v.x, this.group.position.z - v.z);
  }

  startHunt(g) {
    if (this.state === 'stunned') return;
    if (this.state !== 'hunt') g.onHuntStart(this);
    this.state = 'hunt';
    this.huntT = 7;
    this.repathT = 0;
  }

  hear(pos, radius, isPlayer, g) {
    if (this.state === 'stunned') return;
    const d = this.xzDistTo(pos);
    if (d > radius * this.T.hearMult) return;
    if (isPlayer && d < radius * this.T.hearMult * 0.65) {
      this.startHunt(g);
    } else if (this.state !== 'hunt') {
      this.state = 'investigate';
      const from = this.level.cellFromWorld(this.group.position.x, this.group.position.z);
      this.path = this.level.path(from, this.level.cellFromWorld(pos.x, pos.z));
    }
  }

  stun() {
    this.state = 'stunned';
    this.stunT = C.SHRIEK_STUN;
    this.path = null;
  }

  update(dt, g) {
    const t = g.time;
    const pos = this.group.position;
    const playerPos = g.player.pos;
    const pd = this.xzDistTo(playerPos);

    // idle breathing / hunting throb
    const pulse =
      1 + Math.sin(t * (this.state === 'hunt' ? 9 : 2.2) + this.animPhase) * (this.state === 'hunt' ? 0.07 : 0.035);
    this.body.scale.setScalar(pulse);
    this.bodyMat.uniforms.uAmbient.value = this.state === 'hunt' ? 0.02 : 0;

    if (this.state === 'stunned') {
      this.stunT -= dt;
      this.body.rotation.z = Math.sin(t * 24) * 0.08;
      this.body.scale.y = pulse * 0.8;
      this.eyeMat.opacity *= 0.9;
      if (this.stunT <= 0) {
        this.state = 'investigate';
        const from = this.level.cellFromWorld(pos.x, pos.z);
        this.path = this.level.path(from, this.level.cellFromWorld(playerPos.x, playerPos.z));
      }
      return;
    }
    this.body.rotation.z = 0;

    // direct senses: smell up close, sight of a moving/loud player in the open
    if (
      pd < this.T.senseR ||
      (pd < this.T.sightR && (g.player.moving || g.presence > 0.5) && this.level.hasLOS(pos, playerPos))
    ) {
      this.startHunt(g);
    }

    if (this.state === 'hunt') {
      this.huntT -= dt;
      this.repathT -= dt;
      if (this.repathT <= 0) {
        this.repathT = 0.7;
        const from = this.level.cellFromWorld(pos.x, pos.z);
        this.path = this.level.path(from, this.level.cellFromWorld(playerPos.x, playerPos.z));
      }
      if (this.huntT <= 0) this.state = 'investigate';
      if (pd < this.T.killDist) {
        g.caught(this);
        return;
      }
    }

    // stalker sonar: it hunts the way you see
    if ((this.pingT -= dt) <= 0) {
      const [a, b] = this.T.pingInterval;
      this.pingT = (a + Math.random() * (b - a)) * (this.state === 'hunt' ? 0.55 : 1);
      g.pings.emit(new THREE.Vector3(pos.x, 1.6, pos.z), 'stalker');
      g.audio.stalkerPing(pd);
    }

    // proximity dread
    if (pd < 16 && (this.growlT -= dt) <= 0) {
      this.growlT = 2 + Math.random() * 3;
      g.audio.growl(pd);
    }
    if (this.state === 'hunt' && this.type === 'crawler' && (this.skitterT -= dt) <= 0) {
      this.skitterT = 0.55;
      g.audio.skitter(pd);
    }

    // movement along path
    if (!this.path || this.path.length === 0) {
      if (this.state === 'investigate') this.state = 'wander';
      const from = this.level.cellFromWorld(pos.x, pos.z);
      this.path = this.level.path(from, this.level.randomOpenCellNear(from, 8));
    }
    if (this.path && this.path.length) {
      const wp = this.level.worldFromCell(...this.path[0]);
      const dx = wp.x - pos.x;
      const dz = wp.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) {
        this.path.shift();
      } else {
        const speed =
          this.T.speed[this.state === 'hunt' ? 'hunt' : this.state === 'investigate' ? 'investigate' : 'wander'];
        pos.x += (dx / d) * speed * dt;
        pos.z += (dz / d) * speed * dt;
        this.level.collideCircle(pos, 0.5);
        const face =
          this.state === 'hunt'
            ? new THREE.Vector3(playerPos.x, pos.y, playerPos.z)
            : new THREE.Vector3(wp.x, pos.y, wp.z);
        this.group.lookAt(face);
      }
    }
    pos.y = this.T.baseY + Math.sin(t * 3.4 + this.animPhase) * 0.06;

    // eyes: pinpoints in the dark, only when it can see you back
    const see = pd < 26 && this.level.hasLOS(pos, playerPos);
    const flicker = 0.6 + 0.4 * Math.sin(t * 13 + this.animPhase * 5);
    this.eyeMat.opacity = see ? Math.max(0, 1 - pd / 26) * flicker : 0;
  }
}
