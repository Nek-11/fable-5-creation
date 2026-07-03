export const CONFIG = {
  // world scale
  CELL: 4, // corridor width in meters
  WALL_H: 5.2,
  EYE: 1.6,

  // player
  PLAYER_R: 0.42,
  WALK: 3.4,
  RUN: 5.7,
  STRIDE: 2.1, // meters between footsteps

  // echo
  PING_CD: 0.75,

  // shriek (stun)
  SHRIEK_RADIUS: 11,
  SHRIEK_STUN: 5.5,
  SHRIEK_MAX: 2,
  SHRIEK_REGEN: 24, // seconds per charge

  // presence: how "loud" you've been lately; scales creature hearing
  PRESENCE: { PING: 0.2, SHRIEK: 0.45, RUN: 0.12, DECAY: 0.05 },

  // noise event radii (meters, before presence multiplier)
  NOISE: { PING: 24, STEP_WALK: 3.5, STEP_RUN: 10, SHRIEK: 40 },

  // gate beacon ping interval once unlocked
  BEACON_INTERVAL: 5,

  LEVELS: [
    {
      name: 'i · the threshold',
      grid: 13,
      crawlers: 1,
      stalkers: 0,
      moths: 1,
      braid: 0.14,
      chambers: 2,
      flavor: 'the passage narrows. something below answers your echo.',
    },
    {
      name: 'ii · the warrens',
      grid: 17,
      crawlers: 2,
      stalkers: 1,
      moths: 2,
      braid: 0.12,
      chambers: 3,
      flavor: 'warm air rises from the deep. the things here sing back in red.',
    },
    {
      name: 'iii · the deep',
      grid: 21,
      crawlers: 3,
      stalkers: 2,
      moths: 3,
      braid: 0.1,
      chambers: 4,
      flavor: 'you can smell the morning somewhere above the stone.',
    },
  ],
};
