import * as THREE from 'three';
import { CONFIG } from './config.js';
import { PALETTE } from './flora.js';

const PL = CONFIG.player;
const RT = CONFIG.rot;
const FL = CONFIG.flora;

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();

const GREY = new THREE.Color('#8fa3a0');

export class Game {
  constructor({ planet, flora, rot, player, effects, ui, audio, camera, canvas }) {
    Object.assign(this, { planet, flora, rot, player, effects, ui, audio, camera, canvas });

    this.state = 'title';
    this.time = 0;
    this.sourcesDirty = true;

    this.seeds = PL.seedStart;
    this.seedTimer = 0;
    this.burstCd = 0;
    this.radianceTimer = 0;
    this.rotSpawnTimer = RT.spawnIntervalStart;
    this.surgeTimer = RT.surgeEvery;
    this.hintStep = 0;

    this.input = { keys: {} };
    this.bindInput();

    // context handed to subsystems
    this.ctx = {
      effects,
      markSourcesDirty: () => { this.sourcesDirty = true; },
      onBloomMature: (p) => {
        effects.sparkleBurst(p.pos.clone().addScaledVector(p.dir, 1.5), PALETTE[p.colorIdx], 10, 1.6, 0.7);
        audio.bloom();
      },
      onFloraDeath: (p) => {
        effects.sparkleBurst(p.pos, GREY, 8, 1.2, 0.7, 0.5);
        audio.floraDeath();
      },
      onSporeLaunch: () => audio.sporeLaunch(),
      onSporeLand: (dir, colorIdx) => this.handleSporeLand(dir, colorIdx),
      onRotPurged: (core) => {
        effects.sparkleBurst(core.mesh.position, new THREE.Color('#ff3b57'), 20, 3.2, 0.9, 1.2);
        audio.rotPurged();
      },
    };
  }

  // ------------------------------------------------------------- input ----
  bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.input.keys[e.code] = true;
      if (this.state === 'playing') {
        if (e.code === 'Space') { e.preventDefault(); this.tryPlant(); }
        if (e.code === 'KeyE') this.tryBurst();
      }
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
    });
    window.addEventListener('keyup', (e) => { this.input.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.input.keys = {}; });

    // drag to orbit the camera
    this.dragging = false;
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.dragging && this.state === 'playing') {
        this.player.yawOffset -= e.movementX * 0.006;
      }
    });
    const endDrag = () => { this.dragging = false; };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);

    document.getElementById('btn-start').addEventListener('click', () => this.begin());
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.audio.uiClick();
      this.ui.hideEnd();
      this.begin();
    });
    this.ui.muteBtn.addEventListener('click', () => this.toggleMute());
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    this.ui.setMuted(this.audio.muted);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.ui.showPause(true);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.ui.showPause(false);
    }
  }

  // ------------------------------------------------------------- flow -----
  begin() {
    this.audio.ensure();
    this.audio.startAmbient();
    this.audio.uiClick();

    // reset world
    this.planet.reset();
    this.flora.reset();
    this.rot.reset();

    this.time = 0;
    this.seeds = PL.seedStart;
    this.seedTimer = 0;
    this.burstCd = 0;
    this.radianceTimer = 0;
    this.rotSpawnTimer = RT.spawnIntervalStart;
    this.surgeTimer = RT.surgeEvery;
    this.hintStep = 0;
    this.sourcesDirty = true;

    // player spawns on a random spot; keep current camera for a swoop-in
    const spawn = new THREE.Vector3(0.2, 0.35, 1).normalize();
    this.player.camPosSmooth = this.camera.position.clone();
    this.player.reset(spawn);

    // a first bloom waits just ahead of the gardener
    _dir.copy(spawn).applyAxisAngle(_v.set(1, 0, 0).cross(spawn).normalize(), 3.2 / CONFIG.planet.radius);
    this.flora.plant(_dir);

    // the rot wakes, scattered across the far hemisphere
    for (let i = 0; i < RT.initialCores; i++) {
      _dir.copy(spawn).negate();
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(_dir).normalize();
      _dir.applyAxisAngle(_v, (3 + Math.random() * 12) / CONFIG.planet.radius);
      this.rot.spawn(_dir);
    }

    this.ui.showTitle(false);
    this.ui.showHUD(true);
    this.ui.hint('walk with WASD — plant your first seed with SPACE');
    this.state = 'playing';
  }

  end(won) {
    this.state = 'ended';
    if (won) this.audio.win(); else this.audio.lose();
    setTimeout(() => {
      this.ui.showHUD(false);
      this.ui.showEnd(won, {
        time: this.time,
        blooms: this.flora.bloomCount,
        purged: this.rot.purged,
      });
    }, won ? 1400 : 1000);
  }

  // ------------------------------------------------------------- actions --
  tryPlant() {
    if (this.seeds <= 0) {
      this.ui.toast('no seeds — they regrow with time', 'danger', 1800);
      return;
    }
    // plant slightly ahead of the gardener
    _v.copy(this.player.worldPos).addScaledVector(this.player.facing, 1.7);
    _dir.copy(_v).normalize();

    if (!this.flora.canPlantAt(_dir)) {
      this.ui.toast('too crowded here', '', 1600);
      return;
    }
    if (this.planet.fieldAt(_dir) < -0.3) {
      this.ui.toast('the ground is too rotten — purge it first (E)', 'danger', 2200);
      return;
    }

    const p = this.flora.plant(_dir);
    if (!p) return;
    this.seeds--;
    this.sourcesDirty = true;
    this.audio.plantSeed();
    this.effects.sparkleBurst(p.pos, PALETTE[p.colorIdx], 12, 1.8, 0.7);

    if (this.hintStep === 0) {
      this.hintStep = 1;
      this.ui.hint('blooms fire spores that arc through gravity and seed new blooms');
    }
  }

  tryBurst() {
    if (this.burstCd > 0) return;
    this.burstCd = PL.burstCooldown;

    const pos = this.player.worldPos.clone();
    _dir.copy(pos).normalize();

    this.effects.spawnBurst(pos, PL.burstRadius * 1.15);
    this.effects.sparkleBurst(pos, new THREE.Color('#7dffd0'), 26, 4.5, 1.0, 1.3);
    this.planet.splash(_dir, PL.burstRadius, PL.burstBoost);
    const hits = this.rot.damageWithin(_dir, PL.burstRadius, 2.0, this.ctx);
    this.player.shake = 0.7;
    this.ui.flashScreen('burst');
    this.audio.burst();
    if (hits > 0) this.ui.toast(`rot seared ×${hits}`, 'good', 1600);
  }

  handleSporeLand(dir, colorIdx) {
    const surf = this.planet.surfaceRadius(dir);
    _v.copy(dir).multiplyScalar(surf);
    const field = this.planet.fieldAt(dir);

    if (field > -0.3 && Math.random() < FL.sproutChance && this.flora.canPlantAt(dir)) {
      this.flora.plant(dir, colorIdx);
      this.sourcesDirty = true;
      this.audio.sporeLand();
      this.effects.sparkleBurst(_v, PALETTE[colorIdx], 9, 1.5, 0.6);
      if (this.hintStep === 1) {
        this.hintStep = 2;
        this.ui.hint('surround the rot with light to suffocate it — or sear it with E');
      }
    } else {
      this.effects.sparkleBurst(_v, GREY, 5, 0.9, 0.4, 0.5);
    }
  }

  // ------------------------------------------------------------- update ---
  update(dt) {
    if (this.state === 'title') return;
    if (this.state === 'paused') return;
    const playing = this.state === 'playing';

    this.time += dt;
    const t = this.time;

    if (playing) {
      this.player.update(dt, t, this.input);

      // ease the drag-orbit back behind the player
      if (!this.dragging) {
        this.player.yawOffset *= Math.max(0, 1 - dt * 2.2);
      }

      // seeds regen
      if (this.seeds < PL.seedMax) {
        this.seedTimer += dt;
        if (this.seedTimer >= PL.seedRegen) {
          this.seedTimer = 0;
          this.seeds++;
        }
      } else this.seedTimer = 0;

      // burst cooldown
      this.burstCd = Math.max(0, this.burstCd - dt);

      // rot spawning, ramping up over time — and angrier the more the garden grows
      this.rotSpawnTimer -= dt;
      if (this.rotSpawnTimer <= 0) {
        const ramp = Math.min(1, t / RT.rampTime);
        const base = RT.spawnIntervalStart + (RT.spawnIntervalMin - RT.spawnIntervalStart) * ramp;
        this.rotSpawnTimer = base * (1 - 0.45 * this.planet.litFraction);
        if (this.rot.trySpread()) this.sourcesDirty = true;
      }

      // periodic surge — the rot lashes out
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) {
        this.surgeTimer = RT.surgeEvery;
        let spawned = 0;
        const n = 2 + Math.floor(this.planet.litFraction * 4);
        for (let i = 0; i < n; i++) if (this.rot.trySpread()) spawned++;
        if (spawned > 0) {
          this.sourcesDirty = true;
          this.ui.toast('⚠ the rot surges', 'danger');
          this.ui.flashScreen('hurt');
          this.player.shake = Math.max(this.player.shake, 0.45);
          this.audio.rotSurge();
        }
      }

      // mature flora radiate — searing nearby rot cores (1 Hz tick)
      this.radianceTimer -= dt;
      if (this.radianceTimer <= 0) {
        this.radianceTimer = 1;
        for (const p of this.flora.plants) {
          if (p.state !== 'alive') continue;
          this.rot.damageWithin(p.dir, FL.radianceReach, FL.radiance, this.ctx);
        }
      }
    }

    // world simulation continues (even during the end cinematic)
    this.flora.update(dt, t, this.ctx);
    this.rot.update(dt, t, this.ctx);

    if (this.sourcesDirty) {
      this.sourcesDirty = false;
      const sources = [];
      this.flora.collectSources(sources);
      this.rot.collectSources(sources);
      this.planet.rebuildInjection(sources);
    }
    this.planet.update(dt, t);
    this.effects.update(dt, t);

    // HUD
    const lit = this.planet.litFraction;
    const rot = this.planet.rotFraction;
    this.ui.setBalance(lit, rot);
    this.ui.setSeeds(this.seeds, this.seedTimer / PL.seedRegen);
    this.ui.setBurst(this.burstCd, PL.burstCooldown);
    this.ui.setClock(t);

    // win / lose
    if (playing && t > 8) {
      if (lit >= CONFIG.goal.winLight) this.end(true);
      else if (rot >= CONFIG.goal.loseRot) this.end(false);
    }
  }

  // slow cinematic orbit while on the title / end screens
  titleCamera(time) {
    const r = 58;
    const a = time * 0.06;
    this.camera.position.set(Math.cos(a) * r, 18 + Math.sin(time * 0.11) * 6, Math.sin(a) * r);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
  }
}
