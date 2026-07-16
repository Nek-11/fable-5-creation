// All gameplay + look tuning lives here.
export const CONFIG = {
  // --- layout (fractions of viewport) ---
  GROUND_FRAC: 0.8, // y of the ground line
  PLAYER_X_FRAC: 0.15, // archer stands here
  MAX_DPR: 2,
  PX: 4, // background pixel size (css px per fat pixel)

  // --- feel (non-negotiable checklist values) ---
  HITSTOP_KILL: 0.06, // s, on ordinary kills
  HITSTOP_BIG: 0.09, // s, on boss lashes / explosions
  SHAKE_KILL: 3.5, // px
  SHAKE_HURT: 6, // px (hard cap)
  SHAKE_MAX: 6,
  SLOWMO_UPGRADE: 0.15, // timescale while picking boons
  SLOWMO_BOSS_DEATH: 0.18,
  SLOWMO_SUPER: 0.3, // power-word beat
  EASE_K: 10, // generic exponential-smoothing stiffness

  // --- difficulty modes (EASY is the v1 tuning, verbatim) ---
  // boss: { interval: s between letter-arrows, speed: px/s, tags: floating words }
  DIFF_ORDER: ['easy', 'medium', 'hard', 'extreme', 'impossible'],
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
      boss: { interval: 3.4, speed: 300, tags: 2, sentences: 1 },
      cipher: false,
      caseSensitive: false,
      ambiguous: false,
      color: '#7ee8fa',
    },
    medium: {
      name: 'MEDIUM',
      desc: 'more of them, faster, wordier. bombers and flyers clock in early. the boss aims to kill.',
      scoreMult: 1.5,
      spawnMult: 1.4,
      speedMult: 1.15,
      tierUpChance: 0.5,
      twoWordChance: 0,
      bossEvery: 5,
      maxAlive: 18,
      waveCap: 32,
      unlocks: { runner: 2, flyer: 2, brute: 3, bomber: 3 },
      boss: { interval: 2.3, speed: 360, tags: 2, sentences: 2 },
      cipher: false,
      caseSensitive: false,
      ambiguous: false,
      color: '#ffc14d',
    },
    hard: {
      name: 'HARD',
      desc: 'a proper horde: two-word enemies everywhere, boss every 4 waves, and his arrows fly fast.',
      scoreMult: 2,
      spawnMult: 1.8,
      speedMult: 1.3,
      tierUpChance: 0.55,
      twoWordChance: 0.45,
      bossEvery: 4,
      maxAlive: 24,
      waveCap: 44,
      unlocks: { runner: 1, flyer: 2, brute: 2, bomber: 2 },
      boss: { interval: 1.7, speed: 420, tags: 3, sentences: 2 },
      cipher: false,
      caseSensitive: false,
      ambiguous: false,
      color: '#ff8c42',
    },
    extreme: {
      name: 'EXTREME',
      desc: 'cipher words — 0/O, 1/l/I, 5/S, 8/B, 2/Z — case-sensitive, typed exactly. at least the font is honest.',
      scoreMult: 3,
      spawnMult: 2.0,
      speedMult: 1.4,
      tierUpChance: 0.6,
      twoWordChance: 0.45,
      bossEvery: 4,
      maxAlive: 24,
      waveCap: 46,
      unlocks: { runner: 1, flyer: 2, brute: 2, bomber: 2 },
      boss: { interval: 1.5, speed: 460, tags: 3, sentences: 2 },
      cipher: true,
      caseSensitive: true,
      ambiguous: false,
      color: '#ff5c7a',
    },
    impossible: {
      name: 'IMPOSSIBLE',
      desc: 'extreme, except the font stops helping: 0 and O render identically. for masochists only.',
      scoreMult: 4,
      spawnMult: 2.0,
      speedMult: 1.4,
      tierUpChance: 0.6,
      twoWordChance: 0.45,
      bossEvery: 4,
      maxAlive: 24,
      waveCap: 46,
      unlocks: { runner: 1, flyer: 2, brute: 2, bomber: 2 },
      boss: { interval: 1.4, speed: 480, tags: 3, sentences: 2 },
      cipher: true,
      caseSensitive: true,
      ambiguous: true,
      color: '#c69bff',
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
    orb: { speed: 135, score: 50, tier: 0 }, // legacy boss projectile
    boss: { speed: 17, score: 1500, tier: 1 },
    runebearer: { speed: 42, score: 300, tier: 1 }, // power word carrier
    bosstag: { speed: 0, score: 0, tier: 0 }, // floating boss word
    larrow: { speed: 400, score: 25, tier: 0 }, // boss letter-arrow
  },
  SPEED_RAMP: 0.03, // +3% enemy speed per wave, capped
  SPEED_RAMP_CAP: 1.6,

  BOMBER_FUSE: 8.5, // s until remote detonation
  BOMBER_FUSE_MIN: 5.5,
  ATTACK_WINDUP: 0.38, // melee anticipation
  ATTACK_COOLDOWN: 2.3, // s between melee strikes
  BOSS_STOP_FRAC: 0.62, // boss halts here and starts the word-storm
  BOSS_TAG_INTERVAL: 1.1, // s between floating word spawns
  BOSS_LARROW_MAX: 3, // simultaneous letter-arrows (4 enraged)

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
    bosstag: '#ff9ad5',
    larrow: '#ff7a9a',
  },
};
