import * as THREE from 'three';
import { CONFIG } from './config.js';

const PL = CONFIG.player;

const _v = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

// A little gardener walking the curve of the world. Gravity is simply
// "stay glued to the sphere": position lives as a unit direction + height.

export class Player {
  constructor(scene, planet, camera) {
    this.planet = planet;
    this.camera = camera;

    this.dir = new THREE.Vector3(0, 0, 1); // unit position on the sphere
    this.facing = new THREE.Vector3(1, 0, 0); // tangent heading
    this.moving = false;
    this.walkPhase = 0;
    this.yawOffset = 0; // camera orbit from mouse drag
    this.shake = 0;

    this.buildModel(scene);
    this.snapToSurface();

    // camera state
    this.camUp = this.dir.clone();
    this.camPosSmooth = null;
  }

  buildModel(scene) {
    this.group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#1d5c52', roughness: 0.6, emissive: '#0c2b26', emissiveIntensity: 0.6,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.42, 4, 10), bodyMat);
    body.position.y = 0.62;
    this.group.add(body);

    const headMat = new THREE.MeshStandardMaterial({
      color: '#e8fff4', roughness: 0.4, emissive: '#9dffdd', emissiveIntensity: 0.35,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), headMat);
    head.position.y = 1.12;
    this.group.add(head);

    const hatMat = new THREE.MeshStandardMaterial({
      color: '#154236', roughness: 0.55, emissive: '#2adfa8', emissiveIntensity: 0.25,
    });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.05, 18), hatMat);
    brim.position.y = 1.26;
    this.group.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.42, 18), hatMat);
    cone.position.y = 1.48;
    this.group.add(cone);

    this.body = body;
    this.head = head;

    // companion lantern-orb: a firefly that lights the way
    this.orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#ffd97a', toneMapped: false }),
    );
    this.orbLight = new THREE.PointLight('#ffd9a0', 7, 9, 2);
    this.orb.add(this.orbLight);
    this.orbPos = new THREE.Vector3();
    this.orbVel = new THREE.Vector3();

    scene.add(this.group);
    scene.add(this.orb);
  }

  snapToSurface() {
    const r = this.planet.surfaceRadius(this.dir) + PL.height;
    this.group.position.copy(this.dir).multiplyScalar(r);
    this.orbPos.copy(this.group.position).addScaledVector(this.dir, 2.2);
    this.orb.position.copy(this.orbPos);
  }

  get worldPos() { return this.group.position; }

  update(dt, time, input) {
    const up = this.dir;

    // --- camera-relative movement basis ---
    this.camera.getWorldDirection(_forward);
    _forward.addScaledVector(up, -_forward.dot(up));
    if (_forward.lengthSq() < 1e-6) _forward.set(1, 0, 0);
    _forward.normalize();
    _right.crossVectors(_forward, up).normalize();

    _move.set(0, 0, 0);
    if (input.keys['KeyW'] || input.keys['ArrowUp']) _move.add(_forward);
    if (input.keys['KeyS'] || input.keys['ArrowDown']) _move.sub(_forward);
    if (input.keys['KeyD'] || input.keys['ArrowRight']) _move.add(_right);
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) _move.sub(_right);

    this.moving = _move.lengthSq() > 0;
    const sprinting = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    const speed = sprinting ? PL.sprint : PL.speed;

    if (this.moving) {
      _move.normalize();
      // walk along the tangent, then re-project onto the sphere
      _v.copy(this.dir).multiplyScalar(this.planet.surfaceRadius(this.dir))
        .addScaledVector(_move, speed * dt);
      this.dir.copy(_v).normalize();
      this.facing.lerp(_move, Math.min(1, dt * 10)).addScaledVector(up, -this.facing.dot(up)).normalize();
      this.walkPhase += dt * (sprinting ? 13 : 9);
    }

    // --- pose on the surface ---
    const r = this.planet.surfaceRadius(this.dir) + PL.height;
    this.group.position.copy(this.dir).multiplyScalar(r);

    // right-handed triad: X = up × facing, Z = X × up (re-orthogonalized facing)
    _right.crossVectors(up, this.facing).normalize();
    _forward.crossVectors(_right, up).normalize();
    _m.makeBasis(_right, up, _forward);
    _q.setFromRotationMatrix(_m);
    this.group.quaternion.slerp(_q, Math.min(1, dt * 12));

    // walk bob + idle breathe
    const bob = this.moving ? Math.abs(Math.sin(this.walkPhase)) * 0.09 : 0;
    const breathe = Math.sin(time * 2.1) * 0.012;
    this.body.position.y = 0.62 + bob + breathe;
    this.head.position.y = 1.12 + bob * 1.15 + breathe;
    this.body.rotation.x = this.moving ? Math.sin(this.walkPhase) * 0.08 : 0;

    // --- firefly companion: springy follow above the right shoulder ---
    _v.copy(this.group.position)
      .addScaledVector(up, 1.9 + Math.sin(time * 1.7) * 0.14)
      .addScaledVector(_right, 0.7)
      .addScaledVector(_forward, 0.25);
    this.orbVel.addScaledVector(_v.sub(this.orbPos), dt * 26);
    this.orbVel.multiplyScalar(Math.max(0, 1 - dt * 7));
    this.orbPos.addScaledVector(this.orbVel, dt);
    this.orb.position.copy(this.orbPos);
    const flicker = 0.9 + Math.sin(time * 11) * 0.06 + Math.sin(time * 23.7) * 0.04;
    this.orbLight.intensity = 7 * flicker;

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const up = this.dir;
    this.camUp.lerp(up, Math.min(1, dt * 5)).normalize();

    // behind the player, offset by the drag-orbit yaw
    _forward.copy(this.facing).addScaledVector(up, -this.facing.dot(up)).normalize();
    if (Math.abs(this.yawOffset) > 0.0001) {
      _forward.applyAxisAngle(up, this.yawOffset);
    }

    _camPos.copy(this.group.position)
      .addScaledVector(_forward, -PL.camDist)
      .addScaledVector(up, PL.camHeight);
    // keep the camera above the terrain
    const minR = this.planet.surfaceRadius(_v.copy(_camPos).normalize()) + 1.2;
    if (_camPos.length() < minR) _camPos.setLength(minR);

    if (!this.camPosSmooth) this.camPosSmooth = _camPos.clone();
    this.camPosSmooth.lerp(_camPos, Math.min(1, dt * 6));

    // screen shake (bursts / rot damage)
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const s = this.shake * this.shake * 0.5;
      this.camPosSmooth.x += (Math.random() - 0.5) * s;
      this.camPosSmooth.y += (Math.random() - 0.5) * s;
      this.camPosSmooth.z += (Math.random() - 0.5) * s;
    }

    this.camera.position.copy(this.camPosSmooth);
    this.camera.up.copy(this.camUp);
    _camTarget.copy(this.group.position).addScaledVector(up, 1.3);
    this.camera.lookAt(_camTarget);
  }

  reset(dir) {
    this.dir.copy(dir).normalize();
    this.facing.set(1, 0, 0).addScaledVector(this.dir, -this.dir.x).normalize();
    this.yawOffset = 0;
    this.shake = 0;
    this.camPosSmooth = null;
    this.snapToSurface();
  }
}
