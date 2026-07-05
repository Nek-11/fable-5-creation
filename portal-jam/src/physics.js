import * as THREE from 'three';
import { PHYS } from './config.js';

const _local = new THREE.Vector3();
const _clamped = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _qInv = new THREE.Quaternion();
const _contact = new THREE.Vector3();
const _surfVel = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _flat = new THREE.Vector3();

// Sphere vs (possibly rotated) box. Mutates pos/vel on contact.
// Returns { normal, speed } of the impact or null.
export function resolveSphereBox(pos, vel, r, col) {
  _local.copy(pos).sub(col.center);
  if (col.quat) {
    _qInv.copy(col.quat).invert();
    _local.applyQuaternion(_qInv);
  }

  _clamped.set(
    Math.max(-col.half.x, Math.min(col.half.x, _local.x)),
    Math.max(-col.half.y, Math.min(col.half.y, _local.y)),
    Math.max(-col.half.z, Math.min(col.half.z, _local.z))
  );
  _delta.copy(_local).sub(_clamped);
  const distSq = _delta.lengthSq();
  if (distSq > r * r) return null;

  let dist, pen;
  if (distSq > 1e-10) {
    dist = Math.sqrt(distSq);
    _normal.copy(_delta).divideScalar(dist);
    pen = r - dist;
  } else {
    // center inside the box: push out along the axis of least penetration
    const dx = col.half.x - Math.abs(_local.x);
    const dy = col.half.y - Math.abs(_local.y);
    const dz = col.half.z - Math.abs(_local.z);
    if (dx <= dy && dx <= dz) _normal.set(Math.sign(_local.x) || 1, 0, 0), pen = dx + r;
    else if (dy <= dz) _normal.set(0, Math.sign(_local.y) || 1, 0), pen = dy + r;
    else _normal.set(0, 0, Math.sign(_local.z) || 1), pen = dz + r;
  }

  // contact point (local) → world
  _contact.copy(_clamped);
  if (col.quat) { _normal.applyQuaternion(col.quat); _contact.applyQuaternion(col.quat); }
  _contact.add(col.center);

  // surface velocity for rotating obstacles
  _surfVel.set(0, 0, 0);
  if (col.angularVel && col.angularVel.lengthSq() > 0) {
    _rel.copy(_contact).sub(col.center);
    _surfVel.crossVectors(col.angularVel, _rel);
  }

  pos.addScaledVector(_normal, pen + 1e-4);

  _rel.copy(vel).sub(_surfVel);
  const vn = _rel.dot(_normal);
  if (vn < 0) {
    const e = col.restitution ?? PHYS.restitution;
    // split into normal + tangential, damp tangential (friction)
    _flat.copy(_normal).multiplyScalar(vn);
    const tangential = _rel.sub(_flat); // _rel now tangential
    vel.copy(tangential.multiplyScalar(PHYS.friction))
      .addScaledVector(_normal, -vn * e)
      .add(_surfVel);
    return { normal: _normal.clone(), speed: -vn, kind: col.kind, id: col.id };
  }
  return null;
}

const _toBall = new THREE.Vector3();
const _ringPt = new THREE.Vector3();

// Sphere vs the rim torus (horizontal circle of radius rimR, tube tubeR).
export function resolveRim(pos, vel, r, rimCenter, rimR, tubeR) {
  _toBall.copy(pos).sub(rimCenter);
  _flat.set(_toBall.x, 0, _toBall.z);
  const flatLen = _flat.length();
  if (flatLen < 1e-6) return null;
  _ringPt.copy(_flat).multiplyScalar(rimR / flatLen).add(rimCenter);
  _delta.copy(pos).sub(_ringPt);
  const dist = _delta.length();
  const minDist = r + tubeR;
  if (dist >= minDist || dist < 1e-6) return null;

  _normal.copy(_delta).divideScalar(dist);
  pos.addScaledVector(_normal, minDist - dist + 1e-4);
  const vn = vel.dot(_normal);
  if (vn < 0) {
    vel.addScaledVector(_normal, -(1 + PHYS.rimRestitution) * vn);
    vel.multiplyScalar(0.96);
    return { normal: _normal.clone(), speed: -vn, kind: 'rim', id: 'rim' };
  }
  return null;
}

// One physics step shared by the live ball and the aim preview.
// state: { pos, vel }; world: { colliders, hoop, portals }
// Returns { hit, teleported, scored } for this step.
export function stepPhysics(state, dt, world, opts = {}) {
  const r = PHYS.ballRadius;
  state.vel.y -= PHYS.gravity * dt;
  state.cooldown = Math.max(0, (state.cooldown || 0) - dt);
  const prevY = state.pos.y;
  state.pos.addScaledVector(state.vel, dt);

  let teleported = null;
  if (world.portals) {
    teleported = world.portals.tryTeleport(state.pos, state.vel, r, state);
  }

  let hit = null;
  const skipId = world.portals ? world.portals.hostToSkip(state.pos, r) : null;
  for (const col of world.colliders) {
    if (skipId && col.id === skipId) continue;
    const h = resolveSphereBox(state.pos, state.vel, r, col);
    if (h && (!hit || h.speed > hit.speed)) hit = h;
  }

  if (world.hoop) {
    const h = resolveRim(state.pos, state.vel, r, world.hoop.rimCenter, world.hoop.rimRadius, world.hoop.rimTube);
    if (h && (!hit || h.speed > hit.speed)) hit = h;
  }

  // score: crossed the rim plane downward, inside the ring
  let scored = false;
  if (world.hoop && !teleported) {
    const rc = world.hoop.rimCenter;
    if (prevY > rc.y && state.pos.y <= rc.y && state.vel.y < 0) {
      const dx = state.pos.x - rc.x, dz = state.pos.z - rc.z;
      if (dx * dx + dz * dz < (world.hoop.rimRadius - 0.03) ** 2) scored = true;
    }
  }

  return { hit, teleported, scored };
}
