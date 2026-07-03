// Marine snow: thousands of drifting motes that catch the sonar light as it
// travels through open water, so every ping is visible as a moving halo even
// where there is nothing else to light.
import * as THREE from 'three';
import { MAX_PINGS } from './pings.js';
import { CONFIG as C } from './config.js';

const VERT = /* glsl */ `
#define MAX_PINGS ${MAX_PINGS}
attribute float aSeed;
uniform float uTime;
uniform float uMaxY;
uniform vec4 uPings[MAX_PINGS];
uniform vec4 uPingColor[MAX_PINGS];
uniform vec4 uPingParams[MAX_PINGS];
varying vec3 vLight;
varying float vBase;

void main() {
  vec3 p = position;
  p.y = mod(p.y - uTime * (0.10 + aSeed * 0.14), uMaxY);
  p.x += sin(uTime * 0.28 + aSeed * 43.0) * 0.6;
  p.z += cos(uTime * 0.23 + aSeed * 31.0) * 0.6;

  vec3 light = vec3(0.0);
  for (int i = 0; i < MAX_PINGS; i++) {
    float t0 = uPings[i].w;
    if (t0 < -9000.0) continue;
    float t = uTime - t0;
    if (t < 0.0) continue;
    float speed = uPingColor[i].w;
    float r = t * speed;
    float d = distance(p, uPings[i].xyz);
    float fw = uPingParams[i].y;
    float front = exp(-(d - r) * (d - r) / (2.0 * fw * fw));
    float since = max((r - d) / speed, 0.0);
    float after = step(d, r) * exp(-since * 1.6) * uPingParams[i].z * 0.5;
    float atten = 1.0 / (1.0 + d * 0.1 + d * d * 0.004);
    float life = exp(-t * uPingParams[i].x);
    light += uPingColor[i].rgb * ((front * 2.2 + after) * atten * life * uPingParams[i].w);
  }
  vLight = light;
  vBase = 0.05 + 0.05 * sin(aSeed * 91.0 + uTime * (0.7 + aSeed));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float glow = min(length(light), 1.2);
  gl_PointSize = min((1.3 + glow * 2.2) * (140.0 / max(1.0, -mv.z)), 11.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying vec3 vLight;
varying float vBase;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.05, length(uv));
  vec3 col = vLight * 0.8 + vec3(0.45, 0.65, 0.85) * vBase;
  gl_FragColor = vec4(col, a * 0.7);
}
`;

export class Snow {
  constructor(pings, radius, count) {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.random() * C.MAXY;
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        ...pings.uniformsRef(),
        uMaxY: { value: C.MAXY },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  addTo(scene) {
    scene.add(this.points);
  }

  removeFrom(scene) {
    scene.remove(this.points);
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}
