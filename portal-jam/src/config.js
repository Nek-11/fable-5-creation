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
  ballRadius: 0.15,
  restitution: 0.62,
  friction: 0.85,      // tangential velocity kept on bounce
  rimRestitution: 0.45,
  maxSpeed: 16.5,      // max launch speed
  minSpeed: 3.2,       // min launch speed
  restThreshold: 0.55, // below this speed the ball is "resting"
  restTime: 1.0,       // seconds at rest before auto-reset
};

export const HOOP = {
  rimRadius: 0.3,
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
