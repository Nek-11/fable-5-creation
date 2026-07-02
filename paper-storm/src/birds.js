// Scissors-birds: office scissors that fly like gulls and chase the plane.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";

const BLADE_COLOR = 0xb9c0c6;
const HANDLE_COLOR = 0xd6543a;

function bladeGeometry() {
  const geo = new THREE.BufferGeometry();
  // long flat triangle, pivot (rotation point) at origin, tip forward (-Z)
  const verts = new Float32Array([
    0, 0, 0.15,
    0.3, 0, 0.45,
    0, 0, -2.3,
  ]);
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeBirdMesh() {
  const group = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({
    color: BLADE_COLOR,
    flatShading: true,
    roughness: 0.6,
    metalness: 0.15,
    side: THREE.DoubleSide,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: HANDLE_COLOR,
    flatShading: true,
    roughness: 0.9,
  });

  const bladeL = new THREE.Mesh(bladeGeometry(), bladeMat);
  const bladeR = new THREE.Mesh(bladeGeometry(), bladeMat);
  bladeL.position.z = 0.5;
  bladeR.position.z = 0.5;
  group.add(bladeL, bladeR);

  const handleGeo = new THREE.TorusGeometry(0.32, 0.11, 6, 10);
  const handleL = new THREE.Mesh(handleGeo, handleMat);
  const handleR = new THREE.Mesh(handleGeo, handleMat.clone());
  handleL.rotation.x = Math.PI / 2;
  handleR.rotation.x = Math.PI / 2;
  handleL.position.set(-0.3, 0, 1.15);
  handleR.position.set(0.3, 0, 1.15);
  group.add(handleL, handleR);

  return { group, bladeL, bladeR };
}

export class Birds {
  constructor(scene) {
    this.scene = scene;
    this.birds = [];
    this.spawnTimer = C.BIRD_GRACE;
    this.time = 0;
  }

  reset() {
    for (const b of this.birds) this.scene.remove(b.group);
    this.birds = [];
    this.spawnTimer = C.BIRD_GRACE;
  }

  spawn(plane, count) {
    for (let i = 0; i < count; i++) {
      const { group, bladeL, bladeR } = makeBirdMesh();
      const side = Math.random() < 0.5 ? -1 : 1;
      const pos = plane.pos
        .clone()
        .addScaledVector(plane.forward, 55 + Math.random() * 25);
      pos.x += side * (25 + Math.random() * 25);
      pos.y = Math.max(14, plane.pos.y + (Math.random() - 0.5) * 16);
      group.position.copy(pos);
      this.scene.add(group);
      this.birds.push({
        group,
        bladeL,
        bladeR,
        pos,
        vel: new THREE.Vector3(0, 0, -1),
        stamina: C.BIRD_STAMINA + Math.random() * 4,
        flapPhase: Math.random() * Math.PI * 2,
        leaving: false,
      });
    }
  }

  // Returns { hit, nearestDist, spawned } for the frame.
  update(dt, plane, distanceFlown) {
    this.time += dt;
    let spawned = false;

    // spawn cadence tightens as you fly further
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const flock = distanceFlown > 900 && Math.random() < 0.45 ? 2 : 1;
      this.spawn(plane, flock);
      spawned = true;
      const tighten = Math.min(6, distanceFlown / 400);
      this.spawnTimer =
        C.BIRD_INTERVAL_MIN - tighten + Math.random() * C.BIRD_INTERVAL_VAR;
    }

    const chaseSpeed = THREE.MathUtils.clamp(plane.speed * 1.06, 15, 27);
    let hit = false;
    let nearestDist = Infinity;

    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      b.stamina -= dt;
      if (b.stamina <= 0) b.leaving = true;

      // steer: chase the plane's near-future position, or peel away when tired
      const target = b.leaving
        ? b.pos.clone().add(new THREE.Vector3(b.flapPhase - 3, 30, 5))
        : plane.pos.clone().addScaledVector(plane.vel, 0.35);
      const desired = target.sub(b.pos).normalize();
      b.vel.lerp(desired, Math.min(1, 1.7 * dt)).normalize();

      const speed = b.leaving ? chaseSpeed * 0.8 : chaseSpeed;
      b.pos.addScaledVector(b.vel, speed * dt);
      b.pos.y = Math.max(6, b.pos.y);

      // face travel direction, snip the blades
      b.group.position.copy(b.pos);
      b.group.lookAt(b.pos.clone().add(b.vel));
      const flap = 0.12 + Math.abs(Math.sin(this.time * 7 + b.flapPhase)) * 0.45;
      b.bladeL.rotation.y = flap;
      b.bladeR.rotation.y = -flap;

      const d = b.pos.distanceTo(plane.pos);
      nearestDist = Math.min(nearestDist, d);
      if (!b.leaving && d < C.BIRD_KILL_DIST) hit = true;

      if (b.leaving && d > 260) {
        this.scene.remove(b.group);
        this.birds.splice(i, 1);
      }
    }

    return { hit, nearestDist, spawned };
  }

  hasChasers() {
    return this.birds.some((b) => !b.leaving);
  }
}
