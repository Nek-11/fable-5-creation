// ============================================================
// scene.js — renderer, camera, jar, desk, room, lights,
// day/night cycle and postprocessing. The beauty budget.
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CFG } from './config.js';
import { groundHeight } from './terrain.js';
import { fbm2, lerp, clamp, smoothstep, rand } from './noise.js';

const { jar, pond, render } = CFG;

// ---------------- canvas texture helper ----------------
function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

// ---------------- day / night keyframes ----------------
// p: phase [0..1). el/az in degrees. night in [0..1].
const DAY_KEYS = [
  { p: 0.00, el: 6,  az: -70, sun: '#ffb27a', int: 1.0, hemi: 0.45, sky: '#ffd9c0', grd: '#6b5b48', bgT: '#3a4152', bgM: '#6b5a4a', bgB: '#241f1a', win: '#ffcf9e', winOp: 0.5,  night: 0.25 },
  { p: 0.10, el: 35, az: -42, sun: '#ffe6c4', int: 2.4, hemi: 0.62, sky: '#dfe8ff', grd: '#8a7a60', bgT: '#7d8ba0', bgM: '#a08a6e', bgB: '#3a3028', win: '#fff3d9', winOp: 0.95, night: 0.0 },
  { p: 0.28, el: 58, az: 5,   sun: '#fff4e2', int: 2.8, hemi: 0.72, sky: '#eaf2ff', grd: '#9a8868', bgT: '#8798ad', bgM: '#ab9377', bgB: '#423628', win: '#fff8ea', winOp: 1.0,  night: 0.0 },
  { p: 0.44, el: 22, az: 46,  sun: '#ffb46e', int: 2.0, hemi: 0.5,  sky: '#ffd9ad', grd: '#7d6a52', bgT: '#66607a', bgM: '#a37651', bgB: '#33291f', win: '#ffc98a', winOp: 0.8,  night: 0.05 },
  { p: 0.52, el: 7,  az: 62,  sun: '#ff8f56', int: 0.9, hemi: 0.35, sky: '#c9a3b8', grd: '#5a4a42', bgT: '#45415e', bgM: '#7a5545', bgB: '#262019', win: '#ff9e6b', winOp: 0.45, night: 0.45 },
  { p: 0.60, el: 30, az: -32, sun: '#8fa8e8', int: 0.38, hemi: 0.22, sky: '#6b7ba8', grd: '#3a3a44', bgT: '#1c2233', bgM: '#2c3040', bgB: '#14131a', win: '#9db4e8', winOp: 0.18, night: 1.0 },
  { p: 0.80, el: 48, az: 8,   sun: '#7c97e0', int: 0.42, hemi: 0.2,  sky: '#5f6f9e', grd: '#34343e', bgT: '#171c2c', bgM: '#262a3a', bgB: '#111018', win: '#8ea6dd', winOp: 0.15, night: 1.0 },
  { p: 0.93, el: 16, az: 42,  sun: '#90a4d8', int: 0.32, hemi: 0.24, sky: '#7a86ad', grd: '#42403f', bgT: '#1d2331', bgM: '#3a3648', bgB: '#17141a', win: '#a8b4d8', winOp: 0.2,  night: 0.85 },
];

const _ca = new THREE.Color(), _cb = new THREE.Color();
function lerpKeyColor(field, a, b, t, out) {
  _ca.set(a[field]); _cb.set(b[field]);
  out.copy(_ca).lerp(_cb, t);
  return out;
}
function sampleDay(phase) {
  const keys = DAY_KEYS;
  let a = keys[keys.length - 1], b = keys[0], span, t;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], n = keys[(i + 1) % keys.length];
    const end = n.p > k.p ? n.p : 1;
    if (phase >= k.p && phase < end) { a = k; b = n; break; }
  }
  span = (b.p > a.p ? b.p : 1) - a.p;
  t = smoothstep(0, 1, clamp((phase - a.p) / span, 0, 1));
  return { a, b, t };
}

// ---------------- vignette shader ----------------
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.55 },
    softness: { value: 0.62 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float softness;
    varying vec2 vUv;
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - smoothstep(softness, 1.25, length(d) * 1.9) * strength;
      // very gentle warm lift at center
      col.rgb *= v;
      gl_FragColor = col;
    }`,
};

// ============================================================
export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, render.maxPixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = render.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 220);
    this.camera.position.set(5.4, 3.8, 7.6);

    // --- environment reflections (crucial for the glass) ---
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environmentIntensity = 0.42;
    pmrem.dispose();

    // --- controls ---
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 2.05, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.4;
    this.controls.maxDistance = 13;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.42;
    this.controls.autoRotateSpeed = 0.35;
    this._idleTime = 0;
    this.controls.addEventListener('start', () => { this._idleTime = 0; });

    this.nightFactor = 0;
    this.dayFactor = 1;

    this._buildRoom();
    this._buildDesk();
    this._buildJar();
    this._buildSubstrate();
    this._buildPond();
    this._buildDecor();
    this._buildLights();
    this._buildPost();

    window.addEventListener('resize', () => this.setSize(window.innerWidth, window.innerHeight));
  }

  // ---------------- room backdrop ----------------
  _buildRoom() {
    this.bgUniforms = {
      topColor: { value: new THREE.Color('#7d8ba0') },
      midColor: { value: new THREE.Color('#a08a6e') },
      botColor: { value: new THREE.Color('#3a3028') },
      glowDir: { value: new THREE.Vector3(-0.72, 0.35, -0.42).normalize() },
      glowColor: { value: new THREE.Color('#ffe9c4') },
      glowStrength: { value: 0.45 },
    };
    const bgMat = new THREE.ShaderMaterial({
      uniforms: this.bgUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 topColor, midColor, botColor, glowColor, glowDir;
        uniform float glowStrength;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 col = h > 0.0
            ? mix(midColor, topColor, smoothstep(0.0, 0.75, h))
            : mix(midColor, botColor, smoothstep(0.0, -0.5, h));
          float g = pow(max(dot(normalize(vDir), glowDir), 0.0), 3.0);
          col += glowColor * g * glowStrength;
          // subtle dither to kill banding
          float n = fract(sin(dot(vDir.xy, vec2(12.9898, 78.233))) * 43758.5453);
          col += (n - 0.5) * 0.012;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const bg = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 24), bgMat);
    this.scene.add(bg);

    // --- the window: soft glowing panel with dark frame slats ---
    const winGroup = new THREE.Group();
    const glowTex = canvasTexture(256, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.62);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    this.windowGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 10),
      new THREE.MeshBasicMaterial({
        map: glowTex, color: '#fff3d9', transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      })
    );
    winGroup.add(this.windowGlow);
    const frameMat = new THREE.MeshBasicMaterial({ color: '#181410' });
    const slatV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8.6, 0.1), frameMat);
    const slatH = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.16, 0.1), frameMat);
    slatV.position.z = 0.05; slatH.position.z = 0.05;
    winGroup.add(slatV, slatH);
    winGroup.position.set(-14, 6.5, -8.5);
    winGroup.lookAt(0, 1.5, 0);
    this.scene.add(winGroup);

    // --- light shaft hint (billboard toward jar) ---
    const shaftTex = canvasTexture(128, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, s, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      // fade edges vertically
      const v = ctx.createLinearGradient(0, 0, 0, s);
      v.addColorStop(0, 'rgba(0,0,0,1)');
      v.addColorStop(0.25, 'rgba(0,0,0,0)');
      v.addColorStop(0.75, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, s, s);
    });
    this.shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 4.6),
      new THREE.MeshBasicMaterial({
        map: shaftTex, color: '#ffe9c0', transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      })
    );
    this.shaft.position.set(-4.5, 3.4, -1.4);
    this.shaft.rotation.set(0, 0.35, -0.32);
    this.scene.add(this.shaft);
  }

  // ---------------- desk ----------------
  _buildDesk() {
    const woodTex = canvasTexture(512, (ctx, s) => {
      ctx.fillStyle = '#7d5a3a';
      ctx.fillRect(0, 0, s, s);
      // planks + grain
      for (let y = 0; y < s; y++) {
        const band = Math.floor(y / 86);
        const grain = fbm2(y * 0.09, band * 13.7, 3) * 18 + fbm2(y * 0.7, band * 7.1, 2) * 7;
        const l = 78 + grain + (band % 2) * 6;
        ctx.fillStyle = `rgb(${Math.round(l + 52)}, ${Math.round(l + 14)}, ${Math.round(l - 22)})`;
        ctx.fillRect(0, y, s, 1);
      }
      // fine streaks
      ctx.globalAlpha = 0.16;
      for (let i = 0; i < 130; i++) {
        const y = Math.random() * s;
        ctx.strokeStyle = Math.random() > 0.5 ? '#5a3d24' : '#a5825c';
        ctx.lineWidth = Math.random() * 1.4 + 0.3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.3, y + rand(-7, 7), s * 0.7, y + rand(-7, 7), s, y + rand(-4, 4));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }, 2.4, 1.4);
    const deskMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.68, metalness: 0.02 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 16), deskMat);
    desk.position.y = -0.48; // top at -0.08
    desk.receiveShadow = true;
    this.scene.add(desk);

    // wooden coaster under the jar
    const coasterMat = new THREE.MeshStandardMaterial({ color: '#4f3a26', roughness: 0.8 });
    const coaster = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.95, 0.1, 48), coasterMat);
    coaster.position.y = -0.03;
    coaster.receiveShadow = true;
    coaster.castShadow = true;
    this.scene.add(coaster);
  }

  // ---------------- glass jar + cork ----------------
  _buildJar() {
    const pts = [];
    const R = jar.glassRadius, H = jar.height;
    // base curve
    pts.push(new THREE.Vector2(0.02, 0.03));
    pts.push(new THREE.Vector2(R * 0.55, 0.02));
    pts.push(new THREE.Vector2(R * 0.92, 0.05));
    pts.push(new THREE.Vector2(R, 0.24));
    // straight wall
    pts.push(new THREE.Vector2(R, H * 0.7));
    // rounded shoulder into neck
    const neckR = 1.48, shoulderY = H * 0.7, neckY = H * 0.97;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const e = Math.sin(t * Math.PI * 0.5);
      pts.push(new THREE.Vector2(lerp(R, neckR, e), lerp(shoulderY, neckY, t)));
    }
    // lip
    pts.push(new THREE.Vector2(neckR, neckY + 0.1));
    pts.push(new THREE.Vector2(neckR + 0.09, neckY + 0.16));
    pts.push(new THREE.Vector2(neckR + 0.09, neckY + 0.3));
    pts.push(new THREE.Vector2(neckR - 0.04, neckY + 0.36));

    const glassGeo = new THREE.LatheGeometry(pts, 72);
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.04,
      transmission: 0.97,
      thickness: 0.3,
      ior: 1.5,
      clearcoat: 0.35,
      clearcoatRoughness: 0.15,
      envMapIntensity: 0.95,
      specularIntensity: 0.9,
      attenuationColor: new THREE.Color('#dcf2e6'),
      attenuationDistance: 7,
      side: THREE.FrontSide,
    });
    this.glass = new THREE.Mesh(glassGeo, this.glassMat);
    this.scene.add(this.glass);

    // cork lid
    const corkTex = canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = '#c49a68';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) {
        const shade = Math.random();
        ctx.fillStyle = shade > 0.6 ? 'rgba(90,58,32,0.5)' : shade > 0.3 ? 'rgba(160,116,74,0.5)' : 'rgba(220,184,140,0.45)';
        const w = rand(1, 4), h = rand(1, 4);
        ctx.fillRect(Math.random() * s, Math.random() * s, w, h);
      }
    }, 2, 1);
    const corkMat = new THREE.MeshStandardMaterial({ map: corkTex, roughness: 0.94, metalness: 0 });
    const neckTopY = jar.height * 0.97 + 0.36;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(1.58, 1.42, 0.52, 48), corkMat);
    cork.position.y = neckTopY + 0.12;
    cork.castShadow = true;
    const corkRim = new THREE.Mesh(new THREE.TorusGeometry(1.44, 0.13, 12, 48), corkMat);
    corkRim.rotation.x = Math.PI / 2;
    corkRim.position.y = neckTopY + 0.36;
    this.scene.add(cork, corkRim);
    this.jarTopY = neckTopY;
  }

  // ---------------- substrate: strata + displaced soil top ----------------
  _buildSubstrate() {
    // layered strata visible through the glass
    const strataTex = canvasTexture(256, (ctx, s) => {
      const layers = [
        { to: 0.30, base: [210, 186, 140], jitter: 20 },  // pale sand (bottom of canvas = top? drawn top-down)
      ];
      // draw top-down: canvas y=0 is texture v=1 (top of cylinder)
      for (let y = 0; y < s; y++) {
        const v = y / s; // 0 top (soil) → 1 bottom (sand)
        let base;
        if (v < 0.42) base = [58, 43, 30];        // dark soil
        else if (v < 0.52) base = [94, 74, 50];   // transition
        else if (v < 0.78) base = [196, 172, 128];// sand
        else base = [168, 150, 118];              // gravelly base
        for (let x = 0; x < s; x += 2) {
          const n = fbm2(x * 0.06, y * 0.06, 2) * 16 + (Math.random() - 0.5) * 14;
          ctx.fillStyle = `rgb(${base[0] + n | 0},${base[1] + n | 0},${base[2] + n | 0})`;
          ctx.fillRect(x, y, 2, 1);
        }
      }
      // a few pebbles embedded in the sand band
      for (let i = 0; i < 40; i++) {
        const y = s * rand(0.55, 0.95), x = Math.random() * s, r = rand(2, 6);
        ctx.fillStyle = `rgba(${120 + Math.random() * 60 | 0},${115 + Math.random() * 50 | 0},${105 + Math.random() * 40 | 0},0.9)`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      void layers;
    }, 4, 1);
    const strataMat = new THREE.MeshStandardMaterial({ map: strataTex, roughness: 0.95 });
    // open-ended side wall whose top ring follows the terrain, so nothing
    // ever pokes through the soil dips (the pond especially)
    const strataGeo = new THREE.CylinderGeometry(1.985, 1.985, 0.86, 64, 1, true);
    strataGeo.translate(0, 0.45, 0); // bottom at 0.02, top at 0.88
    {
      const pos = strataGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > 0.6) {
          const x = pos.getX(i), z = pos.getZ(i);
          pos.setY(i, groundHeight(x, z) - 0.008);
        }
      }
      strataGeo.computeVertexNormals();
    }
    const strata = new THREE.Mesh(strataGeo, strataMat);
    this.scene.add(strata);
    // sandy bottom cap (visible through the glass base)
    const strataCap = new THREE.Mesh(
      new THREE.CircleGeometry(1.985, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#b3a077', roughness: 1 })
    );
    strataCap.position.y = 0.025;
    this.scene.add(strataCap);

    // displaced soil-top disc (this is also the raycast target for placement)
    const rings = 18, sectors = 64, radius = 1.99;
    const positions = [], colors = [], indices = [], uvs = [];
    const col = new THREE.Color();
    for (let ri = 0; ri <= rings; ri++) {
      const r = (ri / rings) * radius;
      for (let si = 0; si <= sectors; si++) {
        const a = (si / sectors) * Math.PI * 2;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const y = groundHeight(x, z);
        positions.push(x, y, z);
        uvs.push(x / radius * 0.5 + 0.5, z / radius * 0.5 + 0.5);
        // rich dark soil with mossy freckles
        const n = fbm2(x * 2.4 + 11, z * 2.4 + 4, 3);
        const moss = Math.max(0, fbm2(x * 1.6 - 6, z * 1.6 + 8, 2)) * 0.55;
        col.setRGB(0.16 + n * 0.03, 0.115 + n * 0.025 + moss * 0.08, 0.075 + n * 0.02);
        colors.push(col.r, col.g, col.b);
      }
    }
    for (let ri = 0; ri < rings; ri++) {
      for (let si = 0; si < sectors; si++) {
        const a = ri * (sectors + 1) + si;
        const b = a + sectors + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const soilGeo = new THREE.BufferGeometry();
    soilGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    soilGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    soilGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    soilGeo.setIndex(indices);
    soilGeo.computeVertexNormals();
    const soilMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
    this.soilMesh = new THREE.Mesh(soilGeo, soilMat);
    this.soilMesh.receiveShadow = true;
    this.scene.add(this.soilMesh);
  }

  // ---------------- pond ----------------
  _buildPond() {
    this.waterUniforms = {
      time: { value: 0 },
      colorShallow: { value: new THREE.Color('#7fc4b8') },
      colorDeep: { value: new THREE.Color('#173c3e') },
      lightDir: { value: new THREE.Vector3(0.5, 1, 0.3).normalize() },
      lightColor: { value: new THREE.Color('#fff4e2') },
      glow: { value: 0 },
      level: { value: 1 },
    };
    const waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */`
        uniform float time, glow, level;
        uniform vec3 colorShallow, colorDeep, lightDir, lightColor;
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float rim = length(p);
          float w1 = sin(p.x * 15.0 + time * 1.7 + sin(p.y * 9.0 + time));
          float w2 = sin(p.y * 18.0 - time * 1.25 + w1 * 0.8);
          vec3 n = normalize(vec3(w1 * 0.075, 1.0, w2 * 0.075));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
          vec3 base = mix(colorDeep, colorShallow, clamp(fres * 0.8 + 0.18, 0.0, 1.0));
          float spec = pow(max(dot(reflect(-normalize(lightDir), n), viewDir), 0.0), 110.0);
          vec3 col = base + lightColor * spec * 1.4;
          col += colorShallow * glow * 0.35;
          float alpha = (0.72 + fres * 0.24) * smoothstep(1.0, 0.86, rim) * level;
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    this.waterMesh = new THREE.Mesh(new THREE.CircleGeometry(pond.r + 0.12, 48), waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(pond.x, pond.waterY, pond.z);
    this.waterMesh.renderOrder = 2;
    this.scene.add(this.waterMesh);
  }

  // ---------------- moss, driftwood, pebbles ----------------
  _buildDecor() {
    // --- moss carpet: merged mini-domes with vertex colors ---
    const mossGeos = [];
    const mossCenter = { x: 0.72, z: -0.62 };
    const baseCol = new THREE.Color();
    for (let i = 0; i < 110; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.pow(Math.random(), 0.6) * 0.62;
      const x = mossCenter.x + Math.cos(a) * rr * 1.25;
      const z = mossCenter.z + Math.sin(a) * rr;
      if (Math.hypot(x, z) > jar.walkRadius) continue;
      const s = rand(0.028, 0.075);
      const g = new THREE.SphereGeometry(1, 6, 4);
      g.scale(s, s * rand(0.55, 0.8), s);
      g.translate(x, groundHeight(x, z) + s * 0.2, z);
      baseCol.setHSL(0.33 + rand(-0.03, 0.04), rand(0.42, 0.62), rand(0.2, 0.34));
      const cArr = new Float32Array(g.attributes.position.count * 3);
      for (let v = 0; v < g.attributes.position.count; v++) {
        cArr[v * 3] = baseCol.r; cArr[v * 3 + 1] = baseCol.g; cArr[v * 3 + 2] = baseCol.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
      mossGeos.push(g);
    }
    const mossGeo = mergeGeometries(mossGeos);
    mossGeos.forEach((g) => g.dispose());
    this.mossMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      emissive: new THREE.Color('#37e8a4'),
      emissiveIntensity: 0,
    });
    const moss = new THREE.Mesh(mossGeo, this.mossMat);
    moss.castShadow = true;
    moss.receiveShadow = true;
    this.scene.add(moss);

    // --- driftwood arch ---
    const woodMat = new THREE.MeshStandardMaterial({ color: '#6d5641', roughness: 0.88 });
    const gh = groundHeight;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.28, gh(0.28, 0.06) - 0.06, 0.06),
      new THREE.Vector3(0.62, gh(0.62, -0.2) + 0.34, -0.2),
      new THREE.Vector3(1.05, gh(1.05, -0.62) + 0.5, -0.62),
      new THREE.Vector3(1.42, gh(1.42, -0.95) + 0.12, -0.95),
    ]);
    const wood = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.085, 8), woodMat);
    wood.castShadow = true;
    wood.receiveShadow = true;
    this.scene.add(wood);
    const branch = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.85, gh(0.85, -0.45) + 0.44, -0.45),
      new THREE.Vector3(1.0, gh(1.0, -0.2) + 0.72, -0.2),
      new THREE.Vector3(1.12, gh(1.12, -0.02) + 0.9, -0.02),
    ]);
    const branchMesh = new THREE.Mesh(new THREE.TubeGeometry(branch, 12, 0.045, 6), woodMat);
    branchMesh.castShadow = true;
    this.scene.add(branchMesh);

    // --- pebbles ---
    const pebblePts = [ { x: -1.15, z: -0.6, s: 0.2 }, { x: 0.1, z: 1.15, s: 0.16 }, { x: -0.15, z: -1.05, s: 0.13 } ];
    for (const p of pebblePts) {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i,
          pos.getX(i) * (1 + fbm2(pos.getX(i) * 2 + p.x, pos.getY(i) * 2, 2) * 0.25),
          pos.getY(i) * rand(0.62, 0.72),
          pos.getZ(i) * (1 + fbm2(pos.getZ(i) * 2, pos.getX(i) * 2 + p.z, 2) * 0.25));
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.6, 0.05, rand(0.32, 0.45)),
        roughness: 0.72,
      }));
      m.scale.setScalar(p.s);
      m.position.set(p.x, groundHeight(p.x, p.z) + p.s * 0.28, p.z);
      m.rotation.y = Math.random() * Math.PI;
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  // ---------------- lights ----------------
  _buildLights() {
    this.keyLight = new THREE.DirectionalLight('#fff4e2', 2.6);
    this.keyLight.position.set(-6, 8, 3);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 30;
    const d = 5.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLight.shadow.radius = 5;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.hemi = new THREE.HemisphereLight('#dfe8ff', '#8a7a60', 0.6);
    this.scene.add(this.hemi);

    this.rim = new THREE.DirectionalLight('#bcd4ff', 0.55);
    this.rim.position.set(3.5, 4.5, -7);
    this.scene.add(this.rim);

    // faint interior glow for magical nights
    this.innerGlow = new THREE.PointLight('#54e8b8', 0, 4.2, 1.8);
    this.innerGlow.position.set(0.3, 1.7, -0.2);
    this.scene.add(this.innerGlow);
  }

  // ---------------- postprocessing ----------------
  _buildPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      render.bloomDay, render.bloomRadius, render.bloomThreshold
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignette);
  }

  setSize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, render.maxPixelRatio));
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
  }

  /**
   * @param dt frame delta
   * @param elapsed total visual time
   * @param phase day phase [0..1)
   * @param vitality 0..1 (drives the interior night glow)
   */
  update(dt, elapsed, phase, vitality = 0.5) {
    // --- keyframed day/night ---
    const { a, b, t } = sampleDay(phase);
    const night = lerp(a.night, b.night, t);
    this.nightFactor = night;
    this.dayFactor = 1 - night;

    const el = THREE.MathUtils.degToRad(lerp(a.el, b.el, t));
    const az = THREE.MathUtils.degToRad(lerp(a.az, b.az, t));
    const R = 11;
    const horiz = Math.cos(el) * R;
    this.keyLight.position.set(-Math.cos(az) * horiz, Math.sin(el) * R, Math.sin(az) * horiz);
    lerpKeyColor('sun', a, b, t, this.keyLight.color);
    this.keyLight.intensity = lerp(a.int, b.int, t);

    this.hemi.intensity = lerp(a.hemi, b.hemi, t);
    lerpKeyColor('sky', a, b, t, this.hemi.color);
    lerpKeyColor('grd', a, b, t, this.hemi.groundColor);

    lerpKeyColor('bgT', a, b, t, this.bgUniforms.topColor.value);
    lerpKeyColor('bgM', a, b, t, this.bgUniforms.midColor.value);
    lerpKeyColor('bgB', a, b, t, this.bgUniforms.botColor.value);
    lerpKeyColor('win', a, b, t, this.bgUniforms.glowColor.value);
    this.bgUniforms.glowStrength.value = lerp(a.winOp, b.winOp, t) * 0.5;

    lerpKeyColor('win', a, b, t, this.windowGlow.material.color);
    this.windowGlow.material.opacity = lerp(a.winOp, b.winOp, t);

    this.shaft.material.opacity = 0.055 * this.dayFactor * smoothstep(10, 40, THREE.MathUtils.radToDeg(el));
    this.shaft.material.color.copy(this.keyLight.color);

    this.rim.intensity = 0.35 + night * 0.45;
    this.rim.color.set(night > 0.5 ? '#9db8ff' : '#cfe0ff');

    // magical interior at night — stronger when the jar is thriving
    this.innerGlow.intensity = night * (0.25 + vitality * 0.55);
    this.mossMat.emissiveIntensity = night * (0.18 + vitality * 0.5);

    // bloom breathes with the night
    this.bloom.strength = lerp(render.bloomDay, render.bloomNight, night);

    // environment reflections dim at night
    this.scene.environmentIntensity = lerp(0.42, 0.16, night);

    // water shader
    this.waterUniforms.time.value = elapsed;
    this.waterUniforms.lightDir.value.copy(this.keyLight.position).normalize();
    this.waterUniforms.lightColor.value.copy(this.keyLight.color);
    this.waterUniforms.glow.value = night * vitality * 0.8;

    // idle camera drift
    this._idleTime += dt;
    this.controls.autoRotate = this._idleTime > 6;
    this.controls.update();
  }

  /** Reflect the sim's water reserve in the pond (subtle). */
  setWaterLevel(f) {
    // f in [0..1] — sink & fade the pond as water runs out
    this.waterMesh.position.y = pond.waterY - (1 - f) * 0.09;
    this.waterUniforms.level.value = 0.35 + f * 0.65;
  }

  render() {
    this.composer.render();
  }
}
