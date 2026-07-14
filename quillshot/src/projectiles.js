// Arrows (lethal, homing-with-arc, motion trails) and paper airplanes
// (lethal to nobody). Both pooled.

import { CONFIG as C } from './config.js';

const TRAIL = 7;

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.arrows = [];
    for (let i = 0; i < C.MAX_ARROWS; i++) {
      this.arrows.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        target: null, flame: false, bonus: false, life: 0,
        trail: new Float32Array(TRAIL * 2), trailN: 0,
      });
    }
    this.planes = [];
    for (let i = 0; i < C.MAX_PLANES; i++) {
      this.planes.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, y0: 0,
        bounced: false, grounded: false, life: 0, rot: 0,
      });
    }
  }

  clear() {
    for (const a of this.arrows) a.active = false, a.target = null;
    for (const p of this.planes) p.active = false;
  }

  fireArrow(x, y, target, { flame = false, bonus = false } = {}) {
    let a = this.arrows.find((s) => !s.active);
    if (!a) a = this.arrows[0];
    a.active = true;
    a.x = x;
    a.y = y;
    a.target = target;
    a.flame = flame;
    a.bonus = bonus;
    a.life = 3;
    a.trailN = 0;
    const sp = C.ARROW_SPEED * (this.game.w / 1280);
    let dx = 200;
    let dy = -40;
    if (target && !target.dead) {
      dx = target.x - x;
      dy = target.hitY() - y;
    }
    const d = Math.hypot(dx, dy) || 1;
    a.vx = (dx / d) * sp;
    a.vy = (dy / d) * sp - C.ARROW_ARC; // slight upward kick → visible arc
    return a;
  }

  throwPlane(x, y) {
    let p = this.planes.find((s) => !s.active);
    if (!p) p = this.planes[0];
    p.active = true;
    p.x = x;
    p.y = y;
    p.y0 = y;
    p.vx = C.PLANE_SPEED * (0.85 + Math.random() * 0.3) * (this.game.w / 1280);
    p.vy = 0;
    p.t = Math.random() * Math.PI * 2;
    p.bounced = false;
    p.grounded = false;
    p.life = 4;
    p.rot = 0;
  }

  update(dt) {
    const g = this.game;
    const sp = C.ARROW_SPEED * (g.w / 1280);

    for (const a of this.arrows) {
      if (!a.active) continue;
      a.life -= dt;
      if (a.life <= 0 || a.x > g.w + 120 || a.y > g.h + 60 || a.x < -120) {
        a.active = false;
        a.target = null;
        continue;
      }

      // push current pos into the trail ring
      if (a.trailN < TRAIL) {
        a.trail[a.trailN * 2] = a.x;
        a.trail[a.trailN * 2 + 1] = a.y;
        a.trailN++;
      } else {
        a.trail.copyWithin(0, 2);
        a.trail[(TRAIL - 1) * 2] = a.x;
        a.trail[(TRAIL - 1) * 2 + 1] = a.y;
      }

      const t = a.target;
      if (t && !t.dead) {
        // strong homing steer — the word was earned, the arrow lands
        const tx = t.x;
        const ty = t.hitY();
        const dx = tx - a.x;
        const dy = ty - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = 1 - Math.exp(-9 * dt);
        a.vx += ((dx / d) * sp - a.vx) * k;
        a.vy += ((dy / d) * sp - a.vy) * k;
        // renormalize speed so steering never slows it down
        const v = Math.hypot(a.vx, a.vy) || 1;
        a.vx = (a.vx / v) * sp;
        a.vy = (a.vy / v) * sp;
        if (d < Math.max(26, sp * dt * 1.3)) {
          a.active = false;
          a.target = null;
          g.onArrowHit(t, a);
          continue;
        }
      } else {
        a.vy += 380 * dt; // lost its mark — fall ballistic
        a.target = null;
      }

      a.x += a.vx * dt;
      a.y += a.vy * dt;

      if (a.flame && Math.random() < 30 * dt) {
        g.particles.ember(a.x, a.y, Math.random() < 0.5 ? '#ff8c42' : '#ffc14d', 30);
      }
    }

    // paper airplanes: lazy sine flutter, harmless bounce, sad slide
    for (const p of this.planes) {
      if (!p.active) continue;
      p.life -= dt;
      p.t += dt;
      if (p.life <= 0 || p.x > g.w + 80 || p.x < -80) {
        p.active = false;
        continue;
      }
      if (p.grounded) {
        p.x += p.vx * dt;
        p.vx *= Math.max(0, 1 - 3 * dt);
        continue;
      }
      p.x += p.vx * dt;
      if (p.bounced) {
        p.vy += 500 * dt;
        p.y += p.vy * dt;
        p.rot += 6 * dt;
      } else {
        p.y = p.y0 + Math.sin(p.t * 4.6) * 22 + p.t * 26; // flutter + gentle sink
        p.rot = Math.cos(p.t * 4.6) * 0.35;
        // harmless boop off the first enemy it meets
        for (const e of g.enemies) {
          if (e.dead) continue;
          if (Math.abs(e.x - p.x) < 22 * g.scale && Math.abs(e.hitY() - p.y) < 44 * e.su) {
            p.bounced = true;
            p.vx = -p.vx * 0.35;
            p.vy = -90;
            g.audio.planeBounce();
            g.particles.floatText(p.x, p.y - 18, 'fwip', { color: 'rgba(245,236,215,0.7)', size: 12, life: 0.7 });
            break;
          }
        }
      }
      if (p.y >= g.groundY - 3) {
        p.y = g.groundY - 3;
        p.grounded = true;
        p.rot = 0.3;
        p.life = Math.min(p.life, 1.4);
      }
    }
  }

  render(ctx) {
    const g = this.game;

    for (const a of this.arrows) {
      if (!a.active) continue;

      // motion trail
      if (a.trailN > 1) {
        ctx.lineCap = 'round';
        for (let i = 1; i < a.trailN; i++) {
          const f = i / a.trailN;
          ctx.strokeStyle = a.flame
            ? `rgba(255,140,66,${0.35 * f})`
            : `rgba(255,193,77,${0.28 * f})`;
          ctx.lineWidth = 3 * f + 0.5;
          ctx.beginPath();
          ctx.moveTo(a.trail[(i - 1) * 2], a.trail[(i - 1) * 2 + 1]);
          ctx.lineTo(a.trail[i * 2], a.trail[i * 2 + 1]);
          ctx.stroke();
        }
      }

      // shaft along velocity
      const v = Math.hypot(a.vx, a.vy) || 1;
      const ux = a.vx / v;
      const uy = a.vy / v;
      const L = 20 * g.scale;
      ctx.strokeStyle = a.flame ? '#ff8c42' : C.COLORS.gold;
      ctx.lineWidth = 2.4 * g.scale;
      ctx.beginPath();
      ctx.moveTo(a.x - ux * L, a.y - uy * L);
      ctx.lineTo(a.x, a.y);
      ctx.stroke();
      // chunky pixel head + fletching
      ctx.fillStyle = a.flame ? '#ffd27a' : C.COLORS.gold;
      ctx.fillRect(a.x - 2, a.y - 2, 5, 5);
      ctx.strokeStyle = 'rgba(245,236,215,0.8)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(a.x - ux * L, a.y - uy * L);
      ctx.lineTo(a.x - ux * (L + 5) - uy * 4, a.y - uy * (L + 5) + ux * 4);
      ctx.moveTo(a.x - ux * L, a.y - uy * L);
      ctx.lineTo(a.x - ux * (L + 5) + uy * 4, a.y - uy * (L + 5) - ux * 4);
      ctx.stroke();
    }

    for (const p of this.planes) {
      if (!p.active) continue;
      const a = Math.min(1, p.life / 0.6);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = 10 * g.scale;
      ctx.fillStyle = '#f5ecd7';
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s, -s * 0.55);
      ctx.lineTo(-s * 0.45, 0);
      ctx.lineTo(-s, s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(18,10,46,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.45, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
}
