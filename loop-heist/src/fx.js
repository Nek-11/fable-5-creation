// Juice: pooled particles, screen shake / world nudge, full-screen flashes.
// Everything here is presentation-only — the simulation never reads it —
// so Math.random() is safe in this file (and only in this file + audio).
import { PAL } from './config.js';

const POOL = 256;

export class FX {
  constructor() {
    this.parts = [];
    for (let i = 0; i < POOL; i++)
      this.parts.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', grav: 0 });
    this.shake = 0; // trauma 0..1
    this.nudgeX = 0;
    this.nudgeY = 0;
    this.redFlash = 0;
    this.whiteFlash = 0;
  }

  spawn(n, x, y, opts) {
    for (const p of this.parts) {
      if (n <= 0) break;
      if (p.alive) continue;
      n--;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * (opts.spread ?? 4);
      p.y = y + (Math.random() - 0.5) * (opts.spread ?? 4);
      const a = opts.angle !== undefined
        ? opts.angle + (Math.random() - 0.5) * (opts.arc ?? 0.8)
        : Math.random() * Math.PI * 2;
      const sp = (opts.speed ?? 30) * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - (opts.up ?? 0);
      p.max = p.life = (opts.life ?? 0.5) * (0.6 + Math.random() * 0.7);
      p.size = opts.size ?? 1;
      p.color = Array.isArray(opts.color)
        ? opts.color[(Math.random() * opts.color.length) | 0]
        : opts.color;
      p.grav = opts.grav ?? 0;
    }
  }

  // ------------- recipes -------------
  gemBurst(x, y) {
    this.spawn(14, x, y, { color: [PAL.gold, PAL.goldHi, '#ffffff'], speed: 55, life: 0.55, up: 25, grav: 90, size: 1 });
    this.spawn(4, x, y, { color: '#ffffff', speed: 18, life: 0.3, size: 2 });
  }
  ghostGemBurst(x, y) {
    this.spawn(8, x, y, { color: [PAL.ghost, '#bdf6ff'], speed: 40, life: 0.45, size: 1 });
  }
  plateClick(x, y) {
    this.spawn(6, x, y, { color: ['#9fb0d0', '#5f7099'], speed: 30, life: 0.3 });
    this.nudgeY = 1;
  }
  doorRumble(x, y) {
    this.spawn(8, x, y, { color: ['#5f7099', '#39445f'], speed: 24, life: 0.4, grav: 60 });
    this.shake = Math.max(this.shake, 0.35);
  }
  switchSpark(x, y, on) {
    this.spawn(10, x, y, { color: on ? [PAL.exit, '#b8ffd6'] : [PAL.laser, '#ffc4cd'], speed: 45, life: 0.4, up: 15, grav: 60 });
  }
  laserZap(x, y) {
    this.spawn(22, x, y, { color: [PAL.laser, '#ffffff', '#ff8fa3'], speed: 85, life: 0.5, grav: 40 });
    this.redFlash = 0.85;
    this.shake = Math.max(this.shake, 0.6);
  }
  alarm() {
    this.redFlash = 0.75;
    this.shake = Math.max(this.shake, 0.5);
  }
  ghostSpawnPuff(x, y) {
    this.spawn(12, x, y, { color: [PAL.ghost, '#bdf6ff', '#5ce8ff'], speed: 28, life: 0.6, size: 1 });
  }
  dropPuff(x, y) {
    this.spawn(6, x, y, { color: [PAL.ghost, '#ffffff'], speed: 20, life: 0.35 });
  }
  winBurst(x, y) {
    this.spawn(40, x, y, { color: [PAL.gold, PAL.exit, PAL.ghost, '#ffffff', PAL.magentaGem], speed: 80, life: 1.1, up: 40, grav: 70, size: 2 });
    this.whiteFlash = 0.5;
  }

  // ------------- update / render -------------
  update(dt) {
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
    }
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.redFlash = Math.max(0, this.redFlash - dt * 1.6);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 2.2);
    if (this.nudgeY !== 0) this.nudgeY = Math.abs(this.nudgeY) > 0.2 ? this.nudgeY * -0.6 : 0;
  }

  // camera offset (integer px, capped well under the 6 px rule)
  offset() {
    const s = this.shake * this.shake * 4; // max ~4 px
    return {
      x: Math.round((Math.random() - 0.5) * 2 * s + this.nudgeX),
      y: Math.round((Math.random() - 0.5) * 2 * s + this.nudgeY),
    };
  }

  drawParticles(g) {
    for (const p of this.parts) {
      if (!p.alive) continue;
      const a = Math.max(0, Math.min(1, p.life / p.max));
      g.globalAlpha = a;
      g.fillStyle = p.color;
      const s = p.size + (a > 0.7 ? 1 : 0);
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    g.globalAlpha = 1;
  }

  drawFlashes(g, w, h) {
    if (this.redFlash > 0) {
      g.fillStyle = `rgba(255,45,60,${(this.redFlash * 0.45).toFixed(3)})`;
      g.fillRect(0, 0, w, h);
    }
    if (this.whiteFlash > 0) {
      g.fillStyle = `rgba(255,255,255,${(this.whiteFlash * 0.6).toFixed(3)})`;
      g.fillRect(0, 0, w, h);
    }
  }
}
