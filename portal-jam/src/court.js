import * as THREE from 'three';
import { COLORS, HOOP } from './config.js';

// ---------- procedural hardwood ----------
function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');

  g.fillStyle = '#b97a3f';
  g.fillRect(0, 0, 512, 512);

  // planks
  const plankH = 42;
  for (let y = 0; y < 512; y += plankH) {
    const row = y / plankH;
    for (let x = -64; x < 512; x += 128) {
      const off = (row % 2) * 64;
      const hue = 24 + Math.sin(row * 3.7 + x * 0.01) * 4;
      const light = 38 + ((Math.sin(x * 0.13 + row * 7) + 1) / 2) * 10;
      g.fillStyle = `hsl(${hue}, 48%, ${light}%)`;
      g.fillRect(x + off, y, 126, plankH - 2);
    }
  }
  // grain streaks
  g.globalAlpha = 0.1;
  g.strokeStyle = '#4a2a10';
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * 512;
    g.beginPath();
    g.moveTo(Math.random() * 512, y);
    g.lineTo(Math.random() * 512, y + Math.random() * 6 - 3);
    g.stroke();
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let woodTex = null;

// ---------- materials ----------
const MAT = {};
function materials() {
  if (MAT.wall) return MAT;
  woodTex = makeWoodTexture();
  MAT.wall = new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.85, metalness: 0.15 });
  MAT.panel = new THREE.MeshStandardMaterial({ color: COLORS.panel, roughness: 0.55, metalness: 0.05, emissive: 0x232c30, emissiveIntensity: 0.35 });
  MAT.glass = new THREE.MeshPhysicalMaterial({
    color: COLORS.glass, roughness: 0.08, metalness: 0,
    transmission: 0.9, transparent: true, opacity: 0.28, thickness: 0.3,
    side: THREE.DoubleSide, depthWrite: false,
  });
  MAT.rim = new THREE.MeshStandardMaterial({ color: COLORS.rim, roughness: 0.35, metalness: 0.7, emissive: COLORS.rim, emissiveIntensity: 0.25 });
  MAT.board = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85 });
  MAT.pole = new THREE.MeshStandardMaterial({ color: 0x22252e, roughness: 0.6, metalness: 0.6 });
  MAT.blade = new THREE.MeshStandardMaterial({ color: 0x2c303c, roughness: 0.4, metalness: 0.75, emissive: 0xff3ea5, emissiveIntensity: 0.12 });
  return MAT;
}

function panelFrame(w, h, d) {
  // glowing edge frame for portalable panels
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
  const mat = new THREE.LineBasicMaterial({ color: COLORS.panelEdge, transparent: true, opacity: 0.85 });
  return new THREE.LineSegments(geo, mat);
}

// ---------- net: a tiny verlet cloth the ball really pushes through ----------
const NET_COLS = 12;
const NET_RINGS = [
  { r: HOOP.rimRadius - 0.015, y: 0 },
  { r: HOOP.rimRadius * 0.8, y: -0.15 },
  { r: HOOP.rimRadius * 0.58, y: -0.29 },
  { r: 0.11, y: -0.41 },
];

function buildNet(rimCenter) {
  const particles = [];
  for (let ri = 0; ri < NET_RINGS.length; ri++) {
    const { r, y } = NET_RINGS[ri];
    for (let k = 0; k < NET_COLS; k++) {
      const a = (k / NET_COLS) * Math.PI * 2;
      const p = new THREE.Vector3(
        rimCenter.x + Math.cos(a) * r,
        rimCenter.y + y,
        rimCenter.z + Math.sin(a) * r
      );
      particles.push({ p, prev: p.clone(), pinned: ri === 0 });
    }
  }

  const idx = (ri, k) => ri * NET_COLS + ((k + NET_COLS) % NET_COLS);
  const pairs = [];
  const link = (a, b) => pairs.push([a, b, particles[a].p.distanceTo(particles[b].p)]);
  for (let ri = 0; ri < NET_RINGS.length - 1; ri++) {
    for (let k = 0; k < NET_COLS; k++) {
      link(idx(ri, k), idx(ri + 1, k + 1)); // zigzag diagonals
      link(idx(ri, k), idx(ri + 1, k - 1));
    }
  }
  for (let k = 0; k < NET_COLS; k++) link(idx(NET_RINGS.length - 1, k), idx(NET_RINGS.length - 1, k + 1));

  const positions = new Float32Array(pairs.length * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const line = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color: COLORS.net, transparent: true, opacity: 0.6 })
  );
  line.frustumCulled = false;

  const _d = new THREE.Vector3();
  const net = {
    line,
    update(dt, ballPos, ballR) {
      // verlet integrate
      for (const pt of particles) {
        if (pt.pinned) continue;
        const vx = (pt.p.x - pt.prev.x) * 0.94;
        const vy = (pt.p.y - pt.prev.y) * 0.94;
        const vz = (pt.p.z - pt.prev.z) * 0.94;
        pt.prev.copy(pt.p);
        pt.p.x += vx;
        pt.p.y += vy - 3.5 * dt * dt;
        pt.p.z += vz;
      }
      // ball pushes the cords aside
      if (ballPos) {
        const reach = ballR + 0.025;
        for (const pt of particles) {
          if (pt.pinned) continue;
          _d.copy(pt.p).sub(ballPos);
          const dist = _d.length();
          if (dist < reach && dist > 1e-5) {
            pt.p.addScaledVector(_d.divideScalar(dist), reach - dist);
          }
        }
      }
      // satisfy distance constraints
      for (let iter = 0; iter < 2; iter++) {
        for (const [a, b, rest] of pairs) {
          const pa = particles[a], pb = particles[b];
          _d.copy(pb.p).sub(pa.p);
          const dist = _d.length() || 1e-6;
          const diff = (dist - rest) / dist * 0.5;
          if (pa.pinned && pb.pinned) continue;
          if (pa.pinned) pb.p.addScaledVector(_d, -diff * 2);
          else if (pb.pinned) pa.p.addScaledVector(_d, diff * 2);
          else { pa.p.addScaledVector(_d, diff); pb.p.addScaledVector(_d, -diff); }
        }
      }
      // write to geometry
      const pos = geo.attributes.position;
      for (let i = 0; i < pairs.length; i++) {
        const [a, b] = pairs[i];
        pos.setXYZ(i * 2, particles[a].p.x, particles[a].p.y, particles[a].p.z);
        pos.setXYZ(i * 2 + 1, particles[b].p.x, particles[b].p.y, particles[b].p.z);
      }
      pos.needsUpdate = true;
    },
  };
  net.update(1 / 60, null, 0);
  return net;
}

// ---------- hoop ----------
function buildHoop(def) {
  const m = materials();
  const group = new THREE.Group();
  const [hx, hy, hz] = def.pos;
  const yaw = def.yaw || 0;

  // rim
  const rimGeo = new THREE.TorusGeometry(HOOP.rimRadius, HOOP.rimTube, 12, 40);
  const rim = new THREE.Mesh(rimGeo, m.rim);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0, 0);
  group.add(rim);

  // backboard (behind rim, -Z locally)
  const boardZ = -(HOOP.rimOffset + HOOP.boardT / 2);
  const board = new THREE.Mesh(new THREE.BoxGeometry(HOOP.boardW, HOOP.boardH, HOOP.boardT), m.board);
  board.position.set(0, HOOP.boardH / 2 - 0.15, boardZ);
  group.add(board);

  // shooter square on the board
  const sq = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.5, 0.38)),
    new THREE.LineBasicMaterial({ color: COLORS.rim, transparent: true, opacity: 0.9 })
  );
  sq.position.set(0, 0.22, boardZ + HOOP.boardT / 2 + 0.005);
  group.add(sq);

  // pole down from the board
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, hy + HOOP.boardH / 2 - 0.15, 10), m.pole);
  pole.position.set(0, -(hy) / 2 + (HOOP.boardH / 2 - 0.15) / 2, boardZ - 0.1);
  group.add(pole);

  group.position.set(hx, hy, hz);
  group.rotation.y = yaw;
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const net = buildNet(new THREE.Vector3(hx, hy, hz));

  // colliders in world space (yaw assumed 0 or handled via quat)
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
  const boardCenter = new THREE.Vector3(0, HOOP.boardH / 2 - 0.15, boardZ).applyQuaternion(quat).add(new THREE.Vector3(hx, hy, hz));

  return {
    group,
    net,
    rimCenter: new THREE.Vector3(hx, hy, hz),
    rimRadius: HOOP.rimRadius,
    rimTube: HOOP.rimTube,
    boardCollider: {
      id: 'backboard',
      center: boardCenter,
      half: new THREE.Vector3(HOOP.boardW / 2, HOOP.boardH / 2, HOOP.boardT / 2),
      quat: yaw ? quat : null,
      kind: 'board',
      restitution: 0.58,
    },
  };
}

// ---------- spinners ----------
function buildSpinner(def) {
  const m = materials();
  const group = new THREE.Group();
  const [sx, sy, sz] = def.pos;

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.34, 14), m.pole);
  if (def.axis === 'z') hub.rotation.x = Math.PI / 2;
  group.add(hub);

  const L = def.length;
  let bladeSize;
  if (def.axis === 'z') bladeSize = new THREE.Vector3(0.26, L * 2, 0.16);
  else bladeSize = new THREE.Vector3(L * 2, 0.14, 0.3);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(bladeSize.x, bladeSize.y, bladeSize.z), m.blade);
  blade.castShadow = true;
  group.add(blade);

  // glowing tips
  const tipGeo = new THREE.SphereGeometry(0.09, 10, 10);
  const tipMat = new THREE.MeshBasicMaterial({ color: COLORS.magenta });
  const t1 = new THREE.Mesh(tipGeo, tipMat), t2 = new THREE.Mesh(tipGeo, tipMat);
  if (def.axis === 'z') { t1.position.y = L; t2.position.y = -L; }
  else { t1.position.x = L; t2.position.x = -L; }
  blade.add(t1, t2);

  group.position.set(sx, sy, sz);

  return {
    group,
    blade,
    def,
    angle: def.phase || 0,
    collider: {
      id: `spinner-${sx}-${sy}-${sz}`,
      center: new THREE.Vector3(sx, sy, sz),
      half: bladeSize.clone().multiplyScalar(0.5),
      quat: new THREE.Quaternion(),
      kind: 'spinner',
      restitution: 0.8,
      angularVel: new THREE.Vector3(), // set each frame
    },
  };
}

// ---------- level assembly ----------
export function buildLevel(level) {
  const m = materials();
  const group = new THREE.Group();
  const colliders = [];
  const portalMeshes = [];

  // floor
  const f = level.floor;
  const fw = f.w, fd = f.zMax - f.zMin, fcz = (f.zMin + f.zMax) / 2;
  const floorMat = new THREE.MeshStandardMaterial({ map: woodTex || makeWoodTexture(), roughness: 0.65, metalness: 0.05 });
  floorMat.map.repeat.set(fw / 6, fd / 6);
  floorMat.map.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.4, fd), floorMat);
  floor.position.set(0, -0.2, fcz);
  floor.receiveShadow = true;
  group.add(floor);
  colliders.push({
    id: 'floor',
    center: new THREE.Vector3(0, -0.2, fcz),
    half: new THREE.Vector3(fw / 2, 0.2, fd / 2),
    quat: null, kind: 'floor', restitution: 0.62,
  });

  // court lines painted as thin emissive strips
  const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.line, transparent: true, opacity: 0.32 });
  const midLine = new THREE.Mesh(new THREE.PlaneGeometry(fw - 1, 0.09), lineMat);
  midLine.rotation.x = -Math.PI / 2;
  midLine.position.set(0, 0.005, fcz);
  group.add(midLine);
  const circle = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.6, 48), lineMat);
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(0, 0.005, fcz);
  group.add(circle);
  const border = new THREE.Mesh(new THREE.RingGeometry(0, 1, 4), lineMat); // unused placeholder shape
  border.visible = false;
  group.add(border);

  // boxes
  let boxId = 0;
  for (const b of level.boxes) {
    const [px, py, pz] = b.pos;
    const [sx, sy, sz] = b.size;
    const mat = b.kind === 'panel' ? m.panel : b.kind === 'glass' ? m.glass : m.wall;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(px, py, pz);
    mesh.castShadow = b.kind !== 'glass';
    mesh.receiveShadow = true;
    group.add(mesh);

    if (b.kind === 'glass') {
      // faint edges so glass barriers read as solid objects
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, sy, sz)),
        new THREE.LineBasicMaterial({ color: 0xa8e4ef, transparent: true, opacity: 0.22 })
      );
      edges.position.copy(mesh.position);
      group.add(edges);
    }

    if (b.kind === 'panel') {
      const frame = panelFrame(sx + 0.02, sy + 0.02, sz + 0.02);
      frame.position.copy(mesh.position);
      group.add(frame);
      mesh.userData.portalable = true;
      portalMeshes.push(mesh);

      // suspended rigs hang from thin cables
      if (b.rig) {
        const cableMat = new THREE.LineBasicMaterial({ color: 0x39404f, transparent: true, opacity: 0.8 });
        for (const dx of [-sx / 2 + 0.15, sx / 2 - 0.15]) {
          const pts = [new THREE.Vector3(px + dx, py + sy / 2, pz), new THREE.Vector3(px + dx, py + 6, pz)];
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
        }
      }
    }

    const collider = {
      id: `box-${boxId++}`,
      center: new THREE.Vector3(px, py, pz),
      half: new THREE.Vector3(sx / 2, sy / 2, sz / 2),
      quat: null,
      kind: b.kind,
      restitution: b.kind === 'glass' ? 0.7 : 0.55,
      mesh,
    };
    mesh.userData.colliderId = collider.id;
    colliders.push(collider);
  }

  // hoop
  const hoop = buildHoop(level.hoop);
  group.add(hoop.group, hoop.net.line);
  colliders.push(hoop.boardCollider);

  // spinners
  const spinners = (level.spinners || []).map((s) => {
    const sp = buildSpinner(s);
    group.add(sp.group);
    colliders.push(sp.collider);
    return sp;
  });

  return { group, colliders, portalMeshes, hoop, spinners };
}

export function updateSpinners(spinners, t) {
  const axisVec = new THREE.Vector3();
  for (const sp of spinners) {
    const { def } = sp;
    const angle = (def.phase || 0) + t * def.speed;
    if (def.axis === 'z') {
      sp.blade.rotation.z = angle;
      sp.collider.quat.setFromEuler(new THREE.Euler(0, 0, angle));
      axisVec.set(0, 0, 1);
    } else {
      sp.blade.rotation.y = angle;
      sp.collider.quat.setFromEuler(new THREE.Euler(0, angle, 0));
      axisVec.set(0, 1, 0);
    }
    sp.collider.angularVel.copy(axisVec).multiplyScalar(def.speed);
  }
}
