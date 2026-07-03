// First-person blind-creature controller: pointer-lock look, grid collision,
// head bob, and footstep events (which are noise — and noise is danger).
import * as THREE from 'three';
import { CONFIG as C } from './config.js';

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.moving = false;
    this.running = false;
    this.stepAcc = 0;
    this.bobPhase = 0;
  }

  spawn(pos, yaw) {
    this.pos.copy(pos);
    this.yaw = yaw;
    this.pitch = 0;
    this.stepAcc = 0;
    this.bobPhase = 0;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0023;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy * 0.0023));
  }

  update(dt, keys, level) {
    const f =
      (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const s =
      (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    this.running = !!(keys.ShiftLeft || keys.ShiftRight) && (f !== 0 || s !== 0);
    const speed = this.running ? C.RUN : C.WALK;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let mx = -sin * f + cos * s;
    let mz = -cos * f - sin * s;
    const len = Math.hypot(mx, mz);
    this.moving = len > 0.001;

    let stepped = false;
    if (this.moving) {
      mx /= len;
      mz /= len;
      const before = this.pos.clone();
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      level.collideCircle(this.pos, C.PLAYER_R);
      const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
      this.stepAcc += moved;
      this.bobPhase += moved * 1.9;
      if (this.stepAcc >= C.STRIDE) {
        this.stepAcc -= C.STRIDE;
        stepped = true;
      }
    }

    const bob = Math.sin(this.bobPhase) * (this.running ? 0.065 : 0.04);
    this.camera.position.set(this.pos.x, C.EYE + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobPhase * 0.5) * 0.006);

    return { stepped };
  }
}
