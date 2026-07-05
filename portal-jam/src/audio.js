// All-synth WebAudio: gym thumps, portal sweeps and a little victory brass.
// No samples, no files.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      // short slap-back so the gym feels like a room
      this.delay = this.ctx.createDelay(0.5);
      this.delay.delayTime.value = 0.16;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.22;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.18;
      this.delay.connect(fb).connect(this.delay);
      this.delay.connect(wet).connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _noise(dur) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, Math.max(1, (dur * ctx.sampleRate) | 0), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  _env(gainNode, t0, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  // ball leaves the hand
  shoot(power = 1) {
    this.ensure();
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this._noise(0.25);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1400 + power * 800, t + 0.18);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    this._env(g, t, 0.02, 0.14 + power * 0.1, 0.2);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
  }

  // ball hits floor / wall — intensity from impact speed
  bounce(intensity = 0.5) {
    this.ensure();
    const ctx = this.ctx, t = ctx.currentTime;
    const v = Math.min(1, intensity);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160 + v * 60, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = ctx.createGain();
    this._env(g, t, 0.004, 0.16 + v * 0.3, 0.16);
    o.connect(g).connect(this.master);
    g.connect(this.delay);
    o.start(t); o.stop(t + 0.3);

    const n = this._noise(0.05);
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 900;
    const ng = ctx.createGain();
    this._env(ng, t, 0.002, 0.08 * v + 0.02, 0.05);
    n.connect(nf).connect(ng).connect(this.master);
    n.start(t);
  }

  rim() {
    this.ensure();
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [freq, amp] of [[1180, 0.12], [1770, 0.07], [2620, 0.04]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      this._env(g, t, 0.002, amp, 0.35);
      o.connect(g).connect(this.master);
      g.connect(this.delay);
      o.start(t); o.stop(t + 0.5);
    }
  }

  board() {
    this.ensure();
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(310, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.07);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    this._env(g, t, 0.003, 0.16, 0.12);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.2);
  }

  place(isA) {
    this.ensure();
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const base = isA ? 620 : 470;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.09);
    const g = ctx.createGain();
    this._env(g, t, 0.005, 0.14, 0.18);
    o.connect(g).connect(this.master);
    g.connect(this.delay);
    o.start(t); o.stop(t + 0.3);
  }

  teleport() {
    this.ensure();
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.14);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.14);
    f.Q.value = 3.5;
    const g = ctx.createGain();
    this._env(g, t, 0.01, 0.13, 0.16);
    o.connect(f).connect(g).connect(this.master);
    g.connect(this.delay);
    o.start(t); o.stop(t + 0.3);
  }

  score(swish = false) {
    this.ensure();
    const ctx = this.ctx, t = ctx.currentTime;
    // net swoosh
    const n = this._noise(0.3);
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 2400;
    const ng = ctx.createGain();
    this._env(ng, t, 0.02, swish ? 0.2 : 0.1, 0.24);
    n.connect(nf).connect(ng).connect(this.master);
    n.start(t);
    // little fanfare
    const notes = swish ? [523, 659, 784, 1047] : [523, 659, 784];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      const t0 = t + 0.06 + i * 0.085;
      this._env(g, t0, 0.008, 0.16, 0.34);
      o.connect(g).connect(this.master);
      g.connect(this.delay);
      o.start(t0); o.stop(t0 + 0.5);
    });
  }

  click() {
    this.ensure();
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 880;
    const g = ctx.createGain();
    this._env(g, t, 0.002, 0.08, 0.07);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.1);
  }
}
