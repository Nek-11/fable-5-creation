// The paper airplane: folded-dart mesh + arcade glider flight model.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";

const DRY_COLOR = new THREE.Color(0xfbf7ec);
const WET_COLOR = new THREE.Color(0xafbcc6);

function wingGeometry(side) {
  // Triangle: nose -> wingtip -> tail-center. side = -1 (left) or 1 (right)
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, -1.7, // nose
    side * 1.3, 0.3, 1.55, // wingtip
    0, 0.12, 1.5, // tail on the fold line
  ]);
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function keelGeometry() {
  // Vertical fin under the fold line.
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0, 0, -1.7, // nose
    0, 0.12, 1.5, // tail top
    0, -0.42, 1.5, // tail bottom
  ]);
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

export class Plane {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    this.material = new THREE.MeshStandardMaterial({
      color: DRY_COLOR.clone(),
      flatShading: true,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    this.leftWing = new THREE.Mesh(wingGeometry(-1), this.material);
    this.rightWing = new THREE.Mesh(wingGeometry(1), this.material);
    this.keel = new THREE.Mesh(keelGeometry(), this.material);
    // ink outline so the white dart reads against the pale sky
    const outlineMat = new THREE.LineBasicMaterial({ color: 0x6b655a });
    for (const m of [this.leftWing, this.rightWing, this.keel]) {
      m.castShadow = true;
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), outlineMat));
      this.group.add(m);
    }

    // Crease line down the spine.
    const creaseGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.005, -1.7),
      new THREE.Vector3(0, 0.125, 1.5),
    ]);
    this.group.add(
      new THREE.Line(
        creaseGeo,
        new THREE.LineBasicMaterial({ color: 0xc9c2b2 }),
      ),
    );

    scene.add(this.group);

    // Flight state
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = C.START_SPEED;
    this.wetness = 0;
    this.stalled = false;
    this.reset();
  }

  reset() {
    this.pos.set(C.START_POS.x, C.START_POS.y, C.START_POS.z);
    this.yaw = 0;
    this.pitch = -0.05;
    this.roll = 0;
    this.speed = C.START_SPEED;
    this.wetness = 0;
    this.stalled = false;
    this.group.visible = true;
    this.updateTransform();
  }

  // input: { pitch: -1..1 (up positive), roll: -1..1 (left positive) }
  // env: { updraft: number, raining: bool, gustX: number }
  update(dt, input, env) {
    const authority = THREE.MathUtils.clamp(this.speed / C.STALL_SPEED, 0.25, 1);

    // --- attitude ---
    if (input.pitch !== 0) {
      this.pitch += input.pitch * C.PITCH_RATE * authority * dt;
    } else {
      // drift back toward natural glide trim
      this.pitch += (C.PITCH_TRIM - this.pitch) * C.PITCH_RETURN * dt;
    }
    this.pitch = THREE.MathUtils.clamp(this.pitch, C.PITCH_MIN, C.PITCH_MAX);

    if (input.roll !== 0) {
      this.roll += input.roll * C.ROLL_RATE * dt;
    } else {
      this.roll -= this.roll * Math.min(1, C.ROLL_CENTER * dt);
    }
    this.roll = THREE.MathUtils.clamp(this.roll, -C.ROLL_MAX, C.ROLL_MAX);

    // banking turns the plane
    const turnScale = THREE.MathUtils.clamp(this.speed / C.CRUISE_SPEED, 0.4, 1.6);
    this.yaw += this.roll * C.TURN_FACTOR * turnScale * dt;

    // --- stall: too slow -> nose drops, mushy controls ---
    this.stalled = this.speed < C.STALL_SPEED;
    if (this.stalled) {
      this.pitch -= (C.STALL_SPEED - this.speed) * C.STALL_NOSE_DROP * dt;
    }

    // --- speed: dive to gain, climb to bleed ---
    const wetDrag = 1 + this.wetness * 0.8;
    const accel =
      -C.GRAVITY_GAIN * Math.sin(this.pitch) -
      (this.speed - C.CRUISE_SPEED) * C.SPEED_DAMP * wetDrag;
    this.speed = THREE.MathUtils.clamp(
      this.speed + accel * dt,
      C.MIN_SPEED,
      C.MAX_SPEED,
    );

    // --- velocity ---
    const cp = Math.cos(this.pitch);
    this.forward.set(
      -Math.sin(this.yaw) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cp,
    );
    this.vel.copy(this.forward).multiplyScalar(this.speed);

    // sink: heavier when soaked, less when fast
    const sinkScale = THREE.MathUtils.clamp(
      1.6 - this.speed / C.CRUISE_SPEED,
      0.25,
      1.6,
    );
    const sink = (C.SINK_BASE + C.SINK_WET * this.wetness) * sinkScale;
    this.vel.y -= sink;
    this.vel.y += env.updraft;
    this.vel.x += env.gustX;

    this.pos.addScaledVector(this.vel, dt);

    // --- wetness ---
    if (env.raining) {
      this.wetness += C.RAIN_SOAK_RATE * dt;
    } else {
      this.wetness -= (C.DRY_RATE + this.speed * C.DRY_SPEED_BONUS) * dt;
    }
    this.wetness = THREE.MathUtils.clamp(this.wetness, 0, 1);

    this.updateTransform();
  }

  updateTransform() {
    this.group.position.copy(this.pos);
    this.group.rotation.order = "YXZ";
    this.group.rotation.set(this.pitch, this.yaw, this.roll);

    // soggy paper: tint + wing droop
    this.material.color.copy(DRY_COLOR).lerp(WET_COLOR, this.wetness);
    const droop = this.wetness * 0.3;
    this.leftWing.rotation.z = -droop;
    this.rightWing.rotation.z = droop;
  }

  horizontalSpeed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }
}
