// Bootstrap: canvas + DPR-aware resize, keyboard routing, main loop.
import { CONFIG as C } from './config.js';
import { Game } from './game.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = new UI();
const audio = new AudioEngine();
const game = new Game(canvas, ui, audio);
window.__game = game; // debug handle

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, C.MAX_DPR);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.resize(w, h);
}
resize();
window.addEventListener('resize', resize);

// --- keyboard: the whole game is played here ---
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return; // never eat shortcuts
  if (e.repeat) return; // held keys don't machine-gun letters
  audio.init(); // safe: no-op after the first call, needs a user gesture
  const handled = game.onKey(e);
  if (handled || e.key === ' ') e.preventDefault();
});

// retry button on the game-over screen
ui.el.retry.addEventListener('click', () => {
  if (game.state === 'over') {
    audio.init();
    game.startRun();
  }
});

// losing focus mid-fight is not a fair way to die
window.addEventListener('blur', () => {
  if (game.state === 'playing') game.pause();
});

// --- main loop: delta-clamped variable step (clamped inside game.update) ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
}
requestAnimationFrame(frame);
