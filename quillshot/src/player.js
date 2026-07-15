// The archer: a smooth procedural stickman whose weapon EVOLVES with the
// combo multiplier — bow → twin daggers → magic bolts → spectral blades →
// spirit dragon. Every correct letter builds anticipation; a completed word
// releases it.

import { CONFIG as C } from './config.js';
import { seg, limb, head, inkStyle } from './stickman.js';

const REST_AIM = -0.18; // resting weapon angle (slightly up)

export class Player {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.draw = 0; // eased anticipation 0..1
    this.drawTarget = 0;
    this.aim = REST_AIM;
    this.aimTarget = REST_AIM;
    this.releaseT = 0;
    this.staggerT = 0;
    this.hurtT = 0;
    this.invuln = 0;
    this.hover = 0; // levitation at tier 4+
    this.transformT = 0; // weapon morph flash
    this.transformTier = 1;
    this.bowHand = { x: 0, y: 0 }; // muzzle point for all weapons
    this.twangs = []; // release flash lines {a, len}
  }

  get tier() {
    return Math.max(1, Math.min(C.MAX_MULT, this.game.mult));
  }

  get x() {
    return this.game.w * C.PLAYER_X_FRAC;
  }

  get groundY() {
    return this.game.groundY;
  }

  setDraw(amount) {
    this.drawTarget = Math.min(1, amount);
  }

  release() {
    this.drawTarget = 0;
    this.draw = 0; // instant snap — the anticipation already happened
    this.releaseT = 0.2;
    this.twangs.length = 0;
    for (let i = 0; i < 4; i++) {
      this.twangs.push({ a: this.aim + (Math.random() - 0.5) * 1.6, len: 10 + Math.random() * 12 });
    }
  }

  transform(tier) {
    this.transformT = 0.4;
    this.transformTier = tier;
  }

  stagger() {
    this.staggerT = 0.5;
    this.drawTarget = 0;
  }

  hurt() {
    this.hurtT = 0.4;
    this.invuln = C.INVULN_TIME;
    this.stagger();
  }

  update(dt) {
    const k = 1 - Math.exp(-14 * dt);
    this.draw += (this.drawTarget - this.draw) * k;

    // aim at target (exponential smoothing), else drift to rest
    const t = this.game.target;
    if (t && !t.dead) {
      const sy = this.groundY - 60 * this.game.scale;
      this.aimTarget = Math.atan2(t.hitY() - sy, Math.max(40, t.x - this.x));
      this.aimTarget = Math.max(-0.85, Math.min(0.4, this.aimTarget));
    } else {
      this.aimTarget = REST_AIM;
    }
    this.aim += (this.aimTarget - this.aim) * (1 - Math.exp(-10 * dt));

    // levitate at tier 4+
    const hoverTarget = this.tier >= 4 ? (10 + (this.tier - 4) * 4) * this.game.scale : 0;
    this.hover += (hoverTarget - this.hover) * (1 - Math.exp(-5 * dt));

    this.releaseT = Math.max(0, this.releaseT - dt);
    this.staggerT = Math.max(0, this.staggerT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.transformT = Math.max(0, this.transformT - dt);
  }

  render(ctx) {
    const g = this.game;
    const s = g.scale;
    const t = g.time;
    const px = this.x;
    const tier = this.tier;

    // invulnerability flicker
    if (this.invuln > 0 && Math.sin(t * 40) > 0.2) ctx.globalAlpha = 0.45;

    // combo aura: glow that grows with the multiplier, tinted per weapon
    const mult = g.mult;
    if (mult > 1) {
      const r = (38 + mult * 16) * s;
      const cy = this.groundY - 40 * s - this.hover;
      const gr = ctx.createRadialGradient(px, cy, 4, px, cy, r);
      const auraCol = tier >= 5 ? '255,223,112' : tier >= 4 ? '216,244,255' : tier >= 3 ? '198,155,255' : '255,140,66';
      gr.addColorStop(0, `rgba(${auraCol},${0.05 + mult * 0.038})`);
      gr.addColorStop(1, `rgba(${auraCol},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(px - r, cy - r, r * 2, r * 2 + 30);
    }

    ctx.save();

    // idle bob at prime-ratio frequencies so nothing visibly syncs
    const bob = Math.sin(t * 1.7) * (1.5 + (tier >= 4 ? 1.6 : 0)) * s;
    const bob2 = Math.sin(t * 2.3) * 1.0 * s;

    // squash & stretch on release
    let sx = 1;
    let sy = 1;
    if (this.releaseT > 0) {
      const rt = this.releaseT / 0.2;
      sx = 1 + 0.12 * rt;
      sy = 1 - 0.08 * rt;
    }
    // anticipation crouch grows with the draw
    sy *= 1 - this.draw * 0.045;

    ctx.translate(px, this.groundY);
    ctx.scale(sx, sy);
    // stagger wobble
    if (this.staggerT > 0) {
      ctx.rotate(Math.sin(this.staggerT * 28) * 0.11 * (this.staggerT / 0.5));
    }
    // lean back into a heavy draw
    ctx.rotate(-this.draw * 0.07);
    ctx.translate(-px, -this.groundY);

    const hurtMix = this.hurtT > 0 ? this.hurtT / 0.4 : 0;
    const ink = hurtMix > 0.15 ? '#ff5c7a' : C.COLORS.ink;
    inkStyle(ctx, ink, 3.4 * s);

    const oy = this.hover; // levitation offset
    const hipX = px - this.draw * 3 * s;
    const hipY = this.groundY - 38 * s + bob - oy;
    const shX = hipX + 2 * s - this.draw * 2 * s;
    const shY = hipY - 22 * s + bob2 * 0.4;

    // legs: planted when grounded, dangling when levitating
    if (oy < 4 * s) {
      const stance = 12 * s + this.draw * 4 * s;
      limb(ctx, hipX, hipY, px + stance, this.groundY - oy, 21 * s, 21 * s, -1);
      limb(ctx, hipX, hipY, px - stance * 0.9, this.groundY - oy, 21 * s, 21 * s, -1);
    } else {
      for (let i = 0; i < 2; i++) {
        const sway = Math.sin(t * 2.3 + i * 1.7) * 3 * s;
        limb(ctx, hipX, hipY, hipX + (i ? 9 : -7) * s + sway, hipY + 34 * s, 19 * s, 19 * s, -1);
      }
    }

    // torso
    seg(ctx, hipX, hipY, shX, shY);

    // quiver on the back (bow tier only — the others don't need arrows)
    if (tier === 1) {
      ctx.save();
      inkStyle(ctx, ink, 2.2 * s);
      const qx = hipX - 8 * s;
      const qy = hipY - 10 * s;
      seg(ctx, qx, qy, qx - 5 * s, qy - 14 * s);
      seg(ctx, qx - 2 * s, qy - 2 * s, qx - 8 * s, qy - 15 * s);
      ctx.restore();
    }

    const headX = shX + 1 * s + this.draw * 3 * s;
    const headY = shY - 12 * s + this.draw * 2 * s + bob2;

    // weapon + arms per tier
    switch (tier) {
      case 2: this.renderDaggers(ctx, s, shX, shY, ink); break;
      case 3: this.renderChannel(ctx, s, shX, shY, ink, '#c69bff', '#f0e1ff'); break;
      case 4:
        this.renderChannel(ctx, s, shX, shY, ink, '#a8d8ea', '#eafcff');
        this.renderOrbitBlades(ctx, s, px, shY, t);
        break;
      case 5:
        this.renderChannel(ctx, s, shX, shY, ink, '#ffdf70', '#fff3cf');
        this.renderSpiritWisp(ctx, s, px, shY, t);
        break;
      default: this.renderBow(ctx, s, shX, shY, ink, g); break;
    }

    inkStyle(ctx, ink, 3.4 * s);
    head(ctx, headX, headY, 7.5 * s);

    // weapon transform flash: expanding ring
    if (this.transformT > 0) {
      const f = this.transformT / 0.4;
      const rr = (1 - f) * 70 * s + 8;
      ctx.globalAlpha = f * 0.8;
      ctx.lineWidth = 3 + f * 4;
      ctx.strokeStyle = this.transformTier >= 5 ? '#ffdf70' : this.transformTier >= 3 ? '#c69bff' : '#f5ecd7';
      ctx.beginPath();
      ctx.arc(shX, shY, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- weapons

  renderBow(ctx, s, shX, shY, ink, g) {
    const aim = this.aim;
    const dirX = Math.cos(aim);
    const dirY = Math.sin(aim);
    const armLen = 15 * s;
    const bowHandX = shX + dirX * armLen * 2;
    const bowHandY = shY + dirY * armLen * 2;
    this.bowHand.x = bowHandX;
    this.bowHand.y = bowHandY;
    limb(ctx, shX, shY, bowHandX, bowHandY, armLen * 1.05, armLen * 1.05, 1);

    // string hand: pulled back along the aim axis toward the cheek
    const pull = (8 + this.draw * 24) * s;
    const strX = bowHandX - dirX * pull;
    const strY = bowHandY - dirY * pull;
    limb(ctx, shX, shY, strX, strY, armLen * 1.05, armLen * 1.05, 1);

    // bow, string, nocked arrow (drawn in aim-local space)
    ctx.save();
    ctx.translate(bowHandX, bowHandY);
    ctx.rotate(aim);
    const bowR = 20 * s;
    inkStyle(ctx, ink, 3 * s);
    ctx.beginPath();
    ctx.moveTo(2 * s, -bowR);
    ctx.quadraticCurveTo((9 - this.draw * 12) * s, 0, 2 * s, bowR);
    ctx.stroke();

    inkStyle(ctx, 'rgba(245,236,215,0.85)', 1.4 * s);
    if (this.releaseT > 0.1) {
      // string vibrates right after release
      const vib = Math.sin(g.time * 90) * 3 * s * (this.releaseT / 0.2);
      ctx.beginPath();
      ctx.moveTo(2 * s, -bowR);
      ctx.quadraticCurveTo(-2 * s + vib, 0, 2 * s, bowR);
      ctx.stroke();
    } else {
      seg(ctx, 2 * s, -bowR, -pull, 0);
      seg(ctx, -pull, 0, 2 * s, bowR);
    }

    // nocked arrow appears as soon as a draw begins
    if (this.draw > 0.04) {
      inkStyle(ctx, C.COLORS.gold, 2 * s);
      seg(ctx, -pull, 0, 16 * s, 0);
      ctx.fillStyle = C.COLORS.gold;
      ctx.fillRect(14 * s, -2 * s, 5 * s, 4 * s); // chunky pixel head
    }

    this.renderTwangs(ctx, s);
    ctx.restore();
  }

  renderDaggers(ctx, s, shX, shY, ink) {
    const aim = this.aim;
    const dirX = Math.cos(aim);
    const dirY = Math.sin(aim);
    // lead hand forward, off hand low — both cocked back with the draw
    const back = this.draw * 9 * s;
    const h1x = shX + dirX * 22 * s - back;
    const h1y = shY + dirY * 22 * s - 2 * s;
    const h2x = shX + dirX * 10 * s - back * 0.7;
    const h2y = shY + 14 * s;
    limb(ctx, shX, shY, h1x, h1y, 16 * s, 16 * s, 1);
    limb(ctx, shX, shY, h2x, h2y, 16 * s, 16 * s, -1);
    this.bowHand.x = h1x + dirX * 8 * s;
    this.bowHand.y = h1y + dirY * 8 * s;

    // steel: two short blades, slightly crossed
    ctx.save();
    ctx.strokeStyle = '#dfe8ff';
    ctx.lineWidth = 2.6 * s;
    ctx.lineCap = 'round';
    for (const [hx, hy, da] of [[h1x, h1y, aim - 0.12], [h2x, h2y, aim - 0.55]]) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(da) * 15 * s, hy + Math.sin(da) * 15 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(da + 1.57) * 3.5 * s, hy + Math.sin(da + 1.57) * 3.5 * s);
      ctx.lineTo(hx - Math.cos(da + 1.57) * 3.5 * s, hy - Math.sin(da + 1.57) * 3.5 * s);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(this.bowHand.x, this.bowHand.y);
    ctx.rotate(aim);
    this.renderTwangs(ctx, s);
    ctx.restore();
  }

  // shared casting pose for bolt / blade / dragon tiers
  renderChannel(ctx, s, shX, shY, ink, glow, core) {
    const aim = this.aim;
    const dirX = Math.cos(aim);
    const dirY = Math.sin(aim);
    const px2 = -dirY;
    const py2 = dirX;
    const reach = (20 + this.draw * 8) * s;
    const h1x = shX + dirX * reach + px2 * 4 * s;
    const h1y = shY + dirY * reach + py2 * 4 * s;
    const h2x = shX + dirX * (reach - 3 * s) - px2 * 4 * s;
    const h2y = shY + dirY * (reach - 3 * s) - py2 * 4 * s;
    limb(ctx, shX, shY, h1x, h1y, 16 * s, 16 * s, 1);
    limb(ctx, shX, shY, h2x, h2y, 16 * s, 16 * s, -1);

    // the spell gathers between the palms, swelling with each letter
    const ox = shX + dirX * (reach + 10 * s);
    const oy2 = shY + dirY * (reach + 10 * s);
    this.bowHand.x = ox;
    this.bowHand.y = oy2;
    const r = (3.5 + this.draw * 8 + Math.sin(this.game.time * 6.9) * 0.8) * s;
    const gr = ctx.createRadialGradient(ox, oy2, 1, ox, oy2, r * 2.6);
    gr.addColorStop(0, core);
    gr.addColorStop(0.45, glow + 'aa');
    gr.addColorStop(1, glow + '00');
    ctx.fillStyle = gr;
    ctx.fillRect(ox - r * 2.6, oy2 - r * 2.6, r * 5.2, r * 5.2);
    ctx.fillStyle = core;
    ctx.fillRect(ox - r * 0.5, oy2 - r * 0.5, r, r);

    ctx.save();
    ctx.translate(ox, oy2);
    ctx.rotate(aim);
    this.renderTwangs(ctx, s);
    ctx.restore();
  }

  // tier 4: translucent sword crescents orbiting the archer
  renderOrbitBlades(ctx, s, px, shY, t) {
    ctx.save();
    ctx.strokeStyle = '#d8f4ff';
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = t * 1.9 + (i * Math.PI * 2) / 3;
      const bx = px + Math.cos(a) * 30 * s - 6 * s;
      const by = shY + Math.sin(a) * 12 * s - 4 * s;
      const depth = Math.sin(a) > 0 ? 1 : 0.5;
      ctx.globalAlpha = 0.4 * depth;
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(bx, by, 10 * s, a - 1, a + 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // tier 5: a small golden serpent coils around its master
  renderSpiritWisp(ctx, s, px, shY, t) {
    ctx.save();
    ctx.lineCap = 'round';
    const N = 9;
    for (let i = 0; i < N - 1; i++) {
      const a0 = t * 2.6 - i * 0.28;
      const a1 = t * 2.6 - (i + 1) * 0.28;
      const f = 1 - i / N;
      const x0 = px + Math.cos(a0) * 36 * s;
      const y0 = shY + Math.sin(a0 * 1.7) * 16 * s - 8 * s;
      const x1 = px + Math.cos(a1) * 36 * s;
      const y1 = shY + Math.sin(a1 * 1.7) * 16 * s - 8 * s;
      ctx.strokeStyle = `rgba(255,223,112,${0.55 * f})`;
      ctx.lineWidth = (5 * f + 1) * s;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // muzzle-flash lines on release, drawn in weapon-local space
  renderTwangs(ctx, s) {
    if (this.releaseT <= 0) return;
    const a = this.releaseT / 0.2;
    ctx.globalAlpha *= a;
    inkStyle(ctx, C.COLORS.gold, 2 * s);
    for (const tw of this.twangs) {
      const la = tw.a - this.aim;
      seg(ctx, Math.cos(la) * 8 * s, Math.sin(la) * 8 * s, Math.cos(la) * (8 + tw.len) * s, Math.sin(la) * (8 + tw.len) * s);
    }
    ctx.globalAlpha = 1;
  }
}
