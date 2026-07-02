import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const MAX_SPARKLES = 900;

const AtmosShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      // vignette
      vec2 d = vUv - 0.5;
      float vig = 1.0 - smoothstep(0.42, 0.95, length(d) * 1.25);
      col.rgb *= mix(0.72, 1.0, vig);
      // subtle living grain
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 43.0) - 0.5;
      col.rgb += g * 0.028;
      gl_FragColor = col;
    }
  `,
};

function softDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Effects {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.buildSky(scene);
    this.buildSparkles(scene);
    this.buildBursts(scene);
    this.buildComposer(scene, camera, renderer);
  }

  buildSky(scene) {
    // starfield
    const N = 2200;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const tints = [
      new THREE.Color('#ffffff'), new THREE.Color('#cfeaff'),
      new THREE.Color('#b9ffe4'), new THREE.Color('#ffd9f0'), new THREE.Color('#fff3c9'),
    ];
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize()
        .multiplyScalar(260 + Math.random() * 160);
      pos.set([v.x, v.y, v.z], i * 3);
      const t = tints[Math.floor(Math.random() * tints.length)];
      const b = 0.35 + Math.random() * 0.65;
      col.set([t.r * b, t.g * b, t.b * b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: true, vertexColors: true,
      map: softDotTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    scene.add(this.stars);

    // nebula dome — a vast gradient shell behind everything
    const nebGeo = new THREE.SphereGeometry(520, 32, 24);
    const nebMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform float uTime;
        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1); p *= 17.0;
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
        void main() {
          vec3 d = vDir;
          float w1 = vnoise(d * 2.4 + vec3(0.0, uTime * 0.008, 0.0));
          float w2 = vnoise(d * 5.2 + 13.0);
          vec3 col = vec3(0.012, 0.016, 0.035);
          col += vec3(0.02, 0.10, 0.11) * smoothstep(0.55, 0.95, w1) * 0.55;
          col += vec3(0.10, 0.03, 0.13) * smoothstep(0.6, 0.95, w2) * 0.35;
          col += vec3(0.05, 0.02, 0.10) * pow(max(0.0, d.y), 2.0) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.nebula = new THREE.Mesh(nebGeo, nebMat);
    scene.add(this.nebula);

    // distant sun glow sprite (matches the shader sun direction)
    const sunDir = new THREE.Vector3(0.62, 0.45, 0.55).normalize();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDotTexture(), color: '#fff2d5', transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.9,
    }));
    sprite.position.copy(sunDir).multiplyScalar(430);
    sprite.scale.setScalar(120);
    scene.add(sprite);

    // lights that agree with the planet shader
    const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
    sun.position.copy(sunDir).multiplyScalar(100);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight('#3b5f66', '#1a1030', 0.85));
  }

  buildSparkles(scene) {
    this.sparkles = [];
    this.sparkPos = new Float32Array(MAX_SPARKLES * 3);
    this.sparkCol = new Float32Array(MAX_SPARKLES * 3);
    const geo = new THREE.BufferGeometry();
    this.sparkPosAttr = new THREE.BufferAttribute(this.sparkPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.sparkColAttr = new THREE.BufferAttribute(this.sparkCol, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.sparkPosAttr);
    geo.setAttribute('color', this.sparkColAttr);
    const mat = new THREE.PointsMaterial({
      size: 0.42, sizeAttenuation: true, vertexColors: true,
      map: softDotTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.sparkPoints = new THREE.Points(geo, mat);
    this.sparkPoints.frustumCulled = false;
    scene.add(this.sparkPoints);
  }

  sparkle(pos, color, life = 0.6, speed = 1.2, brightness = 1) {
    if (this.sparkles.length >= MAX_SPARKLES) return;
    this.sparkles.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: (Math.random() - 0.5) * speed * 2,
      vy: (Math.random() - 0.5) * speed * 2,
      vz: (Math.random() - 0.5) * speed * 2,
      life, maxLife: life,
      r: color.r * brightness, g: color.g * brightness, b: color.b * brightness,
    });
  }

  sparkleBurst(pos, color, count = 14, speed = 2.4, life = 0.8, brightness = 1.4) {
    for (let i = 0; i < count; i++) {
      this.sparkle(pos, color, life * (0.5 + Math.random() * 0.7), speed, brightness);
    }
  }

  buildBursts(scene) {
    this.bursts = [];
    this.burstGeo = new THREE.SphereGeometry(1, 40, 28);
    this.burstMatProto = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uT: { value: 0 },
        uColor: { value: new THREE.Color('#7dffd0') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vN = normalize(normalMatrix * normal);
          vW = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uT;
        uniform vec3 uColor;
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vec3 vd = normalize(cameraPosition - vW);
          float fres = pow(1.0 - abs(dot(vd, normalize(vN))), 2.0);
          float fade = (1.0 - uT);
          gl_FragColor = vec4(uColor, (0.05 + fres * 0.5) * fade * fade);
        }
      `,
    });
  }

  spawnBurst(pos, radius, color = '#7dffd0') {
    const mat = this.burstMatProto.clone();
    mat.uniforms.uColor.value = new THREE.Color(color);
    const mesh = new THREE.Mesh(this.burstGeo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.01);
    this.scene.add(mesh);
    this.bursts.push({ mesh, t: 0, radius });
  }

  buildComposer(scene, camera, renderer) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.72, 0.5, 0.72,
    );
    this.composer.addPass(this.bloom);
    this.atmos = new ShaderPass(AtmosShader);
    this.composer.addPass(this.atmos);
    this.composer.addPass(new OutputPass());
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
  }

  update(dt, time) {
    this.nebula.material.uniforms.uTime.value = time;
    this.atmos.uniforms.uTime.value = time;
    this.stars.rotation.y += dt * 0.004;

    // sparkles
    const list = this.sparkles;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.life -= dt;
      if (s.life <= 0) { list.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    }
    for (let i = 0; i < MAX_SPARKLES; i++) {
      if (i < list.length) {
        const s = list[i];
        const a = s.life / s.maxLife;
        this.sparkPos[i * 3] = s.x; this.sparkPos[i * 3 + 1] = s.y; this.sparkPos[i * 3 + 2] = s.z;
        this.sparkCol[i * 3] = s.r * a; this.sparkCol[i * 3 + 1] = s.g * a; this.sparkCol[i * 3 + 2] = s.b * a;
      } else {
        this.sparkCol[i * 3] = 0; this.sparkCol[i * 3 + 1] = 0; this.sparkCol[i * 3 + 2] = 0;
      }
    }
    this.sparkPosAttr.needsUpdate = true;
    this.sparkColAttr.needsUpdate = true;

    // burst shells
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt / 0.85;
      if (b.t >= 1) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const e = 1 - Math.pow(1 - b.t, 3);
      b.mesh.scale.setScalar(0.01 + e * b.radius);
      b.mesh.material.uniforms.uT.value = b.t;
    }
  }

  render() {
    this.composer.render();
  }
}
