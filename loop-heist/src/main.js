// Bootstrap: canvas setup (integer pixel scaling), keyboard input,
// fixed-timestep driver, module wiring.
import { C, SAVE_KEYS } from './config.js';
import { buildTileset } from './tileset.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';

const canvas = document.getElementById('game');
canvas.width = C.COLS * C.TILE; // 320
canvas.height = C.ROWS * C.TILE; // 192

// Integer upscale in CSS pixels + image-rendering:pixelated keeps the art
// crisp on any DPR without resampling the low-res buffer.
function fitCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  const availW = Math.min(window.innerWidth - 24, 1400);
  const availH = window.innerHeight - 150; // room for HUD + hint bar
  const scale = Math.max(1, Math.floor(Math.min(availW / canvas.width, availH / canvas.height)));
  wrap.style.width = `${canvas.width * scale}px`;
  wrap.style.height = `${canvas.height * scale}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// ------------------------------------------------------------ input

const held = new Set();
const MOVE_KEYS = new Map([
  ['KeyW', C.UP], ['ArrowUp', C.UP],
  ['KeyS', C.DOWN], ['ArrowDown', C.DOWN],
  ['KeyA', C.LEFT], ['ArrowLeft', C.LEFT],
  ['KeyD', C.RIGHT], ['ArrowRight', C.RIGHT],
]);

const FF_KEYS = ['KeyF', 'ShiftLeft', 'ShiftRight'];

const input = {
  // sampled exactly once per fixed tick by the sim
  mask() {
    let m = 0;
    for (const [code, bit] of MOVE_KEYS) if (held.has(code)) m |= bit;
    return m;
  },
  // fast-forward is NOT part of the recorded input — it only changes how
  // many fixed ticks run per rendered frame, so replays are identical
  fast() {
    for (const k of FF_KEYS) if (held.has(k)) return true;
    return false;
  },
};

const ui = new UI();
const audio = new AudioEngine();
audio.muted = localStorage.getItem(SAVE_KEYS.muted) === '1';
const ts = buildTileset();
const game = new Game(canvas, ts, ui, audio, input);
window.__game = game; // debug handle

function ensureAudio() {
  audio.init();
  if (audio.ctx?.state === 'suspended') audio.ctx.resume();
}

window.addEventListener('keydown', (e) => {
  ensureAudio();
  if (MOVE_KEYS.has(e.code)) {
    held.add(e.code);
    e.preventDefault();
    // menu navigation reuses the movement keys
    if (game.state === 'select' && !e.repeat) {
      const bit = MOVE_KEYS.get(e.code);
      game.handleAction(bit === C.LEFT ? 'left' : bit === C.RIGHT ? 'right' : bit === C.UP ? 'up' : 'down');
    }
    return;
  }
  if (e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    held.add(e.code); // fast-forward while held
    return;
  }
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyR':
      game.handleAction('rewind');
      break;
    case 'Escape':
      game.handleAction('back');
      break;
    case 'Enter':
    case 'Space':
      game.handleAction('confirm');
      e.preventDefault();
      break;
    case 'KeyQ':
      game.handleAction('quit');
      break;
    case 'KeyM': {
      const m = !audio.muted;
      audio.muted = m;
      audio.setMuted(m);
      localStorage.setItem(SAVE_KEYS.muted, m ? '1' : '0');
      ui.toast(m ? 'SOUND OFF' : 'SOUND ON');
      break;
    }
  }
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear()); // no stuck keys
window.addEventListener('pointerdown', ensureAudio); // mouse-only users

// pause-menu buttons (mouse support)
document.getElementById('btn-resume')?.addEventListener('click', () => game.handleAction('back'));
document.getElementById('btn-restart')?.addEventListener('click', () => game.handleAction('rewind'));
document.getElementById('btn-quit')?.addEventListener('click', () => game.handleAction('quit'));
document.getElementById('title-start')?.addEventListener('click', () => {
  ensureAudio();
  game.handleAction('confirm');
});

// ------------------------------------------------------------ main loop

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1; // clamp tab-switch spikes; sim steps stay fixed
  game.update(dt);
  game.render(dt);
}
requestAnimationFrame(frame);
