// Bootstrap: renderer, scene, lights, post-processing, main loop.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";
import { CONFIG as C } from "./config.js";
import { Game } from "./game.js";
import { AudioEngine } from "./audio.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
document.getElementById("app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.FOG_COLOR);
scene.fog = new THREE.Fog(C.FOG_COLOR, C.FOG_NEAR, C.FOG_FAR);

const camera = new THREE.PerspectiveCamera(
  C.CAM_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  900,
);

// cold sky fill + low warm sun for alpenglow
scene.add(new THREE.HemisphereLight(0xcfe2f7, 0xe8eef7, 1.0));
scene.add(new THREE.AmbientLight(0xfff2e0, 0.35));

const sun = new THREE.DirectionalLight(0xffe8c8, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 260;
const d = 70;
sun.shadow.camera.left = -d;
sun.shadow.camera.right = d;
sun.shadow.camera.top = d;
sun.shadow.camera.bottom = -d;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

// post: subtle bloom (snow glints, avalanche glow) + vignette
const size = new THREE.Vector2();
renderer.getSize(size);
const target = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4 });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(size.clone(), 0.28, 0.5, 0.88);
composer.addPass(bloom);
const output = new OutputPass(); // applies tone mapping + sRGB conversion
composer.addPass(output);
const vignette = new ShaderPass(VignetteShader);
vignette.uniforms.offset.value = 0.92;
vignette.uniforms.darkness.value = 1.05;
composer.addPass(vignette);

const audio = new AudioEngine();
const game = new Game(scene, camera, sun, audio);
window.__game = game; // debug handle

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp tab-switch spikes
  game.update(dt);
  composer.render();
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.resolution.set(window.innerWidth, window.innerHeight);
});
