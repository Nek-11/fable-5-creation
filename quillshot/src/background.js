// Pixelated dusk backdrop: rendered every frame to a low-res offscreen
// canvas, then scaled up with image smoothing off. The fat pixels are the
// point — smooth stickmen live on top of this at full resolution.

import { CONFIG as C } from './config.js';

export class Background {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.lw = 0; // low-res dims
    this.lh = 0;
    this.clouds = [];
    this.stars = [];
    this.hills = []; // [{heights[], color, drift}]
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.lw = Math.ceil(w / C.PX);
    this.lh = Math.ceil(h / C.PX);
    this.canvas.width = this.lw;
    this.canvas.height = this.lh;

    const groundLY = this.lh * C.GROUND_FRAC;

    // stars in the top half of the sky
    this.stars = [];
    const nStars = Math.floor(this.lw * 0.14);
    for (let i = 0; i < nStars; i++) {
      this.stars.push({
        x: Math.random() * this.lw,
        y: Math.random() * groundLY * 0.5,
        tw: 1 + Math.random() * 2.5, // twinkle speed
        ph: Math.random() * Math.PI * 2,
      });
    }

    // drifting pixel clouds
    this.clouds = [];
    const nClouds = 7;
    for (let i = 0; i < nClouds; i++) {
      this.clouds.push({
        x: Math.random() * this.lw,
        y: groundLY * (0.12 + Math.random() * 0.42),
        w: 14 + Math.random() * 26,
        h: 3 + Math.random() * 4,
        speed: 1.2 + Math.random() * 2.4, // low-px per second
        shade: Math.random() < 0.5 ? 0 : 1,
      });
    }

    // silhouetted hill layers (far → near)
    const layers = [
      { color: '#3a2a63', base: 0.82, amp: 0.11, freq: 0.9, drift: 0.10 },
      { color: '#2c2050', base: 0.9, amp: 0.08, freq: 1.7, drift: 0.22 },
      { color: '#221741', base: 0.96, amp: 0.05, freq: 2.9, drift: 0.4 },
    ];
    this.hills = layers.map((L, li) => {
      const heights = new Float32Array(this.lw + 2);
      for (let x = 0; x < heights.length; x++) {
        const u = x / this.lw;
        // sum of incommensurate sines → rolling silhouette
        const n =
          Math.sin(u * 6.28 * L.freq + li * 7.3) * 0.55 +
          Math.sin(u * 6.28 * L.freq * 2.13 + li * 2.1) * 0.3 +
          Math.sin(u * 6.28 * L.freq * 4.7 + li * 4.8) * 0.15;
        heights[x] = groundLY * L.base - (n * 0.5 + 0.5) * groundLY * L.amp;
      }
      return { heights, color: L.color, drift: L.drift };
    });
  }

  render(ctx, t, shakeX, shakeY) {
    const g = this.ctx;
    const lw = this.lw;
    const lh = this.lh;
    const groundLY = Math.floor(lh * C.GROUND_FRAC);

    // --- sky: hard horizontal bands, indigo → ember horizon ---
    const bands = [
      [0.0, '#120a2e'],
      [0.22, '#1a1043'],
      [0.42, '#2b1a5c'],
      [0.58, '#4a2668'],
      [0.7, '#7c3563'],
      [0.8, '#b34f52'],
      [0.88, '#e2703f'],
      [0.94, '#ff9d5c'],
    ];
    for (let i = 0; i < bands.length; i++) {
      const y0 = Math.floor(bands[i][0] * groundLY);
      const y1 = i + 1 < bands.length ? Math.floor(bands[i + 1][0] * groundLY) : groundLY;
      g.fillStyle = bands[i][1];
      g.fillRect(0, y0, lw, y1 - y0);
    }

    // stars twinkle in the deep indigo
    for (const s of this.stars) {
      const a = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
      g.globalAlpha = a * Math.max(0, 1 - s.y / (groundLY * 0.55));
      g.fillStyle = '#f5ecd7';
      g.fillRect(s.x | 0, s.y | 0, 1, 1);
    }
    g.globalAlpha = 1;

    // low sun with banded glow
    const sunX = Math.floor(lw * 0.68);
    const sunY = Math.floor(groundLY * 0.86);
    const sunR = Math.max(6, Math.floor(lh * 0.055));
    g.fillStyle = 'rgba(255,157,92,0.25)';
    this.pixelDisc(g, sunX, sunY, sunR + 4);
    g.fillStyle = '#ffb85c';
    this.pixelDisc(g, sunX, sunY, sunR);
    g.fillStyle = '#ffd27a';
    this.pixelDisc(g, sunX, sunY, Math.floor(sunR * 0.62));

    // clouds drift; dark silhouettes near horizon, lit above
    for (const c of this.clouds) {
      c.x -= 0; // movement applied via t below (deterministic, pause-friendly)
      const cx = ((c.x - t * c.speed) % (lw + c.w + 20) + lw + c.w + 20) % (lw + c.w + 20) - c.w - 10;
      g.fillStyle = c.shade ? '#513061' : '#6a3a66';
      g.fillRect(cx | 0, c.y | 0, c.w | 0, c.h | 0);
      g.fillRect((cx + c.w * 0.2) | 0, (c.y - c.h * 0.7) | 0, (c.w * 0.55) | 0, Math.max(1, c.h * 0.7) | 0);
      g.fillStyle = 'rgba(255,157,92,0.35)';
      g.fillRect(cx | 0, (c.y + c.h - 1) | 0, c.w | 0, 1);
    }

    // hills (drift gives faint parallax life even with a static camera)
    for (const hl of this.hills) {
      g.fillStyle = hl.color;
      const off = Math.floor(t * hl.drift) % 1; // effectively static; shake does the parallax
      for (let x = 0; x < lw; x++) {
        const y = hl.heights[(x + off) % hl.heights.length] | 0;
        g.fillRect(x, y, 1, groundLY - y + 1);
      }
    }

    // ground
    g.fillStyle = '#180f33';
    g.fillRect(0, groundLY, lw, lh - groundLY);
    // rim light where the last sun grazes the field
    g.fillStyle = '#5a2f56';
    g.fillRect(0, groundLY, lw, 1);
    // sparse ground speckle
    g.fillStyle = '#241549';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 97 + 13) * 7919) % lw;
      const sy = groundLY + 2 + (((i * 31 + 7) * 6271) % Math.max(1, lh - groundLY - 3));
      g.fillRect(sx, sy, 2, 1);
    }

    // --- blit up, pixels intact, slight parallax on shake ---
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, shakeX * 0.35, shakeY * 0.35, this.lw * C.PX, this.lh * C.PX);
    ctx.imageSmoothingEnabled = true;
  }

  pixelDisc(g, cx, cy, r) {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
      g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
  }
}
