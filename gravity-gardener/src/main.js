import * as THREE from 'three';
import { Planet } from './planet.js';
import { FloraSystem } from './flora.js';
import { RotSystem } from './rot.js';
import { Player } from './player.js';
import { Effects } from './effects.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Game } from './game.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04060f');

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1400);
camera.position.set(0, 20, 58);

const planet = new Planet(scene);
const flora = new FloraSystem(scene, planet);
const rot = new RotSystem(scene, planet);
const effects = new Effects(scene, camera, renderer);
const player = new Player(scene, planet, camera);
const ui = new UI();
const audio = new AudioEngine();

const game = new Game({
  planet, flora, rot, player, effects, ui, audio, camera,
  canvas: renderer.domElement,
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  effects.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let elapsed = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (game.state === 'title' || game.state === 'ended') {
    game.titleCamera(elapsed);
    // keep the world breathing behind the overlays
    if (game.state === 'title') {
      planet.update(dt, elapsed);
      effects.update(dt, elapsed);
    } else {
      game.update(dt);
    }
  } else {
    game.update(dt);
  }

  effects.render();
}
loop();

// dev handle
window.__game = game;
