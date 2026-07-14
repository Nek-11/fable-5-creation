// ============================================================
// fx.js — atmosphere & feedback: fireflies, dust motes,
// condensation, placement puffs, falling droplets, ghost marker.
// ============================================================
import * as THREE from 'three';
import { CFG } from './config.js';
import { groundHeight, isInPond } from './terrain.js';
import { clamp, noise1, rand } from './noise.js';

const TOOL_COLORS = {
  seed: 0x9fd6a3,
  beetle: 0xc9a06a,
  mantis: 0xa8d68a,
  spore: 0x7fe8c9,
  droplet: 0x9ed4e8,
};

// soft round point sprite shader
function makePointsMaterial(color, baseSize, blending = THREE.AdditiveBlending) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uScale: { value: 800 },
      uOpacity: { value: 1 },
      uSize: { value: baseSize },
    },
    transparent: true,
    depthWrite: false,
    blending,
    vertexShader: /* glsl */`
      attribute float alpha;
      varying float vA;
      uniform float uScale, uSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * (uScale / max(-mv.z, 0.1));
        vA = alpha;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.06, d) * vA * uOpacity;
        if (a < 0.003) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
}

function makeCloud(count, color, size, blending) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(count), 1));
  const mat = makePointsMaterial(color, size, blending);
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ============================================================
export class FX {
  constructor(scene) {
    this.scene = scene;

    // ---------- fireflies ----------
    const FN = CFG.caps.fireflies;
    this.fireflies = makeCloud(FN, 0xd8f0a0, 9);
    this.fireflies.renderOrder = 5;
    scene.add(this.fireflies);
    this.flies = [];
    for (let i = 0; i < FN; i++) {
      this.flies.push({
        x: rand(-1.4, 1.4), y: rand(1.4, 3.2), z: rand(-1.4, 1.4),
        seed: rand(0, 100), phase: rand(0, Math.PI * 2), on: 0,
      });
    }
    this.fireflyTarget = 0;

    // ---------- dust motes in the light shaft ----------
    const MN = 110;
    this.motes = makeCloud(MN, 0xfff2dd, 3.2, THREE.NormalBlending);
    this.motes.renderOrder = 4;
    scene.add(this.motes);
    this.moteData = [];
    const mpos = this.motes.geometry.attributes.position;
    const malpha = this.motes.geometry.attributes.alpha;
    for (let i = 0; i < MN; i++) {
      const m = { x: rand(-7.5, 1.5), y: rand(0.4, 5.4), z: rand(-3.5, 1.5), seed: rand(0, 100) };
      this.moteData.push(m);
      mpos.setXYZ(i, m.x, m.y, m.z);
      malpha.setX(i, rand(0.15, 0.5));
    }
    mpos.needsUpdate = true;
    malpha.needsUpdate = true;

    // ---------- condensation on the glass shoulder ----------
    const CN = 52;
    this.condensation = makeCloud(CN, 0xcfe8f0, 2.6, THREE.NormalBlending);
    this.condensation.renderOrder = 6;
    scene.add(this.condensation);
    const cpos = this.condensation.geometry.attributes.position;
    const calpha = this.condensation.geometry.attributes.alpha;
    for (let i = 0; i < CN; i++) {
      const a = rand(0, Math.PI * 2);
      const y = rand(2.7, 3.9);
      const shrink = y > 3.2 ? (y - 3.2) / 1.3 * 0.55 : 0; // follow the shoulder curve
      const r = CFG.jar.glassRadius - 0.1 - shrink;
      cpos.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
      calpha.setX(i, rand(0.25, 0.8));
    }
    cpos.needsUpdate = true;
    calpha.needsUpdate = true;

    // ---------- placement puffs (pooled) ----------
    this.PUFF_MAX = 8;
    this.PUFF_N = 14;
    this.puffs = makeCloud(this.PUFF_MAX * this.PUFF_N, 0xffffff, 6);
    this.puffs.renderOrder = 7;
    scene.add(this.puffs);
    this.puffPool = [];
    for (let i = 0; i < this.PUFF_MAX; i++) {
      this.puffPool.push({ t: 99, color: new THREE.Color(), parts: [] });
    }
    this.puffs.material.uniforms.uColor.value.set(0xffffff);
    // per-puff colors aren't possible in one cloud; tint via alpha only, keep white-warm
    this.puffs.material.uniforms.uColor.value.set(0xf5ecd0);

    // ---------- droplets & ripples ----------
    this.droplets = [];
    this.ripples = [];
    this.dropGeo = new THREE.SphereGeometry(0.055, 10, 8);
    this.dropMat = new THREE.MeshPhysicalMaterial({
      color: '#bfe8f5', roughness: 0.05, transmission: 0.9, ior: 1.33, thickness: 0.1,
    });
    this.rippleGeo = new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2);
    this.rippleMat = new THREE.MeshBasicMaterial({
      color: '#bfe8f5', transparent: true, opacity: 0.6, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });

    // ---------- ghost placement marker ----------
    this.ghost = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.13, 0.17, 32).rotateX(-Math.PI / 2);
    this.ghostRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0x9fd6a3, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    const dotGeo = new THREE.CircleGeometry(0.045, 16).rotateX(-Math.PI / 2);
    this.ghostDot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({
      color: 0x9fd6a3, transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.ghost.add(this.ghostRing, this.ghostDot);
    this.ghost.visible = false;
    this.ghost.renderOrder = 8;
    scene.add(this.ghost);
  }

  setSize(w, h, pixelRatio) {
    const scale = h * pixelRatio * 0.5;
    for (const obj of [this.fireflies, this.motes, this.condensation, this.puffs]) {
      obj.material.uniforms.uScale.value = scale;
    }
  }

  // ---------------- ghost ----------------
  showGhost(tool) {
    const c = TOOL_COLORS[tool] ?? 0xffffff;
    this.ghostRing.material.color.set(c);
    this.ghostDot.material.color.set(c);
    this.ghost.visible = true;
  }

  moveGhost(point, valid) {
    this.ghost.position.copy(point);
    this.ghost.position.y += 0.03;
    this.ghost.visible = valid;
  }

  hideGhost() { this.ghost.visible = false; }

  // ---------------- puffs ----------------
  puff(x, y, z, toolOrColor = 0xf5ecd0) {
    let slot = this.puffPool.find((p) => p.t > 1);
    if (!slot) slot = this.puffPool[0];
    slot.t = 0;
    slot.parts = [];
    for (let i = 0; i < this.PUFF_N; i++) {
      const a = rand(0, Math.PI * 2);
      const up = rand(0.3, 1.4);
      const sp = rand(0.3, 0.9);
      slot.parts.push({
        x, y: y + 0.05, z,
        vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp,
      });
    }
  }

  // ---------------- droplet ----------------
  spawnDroplet(x, z, onLand) {
    const mesh = new THREE.Mesh(this.dropGeo, this.dropMat);
    const targetY = isInPond(x, z) ? CFG.pond.waterY : groundHeight(x, z);
    mesh.position.set(x, 4.1, z);
    this.scene.add(mesh);
    this.droplets.push({ mesh, x, z, targetY, vy: 0, onLand });
  }

  _spawnRipple(x, y, z) {
    const mesh = new THREE.Mesh(this.rippleGeo, this.rippleMat.clone());
    mesh.position.set(x, y + 0.02, z);
    mesh.scale.setScalar(0.08);
    this.scene.add(mesh);
    this.ripples.push({ mesh, t: 0 });
  }

  setFireflyTarget(n) {
    this.fireflyTarget = clamp(n | 0, 0, CFG.caps.fireflies);
  }

  // ---------------- per-frame ----------------
  update(dt, time, dayFactor, nightFactor) {
    // fireflies
    const fpos = this.fireflies.geometry.attributes.position;
    const falpha = this.fireflies.geometry.attributes.alpha;
    for (let i = 0; i < this.flies.length; i++) {
      const f = this.flies[i];
      const want = i < this.fireflyTarget ? 1 : 0;
      f.on += (want - f.on) * clamp(dt * 0.8, 0, 1);
      if (f.on > 0.01) {
        f.x += noise1(time * 0.25 + f.seed, 1) * 0.45 * dt;
        f.z += noise1(time * 0.25 + f.seed, 2) * 0.45 * dt;
        f.y += noise1(time * 0.3 + f.seed, 3) * 0.3 * dt;
        const r = Math.hypot(f.x, f.z);
        if (r > 1.62) { f.x *= 0.995; f.z *= 0.995; }
        const gy = groundHeight(f.x, f.z);
        f.y = clamp(f.y, gy + 0.25, 3.35);
        fpos.setXYZ(i, f.x, f.y, f.z);
      }
      const pulse = 0.45 + 0.55 * Math.max(Math.sin(time * 2.6 + f.phase), 0);
      falpha.setX(i, f.on * pulse);
    }
    fpos.needsUpdate = true;
    falpha.needsUpdate = true;
    this.fireflies.material.uniforms.uOpacity.value = nightFactor;

    // motes — drift slowly through the shaft, visible by day
    const mpos = this.motes.geometry.attributes.position;
    for (let i = 0; i < this.moteData.length; i++) {
      const m = this.moteData[i];
      m.x += (noise1(time * 0.1 + m.seed, 4) * 0.1 + 0.03) * dt;
      m.y += noise1(time * 0.12 + m.seed, 5) * 0.06 * dt - 0.01 * dt;
      m.z += noise1(time * 0.1 + m.seed, 6) * 0.08 * dt;
      if (m.x > 2) m.x = -8;
      if (m.y < 0.2) m.y = 5.4;
      mpos.setXYZ(i, m.x, m.y, m.z);
    }
    mpos.needsUpdate = true;
    this.motes.material.uniforms.uOpacity.value = dayFactor * 0.4;

    // condensation appears on cool nights
    this.condensation.material.uniforms.uOpacity.value = nightFactor * 0.45;

    // puffs
    const ppos = this.puffs.geometry.attributes.position;
    const palpha = this.puffs.geometry.attributes.alpha;
    for (let s = 0; s < this.puffPool.length; s++) {
      const puff = this.puffPool[s];
      puff.t += dt;
      const life = clamp(1 - puff.t / 0.9, 0, 1);
      for (let i = 0; i < this.PUFF_N; i++) {
        const gi = s * this.PUFF_N + i;
        if (life <= 0 || !puff.parts[i]) {
          palpha.setX(gi, 0);
          continue;
        }
        const p = puff.parts[i];
        p.vy -= 1.6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        ppos.setXYZ(gi, p.x, p.y, p.z);
        palpha.setX(gi, life * 0.85);
      }
    }
    ppos.needsUpdate = true;
    palpha.needsUpdate = true;

    // droplets
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.vy -= 9.5 * dt;
      d.mesh.position.y += d.vy * dt;
      if (d.mesh.position.y <= d.targetY + 0.03) {
        this._spawnRipple(d.x, d.targetY, d.z);
        this.puff(d.x, d.targetY, d.z);
        if (d.onLand) d.onLand();
        d.mesh.removeFromParent();
        this.droplets.splice(i, 1);
      }
    }

    // ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.t += dt;
      const k = r.t / 1.1;
      if (k >= 1) {
        r.mesh.material.dispose();
        r.mesh.removeFromParent();
        this.ripples.splice(i, 1);
        continue;
      }
      r.mesh.scale.setScalar(0.08 + k * 0.55);
      r.mesh.material.opacity = 0.55 * (1 - k);
    }

    // ghost breathing
    if (this.ghost.visible) {
      const s = 1 + Math.sin(time * 4) * 0.08;
      this.ghost.scale.setScalar(s);
    }
  }

  reset() {
    for (const d of this.droplets) d.mesh.removeFromParent();
    this.droplets = [];
    for (const r of this.ripples) { r.mesh.material.dispose(); r.mesh.removeFromParent(); }
    this.ripples = [];
    for (const p of this.puffPool) { p.t = 99; p.parts = []; }
    this.setFireflyTarget(0);
    for (const f of this.flies) f.on = 0;
  }
}

export { TOOL_COLORS };
