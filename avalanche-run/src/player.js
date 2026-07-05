// The rider: arcade carving physics, airtime, spins, tumbles.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";
import { terrainHeight, terrainGradient } from "./terrain.js";

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.rotation.order = "YXZ";

    // board
    this.board = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.07, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xff5a3c, roughness: 0.4 }),
    );
    this.board.castShadow = true;
    this.group.add(this.board);

    // body (crouches as a unit)
    this.body = new THREE.Group();
    this.body.add(box(0.14, 0.42, 0.14, 0x25355e, -0.09, 0.28, 0.28)); // legs
    this.body.add(box(0.14, 0.42, 0.14, 0x25355e, 0.09, 0.28, -0.28));
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, 0.34, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0xd43a2f, roughness: 0.75 }),
    );
    torso.position.set(0, 0.78, 0);
    torso.rotation.x = 0.18;
    torso.castShadow = true;
    this.body.add(torso);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xd43a2f, roughness: 0.75 });
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 3, 8), armMat);
      arm.position.set(side * 0.26, 0.82, 0);
      arm.rotation.z = side * 1.1;
      arm.castShadow = true;
      this.body.add(arm);
    }
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8b48c, roughness: 0.8 }),
    );
    head.position.set(0, 1.16, 0);
    head.castShadow = true;
    this.body.add(head);
    const beanie = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.9 }),
    );
    beanie.position.set(0, 1.2, 0);
    this.body.add(beanie);
    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    );
    pom.position.set(0, 1.36, 0);
    this.body.add(pom);
    this.group.add(this.body);

    // scarf trail: chain of little quads that lag behind the rider
    this.scarfPts = [];
    this.scarfMeshes = [];
    const scarfMat = new THREE.MeshBasicMaterial({
      color: 0xf2c14e,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), scarfMat);
      scene.add(seg);
      this.scarfMeshes.push(seg);
      this.scarfPts.push(new THREE.Vector3());
    }

    scene.add(this.group);
    this._grad = new THREE.Vector2();
    this.reset();
  }

  reset() {
    this.pos = new THREE.Vector3(0, terrainHeight(0, 0), 0);
    this.heading = 0; // rad away from the fall line (-z)
    this.speed = C.START_SPEED;
    this.vy = 0;
    this.airborne = false;
    this.spin = 0; // extra yaw while airborne
    this.spinTotal = 0;
    this.tumbleT = 0;
    this.invulnT = 0;
    this.airT = 0;
    this.visPitch = 0;
    this.visRoll = 0;
    for (const p of this.scarfPts) p.copy(this.pos);
    this.group.position.copy(this.pos);
  }

  get tumbling() {
    return this.tumbleT > 0;
  }

  // input: { steer: -1..1, tuck: bool, jump: bool (edge) }
  // events: { onJump, onLand, onTrick(deg), onTumble }
  update(dt, input, events) {
    const steer = this.tumbling ? 0 : input.steer;

    if (this.tumbleT > 0) this.tumbleT -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;

    if (!this.airborne) {
      // --- grounded carving ---
      this.heading += steer * C.STEER_RATE * dt;
      if (steer === 0) {
        // drift back toward the fall line so taps don't leave you traversing
        const decay = 1.1 * dt;
        this.heading -= Math.sign(this.heading) * Math.min(Math.abs(this.heading), decay);
      }
      this.heading = THREE.MathUtils.clamp(this.heading, -C.MAX_HEADING, C.MAX_HEADING);

      const dirX = Math.sin(this.heading);
      const dirZ = -Math.cos(this.heading);

      // slope pull along travel direction (moguls slow you uphill, push downhill)
      terrainGradient(this.pos.x, this.pos.z, this._grad);
      const along = this._grad.x * dirX + this._grad.y * dirZ;
      let accel = -along * C.ACCEL;

      // drag: base quadratic + carve scrub
      const tuck = input.tuck && !this.tumbling;
      const maxSpeed = C.MAX_SPEED + (tuck ? C.TUCK_BONUS : 0);
      accel -= C.DRAG * this.speed * this.speed * (tuck ? 0.55 : 1);
      accel -= Math.abs(steer) * C.CARVE_DRAG * (this.speed / C.MAX_SPEED);

      this.speed = THREE.MathUtils.clamp(this.speed + accel * dt, 3, maxSpeed);
      if (this.tumbling) this.speed = Math.min(this.speed, 14);

      const prevY = this.pos.y;
      this.pos.x += dirX * this.speed * dt;
      this.pos.z += dirZ * this.speed * dt;

      const h = terrainHeight(this.pos.x, this.pos.z);
      this.vy = (h - prevY) / dt;

      if (input.jump && !this.tumbling) {
        this.airborne = true;
        this.airT = 0;
        this.vy = Math.max(this.vy, 0) + C.JUMP_VY;
        this.pos.y = prevY + this.vy * dt;
        events.onJump?.();
      } else if (h < prevY + this.vy * dt - 0.35) {
        // terrain dropped away — natural launch
        this.airborne = true;
        this.airT = 0;
        this.pos.y = prevY + this.vy * dt;
      } else {
        this.pos.y = h;
      }
    } else {
      // --- airborne ---
      this.airT += dt;
      const dirX = Math.sin(this.heading);
      const dirZ = -Math.cos(this.heading);
      this.pos.x += dirX * this.speed * dt;
      this.pos.z += dirZ * this.speed * dt;
      this.vy -= C.GRAVITY * dt;
      this.pos.y += this.vy * dt;

      // spin tricks
      this.spin += steer * C.SPIN_RATE * dt;
      this.spinTotal += Math.abs(steer * C.SPIN_RATE * dt);

      const h = terrainHeight(this.pos.x, this.pos.z);
      if (this.pos.y <= h) {
        this.pos.y = h;
        this.airborne = false;
        const halfTurns = Math.round(this.spin / Math.PI);
        const err = Math.abs(this.spin - halfTurns * Math.PI);
        const deg = Math.abs(halfTurns) * 180;
        if (err > 0.62 && this.spinTotal > 0.9) {
          this.startTumble();
          events.onTumble?.("caught an edge");
        } else if (deg >= 180 && this.airT > 0.25) {
          this.speed = Math.min(this.speed + 4 + deg / 90, C.MAX_SPEED + C.TUCK_BONUS);
          events.onTrick?.(deg);
        } else {
          events.onLand?.(this.vy);
        }
        this.spin = 0;
        this.spinTotal = 0;
      }
    }

    this.updateVisual(dt, input);
  }

  startTumble() {
    this.tumbleT = C.TUMBLE_TIME;
    this.invulnT = C.INVULN_TIME;
    this.speed *= C.TUMBLE_SPEED_KEEP;
    this.spin = 0;
    this.airborne = false;
  }

  updateVisual(dt, input) {
    this.group.position.copy(this.pos);

    // align to slope
    terrainGradient(this.pos.x, this.pos.z, this._grad);
    const dirX = Math.sin(this.heading);
    const dirZ = -Math.cos(this.heading);
    const slopeAlong = this._grad.x * dirX + this._grad.y * dirZ;
    const targetPitch = this.airborne ? -0.25 : Math.atan(slopeAlong);
    this.visPitch = THREE.MathUtils.lerp(this.visPitch, targetPitch, 1 - Math.exp(-8 * dt));

    const targetRoll = -input.steer * 0.45;
    this.visRoll = THREE.MathUtils.lerp(this.visRoll, targetRoll, 1 - Math.exp(-8 * dt));

    if (this.tumbling) {
      this.group.rotation.set(
        this.tumbleT * 9,
        this.heading + this.tumbleT * 5,
        this.tumbleT * 7,
      );
    } else {
      this.group.rotation.set(this.visPitch, this.heading + this.spin, this.visRoll);
    }

    // crouch when tucking or pre-jump, stretch in the air
    const crouch = input.tuck && !this.airborne ? 0.7 : this.airborne ? 1.06 : 1;
    this.body.scale.y = THREE.MathUtils.lerp(this.body.scale.y, crouch, 1 - Math.exp(-10 * dt));

    // scarf: springy chain from the neck backwards
    const neck = new THREE.Vector3(0, 1.05 * this.body.scale.y, 0.1)
      .applyEuler(this.group.rotation)
      .add(this.pos);
    let prev = neck;
    for (let i = 0; i < this.scarfPts.length; i++) {
      const p = this.scarfPts[i];
      p.lerp(prev, 1 - Math.exp(-(18 - i * 1.6) * dt));
      const d = p.distanceTo(prev);
      const maxD = 0.13;
      if (d > maxD) p.lerp(prev, 1 - maxD / d);
      this.scarfMeshes[i].position.copy(p);
      this.scarfMeshes[i].lookAt(prev);
      const s = 1 - i * 0.09;
      this.scarfMeshes[i].scale.setScalar(s);
      prev = p;
    }
  }
}
