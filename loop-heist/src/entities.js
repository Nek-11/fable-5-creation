// World: parses a level definition and owns every interactive element —
// pressure plates, toggle switches, sliding doors, laser gates, the guard,
// the loot and the exit. All updates run on the fixed tick and iterate
// arrays in a fixed order, so the whole thing is deterministic.
import { C, PAL } from './config.js';

const T = C.TILE;

export class World {
  constructor(def) {
    this.def = def;
    this.cols = def.map[0].length;
    this.rows = def.map.length;
    this.w = this.cols * T;
    this.h = this.rows * T;

    // 0 floor, 1 wall, 2 glass
    this.grid = new Uint8Array(this.cols * this.rows);
    this.start = { x: 24, y: 24 };
    this.exits = [];
    this.gems = [];
    this.plates = [];
    this.switches = [];
    this.doors = []; // groups
    this.lasers = []; // groups
    this.doorAt = new Map(); // tileIndex -> door group
    this.events = [];

    const doorTiles = new Map(); // char -> [{tx,ty}]
    const laserTiles = [];

    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = def.map[ty][tx];
        const i = ty * this.cols + tx;
        if (ch === '#') this.grid[i] = 1;
        else if (ch === 'x') this.grid[i] = 2;
        else {
          this.grid[i] = 0;
          const cx = tx * T + T / 2;
          const cy = ty * T + T / 2;
          if (ch === 'P') this.start = { x: cx, y: cy };
          else if (ch === 'E') this.exits.push({ tx, ty });
          else if (ch === 'g')
            this.gems.push({
              kind: this.gems.length,
              hx: cx,
              hy: cy,
              x: cx,
              y: cy,
              carrier: null,
            });
          else if (ch >= 'a' && ch <= 'c')
            this.plates.push({ ch, tx, ty, x: cx, y: cy, pressed: false, timer: 0 });
          else if (ch === 's' || ch === 't')
            this.switches.push({ ch, tx, ty, x: cx, y: cy, on: false });
          else if (ch === 'l' || ch === 'L') laserTiles.push({ tx, ty, blink: ch === 'l' });
          else if (ch >= 'A' && ch <= 'Z') {
            if (!doorTiles.has(ch)) doorTiles.set(ch, []);
            doorTiles.get(ch).push({ tx, ty });
          }
        }
      }
    }

    // --- door groups: contiguous same-letter tiles share one state ---
    for (const [ch, tiles] of doorTiles) {
      const groups = this.groupContiguous(tiles);
      for (const g of groups) {
        const first = g[0];
        // a door in a vertical wall (walls above+below) slides vertically
        const vertical =
          this.rawSolid(first.tx, first.ty - 1) && this.rawSolid(first.tx, first.ty + 1);
        const door = {
          ch,
          tiles: g,
          vertical,
          progress: 0, // 0 closed .. 1 open
          wasSolid: true,
          link: def.links?.[ch] ?? { type: 'hold', srcs: [] },
        };
        this.doors.push(door);
        for (const tl of g) this.doorAt.set(tl.ty * this.cols + tl.tx, door);
      }
    }

    // --- laser groups (staggered blink phases per group) ---
    const lcfg = def.lasers ?? { period: 0, on: 0, stagger: 0 };
    const lgroups = this.groupContiguous(laserTiles);
    lgroups.forEach((g, gi) => {
      const first = g[0];
      const vertical =
        this.rawSolid(first.tx, first.ty - 1) ||
        laserTiles.some((o) => o.tx === first.tx && o.ty === first.ty - 1) ||
        this.rawSolid(first.tx, first.ty + 1) ||
        laserTiles.some((o) => o.tx === first.tx && o.ty === first.ty + 1);
      this.lasers.push({
        tiles: g,
        vertical,
        blink: g[0].blink && lcfg.period > 0,
        period: lcfg.period || 1,
        on: lcfg.on || 1,
        phase: gi * (lcfg.stagger || 0),
      });
    });

    // --- guards ---
    this.guards = (def.guards ?? []).map((gd) => ({
      path: gd.path.map(([tx, ty]) => ({ x: tx * T + T / 2, y: ty * T + T / 2 })),
      speed: gd.speed ?? C.GUARD_SPEED,
      x: 0,
      y: 0,
      seg: 0,
      fwd: true,
      angle: Math.PI / 2,
      dir: 0,
      animDist: 0,
      moving: false,
      spotTicks: 0,
    }));

    this.resetRun();
  }

  groupContiguous(tiles) {
    const left = new Set(tiles.map((t) => t.ty * this.cols + t.tx));
    const byId = new Map(tiles.map((t) => [t.ty * this.cols + t.tx, t]));
    const groups = [];
    for (const t of tiles) {
      const id = t.ty * this.cols + t.tx;
      if (!left.has(id)) continue;
      const grp = [];
      const stack = [id];
      left.delete(id);
      while (stack.length) {
        const cur = stack.pop();
        grp.push(byId.get(cur));
        const cx = cur % this.cols;
        const cy = (cur / this.cols) | 0;
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          const nid = ny * this.cols + nx;
          if (left.has(nid)) {
            left.delete(nid);
            stack.push(nid);
          }
        }
      }
      grp.sort((a, b) => a.ty - b.ty || a.tx - b.tx);
      groups.push(grp);
    }
    groups.sort((a, b) => a[0].ty - b[0].ty || a[0].tx - b[0].tx);
    return groups;
  }

  // ------------------------------------------------------ state per run

  resetRun() {
    for (const g of this.gems) {
      g.x = g.hx;
      g.y = g.hy;
      g.carrier = null;
    }
    for (const p of this.plates) {
      p.pressed = false;
      p.timer = 0;
    }
    for (const s of this.switches) s.on = false;
    for (const d of this.doors) {
      d.progress = 0;
      d.wasSolid = true;
    }
    for (const g of this.guards) {
      g.x = g.path[0].x;
      g.y = g.path[0].y;
      g.seg = 0;
      g.fwd = true;
      g.angle = Math.PI / 2;
      g.dir = 0;
      g.animDist = 0;
      g.moving = false;
      g.spotTicks = 0;
    }
    this.events.length = 0;
  }

  // ------------------------------------------------------ solidity

  rawSolid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.grid[ty * this.cols + tx] !== 0;
  }

  isSolid(tx, ty) {
    if (this.rawSolid(tx, ty)) return true;
    const d = this.doorAt.get(ty * this.cols + tx);
    return d ? d.progress < C.DOOR_SOLID_BELOW : false;
  }

  // guards can see through glass cases, but not walls or closed doors
  blocksVision(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    if (this.grid[ty * this.cols + tx] === 1) return true;
    const d = this.doorAt.get(ty * this.cols + tx);
    return d ? d.progress < C.DOOR_SOLID_BELOW : false;
  }

  // ------------------------------------------------------ loot

  tryPickup(actor, isPlayer) {
    for (const g of this.gems) {
      if (g.carrier) continue;
      const dx = actor.x - g.x;
      const dy = actor.y - g.y;
      if (dx * dx + dy * dy < C.PICKUP_R * C.PICKUP_R) {
        g.carrier = actor;
        actor.carried.push(g);
        this.events.push({ type: isPlayer ? 'gem' : 'ghostGem', x: g.x, y: g.y, n: actor.carried.length });
      }
    }
  }

  dropCarried(actor) {
    let i = 0;
    for (const g of actor.carried) {
      g.carrier = null;
      // deterministic little fan so stacked gems don't overlap exactly
      g.x = actor.x + (i === 0 ? 0 : i === 1 ? -7 : 7);
      g.y = actor.y + (i > 0 ? 3 : 0);
      this.events.push({ type: 'drop', x: g.x, y: g.y });
      i++;
    }
    actor.carried.length = 0;
  }

  // ------------------------------------------------------ per-tick update
  // actors: every plate-pressing body, ghosts first then the player.

  update(tick, actors) {
    // plates
    for (const p of this.plates) {
      let held = false;
      for (const a of actors) {
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        if (dx * dx + dy * dy < C.PLATE_R * C.PLATE_R) {
          held = true;
          break;
        }
      }
      if (held && !p.pressed) {
        p.timer = this.linkDuration(p.ch);
        this.events.push({ type: 'plateOn', x: p.x, y: p.y });
      } else if (!held && p.pressed) {
        this.events.push({ type: 'plateOff', x: p.x, y: p.y });
      }
      p.pressed = held;
      if (!held && p.timer > 0) p.timer--;
    }

    // switches: edge-triggered per actor (must step off before re-flipping)
    for (let si = 0; si < this.switches.length; si++) {
      const s = this.switches[si];
      for (const a of actors) {
        const dx = a.x - s.x;
        const dy = a.y - s.y;
        const inside = dx * dx + dy * dy < C.PLATE_R * C.PLATE_R;
        if (inside && a.onSwitch !== si) {
          a.onSwitch = si;
          s.on = !s.on;
          this.events.push({ type: 'switch', x: s.x, y: s.y, on: s.on });
        } else if (!inside && a.onSwitch === si) {
          a.onSwitch = -1;
        }
      }
    }

    // doors
    for (const d of this.doors) {
      const open = this.doorWantsOpen(d);
      if (open) {
        if (d.progress < 1) d.progress = Math.min(1, d.progress + C.DOOR_SPEED);
      } else if (d.progress > 0) {
        // never close onto a body: hold while anyone overlaps the doorway
        if (!this.doorOccupied(d, actors)) d.progress = Math.max(0, d.progress - C.DOOR_SPEED);
      }
      const solid = d.progress < C.DOOR_SOLID_BELOW;
      if (solid !== d.wasSolid) {
        const t0 = d.tiles[0];
        this.events.push({
          type: solid ? 'doorClose' : 'doorOpen',
          x: t0.tx * T + T / 2,
          y: t0.ty * T + T / 2,
        });
        d.wasSolid = solid;
      }
    }

    // guards
    for (const g of this.guards) this.stepGuard(g);
  }

  linkDuration(plateCh) {
    for (const d of this.doors) {
      const l = d.link;
      if (l.type === 'timed' && l.srcs.includes(plateCh)) return l.duration;
    }
    return 0;
  }

  doorWantsOpen(d) {
    const l = d.link;
    if (l.type === 'switch') {
      const ons = l.srcs.map((ch) => this.switches.find((s) => s.ch === ch)?.on ?? false);
      return l.mode === 'all' ? ons.every(Boolean) : ons.some(Boolean);
    }
    // plate-driven
    for (const ch of l.srcs) {
      for (const p of this.plates) {
        if (p.ch !== ch) continue;
        if (p.pressed) return true;
        if (l.type === 'timed' && p.timer > 0) return true;
      }
    }
    return false;
  }

  doorOccupied(d, actors) {
    for (const tl of d.tiles) {
      const left = tl.tx * T;
      const top = tl.ty * T;
      for (const a of actors) {
        const cx = a.x < left ? left : a.x > left + T ? left + T : a.x;
        const cy = a.y < top ? top : a.y > top + T ? top + T : a.y;
        const dx = a.x - cx;
        const dy = a.y - cy;
        if (dx * dx + dy * dy < a.r * a.r) return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------ guards

  stepGuard(g) {
    const target = g.path[g.fwd ? g.seg + 1 : g.seg];
    const dx = target.x - g.x;
    const dy = target.y - g.y;
    const dist = Math.hypot(dx, dy);
    const step = g.speed * C.TICK;
    g.moving = false;

    if (dist <= step) {
      g.x = target.x;
      g.y = target.y;
      if (g.fwd) {
        if (g.seg + 1 >= g.path.length - 1) g.fwd = false;
        else g.seg++;
      } else {
        if (g.seg === 0) g.fwd = true;
        else g.seg--;
      }
      return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    // blocked by a closed door just ahead? turn around.
    const lookX = g.x + nx * (step + 6);
    const lookY = g.y + ny * (step + 6);
    if (this.isSolid(Math.floor(lookX / T), Math.floor(lookY / T))) {
      g.fwd = !g.fwd;
      return;
    }

    g.x += nx * step;
    g.y += ny * step;
    g.angle = Math.atan2(ny, nx);
    g.moving = true;
    g.animDist += step;
    g.dir = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 3 : 2) : ny > 0 ? 0 : 1;
  }

  // is the (live) player inside a guard's flashlight cone with clear LOS?
  guardSeesPoint(g, px, py) {
    const dx = px - g.x;
    const dy = py - g.y;
    const dist = Math.hypot(dx, dy);
    if (dist > C.GUARD_VIEW_DIST) return false;
    if (dist > 1) {
      let da = Math.atan2(dy, dx) - g.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > C.GUARD_VIEW_HALF) return false;
    }
    // ray march for line of sight
    const steps = Math.ceil(dist / 4);
    for (let i = 1; i < steps; i++) {
      const x = g.x + (dx * i) / steps;
      const y = g.y + (dy * i) / steps;
      if (this.blocksVision(Math.floor(x / T), Math.floor(y / T))) return false;
    }
    return true;
  }

  // spotTicks grace so a single grazing frame doesn't kill
  guardsSpot(player) {
    let spotted = false;
    for (const g of this.guards) {
      if (this.guardSeesPoint(g, player.x, player.y)) {
        g.spotTicks++;
        if (g.spotTicks >= C.GUARD_SPOT_TICKS) spotted = true;
      } else {
        g.spotTicks = 0;
      }
    }
    return spotted;
  }

  // ------------------------------------------------------ lasers

  laserActive(l, tick) {
    if (!l.blink) return true;
    return (tick + l.phase) % l.period < l.on;
  }

  // 0..1 how close an inactive blinking laser is to firing (for the warn glow)
  laserWarmth(l, tick) {
    if (!l.blink) return 0;
    const t = (tick + l.phase) % l.period;
    const until = l.period - t;
    return until <= 16 ? 1 - until / 16 : 0;
  }

  playerHitsLaser(p, tick) {
    for (const l of this.lasers) {
      if (!this.laserActive(l, tick)) continue;
      for (const tl of l.tiles) {
        // thin beam through the middle of the tile
        let x0, y0, x1, y1;
        if (l.vertical) {
          x0 = x1 = tl.tx * T + T / 2;
          y0 = tl.ty * T;
          y1 = y0 + T;
        } else {
          y0 = y1 = tl.ty * T + T / 2;
          x0 = tl.tx * T;
          x1 = x0 + T;
        }
        // point-segment distance
        const vx = x1 - x0;
        const vy = y1 - y0;
        const tt = Math.max(0, Math.min(1, ((p.x - x0) * vx + (p.y - y0) * vy) / (vx * vx + vy * vy)));
        const dx = p.x - (x0 + vx * tt);
        const dy = p.y - (y0 + vy * tt);
        if (dx * dx + dy * dy < (p.r - 1) * (p.r - 1)) return { x: p.x, y: p.y };
      }
    }
    return null;
  }

  // ------------------------------------------------------ exit

  playerAtExit(p) {
    const tx = Math.floor(p.x / T);
    const ty = Math.floor(p.y / T);
    return this.exits.some((e) => e.tx === tx && e.ty === ty);
  }

  // ================================================================
  // RENDERING
  // ================================================================

  buildBackground(ts) {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const v = this.grid[ty * this.cols + tx];
        const checker = (tx + ty) % 2;
        if (v === 1) g.drawImage(ts.tiles.wall, tx * T, ty * T);
        else if (v === 2) g.drawImage(ts.tiles.glass, tx * T, ty * T);
        else {
          g.drawImage(checker ? ts.tiles.floor1 : ts.tiles.floor0, tx * T, ty * T);
          // sparse floor detail
          if (ts.hash(tx, ty) > 0.85) {
            g.fillStyle = 'rgba(255,255,255,0.03)';
            g.fillRect(tx * T + 6, ty * T + 9, 4, 1);
          }
        }
      }
    }
    // wall drop-shadows on floor below
    g.fillStyle = 'rgba(0,0,0,0.32)';
    for (let ty = 1; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.grid[ty * this.cols + tx] === 0 && this.grid[(ty - 1) * this.cols + tx] === 1) {
          g.fillRect(tx * T, ty * T, T, 3);
        }
      }
    }
    // exit doorways
    for (const e of this.exits) g.drawImage(ts.tiles.exit, e.tx * T, e.ty * T);
    // pedestals under gem home spots
    for (const gm of this.gems) {
      const tx = Math.floor(gm.hx / T);
      const ty = Math.floor(gm.hy / T);
      g.drawImage((tx + ty) % 2 ? ts.tiles.pedestal1 : ts.tiles.pedestal0, tx * T, ty * T);
    }
    return c;
  }

  drawFloorLayer(g, ts, tick) {
    // plates
    for (const p of this.plates) {
      const on = p.pressed || p.timer > 0;
      const checker = (p.tx + p.ty) % 2;
      const img = on
        ? checker ? ts.tiles.plateDown1 : ts.tiles.plateDown0
        : checker ? ts.tiles.plateUp1 : ts.tiles.plateUp0;
      g.drawImage(img, p.tx * T, p.ty * T);
      if (p.timer > 0 && !p.pressed) {
        // draining ring for timed pads
        g.fillStyle = 'rgba(127,216,232,0.7)';
        const frac = p.timer / Math.max(1, this.linkDuration(p.ch));
        g.fillRect(p.tx * T + 3, p.ty * T + 14, Math.round(10 * frac), 1);
      }
    }
    // switches
    for (const s of this.switches) {
      const checker = (s.tx + s.ty) % 2;
      const img = s.on
        ? checker ? ts.tiles.switchOn1 : ts.tiles.switchOn0
        : checker ? ts.tiles.switchOff1 : ts.tiles.switchOff0;
      g.drawImage(img, s.tx * T, s.ty * T);
    }
    // exit pulse
    const pulse = 0.25 + 0.15 * Math.sin(tick * 0.08);
    g.fillStyle = `rgba(61,255,136,${pulse.toFixed(3)})`;
    for (const e of this.exits) {
      g.fillRect(e.tx * T + 2, e.ty * T + 2, 12, 2);
    }
  }

  drawDoors(g) {
    for (const d of this.doors) {
      for (const tl of d.tiles) {
        const x = tl.tx * T;
        const y = tl.ty * T;
        const slide = Math.round(d.progress * 14);
        g.save();
        g.beginPath();
        g.rect(x, y, T, T);
        g.clip();
        // recessed track
        g.fillStyle = '#0a0f1c';
        g.fillRect(x, y, T, T);
        // the sliding slab
        const sy = d.vertical ? y - slide : y;
        const hx = d.vertical ? x : x - slide;
        g.fillStyle = PAL.steelDark;
        g.fillRect(hx, sy, T, T);
        g.fillStyle = PAL.steel;
        if (d.vertical) g.fillRect(hx, sy + 13, T, 2);
        else g.fillRect(hx + 13, sy, 2, T);
        // hazard stripes
        g.fillStyle = PAL.warn;
        for (let k = 0; k < 4; k++) {
          if (d.vertical) g.fillRect(hx + k * 4, sy + 5 + ((k % 2) * 2), 3, 2);
          else g.fillRect(hx + 5 + ((k % 2) * 2), sy + k * 4, 2, 3);
        }
        g.restore();
        // frame studs
        g.fillStyle = '#0a0f1c';
        if (d.vertical) {
          g.fillRect(x, y, 2, T);
          g.fillRect(x + 14, y, 2, T);
        } else {
          g.fillRect(x, y, T, 2);
          g.fillRect(x, y + 14, T, 2);
        }
      }
    }
  }

  drawLasers(g, tick) {
    for (const l of this.lasers) {
      const active = this.laserActive(l, tick);
      const warmth = this.laserWarmth(l, tick);
      for (const tl of l.tiles) {
        const x = tl.tx * T;
        const y = tl.ty * T;
        if (active) {
          const flick = 0.75 + 0.25 * Math.sin(tick * 1.7 + tl.tx * 3 + tl.ty * 5);
          g.fillStyle = `rgba(255,51,85,${(0.28 * flick).toFixed(3)})`;
          if (l.vertical) g.fillRect(x + 5, y, 6, T);
          else g.fillRect(x, y + 5, T, 6);
          g.fillStyle = PAL.laser;
          if (l.vertical) g.fillRect(x + 7, y, 2, T);
          else g.fillRect(x, y + 7, T, 2);
          g.fillStyle = PAL.laserCore;
          if (l.vertical) g.fillRect(x + 7, y, 1, T);
          else g.fillRect(x, y + 7, T, 1);
        } else if (warmth > 0) {
          g.fillStyle = `rgba(255,51,85,${(0.22 * warmth).toFixed(3)})`;
          if (l.vertical) g.fillRect(x + 7, y, 2, T);
          else g.fillRect(x, y + 7, T, 2);
        }
        // emitter studs where the beam meets a wall
        g.fillStyle = active ? '#ff7285' : '#5a2230';
        if (l.vertical) {
          if (this.rawSolid(tl.tx, tl.ty - 1)) g.fillRect(x + 6, y, 4, 3);
          if (this.rawSolid(tl.tx, tl.ty + 1)) g.fillRect(x + 6, y + 13, 4, 3);
        } else {
          if (this.rawSolid(tl.tx - 1, tl.ty)) g.fillRect(x, y + 6, 3, 4);
          if (this.rawSolid(tl.tx + 1, tl.ty)) g.fillRect(x + 13, y + 6, 3, 4);
        }
      }
    }
  }

  drawVisionCones(g, alarmed) {
    for (const gd of this.guards) {
      const rays = 15;
      g.beginPath();
      g.moveTo(gd.x, gd.y);
      for (let i = 0; i <= rays; i++) {
        const a = gd.angle - C.GUARD_VIEW_HALF + (2 * C.GUARD_VIEW_HALF * i) / rays;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        let d = C.GUARD_VIEW_DIST;
        for (let m = 6; m < C.GUARD_VIEW_DIST; m += 3) {
          if (this.blocksVision(Math.floor((gd.x + ca * m) / T), Math.floor((gd.y + sa * m) / T))) {
            d = m;
            break;
          }
        }
        g.lineTo(gd.x + ca * d, gd.y + sa * d);
      }
      g.closePath();
      const grad = g.createRadialGradient(gd.x, gd.y, 4, gd.x, gd.y, C.GUARD_VIEW_DIST);
      if (alarmed || gd.spotTicks > 0) {
        grad.addColorStop(0, 'rgba(255,80,64,0.42)');
        grad.addColorStop(1, 'rgba(255,80,64,0.05)');
      } else {
        grad.addColorStop(0, 'rgba(255,224,130,0.30)');
        grad.addColorStop(1, 'rgba(255,224,130,0.02)');
      }
      g.fillStyle = grad;
      g.fill();
    }
  }
}
