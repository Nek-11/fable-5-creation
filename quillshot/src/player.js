// The archer: a smooth procedural stickman. Every letter typed pulls the
// bowstring further back (anticipation); a completed word snaps it loose.

import { CONFIG as C } from './config.js';
import { seg, limb, head, inkStyle } from './stickman.js';

const REST_AIM = -0.18; // resting bow angle (slightly up)

export class Player {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.draw = 0; // eased bowstring pull 0..1
    this.drawTarget = 0;
    this.aim = REST_AIM;
    this.aimTarget = REST_AIM;
    this.releaseT = 0;
    this.staggerT = 0;
    this.hurtT = 0;
    this.invuln = 0;
    this.bowHand = { x: 0, y: 0 };
    this.twangs = []; // release flash lines {a, len}
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

    this.releaseT = Math.max(0, this.releaseT - dt);
    this.staggerT = Math.max(0, this.staggerT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invuln = Math.max(0, this.invuln - dt);
  }

  render(ctx) {
    const g = this.game;
    const s = g.scale;
    const t = g.time;
    const px = this.x;

    // invulnerability flicker
    if (this.invuln > 0 && Math.sin(t * 40) > 0.2) ctx.globalAlpha = 0.45;

    // combo aura: warm glow that grows with the multiplier
    const mult = g.mult;
    if (mult > 1) {
      const r = (38 + mult * 14) * s;
      const gr = ctx.createRadialGradient(px, this.groundY - 40 * s, 4, px, this.groundY - 40 * s, r);
      gr.addColorStop(0, `rgba(255,140,66,${0.05 + mult * 0.035})`);
      gr.addColorStop(1, 'rgba(255,140,66,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(px - r, this.groundY - 40 * s - r, r * 2, r * 2 + 30);
    }

    ctx.save();

    // idle bob at prime-ratio frequencies so nothing visibly syncs
    const bob = Math.sin(t * 1.7) * 1.5 * s;
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

    const hipX = px - this.draw * 3 * s;
    const hipY = this.groundY - 38 * s + bob;
    const shX = hipX + 2 * s - this.draw * 2 * s;
    const shY = hipY - 22 * s + bob2 * 0.4;

    // legs: front foot toward the horde, knees bend forward
    const stance = 12 * s + this.draw * 4 * s;
    limb(ctx, hipX, hipY, px + stance, this.groundY, 21 * s, 21 * s, -1);
    limb(ctx, hipX, hipY, px - stance * 0.9, this.groundY, 21 * s, 21 * s, -1);

    // torso
    seg(ctx, hipX, hipY, shX, shY);

    // quiver on the back
    ctx.save();
    inkStyle(ctx, ink, 2.2 * s);
    const qx = hipX - 8 * s;
    const qy = hipY - 10 * s;
    seg(ctx, qx, qy, qx - 5 * s, qy - 14 * s);
    seg(ctx, qx - 2 * s, qy - 2 * s, qx - 8 * s, qy - 15 * s);
    ctx.restore();

    // bow arm + bow
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

    // head — tucks down to sight along the arrow as draw builds
    const headX = shX + 1 * s + this.draw * 3 * s;
    const headY = shY - 12 * s + this.draw * 2 * s + bob2;
    head(ctx, headX, headY, 7.5 * s);

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

    inkStyle(ctx, hurtMix > 0.15 ? ink : 'rgba(245,236,215,0.85)', 1.4 * s);
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

    // muzzle-flash twang lines on release
    if (this.releaseT > 0) {
      const a = this.releaseT / 0.2;
      ctx.globalAlpha *= a;
      inkStyle(ctx, C.COLORS.gold, 2 * s);
      for (const tw of this.twangs) {
        const la = tw.a - aim;
        seg(ctx, Math.cos(la) * 8 * s, Math.sin(la) * 8 * s, Math.cos(la) * (8 + tw.len) * s, Math.sin(la) * (8 + tw.len) * s);
      }
    }
    ctx.restore();

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
