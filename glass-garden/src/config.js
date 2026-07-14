// ============================================================
// Glass Garden — every tunable constant lives here.
// Units: world units (jar inner radius ~2), seconds, per-second rates.
// ============================================================

export const CFG = {
  // ---------- world geometry ----------
  jar: {
    innerRadius: 2.0,     // usable interior radius
    glassRadius: 2.18,    // outer glass radius
    height: 4.5,          // glass body height
    soilBaseY: 0.85,      // mean soil surface height
    walkRadius: 1.72,     // creatures / plants stay within this radius
  },
  pond: { x: -0.62, z: 0.56, r: 0.58, waterY: 0.665 },

  // ---------- day / night ----------
  dayLength: 120,         // seconds for a full cycle
  startPhase: 0.14,       // begin mid-morning

  // ---------- population caps ----------
  caps: {
    plants: 40,
    beetles: 30,
    mantises: 6,
    mushrooms: 20,
    detritus: 50,
    fireflies: 60,
  },

  // ---------- player tools ----------
  cooldowns: { seed: 4, beetle: 5, mantis: 15, spore: 5, droplet: 4 },
  dropletWater: 16,       // water added per droplet

  // ---------- simulation (per-second rates unless noted) ----------
  sim: {
    tick: 0.25,           // fixed sim step in seconds

    // resources
    nutrientsStart: 68,
    nutrientsMax: 120,
    waterStart: 62,
    waterMax: 100,
    evapDay: 0.055,       // water evaporation while sun is up
    evapNight: 0.02,

    // flora
    plantGrowTime: 45,        // seconds to full growth in ideal conditions
    plantNutrientCost: 0.07,  // nutrients/s while actively growing
    plantWaterCost: 0.035,    // water/s while actively growing
    plantUpkeepWater: 0.008,  // water/s for mature plants
    plantRegrow: 0.012,       // leaf biomass regrowth/s (mature, fed)
    seedChance: 0.022,        // chance/s a mature plant self-seeds
    seedMinNutrients: 28,
    plantDieBiomass: 0.04,    // plant dies if grown & stripped below this
    plantDetritus: 4,

    // herbivores (beetles)
    beetleEnergyStart: 62,
    beetleEnergyMax: 100,
    beetleDrain: 1.15,        // energy/s
    beetleSpeed: 0.42,
    beetleBiteEvery: 1.4,     // seconds between bites while feeding
    beetleBite: 0.075,        // leaf biomass per bite
    beetleBiteEnergy: 9,      // energy gained per bite
    beetleHungry: 78,         // seeks food below this energy
    beetleBreedEnergy: 80,
    beetleBreedChance: 0.02,  // chance/s when well-fed
    beetleBreedCost: 34,
    beetleLifespan: 200,      // seconds
    beetleDetritus: 3,

    // predator (mantis)
    mantisEnergyStart: 72,
    mantisEnergyMax: 100,
    mantisDrain: 0.72,
    mantisStalkSpeed: 0.22,
    mantisPounceSpeed: 3.6,
    mantisPounceRange: 0.62,
    mantisKillRange: 0.2,
    mantisMealEnergy: 42,
    mantisHungry: 86,
    mantisBreedEnergy: 90,
    mantisBreedChance: 0.007,
    mantisBreedCost: 45,
    mantisLifespan: 320,
    mantisDetritus: 8,

    // decomposers (mushrooms)
    mushroomEat: 0.4,         // detritus consumed/s
    mushroomYield: 0.34,      // nutrients released/s while eating
    mushroomReach: 0.95,      // radius to find detritus
    mushroomStarveTime: 26,   // seconds it can live without detritus
    mushroomLifespan: 110,
    mushroomGrowTime: 10,

    // detritus
    detritusSelfDecay: 0.012, // slow passive decay/s (returns a trickle)

    // ambience
    fireflyVitalityMin: 0.25,
  },

  // ---------- rendering ----------
  render: {
    maxPixelRatio: 2,
    bloomDay: 0.22,
    bloomNight: 0.55,
    bloomRadius: 0.7,
    bloomThreshold: 0.82,
    exposure: 1.12,
  },
};

export const STORAGE_KEY = 'glass-garden-best-v1';
