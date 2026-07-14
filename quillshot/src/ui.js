// DOM overlay: HUD, screens, upgrade cards, wave banner.
// Canvas draws the world; this file draws everything with a font stack.

export class UI {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      hearts: document.getElementById('hearts'),
      score: document.getElementById('score'),
      wave: document.getElementById('wave'),
      wpm: document.getElementById('wpm'),
      acc: document.getElementById('acc'),
      combo: document.getElementById('combo'),
      comboMult: document.getElementById('combo-mult'),
      comboFill: document.getElementById('combo-fill'),
      banner: document.getElementById('wave-banner'),
      start: document.getElementById('start-screen'),
      pause: document.getElementById('pause-screen'),
      over: document.getElementById('over-screen'),
      upgrade: document.getElementById('upgrade-screen'),
      cards: document.getElementById('cards'),
      overScore: document.getElementById('over-score'),
      overBest: document.getElementById('over-best'),
      overWave: document.getElementById('over-wave'),
      overWpm: document.getElementById('over-wpm'),
      overAcc: document.getElementById('over-acc'),
      newBest: document.getElementById('new-best'),
      retry: document.getElementById('retry-btn'),
    };
    this.bannerTimer = null;
  }

  // screen: 'start' | 'pause' | 'over' | 'upgrade' | null
  show(screen) {
    for (const name of ['start', 'pause', 'over', 'upgrade']) {
      this.el[name].classList.toggle('hidden', name !== screen);
    }
  }

  setHudVisible(v) {
    this.el.hud.classList.toggle('hidden', !v);
  }

  setHearts(n, max) {
    let html = '';
    for (let i = 0; i < max; i++) {
      html += `<span class="h${i < n ? '' : ' empty'}">♥</span>`;
    }
    this.el.hearts.innerHTML = html;
  }

  setScore(n) {
    this.el.score.textContent = n.toLocaleString('en-US');
  }

  setWave(n) {
    this.el.wave.textContent = n;
  }

  setStats(wpm, acc) {
    this.el.wpm.textContent = wpm;
    this.el.acc.textContent = acc;
  }

  setCombo(mult, frac) {
    this.el.comboMult.textContent = `x${mult}`;
    this.el.comboFill.style.width = `${Math.round(frac * 100)}%`;
    this.el.combo.classList.toggle('dim', mult <= 1 && frac === 0);
    this.el.combo.classList.toggle('hot', mult >= 3);
  }

  comboBreak() {
    const c = this.el.combo;
    c.classList.remove('broken');
    void c.offsetWidth; // restart animation
    c.classList.add('broken');
  }

  waveBanner(n, isBoss) {
    const b = this.el.banner;
    clearTimeout(this.bannerTimer);
    b.textContent = isBoss ? `WAVE ${n} — THE STICK KING` : `WAVE ${n}`;
    b.classList.toggle('boss', !!isBoss);
    b.classList.add('hidden');
    void b.offsetWidth;
    b.classList.remove('hidden');
    this.bannerTimer = setTimeout(() => b.classList.add('hidden'), 2250);
  }

  showUpgrades(options, levels) {
    this.el.cards.innerHTML = '';
    options.forEach((u, i) => {
      const card = document.createElement('div');
      card.className = 'ucard';
      const lv = levels[u.id] || 0;
      card.innerHTML = `
        <div class="num">[ ${i + 1} ]</div>
        <div class="icon">${u.icon}</div>
        <div class="name">${u.name}${u.max > 1 && u.max < 90 && lv > 0 ? ` <span class="lv">Lv${lv + 1}</span>` : ''}</div>
        <div class="desc">${u.desc}</div>`;
      card.addEventListener('click', () => this.onPick && this.onPick(i));
      this.el.cards.appendChild(card);
    });
    this.show('upgrade');
  }

  hideUpgrades() {
    this.el.upgrade.classList.add('hidden');
    this.el.cards.innerHTML = '';
  }

  showGameOver({ score, best, isNewBest, wave, wpm, acc }) {
    this.el.overScore.textContent = score.toLocaleString('en-US');
    this.el.overBest.textContent = best.toLocaleString('en-US');
    this.el.overWave.textContent = wave;
    this.el.overWpm.textContent = wpm;
    this.el.overAcc.textContent = `${acc}%`;
    this.el.newBest.classList.toggle('hidden', !isNewBest);
    this.show('over');
  }
}
