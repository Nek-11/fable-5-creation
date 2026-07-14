// ============================================================
// audio.js — 100% generative WebAudio. Airy pad that follows the
// day/night cycle; tiny pentatonic chirps and plips for events.
// No harsh sounds — everything filtered and soft.
// ============================================================

const PENTA = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
  }

  /** Must be called from a user gesture. */
  start() {
    if (this.started) return;
    this.started = true;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);
    // slow fade-in so the world seems to wake
    this.master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 4);

    // ---------- pad: detuned triangles through a breathing lowpass ----------
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 600;
    this.padFilter.Q.value = 0.6;

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.05;
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.master);

    const chord = [110, 164.81, 220, 329.63]; // A2 E3 A3 E4 — open and calm
    this.padOscs = chord.map((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.value = 0.05 / chord.length + 0.008;
      osc.connect(g);
      g.connect(this.padFilter);
      osc.start();
      return osc;
    });

    // slow LFO breathing the filter
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    this.lfo.connect(lfoGain);
    lfoGain.connect(this.padFilter.frequency);
    this.lfo.start();

    // ---------- air: filtered noise, barely there ----------
    const noiseLen = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 900;
    noiseFilter.Q.value = 0.4;
    this.airGain = ctx.createGain();
    this.airGain.gain.value = 0.008;
    noise.connect(noiseFilter);
    noiseFilter.connect(this.airGain);
    this.airGain.connect(this.master);
    noise.start();
  }

  /** dayFactor 0..1, vitality 0..1 — shifts the pad's brightness. */
  setMood(dayFactor, vitality) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const target = 280 + dayFactor * 750 + vitality * 380;
    this.padFilter.frequency.setTargetAtTime(target, t, 2.5);
    this.airGain.gain.setTargetAtTime(0.005 + dayFactor * 0.006, t, 3);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.3);
  }

  _canPlay() {
    return this.ctx && !this.muted;
  }

  /** short soft pluck, pentatonic */
  _pluck(freq, dur = 0.5, vol = 0.14, type = 'sine') {
    if (!this._canPlay()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** placement chime — two rising notes */
  place() {
    const base = PENTA[(Math.random() * 4) | 0];
    this._pluck(base, 0.5, 0.11);
    setTimeout(() => this._pluck(base * 1.5, 0.7, 0.09), 90);
  }

  /** birth — a bright little trill */
  birth() {
    const i = (Math.random() * 4) | 0;
    this._pluck(PENTA[i + 2] * 2, 0.35, 0.07);
    setTimeout(() => this._pluck(PENTA[i + 4] * 2, 0.5, 0.06), 70);
  }

  /** a tender descending farewell */
  death() {
    const i = 2 + ((Math.random() * 3) | 0);
    this._pluck(PENTA[i], 0.9, 0.055, 'triangle');
    setTimeout(() => this._pluck(PENTA[i] * 0.75, 1.3, 0.045, 'triangle'), 220);
  }

  /** water plip — filtered noise + sine drop */
  plip() {
    if (!this._canPlay()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  /** tiny insect chirp */
  chirp() {
    this._pluck(PENTA[4 + ((Math.random() * 3) | 0)] * 2, 0.12, 0.03);
  }

  /** the hunt lands — a muted low thump */
  pounce() {
    if (!this._canPlay()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  /** long farewell chord for the elegy */
  elegy() {
    if (!this._canPlay()) return;
    [220, 261.63, 329.63].forEach((f, i) => {
      setTimeout(() => this._pluck(f, 3.2, 0.06, 'triangle'), i * 350);
    });
  }
}
