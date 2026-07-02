// Visual effects: rising updraft motes and the paper-confetti crash burst.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";
import { BUILDING_COLORS } from "./paper.js";

const MOTE_COUNT = 400;
const CONFETTI_COUNT = 80;

export class Effects {
  constructor(scene) {
    this.scene = scene;

    // --- updraft motes (one pooled Points cloud shared by nearby vents) ---
    const positions = new Float32Array(MOTE_COUNT * 3);
    this.moteGeo = new THREE.BufferGeometry();
    this.moteGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    // soft round sprite so motes don't render as hard squares
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = spriteCanvas.height = 32;
    const ctx = spriteCanvas.getContext("2d");
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    this.motes = new THREE.Points(
      this.moteGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.55,
        map: new THREE.CanvasTexture(spriteCanvas),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.motes.frustumCulled = false;
    scene.add(this.motes);

    this.moteState = [];
    for (let i = 0; i < MOTE_COUNT; i++) {
      this.moteState.push({
        h: Math.random() * C.VENT_HEIGHT,
        speed: 9 + Math.random() * 7,
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * C.VENT_RADIUS * 0.75,
        spin: 0.5 + Math.random() * 1.2,
      });
    }

    // --- crash confetti ---
    this.confetti = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.45, 0.55),
      new THREE.MeshStandardMaterial({
        flatShading: true,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
      CONFETTI_COUNT,
    );
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confetti.visible = false;
    this.confetti.frustumCulled = false;
    scene.add(this.confetti);

    this.pieces = [];
    this.dummy = new THREE.Object3D();
  }

  updateUpdrafts(dt, vents, playerPos) {
    const pos = this.moteGeo.attributes.position.array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const m = this.moteState[i];
      const j = i * 3;
      if (vents.length === 0) {
        pos[j + 1] = -9999; // park out of sight
        continue;
      }
      const vent = vents[i % vents.length];
      m.h += m.speed * dt;
      m.angle += m.spin * dt;
      if (m.h > C.VENT_HEIGHT) m.h -= C.VENT_HEIGHT;
      pos[j] = vent.x + Math.cos(m.angle) * m.radius;
      pos[j + 1] = vent.top + m.h;
      pos[j + 2] = vent.z + Math.sin(m.angle) * m.radius;
    }
    this.moteGeo.attributes.position.needsUpdate = true;
  }

  burst(origin) {
    this.pieces = [];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      this.pieces.push({
        pos: origin.clone(),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          Math.random() * 12 + 2,
          (Math.random() - 0.5) * 14,
        ),
        rot: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
        ),
        life: 2.2 + Math.random() * 0.8,
      });
      const color =
        Math.random() < 0.6
          ? new THREE.Color(0xfbf7ec)
          : BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];
      this.confetti.setColorAt(i, color);
    }
    if (this.confetti.instanceColor) {
      this.confetti.instanceColor.needsUpdate = true;
    }
    this.confetti.visible = true;
  }

  update(dt) {
    if (!this.confetti.visible) return;
    let alive = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      p.life -= dt;
      if (p.life > 0) {
        alive++;
        p.vel.y -= 9 * dt;
        p.vel.multiplyScalar(1 - 0.8 * dt); // paper flutters, doesn't plummet
        p.pos.addScaledVector(p.vel, dt);
        if (p.pos.y < 0.2) p.pos.y = 0.2;
        p.rot.x += p.spin.x * dt;
        p.rot.y += p.spin.y * dt;
        p.rot.z += p.spin.z * dt;
        this.dummy.position.copy(p.pos);
        this.dummy.rotation.copy(p.rot);
        this.dummy.scale.setScalar(Math.min(1, p.life));
      } else {
        this.dummy.scale.setScalar(0);
      }
      this.dummy.updateMatrix();
      this.confetti.setMatrixAt(i, this.dummy.matrix);
    }
    this.confetti.instanceMatrix.needsUpdate = true;
    if (alive === 0) this.confetti.visible = false;
  }

  reset() {
    this.pieces = [];
    this.confetti.visible = false;
  }
}
