// The horde: procedurally drawn MONSTERS — smooth round-capped line art with
// per-spawn variation (size, hue, features) so no two look quite alike.
// walker = one-eyed blob · runner = spider-imp · brute = horned ogre ·
// bomber = round bat with a bomb · flyer = ragged wraith · runebearer =
// golden robed figure · boss = a horned demon that floods the sky with
// word-tags and letter-arrows. Death hands the body to a Ragdoll tumble.

import { CONFIG as C } from './config.js';
import { seg, limb, head, inkStyle } from './stickman.js';

let NEXT_ID = 1;

// per-type body metrics at scale 1 (multiplied by game.scale * typeScale)
const BODY = {
  walker: { scale: 1, lw: 3.2, tagH: 92, chest: 30 },
  runner: { scale: 0.92, lw: 2.8, tagH: 64, chest: 18 },
  brute: { scale: 1.5, lw: 5, tagH: 94, chest: 44 },
  bomber: { scale: 1, lw: 3, tagH: 108, chest: 54 },
  flyer: { scale: 0.95, lw: 2.8, tagH: 52, chest: 0 },
  orb: { scale: 1, lw: 2, tagH: 28, chest: 0 },
  boss: { scale: 2.3, lw: 6, tagH: 104, chest: 50 },
  runebearer: { scale: 1, lw: 3.4, tagH: 92, chest: 34 },
  bosstag: { scale: 1, lw: 2, tagH: 0, chest: 0 },
  larrow: { scale: 1, lw: 2, tagH: 24, chest: 0 },
};

// types whose y is a floating body center, not feet on the ground
const FLOATING = new Set(['flyer', 'orb', 'bosstag', 'larrow']);

// small hue rotation so the horde never looks photocopied
function hueShift(hex, deg) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  h = (h + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  const to = (v) => Math.round((v + m) * 255);
  return `rgb(${to(rr)},${to(gg)},${to(bb)})`;
}

export class Enemy {
  constructor(game, type, words) {
    this.id = NEXT_ID++;
    this.game = game;
    this.type = type;
    this.cfg = C.ENEMIES[type];
    this.body = BODY[type];
    this.words = words.slice();
    this.totalWords = words.length;
    this.progress = 0;
    this.dead = false;
    this.x = game.w + 70;
    this.y = game.groundY; // feet for grounded, body center for floaters
    this.walkPhase = Math.random() * Math.PI * 2;
    this.sineT = Math.random() * Math.PI * 2;
    this.mode = 'walk'; // walk | windup | recover
    this.modeT = 0;
    this.strikeT = 0;
    this.staggerT = 0;
    this.popT = 0; // tag pop on typed letter
    this.burnT = -1; // >=0 → burning, fires at 0
    this.tagLane = this.id % 3;

    // per-spawn variation: size, hue, features
    this.v = [Math.random(), Math.random(), Math.random()];
    const jitter = type === 'boss' || type === 'bosstag' || type === 'larrow' || type === 'orb'
      ? 1
      : 0.9 + this.v[0] * 0.2;
    this.color = type === 'boss' || type === 'bosstag' || type === 'larrow'
      ? C.COLORS[type]
      : hueShift(C.COLORS[type], (this.v[1] - 0.5) * 28);
    this.su = game.scale * this.body.scale * jitter;

    if (type === 'flyer') {
      this.baseY = game.groundY - (95 + Math.random() * 70) * game.scale;
      this.y = this.baseY;
    } else if (type === 'orb' || type === 'larrow') {
      this.baseY = game.groundY - (60 + Math.random() * 90) * game.scale;
      this.y = this.baseY;
    } else if (type === 'bosstag') {
      this.baseY = game.groundY - 200 * game.scale; // game repositions
      this.y = this.baseY;
      this.tagLane = 0;
    }
    if (type === 'bomber') {
      this.fuseMax = Math.max(C.BOMBER_FUSE_MIN, C.BOMBER_FUSE - game.wave * 0.18);
      this.fuse = this.fuseMax;
      this.beepT = 0;
    }
    if (type === 'boss') {
      // the sentence lives in a queue; floating tags draw from it
      this.wordQueue = this.words;
      this.words = [];
      this.hp = this.wordQueue.length;
      this.totalHp = this.hp;
      this.enraged = false;
      this.stopped = false;
      this.hurlT = 0;
      this.tagTimer = 0.8;
      this.attackTimer = 2.2;
    }
    if (type === 'larrow') this.tagLane = 0;
  }

  get word() {
    return this.words[0] || null;
  }

  // no words left — an arrow is already in flight to finish this one off
  get doomed() {
    return this.words.length === 0;
  }

  // floating boss word-tags are not physical: supers/AoE/volleys ignore them
  get ethereal() {
    return this.type === 'bosstag';
  }

  hitY() {
    if (FLOATING.has(this.type)) return this.y;
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
      case 'bosstag': {
        // a rune-bound word hanging in the air
        this.y = this.baseY + Math.sin(this.sineT * 1.7) * 7 * g.scale;
        return;
      }
      case 'larrow': {
        // the boss's letter-arrow: dead straight for the archer's chest
        const B = g.diff.boss;
        const sp = B.speed * speedScale * (this.enragedBoost || 1);
        const tx = g.player.x;
        const ty = g.groundY - 48 * g.scale;
        let dx = tx - this.x;
        let dy = ty - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.vx = (dx / d) * sp;
        this.vy = (dy / d) * sp;
        this.x += this.vx * dt;
        this.y += this.vy * dt + Math.sin(this.sineT * 9) * 14 * dt;
        if (Math.random() < 26 * dt) {
          g.particles.spawn({
            x: this.x, y: this.y, vx: 40, vy: (Math.random() - 0.5) * 24,
            life: 0.3, size: 3, color: this.color, gravity: 0, drag: 2,
          });
        }
        if (d < 24 * g.scale) {
          g.damagePlayer(this);
          g.vaporize(this, 8);
        }
        return;
      }
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
        // homing wobble toward the archer's chest (legacy projectile)
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
        return;
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
        } else if (this.hp > 0) {
          this.hurlT = Math.max(0, this.hurlT - dt);
          // keep the sky stocked with floating word-tags
          this.tagTimer -= dt;
          if (this.tagTimer <= 0) {
            this.tagTimer = C.BOSS_TAG_INTERVAL;
            g.maintainBossTags(this);
          }
          // letter-arrow barrage
          this.attackTimer -= dt;
          if (this.attackTimer <= 0) {
            const B = g.diff.boss;
            this.attackTimer = B.interval * (this.enraged ? 0.55 : 1) * (0.8 + Math.random() * 0.4);
            if (g.countLetterArrows() < (this.enraged ? 4 : C.BOSS_LARROW_MAX)) {
              this.hurlT = 0.35;
              g.spawnLetterArrow(this);
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

  // melee lunge: 0 = none, winds up (lean back) then snaps forward
  meleePose() {
    if (this.strikeT > 0) return { raise: -0.6, active: true };
    if (this.mode === 'windup') return { raise: 1 - this.modeT / C.ATTACK_WINDUP, active: true };
    return { raise: 0, active: false };
  }

  // lunge x-offset applied to the whole body while attacking
  lungeX(su) {
    const mp = this.meleePose();
    if (!mp.active) return 0;
    return mp.raise < 0 ? -12 * su : mp.raise * 7 * su;
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
      case 'larrow': this.drawLarrow(ctx, su, t, ink); break;
      case 'bosstag': this.drawBossTag(ctx, su, t, ink); break;
      case 'flyer': this.drawWraith(ctx, su, t, ink); break;
      case 'runner': this.drawImp(ctx, su, ink); break;
      case 'brute': this.drawOgre(ctx, su, ink); break;
      case 'bomber': this.drawBat(ctx, su, t, ink); break;
      case 'boss': this.drawDemon(ctx, su, t, ink); break;
      case 'runebearer':
        this.drawRuneAura(ctx, su, t);
        this.drawRobed(ctx, su, t, ink);
        this.drawRuneRing(ctx, su, t);
        break;
      default: this.drawBlob(ctx, su, t, ink); break;
    }

    ctx.restore();
  }

  // --- walker: shambling one-eyed blob with stubby legs -------------------
  drawBlob(ctx, su, t, ink) {
    const ph = this.walkPhase;
    const v = this.v;
    const lx = this.lungeX(su);
    const bodyR = (21 + v[0] * 5) * su;
    const squish = 1 + Math.sin(ph * 2) * 0.05;
    const cx = lx;
    const cy = -(bodyR + 9 * su) + Math.abs(Math.sin(ph)) * -2.5 * su;

    // stubby stepping legs
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const fx = cx + (i ? 9 : -9) * su + Math.cos(p) * 6 * su;
      const fy = -Math.max(0, Math.sin(p)) * 5 * su;
      seg(ctx, cx + (i ? 7 : -7) * su, cy + bodyR * 0.72, fx, fy);
    }

    // wobbly blob outline
    ctx.beginPath();
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const wob = 1 + 0.05 * Math.sin(ph * 2 + i * 2.7 + v[2] * 6) + 0.04 * Math.sin(i * 4.1 + v[1] * 9);
      const px = cx + Math.cos(a) * bodyR * wob;
      const py = cy + Math.sin(a) * bodyR * wob * 0.92 * squish;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // antennae (0-2 depending on the roll)
    const nAnt = v[2] < 0.35 ? 0 : v[2] < 0.75 ? 1 : 2;
    for (let i = 0; i < nAnt; i++) {
      const ax = cx + (i ? 6 : -5) * su;
      seg(ctx, ax, cy - bodyR * 0.9, ax + (i ? 3 : -4) * su, cy - bodyR * 0.9 - 10 * su);
      ctx.beginPath();
      ctx.arc(ax + (i ? 3 : -4) * su, cy - bodyR * 0.9 - 11 * su, 1.8 * su, 0, Math.PI * 2);
      ctx.stroke();
    }

    // the one big eye, pupil glaring at the archer
    const er = (5.5 + v[1] * 3) * su;
    const ex = cx - bodyR * 0.34;
    const ey = cy - bodyR * 0.14;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(ex - er * 0.35, ey + er * 0.1, er * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // grumpy little mouth
    ctx.beginPath();
    ctx.arc(cx - bodyR * 0.45, cy + bodyR * 0.42, 5 * su, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  // --- runner: skittering spider-imp --------------------------------------
  drawImp(ctx, su, ink) {
    const ph = this.walkPhase * 1.9;
    const v = this.v;
    const lx = this.lungeX(su);
    const bodyR = (10 + v[0] * 3) * su;
    const cx = lx;
    const cy = -(bodyR + 7 * su) + Math.abs(Math.sin(ph)) * -2 * su;

    // skittering legs, 2-3 per side
    const pairs = v[2] < 0.5 ? 2 : 3;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < pairs; i++) {
        const p = ph + i * 2.1 + (side > 0 ? Math.PI : 0);
        const fx = cx + side * (8 + i * 6) * su + Math.cos(p) * 5 * su;
        const fy = -Math.max(0, Math.sin(p)) * 6 * su;
        limb(ctx, cx + side * 3 * su, cy + bodyR * 0.4, fx, fy, (11 + i * 2) * su, (11 + i * 2) * su, side);
      }
    }

    // body + tiny horns
    ctx.beginPath();
    ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
    ctx.stroke();
    const hl = (3 + v[1] * 4) * su;
    seg(ctx, cx - bodyR * 0.5, cy - bodyR * 0.8, cx - bodyR * 0.5 - hl * 0.4, cy - bodyR * 0.8 - hl);
    seg(ctx, cx + bodyR * 0.2, cy - bodyR * 0.9, cx + bodyR * 0.2 + hl * 0.3, cy - bodyR * 0.9 - hl);

    // paired glaring eyes
    ctx.fillStyle = ink;
    ctx.fillRect(cx - bodyR * 0.55, cy - bodyR * 0.25, 2.4 * su, 2.4 * su);
    ctx.fillRect(cx - bodyR * 0.1, cy - bodyR * 0.35, 2 * su, 2 * su);
  }

  // --- brute: hulking horned ogre -----------------------------------------
  drawOgre(ctx, su, ink) {
    const ph = this.walkPhase;
    const v = this.v;
    const lx = this.lungeX(su);
    const bob = Math.abs(Math.sin(ph)) * -2 * su;
    const cx = lx;
    const beltY = -26 * su + bob;
    const topY = -(64 + v[0] * 8) * su + bob;
    const wTop = (20 + v[1] * 4) * su;
    const wBot = 13 * su;

    // thick stub legs
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const fx = cx + (i ? 10 : -10) * su + Math.cos(p) * 7 * su;
      const fy = -Math.max(0, Math.sin(p)) * 4 * su;
      seg(ctx, cx + (i ? 8 : -8) * su, beltY, fx, fy);
    }

    // top-heavy torso hull
    ctx.beginPath();
    ctx.moveTo(cx - wBot, beltY);
    ctx.quadraticCurveTo(cx - wTop * 1.25, (beltY + topY) / 2, cx - wTop, topY);
    ctx.quadraticCurveTo(cx, topY - 8 * su, cx + wTop, topY);
    ctx.quadraticCurveTo(cx + wTop * 1.25, (beltY + topY) / 2, cx + wBot, beltY);
    ctx.closePath();
    ctx.stroke();

    // curved horns
    const hornL = (10 + v[2] * 8) * su;
    ctx.beginPath();
    ctx.moveTo(cx - wTop * 0.55, topY);
    ctx.quadraticCurveTo(cx - wTop * 0.9, topY - hornL, cx - wTop * 0.4, topY - hornL * 1.35);
    ctx.moveTo(cx + wTop * 0.55, topY);
    ctx.quadraticCurveTo(cx + wTop * 0.9, topY - hornL, cx + wTop * 0.4, topY - hornL * 1.35);
    ctx.stroke();

    // heavy arms with fist knobs (windup raises them, strike smashes forward)
    const mp = this.meleePose();
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      let hx;
      let hy;
      if (mp.active) {
        hx = cx - (mp.raise < 0 ? 30 : 4 + mp.raise * 6) * su;
        hy = beltY + (mp.raise < 0 ? -6 : -30 * mp.raise) * su;
      } else {
        hx = cx + side * (wTop + 6) * su + Math.cos(ph + i * Math.PI) * 3 * su;
        hy = beltY - 2 * su;
      }
      limb(ctx, cx + side * wTop * 0.9, topY + 6 * su, hx, hy, 20 * su, 20 * su, -side);
      ctx.beginPath();
      ctx.arc(hx, hy, 4.4 * su, 0, Math.PI * 2);
      ctx.stroke();
    }

    // face: sunken eyes + underbite tusks
    ctx.fillStyle = ink;
    ctx.fillRect(cx - 8 * su, topY + 9 * su, 3 * su, 3 * su);
    ctx.fillRect(cx + 4 * su, topY + 9 * su, 3 * su, 3 * su);
    seg(ctx, cx - 7 * su, topY + 19 * su, cx + 7 * su, topY + 19 * su);
    seg(ctx, cx - 6 * su, topY + 19 * su, cx - 7.5 * su, topY + 14 * su);
    seg(ctx, cx + 6 * su, topY + 19 * su, cx + 7.5 * su, topY + 14 * su);
  }

  // --- bomber: round bat lugging a bomb -----------------------------------
  drawBat(ctx, su, t, ink) {
    const v = this.v;
    const lx = this.lungeX(su);
    const hov = (52 + Math.sin(this.sineT * 2.3) * 5) * su;
    const bodyR = (11 + v[0] * 3) * su;
    const cx = lx;
    const cy = -hov;
    const flap = Math.sin(this.walkPhase * 3.2 + this.sineT * 6);

    // wings: curved strokes each side
    for (let side = -1; side <= 1; side += 2) {
      const tipX = cx + side * (22 + v[1] * 5) * su;
      const tipY = cy - 6 * su - flap * 10 * su;
      ctx.beginPath();
      ctx.moveTo(cx + side * bodyR * 0.7, cy - bodyR * 0.4);
      ctx.quadraticCurveTo(cx + side * 16 * su, cy - 14 * su - flap * 6 * su, tipX, tipY);
      ctx.quadraticCurveTo(cx + side * 14 * su, cy + 2 * su, cx + side * bodyR * 0.8, cy + bodyR * 0.3);
      ctx.stroke();
    }

    // round body + big ears
    ctx.beginPath();
    ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
    ctx.stroke();
    const earH = (6 + v[2] * 5) * su;
    seg(ctx, cx - bodyR * 0.5, cy - bodyR * 0.8, cx - bodyR * 0.7, cy - bodyR * 0.8 - earH);
    seg(ctx, cx - bodyR * 0.7, cy - bodyR * 0.8 - earH, cx - bodyR * 0.15, cy - bodyR * 0.95);
    seg(ctx, cx + bodyR * 0.5, cy - bodyR * 0.8, cx + bodyR * 0.7, cy - bodyR * 0.8 - earH);
    seg(ctx, cx + bodyR * 0.7, cy - bodyR * 0.8 - earH, cx + bodyR * 0.15, cy - bodyR * 0.95);

    // face
    ctx.fillStyle = ink;
    ctx.fillRect(cx - bodyR * 0.5, cy - 2 * su, 2.2 * su, 2.2 * su);
    ctx.fillRect(cx - bodyR * 0.05, cy - 2.5 * su, 2.2 * su, 2.2 * su);
    seg(ctx, cx - 3 * su, cy + bodyR * 0.45, cx - 1 * su, cy + bodyR * 0.62);

    // the bomb, dangling from little claws
    const bx = cx + Math.sin(this.sineT * 2.1) * 2 * su;
    const by = cy + bodyR + 15 * su;
    seg(ctx, cx - 2 * su, cy + bodyR, bx, by - 8 * su);
    ctx.beginPath();
    ctx.arc(bx, by, 7.5 * su, 0, Math.PI * 2);
    ctx.stroke();
    // blinking fuse — faster as time runs out
    const frac = this.fuse / this.fuseMax;
    const on = Math.sin(t * (5 + (1 - frac) * 26)) > 0;
    if (on) {
      ctx.fillStyle = frac < 0.3 ? '#ff5c7a' : '#ffc14d';
      ctx.fillRect(bx - 2 * su, by - 13 * su, 4 * su, 4 * su);
    }
  }

  // --- flyer: ragged wraith ------------------------------------------------
  drawWraith(ctx, su, t, ink) {
    const v = this.v;
    // hooded head
    ctx.beginPath();
    ctx.arc(0, -14 * su, 8 * su, Math.PI * 0.9, Math.PI * 2.15);
    ctx.stroke();

    // tattered cloak with a waving zigzag hem
    const hemY = 16 * su;
    const wTop = 7 * su;
    const wBot = (14 + v[0] * 5) * su;
    ctx.beginPath();
    ctx.moveTo(-wTop, -12 * su);
    ctx.quadraticCurveTo(-wBot * 1.15, 2 * su, -wBot, hemY);
    const teeth = 4 + ((v[2] * 3) | 0);
    for (let i = 0; i <= teeth; i++) {
      const f = i / teeth;
      const px = -wBot + f * wBot * 2;
      const py = hemY + (i % 2 ? 6 * su : 0) + Math.sin(t * 3.1 + i * 1.9 + this.id) * 2.5 * su;
      ctx.lineTo(px, py);
    }
    ctx.quadraticCurveTo(wBot * 1.15, 2 * su, wTop, -12 * su);
    ctx.stroke();

    // hollow eyes
    ctx.fillStyle = ink;
    ctx.fillRect(-4.5 * su, -16 * su, 2.6 * su, 3.4 * su);
    ctx.fillRect(0.5 * su, -16 * su, 2.6 * su, 3.4 * su);

    // wispy trailing arms
    const wave = Math.sin(t * 2.7 + this.id);
    ctx.beginPath();
    ctx.moveTo(-wTop, -6 * su);
    ctx.quadraticCurveTo(-16 * su, -2 * su + wave * 3 * su, -21 * su, 4 * su + wave * 5 * su);
    ctx.moveTo(wTop, -6 * su);
    ctx.quadraticCurveTo(15 * su, 0 + wave * 2 * su, 19 * su, 7 * su - wave * 4 * su);
    ctx.stroke();
  }

  // --- runebearer: golden robed figure ------------------------------------
  drawRobed(ctx, su, t, ink) {
    const sway = Math.sin(this.walkPhase) * 2 * su;
    // robe silhouette
    ctx.beginPath();
    ctx.moveTo(-14 * su + sway * 0.4, 0);
    ctx.quadraticCurveTo(-10 * su, -34 * su, -6 * su, -52 * su);
    ctx.quadraticCurveTo(0, -60 * su, 6 * su, -52 * su);
    ctx.quadraticCurveTo(10 * su, -34 * su, 14 * su + sway * 0.4, 0);
    ctx.closePath();
    ctx.stroke();
    // hood
    ctx.beginPath();
    ctx.arc(0, -54 * su, 7.5 * su, Math.PI * 0.85, Math.PI * 2.2);
    ctx.stroke();
    // glowing eyes under the hood
    ctx.fillStyle = '#fff3cf';
    ctx.fillRect(-4 * su, -56 * su, 2.4 * su, 2.4 * su);
    ctx.fillRect(1.4 * su, -56 * su, 2.4 * su, 2.4 * su);
    // belt rune
    ctx.save();
    ctx.translate(0, -30 * su);
    ctx.rotate(Math.PI / 4 + t * 1.3);
    ctx.strokeRect(-3.2 * su, -3.2 * su, 6.4 * su, 6.4 * su);
    ctx.restore();
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

  // --- boss letter-arrow: a fast dart with a letter tag --------------------
  drawLarrow(ctx, su, t, ink) {
    const s = this.game.scale;
    const ang = Math.atan2(this.vy || 0, this.vx || -1);
    ctx.save();
    ctx.rotate(ang);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.6 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12 * s, 0);
    ctx.lineTo(6 * s, 0);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(12 * s, 0);
    ctx.lineTo(4 * s, -4.5 * s);
    ctx.lineTo(4 * s, 4.5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- floating boss word: rune anchor + tether back to the demon ----------
  drawBossTag(ctx, su, t, ink) {
    const s = this.game.scale;
    // tether
    if (this.boss && !this.boss.dead) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,154,213,0.14)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 9]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.boss.x - this.x, this.boss.hitY() - this.y);
      ctx.stroke();
      ctx.restore();
    }
    // rune anchor under the word
    ctx.save();
    ctx.translate(0, 22 * s);
    ctx.rotate(Math.PI / 4 + t * 2.1 + this.id);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(-4 * s, -4 * s, 8 * s, 8 * s);
    ctx.restore();
  }

  // --- boss: horned demon bulk ---------------------------------------------
  drawDemon(ctx, su, t, ink) {
    const ph = this.walkPhase;
    const breathe = this.stopped ? Math.sin(t * 1.7) * 2 * su * 0.4 : 0;
    const bob = this.stopped ? 0 : Math.abs(Math.sin(ph)) * -2 * su;
    const beltY = -30 * su + bob + breathe;
    const topY = -78 * su + bob + breathe;
    const wTop = 24 * su;
    const wBot = 15 * su;

    // enrage aura: rough arcs pulsing around the bulk
    if (this.enraged) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,92,122,${0.22 + 0.12 * Math.sin(t * 6.9)})`;
      ctx.lineWidth = 2.5 * this.game.scale;
      for (let i = 0; i < 3; i++) {
        const a0 = t * 1.9 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, (beltY + topY) / 2, wTop * 1.5 + Math.sin(t * 3.4 + i) * 4 * su * 0.2, a0, a0 + 1.1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // digitigrade legs
    for (let i = 0; i < 2; i++) {
      const p = ph + i * Math.PI;
      const fx = this.stopped ? (i ? 13 : -13) * su : Math.cos(p) * 12 * su;
      const fy = this.stopped ? 0 : -Math.max(0, Math.sin(p)) * 4 * su;
      limb(ctx, (i ? 9 : -9) * su, beltY, fx, fy, 26 * su, 26 * su, 1);
    }

    // massive torso hull
    ctx.beginPath();
    ctx.moveTo(-wBot, beltY);
    ctx.quadraticCurveTo(-wTop * 1.3, (beltY + topY) / 2, -wTop, topY);
    ctx.quadraticCurveTo(0, topY - 10 * su, wTop, topY);
    ctx.quadraticCurveTo(wTop * 1.3, (beltY + topY) / 2, wBot, beltY);
    ctx.closePath();
    ctx.stroke();

    // shoulder spikes
    seg(ctx, -wTop, topY + 2 * su, -wTop - 7 * su, topY - 6 * su);
    seg(ctx, wTop, topY + 2 * su, wTop + 7 * su, topY - 6 * su);

    // grand curved horns
    ctx.beginPath();
    ctx.moveTo(-wTop * 0.5, topY);
    ctx.quadraticCurveTo(-wTop * 1.1, topY - 20 * su, -wTop * 0.5, topY - 30 * su);
    ctx.moveTo(wTop * 0.5, topY);
    ctx.quadraticCurveTo(wTop * 1.1, topY - 20 * su, wTop * 0.5, topY - 30 * su);
    ctx.stroke();

    // clawed arms; the free arm hurls letter-arrows
    const hurl = this.hurlT > 0 ? this.hurlT / 0.35 : 0;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      let hx = side * (wTop + 10) * su;
      let hy = beltY - 6 * su;
      if (i === 0 && hurl > 0) {
        hx = -Math.cos(hurl * 2.4) * (wTop + 14) * su;
        hy = topY + 10 * su - Math.sin(hurl * 2.4) * 26 * su;
      }
      limb(ctx, side * wTop * 0.9, topY + 8 * su, hx, hy, 24 * su, 24 * su, -side);
      // claws
      for (let cIdx = -1; cIdx <= 1; cIdx++) {
        seg(ctx, hx, hy, hx - 5 * su + cIdx * 3 * su, hy + 6 * su);
      }
    }

    // burning eyes — wider and brighter when enraged
    const eyeW = (this.enraged ? 4.2 : 3) * su;
    const flick = this.enraged ? Math.sin(t * 11) * 0.6 * su : 0;
    ctx.fillStyle = this.enraged ? '#ff2d55' : '#ff5c7a';
    ctx.fillRect(-9 * su, topY + 10 * su, eyeW + flick, eyeW * 0.8);
    ctx.fillRect(5 * su, topY + 10 * su, eyeW + flick, eyeW * 0.8);
    // jagged grin
    ctx.beginPath();
    ctx.moveTo(-8 * su, topY + 22 * su);
    for (let i = 1; i <= 4; i++) {
      ctx.lineTo(-8 * su + i * 4 * su, topY + 22 * su + (i % 2 ? 3.5 * su : 0));
    }
    ctx.stroke();
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

    // boss health bar with a phase notch at 50%
    if (this.type === 'boss') {
      const bw = 170 * g.scale;
      const frac = Math.max(0, this.hp / this.totalHp);
      const by = y - 26 * g.scale;
      const bh = 11 * g.scale;
      ctx.fillStyle = 'rgba(11,5,30,0.85)';
      ctx.fillRect(x - bw / 2 - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#3a2a63';
      ctx.fillRect(x - bw / 2, by, bw, bh);
      ctx.fillStyle = this.enraged ? '#ff2d55' : C.COLORS.bad;
      ctx.fillRect(x - bw / 2, by, bw * frac, bh);
      // 50% enrage notch
      ctx.fillStyle = 'rgba(245,236,215,0.8)';
      ctx.fillRect(x - 1, by - 3, 2, bh + 6);
      if (this.enraged) {
        ctx.font = `700 ${Math.round(9 * g.scale)}px "Silkscreen", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ff2d55';
        ctx.fillText('ENRAGED', x, by - 5);
      }
    }

    if (!word) return;

    const isTarget = g.target === this;
    const isRune = this.type === 'runebearer';
    const isBossTag = this.type === 'bosstag';
    // cipher tags: EXTREME renders in a coding mono (dotted 0, serifed I,
    // barred 1 — hard but honest); IMPOSSIBLE renders in a pixel terminal
    // font where 0/O and 1/l/I are genuinely identical. That is the joke.
    const cipher = g.diff.cipher && this.type !== 'boss' && !isBossTag;
    const ambiguous = cipher && g.diff.ambiguous;
    const fs = Math.round(
      (isTarget ? 17 : 15)
      * Math.min(1.25, Math.max(0.85, g.scale))
      * (ambiguous ? 1.35 : 1),
    );
    ctx.font = ambiguous ? `${fs}px "VT323", monospace` : `600 ${fs}px "JetBrains Mono", monospace`;
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
    ctx.lineWidth = isTarget || isRune || isBossTag ? 2.5 : 1.5;
    ctx.strokeStyle = isTarget ? C.COLORS.gold : this.color;
    ctx.globalAlpha = isTarget ? 1 : isRune || isBossTag ? 0.95 : 0.75;
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (isTarget || isRune || isBossTag) {
      ctx.save();
      ctx.globalAlpha = 0.28 + 0.14 * Math.sin(g.time * (!isTarget ? 3.4 : 6.9));
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

    // cipher enemies get a small "!?" hint — read carefully
    if (cipher) {
      ctx.font = `700 ${Math.round(fs * (ambiguous ? 0.42 : 0.55))}px "Silkscreen", monospace`;
      ctx.fillStyle = ambiguous ? '#ff5c7a' : '#c69bff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!?', wpx / 2 + 12, -hpx / 2 + 2);
      ctx.font = ambiguous ? `${fs}px "VT323", monospace` : `600 ${fs}px "JetBrains Mono", monospace`;
    }

    // word: typed prefix gold, rest ink — chars centered in fixed cells
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

    // the NEXT word ghosts in under the pill — you can see what's coming
    if (this.words.length > 1) {
      const nw = this.words[1];
      const disp = nw.length > 14 ? `${nw.slice(0, 13)}…` : nw;
      ctx.font = ambiguous
        ? `${Math.round(fs * 0.8)}px "VT323", monospace`
        : `600 ${Math.round(fs * 0.68)}px "JetBrains Mono", monospace`;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = this.color;
      ctx.fillText(`then: ${disp}`, 0, hpx / 2 + 9);
      ctx.globalAlpha = 1;
      if (this.words.length > 2) {
        ctx.fillStyle = this.color;
        ctx.fillRect(wpx / 2 + 6, hpx / 2 + 6, 4, 4);
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
// A killed monster goes limp: ballistic tumble, one ground bounce, fade.
// Bodies are simplified per-type silhouettes with flailing limbs.
export class Ragdoll {
  constructor(enemy, dirX, dirY) {
    this.type = enemy.type;
    this.color = enemy.color;
    this.su = enemy.su;
    this.lw = enemy.body.lw;
    this.scale = enemy.game.scale;
    this.groundY = enemy.game.groundY;
    this.v = enemy.v || [0.5, 0.5, 0.5];
    this.x = enemy.x;
    this.y = FLOATING.has(enemy.type)
      ? enemy.y
      : enemy.y - (enemy.body.chest + 6) * enemy.su;
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
    const f = this.flail;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    inkStyle(ctx, this.color, this.lw * this.scale);

    switch (this.type) {
      case 'orb':
      case 'larrow': {
        const s = 9 * this.scale;
        ctx.fillStyle = this.color;
        ctx.rotate(f);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        break;
      }
      case 'runner': {
        // spider-imp: ball with legs pedalling at nothing
        const r = 10 * su;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const p = f + i * 1.05;
          seg(ctx, Math.cos(i) * r * 0.6, Math.sin(i) * r * 0.6,
            Math.cos(p) * r * 1.9, Math.sin(p) * r * 1.9);
        }
        break;
      }
      case 'brute':
      case 'boss': {
        // ogre bulk: hull + horns + flailing heavy arms
        const r = (this.type === 'boss' ? 26 : 20) * su;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.85);
        ctx.quadraticCurveTo(-r * 1.1, -r * 1.5, -r * 0.45, -r * 1.75);
        ctx.moveTo(r * 0.5, -r * 0.85);
        ctx.quadraticCurveTo(r * 1.1, -r * 1.5, r * 0.45, -r * 1.75);
        ctx.stroke();
        for (let i = 0; i < 2; i++) {
          const p = f + i * 2.6;
          limb(ctx, 0, 0, Math.cos(p) * r * 1.7, Math.sin(p) * r * 1.7, r, r, i ? 1 : -1);
        }
        break;
      }
      case 'bomber': {
        // bat: round body, ears, wings gone limp
        const r = 11 * su;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        seg(ctx, -r * 0.5, -r * 0.8, -r * 0.8, -r * 1.5);
        seg(ctx, r * 0.5, -r * 0.8, r * 0.8, -r * 1.5);
        for (let i = 0; i < 2; i++) {
          const side = i ? 1 : -1;
          const p = f * 0.7 + i * 2.1;
          ctx.beginPath();
          ctx.moveTo(side * r * 0.7, 0);
          ctx.quadraticCurveTo(side * r * 1.6, Math.sin(p) * r, side * r * 2.1, r * 0.8 + Math.sin(p) * r * 0.5);
          ctx.stroke();
        }
        break;
      }
      case 'flyer': {
        // wraith: crumpling rag
        ctx.beginPath();
        const R = 13 * su;
        for (let i = 0; i <= 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const rr = R * (1 + 0.25 * Math.sin(f + i * 2.3));
          const px = Math.cos(ang) * rr;
          const py = Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'runebearer': {
        // robed figure crumples, hood first
        ctx.beginPath();
        ctx.moveTo(-12 * su, 10 * su);
        ctx.quadraticCurveTo(0, -18 * su + Math.sin(f) * 3 * su, 12 * su, 10 * su);
        ctx.closePath();
        ctx.stroke();
        head(ctx, Math.sin(f * 0.7) * 4 * su, -16 * su, 6 * su);
        break;
      }
      default: {
        // walker blob: deflating ball, one sad eye, stub legs kicking
        const r = 16 * su;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.15, 4.5 * su, 0, Math.PI * 2);
        ctx.stroke();
        seg(ctx, -r * 0.3 - 2 * su, -r * 0.15 - 2 * su, -r * 0.3 + 2 * su, -r * 0.15 + 2 * su);
        seg(ctx, -r * 0.3 + 2 * su, -r * 0.15 - 2 * su, -r * 0.3 - 2 * su, -r * 0.15 + 2 * su);
        for (let i = 0; i < 2; i++) {
          const p = f + i * Math.PI;
          seg(ctx, (i ? 6 : -6) * su, r * 0.7, (i ? 6 : -6) * su + Math.cos(p) * 8 * su, r * 0.7 + 9 * su);
        }
        break;
      }
    }
    ctx.restore();
  }
}
