// Quillshot core: state machine, typing/targeting, waves, combat resolution,
// combo scoring, and the render pass. Feel rules: hit-stop ≤ 100ms, shake ≤ 6px
// damped sine, everything eased exponentially.

import { CONFIG as C } from './config.js';
import { Player } from './player.js';
import { Enemy, Ragdoll } from './enemies.js';
import { Projectiles } from './projectiles.js';
import { Particles } from './particles.js';
import { Background } from './background.js';
import { pickWord, BOSS_SENTENCES } from './words.js';
import { rollUpgrades } from './upgrades.js';

export class Game {
  constructor(canvas, ui, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.audio = audio;

    this.w = 1280;
    this.h = 720;
    this.scale = 1;
    this.groundY = 576;

    this.bg = new Background();
    this.particles = new Particles();
    this.projectiles = new Projectiles(this);
    this.player = new Player(this);
    this.enemies = [];
    this.ragdolls = [];

    this.time = 0;
    this.state = 'start'; // start | playing | upgrade | paused | over
    this.best = Number(localStorage.getItem('quillshot-best') || 0);

    this.resetRun();
    ui.show('start');
    ui.setHudVisible(false);
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.scale = Math.max(0.7, Math.min(1.35, Math.min(w / 1280, h / 720)));
    this.groundY = h * C.GROUND_FRAC;
    this.bg.resize(w, h);
    for (const e of this.enemies) {
      e.su = this.scale * e.body.scale;
      if (e.type !== 'flyer' && e.type !== 'orb') {
        e.y = this.groundY;
      } else {
        e.y = Math.min(e.y, this.groundY - 30);
        e.baseY = Math.min(e.baseY, this.groundY - 30);
      }
    }
  }

  resetRun() {
    this.score = 0;
    this.wave = 0;
    this.hearts = C.START_HEARTS;
    this.up = { multishot: 0, flame: 0, frost: 0, sharp: 0, heart: 0, quickdraw: 0, secondwind: 0 };
    this.streak = 0;
    this.mult = 1;
    this.stats = { keys: 0, errors: 0, correctChars: 0, words: 0, activeTime: 0 };
    this.enemies = [];
    this.ragdolls = [];
    this.target = null;
    this.projectiles.clear();
    this.particles.clear();
    this.spawnQueue = [];
    this.spawnT = 0;
    this.spawnInterval = C.SPAWN_BASE_INTERVAL;
    this.speedRamp = 1;
    this.waveDelay = 0;
    this.secondWindUsed = false;
    this.lastWordTime = -99;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.slowmoT = 0;
    this.hitStop = 0;
    this.shakeAmp = 0;
    this.shakeT = 10;
    this.shakeX = 0;
    this.shakeY = 0;
    this.damageFlash = 0;
    this.statT = 0;
    this.player.reset();
  }

  get frostLv() {
    return this.up.frost;
  }

  get heartCap() {
    return Math.min(C.MAX_HEARTS, C.START_HEARTS + this.up.heart);
  }

  startRun() {
    this.resetRun();
    this.state = 'playing';
    this.ui.show(null);
    this.ui.setHudVisible(true);
    this.ui.setHearts(this.hearts, this.heartCap);
    this.ui.setScore(0);
    this.ui.setCombo(1, 0);
    this.ui.setStats(0, 100);
    this.nextWave();
  }

  // ------------------------------------------------------------------ waves
  nextWave() {
    this.wave++;
    this.secondWindUsed = false;
    this.ui.setWave(this.wave);
    const isBoss = this.wave % 5 === 0;
    this.ui.waveBanner(this.wave, isBoss);
    if (isBoss) this.audio.bossRoar();
    else this.audio.waveStart();

    const n = this.wave;
    let walkers = 3 + Math.ceil(n * 0.8);
    let runners = n >= 2 ? Math.floor(n / 2) : 0;
    let flyers = n >= 3 ? Math.floor((n - 1) / 2) : 0;
    let brutes = n >= 3 ? Math.floor(n / 3) : 0;
    let bombers = n >= 4 ? Math.min(4, Math.floor((n - 2) / 2)) : 0;
    if (isBoss) {
      walkers = Math.ceil(walkers / 2);
      runners = Math.ceil(runners / 2);
      flyers = Math.floor(flyers / 2);
      brutes = Math.floor(brutes / 2);
      bombers = Math.floor(bombers / 2);
    }

    const list = [];
    const push = (type, count) => {
      for (let i = 0; i < count; i++) list.push(type);
    };
    push('walker', walkers);
    push('runner', runners);
    push('flyer', flyers);
    push('brute', brutes);
    push('bomber', bombers);
    while (list.length > C.WAVE_CAP) list.splice((Math.random() * list.length) | 0, 1);
    // shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [list[i], list[j]] = [list[j], list[i]];
    }
    if (isBoss) list.unshift('boss');

    this.spawnQueue = list;
    this.spawnInterval = Math.max(
      C.SPAWN_MIN_INTERVAL,
      C.SPAWN_BASE_INTERVAL - n * 0.07,
    );
    this.speedRamp = Math.min(C.SPEED_RAMP_CAP, 1 + n * C.SPEED_RAMP);
    this.spawnT = 0.4;
    this.waveDelay = 1.3;
  }

  bannedFirstLetters() {
    const banned = new Set();
    for (const e of this.enemies) {
      if (e.dead) continue;
      for (const w of e.words) banned.add(w[0]);
    }
    return banned;
  }

  spawnEnemy(type) {
    const banned = this.bannedFirstLetters();
    let words;
    if (type === 'boss') {
      words = BOSS_SENTENCES[(Math.random() * BOSS_SENTENCES.length) | 0].slice();
    } else {
      let tier = C.ENEMIES[type].tier;
      if (type === 'walker' && this.wave >= 6 && Math.random() < 0.28) tier = 2;
      tier = Math.max(0, tier - this.up.sharp);
      if (type === 'brute') {
        const w1 = pickWord(tier, banned);
        banned.add(w1[0]);
        words = [w1, pickWord(Math.max(0, tier - 1), banned)];
      } else {
        words = [pickWord(tier, banned)];
      }
    }
    this.enemies.push(new Enemy(this, type, words));
  }

  spawnOrb(boss) {
    const banned = this.bannedFirstLetters();
    const o = new Enemy(this, 'orb', [pickWord(0, banned)]);
    o.x = boss.x - 34 * boss.su;
    o.y = boss.hitY() - 24 * this.scale;
    o.baseY = o.y;
    this.enemies.push(o);
    this.audio.windup();
  }

  countOrbs() {
    let n = 0;
    for (const e of this.enemies) if (e.type === 'orb' && !e.dead) n++;
    return n;
  }

  waveCleared() {
    const options = rollUpgrades(this);
    if (!options.length) {
      this.nextWave();
      return;
    }
    this.state = 'upgrade';
    this.timeScaleTarget = C.SLOWMO_UPGRADE;
    this.upgradeChoices = options;
    this.audio.upgradeShow();
    this.ui.onPick = (i) => this.pickUpgrade(i);
    this.ui.showUpgrades(options, this.up);
  }

  pickUpgrade(i) {
    const u = this.upgradeChoices && this.upgradeChoices[i];
    if (!u) return;
    this.up[u.id]++;
    if (u.id === 'heart') {
      this.hearts = Math.min(this.heartCap, this.hearts + 1);
      this.ui.setHearts(this.hearts, this.heartCap);
      this.audio.heart();
    } else {
      this.audio.upgradePick();
    }
    this.upgradeChoices = null;
    this.ui.hideUpgrades();
    this.ui.show(null);
    this.state = 'playing';
    this.timeScaleTarget = 1;
    this.nextWave();
  }

  // ------------------------------------------------------------------ input
  onKey(e) {
    const k = e.key;
    switch (this.state) {
      case 'start':
        if (k.length === 1 || k === 'Enter') this.startRun();
        return true;
      case 'over':
        if (k === 'Enter' || k === ' ') {
          this.startRun();
          return true;
        }
        return false;
      case 'paused':
        if (k === 'Escape') this.resume();
        return true;
      case 'upgrade': {
        if (k === '1' || k === '2' || k === '3') {
          this.pickUpgrade(Number(k) - 1);
          return true;
        }
        return false;
      }
      case 'playing': {
        if (k === 'Escape') {
          this.pause();
          return true;
        }
        if (k.length === 1) {
          // letters shoot; other printables are swallowed without penalty
          if (/[a-z]/i.test(k)) this.typeLetter(k.toLowerCase());
          return true;
        }
        return false;
      }
    }
    return false;
  }

  pause() {
    this.state = 'paused';
    this.ui.show('pause');
  }

  resume() {
    this.state = 'playing';
    this.ui.show(null);
  }

  // nearest live enemy whose word starts with this letter
  acquire(ch) {
    let best = null;
    for (const e of this.enemies) {
      if (e.dead || e.doomed || !e.word) continue;
      if (e.x > this.w + 10) continue;
      if (e.word[0] !== ch) continue;
      if (!best || e.x < best.x) best = e;
    }
    return best;
  }

  typeLetter(ch) {
    this.stats.keys++;
    const t = this.target;
    if (t && !t.dead && t.word) {
      if (t.word[t.progress] === ch) return this.correctLetter(t);
      // free retarget window: nothing committed to this word yet, so a
      // letter that starts another enemy's word switches the lock
      // (lets you shoot down boss orbs between sentence words)
      if (t.progress === 0) {
        const other = this.acquire(ch);
        if (other && other !== t) {
          this.target = other;
          other.progress = 0;
          this.audio.lock();
          return this.correctLetter(other);
        }
      }
      return this.mistake();
    }
    const best = this.acquire(ch);
    if (best) {
      this.target = best;
      best.progress = 0;
      this.audio.lock();
      return this.correctLetter(best);
    }
    return this.mistake();
  }

  correctLetter(t) {
    t.progress++;
    t.popT = 0.14;
    this.stats.correctChars++;
    this.audio.tick(t.progress / t.word.length);
    this.player.setDraw(t.progress / t.word.length);
    if (t.progress >= t.word.length) this.completeWord(t);
  }

  completeWord(t) {
    t.lastWord = t.word;
    t.words.shift();
    t.progress = 0;
    this.stats.words++;

    this.player.release();
    this.audio.loose();
    const tip = this.player.bowHand;
    const flame = this.up.flame > 0;
    this.projectiles.fireArrow(tip.x, tip.y, t, { flame });

    // quickdraw bonus volley
    if (this.up.quickdraw > 0 && this.time - this.lastWordTime < C.QUICKDRAW_WINDOW) {
      let fired = 0;
      for (let i = 0; i < this.up.quickdraw; i++) {
        const other = this.nearestEnemyTo(this.player.x, this.groundY, t);
        const victim = other || (t.words.length > 0 ? t : null);
        if (!victim) break;
        this.projectiles.fireArrow(tip.x, tip.y - (i + 1) * 7, victim, { flame, bonus: true });
        fired++;
      }
      if (fired) {
        this.particles.floatText(tip.x + 30, tip.y - 34, 'volley!', { color: '#7ee8fa', size: 13, life: 0.7 });
      }
    }
    this.lastWordTime = this.time;

    // combo
    this.streak++;
    const newMult = Math.min(C.MAX_MULT, 1 + Math.floor(this.streak / C.COMBO_STEP));
    if (newMult > this.mult) {
      this.mult = newMult;
      this.audio.comboUp(newMult);
      this.particles.floatText(this.player.x, this.groundY - 120 * this.scale, `combo x${newMult}`, {
        color: '#ff8c42',
        size: 16,
        life: 1,
      });
    }
    this.ui.setCombo(this.mult, this.mult >= C.MAX_MULT ? 1 : (this.streak % C.COMBO_STEP) / C.COMBO_STEP);

    if (t.words.length === 0) {
      // the killing arrow is in flight — stop targeting this one
      this.target = null;
      this.player.setDraw(0);
    }
  }

  mistake() {
    this.stats.errors++;

    // Second Wind: first typo of the wave becomes a real arrow
    if (this.up.secondwind > 0 && !this.secondWindUsed) {
      this.secondWindUsed = true;
      const tip = this.player.bowHand;
      const victim = this.nearestEnemyTo(this.player.x, this.groundY, null);
      if (victim) {
        this.projectiles.fireArrow(tip.x, tip.y, victim, { flame: this.up.flame > 0, bonus: true });
      }
      this.player.release();
      this.audio.loose();
      this.particles.floatText(this.player.x, this.groundY - 120 * this.scale, 'second wind!', {
        color: '#7ee8fa',
        size: 14,
        life: 1,
      });
      return;
    }

    // the fumble: a paper airplane that has never hurt anyone
    this.audio.fumble();
    this.player.stagger();
    this.projectiles.throwPlane(this.player.bowHand.x, this.player.bowHand.y - 6);

    const t = this.target;
    if (t) {
      t.progress = 0;
      this.target = null;
    }
    if (this.mult > 1 || this.streak > 0) {
      if (this.mult > 1) {
        this.audio.comboBreak();
        this.particles.burst(this.player.x, this.groundY - 50 * this.scale, {
          color: 'rgba(160,150,170,0.9)',
          count: 8,
          speed: 90,
          gravity: -40,
          life: 0.7,
        });
        this.ui.comboBreak();
      }
      this.streak = 0;
      this.mult = 1;
      this.ui.setCombo(1, 0);
    }
  }

  nearestEnemyTo(x, y, exclude) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e === exclude || e.dead || e.doomed) continue;
      if (e.x > this.w + 10) continue;
      const d = (e.x - x) * (e.x - x) + (e.hitY() - y) * (e.hitY() - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  // ----------------------------------------------------------------- combat
  onArrowHit(t, arrow) {
    if (t.dead) return;
    this.audio.hit();
    t.staggerT = 0.35;

    const isBoss = t.type === 'boss';
    this.hitStop = Math.max(this.hitStop, isBoss ? C.HITSTOP_BIG : C.HITSTOP_KILL);
    this.addShake(isBoss ? 5 : C.SHAKE_KILL);
    this.particles.burst(t.x, t.hitY(), {
      color: t.color,
      count: isBoss ? 22 : 13,
      angle: Math.atan2(arrow.vy, arrow.vx),
      spread: 2.4,
      speed: 260,
    });

    // flaming arrows ignite the neighborhood
    if (arrow.flame) {
      const r = (75 + 25 * this.up.flame) * this.scale;
      for (const e of this.enemies) {
        if (e.dead || e.doomed || e === t) continue;
        const dx = e.x - t.x;
        const dy = e.hitY() - t.hitY();
        if (dx * dx + dy * dy < r * r && e.burnT < 0) {
          e.burnT = 1.8;
          this.audio.ignite();
        }
      }
    }

    if (arrow.bonus) {
      // bonus arrows chip words from the back of the queue
      if (t.words.length > 0) t.words.pop();
      if (t.words.length === 0) {
        if (this.target === t) {
          this.target = null;
          this.player.setDraw(0);
        }
        this.killEnemy(t, arrow);
      }
      return;
    }

    // typed arrow: the word was already consumed at completion time
    if (t.words.length === 0) this.killEnemy(t, arrow);
  }

  burnTick(e) {
    if (e.dead) return;
    if (e.words.length > 0) e.words.pop();
    this.particles.burst(e.x, e.hitY(), { color: '#ff8c42', count: 10, speed: 160, gravity: -80 });
    this.audio.ignite();
    if (e.words.length === 0) {
      if (this.target === e) {
        this.target = null;
        this.player.setDraw(0);
      }
      this.killEnemy(e, null);
    }
  }

  killEnemy(t, arrow) {
    if (t.dead) return;
    t.dead = true;
    if (this.target === t) {
      this.target = null;
      this.player.setDraw(0);
    }

    // score with combo multiplier
    const pts = C.ENEMIES[t.type].score * this.mult;
    this.score += pts;
    this.ui.setScore(this.score);
    const tag = t.tagPos();
    this.particles.floatText(t.x, tag.y - 22, `+${pts}`, {
      color: this.mult > 1 ? '#ff8c42' : '#ffc14d',
      size: 13 + this.mult * 2,
      life: 0.9,
    });

    // the word tag shatters into flying letters
    const shatter = t.word || t.lastWord || '';
    if (shatter) this.particles.letterShatter(tag.x, tag.y, shatter, '#ffc14d');

    // ragdoll tumble
    const ang = arrow ? Math.atan2(arrow.vy, arrow.vx) : -0.6;
    this.ragdolls.push(new Ragdoll(t, Math.cos(ang), Math.sin(ang)));
    if (this.ragdolls.length > C.MAX_RAGDOLLS) this.ragdolls.shift();

    const idx = this.enemies.indexOf(t);
    if (idx >= 0) this.enemies.splice(idx, 1);

    // multishot fork — typed kills only, no chain reactions
    if (arrow && !arrow.bonus && this.up.multishot > 0) {
      for (let i = 0; i < this.up.multishot; i++) {
        const o = this.nearestEnemyTo(t.x, t.hitY(), null);
        if (!o) break;
        this.projectiles.fireArrow(t.x, t.hitY(), o, { bonus: true, flame: this.up.flame > 0 });
      }
    }

    if (t.type === 'boss') {
      this.audio.bossDown();
      this.hitStop = Math.max(this.hitStop, C.HITSTOP_BIG);
      this.addShake(C.SHAKE_MAX);
      this.slowmo(C.SLOWMO_BOSS_DEATH, 1.0);
      this.particles.burst(t.x, t.hitY(), { color: t.color, count: 46, speed: 420, size: 5 });
      this.particles.burst(t.x, t.hitY(), { color: '#ffc14d', count: 30, speed: 320 });
      // his orbs die with him
      for (const e of [...this.enemies]) {
        if (e.type === 'orb') this.vaporize(e, 8);
      }
    }
  }

  vaporize(e, n) {
    if (e.dead) return;
    e.dead = true;
    if (this.target === e) {
      this.target = null;
      this.player.setDraw(0);
    }
    this.particles.burst(e.x, e.hitY(), { color: e.color, count: n, speed: 200, gravity: 100 });
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
  }

  bomberDetonate(b) {
    this.audio.explosion();
    this.addShake(C.SHAKE_MAX);
    this.hitStop = Math.max(this.hitStop, C.HITSTOP_BIG);
    this.particles.burst(b.x, b.hitY(), { color: '#ffd166', count: 34, speed: 400, size: 5 });
    this.particles.burst(b.x, b.hitY(), { color: '#ff8c42', count: 22, speed: 300, size: 6 });
    this.particles.floatText(b.x, b.hitY() - 30, 'boom', { color: '#ff5c7a', size: 18, life: 0.8 });
    this.vaporize(b, 12);
    this.damagePlayer(b);
  }

  damagePlayer(src) {
    if (this.state !== 'playing') return;
    if (this.player.invuln > 0) return;
    this.hearts--;
    this.player.hurt();
    this.audio.hurt();
    this.addShake(C.SHAKE_HURT);
    this.damageFlash = 0.5;
    this.particles.burst(this.player.x, this.groundY - 45 * this.scale, {
      color: '#ff5c7a',
      count: 16,
      speed: 240,
    });
    this.ui.setHearts(this.hearts, this.heartCap);
    if (this.hearts <= 0) this.gameOver();
  }

  gameOver() {
    this.state = 'over';
    this.audio.gameOver();
    this.timeScaleTarget = 1;
    this.target = null;
    const isNewBest = this.score > this.best;
    if (isNewBest) {
      this.best = this.score;
      localStorage.setItem('quillshot-best', String(this.best));
    }
    this.ui.setHudVisible(false);
    this.ui.showGameOver({
      score: this.score,
      best: this.best,
      isNewBest,
      wave: this.wave,
      wpm: this.wpm(),
      acc: this.acc(),
    });
  }

  wpm() {
    if (this.stats.activeTime < 2) return 0;
    return Math.round(this.stats.correctChars / 5 / (this.stats.activeTime / 60));
  }

  acc() {
    if (this.stats.keys === 0) return 100;
    return Math.round((100 * this.stats.correctChars) / this.stats.keys);
  }

  // ------------------------------------------------------------------- feel
  addShake(px) {
    this.shakeAmp = Math.min(C.SHAKE_MAX, Math.max(this.shakeAmp * Math.exp(-this.shakeT * 6.5), 0) + px);
    this.shakeT = 0;
  }

  slowmo(scale, duration) {
    this.timeScaleTarget = scale;
    this.slowmoT = duration;
  }

  // ------------------------------------------------------------------ update
  update(dtRaw) {
    const dt = Math.min(dtRaw, 1 / 30); // clamp tab-switch spikes
    this.time += dt;

    // eased global timescale (upgrade slow-mo, boss death slow-mo)
    this.timeScale += (this.timeScaleTarget - this.timeScale) * (1 - Math.exp(-8 * dt));
    if (this.slowmoT > 0) {
      this.slowmoT -= dt;
      if (this.slowmoT <= 0 && this.state === 'playing') this.timeScaleTarget = 1;
    }

    // damped-sine shake decays in real time
    this.shakeT += dt;
    const amp = this.shakeAmp * Math.exp(-this.shakeT * 6.5);
    this.shakeX = amp * Math.sin(this.shakeT * 55);
    this.shakeY = amp * Math.cos(this.shakeT * 47) * 0.7;
    this.damageFlash = Math.max(0, this.damageFlash - dt);

    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    if (this.state === 'paused') return;

    const sdt = dt * this.timeScale;

    this.particles.update(sdt);
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      if (!this.ragdolls[i].update(sdt)) this.ragdolls.splice(i, 1);
    }
    this.projectiles.update(sdt);
    this.player.update(sdt);

    if (this.state !== 'playing') return;

    this.stats.activeTime += dt;

    // spawning
    if (this.waveDelay > 0) {
      this.waveDelay -= sdt;
    } else if (this.spawnQueue.length) {
      if (this.enemies.length < 16) {
        this.spawnT -= sdt;
        if (this.spawnT <= 0) {
          this.spawnEnemy(this.spawnQueue.shift());
          this.spawnT = this.spawnInterval * (0.7 + Math.random() * 0.6);
        }
      }
    } else if (this.enemies.length === 0) {
      this.waveCleared();
      return;
    }

    for (const e of [...this.enemies]) {
      if (!e.dead) e.update(sdt);
    }

    // combo flame embers rising off the archer
    if (this.mult > 1 && Math.random() < this.mult * 5 * sdt) {
      this.particles.ember(
        this.player.x + (Math.random() - 0.5) * 26 * this.scale,
        this.groundY - Math.random() * 60 * this.scale,
        this.mult >= 4 ? '#ffc14d' : '#ff8c42',
        70,
      );
    }

    // live WPM / accuracy readout
    this.statT -= dt;
    if (this.statT <= 0) {
      this.statT = 0.45;
      this.ui.setStats(this.wpm(), this.acc());
    }
  }

  // ------------------------------------------------------------------ render
  render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    this.bg.render(ctx, this.time, this.shakeX, this.shakeY);

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    // subtle lock-on line from bow to target
    const t = this.target;
    if (t && !t.dead && this.state === 'playing') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,193,77,0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 9]);
      ctx.lineDashOffset = -this.time * 60;
      ctx.beginPath();
      ctx.moveTo(this.player.bowHand.x, this.player.bowHand.y);
      ctx.lineTo(t.x, t.hitY());
      ctx.stroke();
      ctx.restore();
      // chevron above the target's tag
      const tag = t.tagPos();
      const bobY = tag.y - 26 - Math.abs(Math.sin(this.time * 5.2)) * 5;
      ctx.fillStyle = C.COLORS.gold;
      ctx.beginPath();
      ctx.moveTo(tag.x - 7, bobY - 8);
      ctx.lineTo(tag.x + 7, bobY - 8);
      ctx.lineTo(tag.x, bobY);
      ctx.closePath();
      ctx.fill();
    }

    for (const r of this.ragdolls) r.render(ctx);
    for (const e of this.enemies) e.renderBody(ctx);
    if (this.state !== 'over') this.player.render(ctx);
    this.projectiles.render(ctx);
    this.particles.render(ctx);
    for (const e of this.enemies) e.renderTag(ctx);

    ctx.restore();

    // damage flash
    if (this.damageFlash > 0) {
      ctx.fillStyle = `rgba(255,60,90,${(this.damageFlash / 0.5) * 0.28})`;
      ctx.fillRect(0, 0, w, h);
    }

    // last-heart vignette pulse
    if (this.hearts === 1 && (this.state === 'playing' || this.state === 'upgrade' || this.state === 'paused')) {
      const a = 0.2 + 0.1 * Math.sin(this.time * 5.5);
      const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.72);
      grad.addColorStop(0, 'rgba(120,10,30,0)');
      grad.addColorStop(1, `rgba(120,10,30,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
