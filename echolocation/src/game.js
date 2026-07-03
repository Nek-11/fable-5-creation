// Orchestration: states, input, noise propagation, level flow.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { Level } from './level.js';
import { Pings } from './pings.js';
import { Player } from './player.js';
import { Creature, TYPES } from './creatures.js';
import { Moth } from './moths.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';

export class Game {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.pings = new Pings();
    this.player = new Player(camera);
    this.audio = new AudioEngine();
    this.ui = new UI();

    this.keys = {};
    this.state = 'title';
    this.time = 0;
    this.presence = 0;
    this.pingCd = 0;
    this.shriekCharges = C.SHRIEK_MAX;
    this.shriekRegen = 0;
    this.beaconT = 0;
    this.huntBannerT = 0;

    this.levelIdx = 0;
    this.seeds = [];
    this.level = null;
    this.creatures = [];
    this.moths = [];
    this.mothCount = 0;
    this.unlocked = false;

    this.bindEvents();
    this.ui.showScreen('title');
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (this.state !== 'playing') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.ping();
      }
      if (e.code === 'KeyE') this.shriek();
    });
    window.addEventListener('keyup', (e) => (this.keys[e.code] = false));
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousedown', (e) => {
      this.audio.ensure();
      switch (this.state) {
        case 'title':
          this.startRun();
          break;
        case 'inter':
          this.nextLevel();
          break;
        case 'dead':
          this.retryLevel();
          break;
        case 'won':
          this.setState('title');
          break;
        case 'pause':
          this.requestLock();
          break;
        case 'playing':
          if (!document.pointerLockElement) this.requestLock();
          else if (e.button === 2) this.shriek();
          else this.ping();
          break;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.state === 'playing' && document.pointerLockElement)
        this.player.look(e.movementX, e.movementY);
    });

    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing') this.setState('pause');
      else if (document.pointerLockElement && this.state === 'pause') this.setState('playing');
    });
  }

  requestLock() {
    this.renderer.domElement.requestPointerLock?.();
  }

  setState(s) {
    this.state = s;
    if (s === 'playing') this.ui.showHUD();
    else this.ui.showScreen(s === 'title' ? 'title' : s);
    if (s !== 'playing' && s !== 'pause' && document.pointerLockElement) document.exitPointerLock();
    if (s !== 'playing') this.ui.setHunted(false);
  }

  // ----- run / level flow -----

  startRun() {
    this.seeds = C.LEVELS.map(() => (Math.random() * 1e9) | 0);
    this.levelIdx = 0;
    this.loadLevel();
    this.setState('playing');
    this.requestLock();
    this.ui.showBanner('make a sound — click to echo', 4);
  }

  retryLevel() {
    this.loadLevel();
    this.setState('playing');
    this.requestLock();
  }

  nextLevel() {
    this.levelIdx++;
    this.loadLevel();
    this.setState('playing');
    this.requestLock();
  }

  loadLevel() {
    this.disposeLevel();
    const def = C.LEVELS[this.levelIdx];
    this.level = new Level(def, this.seeds[this.levelIdx]);
    this.level.build(this.scene, this.pings);
    this.pings.clear();

    // face the open corridor out of the start cell
    const start = this.level.worldFromCell(...this.level.startCell);
    let fx = 0;
    let fz = 1;
    if (!this.level.isWall(2, 1)) {
      fx = 1;
      fz = 0;
    }
    this.player.spawn(start, Math.atan2(-fx, -fz));

    this.creatures = [];
    let ci = 0;
    const spawn = (type, count) => {
      for (let i = 0; i < count; i++) {
        const cell = this.level.creatureCells[ci++ % this.level.creatureCells.length];
        const c = new Creature(type, this.level, this.pings, cell, ci);
        c.addTo(this.scene);
        this.creatures.push(c);
      }
    };
    spawn('crawler', def.crawlers);
    spawn('stalker', def.stalkers);

    this.moths = this.level.mothCells.map((cell, i) => {
      const m = new Moth(this.pings, this.level.worldFromCell(...cell), i);
      m.addTo(this.scene);
      return m;
    });

    this.mothCount = 0;
    this.unlocked = false;
    this.presence = 0;
    this.pingCd = 0;
    this.shriekCharges = C.SHRIEK_MAX;
    this.shriekRegen = 0;
    this.beaconT = 0;

    this.ui.setLevel(def.name);
    this.ui.setMoths(0, def.moths);
    this.ui.setShriek(this.shriekCharges);
    this.ui.setPresence(0);
  }

  disposeLevel() {
    if (this.level) this.level.dispose(this.scene);
    for (const c of this.creatures) c.removeFrom(this.scene);
    for (const m of this.moths) m.removeFrom(this.scene);
    this.creatures = [];
    this.moths = [];
    this.level = null;
  }

  // ----- actions & events -----

  ping() {
    if (this.pingCd > 0) return;
    this.pingCd = C.PING_CD;
    this.presence = Math.min(1, this.presence + C.PRESENCE.PING);
    const origin = new THREE.Vector3(this.player.pos.x, C.EYE, this.player.pos.z);
    this.pings.emit(origin, 'echo');
    this.audio.ping();
    this.noise(this.player.pos, C.NOISE.PING, true);
  }

  shriek() {
    if (this.shriekCharges <= 0) return;
    this.shriekCharges--;
    this.ui.setShriek(this.shriekCharges);
    this.presence = Math.min(1, this.presence + C.PRESENCE.SHRIEK);
    const origin = new THREE.Vector3(this.player.pos.x, C.EYE, this.player.pos.z);
    this.pings.emit(origin, 'shriek');
    this.audio.shriek();
    let stunned = 0;
    for (const c of this.creatures) {
      if (c.xzDistTo(this.player.pos) < C.SHRIEK_RADIUS) {
        c.stun();
        stunned++;
      }
    }
    if (stunned) this.ui.showBanner(stunned > 1 ? 'they reel — run' : 'it reels — run', 2.2);
    // the shriek stuns the near and summons the far
    this.noise(this.player.pos, C.NOISE.SHRIEK, true);
  }

  noise(pos, radius, isPlayer) {
    const r = radius * (1 + this.presence * 0.9);
    for (const c of this.creatures) c.hear(pos, r, isPlayer, this);
  }

  caught(creature) {
    if (this.state !== 'playing') return;
    this.ui.setDeathReason(TYPES[creature.type].deathText);
    this.audio.death();
    this.setState('dead');
  }

  onMothFreed(moth) {
    this.mothCount++;
    const def = C.LEVELS[this.levelIdx];
    this.ui.setMoths(this.mothCount, def.moths);
    this.audio.mothChime();
    if (this.mothCount >= def.moths) {
      this.unlocked = true;
      this.level.setGateOpen(true);
      this.audio.gateOpen();
      this.ui.showBanner('the moths stir — follow the blue echo down', 4.5);
    } else {
      this.ui.showBanner('a moth joins you — its glow answers softly', 3.5);
    }
  }

  onHuntStart() {
    if (this.time - this.huntBannerT > 8) {
      this.huntBannerT = this.time;
      this.ui.showBanner('something heard you', 2.5);
    }
  }

  // ----- per-frame -----

  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;
    this.pings.time.value = this.time;
    this.pingCd -= dt;

    const mv = this.player.update(dt, this.keys, this.level);
    if (mv.stepped) {
      this.audio.step(this.player.running);
      this.noise(this.player.pos, this.player.running ? C.NOISE.STEP_RUN : C.NOISE.STEP_WALK, true);
    }
    if (this.player.running && this.player.moving)
      this.presence = Math.min(1, this.presence + C.PRESENCE.RUN * dt);
    this.presence = Math.max(0, this.presence - C.PRESENCE.DECAY * dt);

    for (const m of this.moths) m.update(dt, this);
    for (const c of this.creatures) c.update(dt, this);
    if (this.state !== 'playing') return; // a creature may have caught us

    if (this.shriekCharges < C.SHRIEK_MAX) {
      this.shriekRegen += dt;
      if (this.shriekRegen >= C.SHRIEK_REGEN) {
        this.shriekRegen = 0;
        this.shriekCharges++;
        this.ui.setShriek(this.shriekCharges);
      }
    }

    // gate
    this.level.pulseGate(this.time, this.unlocked);
    const exitD = Math.hypot(
      this.player.pos.x - this.level.exitWorld.x,
      this.player.pos.z - this.level.exitWorld.z,
    );
    if (this.unlocked) {
      this.beaconT -= dt;
      if (this.beaconT <= 0) {
        this.beaconT = C.BEACON_INTERVAL;
        this.pings.emit(this.level.exitWorld.clone().setY(1.2), 'beacon');
        this.audio.beacon(exitD);
      }
      if (exitD < 1.8) this.completeLevel();
    }

    // dread systems
    let hunting = false;
    let minDist = 99;
    for (const c of this.creatures) {
      if (c.state === 'hunt') hunting = true;
      minDist = Math.min(minDist, c.xzDistTo(this.player.pos));
    }
    this.ui.setHunted(hunting);
    this.audio.updateHeartbeat(dt, hunting, minDist);
    this.audio.updateDrips(dt);

    this.ui.setPresence(this.presence);
  }

  completeLevel() {
    if (this.levelIdx >= C.LEVELS.length - 1) {
      this.audio.win();
      this.setState('won');
    } else {
      const def = C.LEVELS[this.levelIdx];
      this.ui.setInter('you descend.', def.flavor);
      this.audio.gateOpen();
      this.setState('inter');
    }
  }

  // headless/debug helpers (no pointer lock needed)
  debugStart(levelIdx = 0) {
    this.seeds = C.LEVELS.map((_, i) => 1000 + i);
    this.levelIdx = levelIdx;
    this.loadLevel();
    this.state = 'playing';
    this.ui.showHUD();
  }
}
