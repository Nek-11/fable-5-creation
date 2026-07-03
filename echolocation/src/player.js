// Free-swimming first-person controller: move along your gaze in any
// direction, rise and sink, with watery inertia. Strokes make noise —
// and noise is danger.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.moving = false;
    this.burst = false;
    this.strokeAcc = 0;
    this.t = 0;
  }

  spawn(pos, yaw) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.strokeAcc = 0;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0023;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * 0.0023));
  }

  update(dt, keys, world) {
    this.t += dt;
    const f =
      (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const s =
      (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const up =
      (keys.Space ? 1 : 0) - (keys.KeyC || keys.ControlLeft ? 1 : 0);
    const wants = f !== 0 || s !== 0 || up !== 0;
    this.burst = !!(keys.ShiftLeft || keys.ShiftRight) && wants;

    const cp = Math.cos(this.pitch);
    const fwd = new THREE.Vector3(
      -Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp,
    );
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const desired = new THREE.Vector3();
    if (wants) {
      desired
        .addScaledVector(fwd, f)
        .addScaledVector(right, s)
        .add(new THREE.Vector3(0, up * 0.85, 0))
        .normalize()
        .multiplyScalar(this.burst ? C.BURST : C.SWIM);
    }
    // water drag: velocity eases toward intent
    this.vel.lerp(desired, 1 - Math.exp(-dt * 2.8));
    this.pos.addScaledVector(this.vel, dt);
    world.collide(this.pos, C.PLAYER_R);

    const speed = this.vel.length();
    this.moving = speed > 0.5;
    let stroked = false;
    if (this.moving) {
      this.strokeAcc += speed * dt;
      if (this.strokeAcc >= C.STROKE_DIST) {
        this.strokeAcc -= C.STROKE_DIST;
        stroked = true;
      }
    }

    // idle drift: the water never holds you perfectly still
    this.camera.position.set(
      this.pos.x + Math.sin(this.t * 0.7) * 0.04,
      this.pos.y + Math.sin(this.t * 0.9) * 0.05,
      this.pos.z + Math.cos(this.t * 0.6) * 0.04,
    );
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.t * 0.8) * 0.012 - s * 0.03);

    return { stroked, speed };
  }
}
