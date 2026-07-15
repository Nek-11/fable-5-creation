// All gameplay + look tuning lives here.
export const CONFIG = {
  // --- layout (fractions of viewport) ---
  GROUND_FRAC: 0.8, // y of the ground line
  PLAYER_X_FRAC: 0.15, // archer stands here
  MAX_DPR: 2,
  PX: 4, // background pixel size (css px per fat pixel)

  // --- feel (non-negotiable checklist values) ---
  HITSTOP_KILL: 0.06, // s, on ordinary kills
  HITSTOP_BIG: 0.09, // s, on boss word hits / explosions
  SHAKE_KILL: 3.5, // px
  SHAKE_HURT: 6, // px (hard cap)
  SHAKE_MAX: 6,
  SLOWMO_UPGRADE: 0.15, // timescale while picking boons
  SLOWMO_BOSS_DEATH: 0.18,
  SLOWMO_SUPER: 0.3, // power-word beat
  EASE_K: 10, // generic exponential-smoothing stiffness

  // --- difficulty modes (EASY is the v1 tuning, verbatim) ---
  DIFF_ORDER: ['easy', 'medium', 'hard', 'extreme'],
  DIFFICULTIES: {
    easy: {
      name: 'EASY',
      desc: 'the classic hunt. words are words, and they are polite about it.',
      scoreMult: 1,
      spawnMult: 1, // wave size multiplier
      speedMult: 1, // enemy speed multiplier
      tierUpChance: 0, // chance a word is one tier longer
      twoWordChance: 0, // chance a normal grounded enemy carries two words
      bossEvery: 5,
      maxAlive: 16,
      waveCap: 26,
      unlocks: { runner: 2, flyer: 3, brute: 3, bomber: 4 },
      cipher: false,
      caseSensitive: false,
      color: '#7ee8fa',
    },
    medium: {
      name: 'MEDIUM',
      desc: 'more of them, faster, wordier. bombers and flyers clock in early.',
      scoreMult: 1.5,
      spawnMult: 1.4,
      speedMult: 1.15,
      tierUpChance: 0.5,
      twoWordChance: 0,
      bossEvery: 5,
      maxAlive: 18,
      waveCap: 32,
      unlocks: { runner: 2, flyer: 2, brute: 3, bomber: 3 },
      cipher: false,
      caseSensitive: false,
      color: '#ffc14d',
    },
    hard: {
      name: 'HARD',
      desc: 'a proper horde. two-word enemies are common. boss every 4 waves.',
      scoreMult: 2,
      spawnMult: 1.8,
      speedMult: 1.3,
      tierUpChance: 0.5,
      twoWordChance: 0.35,
      bossEvery: 4,
      maxAlive: 22,
      waveCap: 40,
      unlocks: { runner: 1, flyer: 2, brute: 2, bomber: 2 },
      cipher: false,
      caseSensitive: false,
      color: '#ff8c42',
    },
    extreme: {
      name: 'EXTREME',
      desc: 'hard pacing, but every word is a cipher: 0/O, 1/l/I, 5/S, 8/B, 2/Z — case-sensitive, typed exactly.',
      scoreMult: 3,
      spawnMult: 1.8,
      speedMult: 1.3,
      tierUpChance: 0.5,
      twoWordChance: 0.35,
      bossEvery: 4,
      maxAlive: 22,
      waveCap: 40,
      unlocks: { runner: 1, flyer: 2, brute: 2, bomber: 2 },
      cipher: true,
      caseSensitive: true,
      color: '#ff5c7a',
    },
  },

  // --- combo weapon evolution (tier == combo multiplier, 1-indexed) ---
  WEAPONS: [
    null,
    { id: 'bow', name: 'BOW & ARROW' },
    { id: 'dagger', name: 'TWIN DAGGERS' },
    { id: 'bolt', name: 'MAGIC BOLTS' },
    { id: 'blade', name: 'SPECTRAL BLADES' },
    { id: 'dragon', name: 'SPIRIT DRAGON' },
  ],

  // --- player ---
  START_HEARTS: 3,
  MAX_HEARTS: 5,
  INVULN_TIME: 1.1, // s of mercy after a hit
  ARROW_SPEED: 1350, // px/s (scaled by width/1280)
  ARROW_ARC: 130, // initial upward kick, px/s
  PLANE_SPEED: 250,

  // --- combo ---
  COMBO_STEP: 3, // flawless words per multiplier step
  MAX_MULT: 5,
  QUICKDRAW_WINDOW: 2.0, // s between word completions

  // --- enemies: base speed px/s (scaled by width/1280), score, word tiers ---
  // tier: 0 = 2-3 letters, 1 = 4-6, 2 = 7-9, 3 = 10+
  ENEMIES: {
    walker: { speed: 50, score: 100, tier: 1 },
    runner: { speed: 112, score: 150, tier: 0 },
    brute: { speed: 27, score: 250, tier: 1 }, // two words
    bomber: { speed: 55, score: 200, tier: 1 },
    flyer: { speed: 64, score: 175, tier: 1 },
    orb: { speed: 135, score: 50, tier: 0 }, // boss projectile
    boss: { speed: 17, score: 1500, tier: 1 },
    runebearer: { speed: 42, score: 300, tier: 1 }, // power word carrier
  },
  SPEED_RAMP: 0.03, // +3% enemy speed per wave, capped
  SPEED_RAMP_CAP: 1.6,

  BOMBER_FUSE: 8.5, // s until remote detonation
  BOMBER_FUSE_MIN: 5.5,
  ATTACK_WINDUP: 0.38, // melee anticipation
  ATTACK_COOLDOWN: 2.3, // s between melee strikes
  BOSS_STOP_FRAC: 0.62, // boss halts here and starts hurling orbs
  BOSS_ORB_INTERVAL: 4.5,
  BOSS_ORB_MAX: 2,

  // --- waves ---
  SPAWN_BASE_INTERVAL: 2.4,
  SPAWN_MIN_INTERVAL: 1.0,

  // --- pools / perf ---
  MAX_PARTICLES: 700,
  MAX_FLOATERS: 40,
  MAX_ARROWS: 40,
  MAX_PLANES: 8,
  MAX_RAGDOLLS: 22,
  MAX_EFFECTS: 40,

  // --- palette (dusk) ---
  COLORS: {
    ink: '#f5ecd7',
    gold: '#ffc14d',
    ember: '#ff8c42',
    bad: '#ff5c7a',
    tagBg: 'rgba(11, 5, 30, 0.88)',
    walker: '#e8e3ff',
    runner: '#7ee8fa',
    brute: '#ff8a5c',
    bomber: '#ffd166',
    flyer: '#c69bff',
    orb: '#ff9ad5',
    boss: '#ff5c7a',
    runebearer: '#ffdf70',
  },
};
