// All gameplay + look tuning lives here.
export const CONFIG = {
  // --- world ---
  SLOPE: 0.55, // vertical drop per meter of forward travel
  TERRAIN_WIDTH: 260,
  PLAY_HALF: 96, // |x| where the valley walls start rising hard
  CHUNK_LEN: 150,
  CHUNKS: 7,
  CHUNK_SEGS_X: 78,
  CHUNK_SEGS_Z: 46,
  WALL_HEIGHT: 70,

  FOG_COLOR: 0xdce9f5,
  FOG_NEAR: 60,
  FOG_FAR: 470,

  // --- player physics (arcade) ---
  START_SPEED: 16,
  MAX_SPEED: 58,
  TUCK_BONUS: 9, // extra top speed while tucking
  GRAVITY: 26,
  ACCEL: 17, // downhill pull along the fall line
  DRAG: 0.0042, // quadratic drag
  CARVE_DRAG: 4.2, // extra drag while steering hard
  STEER_RATE: 2.1, // rad/s heading change at full input
  MAX_HEADING: 0.8, // rad away from the fall line
  JUMP_VY: 9.5,
  SPIN_RATE: 5.2, // rad/s while airborne
  TUMBLE_TIME: 1.35,
  TUMBLE_SPEED_KEEP: 0.32,
  INVULN_TIME: 1.6,

  // --- avalanche ---
  AV_START_GAP: 70,
  AV_BASE_SPEED: 22.5,
  AV_RAMP: 0.0016, // extra m/s per meter travelled
  AV_MAX_GAP: 150,
  AV_CAUGHT_GAP: 3,
  AV_PANIC_GAP: 32, // roar + shake + whiteout below this

  // --- obstacles ---
  TREES_MIN: 22,
  TREES_MAX: 46,
  TREE_RAMP: 380, // +1 tree per chunk every N meters
  ROCKS_PER_CHUNK: 9,

  // --- camera ---
  CAM_BACK: 7.2,
  CAM_UP: 3.4,
  CAM_FOV: 62,
  CAM_FOV_FAST: 76,
};
