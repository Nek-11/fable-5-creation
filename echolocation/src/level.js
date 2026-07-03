// Procedural cave level: braided maze grid, displaced cave geometry,
// grid collision, BFS pathfinding, and spawn-point analysis.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG as C } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// deterministic world-space noise so displaced vertices never crack at seams
function vn(x, y, z) {
  return (
    (Math.sin(x * 1.7 + Math.sin(y * 2.3 + 1.3)) +
      Math.sin(y * 1.9 + Math.sin(z * 1.7 + 4.2)) +
      Math.sin(z * 2.3 + Math.sin(x * 1.3 + 2.1))) /
    3
  );
}

export class Level {
  constructor(def, seed) {
    this.def = def;
    this.n = def.grid;
    this.rng = mulberry32(seed);
    this.grid = this.generate();
    this.openCells = [];
    for (let z = 0; z < this.n; z++)
      for (let x = 0; x < this.n; x++) if (!this.grid[z][x]) this.openCells.push([x, z]);
    this.analyze();
    this.group = null;
  }

  // ----- generation -----

  generate() {
    const n = this.n;
    const g = Array.from({ length: n }, () => Array(n).fill(true));
    const stack = [[1, 1]];
    g[1][1] = false;
    const dirs = [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ];
    while (stack.length) {
      const [cx, cz] = stack[stack.length - 1];
      const opts = [];
      for (const [dx, dz] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx > 0 && nz > 0 && nx < n - 1 && nz < n - 1 && g[nz][nx])
          opts.push([nx, nz, cx + dx / 2, cz + dz / 2]);
      }
      if (!opts.length) {
        stack.pop();
        continue;
      }
      const [nx, nz, wx, wz] = opts[(this.rng() * opts.length) | 0];
      g[wz][wx] = false;
      g[nz][nx] = false;
      stack.push([nx, nz]);
    }

    // braid: open some walls between parallel corridors so there are loops
    // (escape routes matter in a game where you can't fight)
    for (let z = 1; z < n - 1; z++) {
      for (let x = 1; x < n - 1; x++) {
        if (!g[z][x]) continue;
        const h = !g[z][x - 1] && !g[z][x + 1] && g[z - 1][x] && g[z + 1][x];
        const v = !g[z - 1][x] && !g[z + 1][x] && g[z][x - 1] && g[z][x + 1];
        if ((h || v) && this.rng() < this.def.braid) g[z][x] = false;
      }
    }

    // chambers: clear a few 3x3 rooms
    for (let i = 0; i < this.def.chambers; i++) {
      const ax = 1 + 2 * ((this.rng() * ((n - 4) / 2)) | 0);
      const az = 1 + 2 * ((this.rng() * ((n - 4) / 2)) | 0);
      for (let z = az; z < Math.min(az + 3, n - 1); z++)
        for (let x = ax; x < Math.min(ax + 3, n - 1); x++) g[z][x] = false;
    }
    return g;
  }

  // ----- queries -----

  isWall(gx, gz) {
    if (gx < 0 || gz < 0 || gx >= this.n || gz >= this.n) return true;
    return this.grid[gz][gx];
  }

  cellFromWorld(x, z) {
    const h = (this.n - 1) / 2;
    return [Math.round(x / C.CELL + h), Math.round(z / C.CELL + h)];
  }

  worldFromCell(gx, gz) {
    const h = (this.n - 1) / 2;
    return new THREE.Vector3((gx - h) * C.CELL, 0, (gz - h) * C.CELL);
  }

  collideCircle(pos, r) {
    const [pgx, pgz] = this.cellFromWorld(pos.x, pos.z);
    const half = C.CELL / 2;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = pgx + dx;
        const gz = pgz + dz;
        if (!this.isWall(gx, gz)) continue;
        const c = this.worldFromCell(gx, gz);
        const cx = Math.max(c.x - half, Math.min(pos.x, c.x + half));
        const cz = Math.max(c.z - half, Math.min(pos.z, c.z + half));
        const ex = pos.x - cx;
        const ez = pos.z - cz;
        const d2 = ex * ex + ez * ez;
        if (d2 > r * r) continue;
        if (d2 < 1e-9) {
          const ox = pos.x - c.x;
          const oz = pos.z - c.z;
          if (Math.abs(ox) > Math.abs(oz)) pos.x = c.x + Math.sign(ox || 1) * (half + r);
          else pos.z = c.z + Math.sign(oz || 1) * (half + r);
          continue;
        }
        const d = Math.sqrt(d2);
        pos.x = cx + (ex / d) * r;
        pos.z = cz + (ez / d) * r;
      }
    }
  }

  hasLOS(a, b) {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(dist / 0.6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const [gx, gz] = this.cellFromWorld(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      if (this.isWall(gx, gz)) return false;
    }
    return true;
  }

  bfs(fromX, fromZ) {
    const n = this.n;
    const dist = new Int16Array(n * n).fill(-1);
    const parent = new Int32Array(n * n).fill(-1);
    const q = [fromZ * n + fromX];
    dist[q[0]] = 0;
    for (let head = 0; head < q.length; head++) {
      const cur = q[head];
      const cx = cur % n;
      const cz = (cur / n) | 0;
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (this.isWall(nx, nz)) continue;
        const ni = nz * n + nx;
        if (dist[ni] !== -1) continue;
        dist[ni] = dist[cur] + 1;
        parent[ni] = cur;
        q.push(ni);
      }
    }
    return { dist, parent };
  }

  path(fromCell, toCell) {
    const n = this.n;
    const { dist, parent } = this.bfs(fromCell[0], fromCell[1]);
    let cur = toCell[1] * n + toCell[0];
    if (dist[cur] === -1) return null;
    const cells = [];
    while (cur !== -1) {
      cells.push([cur % n, (cur / n) | 0]);
      cur = parent[cur];
    }
    cells.reverse();
    return cells;
  }

  // ----- spawn analysis -----

  analyze() {
    const n = this.n;
    this.startCell = [1, 1];
    const { dist } = this.bfs(1, 1);
    let maxD = 0;
    let exit = [n - 2, n - 2];
    for (const [x, z] of this.openCells) {
      const d = dist[z * n + x];
      if (d > maxD) {
        maxD = d;
        exit = [x, z];
      }
    }
    this.exitCell = exit;
    this.maxDist = maxD;

    // dead ends far from the start make good moth prisons
    const deadEnds = this.openCells
      .filter(([x, z]) => {
        let walls = 0;
        if (this.isWall(x + 1, z)) walls++;
        if (this.isWall(x - 1, z)) walls++;
        if (this.isWall(x, z + 1)) walls++;
        if (this.isWall(x, z - 1)) walls++;
        const d = dist[z * n + x];
        return walls === 3 && d > maxD * 0.25 && !(x === exit[0] && z === exit[1]);
      })
      .sort((a, b) => dist[b[1] * n + b[0]] - dist[a[1] * n + a[0]]);

    this.mothCells = [];
    const want = this.def.moths;
    for (let i = 0; i < want; i++) {
      const pick = deadEnds[Math.min(((i * deadEnds.length) / want) | 0, deadEnds.length - 1)];
      if (pick) this.mothCells.push(pick);
    }
    // fallback if the maze produced too few dead ends
    while (this.mothCells.length < want) {
      const [x, z] = this.openCells[(this.rng() * this.openCells.length) | 0];
      if (dist[z * n + x] > maxD * 0.3 && !this.mothCells.some(([a, b]) => a === x && b === z))
        this.mothCells.push([x, z]);
    }

    const mid = this.openCells.filter(([x, z]) => {
      const d = dist[z * n + x];
      return d > maxD * 0.3 && d < maxD * 0.85;
    });
    // shuffle
    for (let i = mid.length - 1; i > 0; i--) {
      const j = (this.rng() * (i + 1)) | 0;
      [mid[i], mid[j]] = [mid[j], mid[i]];
    }
    this.creatureCells = mid;
  }

  randomOpenCellNear(cell, radius) {
    for (let tries = 0; tries < 12; tries++) {
      const [x, z] = this.openCells[(this.rng() * this.openCells.length) | 0];
      if (Math.abs(x - cell[0]) + Math.abs(z - cell[1]) <= radius) return [x, z];
    }
    return this.openCells[(this.rng() * this.openCells.length) | 0];
  }

  // ----- geometry -----

  build(scene, pings) {
    this.caveMat = pings.material({ touch: [0.1, 0.14, 0.16] });
    const group = new THREE.Group();
    const n = this.n;
    const w = n * C.CELL;

    const floor = new THREE.PlaneGeometry(w, w, n * 3, n * 3);
    floor.rotateX(-Math.PI / 2);
    let pos = floor.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, vn(x * 0.45, 7.7, z * 0.45) * 0.45 + vn(x * 1.6, 3.1, z * 1.6) * 0.12);
    }
    group.add(new THREE.Mesh(floor, this.caveMat));

    const ceil = new THREE.PlaneGeometry(w, w, n * 3, n * 3);
    ceil.rotateX(Math.PI / 2);
    pos = ceil.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const droop =
        0.35 + Math.abs(vn(x * 0.5, 11.3, z * 0.5)) * 1.3 + Math.abs(vn(x * 1.9, 5.5, z * 1.9)) * 0.3;
      pos.setY(i, C.WALL_H - droop);
    }
    group.add(new THREE.Mesh(ceil, this.caveMat));

    // wall boxes — only cells that border an open cell are ever visible
    const boxes = [];
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        if (!this.grid[z][x]) continue;
        let exposed = false;
        for (let dz = -1; dz <= 1 && !exposed; dz++)
          for (let dx = -1; dx <= 1 && !exposed; dx++)
            if (!this.isWall(x + dx, z + dz)) exposed = true;
        if (!exposed) continue;
        const b = new THREE.BoxGeometry(C.CELL, C.WALL_H + 1.2, C.CELL, 2, 4, 2);
        const c = this.worldFromCell(x, z);
        b.translate(c.x, C.WALL_H / 2 - 0.5, c.z);
        boxes.push(b);
      }
    }
    const walls = mergeGeometries(boxes, false);
    pos = walls.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      pos.setX(i, x + vn(x * 0.6 + 31, y * 0.6, z * 0.6) * 0.32);
      pos.setZ(i, z + vn(x * 0.6, y * 0.6, z * 0.6 + 17) * 0.32);
      pos.setY(i, y + vn(x * 0.9 + 5, y * 0.9, z * 0.9) * 0.2);
    }
    group.add(new THREE.Mesh(walls, this.caveMat));

    // exit gate: a ring and disc sunk into the floor at the far cell
    this.exitWorld = this.worldFromCell(...this.exitCell);
    this.exitRingMat = new THREE.MeshBasicMaterial({
      color: 0x551318,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.exitDiscMat = new THREE.MeshBasicMaterial({
      color: 0x30090c,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 8, 42), this.exitRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(this.exitWorld).setY(0.62);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 36), this.exitDiscMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.copy(this.exitWorld).setY(0.6);
    group.add(ring, disc);

    this.group = group;
    scene.add(group);
  }

  setGateOpen(open) {
    if (open) {
      this.exitRingMat.color.set(0x5ce8ff);
      this.exitDiscMat.color.set(0x1a6d80);
    }
  }

  pulseGate(time, open) {
    const s = Math.sin(time * (open ? 3.2 : 1.4)) * 0.5 + 0.5;
    this.exitRingMat.opacity = open ? 0.45 + s * 0.45 : 0.18 + s * 0.14;
    this.exitDiscMat.opacity = open ? 0.25 + s * 0.3 : 0.1 + s * 0.08;
  }

  dispose(scene) {
    if (!this.group) return;
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.caveMat.dispose();
    this.exitRingMat.dispose();
    this.exitDiscMat.dispose();
    this.group = null;
  }
}
