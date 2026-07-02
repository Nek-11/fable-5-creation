import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';
import { SimplexNoise } from './noise.js';

// The planet owns the terrain AND the territory field — a per-vertex scalar in
// [-1, 1] where +1 is thriving light-flora ground and -1 is void rot. The field
// evolves as a reaction-diffusion war: sources (flora / rot cores) inject,
// diffusion creeps the fronts outward, decay keeps unsourced territory neutral.

const P = CONFIG.planet;
const F = CONFIG.field;

export class Planet {
  constructor(scene) {
    this.noise = new SimplexNoise(20260702);
    this.buildGeometry();
    this.buildAdjacency();
    this.buildMaterial();

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    scene.add(this.mesh);

    this.vertCount = this.geometry.attributes.position.count;
    this.field = new Float32Array(this.vertCount);
    this.fieldNext = new Float32Array(this.vertCount);
    this.injection = new Float32Array(this.vertCount); // /s rates, rebuilt when sources change
    this.fieldAttr = new THREE.BufferAttribute(new Float32Array(this.vertCount), 1);
    this.fieldAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('field', this.fieldAttr);

    // unit directions per vertex, cached for fast dot-product range queries
    this.dirs = new Float32Array(this.vertCount * 3);
    const pos = this.geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < this.vertCount; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      this.dirs[i * 3] = v.x;
      this.dirs[i * 3 + 1] = v.y;
      this.dirs[i * 3 + 2] = v.z;
    }

    this.accum = 0;
    this.litCount = 0;
    this.rotCount = 0;
  }

  terrainHeight(dir) {
    // dir: unit Vector3 → offset above base radius
    const f = P.terrainFreq * P.radius;
    return P.terrainAmp * this.noise.fbm3(dir.x * f, dir.y * f, dir.z * f, 4);
  }

  surfaceRadius(dir) {
    return P.radius + this.terrainHeight(dir);
  }

  buildGeometry() {
    let geo = new THREE.IcosahedronGeometry(P.radius, P.detail);
    geo.deleteAttribute('uv');
    geo.deleteAttribute('normal');
    geo = mergeVertices(geo, 1e-4);

    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const r = P.radius + this.terrainHeight(v);
      pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    }
    geo.computeVertexNormals();
    this.geometry = geo;
  }

  buildAdjacency() {
    const index = this.geometry.index.array;
    const count = this.geometry.attributes.position.count;
    const sets = Array.from({ length: count }, () => new Set());
    for (let t = 0; t < index.length; t += 3) {
      const a = index[t], b = index[t + 1], c = index[t + 2];
      sets[a].add(b).add(c);
      sets[b].add(a).add(c);
      sets[c].add(a).add(b);
    }
    // flat CSR-style adjacency for tight loops
    this.adjStart = new Uint32Array(count + 1);
    let total = 0;
    for (let i = 0; i < count; i++) { total += sets[i].size; this.adjStart[i + 1] = total; }
    this.adj = new Uint32Array(total);
    for (let i = 0, w = 0; i < count; i++) for (const n of sets[i]) this.adj[w++] = n;
  }

  buildMaterial() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0.62, 0.45, 0.55).normalize() },
      },
      vertexShader: /* glsl */ `
        attribute float field;
        varying float vField;
        varying vec3 vNormal;
        varying vec3 vPos;

        void main() {
          vField = field;
          vNormal = normalize(normalMatrix * normal);
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        varying float vField;
        varying vec3 vNormal;
        varying vec3 vPos;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float vnoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z);
        }
        float fbm(vec3 p) {
          return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.13) + 0.15 * vnoise(p * 4.7);
        }

        void main() {
          vec3 sun = normalize(uSunDir);
          // wrap lighting: soft terminator, never pitch black
          float ndl = dot(vNormal, sun) * 0.5 + 0.5;
          float light = 0.10 + 0.9 * ndl * ndl;

          float rock = fbm(vPos * 0.42);
          float mottle = fbm(vPos * 1.35 + 31.7);

          // --- neutral stone: dusky violet-slate ---
          vec3 albedo = mix(vec3(0.062, 0.052, 0.095), vec3(0.115, 0.098, 0.155), rock);
          albedo = mix(albedo, vec3(0.15, 0.12, 0.15), smoothstep(0.55, 0.85, mottle) * 0.5);

          vec3 emissive = vec3(0.0);

          // --- living light territory ---
          float lit = smoothstep(0.12, 0.8, vField);
          if (lit > 0.001) {
            vec3 moss = mix(vec3(0.035, 0.19, 0.135), vec3(0.06, 0.30, 0.20), mottle);
            albedo = mix(albedo, moss, lit);
            // bioluminescent freckles that shimmer
            float freckle = smoothstep(0.74, 0.97, vnoise(vPos * 4.6 + 7.0));
            float shimmer = 0.65 + 0.35 * sin(uTime * 1.7 + rock * 21.0);
            emissive += vec3(0.30, 1.0, 0.72) * lit * (0.06 + 0.75 * freckle * shimmer);
            emissive += vec3(0.04, 0.26, 0.20) * lit * 0.16; // ambient bed glow
          }

          // --- void rot territory ---
          float rot = smoothstep(0.03, 0.8, -vField);
          if (rot > 0.001) {
            vec3 char = mix(vec3(0.045, 0.015, 0.05), vec3(0.10, 0.02, 0.06), rock);
            albedo = mix(albedo, char, rot);
            // pulsing magma veins
            float vein = 1.0 - abs(vnoise(vPos * 1.9 + 99.0) * 2.0 - 1.0);
            vein = smoothstep(0.90, 0.995, vein);
            float pulse = 0.6 + 0.4 * sin(uTime * 2.3 + mottle * 17.0);
            emissive += vec3(1.0, 0.12, 0.18) * rot * vein * pulse * 0.55;
            emissive += vec3(0.16, 0.0, 0.035) * rot * 0.16;
          }

          // battle frontier: thin white-hot seam where the two fields collide
          float frontier = smoothstep(0.22, 0.0, abs(vField)) * max(lit, rot);

          vec3 col = albedo * light + emissive;
          col += vec3(0.85, 1.0, 0.9) * frontier * 0.10 * (0.5 + 0.5 * sin(uTime * 3.1 + rock * 40.0));

          // faint rim of atmosphere
          float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(cameraPosition - vPos))), 3.0);
          col += vec3(0.10, 0.24, 0.28) * rim * 0.55;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  // ---- source management -------------------------------------------------
  // Sources register vertex lists; injection rates are accumulated into a
  // flat array so the CA tick stays a single tight loop.

  vertsWithin(dir, radius) {
    // radius in world-arc units → angular threshold via dot product
    const cosT = Math.cos(radius / P.radius);
    const out = [];
    const d = this.dirs;
    for (let i = 0; i < this.vertCount; i++) {
      const dot = dir.x * d[i * 3] + dir.y * d[i * 3 + 1] + dir.z * d[i * 3 + 2];
      if (dot > cosT) {
        // smooth falloff toward the edge of the disc
        const t = (dot - cosT) / (1 - cosT);
        out.push(i, Math.min(1, t * 1.8));
      }
    }
    return out; // interleaved [index, weight, ...]
  }

  rebuildInjection(sources) {
    // sources: [{ list: interleaved verts, rate: +/-  per second }]
    this.injection.fill(0);
    for (const s of sources) {
      const list = s.list;
      for (let k = 0; k < list.length; k += 2) {
        this.injection[list[k]] += s.rate * list[k + 1];
      }
    }
  }

  fieldAt(dir) {
    // nearest-vertex sample (events only — full scan is fine at ~6k verts)
    let best = -2, bi = 0;
    const d = this.dirs;
    for (let i = 0; i < this.vertCount; i++) {
      const dot = dir.x * d[i * 3] + dir.y * d[i * 3 + 1] + dir.z * d[i * 3 + 2];
      if (dot > best) { best = dot; bi = i; }
    }
    return this.field[bi];
  }

  splash(dir, radius, amount) {
    // instant field push (light bursts, landings)
    const list = this.vertsWithin(dir, radius);
    for (let k = 0; k < list.length; k += 2) {
      const i = list[k];
      this.field[i] = Math.max(-1, Math.min(1, this.field[i] + amount * list[k + 1]));
    }
  }

  // ---- simulation ---------------------------------------------------------

  update(dt, time) {
    this.material.uniforms.uTime.value = time;
    this.accum += dt;
    let stepped = false;
    while (this.accum >= F.tick) {
      this.accum -= F.tick;
      this.step(F.tick);
      stepped = true;
    }
    if (stepped) {
      this.fieldAttr.array.set(this.field);
      this.fieldAttr.needsUpdate = true;
    }
  }

  step(h) {
    const { field, fieldNext, adj, adjStart, injection } = this;
    const D = F.diffusion, G = F.growth, K = F.decay;
    let lit = 0, rot = 0;
    for (let i = 0; i < this.vertCount; i++) {
      const f = field[i];
      let sum = 0;
      const s = adjStart[i], e = adjStart[i + 1];
      for (let k = s; k < e; k++) sum += field[adj[k]];
      const lap = sum / (e - s) - f;
      const af = f < 0 ? -f : f;
      let nf = f + h * (D * lap + G * f * (1 - af) - K * f + injection[i]);
      if (nf > 1) nf = 1; else if (nf < -1) nf = -1;
      fieldNext[i] = nf;
      if (nf > F.litThreshold) lit++;
      else if (nf < F.rotThreshold) rot++;
    }
    this.field = fieldNext;
    this.fieldNext = field;
    this.litCount = lit;
    this.rotCount = rot;
  }

  get litFraction() { return this.litCount / this.vertCount; }
  get rotFraction() { return this.rotCount / this.vertCount; }

  reset() {
    this.field.fill(0);
    this.fieldNext.fill(0);
    this.injection.fill(0);
    this.fieldAttr.array.fill(0);
    this.fieldAttr.needsUpdate = true;
    this.litCount = 0;
    this.rotCount = 0;
  }
}
