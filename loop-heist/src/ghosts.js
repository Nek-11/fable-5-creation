// Ghost = a past run, replayed one recorded input mask per fixed tick
// through the exact same stepActor() code as the live player. Because the
// sim is a fixed-timestep pure function, a ghost retraces its run exactly
// (as long as the world around it behaves the same — changing door timing
// CAN make a ghost bump into a door; that is part of the fiction).
import { makeActor, stepActor } from './player.js';

export class Ghost {
  // rec: array of input masks (one per tick). id: spawn order, for tinting.
  constructor(rec, startX, startY, id) {
    this.rec = rec;
    this.id = id;
    this.a = makeActor(startX, startY);
    this.idx = 0;
    this.done = false;
    this.justDropped = false;
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
    this.justDropped = false;
  }

  // one fixed tick. When the recording runs out the ghost goes idle where
  // it stands — still pressing plates — and drops any loot it carried
  // (that dropped loot is the "ghost relay" mechanic).
  step(world) {
    this.justDropped = false;
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
      if (this.a.carried.length > 0) {
        world.dropCarried(this.a);
        this.justDropped = true;
      }
    }
  }
}
