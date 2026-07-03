// Sonar-light system: a shared pool of expanding luminous halos, rendered
// entirely in one fragment shader. Every material created here references the
// SAME uniform objects, so one update reaches the seafloor, the creatures,
// the fish and the drifting snow alike.
//
// Unlike a wireframe sonar, each ping behaves like a travelling point light:
// surfaces are shaded by their angle to the ping origin and show their true
// vertex colors, then keep a long soft afterglow as the darkness returns.
import * as THREE from 'three';

export const MAX_PINGS = 24;

export const PING_TYPES = {
  echo: { color: [0.55, 0.92, 1.05], speed: 13, decay: 0.42, frontW: 1.6, after: 0.55, intensity: 1.15 },
  shriek: { color: [1.1, 0.86, 0.5], speed: 22, decay: 0.7, frontW: 2.4, after: 0.4, intensity: 1.6 },
  demon: { color: [1.2, 0.16, 0.12], speed: 9, decay: 0.6, frontW: 1.0, after: 0.45, intensity: 0.95 },
  lantern: { color: [1.05, 0.8, 0.35], speed: 7, decay: 0.85, frontW: 0.9, after: 0.55, intensity: 0.6 },
  beacon: { color: [0.35, 0.7, 1.2], speed: 14, decay: 0.4, frontW: 1.8, after: 0.5, intensity: 0.9 },
};

const VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorldPos;
varying vec3 vNormal;
#ifdef WORLD
attribute float aEmissive;
attribute float aSway;
varying vec3 vColor;
varying float vEmissive;
#endif

void main() {
  vec3 p = position;
#ifdef WORLD
  // gentle current: kelp, grass and fans lean and recover
  p.x += aSway * sin(uTime * 1.15 + position.y * 0.55 + position.z * 0.4) * 0.5;
  p.z += aSway * cos(uTime * 0.85 + position.x * 0.5 + position.y * 0.3) * 0.35;
  vColor = color;
  vEmissive = aEmissive;
#endif
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
#define MAX_PINGS ${MAX_PINGS}

uniform float uTime;
uniform vec4 uPings[MAX_PINGS];      // xyz origin, w start time (-99999 = inactive)
uniform vec4 uPingColor[MAX_PINGS];  // rgb light color, w wave speed
uniform vec4 uPingParams[MAX_PINGS]; // x life decay, y front width, z afterglow, w intensity
uniform vec3 uTouch;                 // faint close-range sense around the camera
uniform float uAmbient;
#ifndef WORLD
uniform vec3 uAlbedo;
#endif

varying vec3 vWorldPos;
varying vec3 vNormal;
#ifdef WORLD
varying vec3 vColor;
varying float vEmissive;
#endif

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 p = vWorldPos;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;

#ifdef WORLD
  vec3 albedo = vColor;
  float emissive = vEmissive;
#else
  vec3 albedo = uAlbedo;
  float emissive = 0.0;
#endif

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
    float after = step(d, r) * exp(-since * 1.35) * uPingParams[i].z;
    // shaded like a point light sitting at the ping origin
    float ndl = 0.22 + 0.78 * max(dot(n, normalize(uPings[i].xyz - p)), 0.0);
    float atten = 1.0 / (1.0 + d * 0.1 + d * d * 0.0032);
    float life = exp(-t * uPingParams[i].x);
    light += uPingColor[i].rgb * ((front * 1.7 + after) * ndl * atten * life * uPingParams[i].w);
  }

  float dCam = distance(p, cameraPosition);
  light += uTouch * exp(-dCam * 0.5);
  // soft knee so close-range light glows instead of clipping to white
  light = light / (1.0 + 0.5 * light);

  vec3 col = albedo * light;
  // bioluminescence breathes on its own
  float pulse = 0.7 + 0.3 * sin(uTime * 2.4 + dot(p, vec3(3.1, 2.3, 2.7)));
  col += albedo * emissive * pulse;
  col += albedo * uAmbient;

  // deep-water absorption
  float fog = 1.0 - exp(-dCam * 0.026);
  col = mix(col, vec3(0.004, 0.010, 0.018), fog);

  float grain = (hash21(gl_FragCoord.xy + vec2(fract(uTime * 61.7) * 289.0)) - 0.5) * 0.04;
  col += grain * (0.2 + col);

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

  uniformsRef() {
    return {
      uTime: this.time,
      uPings: this.pings,
      uPingColor: this.colors,
      uPingParams: this.params,
    };
  }

  // world: vertex-colored scenery with sway + bioluminescence attributes.
  // otherwise: a solid-albedo variant for creatures and fish.
  material({ world = false, albedo = [1, 1, 1], touch = [0, 0, 0] } = {}) {
    const uniforms = {
      ...this.uniformsRef(),
      uTouch: { value: new THREE.Vector3(...touch) },
      uAmbient: { value: 0 },
    };
    if (!world) uniforms.uAlbedo = { value: new THREE.Vector3(...albedo) };
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      defines: world ? { WORLD: '' } : {},
      vertexColors: world,
      side: world ? THREE.DoubleSide : THREE.FrontSide,
    });
  }
}
