// Procedural WebAudio: a slinky heist bassline loop, plate clicks, door
// rumbles, gem chimes, the rewind whoosh, guard alarm, laser zap, and the
// last-3-seconds heartbeat. Everything synthesized — no assets.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._musicOn = false;
    this._tension = 0;
    this._fast = false; // fast-forward: quicker, brighter groove
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 2200;
    this.musicBus.connect(this.musicFilter).connect(this.master);

    // shared noise buffer
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = last * 0.92 + (Math.random() * 2 - 1) * 0.08;
      data[i] = last * 7;
    }

    // music scheduler
    this.bpm = 92;
    this.step16 = 60 / this.bpm / 4;
    this.nextStepTime = 0;
    this.stepIndex = 0;
    this._timer = setInterval(() => this.schedule(), 35);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  // ---------------------------------------------------------- music

  startMusic() {
    if (!this.ctx) return;
    if (!this._musicOn) {
      this._musicOn = true;
      this.nextStepTime = this.ctx.currentTime + 0.06;
      this.stepIndex = 0;
    }
  }
  stopMusic() {
    this._musicOn = false;
  }
  // 0..1 — opens the filter and adds urgency in the last seconds
  setTension(t) {
    this._tension = t;
    if (this.musicFilter)
      this.musicFilter.frequency.setTargetAtTime(1800 + t * 3600, this.ctx.currentTime, 0.2);
  }
  // fast-forward feel: tempo + pitch nudge up, hats denser, filter brighter.
  // Music only — the deterministic sim never touches audio.
  setFast(on) {
    this._fast = on;
    if (this.musicFilter && this.ctx)
      this.musicFilter.frequency.setTargetAtTime(
        (1800 + this._tension * 3600) * (on ? 1.3 : 1),
        this.ctx.currentTime,
        0.1,
      );
  }

  duckMusic(sec = 1.0) {
    if (!this.musicBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(0.12, t);
    this.musicBus.gain.linearRampToValueAtTime(0.55, t + sec);
  }

  schedule() {
    if (!this.ctx || !this._musicOn) return;
    const ahead = 0.16;
    while (this.nextStepTime < this.ctx.currentTime + ahead) {
      this.playStep(this.stepIndex, this.nextStepTime);
      this.stepIndex = (this.stepIndex + 1) % 32; // two bars
      this.nextStepTime += this.step16 / (this._fast ? 1.18 : 1);
    }
  }

  playStep(i, t) {
    const pitch = this._fast ? 1.13 : 1;
    // swung 16ths: push every off-16th late
    if (i % 2 === 1) t += this.step16 * 0.28;

    // bassline, A natural minor prowl (two bars)
    const A1 = 55, C2 = 65.41, D2 = 73.42, E2 = 82.41, G1 = 49, F1 = 43.65, E1 = 41.2;
    const bass = [
      A1, 0, 0, A1, 0, 0, C2, 0, A1, 0, 0, G1, 0, E2, 0, 0,
      F1, 0, 0, F1, 0, 0, A1, 0, G1, 0, 0, E1, 0, G1, 0, D2,
    ][i];
    if (bass) this.pluck(bass * pitch, t, 0.22, 0.16);

    // soft kick pulse on the 1 and 3
    if (i % 8 === 0) this.kick(t, 0.11);

    // closed hats on the off-beats, denser under tension or fast-forward
    if (i % 4 === 2 || ((this._tension > 0.6 || this._fast) && i % 2 === 0)) this.hat(t, 0.028);

    // sparse vibraphone stab, first beat of bar 2
    if (i === 16) this.stab([220 * pitch, 261.63 * pitch, 329.63 * pitch], t, 0.05);
    if (i === 28 && this._tension > 0.3) this.stab([246.94 * pitch, 293.66 * pitch], t, 0.04);
  }

  pluck(freq, t, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(140, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  kick(t, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.16);
  }

  hat(t, vol) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t);
    src.stop(t + 0.06);
  }

  stab(freqs, t, vol) {
    for (const fr of freqs) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = fr;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g).connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.55);
    }
  }

  // ---------------------------------------------------------- one-shots

  blip(freq, dur, type = 'triangle', vol = 0.2, slideTo = null, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, filterFreq, vol, type = 'bandpass', when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur);
  }

  footstep(alt) {
    this.noiseBurst(0.05, alt ? 900 : 750, 0.035);
  }
  plateOn() {
    this.blip(190, 0.09, 'square', 0.14, 150);
    this.noiseBurst(0.06, 1400, 0.08);
  }
  plateOff() {
    this.blip(150, 0.08, 'square', 0.08, 190);
  }
  switchFlip(on) {
    this.blip(on ? 520 : 340, 0.07, 'square', 0.13, on ? 780 : 240);
    this.noiseBurst(0.05, 2500, 0.06);
  }
  doorOpen() {
    this.noiseBurst(0.3, 300, 0.22, 'lowpass');
    this.blip(90, 0.28, 'sawtooth', 0.07, 150);
  }
  doorClose() {
    this.noiseBurst(0.22, 260, 0.2, 'lowpass');
    this.blip(140, 0.2, 'sawtooth', 0.07, 70);
    this.blip(70, 0.1, 'sine', 0.2, null, 0.16); // thunk
  }
  gem(n) {
    const base = 660 * Math.pow(1.19, Math.min(n, 4));
    this.blip(base, 0.12, 'triangle', 0.16);
    this.blip(base * 1.5, 0.18, 'triangle', 0.14, null, 0.07);
    this.blip(base * 2, 0.24, 'sine', 0.1, null, 0.14);
  }
  ghostGem() {
    this.blip(520, 0.1, 'sine', 0.05, 700);
  }
  throw(isPlayer) {
    this.noiseBurst(0.14, 2400, isPlayer ? 0.12 : 0.06, 'bandpass');
    this.blip(440, 0.16, 'sine', isPlayer ? 0.1 : 0.05, 880);
  }
  gemLand() {
    this.blip(1320, 0.05, 'square', 0.1);
    this.blip(1760, 0.09, 'triangle', 0.08, null, 0.04);
  }
  cratePush() {
    this.noiseBurst(0.16, 320, 0.2, 'lowpass');
    this.blip(85, 0.12, 'sine', 0.16, 60);
  }
  denied() {
    this.blip(220, 0.09, 'square', 0.12, 180);
    this.blip(160, 0.12, 'square', 0.12, 140, null, 0.09);
  }
  laserZap() {
    this.noiseBurst(0.25, 3200, 0.3, 'highpass');
    this.blip(1400, 0.3, 'sawtooth', 0.2, 90);
  }
  alarm() {
    for (let k = 0; k < 3; k++) {
      this.blip(880, 0.14, 'square', 0.12, null, k * 0.18);
      this.blip(660, 0.14, 'square', 0.12, null, k * 0.18 + 0.09);
    }
  }
  rewind() {
    // the star of the show: pitch-down whoosh + reverse shimmer
    this.duckMusic(1.1);
    this.blip(900, 0.7, 'sawtooth', 0.12, 60);
    this.blip(1350, 0.7, 'triangle', 0.08, 90);
    this.noiseBurst(0.65, 900, 0.22, 'bandpass');
    for (let k = 0; k < 5; k++) this.blip(400 + k * 220, 0.08, 'sine', 0.05, null, 0.08 + k * 0.09);
  }
  tick(last) {
    this.blip(last ? 1100 : 850, 0.05, 'square', last ? 0.15 : 0.1);
  }
  heartbeat() {
    this.blip(58, 0.12, 'sine', 0.32, 40);
    this.blip(52, 0.1, 'sine', 0.24, 38, null, 0.14);
  }
  ghostSpawn() {
    this.blip(320, 0.35, 'sine', 0.09, 640);
    this.blip(480, 0.35, 'sine', 0.07, 960, null, 0.05);
  }
  ghostFade() {
    this.blip(640, 0.3, 'sine', 0.08, 240);
  }
  uiMove() {
    this.blip(440, 0.05, 'square', 0.06);
  }
  uiSelect() {
    this.blip(560, 0.07, 'square', 0.1);
    this.blip(840, 0.12, 'square', 0.09, null, 0.06);
  }
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, k) => this.blip(f, 0.3, 'triangle', 0.14, null, k * 0.11));
    this.blip(1318.5, 0.6, 'sine', 0.1, null, 0.48);
    this.noiseBurst(0.5, 5000, 0.05, 'highpass');
  }
  finale() {
    const notes = [440, 523.25, 659.25, 880, 1046.5, 1318.5];
    notes.forEach((f, k) => this.blip(f, 0.5, 'triangle', 0.12, null, k * 0.14));
  }
}
