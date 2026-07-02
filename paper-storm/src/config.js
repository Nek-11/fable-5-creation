export const CONFIG = {
  // flight model
  CRUISE_SPEED: 16,
  STALL_SPEED: 8,
  MAX_SPEED: 46,
  MIN_SPEED: 3,
  GRAVITY_GAIN: 24, // how strongly diving converts to speed
  SPEED_DAMP: 0.25, // pull toward cruise speed
  PITCH_RATE: 1.6,
  PITCH_MIN: -1.15, // full dive
  PITCH_MAX: 0.8, // full climb
  PITCH_TRIM: -0.05, // natural glide attitude
  PITCH_RETURN: 0.55,
  ROLL_RATE: 2.6,
  ROLL_MAX: 1.05,
  ROLL_CENTER: 2.2,
  TURN_FACTOR: 1.15,
  SINK_BASE: 1.15,
  SINK_WET: 5.5, // extra sink at full soak
  STALL_NOSE_DROP: 0.5,

  // wetness
  RAIN_SOAK_RATE: 0.085,
  DRY_RATE: 0.04,
  DRY_SPEED_BONUS: 0.0015,

  // world
  CHUNK_SIZE: 90,
  CHUNK_RADIUS: 2, // 5x5 grid of live chunks
  GROUND_Y: 0,
  CRASH_ALTITUDE: 0.7,
  START_POS: { x: 0, y: 58, z: -4 },
  START_SPEED: 16,

  // updrafts
  VENT_RADIUS: 7,
  VENT_LIFT: 15,
  VENT_HEIGHT: 46,

  // weather (seconds)
  CLEAR_MIN: 24,
  CLEAR_VAR: 18,
  WARN_TIME: 4.5,
  STORM_MIN: 13,
  STORM_VAR: 10,

  // birds
  BIRD_GRACE: 22, // seconds before first bird
  BIRD_INTERVAL_MIN: 13,
  BIRD_INTERVAL_VAR: 10,
  BIRD_STAMINA: 11,
  BIRD_KILL_DIST: 1.7,

  // rendering
  FOG_NEAR: 70,
  FOG_FAR: 430,
  SKY_CLEAR: 0xb8d4e3,
  SKY_STORM: 0x7d8894,
};
