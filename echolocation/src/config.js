export const CONFIG = {
  // world scale
  MAXY: 26, // swimmable ceiling
  PLAYER_R: 0.5,

  // swimming
  SWIM: 4.0,
  BURST: 7.8,
  STROKE_DIST: 3.0, // meters between audible strokes

  // echo
  PING_CD: 0.7,

  // shriek (stun)
  SHRIEK_RADIUS: 12,
  SHRIEK_STUN: 5.5,
  SHRIEK_MAX: 2,
  SHRIEK_REGEN: 24, // seconds per charge

  // presence: how "loud" you've been lately; scales creature hearing
  PRESENCE: { PING: 0.2, SHRIEK: 0.45, BURST: 0.11, DECAY: 0.05 },

  // noise event radii (meters, before presence multiplier)
  NOISE: { PING: 26, STROKE_SLOW: 4, STROKE_FAST: 11, SHRIEK: 42 },

  // gate beacon ping interval once unlocked
  BEACON_INTERVAL: 4,

  LEVELS: [
    {
      name: 'i · the kelp garden',
      radius: 40,
      lurkers: 1,
      wraiths: 0,
      fish: 2,
      kelp: 150,
      grass: 260,
      coral: 90,
      anemones: 34,
      pillars: 11,
      snow: 3000,
      flavor: 'the kelp fades behind you. something big just moved in the dark below.',
    },
    {
      name: 'ii · the black reef',
      radius: 48,
      lurkers: 2,
      wraiths: 1,
      fish: 3,
      kelp: 110,
      grass: 200,
      coral: 140,
      anemones: 44,
      pillars: 17,
      snow: 3400,
      flavor: 'the reef grows strange and sharp down here. red songs answer yours.',
    },
    {
      name: 'iii · the abyss mouth',
      radius: 54,
      lurkers: 2,
      wraiths: 2,
      fish: 4,
      kelp: 60,
      grass: 140,
      coral: 170,
      anemones: 56,
      pillars: 23,
      snow: 3800,
      flavor: 'above you, impossibly far, hangs a ghost of moonlight.',
    },
  ],
};
