// Player projectiles — one pooled system, five personalities:
//   bow (arrow), dagger (twin spinning blades), bolt (arcane homer),
//   blade (spectral crescents), dragon (serpentine spirit with a long spine).
// Plus the paper airplane, which remains lethal to nobody.

import { CONFIG as C } from './config.js';

const TRAIL = 16;

// per-kind tuning: speed multiplier, weave (perpendicular wiggle), trail length
const KINDS = {
  bow: { speed: 1, weave: 0, wfreq: 0, trail: 7 },
  dagger: { speed: 1.5, weave: 70, wfreq: 16, trail: 6 },
  bolt: { speed: 1.05, weave: 55, wfreq: 9, trail: 10 },
  blade: { speed: 1.25, weave: 30, wfreq: 12, trail: 8 },
  dragon: { speed: 0.85, weave: 170, wfreq: 6.5, trail: 16 },
};

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.arrows = [];
    for (let i = 0; i < C.MAX_ARROWS; i++) {
      this.arrows.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        target: null, flame: false, bonus: false, ghost: false,
        kind: 'bow', phase: 0, life: 0,
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

  fireArrow(x, y, target, { flame = false, bonus = false, kind = 'bow', ghost = false, angleJitter = 0 } = {}) {
    let a = this.arrows.find((s) => !s.active);
    if (!a) a = this.arrows[0];
    a.active = true;
    a.x = x;
    a.y = y;
    a.target = target;
    a.flame = flame;
    a.bonus = bonus;
    a.ghost = ghost;
    a.kind = KINDS[kind] ? kind : 'bow';
    a.phase = Math.random() * Math.PI * 2;
    a.life = 3;
    a.trailN = 0;
    const sp = C.ARROW_SPEED * KINDS[a.kind].speed * (this.game.w / 1280);
    let dx = 200;
    let dy = -40;
    if (target && !target.dead) {
      dx = target.x - x;
      dy = target.hitY() - y;
    }
    if (angleJitter) {
      const ang = Math.atan2(dy, dx) + angleJitter;
      const d0 = Math.hypot(dx, dy) || 1;
      dx = Math.cos(ang) * d0;
      dy = Math.sin(ang) * d0;
    }
    const d = Math.hypot(dx, dy) || 1;
    a.vx = (dx / d) * sp;
    a.vy = (dy / d) * sp - (a.kind === 'bow' ? C.ARROW_ARC : 0); // arrows arc
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

    for (const a of this.arrows) {
      if (!a.active) continue;
      a.life -= dt;
      if (a.life <= 0 || a.x > g.w + 120 || a.y > g.h + 60 || a.x < -120) {
        a.active = false;
        a.target = null;
        continue;
      }
      const K = KINDS[a.kind];
      const sp = C.ARROW_SPEED * K.speed * (g.w / 1280);

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
        // strong homing steer — the word was earned, the hit lands
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
          if (a.ghost) {
            g.particles.burst(t.x, t.hitY(), { color: '#d8f4ff', count: 5, speed: 140, life: 0.35 });
          } else {
            g.onArrowHit(t, a);
          }
          continue;
        }
      } else {
        a.vy += 380 * dt; // lost its mark — fall ballistic
        a.target = null;
      }

      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // serpentine / weaving motion perpendicular to flight
      if (K.weave) {
        a.phase += K.wfreq * dt;
        const v = Math.hypot(a.vx, a.vy) || 1;
        const px = -a.vy / v;
        const py = a.vx / v;
        const w = Math.sin(a.phase) * K.weave * dt;
        a.x += px * w;
        a.y += py * w;
      }

      if (a.flame && Math.random() < 30 * dt) {
        g.particles.ember(a.x, a.y, Math.random() < 0.5 ? '#ff8c42' : '#ffc14d', 30);
      }
      if (a.kind === 'dragon' && Math.random() < 40 * dt) {
        g.particles.ember(a.x, a.y, Math.random() < 0.5 ? '#ffdf70' : '#ffc14d', 50);
      } else if (a.kind === 'bolt' && Math.random() < 18 * dt) {
        g.particles.ember(a.x, a.y, '#c69bff', 20);
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
          if (e.dead || e.ethereal || e.type === 'larrow') continue;
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

  // ------------------------------------------------------------------ render
  render(ctx) {
    const g = this.game;

    for (const a of this.arrows) {
      if (!a.active) continue;
      const K = KINDS[a.kind];

      // motion trail (length + palette per kind; the dragon IS its trail)
      const tn = Math.min(a.trailN, K.trail);
      if (tn > 1 && a.kind !== 'dragon') {
        ctx.lineCap = 'round';
        const start = a.trailN - tn;
        for (let i = 1; i < tn; i++) {
          const f = i / tn;
          ctx.strokeStyle = this.trailColor(a, f);
          ctx.lineWidth = 3 * f + 0.5;
          ctx.beginPath();
          ctx.moveTo(a.trail[(start + i - 1) * 2], a.trail[(start + i - 1) * 2 + 1]);
          ctx.lineTo(a.trail[(start + i) * 2], a.trail[(start + i) * 2 + 1]);
          ctx.stroke();
        }
      }

      const v = Math.hypot(a.vx, a.vy) || 1;
      const ux = a.vx / v;
      const uy = a.vy / v;
      const ang = Math.atan2(a.vy, a.vx);

      switch (a.kind) {
        case 'dagger': this.renderDagger(ctx, a, ang, g); break;
        case 'bolt': this.renderBolt(ctx, a, g); break;
        case 'blade': this.renderBlade(ctx, a, ang, g); break;
        case 'dragon': this.renderDragon(ctx, a, ang, g); break;
        default: this.renderArrow(ctx, a, ux, uy, g); break;
      }
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

  trailColor(a, f) {
    if (a.flame) return `rgba(255,140,66,${0.35 * f})`;
    switch (a.kind) {
      case 'dagger': return `rgba(223,232,255,${0.25 * f})`;
      case 'bolt': return `rgba(198,155,255,${0.4 * f})`;
      case 'blade': return `rgba(216,244,255,${0.3 * f})`;
      default: return `rgba(255,193,77,${0.28 * f})`;
    }
  }

  renderArrow(ctx, a, ux, uy, g) {
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

  renderDagger(ctx, a, ang, g) {
    const s = g.scale;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang + a.phase * 1.6); // spinning steel
    ctx.strokeStyle = '#dfe8ff';
    ctx.lineWidth = 2.6 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9 * s, 0);
    ctx.lineTo(9 * s, 0);
    ctx.stroke();
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-4 * s, -4 * s);
    ctx.lineTo(-4 * s, 4 * s);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7 * s, -1.5 * s, 4 * s, 3 * s);
    ctx.restore();
  }

  renderBolt(ctx, a, g) {
    const s = g.scale;
    const r = (6 + Math.sin(a.phase * 3) * 1.5) * s;
    const gr = ctx.createRadialGradient(a.x, a.y, 1, a.x, a.y, r * 2.4);
    gr.addColorStop(0, 'rgba(240,225,255,0.9)');
    gr.addColorStop(0.4, 'rgba(198,155,255,0.5)');
    gr.addColorStop(1, 'rgba(198,155,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(a.x - r * 2.4, a.y - r * 2.4, r * 4.8, r * 4.8);
    ctx.fillStyle = '#f0e1ff';
    ctx.fillRect(a.x - r / 2, a.y - r / 2, r, r);
  }

  renderBlade(ctx, a, ang, g) {
    const s = g.scale;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#d8f4ff';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    // spectral crescent: two offset arcs
    ctx.beginPath();
    ctx.arc(-6 * s, 0, 13 * s, -1.15, 1.15);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.arc(-8 * s, 0, 13 * s, -0.9, 0.9);
    ctx.stroke();
    ctx.restore();
  }

  renderDragon(ctx, a, ang, g) {
    const s = g.scale;
    // spine: the trail itself is the dragon's body
    if (a.trailN > 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < a.trailN; i++) {
          const f = i / a.trailN;
          ctx.strokeStyle = pass === 0
            ? `rgba(255,193,77,${0.16 * f})`
            : `rgba(255,239,180,${0.55 * f})`;
          ctx.lineWidth = (pass === 0 ? 16 : 7) * f * s + 1;
          ctx.beginPath();
          ctx.moveTo(a.trail[(i - 1) * 2], a.trail[(i - 1) * 2 + 1]);
          ctx.lineTo(a.trail[i * 2], a.trail[i * 2 + 1]);
          ctx.stroke();
        }
      }
    }
    // head: bright wedge with horns and an ember eye
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang);
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath();
    ctx.moveTo(14 * s, 0);
    ctx.lineTo(-6 * s, -7 * s);
    ctx.lineTo(-6 * s, 7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffdf70';
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4 * s, -6 * s);
    ctx.lineTo(-11 * s, -12 * s);
    ctx.moveTo(-4 * s, 6 * s);
    ctx.lineTo(-11 * s, 12 * s);
    ctx.stroke();
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect(3 * s, -3 * s, 3 * s, 3 * s);
    ctx.restore();
  }
}
