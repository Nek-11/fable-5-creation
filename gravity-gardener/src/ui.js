import { CONFIG } from './config.js';

// Thin bridge between game state and the DOM HUD.

export class UI {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.hud = this.$('hud');
    this.barLight = this.$('bar-light');
    this.barRot = this.$('bar-rot');
    this.pctLight = this.$('pct-light');
    this.pctRot = this.$('pct-rot');
    this.pods = this.$('pods');
    this.burstBox = this.$('burst');
    this.burstFg = document.querySelector('#burst-ring .fg');
    this.clock = this.$('clock');
    this.toastEl = this.$('toast');
    this.hintEl = this.$('hint');
    this.flash = this.$('flash');
    this.muteBtn = this.$('mute');
    this.titleOverlay = this.$('title-overlay');
    this.endOverlay = this.$('end-overlay');
    this.pauseVeil = this.$('pause-veil');

    // build seed pods
    this.podEls = [];
    for (let i = 0; i < CONFIG.player.seedMax; i++) {
      const el = document.createElement('div');
      el.className = 'pod';
      this.pods.appendChild(el);
      this.podEls.push(el);
    }

    // decorative floating spores on overlays
    for (const holder of ['title-spores', 'end-spores']) {
      const wrap = this.$(holder);
      for (let i = 0; i < 26; i++) {
        const s = document.createElement('i');
        s.style.left = `${Math.random() * 100}%`;
        s.style.top = `${60 + Math.random() * 50}%`;
        s.style.animationDuration = `${9 + Math.random() * 14}s`;
        s.style.animationDelay = `${-Math.random() * 20}s`;
        const sz = 3 + Math.random() * 4;
        s.style.width = s.style.height = `${sz}px`;
        if (Math.random() < 0.3) {
          s.style.background = '#6ad6ff';
          s.style.boxShadow = '0 0 12px 2px rgba(106,214,255,0.55)';
        }
        wrap.appendChild(s);
      }
    }

    this.goalMarker = document.querySelector('#balance .goal');
    this.goalMarker.style.left = `${CONFIG.goal.winLight * 100}%`;

    this._toastTimer = null;
    this._hintTimer = null;
    this.RING = 119.4; // 2πr of the SVG circle
  }

  showHUD(v) { this.hud.classList.toggle('visible', v); }
  showTitle(v) { this.titleOverlay.classList.toggle('hidden', !v); }
  showPause(v) { this.pauseVeil.classList.toggle('show', v); }

  showEnd(won, stats) {
    const t = this.$('end-title');
    t.textContent = won ? 'The garden\nbreathes.' : 'The void\nprevails.';
    t.innerHTML = won ? 'The garden<br/>breathes.' : 'The void<br/>prevails.';
    t.className = `title ${won ? 'win' : 'lose'}`;
    this.$('end-kicker').textContent = won
      ? 'every surface, alive with light'
      : 'the rot has taken the little world';
    this.$('stat-time').textContent = this.fmtTime(stats.time);
    this.$('stat-blooms').textContent = stats.blooms;
    this.$('stat-purged').textContent = stats.purged;
    this.$('btn-restart').textContent = won ? 'bloom again' : 'try again';
    this.endOverlay.classList.remove('hidden');
  }
  hideEnd() { this.endOverlay.classList.add('hidden'); }

  fmtTime(s) {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${ss}`;
  }

  setBalance(lit, rot) {
    this.barLight.style.width = `${(lit * 100).toFixed(1)}%`;
    this.barRot.style.width = `${(rot * 100).toFixed(1)}%`;
    this.pctLight.textContent = `${Math.round(lit * 100)}% alive`;
    this.pctRot.textContent = `${Math.round(rot * 100)}% rot`;
  }

  setSeeds(count, regenProgress) {
    this.podEls.forEach((el, i) => {
      el.classList.toggle('full', i < count);
      const isNext = i === count && count < this.podEls.length;
      el.classList.toggle('charging', isNext);
      if (isNext) {
        el.style.background = `conic-gradient(rgba(125,255,208,0.55) ${regenProgress * 360}deg, transparent 0deg)`;
      } else if (i >= count) {
        el.style.background = 'transparent';
      } else {
        el.style.background = '';
      }
    });
  }

  setBurst(cooldownLeft, total) {
    const ready = cooldownLeft <= 0;
    this.burstBox.classList.toggle('ready', ready);
    const frac = ready ? 0 : cooldownLeft / total;
    this.burstFg.style.strokeDashoffset = (frac * this.RING).toFixed(1);
  }

  setClock(t) { this.clock.textContent = this.fmtTime(t); }

  toast(msg, kind = '', dur = 2600) {
    clearTimeout(this._toastTimer);
    this.toastEl.textContent = msg;
    this.toastEl.className = `show ${kind}`;
    this._toastTimer = setTimeout(() => {
      this.toastEl.className = '';
    }, dur);
  }

  hint(msg, dur = 5200) {
    clearTimeout(this._hintTimer);
    this.hintEl.textContent = msg;
    this.hintEl.classList.remove('faded');
    if (dur > 0) {
      this._hintTimer = setTimeout(() => this.hintEl.classList.add('faded'), dur);
    }
  }

  flashScreen(kind) {
    this.flash.className = '';
    void this.flash.offsetWidth; // restart animation
    this.flash.className = kind;
  }

  setMuted(m) {
    this.muteBtn.classList.toggle('muted', m);
    this.muteBtn.textContent = m ? '◌' : '◉';
  }
}
