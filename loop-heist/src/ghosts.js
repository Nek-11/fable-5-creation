// Ghost = a past run, replayed one recorded input mask per fixed tick
// through the exact same stepActor() code as the live player. Because the
// sim is a fixed-timestep pure function, a ghost retraces its run exactly
// (as long as the world around it behaves the same — changing door timing
// CAN make a ghost bump into a door; that is part of the fiction).
//
// When its recording ends, a ghost holds its final position for the rest
// of every loop — still pressing plates, still CARRYING its loot. Parking
// a loot-carrying ghost inside the exit zone is the core heist technique:
// the job completes when every gem is in the getaway zone at once.
import { makeActor, stepActor } from './player.js';

export class Ghost {
  // rec: array of input masks (one per tick). id: spawn order, for tinting.
  constructor(rec, startX, startY, id) {
    this.rec = rec;
    this.id = id;
    this.a = makeActor(startX, startY);
    this.idx = 0;
    this.done = false;
  }

  // reset to the start of the loop (called every run)
  reset(startX, startY) {
    const a = this.a;
    a.x = startX;
    a.y = startY;
    a.dir = 0;
    a.animDist = 0;
    a.moving = false;
    a.carried.length = 0;
    a.onSwitch = -1;
    this.idx = 0;
    this.done = false;
  }

  // one fixed tick
  step(world) {
    if (this.done) {
      this.a.moving = false;
      return;
    }
    if (this.idx < this.rec.length) {
      stepActor(world, this.a, this.rec[this.idx]);
      this.idx++;
      world.tryPickup(this.a, false);
    }
    if (this.idx >= this.rec.length) {
      this.done = true;
      this.a.moving = false;
    }
  }
}
