// Bootstrap: renderer, scene, lights, resize, main loop.
import * as THREE from "three";
import { CONFIG as C } from "./config.js";
import { Game } from "./game.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById("app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.SKY_CLEAR);
scene.fog = new THREE.Fog(C.SKY_CLEAR, C.FOG_NEAR, C.FOG_FAR);

const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.1,
  900,
);
camera.position.set(0, 60, 30);

// soft paper-diorama lighting: warm key + cool sky fill + gentle ambient lift
const hemiLight = new THREE.HemisphereLight(0xdfeaf2, 0xcbbfa4, 1.1);
scene.add(hemiLight);
scene.add(new THREE.AmbientLight(0xfff4e0, 0.5));

const dirLight = new THREE.DirectionalLight(0xfff3dd, 2.4);
dirLight.position.set(45, 65, 30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 5;
dirLight.shadow.camera.far = 260;
const d = 110;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.bias = -0.0004;
dirLight.shadow.normalBias = 0.03;
scene.add(dirLight);
scene.add(dirLight.target);

const game = new Game(scene, camera, dirLight, hemiLight);
window.__game = game; // debug/testing handle
window.__step = (frames = 1, dt = 1 / 60) => {
  for (let i = 0; i < frames; i++) game.update(dt);
  renderer.render(scene, camera);
};

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  game.update(dt);
  renderer.render(scene, camera);
}
animate();
