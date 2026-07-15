// Game orchestration: the 20-second loop, input recording, ghost spawning,
// the rewind cinematic, level flow and all rendering.
//
// DETERMINISM: the simulation advances ONLY inside stepTick(), one fixed
// 60 Hz tick at a time, driven by an accumulator (update()). Input is
// sampled once per tick into a bitmask and recorded; ghosts replay those
// masks through the same stepActor() code. Nothing in the sim touches
// Math.random() or wall-clock time, so pausing / tab-blur cannot desync.
import { C } from './config.js';
import { LEVELS } from './levels.js';
import { World } from './entities.js';
import { makeActor, stepActor, actorFrame } from './player.js';
import { Ghost } from './ghosts.js';
import { FX } from './fx.js';

const SIM_STATES = new Set(['play', 'rewind', 'dead']);

export class Game {
  constructor(canvas, ts, ui, audio, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.ts = ts;
    this.ui = ui;
    this.audio = audio;
    this.input = input;
    this.fx = new FX();

    this.state = 'title';
    this.levelIndex = 0;
    this.world = null;
    this.bg = null;
    this.ghosts = [];
    this.loops = 0;
    this.ghostSeq = 0;

    // per-run
    this.tick = 0;
    this.armed = true;
    this.recording = [];
    this.posHist = [];
    this.player = makeActor(0, 0);
    this.deniedCd = 0;

    // transitions
    this.rewT = 0;
    this.deadT = 0;
    this.pendingRec = null;

    this.acc = 0;
    this.animT = 0; // presentation clock (never read by the sim)
    this.fast = false; // fast-forward held (changes ticks-per-frame only)
    this.idleT = 0; // how long the player has stood still (visual only)

    // attract-mode backdrop for title/select
    this.backdrop = new World(LEVELS[4]);
    this.backdropBg = this.backdrop.buildBackground(ts);

    this.ui.onPick = (i) => this.startLevel(i);
    this.ui.buildSelect();
    this.ui.show('title');
  }

  // ================================================== flow

  startLevel(i) {
    this.levelIndex = i;
    this.world = new World(LEVELS[i]);
    this.bg = this.world.buildBackground(this.ts);
    this.ghosts = [];
    this.loops = 0;
    this.ghostSeq = 0;
    this.state = 'play';
    this.ui.hideAll();
    this.ui.banner(`${String(i + 1).padStart(2, '0')} · ${LEVELS[i].name.toUpperCase()}`, LEVELS[i].hint, 3000);
    this.ui.hint(LEVELS[i].hint);
    this.audio.startMusic();
    this.startRun();
  }

  startRun() {
    this.loops++;
    this.tick = 0;
    this.armed = true;
    this.recording = [];
    this.posHist = [];
    this.deniedCd = 0;
    this.world.resetRun();
    const s = this.world.start;
    const p = this.player;
    p.x = s.x;
    p.y = s.y;
    p.dir = 0;
    p.animDist = 0;
    p.moving = false;
    p.carried.length = 0;
    p.onSwitch = -1;
    for (const g of this.ghosts) g.reset(s.x, s.y);
    this.audio.setTension(0);
  }

  commitGhost() {
    if (!this.pendingRec || this.pendingRec.length === 0) return;
    const s = this.world.start;
    this.ghosts.push(new Ghost(this.pendingRec, s.x, s.y, this.ghostSeq++));
    if (this.ghosts.length > LEVELS[this.levelIndex].maxGhosts) {
      this.ghosts.shift();
      this.ui.toast('GHOST LIMIT — OLDEST GHOST FADED');
      this.audio.ghostFade();
    }
    this.audio.ghostSpawn();
    this.fx.ghostSpawnPuff(s.x, s.y);
    this.pendingRec = null;
  }

  doRewind() {
    if (this.recording.length === 0) return; // nothing happened yet
    this.pendingRec = this.recording;
    this.rewT = 0;
    this.state = 'rewind';
    this.audio.rewind();
    this.ui.setRewindLook(true);
  }

  die(cause, x, y) {
    this.state = 'dead';
    this.deadT = 0;
    if (cause === 'laser') {
      this.audio.laserZap();
      this.fx.laserZap(x, y);
      this.ui.toast('LASER TRIPPED — LOOP RESET');
    } else {
      this.audio.alarm();
      this.fx.alarm();
      this.ui.toast('SPOTTED — LOOP RESET');
    }
  }

  winLevel() {
    this.state = 'win';
    this.audio.win();
    this.fx.winBurst(this.player.x, this.player.y);
    this.ui.saveWin(this.levelIndex, this.loops);
    this.ui.showWin(this.levelIndex, this.loops, this.levelIndex === LEVELS.length - 1);
  }

  // ================================================== input actions

  handleAction(action) {
    const a = this.audio;
    switch (this.state) {
      case 'title':
        if (action === 'confirm' || action === 'back') {
          a.uiSelect();
          this.ui.buildSelect();
          this.ui.show('select');
          this.state = 'select';
        }
        break;
      case 'select':
        if (action === 'left' || action === 'up') {
          this.ui.setSelIndex(this.ui.selIndex - 1);
          a.uiMove();
        } else if (action === 'right' || action === 'down') {
          this.ui.setSelIndex(this.ui.selIndex + 1);
          a.uiMove();
        } else if (action === 'confirm') {
          a.uiSelect();
          this.startLevel(this.ui.selIndex);
        } else if (action === 'back') {
          this.ui.show('title');
          this.state = 'title';
        }
        break;
      case 'play':
        if (action === 'rewind') this.doRewind();
        else if (action === 'back') {
          this.state = 'pause';
          this.ui.show('pause');
        }
        break;
      case 'pause':
        if (action === 'back' || action === 'confirm') this.resume();
        else if (action === 'rewind') this.restartHeist();
        else if (action === 'quit') this.quitToSelect();
        break;
      case 'win':
        if (action === 'confirm') {
          a.uiSelect();
          if (this.levelIndex === LEVELS.length - 1) {
            this.state = 'finale';
            this.audio.finale();
            this.ui.showFinale();
          } else this.startLevel(this.levelIndex + 1);
        } else if (action === 'back') this.quitToSelect();
        break;
      case 'finale':
        if (action === 'confirm' || action === 'back') this.quitToSelect();
        break;
    }
  }

  resume() {
    this.state = 'play';
    this.ui.hideAll();
    this.ui.hint(LEVELS[this.levelIndex].hint);
  }

  restartHeist() {
    this.ghosts = [];
    this.loops = 0;
    this.ui.toast('HEIST RESTARTED — GHOSTS CLEARED');
    this.startRun();
    this.resume();
  }

  quitToSelect() {
    this.state = 'select';
    this.ui.buildSelect();
    this.ui.show('select');
    this.ui.hint('');
    this.ui.setRewindLook(false);
  }

  // ================================================== fixed-step sim

  update(dt) {
    if (!SIM_STATES.has(this.state)) {
      this.acc = 0;
      this.setFast(false);
      return;
    }
    // FAST-FORWARD: holding F/Shift runs 3x as many fixed ticks per frame.
    // Every tick still samples + records the input mask exactly as at
    // normal speed, so a fast-forwarded run replays identically and ghosts,
    // guards, doors and the loop clock all accelerate together.
    this.setFast(this.input.fast());
    const mult = this.fast ? C.FF_MULT : 1;
    this.acc += dt * mult;
    let n = 0;
    while (this.acc >= C.TICK && n < C.MAX_CATCHUP * mult) {
      this.stepTick();
      this.acc -= C.TICK;
      n++;
    }
    if (this.acc > C.TICK) this.acc = C.TICK; // drop backlog, never spiral
  }

  setFast(on) {
    if (on === this.fast) return;
    this.fast = on;
    this.audio.setFast(on);
  }

  stepTick() {
    if (this.state === 'rewind') {
      this.rewT++;
      if (this.rewT >= C.REWIND_TICKS) {
        this.ui.setRewindLook(false);
        this.commitGhost();
        this.startRun();
        this.state = 'play';
      }
      return;
    }
    if (this.state === 'dead') {
      this.deadT++;
      if (this.deadT >= C.DEATH_TICKS) {
        // failed run: no ghost is kept, but past ghosts remain
        this.startRun();
        this.state = 'play';
      }
      return;
    }

    // ---- state 'play' ----
    const mask = this.input.mask();

    // time is frozen until your first step of each loop
    if (this.armed) {
      if (mask === 0) return;
      this.armed = false;
    }

    this.recording.push(mask);
    this.posHist.push(this.player.x, this.player.y);

    // ghosts first (oldest first), then the player — fixed order = fixed sim
    for (const g of this.ghosts) g.step(this.world);
    stepActor(this.world, this.player, mask);
    this.world.tryPickup(this.player, true);

    const bodies = [];
    for (const g of this.ghosts) bodies.push(g.a);
    bodies.push(this.player);
    this.world.update(this.tick, bodies);
    this.drainEvents();

    if (this.player.moving && this.tick % 13 === 0)
      this.audio.footstep((this.tick / 13) % 2 === 0);

    // hazards
    const hit = this.world.playerHitsLaser(this.player, this.tick);
    if (hit) {
      this.die('laser', hit.x, hit.y);
      return;
    }
    if (this.world.guardsSpot(this.player)) {
      this.die('spotted', this.player.x, this.player.y);
      return;
    }

    // exit — TEAM DELIVERY: the heist completes when the player stands in
    // the exit and every gem is carried by somebody who is ALSO inside the
    // exit zone right now (the player, or ghosts parked/passing through).
    if (this.deniedCd > 0) this.deniedCd--;
    if (this.world.actorAtExit(this.player)) {
      let covered = this.player.carried.length;
      for (const gh of this.ghosts) {
        if (this.world.actorAtExit(gh.a)) covered += gh.a.carried.length;
      }
      if (covered >= this.world.gems.length) {
        this.winLevel();
        return;
      }
      if (this.deniedCd === 0) {
        this.deniedCd = 70;
        this.audio.denied();
        const missing = this.world.gems.length - covered;
        this.ui.toast(
          `${missing} GEM${missing > 1 ? 'S' : ''} STILL OUT — GET EVERY CARRIER INTO THE EXIT`,
        );
      }
    }

    // clock
    const remaining = C.LOOP_TICKS - this.tick;
    if (remaining <= 180 && remaining % 60 === 0 && remaining > 0) {
      this.audio.tick(remaining <= 60);
      this.audio.heartbeat();
    }
    this.audio.setTension(remaining <= 300 ? 1 - remaining / 300 : 0);

    this.tick++;
    if (this.tick >= C.LOOP_TICKS) this.doRewind();
  }

  drainEvents() {
    for (const e of this.world.events) {
      switch (e.type) {
        case 'gem':
          this.audio.gem(e.n);
          this.fx.gemBurst(e.x, e.y);
          break;
        case 'ghostGem':
          this.audio.ghostGem();
          this.fx.ghostGemBurst(e.x, e.y);
          break;
        case 'plateOn':
          this.audio.plateOn();
          this.fx.plateClick(e.x, e.y);
          break;
        case 'plateOff':
          this.audio.plateOff();
          break;
        case 'switch':
          this.audio.switchFlip(e.on);
          this.fx.switchSpark(e.x, e.y, e.on);
          break;
        case 'doorOpen':
          this.audio.doorOpen();
          this.fx.doorRumble(e.x, e.y);
          break;
        case 'doorClose':
          this.audio.doorClose();
          this.fx.doorRumble(e.x, e.y);
          break;
      }
    }
    this.world.events.length = 0;
  }

  // ================================================== rendering

  render(dt) {
    this.animT += dt;
    this.fx.update(dt);
    const g = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (this.state === 'title' || this.state === 'select' || this.state === 'finale') {
      this.renderBackdrop(g, w, h);
      return;
    }
    if (!this.world) return;

    const visTick = Math.floor(this.animT * 60);
    const off = this.fx.offset();

    g.fillStyle = '#05070d';
    g.fillRect(0, 0, w, h);
    g.save();
    g.translate(off.x, off.y);

    g.drawImage(this.bg, 0, 0);
    this.world.drawFloorLayer(g, this.ts, visTick);

    // loose gems (waiting on their pedestals)
    for (const gem of this.world.gems) {
      if (gem.carrier) continue;
      const bob = Math.sin(this.animT * 2.3 + gem.kind * 1.7) * 1.5;
      const gx = Math.round(gem.x - 8);
      const gy = Math.round(gem.y - 10 + bob);
      g.drawImage(this.ts.gems[gem.kind % 3], gx, gy);
      drawSparkle(g, gx, gy, visTick + gem.kind * 53);
    }

    this.world.drawVisionCones(g, this.state === 'dead');
    this.world.drawDoors(g);

    // guards
    for (const gd of this.world.guards) {
      this.drawSheet(g, this.ts.guardSheet, gd.dir, walkFrame(gd), gd.x, gd.y, 1);
    }

    // ghosts (translucent cyan, slight wobble + echo outline)
    for (const gh of this.ghosts) {
      const a = gh.a;
      const wob = Math.sin(this.animT * 3.1 + gh.id * 2.4);
      const alpha = gh.done ? 0.3 : 0.52;
      const fr = actorFrame(a);
      this.drawSheet(g, this.ts.ghostSheet, a.dir, fr, a.x + wob * 0.8 - 1, a.y, alpha * 0.35);
      this.drawSheet(g, this.ts.ghostSheet, a.dir, fr, a.x + wob * 0.8 + 1, a.y, alpha * 0.35);
      this.drawSheet(g, this.ts.ghostSheet, a.dir, fr, a.x + wob * 0.8, a.y, alpha);
      this.drawCarried(g, a, alpha);
    }

    // the player (with a little idle life: beanie-bob + glancing around)
    if (this.player.moving || this.state !== 'play') this.idleT = 0;
    else this.idleT += dt;
    if (this.state !== 'rewind') {
      const flash = this.state === 'dead' && this.deadT % 8 < 4;
      if (!flash) {
        let pdir = this.player.dir;
        let py = this.player.y;
        if (this.idleT > 0.4) {
          if (((this.animT * 1.3) % 1) > 0.55) py -= 1; // idle bob
          const glance = (this.animT % 5.2) / 5.2;
          if (this.idleT > 1.6) {
            if (glance > 0.62 && glance < 0.76) pdir = 2; // look left...
            else if (glance > 0.8 && glance < 0.94) pdir = 3; // ...then right
          }
        }
        this.drawSheet(g, this.ts.playerSheet, pdir, actorFrame(this.player), this.player.x, py, 1);
        this.drawCarried(g, this.player, 1);
      }
    }

    this.world.drawLasers(g, this.tick);
    this.fx.drawParticles(g);

    if (this.state === 'rewind') this.drawRewindFX(g, w, h);
    this.fx.drawFlashes(g, w, h);
    g.restore();

    // HUD — per-gem delivery status:
    //   'home' = still on its pedestal, 'out' = carried by a heister who is
    //   not in the exit, 'in' = inside the getaway zone right now.
    const gemStates = this.world.gems.map((gem) => {
      if (!gem.carrier) return 'home';
      return this.world.actorAtExit(gem.carrier) ? 'in' : 'out';
    });
    const remaining = Math.max(0, C.LOOP_TICKS - this.tick);
    this.ui.updateHUD({
      levelName: `${String(this.levelIndex + 1).padStart(2, '0')} ${LEVELS[this.levelIndex].name.toUpperCase()}`,
      loop: this.loops,
      maxGhosts: LEVELS[this.levelIndex].maxGhosts,
      ghostCount: this.ghosts.length,
      gemStates,
      frac: remaining / C.LOOP_TICKS,
      low: remaining <= 180 && this.state === 'play',
      armed: this.armed && this.state === 'play',
      fast: this.fast && this.state === 'play',
    });
  }

  drawSheet(g, sheet, dir, frame, x, y, alpha) {
    g.globalAlpha = alpha;
    g.drawImage(sheet, frame * 16, dir * 16, 16, 16, Math.round(x - 8), Math.round(y - 12), 16, 16);
    g.globalAlpha = 1;
  }

  drawCarried(g, actor, alpha) {
    for (let i = 0; i < actor.carried.length; i++) {
      const gem = actor.carried[i];
      const bob = Math.sin(this.animT * 2.6 + i * 1.3) * 1.4;
      g.globalAlpha = alpha;
      g.drawImage(
        this.ts.gems[gem.kind % 3],
        Math.round(actor.x - 8),
        Math.round(actor.y - 24 - i * 7 + bob),
      );
      g.globalAlpha = 1;
    }
  }

  // the rewind cinematic: desaturate, blue tint, reverse ghost-trail
  drawRewindFX(g, w, h) {
    const p = this.rewT / C.REWIND_TICKS;
    const ease = 1 - Math.pow(1 - p, 2.2); // accelerating playback
    const n = this.posHist.length / 2;
    const head = Math.max(0, Math.floor((1 - ease) * (n - 1)));

    // desaturate the whole frame, then cool it down
    g.save();
    g.globalCompositeOperation = 'saturation';
    g.globalAlpha = Math.min(1, p * 2.5) * 0.85;
    g.fillStyle = '#808080';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = `rgba(45,110,190,${(0.16 + 0.1 * Math.sin(this.animT * 30)).toFixed(3)})`;
    g.fillRect(0, 0, w, h);
    g.restore();

    // backwards trail of your run
    for (let k = 5; k >= 0; k--) {
      const i = Math.min(n - 1, head + k * 5);
      const x = this.posHist[i * 2];
      const y = this.posHist[i * 2 + 1];
      this.drawSheet(g, this.ts.ghostSheet, this.player.dir, 0, x, y, k === 0 ? 0.95 : 0.4 - k * 0.05);
    }
    // horizontal tear lines
    g.fillStyle = 'rgba(140,220,255,0.12)';
    for (let k = 0; k < 3; k++) {
      const y = Math.floor(((this.animT * 240 + k * 67) % h));
      g.fillRect(0, y, w, 1);
    }
  }

  renderBackdrop(g, w, h) {
    const visTick = Math.floor(this.animT * 60);
    g.fillStyle = '#05070d';
    g.fillRect(0, 0, w, h);
    g.drawImage(this.backdropBg, 0, 0);
    this.backdrop.drawFloorLayer(g, this.ts, visTick);
    this.backdrop.drawDoors(g);
    this.backdrop.drawLasers(g, visTick);
    for (const gem of this.backdrop.gems) {
      const bob = Math.sin(this.animT * 2.3 + gem.kind * 1.7) * 1.5;
      g.drawImage(this.ts.gems[gem.kind % 3], Math.round(gem.x - 8), Math.round(gem.y - 10 + bob));
    }
    g.fillStyle = 'rgba(4,6,13,0.82)';
    g.fillRect(0, 0, w, h);
  }
}

function walkFrame(gd) {
  if (!gd.moving) return 0;
  const phase = Math.floor(gd.animDist / 5) % 4;
  return phase === 1 ? 1 : phase === 3 ? 2 : 0;
}

// a little 4-point star that sweeps across gems every couple of seconds
function drawSparkle(g, gx, gy, t) {
  const phase = t % 150;
  if (phase >= 14) return;
  const f = phase < 5 ? 0 : phase < 10 ? 1 : 0;
  const x = ((t / 150) | 0) % 2 === 0 ? gx + 3 : gx + 10;
  const y = gy + (((t / 150) | 0) % 3 === 0 ? 2 : 6);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.fillRect(x, y, 1, 1);
  if (f === 1) {
    g.fillRect(x - 1, y, 1, 1);
    g.fillRect(x + 1, y, 1, 1);
    g.fillRect(x, y - 1, 1, 1);
    g.fillRect(x, y + 1, 1, 1);
  }
}
