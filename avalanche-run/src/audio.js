// Procedural WebAudio: wind, carve scrape, avalanche rumble, one-shot cues.
// Everything is synthesized — no assets.

export class AudioEngine {
  constructor() {
    this.ctx = null;
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);

    // shared looping noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // pinkish noise: lowpassed white
      last = last * 0.94 + (Math.random() * 2 - 1) * 0.06;
      data[i] = last * 8;
    }

    this.wind = this.makeLoop({ type: "bandpass", freq: 500, q: 0.8 });
    this.carve = this.makeLoop({ type: "highpass", freq: 1800, q: 0.7 });
    this.rumble = this.makeLoop({ type: "lowpass", freq: 85, q: 0.9 });
  }

  makeLoop({ type, freq, q }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    return { filter, gain };
  }

  // continuous layers, values 0..1
  setLayers({ speed, carve, rumble }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.wind.gain.gain.setTargetAtTime(speed * 0.35, t, 0.1);
    this.wind.filter.frequency.setTargetAtTime(300 + speed * 900, t, 0.1);
    this.carve.gain.gain.setTargetAtTime(carve * 0.16, t, 0.05);
    this.rumble.gain.gain.setTargetAtTime(rumble * 0.9, t, 0.15);
  }

  blip(freq, dur, type = "triangle", vol = 0.2, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  noiseBurst(dur, filterFreq, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  jump() {
    this.noiseBurst(0.25, 1200, 0.25);
    this.blip(300, 0.25, "sine", 0.12, 520);
  }

  land(hard) {
    this.blip(75, 0.18, "sine", hard ? 0.4 : 0.22);
    this.noiseBurst(0.2, 700, hard ? 0.35 : 0.2);
  }

  trick() {
    this.blip(660, 0.12, "triangle", 0.22);
    setTimeout(() => this.blip(990, 0.2, "triangle", 0.22), 90);
  }

  crash() {
    this.noiseBurst(0.5, 400, 0.5);
    this.blip(120, 0.4, "sawtooth", 0.2, 45);
  }

  buried() {
    this.noiseBurst(1.6, 200, 0.8);
    this.blip(90, 1.4, "sine", 0.5, 30);
    this.setLayers({ speed: 0, carve: 0, rumble: 0 });
  }

  milestone() {
    this.blip(523, 0.1, "square", 0.08);
    setTimeout(() => this.blip(784, 0.18, "square", 0.08), 100);
  }
}
