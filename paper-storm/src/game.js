// Game orchestration: states, input, camera, scoring, crash handling.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";
import { Plane } from "./plane.js";
import { City } from "./city.js";
import { Weather } from "./weather.js";
import { Birds } from "./birds.js";
import { Effects } from "./effects.js";
import { UI } from "./ui.js";
import { AudioSys } from "./audio.js";

const BEST_KEY = "paper-storm-best";

export class Game {
  constructor(scene, camera, dirLight, hemiLight) {
    this.scene = scene;
    this.camera = camera;
    this.dirLight = dirLight;

    this.plane = new Plane(scene);
    this.city = new City(scene);
    this.weather = new Weather(scene, dirLight, hemiLight);
    this.birds = new Birds(scene);
    this.effects = new Effects(scene);
    this.ui = new UI();
    this.audio = new AudioSys();

    this.state = "menu"; // menu | flying | crashing | crashed
    this.distance = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.nextMilestone = 250;
    this.crashTimer = 0;
    this.crashReason = "";
    this.shake = 0;
    this.snipCooldown = 0;
    this.menuTime = 0;

    this.keys = new Set();
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    this.camPos = new THREE.Vector3();
    this.camUp = new THREE.Vector3(0, 1, 0);

    this.city.update(this.plane.pos);
    this.ui.showStart();
  }

  onKeyDown(e) {
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        e.code,
      )
    ) {
      e.preventDefault();
    }
    this.keys.add(e.code);
    if (e.code === "Space") {
      if (this.state === "menu" || this.state === "crashed") this.startFlight();
    }
  }

  startFlight() {
    this.audio.ensure();
    this.plane.reset();
    this.birds.reset();
    this.effects.reset();
    this.distance = 0;
    this.nextMilestone = 250;
    this.state = "flying";
    // snap the chase camera straight into place behind the plane
    this.camPos
      .copy(this.plane.pos)
      .addScaledVector(this.plane.forward, -9.5)
      .add(new THREE.Vector3(0, 3.2, 0));
    this.ui.showFlying(this.best);
  }

  readInput() {
    const up = this.keys.has("ArrowUp") || this.keys.has("KeyW");
    const down = this.keys.has("ArrowDown") || this.keys.has("KeyS");
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
    return {
      pitch: (up ? 1 : 0) - (down ? 1 : 0),
      roll: (left ? 1 : 0) - (right ? 1 : 0),
    };
  }

  crash(reason) {
    this.state = "crashing";
    this.crashReason = reason;
    this.crashTimer = 1.15;
    this.shake = 1;
    this.plane.group.visible = false;
    this.effects.burst(this.plane.pos);
    this.audio.crash();
    this.audio.quiet();
    if (this.distance > this.best) {
      this.best = this.distance;
      localStorage.setItem(BEST_KEY, String(Math.floor(this.best)));
      this.isNewBest = true;
    } else {
      this.isNewBest = false;
    }
  }

  update(dt) {
    this.weather.update(dt, this.plane.pos);
    this.effects.update(dt);

    if (this.state === "menu" || this.state === "crashed") {
      this.updateMenuCamera(dt);
      return;
    }

    if (this.state === "crashing") {
      this.crashTimer -= dt;
      this.shake = Math.max(0, this.shake - dt * 1.6);
      if (this.crashTimer <= 0) {
        this.state = "crashed";
        this.ui.showCrash(
          this.crashReason,
          this.distance,
          this.best,
          this.isNewBest,
        );
      }
      this.applyCamera(dt, true);
      return;
    }

    // --- flying ---
    const env = {
      updraft: this.city.updraftAt(this.plane.pos),
      raining: this.weather.isRaining(),
      gustX: this.weather.gustX,
    };
    this.plane.update(dt, this.readInput(), env);
    this.city.update(this.plane.pos);
    this.effects.updateUpdrafts(
      dt,
      this.city.nearbyVents(this.plane.pos, 150),
      this.plane.pos,
    );

    // scoring: horizontal meters flown
    this.distance += this.plane.horizontalSpeed() * dt;
    if (this.distance >= this.nextMilestone) {
      this.ui.showMilestone(`${this.nextMilestone} m!`);
      this.audio.milestone();
      this.nextMilestone += 250;
    }

    // birds
    const birdInfo = this.birds.update(dt, this.plane, this.distance);
    this.snipCooldown -= dt;
    if (birdInfo.nearestDist < 12 && this.snipCooldown <= 0) {
      this.audio.snip();
      this.snipCooldown = 0.9;
    }

    // audio follows flight
    this.audio.setWind(this.plane.speed / C.MAX_SPEED);
    this.audio.setRain(this.weather.intensity);

    // --- collisions ---
    if (this.plane.pos.y < C.CRASH_ALTITUDE) {
      this.plane.pos.y = C.CRASH_ALTITUDE;
      this.crash("ground");
    } else if (this.city.collide(this.plane.pos, 0.9)) {
      this.crash("building");
    } else if (birdInfo.hit) {
      this.crash("bird");
    }

    this.ui.update({
      distance: this.distance,
      speed: this.plane.speed,
      altitude: this.plane.pos.y,
      wetness: this.plane.wetness,
      weatherPhase: this.weather.phase,
      birdsChasing: this.birds.hasChasers(),
    });

    this.applyCamera(dt, false);
    this.updateLight();
  }

  applyCamera(dt, crashed) {
    const p = this.plane;
    const target = crashed
      ? this.camPos // freeze position, keep looking at the wreck
      : p.pos
          .clone()
          .addScaledVector(p.forward, -9.5)
          .add(new THREE.Vector3(0, 3.2, 0));

    if (!crashed) {
      this.camPos.lerp(target, Math.min(1, dt * 4.5));
    }

    // shake on impact
    const shakeOff = new THREE.Vector3(
      (Math.random() - 0.5) * this.shake * 1.4,
      (Math.random() - 0.5) * this.shake * 1.4,
      0,
    );

    this.camera.position.copy(this.camPos).add(shakeOff);

    // tilt the horizon with the bank
    this.camUp.set(0, 1, 0).applyAxisAngle(p.forward, -p.roll * 0.28);
    this.camera.up.copy(this.camUp);

    const lookAt = crashed
      ? p.pos
      : p.pos.clone().addScaledVector(p.forward, 6);
    this.camera.lookAt(lookAt);
  }

  updateMenuCamera(dt) {
    this.menuTime += dt;
    // sway gently on the open (-Z) side of the tower so it never blocks the view
    const a = Math.PI + Math.sin(this.menuTime * 0.17) * 0.55;
    const center = new THREE.Vector3(0, 54, 2);
    this.camera.position.set(
      center.x + Math.sin(a) * 30,
      center.y + 4 + Math.sin(this.menuTime * 0.4) * 2,
      center.z + Math.cos(a) * 30,
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(center);

    // the plane bobs at the office window, waiting to be thrown
    this.plane.group.visible = true;
    this.plane.group.position.set(
      C.START_POS.x,
      C.START_POS.y + Math.sin(this.menuTime * 1.4) * 0.5,
      C.START_POS.z,
    );
    this.plane.group.rotation.set(
      Math.sin(this.menuTime * 0.9) * 0.06,
      0,
      Math.sin(this.menuTime * 1.1) * 0.08,
    );
    this.updateLight();
  }

  updateLight() {
    // keep the shadow frustum centered on the action
    const p = this.plane.group.position;
    this.dirLight.position.set(p.x + 45, p.y + 65, p.z + 30);
    this.dirLight.target.position.copy(p);
    this.dirLight.target.updateMatrixWorld();
  }
}
