import * as THREE from 'three';
import { PHYS, PORTAL, SLING, COLORS } from './config.js';
import { stepPhysics } from './physics.js';

const MAX_DOTS = 110;
const UP = new THREE.Vector3(0, 1, 0);

// Slingshot aiming: grab the ball, drag it back along the court plane in 3D,
// release to fling it the opposite way. Pull distance = power; soft tosses
// arc high, hard throws fly flat. The dotted preview runs the real physics,
// portals and bounces included.
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
    this.anchor = new THREE.Vector3();     // where the ball rests
    this.dragPoint = new THREE.Vector3();  // where it's pulled to
    this.dragPlane = new THREE.Plane(UP, 0);
    this.launchVel = new THREE.Vector3();
    this.validAim = false;

    // wired up by game.js
    this.ball = null;
    this.world = null;          // { colliders, hoop, portals }
    this.portalMeshes = [];
    this.blockerMeshes = [];    // solid meshes the pull can't be dragged through
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

    // where the preview first touches down — gold when the preview scores
    this.landing = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.23, 28),
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
    );
    this.landing.visible = false;

    // elastic band from anchor to the pulled ball
    this.band = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: COLORS.ball, transparent: true, opacity: 0.9 })
    );
    this.band.frustumCulled = false;
    this.band.visible = false;

    // anchor marker on the court
    this.anchorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.15, 24),
      new THREE.MeshBasicMaterial({ color: COLORS.ball, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
    );
    this.anchorRing.rotation.x = -Math.PI / 2;
    this.anchorRing.visible = false;

    // portal placement hover ring
    this.hoverRing = new THREE.Mesh(
      new THREE.TorusGeometry(PORTAL.radius, 0.018, 8, 40),
      new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.5 })
    );
    this.hoverRing.visible = false;

    this._m = new THREE.Matrix4();
    this._sim = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), cooldown: 0 };
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();

    dom.addEventListener('pointerdown', (e) => this.pointerDown(e));
    window.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', (e) => this.pointerUp(e));
  }

  addTo(scene) {
    scene.add(this.dots, this.landing, this.band, this.anchorRing, this.hoverRing);
  }

  setNextPortalColor(isA) {
    this.hoverRing.material.color.setHex(isA ? COLORS.cyan : COLORS.magenta);
  }

  updateNdc(e) {
    const r = this.dom.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    this.ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    return true;
  }

  ballUnderPointer(e) {
    if (!this.ball || this.ball.live) return false;
    if (!this.updateNdc(e)) return false;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const sphere = new THREE.Sphere(this.ball.state.pos, PHYS.ballRadius * 3.4);
    return this.raycaster.ray.intersectsSphere(sphere);
  }

  pointerDown(e) {
    if (!this.enabled || e.button !== 0) return;
    this.start = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (this.ballUnderPointer(e)) {
      this.aiming = true;
      this.validAim = false;
      this.controls.enabled = false;
      this.anchor.copy(this.ball.spawn);
      this.dragPlane.constant = -this.anchor.y;
      this.anchorRing.position.copy(this.anchor).setY(0.02);
      this.anchorRing.visible = true;
      this.dom.style.cursor = 'grabbing';
      this.onAimStart();
      this.updateDrag(e);
    }
  }

  pointerMove(e) {
    if (!this.enabled) return;
    if (this.aiming) {
      this.updateDrag(e);
      return;
    }
    // hover feedback for portal placement
    if (!this.updateNdc(e)) return;
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

  updateDrag(e) {
    if (!this.updateNdc(e)) return;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this._v);
    if (!hit) return;

    // direction comes from where the pointer sits on the court plane (true 3D),
    // power comes from screen distance so the hand-feel is identical on every
    // level regardless of camera distance
    const pull = this._v.sub(this.anchor);
    pull.y = 0;
    if (pull.lengthSq() < 1e-6) return;
    pull.normalize();
    const rect = this.dom.getBoundingClientRect();
    const px = Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y);
    let len = Math.min(1, px / (0.36 * rect.height)) * SLING.maxPull;
    pull.multiplyScalar(len);

    // don't let the ball be dragged through geometry
    if (len > 0.01 && this.blockerMeshes.length) {
      this.raycaster.set(this.anchor, this._v2.copy(pull).normalize());
      this.raycaster.far = len + PHYS.ballRadius;
      const block = this.raycaster.intersectObjects(this.blockerMeshes, false);
      if (block.length) {
        len = Math.max(0, block[0].distance - PHYS.ballRadius - 0.05);
        pull.setLength(len);
      }
      this.raycaster.far = Infinity;
    }

    this.dragPoint.copy(this.anchor).add(pull);
    this.ball.state.pos.copy(this.dragPoint);

    const p = len / SLING.maxPull;
    this.validAim = len >= SLING.minPull;

    if (this.validAim) {
      // fling opposite the pull: hard = flat, soft = arcing
      const theta = THREE.MathUtils.degToRad(
        SLING.thetaSoft + (SLING.thetaHard - SLING.thetaSoft) * p
      );
      const speed = SLING.minSpeed + (SLING.maxSpeed - SLING.minSpeed) * p;
      this._v.copy(pull).multiplyScalar(-1 / (len || 1)); // unit, opposite pull
      this.launchVel
        .copy(this._v)
        .multiplyScalar(Math.cos(theta) * speed)
        .setY(Math.sin(theta) * speed);
    }

    // band
    this.band.visible = true;
    const bp = this.band.geometry.attributes.position;
    bp.setXYZ(0, this.anchor.x, this.anchor.y, this.anchor.z);
    bp.setXYZ(1, this.dragPoint.x, this.dragPoint.y, this.dragPoint.z);
    bp.needsUpdate = true;
    const stretch = len / SLING.maxPull;
    this.band.material.opacity = 0.35 + stretch * 0.6;

    this.updatePreview();
  }

  pointerUp(e) {
    if (!this.enabled) return;
    if (this.aiming) {
      this.aiming = false;
      this.controls.enabled = true;
      this.clearAimVisuals();
      this.dom.style.cursor = 'default';
      this.onAimEnd();
      if (this.validAim) {
        this.onShoot(this.launchVel.clone());
      } else {
        // spring back
        this.ball.state.pos.copy(this.anchor);
      }
      this.validAim = false;
      return;
    }
    // click (small movement, quick) → place portal
    if (e.button !== 0) return;
    const dx = e.clientX - this.start.x, dy = e.clientY - this.start.y;
    if (Math.hypot(dx, dy) > 6 || performance.now() - this.start.t > 400) return;
    if (!this.updateNdc(e)) return;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.portalMeshes, false);
    if (hits.length) {
      const h = hits[0];
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
      this.onPlacePortal(h.point, n, h.object.userData.colliderId);
    }
  }

  clearAimVisuals() {
    this.dots.count = 0;
    this.dots.instanceMatrix.needsUpdate = true;
    this.band.visible = false;
    this.anchorRing.visible = false;
    this.landing.visible = false;
  }

  updatePreview() {
    if (!this.validAim || !this.world) {
      this.dots.count = 0;
      this.dots.instanceMatrix.needsUpdate = true;
      this.landing.visible = false;
      return;
    }
    const sim = this._sim;
    sim.pos.copy(this.dragPoint);
    sim.vel.copy(this.launchVel);
    sim.cooldown = 0;

    const dt = 1 / 90;
    let dot = 0;
    let hits = 0;
    let landingSet = false;
    let scored = false;
    for (let i = 0; i < 340 && dot < MAX_DOTS; i++) {
      const res = stepPhysics(sim, dt, this.world);
      if (res.scored) scored = true;
      if (i % 3 === 0 || res.teleported) {
        const s = 1 - (dot / MAX_DOTS) * 0.6;
        this._m.makeScale(s, s, s).setPosition(sim.pos);
        this.dots.setMatrixAt(dot++, this._m);
      }
      if (res.hit) {
        if (!landingSet) {
          landingSet = true;
          this.landing.position.copy(sim.pos).addScaledVector(res.hit.normal, 0.02);
          this.landing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), res.hit.normal);
          this.landing.visible = true;
        }
        if (++hits >= 2) break;
      }
      if (scored && sim.pos.y < this.world.hoop.rimCenter.y - 0.6) break;
    }
    this.landing.material.color.setHex(scored ? COLORS.gold : COLORS.cyan);
    this.dots.material.color.setHex(scored ? COLORS.gold : 0xcffcff);
    this.dots.count = dot;
    this.dots.instanceMatrix.needsUpdate = true;
  }
}
