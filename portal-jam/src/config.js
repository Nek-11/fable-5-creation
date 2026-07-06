export const COLORS = {
  ink: 0x08090e,
  fog: 0x0a0c13,
  wood: 0xb97a3f,
  woodDark: 0x8a5527,
  line: 0xe8dcc8,
  panel: 0xdfe6ea,
  panelEdge: 0x45f2ff,
  wall: 0x1c202b,
  glass: 0x7fd8e8,
  cyan: 0x45f2ff,
  magenta: 0xff3ea5,
  ball: 0xff8c3b,
  ballSeam: 0x2a1508,
  rim: 0xff5a2a,
  gold: 0xffd166,
  net: 0xf3ede2,
};

export const PHYS = {
  gravity: 16,
  dt: 1 / 120,
  ballRadius: 0.14,
  restitution: 0.62,   // fallback for untyped colliders
  friction: 0.92,      // tangential velocity kept on bounce
  rimRestitution: 0.5,
  restThreshold: 0.85, // below this speed the ball is "resting"
  restTime: 0.9,       // seconds at rest before auto-reset
};

// per-surface bounciness (a basketball on hardwood is lively)
export const BOUNCE = {
  floor: 0.78,
  wall: 0.6,
  glass: 0.66,
  panel: 0.6,
  board: 0.68,
  spinner: 0.8,
};

// slingshot: pull the ball back on the court plane, it flies the other way.
// power comes from pull distance; hard throws fly flatter, soft tosses arc
// higher — like a real throw.
export const SLING = {
  maxPull: 2.4,        // metres of pull for full power
  minPull: 0.14,       // below this, the shot is cancelled
  minSpeed: 5,
  maxSpeed: 16.5,
  thetaSoft: 54,       // launch angle (deg) for the gentlest toss
  thetaHard: 40,       // launch angle (deg) at full power
};

export const HOOP = {
  rimRadius: 0.32,
  rimTube: 0.022,
  rimHeight: 3.05,
  boardW: 1.5,
  boardH: 1.05,
  boardT: 0.06,
  // rim center sits this far in front of the backboard face
  rimOffset: 0.36,
};

export const PORTAL = {
  radius: 0.62,
  surfaceGap: 0.015, // visual offset from host surface
};
