import * as THREE from 'three';
import { COLORS, PHYS } from './config.js';

function makeBallTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ff9a4d');
  grad.addColorStop(0.5, '#ff8c3b');
  grad.addColorStop(1, '#e06a20');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);

  // pebble grain
  g.globalAlpha = 0.08;
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    g.fillRect(Math.random() * 512, Math.random() * 256, 1.6, 1.6);
  }
  g.globalAlpha = 1;

  // seams
  g.strokeStyle = '#2a1508';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, 128); g.lineTo(512, 128); g.stroke();          // equator
  for (const x of [0, 256]) {                                               // meridians
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
  }
  for (const x of [128, 384]) {                                             // curved side seams
    g.beginPath();
    g.moveTo(x - 90, 0);
    g.bezierCurveTo(x, 60, x, 196, x - 90, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(x + 90, 0);
    g.bezierCurveTo(x, 60, x, 196, x + 90, 256);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TRAIL_LEN = 42;

export class Ball {
  constructor(scene) {
    this.state = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), cooldown: 0 };
    this.spawn = new THREE.Vector3();
    this.live = false;      // in flight (a shot has been taken)
    this.restTimer = 0;
    this.touchedRimOrBoard = false;
    this.spinAxis = new THREE.Vector3(1, 0, 0);
    this.spinSpeed = 0;

    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(PHYS.ballRadius, 28, 22),
      new THREE.MeshStandardMaterial({
        map: makeBallTexture(),
        roughness: 0.72,
        metalness: 0.02,
        emissive: COLORS.ball,
        emissiveIntensity: 0.06,
      })
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // glow halo so the ball reads against the dark gym
    this.glow = new THREE.PointLight(COLORS.ball, 0.7, 3.2, 2);
    scene.add(this.glow);

    // trail
    this.trailPts = [];
    const positions = new Float32Array(TRAIL_LEN * 3);
    const colors = new Float32Array(TRAIL_LEN * 3);
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.trail = new THREE.Line(
      this.trailGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.trail.frustumCulled = false;
    scene.add(this.trail);
    this.trailColor = new THREE.Color(COLORS.ball);
  }

  setSpawn(p) {
    this.spawn.fromArray(p);
    this.reset();
  }

  reset() {
    this.state.pos.copy(this.spawn);
    this.state.vel.set(0, 0, 0);
    this.state.cooldown = 0;
    this.live = false;
    this.restTimer = 0;
    this.touchedRimOrBoard = false;
    this.spinSpeed = 0;
    this.trailPts.length = 0;
    this.syncVisual();
  }

  shoot(vel) {
    this.state.vel.copy(vel);
    this.live = true;
    this.restTimer = 0;
    this.touchedRimOrBoard = false;
    // backspin, like a real shot
    this.spinAxis.set(vel.z, 0, -vel.x).normalize();
    this.spinSpeed = vel.length() * 2.2;
  }

  // returns true when the ball has settled and should respawn
  trackRest(dt) {
    if (!this.live) return false;
    const speed = this.state.vel.length();
    const nearGround = this.state.pos.y < PHYS.ballRadius + 0.25;
    if (speed < PHYS.restThreshold && nearGround) {
      this.restTimer += dt;
      if (this.restTimer > PHYS.restTime) return true;
    } else {
      this.restTimer = 0;
    }
    // fell out of the world
    if (this.state.pos.y < -6 || Math.abs(this.state.pos.x) > 40 || Math.abs(this.state.pos.z) > 50) return true;
    return false;
  }

  syncVisual(dt = 0) {
    this.mesh.position.copy(this.state.pos);
    this.glow.position.copy(this.state.pos);
    if (this.spinSpeed > 0 && dt > 0) {
      this.mesh.rotateOnWorldAxis(this.spinAxis, this.spinSpeed * dt);
      this.spinSpeed *= 0.999;
    }

    // trail
    if (this.live) {
      this.trailPts.push(this.state.pos.clone());
      if (this.trailPts.length > TRAIL_LEN) this.trailPts.shift();
    } else if (this.trailPts.length) {
      this.trailPts.shift();
    }
    const pos = this.trailGeo.attributes.position;
    const col = this.trailGeo.attributes.color;
    const n = this.trailPts.length;
    for (let i = 0; i < TRAIL_LEN; i++) {
      const p = this.trailPts[Math.min(i, n - 1)] || this.state.pos;
      pos.setXYZ(i, p.x, p.y, p.z);
      const f = n > 1 ? (i / n) * 0.6 : 0;
      col.setXYZ(i, this.trailColor.r * f, this.trailColor.g * f, this.trailColor.b * f);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.trail.visible = n > 1;
  }
}
