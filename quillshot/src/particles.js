// Chunky pixel particles + letter fragments + floating score text.
// Fixed-size pools — nothing here ever allocates during the hot loop
// beyond reusing pooled slots.

import { CONFIG as C } from './config.js';

export class Particles {
  constructor() {
    this.pool = [];
    for (let i = 0; i < C.MAX_PARTICLES; i++) {
      this.pool.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 4, color: '#fff',
        gravity: 0, drag: 0, char: null, rot: 0, vrot: 0,
      });
    }
    this.cursor = 0;

    this.floaters = [];
    for (let i = 0; i < C.MAX_FLOATERS; i++) {
      this.floaters.push({ active: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 16 });
    }
    this.fCursor = 0;
  }

  clear() {
    for (const p of this.pool) p.active = false;
    for (const f of this.floaters) f.active = false;
  }

  spawn(opts) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.active = true;
    p.x = opts.x;
    p.y = opts.y;
    p.vx = opts.vx || 0;
    p.vy = opts.vy || 0;
    p.maxLife = p.life = opts.life || 0.6;
    p.size = opts.size || 4;
    p.color = opts.color || '#ffffff';
    p.gravity = opts.gravity ?? 500;
    p.drag = opts.drag ?? 0.5;
    p.char = opts.char || null;
    p.rot = opts.rot || 0;
    p.vrot = opts.vrot || 0;
    return p;
  }

  // radial burst of chunky squares
  burst(x, y, { color = '#ffc14d', count = 12, speed = 220, spread = Math.PI * 2, angle = 0, life = 0.55, size = 4, gravity = 550, sizeJitter = 3 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.85);
      this.spawn({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.8),
        size: size + ((Math.random() * sizeJitter) | 0),
        color, gravity,
      });
    }
  }

  // a word tag shatters — each remaining letter flies off spinning
  letterShatter(x, y, word, color) {
    const n = word.length;
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x + (i - n / 2) * 10,
        y,
        vx: (Math.random() - 0.5) * 260 + (i - n / 2) * 30,
        vy: -120 - Math.random() * 220,
        life: 0.7 + Math.random() * 0.4,
        size: 15,
        color,
        gravity: 700,
        char: word[i],
        rot: (Math.random() - 0.5) * 0.8,
        vrot: (Math.random() - 0.5) * 12,
      });
    }
  }

  // continuous flame / ember emission (call per frame with a budget)
  ember(x, y, color = '#ff8c42', up = 90) {
    this.spawn({
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 40,
      vy: -up * (0.5 + Math.random()),
      life: 0.35 + Math.random() * 0.4,
      size: 3 + ((Math.random() * 3) | 0),
      color,
      gravity: -60,
      drag: 1.2,
    });
  }

  floatText(x, y, text, { color = '#ffc14d', size = 18, life = 0.9 } = {}) {
    const f = this.floaters[this.fCursor];
    this.fCursor = (this.fCursor + 1) % this.floaters.length;
    f.active = true;
    f.x = x;
    f.y = y;
    f.vy = -55;
    f.maxLife = f.life = life;
    f.text = text;
    f.color = color;
    f.size = size;
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.gravity * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
    for (const f of this.floaters) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) { f.active = false; continue; }
      f.y += f.vy * dt;
      f.vy *= Math.max(0, 1 - 2.2 * dt); // ease up, slow down
    }
  }

  render(ctx) {
    // chunky squares snapped to a 2px grid — pixelated by construction
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = t < 0.35 ? t / 0.35 : 1;
      ctx.fillStyle = p.color;
      if (p.char) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = `800 ${p.size}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      } else {
        const s = p.size;
        ctx.fillRect(((p.x / 2) | 0) * 2 - s / 2, ((p.y / 2) | 0) * 2 - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;

    for (const f of this.floaters) {
      if (!f.active) continue;
      const t = f.life / f.maxLife;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.font = `800 ${f.size}px "Silkscreen", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(11,5,30,0.9)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
