// Procedural WebAudio: wind that follows airspeed, rain wash, scissor
// snips, milestone plucks, and the crumple crash.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.wind = null;
    this.rain = null;
  }

  // Must be called from a user gesture.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // 2s of looped white noise feeds both wind and rain
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    this.wind = this.makeNoiseVoice("bandpass", 500, 0);
    this.rain = this.makeNoiseVoice("lowpass", 2600, 0);
  }

  makeNoiseVoice(filterType, freq, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
    return { filter, gain: g };
  }

  // speed01: 0..1 normalized airspeed
  setWind(speed01) {
    if (!this.wind) return;
    const t = this.ctx.currentTime;
    this.wind.gain.gain.setTargetAtTime(0.02 + speed01 * 0.22, t, 0.1);
    this.wind.filter.frequency.setTargetAtTime(350 + speed01 * 1400, t, 0.1);
  }

  setRain(intensity) {
    if (!this.rain) return;
    this.rain.gain.gain.setTargetAtTime(
      intensity * 0.16,
      this.ctx.currentTime,
      0.4,
    );
  }

  snip() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const dt of [0, 0.09]) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 3000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.28, t + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.06);
      src.connect(filter).connect(g).connect(this.master);
      src.start(t + dt);
      src.stop(t + dt + 0.08);
    }
  }

  milestone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [i, f] of [660, 880].entries()) {
      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.35);
      osc.connect(g).connect(this.master);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.4);
    }
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // crumple: fast decaying filtered noise
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.5);
    // low thump
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  quiet() {
    if (!this.ctx) return;
    this.setWind(0);
    this.setRain(0);
  }
}
