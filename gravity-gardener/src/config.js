// Central tuning knobs for Gravity Gardener.

export const CONFIG = {
  planet: {
    radius: 20,
    detail: 24,            // icosphere subdivision → ~5762 welded verts
    terrainAmp: 0.85,      // hill height
    terrainFreq: 0.14,     // hill scale (per world unit)
  },

  // The territory field: light (+1) vs rot (-1), a reaction-diffusion war.
  field: {
    tick: 0.12,            // seconds between simulation steps
    diffusion: 2.6,        // /s — how fast fronts creep
    growth: 0.32,          // /s — front sharpening
    decay: 0.55,           // /s — unsourced field fades (keeps bubbles local)
    litThreshold: 0.35,    // counts as "alive"
    rotThreshold: -0.35,   // counts as "rotten"
  },

  flora: {
    max: 300,
    injectRate: 2.9,       // /s of field within radius
    radius: 3.0,           // world-arc units of influence
    growTime: 2.6,         // seconds to mature
    sporeIntervalMin: 9.0,
    sporeIntervalMax: 15.0,
    sproutChance: 0.62,    // landed spores don't always take root
    crowdRadius: 2.6,      // min spacing between plants
    crowdMax: 5,           // neighbors within 3.2u before spores pause
    dieBelow: -0.38,       // field level that kills a plant
    dieGrace: 2.0,         // seconds of exposure before death
    radiance: 0.4,         // dps dealt to rot cores within reach
    radianceReach: 4.6,    // world-arc units — lets an encircling garden strangle a core
  },

  spore: {
    gravity: 14,
    poolSize: 220,
    maxAge: 9,
    vUp: [5.5, 8.0],
    vTan: [3.5, 6.5],
    longThrowChance: 0.22,
    longVTan: [8.5, 12.0],
  },

  rot: {
    initialCores: 4,
    maxCores: 64,
    coreSpacing: 4.0,      // min distance between cores — spread, don't stack
    spawnIntervalStart: 12,
    spawnIntervalMin: 5,
    rampTime: 240,         // seconds to reach min interval
    jumpChance: 0.28,      // offshoots sometimes leap to a random dark spot
    injectRate: 3.4,       // base /s (negative)
    injectRamp: 0.02,      // extra per second of core age
    radiusStart: 2.2,
    radiusMax: 6.0,
    radiusGrow: 0.10,      // u/s
    hpBase: 1.2,
    hpRamp: 0.035,         // hp per second of age, capped
    hpMax: 3.0,
    surgeEvery: 50,        // seconds between rot surges
  },

  player: {
    speed: 7.2,
    sprint: 11.0,
    height: 0.02,          // feet offset above terrain
    camDist: 7.0,
    camHeight: 3.4,
    seedMax: 6,
    seedStart: 4,
    seedRegen: 5.0,        // seconds per seed
    burstCooldown: 9,
    burstRadius: 8.5,
    burstBoost: 0.9,       // field pushed toward light
  },

  goal: {
    winLight: 0.70,
    loseRot: 0.62,
  },
};
