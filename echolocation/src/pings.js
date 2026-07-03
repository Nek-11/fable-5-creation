// Sonar ping system: a shared pool of expanding wavefronts, rendered entirely
// in one fragment shader. Every material created here references the SAME
// uniform objects, so one update reaches the cave, the creatures and the moths.
import * as THREE from 'three';

export const MAX_PINGS = 24;

export const PING_TYPES = {
  echo: { color: [0.45, 0.95, 1.05], speed: 15, decay: 0.5, frontW: 0.6, after: 0.5, intensity: 1.0 },
  shriek: { color: [1.05, 0.85, 0.55], speed: 24, decay: 0.85, frontW: 1.2, after: 0.35, intensity: 1.5 },
  stalker: { color: [1.1, 0.16, 0.14], speed: 10, decay: 0.7, frontW: 0.55, after: 0.4, intensity: 0.95 },
  moth: { color: [1.0, 0.78, 0.32], speed: 8, decay: 1.0, frontW: 0.45, after: 0.5, intensity: 0.5 },
  beacon: { color: [0.35, 0.65, 1.1], speed: 12, decay: 0.55, frontW: 0.8, after: 0.45, intensity: 0.75 },
};

const VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
#define MAX_PINGS ${MAX_PINGS}

uniform float uTime;
uniform vec4 uPings[MAX_PINGS];      // xyz origin, w start time (-99999 = inactive)
uniform vec4 uPingColor[MAX_PINGS];  // rgb tint, w wave speed
uniform vec4 uPingParams[MAX_PINGS]; // x life decay, y front width, z afterglow, w intensity
uniform vec3 uTint;
uniform vec3 uTouch;   // faint close-range "touch sense" around the camera
uniform float uAmbient;

varying vec3 vWorldPos;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float lineAt(float v, float w) {
  float d = abs(v - floor(v + 0.5));
  return smoothstep(w, 0.0, d);
}

void main() {
  vec3 p = vWorldPos;

  // organic wobble so the contours read as cave strata, not a CAD grid
  vec3 q = p + 0.22 * vec3(
    sin(p.y * 1.9 + p.z * 1.3),
    sin(p.z * 1.7 + p.x * 1.5),
    sin(p.x * 1.3 + p.y * 1.7));

  float sy = q.y * 2.6;
  float horiz = lineAt(sy, fwidth(sy) * 1.4 + 0.05);
  float sx = q.x * 0.9;
  float sz = q.z * 0.9;
  float vert = max(lineAt(sx, fwidth(sx) * 1.4 + 0.05), lineAt(sz, fwidth(sz) * 1.4 + 0.05));
  float contour = clamp(horiz + vert * 0.45, 0.0, 1.0);

  vec3 col = vec3(0.0);
  for (int i = 0; i < MAX_PINGS; i++) {
    float t0 = uPings[i].w;
    if (t0 < -9000.0) continue;
    float t = uTime - t0;
    if (t < 0.0) continue;
    float speed = uPingColor[i].w;
    float r = t * speed;
    float d = distance(p, uPings[i].xyz);
    float frontW = uPingParams[i].y;
    float front = exp(-(d - r) * (d - r) / (2.0 * frontW * frontW));
    float since = max((r - d) / speed, 0.0);
    float after = step(d, r) * exp(-since * 2.2) * uPingParams[i].z;
    float atten = 1.0 / (1.0 + d * d * 0.004);
    float life = exp(-t * uPingParams[i].x);
    col += uPingColor[i].rgb * ((front * 1.5 + after) * atten * life * uPingParams[i].w);
  }

  float dCam = distance(p, cameraPosition);
  col += uTouch * exp(-dCam * 0.75);
  col += uAmbient * vec3(0.9, 0.95, 1.0);

  col *= (0.28 + 0.85 * contour);
  col *= uTint;
  col *= exp(-dCam * 0.022);

  float grain = (hash21(gl_FragCoord.xy + vec2(fract(uTime * 61.7) * 289.0)) - 0.5) * 0.05;
  col += grain * (0.25 + col);

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Pings {
  constructor() {
    this.idx = 0;
    this.time = { value: 0 };
    this.pings = {
      value: Array.from({ length: MAX_PINGS }, () => new THREE.Vector4(0, 0, 0, -99999)),
    };
    this.colors = {
      value: Array.from({ length: MAX_PINGS }, () => new THREE.Vector4(1, 1, 1, 10)),
    };
    this.params = {
      value: Array.from({ length: MAX_PINGS }, () => new THREE.Vector4(1, 0.5, 0.4, 0)),
    };
  }

  emit(pos, type) {
    const t = PING_TYPES[type];
    const i = this.idx;
    this.idx = (this.idx + 1) % MAX_PINGS;
    this.pings.value[i].set(pos.x, pos.y, pos.z, this.time.value);
    this.colors.value[i].set(t.color[0], t.color[1], t.color[2], t.speed);
    this.params.value[i].set(t.decay, t.frontW, t.after, t.intensity);
  }

  clear() {
    for (const v of this.pings.value) v.w = -99999;
  }

  material({ tint = [1, 1, 1], touch = [0, 0, 0], ambient = 0 } = {}) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.time,
        uPings: this.pings,
        uPingColor: this.colors,
        uPingParams: this.params,
        uTint: { value: new THREE.Vector3(...tint) },
        uTouch: { value: new THREE.Vector3(...touch) },
        uAmbient: { value: ambient },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
  }
}
