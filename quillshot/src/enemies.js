// The horde: procedurally animated stickman variants with words overhead.
// Each type has a distinct silhouette and gait. Death hands the body to a
// Ragdoll for a limp physics tumble.

import { CONFIG as C } from './config.js';
import { seg, limb, head, inkStyle } from './stickman.js';

let NEXT_ID = 1;

// per-type body metrics at scale 1 (multiplied by game.scale * typeScale)
const BODY = {
  walker: { scale: 1, lw: 3.2, tagH: 92, chest: 34 },
  runner: { scale: 0.92, lw: 2.8, tagH: 78, chest: 28 },
  brute: { scale: 1.5, lw: 5.5, tagH: 94, chest: 38 },
  bomber: { scale: 1, lw: 3.2, tagH: 108, chest: 34 },
  flyer: { scale: 0.95, lw: 2.8, tagH: 48, chest: 0 },
  orb: { scale: 1, lw: 2, tagH: 28, chest: 0 },
  boss: { scale: 2.3, lw: 6.5, tagH: 98, chest: 46 },
  runebearer: { scale: 1, lw: 3.4, tagH: 92, chest: 34 },
};

export class Enemy {
  constructor(game, type, words) {
    this.id = NEXT_ID++;
    this.game = game;
    this.type = type;
    this.cfg = C.ENEMIES[type];
    this.body = BODY[type];
    this.color = C.COLORS[type];
    this.words = words.slice();
    this.totalWords = words.length;
    this.progress = 0;
    this.dead = false;
    this.x = game.w + 70;
    this.y = game.groundY; // feet for grounded, body center for flyer/orb
    this.walkPhase = Math.random() * Math.PI * 2;
    this.sineT = Math.random() * Math.PI * 2;
    this.mode = 'walk'; // walk | windup | recover
    this.modeT = 0;
    this.strikeT = 0;
    this.staggerT = 0;
    this.popT = 0; // tag pop on typed letter
    this.burnT = -1; // >=0 → burning, fires at 0
    this.tagLane = this.id % 3;

    const su = game.scale * this.body.scale;
    if (type === 'flyer') {
      this.baseY = game.groundY - (95 + Math.random() * 70) * game.scale;
      this.y = this.baseY;
    } else if (type === 'orb') {
      this.baseY = game.groundY - (60 + Math.random() * 90) * game.scale;
      this.y = this.baseY;
    }
    if (type === 'bomber') {
      this.fuseMax = Math.max(C.BOMBER_FUSE_MIN, C.BOMBER_FUSE - game.wave * 0.18);
      this.fuse = this.fuseMax;
      this.beepT = 0;
    }
    if (type === 'boss') {
      this.orbTimer = C.BOSS_ORB_INTERVAL * 0.6;
      this.stopped = false;
      this.hurlT = 0;
    }
    this.su = su;
  }

  get word() {
    return this.words[0] || null;
  }

  // no words left — an arrow is already in flight to finish this one off
  get doomed() {
    return this.words.length === 0;
  }

  hitY() {
    if (this.type === 'flyer' || this.type === 'orb') return this.y;
    return this.y - this.body.chest * this.su;
  }

  tagPos() {
    const g = this.game;
    return {
      x: this.x,
      y: this.y - this.body.tagH * this.su - this.tagLane * 15 * g.scale,
    };
  }

  update(dt) {
    const g = this.game;
    this.sineT += dt;
    this.popT = Math.max(0, this.popT - dt);
    this.staggerT = Math.max(0, this.staggerT - dt);
    this.strikeT = Math.max(0, this.strikeT - dt);

    // runebearers shed golden motes as they walk
    if (this.type === 'runebearer' && Math.random() < 9 * dt) {
      g.particles.ember(
        this.x + (Math.random() - 0.5) * 24 * this.su,
        this.y - (14 + Math.random() * 46) * this.su,
        '#ffdf70',
        36,
      );
    }

    // burning: emit fire, then take the hit
    if (this.burnT >= 0) {
      this.burnT -= dt;
      if (Math.random() < 12 * dt) {
        g.particles.ember(this.x, this.hitY(), Math.random() < 0.5 ? '#ff8c42' : '#ffc14d');
      }
      if (this.burnT < 0) g.burnTick(this);
      if (this.dead) return;
    }

    const speedScale = g.w / 1280;
    let speed = this.cfg.speed * speedScale * g.speedRamp;
    if (g.target === this && g.frostLv > 0) {
      speed *= Math.max(0.25, 1 - (0.35 + 0.15 * (g.frostLv - 1)));
    }
    if (this.staggerT > 0) speed *= 0.25;

    const su = this.su;
    const reach = g.player.x + (this.type === 'brute' ? 40 : 28) * su;

    switch (this.type) {
      case 'flyer': {
        if (this.mode !== 'walk' || this.x <= reach) {
          this.meleeUpdate(dt, g); // hovers in place and claws at the archer
        } else {
          this.x -= speed * dt;
        }
        // swoop toward the archer when close
        if (this.x < g.player.x + 190 * g.scale) {
          const swoopY = g.groundY - 46 * g.scale;
          this.baseY += (swoopY - this.baseY) * (1 - Math.exp(-1.6 * dt));
        }
        this.y = this.baseY + Math.sin(this.sineT * 1.9) * 20 * g.scale;
        this.walkPhase += dt * 6;
        break;
      }
      case 'orb': {
        // homing wobble toward the archer's chest
        const tx = g.player.x;
        const ty = g.groundY - 50 * g.scale;
        let dx = tx - this.x;
        let dy = ty - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.x += (dx / d) * speed * dt;
        this.y += (dy / d) * speed * dt + Math.sin(this.sineT * 7) * 26 * dt;
        if (Math.random() < 20 * dt) {
          g.particles.spawn({
            x: this.x, y: this.y, vx: 30, vy: (Math.random() - 0.5) * 20,
            life: 0.35, size: 4, color: this.color, gravity: 0, drag: 2,
          });
        }
        if (d < 26 * g.scale) {
          g.damagePlayer(this);
          g.vaporize(this, 10);
        }
        return; // orbs don't melee / walk
      }
      case 'boss': {
        if (!this.stopped) {
          this.x -= speed * dt;
          this.walkPhase += (speed / (16 * su)) * dt;
          if (this.x <= g.w * C.BOSS_STOP_FRAC) {
            this.stopped = true;
            g.audio.bossRoar();
            g.addShake(4);
          }
        } else {
          this.hurlT = Math.max(0, this.hurlT - dt);
          this.orbTimer -= dt;
          if (this.orbTimer <= 0 && !this.doomed) {
            this.orbTimer = C.BOSS_ORB_INTERVAL * (0.85 + Math.random() * 0.4);
            if (g.countOrbs() < C.BOSS_ORB_MAX) {
              this.hurlT = 0.35;
              g.spawnOrb(this);
            }
          }
        }
        return;
      }
      default: {
        // grounded melee types
        if (this.mode === 'walk' && this.x > reach) {
          this.x -= speed * dt;
          this.walkPhase += (speed / (11 * su)) * dt;
        } else {
          this.meleeUpdate(dt, g);
        }
      }
    }

    // bomber fuse
    if (this.type === 'bomber' && !this.dead && !this.doomed) {
      if (this.x < g.w) {
        this.fuse -= dt;
        this.beepT -= dt;
        const urgent = this.fuse < 2.2;
        if (this.beepT <= 0) {
          this.beepT = urgent ? 0.22 : 0.85;
          g.audio.fuseBeep(urgent);
        }
        if (this.fuse <= 0) g.bomberDetonate(this);
      }
    }
  }

  // ------------------------------------------------------------------ body
  renderBody(ctx) {
    const g = this.game;
    const su = this.su;
    const t = g.time;

    ctx.save();
    ctx.translate(this.x, this.y);

    // squash & stretch on arrow impact (staggerT set by game)
    if (this.staggerT > 0) {
      const st = this.staggerT / 0.35;
      ctx.scale(1 + 0.28 * st, 1 - 0.24 * st);
    }

    const flash = this.staggerT > 0.24;
    const ink = flash ? '#ffffff' : this.color;
    inkStyle(ctx, ink, this.body.lw * g.scale);

    switch (this.type) {
      case 'orb': this.drawOrb(ctx, su, t, ink); break;
      case 'flyer': this.drawFlyer(ctx, su, t, ink); break;
      case 'runner': this.drawRunner(ctx, su, ink); break;
      case 'brute': this.drawBrute(ctx, su, ink); break;
      case 'bomber': this.drawBomber(ctx, su, t, ink); break;
      case 'boss': this.drawBoss(ctx, su, t, ink); break;
      case 'runebearer':
        this.drawRuneAura(ctx, su, t);
        this.drawWalker(ctx, su, ink);
        this.drawRuneRing(ctx, su, t);
        break;
      default: this.drawWalker(ctx, su, ink); break;
    }

    ctx.restore();
  }

  // shared melee state machine: windup (anticipation) → strike → recover
  meleeUpdate(dt, g) {
    if (this.mode === 'walk') {
      this.mode = 'windup';
      this.modeT = C.ATTACK_WINDUP;
      g.audio.windup();
    } else if (this.mode === 'windup') {
      this.modeT -= dt;
      if (this.modeT <= 0) {
        this.strikeT = 0.16;
        g.damagePlayer(this);
        this.mode = 'recover';
        this.modeT = C.ATTACK_COOLDOWN;
      }
    } else {
      this.modeT -= dt;
      if (this.modeT <= 0) {
        this.mode = 'windup';
        this.modeT = C.ATTACK_WINDUP;
      }
    }
  }

  // melee arm pose: 0 = none, ramps up in windup, snaps forward on strike
  meleePose() {
    if (this.strikeT > 0) return { raise: -0.6, active: true };
    if (this.mode === 'windup') return { raise: 1 - this.modeT / C.ATTACK_WINDUP, active: true };
    return { raise: 0, active: false };
  }

  drawWalker(ctx, su, ink) {
    const ph = this.walkPhase;
    const hipY = -36 * su;
    const bob = Math.abs(Math.sin(ph)) * -2.5 * su;
    const hip = { x: 0, y: hipY + bob };
    const sh = { x: -2 * su, y: hipY - 22 * su + bob };
    // legs
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const fx = Math.cos(p) * 11 * su;
      const fy = -Math.max(0, Math.sin(p)) * 7 * su;
      limb(ctx, hip.x, hip.y, fx, fy, 20 * su, 20 * su, 1);
    }
    seg(ctx, hip.x, hip.y, sh.x, sh.y);
    // arms (windup/strike overrides swing)
    const mp = this.meleePose();
    for (let i = 0; i < 2; i++) {
      let hx, hy;
      if (mp.active) {
        if (mp.raise < 0) {
          // strike: smash forward toward the archer (-x)
          hx = sh.x - 18 * su * (i ? 0.85 : 1);
          hy = sh.y + 4 * su;
        } else {
          // windup: arms raised up-and-behind (anticipation)
          hx = sh.x + (6 + mp.raise * 10) * su * (i ? 0.9 : 1);
          hy = sh.y - mp.raise * 16 * su;
        }
      } else {
        const p = ph + i * Math.PI;
        hx = sh.x + Math.cos(p + Math.PI) * 8 * su;
        hy = sh.y + 18 * su - Math.max(0, Math.sin(p + Math.PI)) * 4 * su;
      }
      limb(ctx, sh.x, sh.y, hx, hy, 14 * su, 14 * su, -1);
    }
    head(ctx, sh.x - 1 * su, sh.y - 11 * su, 7 * su);
  }

  drawRunner(ctx, su, ink) {
    const ph = this.walkPhase * 1.6;
    const hipY = -32 * su;
    const bob = Math.abs(Math.sin(ph)) * -3.5 * su;
    const hip = { x: 2 * su, y: hipY + bob };
    const sh = { x: -11 * su, y: hipY - 17 * su + bob }; // hunched forward
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const fx = hip.x + Math.cos(p) * 16 * su - 3 * su;
      const fy = -Math.max(0, Math.sin(p)) * 11 * su;
      limb(ctx, hip.x, hip.y, fx, fy, 19 * su, 19 * su, 1);
    }
    seg(ctx, hip.x, hip.y, sh.x, sh.y);
    // pumping bent arms
    const mp = this.meleePose();
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const hx = mp.active
        ? sh.x - 16 * su
        : sh.x + Math.cos(p) * 9 * su - 4 * su;
      const hy = mp.active ? sh.y - 4 * su : sh.y + 6 * su + Math.sin(p) * 4 * su;
      limb(ctx, sh.x, sh.y, hx, hy, 12 * su, 12 * su, -1);
    }
    head(ctx, sh.x - 7 * su, sh.y - 8 * su, 6.5 * su);
  }

  drawBrute(ctx, su, ink) {
    const ph = this.walkPhase;
    const hipY = -40 * su;
    const bob = Math.abs(Math.sin(ph)) * -2 * su;
    const hip = { x: 0, y: hipY + bob };
    const sh = { x: -2 * su, y: hipY - 24 * su + bob };
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const fx = Math.cos(p) * 12 * su;
      const fy = -Math.max(0, Math.sin(p)) * 5 * su;
      limb(ctx, hip.x, hip.y, fx, fy, 22 * su, 22 * su, 1);
    }
    seg(ctx, hip.x, hip.y, sh.x, sh.y);
    // massive shoulder bar
    seg(ctx, sh.x - 10 * su, sh.y, sh.x + 10 * su, sh.y);
    // heavy hanging arms with fist knobs
    const mp = this.meleePose();
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      let hx, hy;
      if (mp.active) {
        hx = sh.x - (mp.raise < 0 ? 26 : 6 + mp.raise * 4) * su;
        hy = sh.y + (mp.raise < 0 ? 2 : -14 * mp.raise) * su;
      } else {
        hx = sh.x + side * 12 * su + Math.cos(ph + i * Math.PI) * 3 * su;
        hy = sh.y + 24 * su;
      }
      limb(ctx, sh.x + side * 9 * su, sh.y, hx, hy, 16 * su, 16 * su, -side);
      ctx.beginPath();
      ctx.arc(hx, hy, 3.6 * su, 0, Math.PI * 2);
      ctx.stroke();
    }
    head(ctx, sh.x, sh.y - 10 * su, 6.5 * su);
  }

  drawBomber(ctx, su, t, ink) {
    this.drawWalkerCore(ctx, su, ink);
    // bomb held overhead
    const bx = 2 * su;
    const by = -78 * su;
    const sh = { x: -2 * su, y: -58 * su };
    limb(ctx, sh.x, sh.y, bx - 2 * su, by + 8 * su, 14 * su, 14 * su, 1);
    ctx.beginPath();
    ctx.arc(bx, by, 7.5 * su, 0, Math.PI * 2);
    ctx.stroke();
    // blinking pixel fuse — blinks faster as the fuse runs out
    const frac = this.fuse / this.fuseMax;
    const on = Math.sin(t * (5 + (1 - frac) * 26)) > 0;
    if (on) {
      ctx.fillStyle = frac < 0.3 ? '#ff5c7a' : '#ffc14d';
      ctx.fillRect(bx - 2 * su, by - 12 * su, 4 * su, 4 * su);
    }
  }

  // walker body without arms-in-swing (bomber reuses legs/torso/head)
  drawWalkerCore(ctx, su, ink) {
    const ph = this.walkPhase;
    const hipY = -36 * su;
    const bob = Math.abs(Math.sin(ph)) * -2.5 * su;
    const hip = { x: 0, y: hipY + bob };
    const sh = { x: -2 * su, y: hipY - 22 * su + bob };
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const fx = Math.cos(p) * 11 * su;
      const fy = -Math.max(0, Math.sin(p)) * 7 * su;
      limb(ctx, hip.x, hip.y, fx, fy, 20 * su, 20 * su, 1);
    }
    seg(ctx, hip.x, hip.y, sh.x, sh.y);
    // free arm swings
    const p = ph + Math.PI;
    limb(ctx, sh.x, sh.y, sh.x + Math.cos(p) * 8 * su, sh.y + 18 * su, 14 * su, 14 * su, -1);
    head(ctx, sh.x - 1 * su, sh.y - 11 * su, 7 * su);
  }

  drawFlyer(ctx, su, t, ink) {
    // body center at (0,0); wings flap, legs dangle limp
    const flap = Math.sin(this.walkPhase * 2.6);
    const sh = { x: 0, y: -8 * su };
    const hip = { x: 1 * su, y: 8 * su };
    seg(ctx, hip.x, hip.y, sh.x, sh.y);
    // wing arms
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const hx = sh.x + side * 16 * su;
      const hy = sh.y - 4 * su - flap * 8 * su;
      limb(ctx, sh.x, sh.y, hx, hy, 10 * su, 10 * su, side);
      // wing membrane hint
      ctx.globalAlpha *= 0.4;
      seg(ctx, hx, hy, sh.x + side * 6 * su, sh.y + 6 * su);
      ctx.globalAlpha /= 0.4;
    }
    // dangling legs
    for (let i = 0; i < 2; i++) {
      const sway = Math.sin(t * 2 + i * 1.7 + this.id) * 3 * su;
      limb(ctx, hip.x, hip.y, hip.x + sway, hip.y + 20 * su, 11 * su, 11 * su, i ? 1 : -1);
    }
    head(ctx, sh.x - 1 * su, sh.y - 9 * su, 6 * su);
  }

  drawOrb(ctx, su, t, ink) {
    const s = 9 * this.game.scale;
    ctx.fillStyle = ink;
    ctx.save();
    ctx.rotate(t * 3 + this.id);
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha *= 0.6;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  drawBoss(ctx, su, t, ink) {
    const ph = this.walkPhase;
    const idle = this.stopped ? Math.sin(t * 1.7) * 2 * su * 0.3 : 0;
    const hipY = -42 * su + idle;
    const bob = this.stopped ? 0 : Math.abs(Math.sin(ph)) * -2 * su;
    const hip = { x: 0, y: hipY + bob };
    const sh = { x: -3 * su, y: hipY - 26 * su + bob };
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const fx = this.stopped ? (i ? 10 : -10) * su : Math.cos(p) * 12 * su;
      const fy = this.stopped ? 0 : -Math.max(0, Math.sin(p)) * 4 * su;
      limb(ctx, hip.x, hip.y, fx, fy, 23 * su, 23 * su, 1);
    }
    seg(ctx, hip.x, hip.y, sh.x, sh.y);
    seg(ctx, sh.x - 12 * su, sh.y, sh.x + 12 * su, sh.y);
    // arms: hurl animation when throwing an orb
    const hurl = this.hurlT > 0 ? this.hurlT / 0.35 : 0;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      let hx = sh.x + side * 14 * su;
      let hy = sh.y + 20 * su;
      if (i === 0 && hurl > 0) {
        // throwing arm sweeps overhead → forward
        hx = sh.x - Math.cos(hurl * 2.4) * 22 * su;
        hy = sh.y - Math.sin(hurl * 2.4) * 22 * su;
      }
      limb(ctx, sh.x + side * 10 * su, sh.y, hx, hy, 17 * su, 17 * su, -side);
    }
    // horned head with ember eyes
    const hx = sh.x;
    const hy = sh.y - 12 * su;
    head(ctx, hx, hy, 7.5 * su);
    seg(ctx, hx - 5 * su, hy - 5 * su, hx - 9 * su, hy - 12 * su);
    seg(ctx, hx + 5 * su, hy - 5 * su, hx + 9 * su, hy - 12 * su);
    ctx.fillStyle = '#ff5c7a';
    ctx.fillRect(hx - 4 * su, hy - 2 * su, 2.4 * su, 2.4 * su);
    ctx.fillRect(hx + 1.6 * su, hy - 2 * su, 2.4 * su, 2.4 * su);
  }

  // soft golden glow behind the runebearer
  drawRuneAura(ctx, su, t) {
    const cy = -34 * su;
    const r = (44 + Math.sin(t * 1.7 + this.id) * 5) * su;
    const gr = ctx.createRadialGradient(0, cy, 2, 0, cy, r);
    gr.addColorStop(0, 'rgba(255,223,112,0.22)');
    gr.addColorStop(1, 'rgba(255,223,112,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(-r, cy - r, r * 2, r * 2);
  }

  // floating ring of pixel runes orbiting the chest
  drawRuneRing(ctx, su, t) {
    const cy = -34 * su;
    const rx = 26 * su;
    const ry = 9 * su;
    ctx.fillStyle = '#ffdf70';
    for (let i = 0; i < 4; i++) {
      const a = t * 1.9 + (i * Math.PI) / 2 + this.id;
      const x = Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry - Math.sin(t * 2.3 + i) * 2 * su;
      const s = (Math.sin(a) > 0 ? 4.5 : 3) * su; // fake depth
      ctx.globalAlpha = Math.sin(a) > 0 ? 0.95 : 0.45;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a * 0.7);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ tag
  renderTag(ctx) {
    const g = this.game;
    const word = this.word;
    const { x, y } = this.tagPos();

    // boss health bar
    if (this.type === 'boss') {
      const bw = 150 * g.scale;
      const done = this.totalWords - this.words.length;
      const frac = 1 - done / this.totalWords;
      const by = y - 26 * g.scale;
      ctx.fillStyle = 'rgba(11,5,30,0.85)';
      ctx.fillRect(x - bw / 2 - 2, by - 2, bw + 4, 10 * g.scale + 4);
      ctx.fillStyle = '#3a2a63';
      ctx.fillRect(x - bw / 2, by, bw, 10 * g.scale);
      ctx.fillStyle = C.COLORS.bad;
      ctx.fillRect(x - bw / 2, by, bw * frac, 10 * g.scale);
    }

    if (!word) return;

    const isTarget = g.target === this;
    const isRune = this.type === 'runebearer';
    // EXTREME cipher tags render in the pixel font, where 0/O and 1/l/I are
    // genuinely ambiguous at a glance. That is the point.
    const cipher = g.diff.cipher && this.type !== 'boss';
    const fs = Math.round((isTarget ? 17 : 15) * Math.min(1.25, Math.max(0.85, g.scale)));
    ctx.font = cipher ? `${fs}px "Silkscreen", monospace` : `600 ${fs}px "JetBrains Mono", monospace`;
    const cw = ctx.measureText('0').width + (cipher ? 1.5 : 0);
    const padX = 9;
    const wpx = cw * word.length + padX * 2;
    const hpx = fs + 12;

    const pop = this.popT > 0 ? this.popT / 0.14 : 0;
    const scale = 1 + pop * 0.14;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // pill
    pill(ctx, -wpx / 2, -hpx / 2, wpx, hpx, hpx / 2);
    ctx.fillStyle = C.COLORS.tagBg;
    ctx.fill();
    ctx.lineWidth = isTarget || isRune ? 2.5 : 1.5;
    ctx.strokeStyle = isTarget ? C.COLORS.gold : this.color;
    ctx.globalAlpha = isTarget ? 1 : isRune ? 0.95 : 0.75;
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (isTarget || isRune) {
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.14 * Math.sin(g.time * (isRune && !isTarget ? 3.4 : 6.9));
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }

    // runebearer: golden ✦ diamond marks the power word
    if (isRune) {
      ctx.save();
      ctx.translate(-wpx / 2 - 13, 0);
      ctx.rotate(Math.PI / 4 + g.time * 1.7);
      ctx.fillStyle = '#ffdf70';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }

    // cipher enemies get a small "!?" hint — trust nothing you read
    if (cipher) {
      ctx.font = `700 ${Math.round(fs * 0.55)}px "Silkscreen", monospace`;
      ctx.fillStyle = '#c69bff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!?', wpx / 2 + 12, -hpx / 2 + 2);
      ctx.font = `${fs}px "Silkscreen", monospace`;
    }

    // word: typed prefix gold, rest ink — chars centered in fixed cells so
    // the pixel font's uneven advances can't wobble the layout
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const x0 = -wpx / 2 + padX;
    for (let i = 0; i < word.length; i++) {
      if (i < this.progress) {
        ctx.fillStyle = isRune ? '#ffdf70' : C.COLORS.gold;
      } else {
        ctx.fillStyle = isTarget ? '#ffffff' : isRune ? '#ffeeb0' : C.COLORS.ink;
        if (!isTarget) ctx.globalAlpha = 0.85;
      }
      const lift = i === this.progress - 1 && pop > 0 ? -3 * pop : 0;
      ctx.fillText(word[i], x0 + (i + 0.5) * cw, 1 + lift);
      ctx.globalAlpha = 1;
    }

    // extra-word dots for brutes / word count for boss
    if (this.words.length > 1) {
      ctx.fillStyle = this.color;
      const n = Math.min(6, this.words.length - 1);
      for (let i = 0; i < n; i++) {
        ctx.fillRect(-((n - 1) * 8) / 2 + i * 8 - 2, hpx / 2 + 5, 4, 4);
      }
    }

    // bomber fuse ring
    if (this.type === 'bomber') {
      const frac = Math.max(0, this.fuse / this.fuseMax);
      const rx = -wpx / 2 - 14;
      ctx.beginPath();
      ctx.arc(rx, 0, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245,236,215,0.25)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rx, 0, 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.strokeStyle = frac < 0.3 ? C.COLORS.bad : C.COLORS.bomber;
      ctx.stroke();
    }

    ctx.restore();
  }
}

function pill(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

// -------------------------------------------------------------- ragdolls
// A killed stickman goes limp: ballistic tumble, one ground bounce, fade.
export class Ragdoll {
  constructor(enemy, dirX, dirY) {
    this.type = enemy.type;
    this.color = enemy.color;
    this.su = enemy.su;
    this.lw = enemy.body.lw;
    this.scale = enemy.game.scale;
    this.groundY = enemy.game.groundY;
    this.x = enemy.x;
    this.y = enemy.type === 'flyer' || enemy.type === 'orb' ? enemy.y : enemy.y - 30 * enemy.su;
    this.vx = dirX * (140 + Math.random() * 120);
    this.vy = -160 - Math.random() * 160 + dirY * 80;
    this.rot = 0;
    this.vrot = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6);
    this.flail = Math.random() * 10;
    this.life = 1.25;
    this.bounced = false;
  }

  update(dt) {
    this.life -= dt;
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.vrot * dt;
    this.flail += dt * 14;
    const floor = this.groundY - 8 * this.su;
    if (this.y > floor && this.vy > 0) {
      this.y = floor;
      if (!this.bounced) {
        this.vy *= -0.38;
        this.vx *= 0.55;
        this.vrot *= 0.5;
        this.bounced = true;
      } else {
        this.vy = 0;
        this.vx *= 0.8;
        this.vrot *= 0.85;
      }
    }
    return this.life > 0;
  }

  render(ctx) {
    const su = this.su;
    const a = Math.min(1, this.life / 0.45);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    inkStyle(ctx, this.color, this.lw * this.scale);

    if (this.type === 'orb') {
      const s = 9 * this.scale;
      ctx.fillStyle = this.color;
      ctx.rotate(this.flail);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      return;
    }

    // limp flailing stickman around its center of mass
    const f = this.flail;
    seg(ctx, 0, -12 * su, 0, 10 * su); // torso
    head(ctx, Math.sin(f * 0.7) * 3 * su, -18 * su, 6.5 * su);
    for (let i = 0; i < 2; i++) {
      const p = f + i * 2.4;
      limb(ctx, 0, 10 * su, Math.cos(p) * 14 * su, 10 * su + Math.abs(Math.sin(p)) * 16 * su, 13 * su, 13 * su, i ? 1 : -1);
      limb(ctx, 0, -10 * su, Math.cos(p + 1.3) * 15 * su, -10 * su + Math.sin(p * 1.3) * 12 * su, 11 * su, 11 * su, i ? -1 : 1);
    }
    ctx.restore();
  }
}
