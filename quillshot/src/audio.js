// Procedural WebAudio: every sound is synthesized — no assets.
// Pattern borrowed from avalanche-run: one master gain, a shared pinkish
// noise buffer, tiny one-shot helpers composed into named cues.

export class AudioEngine {
  constructor() {
    this.ctx = null;
  }

  // Must be called from a user gesture.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    // shared looping noise buffer (pinkish: lowpassed white)
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = last * 0.94 + (Math.random() * 2 - 1) * 0.06;
      data[i] = last * 8;
    }

    // faint dusk wind bed
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 380;
    f.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.028;
    src.connect(f).connect(this.windGain).connect(this.master);
    src.start();
  }

  blip(freq, dur, type = 'triangle', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur, filterFreq, vol, type = 'bandpass', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // --- typing ---

  // rising tick per correct letter; progress 0..1 through the word
  tick(progress) {
    const f = 520 * Math.pow(2, progress * 0.6);
    this.blip(f, 0.06, 'triangle', 0.13);
  }

  // target acquired
  lock() {
    this.blip(340, 0.07, 'square', 0.06, 420);
  }

  // bowstring release: pluck + snap + air
  loose() {
    this.blip(190, 0.16, 'sawtooth', 0.16, 70);
    this.blip(1200, 0.05, 'square', 0.05);
    this.noiseBurst(0.14, 2600, 0.16, 'highpass');
  }

  // arrow lands: pitch-varied thunk
  hit() {
    const m = 0.88 + Math.random() * 0.28;
    this.blip(120 * m, 0.14, 'sine', 0.34, 48 * m);
    this.noiseBurst(0.1, 900 * m, 0.22);
  }

  // paper airplane: comedic fwip + sad whiff
  fumble() {
    this.noiseBurst(0.12, 3200, 0.12, 'highpass');
    this.blip(330, 0.28, 'sine', 0.12, 165);
    this.blip(247, 0.3, 'sine', 0.08, 123, 0.12);
  }

  planeBounce() {
    this.blip(500, 0.08, 'triangle', 0.08, 300);
  }

  // enemy melee windup + strike
  windup() {
    this.blip(140, 0.25, 'sawtooth', 0.07, 260);
  }

  hurt() {
    this.blip(160, 0.3, 'sawtooth', 0.28, 55);
    this.noiseBurst(0.25, 500, 0.3, 'lowpass');
  }

  explosion() {
    this.noiseBurst(0.55, 320, 0.5, 'lowpass');
    this.blip(70, 0.5, 'sine', 0.4, 28);
  }

  fuseBeep(urgent) {
    this.blip(urgent ? 1180 : 880, 0.05, 'square', 0.05);
  }

  ignite() {
    this.noiseBurst(0.3, 1500, 0.1, 'highpass');
  }

  // --- meta ---

  comboUp(mult) {
    const base = 392 * Math.pow(1.122, mult); // rises with multiplier
    this.blip(base, 0.09, 'square', 0.08);
    this.blip(base * 1.5, 0.14, 'square', 0.08, null, 0.07);
  }

  comboBreak() {
    this.blip(311, 0.12, 'square', 0.09);
    this.blip(208, 0.24, 'square', 0.09, 104, 0.1);
  }

  waveStart() {
    this.blip(262, 0.12, 'square', 0.1);
    this.blip(330, 0.12, 'square', 0.1, null, 0.11);
    this.blip(392, 0.22, 'square', 0.12, null, 0.22);
  }

  bossRoar() {
    this.blip(65, 0.9, 'sawtooth', 0.3, 42);
    this.noiseBurst(0.8, 200, 0.35, 'lowpass');
    this.blip(98, 0.7, 'square', 0.1, 60, 0.15);
  }

  bossDown() {
    this.explosion();
    this.blip(523, 0.15, 'square', 0.12, null, 0.25);
    this.blip(659, 0.15, 'square', 0.12, null, 0.4);
    this.blip(784, 0.4, 'square', 0.14, null, 0.55);
  }

  upgradeShow() {
    this.blip(660, 0.1, 'triangle', 0.09);
    this.blip(880, 0.18, 'triangle', 0.09, null, 0.09);
  }

  upgradePick() {
    this.blip(523, 0.09, 'square', 0.1);
    this.blip(659, 0.09, 'square', 0.1, null, 0.08);
    this.blip(1047, 0.2, 'square', 0.1, null, 0.16);
  }

  heart() {
    this.blip(784, 0.1, 'sine', 0.14);
    this.blip(1175, 0.25, 'sine', 0.14, null, 0.1);
  }

  gameOver() {
    this.blip(392, 0.25, 'square', 0.12);
    this.blip(311, 0.25, 'square', 0.12, null, 0.24);
    this.blip(233, 0.6, 'square', 0.14, 116, 0.48);
    this.noiseBurst(1.0, 250, 0.25, 'lowpass', 0.4);
  }

  // --- weapon evolution ---

  // fire cue per weapon kind
  fire(kind) {
    switch (kind) {
      case 'dagger':
        this.noiseBurst(0.08, 4200, 0.14, 'highpass');
        this.noiseBurst(0.08, 3600, 0.12, 'highpass', 0.05);
        break;
      case 'bolt':
        this.blip(520, 0.22, 'sine', 0.12, 1040);
        this.blip(784, 0.16, 'triangle', 0.07, 1568, 0.04);
        break;
      case 'blade':
        this.noiseBurst(0.18, 2400, 0.18, 'bandpass');
        this.blip(880, 0.14, 'sine', 0.06, 1760);
        break;
      case 'dragon':
        this.blip(85, 0.6, 'sawtooth', 0.26, 48);
        this.noiseBurst(0.5, 300, 0.28, 'lowpass');
        this.blip(170, 0.4, 'square', 0.08, 95, 0.08);
        break;
      default:
        this.loose();
    }
  }

  // impact cue per weapon kind
  impact(kind) {
    const m = 0.88 + Math.random() * 0.28;
    switch (kind) {
      case 'dagger':
        this.blip(1900 * m, 0.12, 'triangle', 0.16, 950 * m);
        this.noiseBurst(0.06, 5000, 0.1, 'highpass');
        break;
      case 'bolt':
        this.blip(660 * m, 0.12, 'square', 0.14, 165 * m);
        this.noiseBurst(0.1, 2000 * m, 0.12);
        break;
      case 'blade':
        this.noiseBurst(0.14, 2800 * m, 0.2, 'bandpass');
        this.blip(300 * m, 0.1, 'sine', 0.14, 90);
        break;
      case 'dragon':
        this.blip(95 * m, 0.28, 'sine', 0.38, 40 * m);
        this.noiseBurst(0.3, 500 * m, 0.3, 'lowpass');
        break;
      default:
        this.hit();
    }
  }

  // tier change jingle (up: rising, down: falling)
  transform(tier, up) {
    if (up) {
      const base = 330 * Math.pow(1.19, tier);
      this.blip(base, 0.09, 'square', 0.1);
      this.blip(base * 1.26, 0.09, 'square', 0.1, null, 0.07);
      this.blip(base * 1.5, 0.2, 'square', 0.12, null, 0.14);
      this.noiseBurst(0.25, 3000, 0.08, 'highpass', 0.14);
      if (tier >= 5) this.blip(66, 0.9, 'sawtooth', 0.22, 40, 0.1); // dragon groan
    } else {
      this.blip(392, 0.1, 'square', 0.08);
      this.blip(262, 0.22, 'square', 0.09, 200, 0.09);
    }
  }

  // --- boss fight ---

  // letter-arrow shot out of the sky: a crisp zap
  intercept() {
    this.blip(1760, 0.06, 'square', 0.1, 2637);
    this.noiseBurst(0.06, 5200, 0.1, 'highpass');
  }

  // the demon looses a letter-arrow
  bossArrow() {
    this.noiseBurst(0.16, 1800, 0.14, 'bandpass');
    this.blip(220, 0.18, 'sawtooth', 0.08, 110);
  }

  // --- power words ---

  runeSpawn() {
    this.blip(1568, 0.12, 'sine', 0.06);
    this.blip(2093, 0.25, 'sine', 0.05, null, 0.1);
  }

  superLightning() {
    for (let i = 0; i < 4; i++) {
      this.noiseBurst(0.09, 5200 - i * 700, 0.22, 'highpass', i * 0.07);
      this.blip(2400 - i * 350, 0.08, 'sawtooth', 0.1, 400, i * 0.07);
    }
    this.blip(60, 0.5, 'sine', 0.3, 30, 0.05);
  }

  superFireRain() {
    this.noiseBurst(1.8, 260, 0.3, 'lowpass');
    this.blip(120, 1.2, 'sawtooth', 0.1, 55);
    for (let i = 0; i < 5; i++) {
      this.noiseBurst(0.2, 900 + Math.random() * 800, 0.16, 'bandpass', 0.25 + i * 0.32);
    }
  }

  superWindBlade() {
    this.noiseBurst(0.7, 1600, 0.3, 'bandpass');
    this.blip(440, 0.5, 'sine', 0.1, 1760);
    this.blip(110, 0.4, 'sine', 0.2, 55, 0.1);
  }
}
