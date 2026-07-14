// ============================================================
// ui.js — toolbar, vitality dial, census, gauges, toasts, screens.
// ============================================================
import { CFG, STORAGE_KEY } from './config.js';
import { clamp } from './noise.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.hud = $('hud');
    this.titleOverlay = $('title-overlay');
    this.endOverlay = $('end-overlay');
    this.pauseVeil = $('pause-veil');
    this.toastEl = $('toast');
    this.vitArc = $('vit-arc');
    this.vitPct = $('vit-pct');
    this.clockEl = $('clock');
    this.muteBtn = $('mute');

    this.chips = Array.from(document.querySelectorAll('.chip'));
    this.tool = 'seed';
    this.cooldowns = {}; // tool -> remaining seconds
    this.onToolChange = null;

    this.chips.forEach((chip) => {
      chip.addEventListener('click', () => this.selectTool(chip.dataset.tool));
    });
    this.selectTool('seed');

    this._toastTimer = null;
    this._history = { plants: [], beetles: [], mantises: [], mushrooms: [] };
    this._histTimer = 0;
  }

  // ---------------- tools ----------------
  selectTool(tool) {
    this.tool = tool;
    this.chips.forEach((c) => c.classList.toggle('active', c.dataset.tool === tool));
    if (this.onToolChange) this.onToolChange(tool);
  }

  toolReady(tool) { return (this.cooldowns[tool] || 0) <= 0; }

  triggerCooldown(tool) {
    this.cooldowns[tool] = CFG.cooldowns[tool] || 3;
  }

  updateCooldowns(dt) {
    for (const chip of this.chips) {
      const tool = chip.dataset.tool;
      let cd = this.cooldowns[tool] || 0;
      if (cd > 0) {
        cd = Math.max(0, cd - dt);
        this.cooldowns[tool] = cd;
        const total = CFG.cooldowns[tool] || 3;
        const f = cd / total;
        chip.classList.toggle('cooling', cd > 0);
        const circle = chip.querySelector('.cd circle');
        if (circle) circle.style.strokeDashoffset = String(125.7 * (1 - f));
      } else {
        chip.classList.remove('cooling');
      }
    }
  }

  // ---------------- HUD readouts ----------------
  setVitality(v) {
    const f = clamp(v, 0, 1);
    this.vitArc.style.strokeDashoffset = String(163.4 * (1 - f));
    this.vitArc.style.stroke = f > 0.55 ? 'var(--leaf)' : f > 0.28 ? 'var(--gold)' : 'var(--rose)';
    this.vitPct.textContent = String(Math.round(f * 100));
  }

  setClock(seconds) {
    this.clockEl.textContent = formatTime(seconds);
  }

  setGauges(water, nutrients) {
    $('g-water').style.width = `${clamp(water, 0, 100)}%`;
    $('g-nutrients').style.width = `${clamp((nutrients / CFG.sim.nutrientsMax) * 100, 0, 100)}%`;
  }

  setCensus(counts, dt) {
    // record history every 2s for trend arrows over a ~10s window
    this._histTimer += dt;
    const record = this._histTimer >= 2;
    if (record) this._histTimer = 0;
    for (const k of ['plants', 'beetles', 'mantises', 'mushrooms']) {
      $(`c-${k}`).textContent = String(counts[k]);
      const h = this._history[k];
      if (record) {
        h.push(counts[k]);
        if (h.length > 5) h.shift();
      }
      const past = h.length ? h[0] : counts[k];
      const el = $(`t-${k}`);
      if (counts[k] > past) { el.textContent = '▲'; el.className = 'up'; }
      else if (counts[k] < past) { el.textContent = '▼'; el.className = 'down'; }
      else { el.textContent = '–'; el.className = ''; }
    }
  }

  // ---------------- toasts ----------------
  toast(msg, kind = '') {
    clearTimeout(this._toastTimer);
    this.toastEl.textContent = msg;
    this.toastEl.className = `show ${kind}`;
    this._toastTimer = setTimeout(() => {
      this.toastEl.className = '';
    }, 3400);
  }

  // ---------------- screens ----------------
  showHud() { this.hud.classList.add('visible'); }
  hideHud() { this.hud.classList.remove('visible'); }

  hideTitle() { this.titleOverlay.classList.add('hidden'); }

  showTitleBest() {
    const best = Number(localStorage.getItem(STORAGE_KEY) || 0);
    $('title-best').textContent = best > 0 ? `longest garden — ${formatTime(best)}` : 'no jar has lived yet';
  }

  setPaused(on) { this.pauseVeil.classList.toggle('show', on); }

  showElegy(seconds, cause, gifts) {
    let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (seconds > best) {
      best = seconds;
      localStorage.setItem(STORAGE_KEY, String(Math.floor(seconds)));
    }
    $('elegy-line').textContent = cause;
    $('stat-time').textContent = formatTime(seconds);
    $('stat-given').textContent = String(gifts);
    $('stat-best').textContent = formatTime(best);
    this.endOverlay.classList.remove('hidden');
    this.hideHud();
  }

  hideElegy() { this.endOverlay.classList.add('hidden'); }

  setMuted(m) { this.muteBtn.classList.toggle('muted', m); this.muteBtn.textContent = m ? '♪̶' : '♪'; }

  resetHistory() {
    this._history = { plants: [], beetles: [], mantises: [], mushrooms: [] };
    this._histTimer = 0;
  }
}

export function formatTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
