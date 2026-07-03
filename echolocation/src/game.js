// Orchestration: states, input, noise propagation, level flow.
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { World } from './world.js';
import { Pings } from './pings.js';
import { Player } from './player.js';
import { Creature, TYPES } from './creatures.js';
import { Lanternfish } from './allies.js';
import { Snow } from './snow.js';
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
    this.world = null;
    this.snow = null;
    this.creatures = [];
    this.fish = [];
    this.fishCount = 0;
    this.unlocked = false;

    this.bindEvents();
    this.ui.showScreen('title');
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
      if (this.state !== 'playing') return;
      if (e.code === 'KeyF') this.ping();
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
    else this.ui.showScreen(s);
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
    this.ui.showBanner('find the lanternfish ✦ — only their light opens the way on', 5);
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
    this.world = new World(def, this.seeds[this.levelIdx]);
    this.world.build(this.scene, this.pings);
    this.pings.clear();

    this.snow = new Snow(this.pings, def.radius + 6, def.snow);
    this.snow.addTo(this.scene);

    // wake facing the heart of the canyon
    const yaw = Math.atan2(this.world.spawnPos.x, this.world.spawnPos.z);
    this.player.spawn(this.world.spawnPos, yaw);

    this.creatures = [];
    let ci = 0;
    const spawn = (type, count) => {
      for (let i = 0; i < count; i++) {
        const c = new Creature(type, this.world, this.pings, this.world.creatureSpawns[ci++], ci);
        c.addTo(this.scene);
        this.creatures.push(c);
      }
    };
    spawn('lurker', def.lurkers);
    spawn('wraith', def.wraiths);

    this.fish = this.world.fishSpots.map((p, i) => {
      const f = new Lanternfish(this.pings, p, i);
      f.addTo(this.scene);
      return f;
    });

    this.fishCount = 0;
    this.unlocked = false;
    this.presence = 0;
    this.pingCd = 0;
    this.shriekCharges = C.SHRIEK_MAX;
    this.shriekRegen = 0;
    this.beaconT = 0;

    this.ui.setLevel(def.name);
    this.ui.setFish(0, def.fish);
    this.ui.setShriek(this.shriekCharges);
    this.ui.setPresence(0);
    this.ui.setWayOut(null);
  }

  disposeLevel() {
    if (this.world) this.world.dispose(this.scene);
    if (this.snow) this.snow.removeFrom(this.scene);
    for (const c of this.creatures) c.removeFrom(this.scene);
    for (const f of this.fish) f.removeFrom(this.scene);
    this.creatures = [];
    this.fish = [];
    this.world = null;
    this.snow = null;
  }

  // ----- actions & events -----

  ping() {
    if (this.pingCd > 0) return;
    this.pingCd = C.PING_CD;
    this.presence = Math.min(1, this.presence + C.PRESENCE.PING);
    this.pings.emit(this.player.pos, 'echo');
    this.audio.ping();
    this.noise(this.player.pos, C.NOISE.PING, true);
  }

  shriek() {
    if (this.shriekCharges <= 0) return;
    this.shriekCharges--;
    this.ui.setShriek(this.shriekCharges);
    this.presence = Math.min(1, this.presence + C.PRESENCE.SHRIEK);
    this.pings.emit(this.player.pos, 'shriek');
    this.audio.shriek();
    let stunned = 0;
    for (const c of this.creatures) {
      if (c.distTo(this.player.pos) < C.SHRIEK_RADIUS) {
        const away = c.group.position.clone().sub(this.player.pos).normalize();
        c.stun(away);
        stunned++;
      }
    }
    if (stunned) this.ui.showBanner(stunned > 1 ? 'they reel — swim' : 'it reels — swim', 2.2);
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

  onFishFreed() {
    this.fishCount++;
    const def = C.LEVELS[this.levelIdx];
    this.ui.setFish(this.fishCount, def.fish);
    this.audio.fishChime();
    if (this.fishCount >= def.fish) {
      this.unlocked = true;
      this.world.setGateOpen(true);
      this.audio.gateOpen();
      this.ui.showBanner('the gate wakes — follow the lanternfish', 4.5);
    } else {
      this.ui.showBanner('a lanternfish swims with you — its light answers yours', 3.5);
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

    const mv = this.player.update(dt, this.keys, this.world);
    if (mv.stroked) {
      this.audio.stroke(this.player.burst);
      this.noise(this.player.pos, this.player.burst ? C.NOISE.STROKE_FAST : C.NOISE.STROKE_SLOW, true);
    }
    if (this.player.burst) this.presence = Math.min(1, this.presence + C.PRESENCE.BURST * dt);
    this.presence = Math.max(0, this.presence - C.PRESENCE.DECAY * dt);

    for (const f of this.fish) f.update(dt, this);
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
    this.world.pulseGate(this.time, this.unlocked);
    const exitD = this.player.pos.distanceTo(this.world.gatePos);
    if (this.unlocked) {
      this.ui.setWayOut(exitD);
      this.beaconT -= dt;
      if (this.beaconT <= 0) {
        this.beaconT = C.BEACON_INTERVAL;
        this.pings.emit(this.world.gatePos, 'beacon');
        this.audio.beacon(exitD);
      }
      if (exitD < 2.2) this.completeLevel();
    }

    // dread systems
    let hunting = false;
    let minDist = 99;
    for (const c of this.creatures) {
      if (c.state === 'hunt') hunting = true;
      minDist = Math.min(minDist, c.distTo(this.player.pos));
    }
    this.ui.setHunted(hunting);
    this.audio.updateHeartbeat(dt, hunting, minDist);
    this.audio.updateAmbient(dt);

    this.ui.setPresence(this.presence);
  }

  completeLevel() {
    if (this.levelIdx >= C.LEVELS.length - 1) {
      this.audio.win();
      this.setState('won');
    } else {
      const def = C.LEVELS[this.levelIdx];
      this.ui.setInter('you slip through the gate.', def.flavor);
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
