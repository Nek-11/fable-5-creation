// Ambient snowfall around the camera + spray kicked up by the board.
import * as THREE from "three";

const FALL_COUNT = 500;
const SPRAY_COUNT = 350;

// Soft round sprite so points don't render as hard squares.
export function makePuffTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export class SnowFX {
  constructor(scene) {
    // --- falling snow, wrapped in a box around the camera ---
    const fallGeo = new THREE.BufferGeometry();
    const fallPos = new Float32Array(FALL_COUNT * 3);
    this.fallSeeds = [];
    for (let i = 0; i < FALL_COUNT; i++) {
      this.fallSeeds.push({
        x: Math.random() * 120 - 60,
        y: Math.random() * 60,
        z: Math.random() * 120 - 60,
        vy: 2.5 + Math.random() * 3,
        sway: Math.random() * 10,
      });
    }
    fallGeo.setAttribute("position", new THREE.BufferAttribute(fallPos, 3));
    this.fall = new THREE.Points(
      fallGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.4,
        map: makePuffTexture(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.fall.frustumCulled = false;
    scene.add(this.fall);

    // --- board spray pool ---
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(SPRAY_COUNT * 3), 3),
    );
    sprayGeo.setAttribute(
      "aLife",
      new THREE.BufferAttribute(new Float32Array(SPRAY_COUNT), 1),
    );
    this.sprayVel = new Float32Array(SPRAY_COUNT * 3);
    this.sprayLife = new Float32Array(SPRAY_COUNT); // seconds remaining
    this.sprayNext = 0;

    this.spray = new THREE.Points(
      sprayGeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: `
          attribute float aLife;
          varying float vLife;
          void main() {
            vLife = aLife;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (14.0 + (1.0 - aLife) * 10.0) / max(-mv.z, 1.0) * 10.0;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying float vLife;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            gl_FragColor = vec4(1.0, 1.0, 1.0, vLife * 0.85 * (1.0 - d * 1.4));
          }
        `,
      }),
    );
    this.spray.frustumCulled = false;
    scene.add(this.spray);
  }

  emitSpray(origin, dir, count, power) {
    const pos = this.spray.geometry.attributes.position;
    for (let n = 0; n < count; n++) {
      const i = this.sprayNext;
      this.sprayNext = (this.sprayNext + 1) % SPRAY_COUNT;
      pos.setXYZ(
        i,
        origin.x + (Math.random() - 0.5) * 0.5,
        origin.y + 0.1,
        origin.z + (Math.random() - 0.5) * 0.5,
      );
      this.sprayVel[i * 3] = dir.x * power + (Math.random() - 0.5) * 4;
      this.sprayVel[i * 3 + 1] = 2 + Math.random() * power * 0.6;
      this.sprayVel[i * 3 + 2] = dir.z * power + (Math.random() - 0.5) * 4;
      this.sprayLife[i] = 0.5 + Math.random() * 0.4;
    }
  }

  update(dt, camPos) {
    // snowfall: world-anchored flakes wrapped into a 120m box around the camera
    const wrap = (v) => ((((v + 60) % 120) + 120) % 120) - 60;
    const pos = this.fall.geometry.attributes.position;
    for (let i = 0; i < FALL_COUNT; i++) {
      const s = this.fallSeeds[i];
      s.y -= s.vy * dt;
      if (s.y < 0) s.y += 60;
      pos.setXYZ(
        i,
        camPos.x + wrap(s.x - camPos.x) + Math.sin(s.y * 0.3 + s.sway) * 1.5,
        camPos.y + s.y - 30,
        camPos.z + wrap(s.z - camPos.z),
      );
    }
    pos.needsUpdate = true;

    // spray physics
    const sPos = this.spray.geometry.attributes.position;
    const sLife = this.spray.geometry.attributes.aLife;
    for (let i = 0; i < SPRAY_COUNT; i++) {
      if (this.sprayLife[i] <= 0) {
        sLife.setX(i, 0);
        continue;
      }
      this.sprayLife[i] -= dt;
      this.sprayVel[i * 3 + 1] -= 14 * dt;
      sPos.setXYZ(
        i,
        sPos.getX(i) + this.sprayVel[i * 3] * dt,
        sPos.getY(i) + this.sprayVel[i * 3 + 1] * dt,
        sPos.getZ(i) + this.sprayVel[i * 3 + 2] * dt,
      );
      sLife.setX(i, Math.max(this.sprayLife[i], 0));
    }
    sPos.needsUpdate = true;
    sLife.needsUpdate = true;
  }
}
