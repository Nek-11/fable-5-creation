// ============================================================
// main.js — bootstrap, game states, placement, event wiring.
// ============================================================
import './style.css';
import * as THREE from 'three';
import { CFG } from './config.js';
import { World } from './scene.js';
import { Sim } from './sim.js';
import { Flora } from './flora.js';
import { Fauna } from './fauna.js';
import { FX } from './fx.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { groundHeight, isInPond } from './terrain.js';

const app = document.getElementById('app');
const world = new World(app);
const flora = new Flora(world.scene);
const fauna = new Fauna(world.scene);
const fx = new FX(world.scene);
const ui = new UI();
const audio = new AudioEngine();

fx.setSize(window.innerWidth, window.innerHeight, world.renderer.getPixelRatio());
window.addEventListener('resize', () => {
  fx.setSize(window.innerWidth, window.innerHeight, world.renderer.getPixelRatio());
});

let state = 'title'; // 'title' | 'playing' | 'paused' | 'dead'
let sim = null;
let mossToastCycle = -1;
let prevNight = 0;

// ------------------------------------------------------------
// sim events → visuals / sound / toasts
// ------------------------------------------------------------
function onSimEvent(type, e) {
  switch (type) {
    case 'placed-seed':
      fx.puff(e.x, groundHeight(e.x, e.z), e.z);
      audio.place();
      break;
    case 'placed-beetle':
      fx.puff(e.x, groundHeight(e.x, e.z), e.z);
      audio.place();
      break;
    case 'placed-mantis':
      fx.puff(e.x, groundHeight(e.x, e.z), e.z);
      audio.place();
      ui.toast('a quiet hunter enters the jar', 'warn');
      break;
    case 'placed-spore':
      fx.puff(e.x, groundHeight(e.x, e.z), e.z);
      audio.place();
      break;
    case 'placed-droplet':
      fx.spawnDroplet(e.x, e.z, () => audio.plip());
      break;

    case 'plant-born':
      fx.puff(e.x, groundHeight(e.x, e.z), e.z);
      audio.birth();
      ui.toast('a seedling volunteers itself');
      break;
    case 'beetle-born':
      audio.birth();
      ui.toast('a beetle was born');
      break;
    case 'mantis-born':
      audio.birth();
      ui.toast('a mantis was born', 'magic');
      break;
    case 'mushroom-sprout':
      fx.puff(e.x, groundHeight(e.x, e.z), e.z);
      audio.birth();
      break;

    case 'plant-died':
      flora.plantDied(e);
      audio.death();
      ui.toast('a plant folded back into the soil', 'warn');
      break;
    case 'beetle-died':
      fauna.beetleDied(e);
      audio.death();
      break;
    case 'mantis-died':
      fauna.mantisDied(e);
      audio.death();
      ui.toast('the mantis lay down among the leaves', 'warn');
      break;
    case 'mushroom-died':
      audio.death();
      break;

    case 'beetle-bite':
      if (Math.random() < 0.15) audio.chirp();
      break;
    case 'mantis-pounce':
      audio.pounce();
      break;
    case 'mantis-ate':
      if (Math.random() < 0.5) ui.toast('the mantis has fed');
      break;

    case 'warn':
      ui.toast(e.msg, 'warn');
      break;

    case 'jar-died':
      state = 'dead';
      fx.hideGhost();
      audio.elegy();
      ui.showElegy(sim.time, e.cause, sim.giftsGiven);
      break;
  }
}

function newJar() {
  flora.reset();
  fauna.reset();
  fx.reset();
  ui.resetHistory();
  sim = new Sim(onSimEvent);
}
newJar();

// ------------------------------------------------------------
// placement — raycast against the soil (never the glass)
// ------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(-2, -2);
let pointerInside = false;
let downPos = null;

function placementValid(tool, point) {
  const r = Math.hypot(point.x, point.z);
  if (r > CFG.jar.walkRadius) return false;
  if ((tool === 'seed' || tool === 'spore') && isInPond(point.x, point.z)) return false;
  if ((tool === 'beetle' || tool === 'mantis') && isInPond(point.x, point.z)) return false;
  return true;
}

function raycastGround() {
  raycaster.setFromCamera(pointerNDC, world.camera);
  const targets = [world.soilMesh, world.waterMesh];
  const hits = raycaster.intersectObjects(targets, false);
  return hits.length ? hits[0].point : null;
}

const canvas = world.renderer.domElement;
canvas.addEventListener('pointermove', (ev) => {
  pointerNDC.set((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
  pointerInside = true;
});
canvas.addEventListener('pointerleave', () => { pointerInside = false; });
canvas.addEventListener('pointerdown', (ev) => { downPos = { x: ev.clientX, y: ev.clientY }; });
canvas.addEventListener('pointerup', (ev) => {
  if (!downPos) return;
  const moved = Math.hypot(ev.clientX - downPos.x, ev.clientY - downPos.y);
  downPos = null;
  if (moved > 6 || state !== 'playing') return;

  const tool = ui.tool;
  if (!ui.toolReady(tool)) return;
  const point = raycastGround();
  if (!point || !placementValid(tool, point)) return;

  const placed = sim.place(tool, point.x, point.z);
  if (placed) ui.triggerCooldown(tool);
});

// ------------------------------------------------------------
// input: tools, pause, mute
// ------------------------------------------------------------
const TOOL_KEYS = { Digit1: 'seed', Digit2: 'beetle', Digit3: 'mantis', Digit4: 'spore', Digit5: 'droplet' };
window.addEventListener('keydown', (ev) => {
  if (TOOL_KEYS[ev.code] && state === 'playing') ui.selectTool(TOOL_KEYS[ev.code]);
  if (ev.code === 'Escape' && (state === 'playing' || state === 'paused')) {
    state = state === 'playing' ? 'paused' : 'playing';
    ui.setPaused(state === 'paused');
    if (state === 'paused') fx.hideGhost();
  }
  if (ev.code === 'KeyM') toggleMute();
});

let muted = false;
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
}
document.getElementById('mute').addEventListener('click', toggleMute);

ui.onToolChange = (tool) => { if (state === 'playing') fx.showGhost(tool); };

// ------------------------------------------------------------
// screens
// ------------------------------------------------------------
ui.showTitleBest();
document.getElementById('btn-start').addEventListener('click', () => {
  audio.start();
  state = 'playing';
  ui.hideTitle();
  ui.showHud();
  fx.showGhost(ui.tool);
  ui.toast('the jar is yours — give gently', 'magic');
});
document.getElementById('btn-restart').addEventListener('click', () => {
  newJar();
  ui.hideElegy();
  ui.showHud();
  state = 'playing';
  fx.showGhost(ui.tool);
  mossToastCycle = -1;
});

// ------------------------------------------------------------
// main loop
// ------------------------------------------------------------
const clock = new THREE.Clock();
let visTime = 0;
let phaseTime = CFG.startPhase * CFG.dayLength;
let moodTimer = 0;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const frozen = state === 'paused';
  const dtEff = frozen ? 0 : dt;

  visTime += dtEff;
  if (!frozen) phaseTime += dt;
  const phase = (phaseTime / CFG.dayLength) % 1;

  // ---- simulation ----
  if (state === 'playing') {
    sim.light = world.dayFactor;
    sim.update(dt);

    ui.updateCooldowns(dt);
    ui.setClock(sim.time);
    ui.setVitality(sim.vitality);
    ui.setGauges(sim.water, sim.nutrients);
    ui.setCensus(sim.counts, dt);

    // ghost preview under the cursor
    if (pointerInside && ui.toolReady(ui.tool)) {
      const point = raycastGround();
      if (point) fx.moveGhost(point, placementValid(ui.tool, point));
      else fx.hideGhost();
    } else {
      fx.hideGhost();
    }
  }

  // ---- world & visuals ----
  world.update(dt, visTime, phase, sim.vitality);
  flora.sync(sim, visTime, dtEff, world.nightFactor);
  fauna.sync(sim, visTime, dtEff);
  fx.update(dtEff, visTime, world.dayFactor, world.nightFactor);
  world.setWaterLevel(sim.water / CFG.sim.waterMax);

  // fireflies gather when the jar is healthy at night
  const flyOn = world.nightFactor > 0.5 && sim.vitality > CFG.sim.fireflyVitalityMin && state !== 'dead';
  fx.setFireflyTarget(flyOn ? Math.floor(sim.vitality * CFG.caps.fireflies) : 0);

  // once per nightfall: the moss glows
  if (state === 'playing' && prevNight <= 0.7 && world.nightFactor > 0.7) {
    const cycle = Math.floor(phaseTime / CFG.dayLength);
    if (cycle !== mossToastCycle && sim.vitality > 0.4) {
      mossToastCycle = cycle;
      ui.toast('the moss glows tonight', 'magic');
    }
  }
  prevNight = world.nightFactor;

  // ---- audio mood ----
  moodTimer += dt;
  if (moodTimer > 0.5) {
    moodTimer = 0;
    audio.setMood(world.dayFactor, sim.vitality);
  }

  world.render();
}
loop();

// dev handle
window.__gg = { world, sim: () => sim, flora, fauna, fx };
