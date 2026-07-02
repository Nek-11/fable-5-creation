// Storm cycle (clear -> warning -> rain), rain streaks, paper clouds,
// and sky/fog/light dimming.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";
import { mulberry32 } from "./paper.js";

const RAIN_COUNT = 700;
const RAIN_AREA = 70;
const CLOUD_COUNT = 11;

const SKY_CLEAR = new THREE.Color(C.SKY_CLEAR);
const SKY_STORM = new THREE.Color(C.SKY_STORM);
const CLOUD_WHITE = new THREE.Color(0xfbf8ef);
const CLOUD_DARK = new THREE.Color(0x8d97a1);

export class Weather {
  constructor(scene, dirLight, hemiLight) {
    this.scene = scene;
    this.dirLight = dirLight;
    this.hemiLight = hemiLight;

    this.phase = "clear"; // clear | warning | storm
    this.timer = C.CLEAR_MIN * 0.6; // first storm arrives a bit sooner
    this.intensity = 0; // 0..1 rain strength
    this.gustX = 0;
    this.time = 0;

    // --- rain streaks ---
    const positions = new Float32Array(RAIN_COUNT * 2 * 3);
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0x8fa8bd,
      transparent: true,
      opacity: 0,
    });
    this.rain = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    this.drops = [];
    const rng = mulberry32(99);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.drops.push({
        x: (rng() - 0.5) * RAIN_AREA * 2,
        y: rng() * 90 - 30,
        z: (rng() - 0.5) * RAIN_AREA * 2,
        speed: 55 + rng() * 25,
      });
    }

    // --- paper clouds ---
    this.cloudMat = new THREE.MeshStandardMaterial({
      color: CLOUD_WHITE.clone(),
      flatShading: true,
      roughness: 1,
      emissive: 0x585c62, // lift the unlit undersides so clouds stay papery
    });
    this.clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cloud = new THREE.Group();
      const blobs = 3 + Math.floor(rng() * 3);
      for (let b = 0; b < blobs; b++) {
        const size = 6 + rng() * 9;
        const blob = new THREE.Mesh(
          new THREE.IcosahedronGeometry(size, 0),
          this.cloudMat,
        );
        blob.position.set(
          (rng() - 0.5) * 22,
          (rng() - 0.5) * 5,
          (rng() - 0.5) * 12,
        );
        blob.scale.y = 0.55;
        cloud.add(blob);
      }
      cloud.position.set(
        (rng() - 0.5) * 700,
        85 + rng() * 50,
        (rng() - 0.5) * 700,
      );
      cloud.userData.drift = 1.5 + rng() * 2;
      scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  update(dt, playerPos) {
    this.time += dt;

    // --- state machine ---
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.phase === "clear") {
        this.phase = "warning";
        this.timer = C.WARN_TIME;
      } else if (this.phase === "warning") {
        this.phase = "storm";
        this.timer = C.STORM_MIN + Math.random() * C.STORM_VAR;
      } else {
        this.phase = "clear";
        this.timer = C.CLEAR_MIN + Math.random() * C.CLEAR_VAR;
      }
    }

    const target = this.phase === "storm" ? 1 : 0;
    this.intensity += (target - this.intensity) * Math.min(1, dt * 0.9);

    // side-gusts during storms
    this.gustX =
      this.intensity *
      (Math.sin(this.time * 0.7) + Math.sin(this.time * 1.9) * 0.5) *
      2.2;

    // --- sky / fog / light dimming ---
    this.scene.background.copy(SKY_CLEAR).lerp(SKY_STORM, this.intensity);
    this.scene.fog.color.copy(this.scene.background);
    this.dirLight.intensity = THREE.MathUtils.lerp(2.4, 1.1, this.intensity);
    this.hemiLight.intensity = THREE.MathUtils.lerp(1.0, 0.55, this.intensity);
    this.cloudMat.color.copy(CLOUD_WHITE).lerp(CLOUD_DARK, this.intensity);

    // --- rain ---
    this.rain.visible = this.intensity > 0.02;
    this.rainMat.opacity = this.intensity * 0.55;
    if (this.rain.visible) {
      const pos = this.rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const d = this.drops[i];
        d.y -= d.speed * dt;
        if (playerPos.y + d.y - 30 < 0 || d.y < -50) {
          d.y = 45 + Math.random() * 15;
          d.x = (Math.random() - 0.5) * RAIN_AREA * 2;
          d.z = (Math.random() - 0.5) * RAIN_AREA * 2;
        }
        const wx = playerPos.x + d.x;
        const wy = playerPos.y + d.y - 30;
        const wz = playerPos.z + d.z;
        const j = i * 6;
        pos[j] = wx;
        pos[j + 1] = wy;
        pos[j + 2] = wz;
        pos[j + 3] = wx + this.gustX * 0.04;
        pos[j + 4] = wy - 1.6;
        pos[j + 5] = wz;
      }
      this.rainGeo.attributes.position.needsUpdate = true;
    }

    // --- clouds drift + wrap around the player ---
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.drift * dt;
      const dx = cloud.position.x - playerPos.x;
      const dz = cloud.position.z - playerPos.z;
      if (dx > 420) cloud.position.x -= 840;
      if (dx < -420) cloud.position.x += 840;
      if (dz > 420) cloud.position.z -= 840;
      if (dz < -420) cloud.position.z += 840;
    }
  }

  isRaining() {
    return this.intensity > 0.45;
  }
}
