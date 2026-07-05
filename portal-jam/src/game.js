import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { buildLevel, updateSpinners } from './court.js';
import { Ball } from './ball.js';
import { PortalManager } from './portals.js';
import { stepPhysics } from './physics.js';
import { Confetti, Shake } from './effects.js';
import { PHYS } from './config.js';

const SAVE_KEY = 'portal-jam-save-v1';

export class Game {
  constructor({ scene, camera, controls, ui, audio, aim }) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.ui = ui;
    this.audio = audio;
    this.aim = aim;

    this.state = 'title'; // title | play | scored | done | end
    this.levelIndex = 0;
    this.levelObjects = null;
    this.shots = 0;
    this.sessionShots = 0;
    this.sessionSwishes = 0;
    this.scoredSwish = false;
    this.scoredTimer = 0;

    this.ball = new Ball(scene);
    this.portals = new PortalManager(scene);
    this.confetti = new Confetti(scene);
    this.shake = new Shake();

    this.world = { colliders: [], hoop: null, portals: this.portals };

    this.save = this.loadSave();

    aim.ball = this.ball;
    aim.world = this.world;
    aim.onShoot = (vel) => this.handleShoot(vel);
    aim.onPlacePortal = (point, normal, hostId) => this.handlePlacePortal(point, normal, hostId);
    aim.onAimStart = () => this.ui.hint('release to shoot — pull further for power', 0);
    aim.onAimEnd = () => this.ui.hintEl.classList.add('faded');

    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s.unlocked === 'number') return s;
    } catch { /* fresh save */ }
    return { unlocked: 0, best: {} };
  }

  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* private mode */ }
  }

  get level() { return LEVELS[this.levelIndex]; }

  loadLevel(index) {
    this.levelIndex = index;
    const lv = this.level;

    if (this.levelObjects) {
      this.scene.remove(this.levelObjects.group);
      this.levelObjects.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }

    this.levelObjects = buildLevel(lv);
    this.scene.add(this.levelObjects.group);
    this.levelObjects.group.updateMatrixWorld(true);

    this.world.colliders = this.levelObjects.colliders;
    this.world.hoop = this.levelObjects.hoop;

    this.portals.clear();
    this.ball.setSpawn(lv.ball);
    this.shots = 0;
    this.scoredSwish = false;

    this.camera.position.fromArray(lv.camera.pos);
    this.controls.target.fromArray(lv.camera.target);
    this.controls.update();

    this.aim.portalMeshes = this.levelObjects.portalMeshes;
    this.aim.setNextPortalColor(true);

    this.ui.setLevel(index, LEVELS.length, lv.name, lv.par);
    this.ui.setPortals(false, false);
    this.ui.toast(lv.tagline, 'cool', 3400);
    this.ui.hint(lv.hint, 8000);

    this.state = 'play';
    this.aim.enabled = true;
    this.ui.hideOverlays();
  }

  handleShoot(vel) {
    if (this.state !== 'play' || this.ball.live) return;
    this.shots++;
    this.sessionShots++;
    this.ui.setShots(this.shots);
    this.ball.shoot(vel);
    this.audio.shoot(vel.length() / PHYS.maxSpeed);
  }

  handlePlacePortal(point, normal, hostId) {
    if (this.state !== 'play') return;
    const which = this.portals.placeNext(point, normal, hostId);
    this.audio.place(which === 'a');
    this.ui.setPortals(this.portals.a.placed, this.portals.b.placed);
    this.aim.setNextPortalColor(this.portals.nextIsA);
    if (this.portals.bothPlaced) {
      this.ui.hint('rift linked — take the shot', 3500);
    } else {
      this.ui.hint('one more panel to link the rift', 4500);
    }
  }

  onKey(e) {
    if (this.state !== 'play' && this.state !== 'scored') return;
    if (e.code === 'KeyR') {
      this.ball.reset();
      this.ui.toast('ball back', '', 1000);
    } else if (e.code === 'KeyC') {
      this.portals.clear();
      this.ui.setPortals(false, false);
      this.aim.setNextPortalColor(true);
      this.ui.toast('rifts cleared', '', 1000);
    } else if (e.code === 'KeyM') {
      this.ui.setMuted(this.audio.toggleMute());
    }
  }

  // fixed-rate physics step
  fixedStep(dt) {
    if (this.state !== 'play' && this.state !== 'scored') return;
    if (!this.ball.live) return;

    const res = stepPhysics(this.ball.state, dt, this.world);

    if (res.teleported) {
      this.audio.teleport();
      this.shake.kick(0.05);
    }
    if (res.hit && res.hit.speed > 1.2) {
      const k = res.hit.kind;
      if (k === 'rim') { this.audio.rim(); this.ball.touchedRimOrBoard = true; }
      else if (k === 'board') { this.audio.board(); this.ball.touchedRimOrBoard = true; }
      else if (k === 'spinner') { this.audio.board(); this.shake.kick(0.08); }
      else this.audio.bounce(res.hit.speed / 12);
    }
    if (res.scored && this.state === 'play') this.handleScore();
  }

  handleScore() {
    this.state = 'scored';
    this.scoredTimer = 0;
    this.scoredSwish = !this.ball.touchedRimOrBoard;
    if (this.scoredSwish) this.sessionSwishes++;

    this.audio.score(this.scoredSwish);
    this.ui.flash();
    this.shake.kick(0.12);
    this.confetti.burst(this.world.hoop.rimCenter.clone());
    this.ui.toast(this.scoredSwish ? 'SWISH — nothing but net' : 'BUCKETS!', 'gold', 2600);
    this.aim.enabled = false;

    // progress
    const lv = this.level;
    const prev = this.save.best[lv.id];
    if (prev == null || this.shots < prev) this.save.best[lv.id] = this.shots;
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(this.levelIndex + 1, LEVELS.length - 1));
    this.persist();
  }

  finishLevel() {
    this.state = 'done';
    const lv = this.level;
    this.ui.showDone({
      levelName: lv.name,
      shots: this.shots,
      par: lv.par,
      best: this.save.best[lv.id],
      swish: this.scoredSwish,
      isLast: this.levelIndex === LEVELS.length - 1,
    });
  }

  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) {
      this.loadLevel(this.levelIndex + 1);
    } else {
      this.state = 'end';
      this.ui.showEnd({
        totalShots: this.sessionShots,
        totalPar: LEVELS.reduce((s, l) => s + l.par, 0),
        swishes: this.sessionSwishes,
      });
    }
  }

  restart() {
    this.sessionShots = 0;
    this.sessionSwishes = 0;
    this.loadLevel(0);
  }

  // per-frame visuals
  update(dt, t) {
    updateSpinners(this.levelObjects ? this.levelObjects.spinners : [], t);
    this.portals.update(t, dt);
    this.confetti.update(dt);
    this.shake.update(dt);
    this.ball.syncVisual(dt);

    if (this.state === 'play' && this.ball.trackRest(dt)) {
      this.ball.reset();
      this.ui.toast('ball returned', '', 900);
    }

    if (this.state === 'scored') {
      this.scoredTimer += dt;
      if (this.scoredTimer > 1.5) this.finishLevel();
    }
  }
}
