const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.hud = $('hud');
    this.levelLabel = $('level-label');
    this.shotsN = $('shots-n');
    this.parN = $('par-n');
    this.toastEl = $('toast');
    this.hintEl = $('hint');
    this.pdotA = $('pdot-a');
    this.pdotB = $('pdot-b');
    this.flashEl = $('flash');
    this.muteBtn = $('mute');

    this.titleOverlay = $('title-overlay');
    this.doneOverlay = $('done-overlay');
    this.endOverlay = $('end-overlay');
    this.chips = $('level-chips');

    this._toastTimer = null;
    this._hintTimer = null;
  }

  showHud(v) { this.hud.classList.toggle('visible', v); }

  setLevel(index, total, name, par) {
    const nn = String(index + 1).padStart(2, '0');
    this.levelLabel.textContent = `level ${nn}/${String(total).padStart(2, '0')} — ${name}`;
    this.parN.textContent = par;
    this.setShots(0);
  }

  setShots(n) { this.shotsN.textContent = n; }

  setPortals(aOn, bOn) {
    this.pdotA.classList.toggle('on', aOn);
    this.pdotB.classList.toggle('on', bOn);
  }

  toast(msg, cls = '', ms = 2200) {
    clearTimeout(this._toastTimer);
    this.toastEl.textContent = msg;
    this.toastEl.className = `show ${cls}`;
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  hint(msg, ms = 6000) {
    clearTimeout(this._hintTimer);
    this.hintEl.textContent = msg;
    this.hintEl.classList.remove('faded');
    if (ms) this._hintTimer = setTimeout(() => this.hintEl.classList.add('faded'), ms);
  }

  flash() {
    this.flashEl.classList.remove('score');
    void this.flashEl.offsetWidth; // restart animation
    this.flashEl.classList.add('score');
  }

  setMuted(m) {
    this.muteBtn.classList.toggle('muted', m);
    this.muteBtn.textContent = m ? '◌' : '◉';
  }

  buildChips(levels, unlocked, best, onPick) {
    this.chips.innerHTML = '';
    levels.forEach((lv, i) => {
      const el = document.createElement('button');
      el.className = 'chip';
      const done = best[lv.id] != null;
      if (done) el.classList.add('done');
      if (i > unlocked) el.classList.add('locked');
      el.textContent = `${String(i + 1).padStart(2, '0')} ${lv.name}${done ? ' ✓' : ''}`;
      if (i <= unlocked) el.addEventListener('click', () => onPick(i));
      this.chips.appendChild(el);
    });
  }

  showTitle() {
    this.titleOverlay.classList.remove('hidden');
    this.doneOverlay.classList.add('hidden');
    this.endOverlay.classList.add('hidden');
    this.showHud(false);
  }

  hideOverlays() {
    this.titleOverlay.classList.add('hidden');
    this.doneOverlay.classList.add('hidden');
    this.endOverlay.classList.add('hidden');
    this.showHud(true);
  }

  showDone({ levelName, shots, par, best, swish, isLast }) {
    let rating;
    if (swish && shots <= par) rating = 'Swish City!';
    else if (shots <= par) rating = 'Clutch!';
    else if (shots <= par + 2) rating = 'Buckets!';
    else rating = 'Grinded it out';
    $('done-kicker').textContent = `${levelName} — complete`;
    $('done-rating').textContent = rating;
    $('done-shots').textContent = shots;
    $('done-par').textContent = par;
    $('done-best').textContent = best != null ? best : '—';
    $('btn-next').querySelector('span').textContent = isLast ? 'final tally' : 'next level';
    this.doneOverlay.classList.remove('hidden');
  }

  showEnd({ totalShots, totalPar, swishes }) {
    $('end-shots').textContent = totalShots;
    $('end-par').textContent = totalPar;
    $('end-swish').textContent = swishes;
    this.doneOverlay.classList.add('hidden');
    this.endOverlay.classList.remove('hidden');
    this.showHud(false);
  }
}
