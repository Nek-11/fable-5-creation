// The wall of churning snow that chases the rider.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";
import { terrainHeight } from "./terrain.js";
import { valueNoise } from "./noise.js";
import { makePuffTexture } from "./snowfx.js";

const BOULDER_COUNT = 90;
const MIST_COUNT = 320;

export class Avalanche {
  constructor(scene) {
    // Rolling snow boulders across the whole slope width.
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf7fbff,
      roughness: 0.65,
      emissive: 0xdfeeff,
      emissiveIntensity: 0.25,
      flatShading: true,
    });
    this.boulders = new THREE.InstancedMesh(geo, mat, BOULDER_COUNT);
    this.boulders.frustumCulled = false;
    scene.add(this.boulders);

    this.params = [];
    for (let i = 0; i < BOULDER_COUNT; i++) {
      const row = i % 3;
      this.params.push({
        x: ((i / BOULDER_COUNT) * 2 - 1) * (C.TERRAIN_WIDTH / 2) + (Math.random() - 0.5) * 8,
        zoff: row * 9 + Math.random() * 7,
        r: 4.5 + Math.random() * 6.5,
        phase: Math.random() * 100,
        rollSpeed: 1.5 + Math.random() * 2,
      });
    }

    // Mist plume above the front.
    const mistGeo = new THREE.BufferGeometry();
    this.mistSeeds = [];
    const mistPos = new Float32Array(MIST_COUNT * 3);
    for (let i = 0; i < MIST_COUNT; i++) {
      this.mistSeeds.push({
        x: (Math.random() * 2 - 1) * (C.TERRAIN_WIDTH / 2),
        zoff: Math.random() * 34,
        yoff: Math.random() * 22,
        phase: Math.random() * 100,
      });
    }
    mistGeo.setAttribute("position", new THREE.BufferAttribute(mistPos, 3));
    this.mist = new THREE.Points(
      mistGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 5.5,
        map: makePuffTexture(),
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.mist.frustumCulled = false;
    scene.add(this.mist);

    this.dummy = new THREE.Object3D();
    this.reset();
  }

  reset() {
    this.frontZ = C.AV_START_GAP; // player starts at z = 0, wall behind (+z)
    this.time = 0;
  }

  get gapTo() {
    return this.frontZ; // callers pass player z and subtract
  }

  gap(playerZ) {
    return this.frontZ - playerZ;
  }

  update(dt, playerZ, playerSpeed, distance) {
    this.time += dt;
    let speed = C.AV_BASE_SPEED + distance * C.AV_RAMP;
    // rubber band: never let it fall hopelessly behind
    if (this.frontZ - playerZ > C.AV_MAX_GAP) speed = Math.max(speed, playerSpeed + 2);
    this.frontZ -= speed * dt;

    // place boulders along the front, hugging the terrain
    for (let i = 0; i < BOULDER_COUNT; i++) {
      const p = this.params[i];
      const wob = valueNoise(p.phase, this.time * 1.5) * 6;
      const z = this.frontZ + p.zoff + wob;
      const x = p.x + Math.sin(this.time * 2 + p.phase) * 2;
      const y = terrainHeight(x, z) + p.r * 0.45 + Math.sin(this.time * 6 + p.phase) * 1.2;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(this.time * p.rollSpeed + p.phase, p.phase, 0);
      this.dummy.scale.setScalar(p.r);
      this.dummy.updateMatrix();
      this.boulders.setMatrixAt(i, this.dummy.matrix);
    }
    this.boulders.instanceMatrix.needsUpdate = true;

    const pos = this.mist.geometry.attributes.position;
    for (let i = 0; i < MIST_COUNT; i++) {
      const s = this.mistSeeds[i];
      const z = this.frontZ + s.zoff - 6;
      const rise = (this.time * 6 + s.phase * 13) % 24;
      const y = terrainHeight(s.x, z) + 3 + s.yoff * 0.4 + rise;
      pos.setXYZ(i, s.x + Math.sin(this.time + s.phase) * 3, y, z);
    }
    pos.needsUpdate = true;
  }
}
