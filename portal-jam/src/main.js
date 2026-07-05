import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COLORS, PHYS } from './config.js';
import { makeComposer, makeDust } from './effects.js';
import { AimController } from './aim.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { LEVELS } from './levels.js';

// ---------- renderer / scene ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.ink);
scene.fog = new THREE.FogExp2(COLORS.fog, 0.02);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 5.5, 14);

// ---------- lights ----------
scene.add(new THREE.AmbientLight(0x33404f, 0.9));

const key = new THREE.DirectionalLight(0xfff2dd, 1.4);
key.position.set(6, 14, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -22;
key.shadow.camera.right = 22;
key.shadow.camera.top = 22;
key.shadow.camera.bottom = -22;
key.shadow.camera.far = 50;
key.shadow.bias = -0.0004;
scene.add(key);

const coolFill = new THREE.DirectionalLight(0x4988aa, 0.5);
coolFill.position.set(-8, 6, -6);
scene.add(coolFill);

const hoopSpot = new THREE.SpotLight(0xffe8c4, 60, 30, 0.5, 0.5, 1.6);
hoopSpot.position.set(0, 12, -2);
scene.add(hoopSpot);
scene.add(hoopSpot.target);

makeDust(scene);

// ---------- controls ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 5;
controls.maxDistance = 32;
controls.maxPolarAngle = 1.5;
controls.enablePan = false;

// ---------- systems ----------
const { composer, bloom } = makeComposer(renderer, scene, camera);
const ui = new UI();
const audio = new AudioEngine();
const aim = new AimController(camera, renderer.domElement, controls);
aim.addTo(scene);
const game = new Game({ scene, camera, controls, ui, audio, aim });

// aim the hoop spotlight at the current level's hoop
const origLoadLevel = game.loadLevel.bind(game);
game.loadLevel = (i) => {
  origLoadLevel(i);
  const hp = game.world.hoop.rimCenter;
  hoopSpot.position.set(hp.x, hp.y + 9, hp.z + 2);
  hoopSpot.target.position.copy(hp);
};

// ---------- UI wiring ----------
function refreshChips() {
  ui.buildChips(LEVELS, game.save.unlocked, game.save.best, (i) => {
    audio.ensure();
    audio.click();
    game.loadLevel(i);
  });
}
refreshChips();

document.getElementById('btn-start').addEventListener('click', () => {
  audio.ensure();
  audio.click();
  game.loadLevel(0);
});
document.getElementById('btn-next').addEventListener('click', () => {
  audio.click();
  game.nextLevel();
});
document.getElementById('btn-replay').addEventListener('click', () => {
  audio.click();
  game.loadLevel(game.levelIndex);
});
document.getElementById('btn-again').addEventListener('click', () => {
  audio.click();
  game.restart();
});
ui.muteBtn.addEventListener('click', () => ui.setMuted(audio.toggleMute()));

// keep chips fresh when returning to title via end screen
const origShowEnd = ui.showEnd.bind(ui);
ui.showEnd = (s) => { refreshChips(); origShowEnd(s); };

// debug/testing handle
import { stepPhysics } from './physics.js';
window.__pj = { game, aim, camera, controls, stepPhysics, THREE };

// ---------- loop ----------
const clock = new THREE.Clock();
let acc = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  acc += dt;
  while (acc >= PHYS.dt) {
    game.fixedStep(PHYS.dt);
    acc -= PHYS.dt;
  }

  controls.update();
  game.update(dt, t);

  camera.position.add(game.shake.offset);
  composer.render();
  camera.position.sub(game.shake.offset);
}
tick();

// ---------- resize ----------
window.addEventListener('resize', () => {
  if (!window.innerWidth || !window.innerHeight) return; // ignore collapsed window
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.resolution.set(window.innerWidth, window.innerHeight);
});
