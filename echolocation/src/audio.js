// Procedural WebAudio: everything is synthesized — no sound files.
// A filtered feedback delay stands in for the open water; a lowpass on the
// master bus keeps everything muffled the way the deep is.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.dripT = 2;
    this.moanT = 12;
    this.beatT = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());

    // underwater muffle on everything
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 2600;
    muffle.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(muffle);

    // open-water reverb: filtered feedback delay
    this.verb = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.31;
    const fb = ctx.createGain();
    fb.gain.value = 0.48;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    this.verb.connect(delay);
    delay.connect(lp);
    lp.connect(fb);
    fb.connect(delay);
    lp.connect(this.master);

    // ambience: looped abyssal rumble + faint beating drone
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
    nlp.frequency.value = 130;
    const ng = ctx.createGain();
    ng.gain.value = 0.12;
    noise.connect(nlp).connect(ng).connect(this.master);
    noise.start();

    for (const [freq, gain] of [
      [42, 0.032],
      [63.5, 0.013],
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
    // a soft sonar bloom rather than a hard chirp
    this.tone({ from: 940, to: 310, dur: 0.32, gain: 0.15, wet: 1 });
    this.tone({ from: 1880, to: 720, dur: 0.16, gain: 0.045, wet: 1 });
  }

  shriek() {
    this.tone({ type: 'sawtooth', from: 300, to: 950, dur: 0.42, gain: 0.28, wet: 1, curve: 'lin' });
    this.noiseBurst({ dur: 0.5, gain: 0.3, freq: 1200, q: 2.5, wet: 1 });
  }

  demonPing(dist) {
    const v = Math.min(0.4, 0.5 / (1 + dist * 0.15));
    this.tone({ from: 2200, to: 780, dur: 0.14, gain: v, wet: 0.9 });
    this.tone({ from: 2200, to: 780, dur: 0.14, gain: v * 0.4, wet: 0.9, at: 0.18 });
  }

  growl(dist) {
    const v = Math.min(0.3, 0.35 / (1 + dist * 0.13));
    this.tone({ type: 'sawtooth', from: 40 + Math.random() * 12, to: 33, dur: 1.1, gain: v, wet: 0.7 });
  }

  jawSnap(dist) {
    const v = Math.min(0.14, 0.18 / (1 + dist * 0.12));
    this.noiseBurst({ dur: 0.04, gain: v, freq: 900, q: 5 });
    this.noiseBurst({ dur: 0.05, gain: v * 0.8, freq: 500, q: 4, at: 0.07 });
  }

  stroke(burst) {
    this.noiseBurst({
      dur: 0.22,
      gain: burst ? 0.08 : 0.035,
      freq: burst ? 620 : 420,
      q: 0.7,
      type: 'lowpass',
      wet: 0.5,
    });
  }

  fishChirp(dist) {
    const v = Math.min(0.08, 0.12 / (1 + dist * 0.18));
    this.tone({ from: 1450, to: 1850, dur: 0.09, gain: v, wet: 0.7 });
    this.tone({ from: 1850, to: 1550, dur: 0.07, gain: v * 0.7, wet: 0.7, at: 0.12 });
  }

  fishChime() {
    this.tone({ from: 880, dur: 0.7, gain: 0.1, wet: 0.9 });
    this.tone({ from: 1108, dur: 0.9, gain: 0.08, wet: 0.9, at: 0.08 });
  }

  gateOpen() {
    this.tone({ from: 66, to: 32, dur: 1.5, gain: 0.3, wet: 1 });
    this.tone({ from: 1180, dur: 1.1, gain: 0.06, wet: 1, at: 0.25 });
    this.tone({ from: 1480, dur: 1.3, gain: 0.05, wet: 1, at: 0.45 });
  }

  beacon(dist) {
    const v = Math.min(0.1, 0.16 / (1 + dist * 0.06));
    this.tone({ from: 520, to: 505, dur: 0.55, gain: v, wet: 1, curve: 'lin' });
  }

  death() {
    this.tone({ type: 'sawtooth', from: 220, to: 52, dur: 1.7, gain: 0.3, wet: 1 });
    this.tone({ type: 'sawtooth', from: 233, to: 55, dur: 1.7, gain: 0.2, wet: 1 });
    this.noiseBurst({ dur: 0.9, gain: 0.25, freq: 450, q: 1, wet: 1 });
  }

  win() {
    const notes = [261.6, 329.6, 392, 523.3, 587.3];
    notes.forEach((f, i) => this.tone({ from: f, dur: 2.6 - i * 0.2, gain: 0.07, wet: 1, at: i * 0.22 }));
  }

  updateHeartbeat(dt, hunting, minDist) {
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

  updateAmbient(dt) {
    if (!this.ctx) return;
    // sonar clicks and settling stone, far away
    this.dripT -= dt;
    if (this.dripT <= 0) {
      this.dripT = 3 + Math.random() * 8;
      this.tone({
        from: 1400 + Math.random() * 900,
        to: 260,
        dur: 0.12,
        gain: 0.02 + Math.random() * 0.03,
        wet: 1,
      });
    }
    // something enormous, singing to itself in the far dark
    this.moanT -= dt;
    if (this.moanT <= 0) {
      this.moanT = 22 + Math.random() * 26;
      const base = 72 + Math.random() * 26;
      this.tone({ from: base, to: base * 0.72, dur: 3.8, gain: 0.05, wet: 1, curve: 'lin' });
      this.tone({ from: base * 1.51, to: base, dur: 3.2, gain: 0.02, wet: 1, curve: 'lin', at: 0.6 });
    }
  }
}
