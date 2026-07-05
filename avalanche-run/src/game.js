// Game orchestration: state machine, input, camera, collisions, scoring.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";
import { Terrain, terrainHeight } from "./terrain.js";
import { Obstacles } from "./obstacles.js";
import { Player } from "./player.js";
import { Avalanche } from "./avalanche.js";
import { SnowFX } from "./snowfx.js";
import { UI } from "./ui.js";

const BEST_KEY = "avalanche-run-best";

export class Game {
  constructor(scene, camera, sunLight, audio) {
    this.scene = scene;
    this.camera = camera;
    this.sun = sunLight;
    this.audio = audio;

    this.terrain = new Terrain(scene);
    this.obstacles = new Obstacles(scene);
    this.player = new Player(scene);
    this.avalanche = new Avalanche(scene);
    this.snowfx = new SnowFX(scene);
    this.ui = new UI();

    this.state = "menu";
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.keys = {};
    this.shake = 0;
    this.time = 0;
    this.nextMilestone = 500;

    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.smoothHeading = 0;

    this.bindInput();
    this.resetWorld();
    this.ui.showStart();
    this.snapCamera();
  }

  bindInput() {
    window.addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(e.code))
        e.preventDefault();
      this.keys[e.code] = true;
      if (e.code === "Space") this.onAction();
      if (e.code === "KeyR" && this.state === "dead") this.onAction();
    });
    window.addEventListener("keyup", (e) => (this.keys[e.code] = false));

    // minimal touch: left/right half steers, whole-screen tap starts
    let touchX = null;
    window.addEventListener("touchstart", (e) => {
      this.onAction();
      touchX = e.touches[0].clientX;
    });
    window.addEventListener("touchmove", (e) => (touchX = e.touches[0].clientX));
    window.addEventListener("touchend", () => (touchX = null));
    this.getTouchSteer = () => {
      if (touchX === null) return 0;
      return touchX < window.innerWidth / 2 ? -1 : 1;
    };
  }

  onAction() {
    this.audio.init();
    if (this.state === "menu" || this.state === "dead") {
      clearTimeout(this.deathTimer);
      this.resetWorld();
      this.state = "run";
      this.ui.showRun();
      this.ui.setWhiteout(0);
    }
  }

  resetWorld() {
    this.terrain.reset();
    this.obstacles.reset(this.terrain);
    this.player.reset();
    this.avalanche.reset();
    this.shake = 0;
    this.nextMilestone = 500;
    this.smoothHeading = 0;
  }

  snapCamera() {
    const p = this.player.pos;
    this.camPos.set(p.x, p.y + C.CAM_UP, p.z + C.CAM_BACK);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(p.x, p.y + 1, p.z - 8);
  }

  readInput() {
    let steer = 0;
    if (this.keys.ArrowLeft || this.keys.KeyA) steer -= 1;
    if (this.keys.ArrowRight || this.keys.KeyD) steer += 1;
    if (steer === 0) steer = this.getTouchSteer();
    const jumpNow = !!(this.keys.Space || this.keys.ArrowUp || this.keys.KeyW);
    const jump = jumpNow && !this.prevJump;
    this.prevJump = jumpNow;
    return {
      steer,
      tuck: !!(this.keys.ArrowDown || this.keys.KeyS),
      jump,
    };
  }

  update(dt) {
    this.time += dt;
    const p = this.player;

    if (this.state === "run") {
      const input = this.readInput();
      p.update(dt, input, {
        onJump: () => this.audio.jump(),
        onLand: (vy) => {
          this.audio.land(vy < -12);
          this.spray(10, 6);
          if (vy < -10) this.shake = Math.max(this.shake, 0.25);
        },
        onTrick: (deg) => {
          this.audio.trick();
          this.ui.popTrick(`${deg}° — nice!`);
          this.spray(16, 8);
        },
        onTumble: (why) => {
          this.audio.crash();
          this.ui.popTrick(why);
          this.shake = Math.max(this.shake, 0.6);
          this.spray(24, 10);
        },
      });

      // obstacle collision
      if (!p.airborne && p.invulnT <= 0 && !p.tumbling) {
        const hit = this.obstacles.collide(p.pos.x, p.pos.z, p.pos.y, 0.7);
        if (hit) {
          p.startTumble();
          this.audio.crash();
          this.ui.popTrick("wipeout!");
          this.shake = Math.max(this.shake, 0.7);
          this.spray(28, 12);
        }
      }

      // carve spray + sound
      const carving = !p.airborne && Math.abs(input.steer) > 0 && !p.tumbling;
      if (carving && Math.random() < 0.8) this.spray(2, 4);
      if (p.tumbling && Math.random() < 0.5) this.spray(3, 5);

      const dist = -p.pos.z;
      this.avalanche.update(dt, p.pos.z, p.speed, dist);
      const gap = this.avalanche.gap(p.pos.z);

      // audio layers
      this.audio.setLayers({
        speed: p.speed / (C.MAX_SPEED + C.TUCK_BONUS),
        carve: carving ? Math.abs(input.steer) * (p.speed / C.MAX_SPEED) : 0,
        rumble: Math.max(Math.min(1 - gap / (C.AV_PANIC_GAP * 3), 1), 0.06),
      });

      // proximity effects
      const panic = Math.max(Math.min(1 - gap / C.AV_PANIC_GAP, 1), 0);
      this.ui.setWhiteout(panic * 0.65);
      if (panic > 0) this.shake = Math.max(this.shake, panic * 0.35);

      // caught?
      if (gap <= C.AV_CAUGHT_GAP) {
        this.state = "dead";
        this.audio.buried();
        this.ui.setWhiteout(1);
        const isNewBest = dist > this.best;
        if (isNewBest) {
          this.best = Math.floor(dist);
          localStorage.setItem(BEST_KEY, String(this.best));
        }
        this.deathTimer = setTimeout(() => {
          this.ui.setWhiteout(0.25);
          this.ui.showDeath(dist, this.best, isNewBest);
        }, 900);
      }

      // milestones
      if (dist >= this.nextMilestone) {
        this.ui.popMilestone(`${this.nextMilestone} m`);
        this.audio.milestone();
        this.nextMilestone += 500;
      }

      this.ui.update(
        dist,
        this.best,
        p.speed / (C.MAX_SPEED + C.TUCK_BONUS),
        gap / C.AV_MAX_GAP,
      );

      // world recycling
      const rebuilt = this.terrain.update(p.pos.z, this.time);
      if (rebuilt.length) this.obstacles.repopulate(this.terrain, rebuilt);
    } else {
      // menu/death: world idles, avalanche still churns for the backdrop
      this.avalanche.update(dt, p.pos.z, 0, -p.pos.z);
      this.terrain.uniforms.uTime.value = this.time;
      this.audio.setLayers({ speed: 0.05, carve: 0, rumble: 0.12 });
    }

    this.updateCamera(dt);
    this.snowfx.update(dt, this.camera.position);

    // sun + shadow frustum follow the player
    this.sun.position.set(p.pos.x + 45, p.pos.y + 65, p.pos.z + 30);
    this.sun.target.position.copy(p.pos);
    this.sun.target.updateMatrixWorld();
  }

  spray(count, power) {
    const p = this.player;
    const dir = new THREE.Vector3(-Math.sin(p.heading), 0, Math.cos(p.heading));
    this.snowfx.emitSpray(p.pos, dir, count, power);
  }

  updateCamera(dt) {
    const p = this.player;
    this.smoothHeading = THREE.MathUtils.lerp(
      this.smoothHeading,
      p.heading,
      1 - Math.exp(-3.5 * dt),
    );
    const back = new THREE.Vector3(
      Math.sin(this.smoothHeading),
      0,
      -Math.cos(this.smoothHeading),
    ).multiplyScalar(-C.CAM_BACK);

    const desired = new THREE.Vector3().copy(p.pos).add(back);
    desired.y = p.pos.y + C.CAM_UP;
    // never let the camera clip under the snow
    const ground = terrainHeight(desired.x, desired.z);
    desired.y = Math.max(desired.y, ground + 1.6);

    this.camPos.lerp(desired, 1 - Math.exp(-6 * dt));

    // shake
    this.shake = Math.max(this.shake - dt * 1.2, 0);
    const sh = this.shake * this.shake;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * sh * 1.6,
      this.camPos.y + (Math.random() - 0.5) * sh * 1.2,
      this.camPos.z + (Math.random() - 0.5) * sh * 1.6,
    );

    // aim at a point down the slope so the camera pitches with the descent
    const lx = p.pos.x + Math.sin(this.smoothHeading) * 10;
    const lz = p.pos.z - Math.cos(this.smoothHeading) * 10;
    const ly = Math.min(terrainHeight(lx, lz) + 2.2, p.pos.y + 1.2);
    this.camTarget.lerp(new THREE.Vector3(lx, ly, lz), 1 - Math.exp(-8 * dt));
    this.camera.lookAt(this.camTarget);

    // speed-based FOV kick
    const frac = (p.speed - C.START_SPEED) / (C.MAX_SPEED + C.TUCK_BONUS - C.START_SPEED);
    const targetFov = THREE.MathUtils.lerp(
      C.CAM_FOV,
      C.CAM_FOV_FAST,
      Math.max(Math.min(frac, 1), 0),
    );
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(
        this.camera.fov,
        targetFov,
        1 - Math.exp(-4 * dt),
      );
      this.camera.updateProjectionMatrix();
    }
  }
}
