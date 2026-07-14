// All gameplay + look tuning lives here.
// DETERMINISM NOTE: everything the simulation reads must be constant.
// The sim runs on a fixed 60 Hz timestep; ghosts replay recorded per-tick
// input masks through the exact same movement code, so any change to these
// numbers mid-session would desync ghosts. They never change at runtime.

export const C = {
  // --- world grid ---
  TILE: 16,
  COLS: 20,
  ROWS: 12,

  // --- fixed timestep ---
  TICK: 1 / 60, // seconds per simulation tick
  MAX_CATCHUP: 5, // max sim steps per animation frame (tab-blur safety)

  // --- the loop ---
  LOOP_SECONDS: 20,
  LOOP_TICKS: 20 * 60,
  REWIND_TICKS: 48, // length of the rewind cinematic (0.8 s)
  DEATH_TICKS: 52, // red-flash freeze before the loop restarts

  // --- actors ---
  PLAYER_SPEED: 88, // px/s  (5.5 tiles/s)
  PLAYER_R: 5, // collision circle radius
  PICKUP_R: 9, // distance to grab a gem
  GUARD_SPEED: 31, // px/s (~1.9 tiles/s)
  GUARD_VIEW_DIST: 74, // flashlight cone reach (px)
  GUARD_VIEW_HALF: 0.52, // cone half-angle (rad)
  GUARD_SPOT_TICKS: 8, // grace: must stay in cone this many ticks

  // --- doors / plates ---
  DOOR_SPEED: 0.07, // progress per tick (fully opens in ~0.24 s)
  DOOR_SOLID_BELOW: 0.5, // door blocks movement below this progress
  PLATE_R: 8, // press radius around plate centre

  // --- input mask bits ---
  UP: 1,
  DOWN: 2,
  LEFT: 4,
  RIGHT: 8,
};

// Moody museum palette. Dark navy floors, warm loot, red lasers, cyan ghosts.
export const PAL = {
  floorA: '#151c30',
  floorB: '#111828',
  floorLine: '#0c1220',
  wallTop: '#3d4a73',
  wallFace: '#252e4e',
  wallDark: '#181f38',
  wallEdge: '#57689c',
  glass: '#7fd8e8',
  glassDim: '#3c6f86',
  steel: '#8a97b8',
  steelDark: '#525f80',
  warn: '#e8b23a',
  laser: '#ff3355',
  laserCore: '#ffd9e0',
  exit: '#3dff88',
  exitDark: '#0d5c31',
  gold: '#ffd166',
  goldHi: '#fff3c4',
  cyanGem: '#5ce8ff',
  magentaGem: '#ff7ad9',
  ghost: '#35e0ff',
  skin: '#e8b489',
  beanie: '#8c2f39',
  stripeA: '#dfe3ee',
  stripeB: '#23273a',
  guardCoat: '#2c4a8a',
  guardTrim: '#ffd166',
  visionFill: 'rgba(255, 224, 130, 0.16)',
  visionEdge: 'rgba(255, 224, 130, 0.34)',
  alarm: '#ff5040',
};

export const SAVE_KEYS = {
  unlocked: 'loopheist.unlocked',
  best: 'loopheist.best',
  muted: 'loopheist.muted',
};
