// Fully procedural WebAudio: a drifting ambient pad plus pentatonic chimes
// for every garden event. No samples, no files.

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17]; // minor pentatonic-ish, semitones above root
const ROOT = 220; // A3

function noteFreq(step, octave = 0) {
  return ROOT * Math.pow(2, (SCALE[step % SCALE.length] + 12 * octave) / 12);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);

      // gentle space so plucks breathe: feedback delay
      this.delay = this.ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.34;
      this.delayFb = this.ctx.createGain();
      this.delayFb.gain.value = 0.32;
      this.delayWet = this.ctx.createGain();
      this.delayWet.gain.value = 0.25;
      this.delay.connect(this.delayFb).connect(this.delay);
      this.delay.connect(this.delayWet).connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  startAmbient() {
    this.ensure();
    if (this.started) return;
    this.started = true;
    const ctx = this.ctx;

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    this.padGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 6);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 1.2;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    for (const [freq, detune] of [[ROOT / 4, 0], [ROOT / 4, 7], [ROOT / 2 * 1.498, -5]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
    }
    filter.connect(this.padGain).connect(this.master);
  }

  out(gainNode) {
    gainNode.connect(this.master);
    gainNode.connect(this.delay);
  }

  pluck(freq, vol = 0.2, type = 'triangle', dur = 1.4) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    for (const det of [0, 6]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    this.out(g);
  }

  noiseSweep({ from = 300, to = 2400, dur = 0.5, vol = 0.14, type = 'bandpass' } = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = 1.6;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    src.connect(f).connect(g);
    this.out(g);
    src.start(t);
  }

  // --- game events -------------------------------------------------------

  uiClick() { this.pluck(noteFreq(4, 1), 0.16, 'sine', 0.5); }

  plantSeed() {
    const s = Math.floor(Math.random() * 3);
    this.pluck(noteFreq(s, 0), 0.22, 'triangle', 1.1);
    this.noiseSweep({ from: 500, to: 180, dur: 0.25, vol: 0.06 });
  }

  bloom() {
    const s = Math.floor(Math.random() * 4);
    this.pluck(noteFreq(s, 1), 0.15, 'sine', 1.6);
    setTimeout(() => this.pluck(noteFreq(s + 2, 1), 0.12, 'sine', 1.8), 110);
  }

  sporeLaunch() { this.noiseSweep({ from: 700, to: 2600, dur: 0.3, vol: 0.05 }); }

  sporeLand() {
    const s = Math.floor(Math.random() * 5);
    this.pluck(noteFreq(s, 2), 0.08, 'sine', 0.9);
  }

  burst() {
    this.noiseSweep({ from: 180, to: 3800, dur: 0.8, vol: 0.22 });
    const s = Math.floor(Math.random() * 2);
    [0, 2, 4].forEach((step, i) =>
      setTimeout(() => this.pluck(noteFreq(s + step, 1), 0.16, 'sine', 2.0), i * 90));
  }

  rotSurge() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.20, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 2.2);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 2.0);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 240;
    o.connect(f).connect(g);
    this.out(g);
    o.start(t);
    o.stop(t + 2.3);
  }

  floraDeath() {
    this.pluck(noteFreq(1, -1), 0.10, 'triangle', 1.8);
    this.noiseSweep({ from: 900, to: 120, dur: 0.7, vol: 0.05 });
  }

  rotPurged() {
    this.noiseSweep({ from: 2400, to: 300, dur: 0.45, vol: 0.14, type: 'highpass' });
    this.pluck(noteFreq(3, 1), 0.12, 'sine', 1.0);
  }

  win() {
    const s = 0;
    [0, 2, 4, 5, 7].forEach((step, i) =>
      setTimeout(() => this.pluck(noteFreq(s + step, 1), 0.16, 'sine', 2.6), i * 160));
  }

  lose() {
    this.rotSurge();
    setTimeout(() => this.pluck(noteFreq(1, -1), 0.16, 'triangle', 3.0), 300);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.55, (this.ctx?.currentTime ?? 0) + 0.15);
    }
  }
}
