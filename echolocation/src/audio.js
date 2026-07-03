// Procedural WebAudio: everything is synthesized — no sound files.
// A feedback delay stands in for the cave itself.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.dripT = 2;
    this.beatT = 0;
    this.hunting = false;
    this.minDist = 99;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    // cave reverb: filtered feedback delay
    this.verb = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.27;
    const fb = ctx.createGain();
    fb.gain.value = 0.45;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    this.verb.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(this.master);

    // ambience: looped rumble + faint beating drone
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      v += (Math.random() * 2 - 1) * 0.02;
      v *= 0.998;
      data[i] = v * 4;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nlp = ctx.createBiquadFilter();
    nlp.type = 'lowpass';
    nlp.frequency.value = 150;
    const ng = ctx.createGain();
    ng.gain.value = 0.1;
    noise.connect(nlp).connect(ng).connect(this.master);
    noise.start();

    for (const [freq, gain] of [
      [46, 0.03],
      [69.3, 0.012],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.value = gain;
      o.connect(og).connect(this.master);
      o.start();
    }
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone({ type = 'sine', from, to = from, dur = 0.2, gain = 0.15, wet = 0.5, curve = 'exp', at = 0 }) {
    if (!this.ctx) return;
    const t0 = this.now() + at;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t0);
    if (to !== from) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
      else o.frequency.linearRampToValueAtTime(to, t0 + dur);
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    if (wet > 0) {
      const w = this.ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.verb);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noiseBurst({ dur = 0.15, gain = 0.1, freq = 800, q = 1, type = 'bandpass', wet = 0.4, at = 0 }) {
    if (!this.ctx) return;
    const t0 = this.now() + at;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g);
    g.connect(this.master);
    if (wet > 0) {
      const w = this.ctx.createGain();
      w.gain.value = wet;
      g.connect(w).connect(this.verb);
    }
    src.start(t0);
  }

  // ----- game sounds -----

  ping() {
    this.tone({ from: 1350, to: 420, dur: 0.24, gain: 0.16, wet: 0.9 });
    this.tone({ from: 2700, to: 840, dur: 0.12, gain: 0.05, wet: 0.9 });
  }

  shriek() {
    this.tone({ type: 'sawtooth', from: 320, to: 980, dur: 0.4, gain: 0.28, wet: 1, curve: 'lin' });
    this.noiseBurst({ dur: 0.5, gain: 0.3, freq: 1400, q: 2.5, wet: 1 });
  }

  stalkerPing(dist) {
    const v = Math.min(0.4, 0.5 / (1 + dist * 0.15));
    this.tone({ from: 2400, to: 880, dur: 0.13, gain: v, wet: 0.8 });
    this.tone({ from: 2400, to: 880, dur: 0.13, gain: v * 0.4, wet: 0.8, at: 0.17 });
  }

  growl(dist) {
    const v = Math.min(0.3, 0.35 / (1 + dist * 0.14));
    this.tone({ type: 'sawtooth', from: 44 + Math.random() * 10, to: 36, dur: 0.9, gain: v, wet: 0.6 });
  }

  skitter(dist) {
    const v = Math.min(0.12, 0.16 / (1 + dist * 0.12));
    for (let i = 0; i < 3; i++)
      this.noiseBurst({ dur: 0.03, gain: v, freq: 2600 + Math.random() * 800, q: 6, at: i * 0.05 });
  }

  step(running) {
    this.noiseBurst({
      dur: 0.09,
      gain: running ? 0.09 : 0.045,
      freq: running ? 320 : 240,
      q: 0.8,
      type: 'lowpass',
      wet: 0.5,
    });
  }

  mothChirp(dist) {
    const v = Math.min(0.08, 0.12 / (1 + dist * 0.2));
    this.tone({ from: 1500, to: 1900, dur: 0.09, gain: v, wet: 0.6 });
    this.tone({ from: 1900, to: 1600, dur: 0.07, gain: v * 0.7, wet: 0.6, at: 0.12 });
  }

  mothChime() {
    this.tone({ from: 880, dur: 0.7, gain: 0.1, wet: 0.8 });
    this.tone({ from: 1108, dur: 0.9, gain: 0.08, wet: 0.8, at: 0.08 });
  }

  gateOpen() {
    this.tone({ from: 70, to: 34, dur: 1.4, gain: 0.3, wet: 0.9 });
    this.tone({ from: 1180, dur: 1.1, gain: 0.06, wet: 1, at: 0.25 });
    this.tone({ from: 1480, dur: 1.3, gain: 0.05, wet: 1, at: 0.45 });
  }

  beacon(dist) {
    const v = Math.min(0.1, 0.16 / (1 + dist * 0.07));
    this.tone({ from: 520, to: 505, dur: 0.5, gain: v, wet: 1, curve: 'lin' });
  }

  death() {
    this.tone({ type: 'sawtooth', from: 220, to: 55, dur: 1.6, gain: 0.3, wet: 1 });
    this.tone({ type: 'sawtooth', from: 233, to: 58, dur: 1.6, gain: 0.2, wet: 1 });
    this.noiseBurst({ dur: 0.8, gain: 0.25, freq: 500, q: 1, wet: 1 });
  }

  win() {
    const notes = [261.6, 329.6, 392, 523.3, 587.3];
    notes.forEach((f, i) => this.tone({ from: f, dur: 2.4 - i * 0.2, gain: 0.07, wet: 0.9, at: i * 0.22 }));
  }

  updateHeartbeat(dt, hunting, minDist) {
    this.hunting = hunting;
    this.minDist = minDist;
    if (!this.ctx || !hunting) return;
    this.beatT -= dt;
    if (this.beatT <= 0) {
      const urgency = Math.max(0, 1 - minDist / 22);
      this.beatT = 1.15 - urgency * 0.55;
      const v = 0.1 + urgency * 0.2;
      this.tone({ from: 58, to: 40, dur: 0.14, gain: v, wet: 0.1 });
      this.tone({ from: 52, to: 38, dur: 0.12, gain: v * 0.7, wet: 0.1, at: 0.16 });
    }
  }

  updateDrips(dt) {
    if (!this.ctx) return;
    this.dripT -= dt;
    if (this.dripT <= 0) {
      this.dripT = 2 + Math.random() * 7;
      this.tone({
        from: 1800 + Math.random() * 900,
        to: 300,
        dur: 0.1,
        gain: 0.02 + Math.random() * 0.035,
        wet: 1,
      });
    }
  }
}
