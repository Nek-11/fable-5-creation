import * as THREE from 'three';
import { PHYS, PORTAL, COLORS } from './config.js';
import { stepPhysics } from './physics.js';

const MAX_DOTS = 80;

export class AimController {
  constructor(camera, dom, controls) {
    this.camera = camera;
    this.dom = dom;
    this.controls = controls;
    this.enabled = false;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    this.aiming = false;
    this.start = { x: 0, y: 0, t: 0 };
    this.cur = { x: 0, y: 0 };
    this.launchVel = new THREE.Vector3();
    this.validAim = false;

    // wired up by game.js
    this.ball = null;
    this.world = null;          // { colliders, hoop, portals }
    this.portalMeshes = [];
    this.onShoot = () => {};
    this.onPlacePortal = () => {};
    this.onAimStart = () => {};
    this.onAimEnd = () => {};

    // trajectory dots
    this.dots = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xcffcff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_DOTS
    );
    this.dots.count = 0;
    this.dots.frustumCulled = false;

    // portal placement hover ring
    this.hoverRing = new THREE.Mesh(
      new THREE.TorusGeometry(PORTAL.radius, 0.018, 8, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.5 })
    );
    this.hoverRing.visible = false;

    this._m = new THREE.Matrix4();
    this._sim = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), cooldown: 0 };

    dom.addEventListener('pointerdown', (e) => this.pointerDown(e));
    window.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', (e) => this.pointerUp(e));
  }

  addTo(scene) {
    scene.add(this.dots, this.hoverRing);
  }

  setNextPortalColor(isA) {
    this.hoverRing.material.color.setHex(isA ? COLORS.cyan : COLORS.magenta);
  }

  updateNdc(e) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  ballUnderPointer(e) {
    if (!this.ball || this.ball.live) return false;
    this.updateNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    // generous grab sphere
    const sphere = new THREE.Sphere(this.ball.state.pos, PHYS.ballRadius * 3.2);
    return this.raycaster.ray.intersectsSphere(sphere);
  }

  pointerDown(e) {
    if (!this.enabled || e.button !== 0) return;
    this.start = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (this.ballUnderPointer(e)) {
      this.aiming = true;
      this.controls.enabled = false;
      this.cur = { x: e.clientX, y: e.clientY };
      this.onAimStart();
    }
  }

  pointerMove(e) {
    if (!this.enabled) return;
    if (this.aiming) {
      this.cur = { x: e.clientX, y: e.clientY };
      this.computeLaunch();
      this.updatePreview();
      return;
    }
    // hover feedback for portal placement
    this.updateNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.portalMeshes, false);
    if (hits.length) {
      const h = hits[0];
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
      this.hoverRing.position.copy(h.point).addScaledVector(n, 0.02);
      this.hoverRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      this.hoverRing.visible = true;
      this.dom.style.cursor = 'crosshair';
    } else {
      this.hoverRing.visible = false;
      this.dom.style.cursor = this.ballUnderPointer(e) ? 'grab' : 'default';
    }
  }

  pointerUp(e) {
    if (!this.enabled) return;
    if (this.aiming) {
      this.aiming = false;
      this.controls.enabled = true;
      this.dots.count = 0;
      this.dots.instanceMatrix.needsUpdate = true;
      this.onAimEnd();
      if (this.validAim) this.onShoot(this.launchVel.clone());
      this.validAim = false;
      return;
    }
    // click (small movement, quick) → place portal
    if (e.button !== 0) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    if (Math.hypot(dx, dy) > 6 || performance.now() - this.start.t > 400) return;
    this.updateNdc(e);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.portalMeshes, false);
    if (hits.length) {
      const h = hits[0];
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
      this.onPlacePortal(h.point, n, h.object.userData.colliderId);
    }
  }

  computeLaunch() {
    const dx = this.cur.x - this.start.x;
    const dy = this.cur.y - this.start.y;
    const len = Math.hypot(dx, dy);
    this.validAim = len > 24 && dy > -40; // must pull back (mostly downward)

    // camera-relative horizontal aim
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const yaw = THREE.MathUtils.clamp(-dx * 0.0042, -1.35, 1.35);
    fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const pitch = THREE.MathUtils.clamp(0.22 + dy * 0.0037, -0.3, 1.25);
    const power = THREE.MathUtils.clamp(len / 270, 0, 1);
    const speed = PHYS.minSpeed + (PHYS.maxSpeed - PHYS.minSpeed) * power;

    this.launchVel
      .copy(fwd)
      .multiplyScalar(Math.cos(pitch))
      .add(new THREE.Vector3(0, Math.sin(pitch), 0))
      .multiplyScalar(speed);
  }

  updatePreview() {
    if (!this.validAim || !this.world) {
      this.dots.count = 0;
      this.dots.instanceMatrix.needsUpdate = true;
      return;
    }
    const sim = this._sim;
    sim.pos.copy(this.ball.state.pos);
    sim.vel.copy(this.launchVel);
    sim.cooldown = 0;

    const dt = 1 / 90;
    let dot = 0;
    let postBounce = 0;
    for (let i = 0; i < 300 && dot < MAX_DOTS; i++) {
      const res = stepPhysics(sim, dt, this.world);
      if (i % 3 === 0 || res.teleported) {
        const s = 1 - (dot / MAX_DOTS) * 0.65;
        this._m.makeScale(s, s, s).setPosition(sim.pos);
        this.dots.setMatrixAt(dot++, this._m);
      }
      if (res.hit) {
        postBounce++;
        if (postBounce > 1) break; // stop shortly after first contact
      }
    }
    this.dots.count = dot;
    this.dots.instanceMatrix.needsUpdate = true;
  }
}
