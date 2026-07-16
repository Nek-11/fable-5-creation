// DOM HUD + screens: title, level select (keyboard-first), pause, win,
// finale, toasts, the loop-timer bar and ghost/gem readouts.
import { SAVE_KEYS } from './config.js';
import { LEVELS } from './levels.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      levelName: $('hud-level'),
      loopNum: $('hud-loop'),
      timerFill: $('timer-fill'),
      timerWrap: $('timer-wrap'),
      timerLabel: $('timer-label'),
      ff: $('ff-ind'),
      carry: $('carry-hint'),
      ghosts: $('hud-ghosts'),
      gems: $('hud-gems'),
      hint: $('hintbar'),
      banner: $('banner'),
      toast: $('toast'),
      title: $('title'),
      select: $('select'),
      selectGrid: $('select-grid'),
      pause: $('pause'),
      win: $('win'),
      winTitle: $('win-title'),
      winStats: $('win-stats'),
      winNext: $('win-next'),
      finale: $('finale'),
      finaleStats: $('finale-stats'),
      crt: $('crt'),
    };
    this.toastTimer = null;
    this.bannerTimer = null;
    this.selIndex = 0;
    this.onPick = null;
    this._screens = ['title', 'select', 'pause', 'win', 'finale'];
  }

  // -------------------------------------------------- persistence

  progress() {
    let unlocked = parseInt(localStorage.getItem(SAVE_KEYS.unlocked) ?? '1', 10);
    if (!Number.isFinite(unlocked) || unlocked < 1) unlocked = 1;
    let best = {};
    try {
      best = JSON.parse(localStorage.getItem(SAVE_KEYS.best) ?? '{}') || {};
    } catch {
      best = {};
    }
    return { unlocked: Math.min(unlocked, LEVELS.length), best };
  }

  saveWin(levelIndex, loops) {
    const p = this.progress();
    const key = String(levelIndex);
    if (!(key in p.best) || loops < p.best[key]) p.best[key] = loops;
    const unlocked = Math.max(p.unlocked, Math.min(levelIndex + 2, LEVELS.length));
    localStorage.setItem(SAVE_KEYS.unlocked, String(unlocked));
    localStorage.setItem(SAVE_KEYS.best, JSON.stringify(p.best));
  }

  // -------------------------------------------------- screens

  show(name) {
    for (const s of this._screens) this.el[s].classList.toggle('hidden', s !== name);
    this.el.hud.classList.toggle('hidden', name === 'title' || name === 'select');
  }
  hideAll() {
    for (const s of this._screens) this.el[s].classList.add('hidden');
    this.el.hud.classList.remove('hidden');
  }

  // -------------------------------------------------- level select

  buildSelect() {
    const p = this.progress();
    const grid = this.el.selectGrid;
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const locked = i + 1 > p.unlocked;
      const btn = document.createElement('button');
      btn.className = 'lvl-btn' + (locked ? ' locked' : '');
      btn.disabled = locked;
      const bestKey = String(i);
      const best = p.best[bestKey];
      btn.innerHTML =
        `<span class="lvl-num">${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="lvl-name">${locked ? '?????' : lv.name}</span>` +
        `<span class="lvl-best">${locked ? 'LOCKED' : best ? `BEST ${best} LOOP${best > 1 ? 'S' : ''}` : 'UNSOLVED'}</span>`;
      btn.addEventListener('click', () => {
        if (!locked && this.onPick) this.onPick(i);
      });
      btn.addEventListener('mouseenter', () => this.setSelIndex(i, false));
      grid.appendChild(btn);
    });
    this.setSelIndex(Math.min(this.selIndex, p.unlocked - 1), false);
  }

  setSelIndex(i, wrap = true) {
    const p = this.progress();
    const max = p.unlocked - 1;
    if (wrap) {
      if (i < 0) i = max;
      if (i > max) i = 0;
    }
    this.selIndex = Math.max(0, Math.min(i, max));
    [...this.el.selectGrid.children].forEach((b, k) =>
      b.classList.toggle('sel', k === this.selIndex),
    );
  }

  // jump between the two 5-row columns of the select grid
  hopColumn(dir) {
    const target = this.selIndex + dir * 5;
    const max = this.progress().unlocked - 1;
    if (target >= 0 && target <= max) this.setSelIndex(target, false);
  }

  // -------------------------------------------------- HUD

  updateHUD({ levelName, loop, maxGhosts, ghostCount, gemStates, frac, low, armed, fast, carrying }) {
    this.el.levelName.textContent = levelName;
    this.el.loopNum.textContent = `LOOP ${loop}`;
    this.el.timerFill.style.transform = `scaleX(${frac.toFixed(4)})`;
    this.el.timerWrap.classList.toggle('low', low);
    this.el.timerWrap.classList.toggle('armed', armed);
    this.el.timerLabel.textContent = armed ? 'MOVE TO START THE LOOP' : '';
    this.el.ff.classList.toggle('hidden', !fast);
    this.el.carry.classList.toggle('hidden', !carrying);

    // ghost pips
    let gh = '';
    for (let i = 0; i < maxGhosts; i++)
      gh += `<span class="pip ${i < ghostCount ? 'on' : ''}"></span>`;
    this.el.ghosts.innerHTML =
      `<span class="hud-label">GHOSTS</span>${gh}` +
      `<span class="hud-sub">${ghostCount >= maxGhosts ? 'FULL — OLDEST FADES NEXT' : ''}</span>`;

    // per-gem delivery pips:
    //   dim = at home · amber = carried, outside exit · lit = in the exit
    let gm = '';
    for (const st of gemStates) gm += `<span class="gem-pip ${st}"></span>`;
    this.el.gems.innerHTML = `<span class="hud-label">LOOT</span>${gm}`;
  }

  hint(text) {
    this.el.hint.textContent = text;
  }

  banner(text, sub = '', ms = 2200) {
    clearTimeout(this.bannerTimer);
    this.el.banner.innerHTML = `<div class="banner-main">${text}</div>${sub ? `<div class="banner-sub">${sub}</div>` : ''}`;
    this.el.banner.classList.remove('hidden');
    this.el.banner.classList.remove('pop');
    void this.el.banner.offsetWidth; // restart animation
    this.el.banner.classList.add('pop');
    this.bannerTimer = setTimeout(() => this.el.banner.classList.add('hidden'), ms);
  }

  toast(text, ms = 1800) {
    clearTimeout(this.toastTimer);
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.toastTimer = setTimeout(() => this.el.toast.classList.add('hidden'), ms);
  }

  // rewind post-processing flourish on the CSS overlay
  setRewindLook(on) {
    this.el.crt.classList.toggle('rewinding', on);
  }

  showWin(levelIndex, loops, isLast) {
    const best = this.progress().best[String(levelIndex)];
    this.el.winTitle.textContent = 'HEIST COMPLETE';
    this.el.winStats.innerHTML =
      `<div class="stat-line">${LEVELS[levelIndex].name.toUpperCase()} — cleared in <b>${loops} loop${loops > 1 ? 's' : ''}</b></div>` +
      `<div class="stat-line dim">best: ${best} loop${best > 1 ? 's' : ''}</div>`;
    this.el.winNext.textContent = isLast
      ? 'ENTER · the final tally'
      : 'ENTER · next job    ESC · hideout';
    this.show('win');
  }

  showFinale() {
    const p = this.progress();
    let total = 0;
    let rows = '';
    LEVELS.forEach((lv, i) => {
      const b = p.best[String(i)] ?? '—';
      if (typeof b === 'number') total += b;
      rows += `<div class="stat-line">${String(i + 1).padStart(2, '0')} ${lv.name} <b>${b} loop${b !== 1 ? 's' : ''}</b></div>`;
    });
    this.el.finaleStats.innerHTML =
      rows + `<div class="stat-line total">CAREER TOTAL — <b>${total} loops</b></div>`;
    this.show('finale');
  }
}
