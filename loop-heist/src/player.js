// Shared actor simulation. THE core determinism contract of the game:
// stepActor(world, actor, mask) is a pure function of (world state, actor
// state, input mask) on a fixed 60 Hz tick. The live player and every ghost
// replay run through this exact code, so a recorded input stream always
// reproduces the same path. No Math.random(), no wall-clock time in here.
import { C } from './config.js';

export function makeActor(x, y) {
  return {
    x,
    y,
    r: C.PLAYER_R,
    dir: 0, // 0 down, 1 up, 2 left, 3 right (sprite row)
    animDist: 0, // distance walked, drives the 3-frame walk cycle
    moving: false,
    carried: [], // gem objects currently floating over this actor's head
    onSwitch: -1, // switch index the actor is currently standing on (-1 none)
    throwHeld: false, // edge detector for the THROW bit
  };
}

// One full actor tick: move, pick up loot, maybe throw. The player and
// every ghost replay run through THIS function with a recorded mask, so
// throws re-happen at the exact same tick in every loop.
export function actActor(world, a, mask, isPlayer) {
  stepActor(world, a, mask);
  world.tryPickup(a, isPlayer);
  const wantThrow = (mask & C.THROW) !== 0;
  if (wantThrow && !a.throwHeld && a.carried.length > 0) world.throwGem(a, isPlayer);
  a.throwHeld = wantThrow;
}

const DIAG = 0.7071067811865476;

export function stepActor(world, a, mask) {
  let dx = ((mask & C.RIGHT) ? 1 : 0) - ((mask & C.LEFT) ? 1 : 0);
  let dy = ((mask & C.DOWN) ? 1 : 0) - ((mask & C.UP) ? 1 : 0);
  a.moving = dx !== 0 || dy !== 0;
  if (!a.moving) return;

  let nx = dx, ny = dy;
  if (dx !== 0 && dy !== 0) {
    nx *= DIAG;
    ny *= DIAG;
  }
  const step = C.PLAYER_SPEED * C.TICK;

  a.x += nx * step;
  collideAxis(world, a, dx, 0);
  a.y += ny * step;
  collideAxis(world, a, 0, dy);

  // facing: horizontal wins for the sprite when moving diagonally
  if (dx < 0) a.dir = 2;
  else if (dx > 0) a.dir = 3;
  else if (dy < 0) a.dir = 1;
  else if (dy > 0) a.dir = 0;

  a.animDist += step;
}

// Circle-vs-tile resolution along one axis, with a small corner-assist:
// if only a sliver of the circle clips a tile corner (< 3 px on the
// perpendicular axis), nudge around it instead of stopping dead.
function collideAxis(world, a, mx, my) {
  const t = C.TILE;
  const r = a.r;
  const minTx = Math.floor((a.x - r) / t);
  const maxTx = Math.floor((a.x + r) / t);
  const minTy = Math.floor((a.y - r) / t);
  const maxTy = Math.floor((a.y + r) / t);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!world.isSolid(tx, ty)) continue;
      // sokoban push: walking into a crate shoves it one tile along the
      // movement axis (if the tile behind it is free), then keeps walking
      if (world.crateAt(tx, ty)) {
        const pdx = mx !== 0 ? (mx > 0 ? 1 : -1) : 0;
        const pdy = my !== 0 ? (my > 0 ? 1 : -1) : 0;
        if ((pdx || pdy) && world.tryPushCrate(tx, ty, pdx, pdy)) continue;
      }
      const left = tx * t;
      const top = ty * t;
      // closest point on the tile to the circle centre
      const cx = a.x < left ? left : a.x > left + t ? left + t : a.x;
      const cy = a.y < top ? top : a.y > top + t ? top + t : a.y;
      const ddx = a.x - cx;
      const ddy = a.y - cy;
      if (ddx * ddx + ddy * ddy >= r * r) continue;

      if (mx !== 0) {
        // corner assist: barely clipping vertically -> slide around
        const overV = r - Math.abs(ddy);
        if (ddy !== 0 && overV > 0 && overV < 3 && canNudge(world, a, 0, ddy > 0 ? 1 : -1)) {
          a.y += (ddy > 0 ? 1 : -1) * Math.min(overV, 1);
        } else {
          a.x = mx > 0 ? left - r : left + t + r;
        }
      } else if (my !== 0) {
        const overH = r - Math.abs(ddx);
        if (ddx !== 0 && overH > 0 && overH < 3 && canNudge(world, a, ddx > 0 ? 1 : -1, 0)) {
          a.x += (ddx > 0 ? 1 : -1) * Math.min(overH, 1);
        } else {
          a.y = my > 0 ? top - r : top + t + r;
        }
      }
    }
  }
}

function canNudge(world, a, sx, sy) {
  const t = C.TILE;
  const x = a.x + sx * (a.r + 1);
  const y = a.y + sy * (a.r + 1);
  return !world.isSolid(Math.floor(x / t), Math.floor(y / t));
}

// walk-cycle frame from distance walked: 0 idle, then 1,0,2,0 loop
export function actorFrame(a) {
  if (!a.moving) return 0;
  const phase = Math.floor(a.animDist / 5) % 4;
  return phase === 1 ? 1 : phase === 3 ? 2 : 0;
}
