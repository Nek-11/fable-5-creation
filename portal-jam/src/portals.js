import * as THREE from 'three';
import { PORTAL, COLORS } from './config.js';

const PORTAL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PORTAL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uActive;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float rad = length(p);
    if (rad > 1.0) discard;
    float ang = atan(p.y, p.x);

    float swirl = sin(ang * 3.0 - uTime * 3.2 + rad * 10.0) * 0.5 + 0.5;
    float swirl2 = sin(ang * 5.0 + uTime * 2.1 - rad * 14.0) * 0.5 + 0.5;
    float ring = smoothstep(0.72, 0.97, rad) * smoothstep(1.0, 0.97, rad / 1.0);
    float edgeFade = smoothstep(1.0, 0.92, rad);

    vec3 col = uColor * (0.28 + swirl * 0.45 + swirl2 * 0.2);
    col *= mix(0.15, 1.0, rad);            // dark event-horizon core
    col += uColor * ring * 2.2;            // hot rim

    float alpha = edgeFade * (0.5 + 0.4 * swirl);
    alpha *= mix(0.35, 1.0, uActive);
    col *= mix(0.4, 1.0, uActive);

    gl_FragColor = vec4(col, alpha);
  }
`;

const _q = new THREE.Quaternion();
const _local = new THREE.Vector3();
const _lv = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);

class Portal {
  constructor(colorHex) {
    this.placed = false;
    this.pos = new THREE.Vector3();
    this.normal = new THREE.Vector3(0, 0, 1);
    this.quat = new THREE.Quaternion();
    this.quatInv = new THREE.Quaternion();
    this.hostId = null;

    this.group = new THREE.Group();
    this.group.visible = false;

    this.uniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
      uActive: { value: 0 },
    };
    const disc = new THREE.Mesh(
      new THREE.PlaneGeometry(PORTAL.radius * 2, PORTAL.radius * 2),
      new THREE.ShaderMaterial({
        vertexShader: PORTAL_VERT,
        fragmentShader: PORTAL_FRAG,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    disc.renderOrder = 5;
    this.group.add(disc);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(PORTAL.radius, 0.03, 10, 48),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    ring.renderOrder = 6;
    this.group.add(ring);

    this.light = new THREE.PointLight(colorHex, 0, 5, 1.8);
    this.light.position.set(0, 0, 0.4);
    this.group.add(this.light);
  }

  place(point, normal, hostId) {
    this.placed = true;
    this.hostId = hostId;
    this.normal.copy(normal);
    this.pos.copy(point).addScaledVector(normal, PORTAL.surfaceGap);
    this.quat.setFromUnitVectors(_zAxis, normal);
    this.quatInv.copy(this.quat).invert();
    this.group.position.copy(this.pos);
    this.group.quaternion.copy(this.quat);
    this.group.visible = true;
    this.group.scale.setScalar(0.01);
  }

  clear() {
    this.placed = false;
    this.group.visible = false;
    this.hostId = null;
  }
}

export class PortalManager {
  constructor(scene) {
    this.a = new Portal(COLORS.cyan);
    this.b = new Portal(COLORS.magenta);
    scene.add(this.a.group, this.b.group);
    this.nextIsA = true;
  }

  get bothPlaced() {
    return this.a.placed && this.b.placed;
  }

  placeNext(point, normal, hostId) {
    const p = this.nextIsA ? this.a : this.b;
    p.place(point, normal, hostId);
    this.nextIsA = !this.nextIsA;
    return p === this.a ? 'a' : 'b';
  }

  clear() {
    this.a.clear();
    this.b.clear();
    this.nextIsA = true;
  }

  update(t, dt) {
    for (const p of [this.a, this.b]) {
      p.uniforms.uTime.value = t;
      const active = this.bothPlaced ? 1 : 0.4;
      p.uniforms.uActive.value += (active - p.uniforms.uActive.value) * 0.1;
      p.light.intensity = p.placed ? (this.bothPlaced ? 2.4 : 0.9) : 0;
      if (p.group.visible && p.group.scale.x < 1) {
        p.group.scale.setScalar(Math.min(1, p.group.scale.x + dt * 6));
      }
    }
  }

  // If the ball sits inside a portal opening, collisions against that
  // portal's host surface are ignored so it can pass "into" the wall.
  hostToSkip(pos, r) {
    if (!this.bothPlaced) return null;
    for (const p of [this.a, this.b]) {
      _local.copy(pos).sub(p.pos).applyQuaternion(p.quatInv);
      const radial = Math.hypot(_local.x, _local.y);
      if (radial < PORTAL.radius * 0.92 && Math.abs(_local.z) < r * 2.5) return p.hostId;
    }
    return null;
  }

  // Teleport when the ball crosses a portal plane moving into the surface.
  // `state` owns the re-entry cooldown so previews can simulate independently.
  tryTeleport(pos, vel, r, state) {
    if (!this.bothPlaced || (state.cooldown || 0) > 0) return null;
    for (const [from, to] of [[this.a, this.b], [this.b, this.a]]) {
      if (vel.dot(from.normal) >= 0) continue; // not moving into it
      _local.copy(pos).sub(from.pos).applyQuaternion(from.quatInv);
      const radial = Math.hypot(_local.x, _local.y);
      if (radial > PORTAL.radius * 0.88 || _local.z > r || _local.z < -r * 2) continue;

      // 180° about local Y, then into the exit portal's frame
      _local.x = -_local.x;
      _local.z = -_local.z;
      pos.copy(_local).applyQuaternion(to.quat).add(to.pos);
      pos.addScaledVector(to.normal, r * 1.05 + 0.02);

      _lv.copy(vel).applyQuaternion(from.quatInv);
      _lv.x = -_lv.x;
      _lv.z = -_lv.z;
      vel.copy(_lv).applyQuaternion(to.quat);

      // guarantee a clean exit
      const outSpeed = vel.dot(to.normal);
      if (outSpeed < 0.5) vel.addScaledVector(to.normal, 0.5 - outSpeed);

      state.cooldown = 0.06;
      return { from: from === this.a ? 'a' : 'b', exitPos: pos.clone() };
    }
    return null;
  }
}
