// ============================================================
// sim.js — agent-based ecosystem, fixed ticks decoupled from render.
// Everything here is pure state; visuals read from it each frame.
// ============================================================
import { CFG } from './config.js';
import { clampToJar, distToPond, isInPond, randomSoilPoint } from './terrain.js';
import { clamp, lerp, noise1, rand, smoothstep } from './noise.js';

const S = CFG.sim;
const CAPS = CFG.caps;

export const SPECIES = [
  { name: 'fern',    leafCount: 9,  height: 0.95, growMul: 1.0 },
  { name: 'sprout',  leafCount: 6,  height: 0.6,  growMul: 1.25 },
  { name: 'vine',    leafCount: 12, height: 1.45, growMul: 0.8 },
];

let _id = 1;
const nid = () => _id++;

export class Sim {
  /** @param onEvent (type, payload) => void */
  constructor(onEvent) {
    this.onEvent = onEvent || (() => {});
    this.reset();
  }

  reset() {
    this.time = 0;
    this._acc = 0;
    this.light = 1;          // set from the day cycle each frame
    this.nutrients = S.nutrientsStart;
    this.water = S.waterStart;
    this.plants = [];
    this.beetles = [];
    this.mantises = [];
    this.mushrooms = [];
    this.detritus = [];
    this.vitality = 0.4;
    this.alive = true;
    this.deathCause = '';
    this.giftsGiven = 0;
    this._warnAt = {};
    this._stats = { plantsGrazedDead: 0 };

    // --- the jar begins with a small spark of life ---
    const p1 = randomSoilPoint(1.1);
    this._addPlant(p1.x, p1.z, 0, 0.55);
    const p2 = randomSoilPoint(1.3);
    this._addPlant(p2.x, p2.z, 1, 0.7);
    const p3 = randomSoilPoint(1.3);
    this._addPlant(p3.x, p3.z, 2, 0.35);
    for (let i = 0; i < 2; i++) {
      const b = randomSoilPoint(1.4);
      this._addBeetle(b.x, b.z, S.beetleEnergyStart);
    }
    const m = randomSoilPoint(1.2);
    this._addMushroom(m.x, m.z, 0.8);
    const d = randomSoilPoint(1.4);
    this._addDetritus(d.x, d.z, 3.5);
  }

  emit(type, payload) { this.onEvent(type, payload || {}); }

  get counts() {
    return {
      plants: this.plants.length,
      beetles: this.beetles.length,
      mantises: this.mantises.length,
      mushrooms: this.mushrooms.length,
    };
  }

  // ------------------------------------------------------------
  // entity factories
  // ------------------------------------------------------------
  _addPlant(x, z, species, growth = 0.02) {
    const def = SPECIES[species];
    const plant = {
      id: nid(), kind: 'plant', species, x, z,
      growth, leaves: new Array(def.leafCount).fill(1),
      thirst: 0, wobble: Math.random() * Math.PI * 2,
    };
    this.plants.push(plant);
    return plant;
  }

  _addBeetle(x, z, energy) {
    const b = {
      id: nid(), kind: 'beetle', x, z,
      heading: Math.random() * Math.PI * 2,
      energy, age: 0, seed: Math.random() * 100,
      state: 'wander', targetId: 0, biteTimer: 0,
      born: this.time,
    };
    this.beetles.push(b);
    return b;
  }

  _addMantis(x, z, energy) {
    const m = {
      id: nid(), kind: 'mantis', x, z,
      heading: Math.random() * Math.PI * 2,
      energy, age: 0, seed: Math.random() * 100,
      state: 'idle', targetId: 0, pounceT: 0, restT: 0,
      vx: 0, vz: 0, feastT: 0,
    };
    this.mantises.push(m);
    return m;
  }

  _addMushroom(x, z, growth = 0) {
    const m = {
      id: nid(), kind: 'mushroom', x, z,
      growth, age: 0, starve: 0, seed: Math.random() * 100, feeding: false,
    };
    this.mushrooms.push(m);
    return m;
  }

  _addDetritus(x, z, amount) {
    // merge with a close patch if the cap is hit or one is adjacent
    for (const d of this.detritus) {
      if (Math.hypot(d.x - x, d.z - z) < 0.28) { d.amount = Math.min(d.amount + amount, 14); return d; }
    }
    if (this.detritus.length >= CAPS.detritus) {
      let best = this.detritus[0], bd = Infinity;
      for (const d of this.detritus) {
        const dd = Math.hypot(d.x - x, d.z - z);
        if (dd < bd) { bd = dd; best = d; }
      }
      best.amount = Math.min(best.amount + amount, 14);
      return best;
    }
    const d = { id: nid(), kind: 'detritus', x, z, amount };
    this.detritus.push(d);
    return d;
  }

  // ------------------------------------------------------------
  // player actions — add-only, ever
  // ------------------------------------------------------------
  /** @returns entity or null */
  place(tool, x, z) {
    if (!this.alive) return null;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const p = clampToJar({ x, z }, 0.06);
    x = p.x; z = p.z;

    let ent = null;
    switch (tool) {
      case 'seed': {
        if (this.plants.length >= CAPS.plants) break;
        if (isInPond(x, z)) break;
        const species = (Math.random() * 3) | 0;
        ent = this._addPlant(x, z, species, 0.02);
        this.emit('placed-seed', ent);
        break;
      }
      case 'beetle': {
        if (this.beetles.length >= CAPS.beetles) break;
        ent = this._addBeetle(x, z, S.beetleEnergyStart);
        this.emit('placed-beetle', ent);
        break;
      }
      case 'mantis': {
        if (this.mantises.length >= CAPS.mantises) break;
        ent = this._addMantis(x, z, S.mantisEnergyStart);
        this.emit('placed-mantis', ent);
        break;
      }
      case 'spore': {
        if (this.mushrooms.length >= CAPS.mushrooms) break;
        if (isInPond(x, z)) break;
        ent = this._addMushroom(x, z, 0);
        this.emit('placed-spore', ent);
        break;
      }
      case 'droplet': {
        this.water = clamp(this.water + CFG.dropletWater, 0, S.waterMax);
        ent = { kind: 'droplet', x, z };
        this.emit('placed-droplet', ent);
        break;
      }
    }
    if (ent) this.giftsGiven++;
    return ent;
  }

  // ------------------------------------------------------------
  // main update — fixed steps
  // ------------------------------------------------------------
  update(dt) {
    if (!this.alive) return;
    this._acc += dt;
    let guard = 0;
    while (this._acc >= S.tick && guard++ < 12) {
      this._acc -= S.tick;
      this._step(S.tick);
    }
  }

  _step(dt) {
    this.time += dt;
    const light = clamp(this.light, 0, 1);

    // ---------- resources ----------
    this.water -= lerp(S.evapNight, S.evapDay, light) * dt;
    this.water = clamp(this.water, 0, S.waterMax);
    this.nutrients = clamp(this.nutrients, 0, S.nutrientsMax);

    this._stepPlants(dt, light);
    this._stepBeetles(dt, light);
    this._stepMantises(dt, light);
    this._stepMushrooms(dt);
    this._stepDetritus(dt);
    this._updateVitality(dt);
    this._warnings();

    // ---------- is the jar still alive? ----------
    if (this.plants.length + this.beetles.length + this.mantises.length + this.mushrooms.length === 0) {
      this.alive = false;
      this.deathCause = this._diagnose();
      this.emit('jar-died', { cause: this.deathCause });
    }
  }

  _diagnose() {
    if (this.water <= 5) return 'the water gave out, and the green followed.';
    if (this.nutrients <= 8) return 'the soil grew thin and tired, with no one left to feed it.';
    if (this._stats.plantsGrazedDead >= 2) return 'the beetles ate the garden bare — then hunger came for them too.';
    return 'one by one, the small lives slipped away.';
  }

  // ------------------------------------------------------------
  _stepPlants(dt, light) {
    const waterF = smoothstep(4, 30, this.water);
    const nutrF = smoothstep(4, 24, this.nutrients);
    const lightF = 0.15 + 0.85 * light;

    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i];
      const def = SPECIES[p.species];

      // growth
      if (p.growth < 1) {
        const rate = (def.growMul / S.plantGrowTime) * lightF * waterF * nutrF;
        if (rate > 0) {
          p.growth = clamp(p.growth + rate * dt, 0, 1);
          this.nutrients -= S.plantNutrientCost * dt;
          this.water -= S.plantWaterCost * dt;
        }
      } else {
        this.water -= S.plantUpkeepWater * dt;
      }

      // leaf regrowth (needs some soil + water)
      if (waterF > 0.2 && nutrF > 0.2) {
        for (let l = 0; l < p.leaves.length; l++) {
          if (p.leaves[l] < 1) {
            p.leaves[l] = clamp(p.leaves[l] + S.plantRegrow * dt, 0, 1);
            this.nutrients -= 0.004 * dt;
          }
        }
      }

      // thirst
      if (this.water < 2) p.thirst += dt;
      else p.thirst = Math.max(0, p.thirst - dt * 2);

      // biomass & death
      const biomass = p.leaves.reduce((a, v) => a + v, 0) / p.leaves.length;
      p.biomass = biomass;
      let died = false, grazed = false;
      if (p.growth > 0.35 && biomass < S.plantDieBiomass) { died = true; grazed = true; }
      if (p.thirst > 26) died = true;
      if (died) {
        if (grazed) this._stats.plantsGrazedDead++;
        this.plants.splice(i, 1);
        this._addDetritus(p.x, p.z, S.plantDetritus * (0.3 + p.growth * 0.7));
        this.emit('plant-died', p);
        continue;
      }

      // self-seeding
      if (p.growth > 0.85 && this.plants.length < CAPS.plants && this.nutrients > S.seedMinNutrients) {
        if (Math.random() < S.seedChance * dt) {
          const a = Math.random() * Math.PI * 2;
          const r = rand(0.35, 0.8);
          const q = clampToJar({ x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r }, 0.08);
          if (!isInPond(q.x, q.z)) {
            const child = this._addPlant(q.x, q.z, p.species, 0.02);
            this.emit('plant-born', child);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------
  _stepBeetles(dt, light) {
    const rest = lerp(0.55, 1, light); // beetles slow down at night
    for (let i = this.beetles.length - 1; i >= 0; i--) {
      const b = this.beetles[i];
      b.age += dt;
      b.energy -= S.beetleDrain * rest * dt;

      if (b.energy <= 0 || b.age > S.beetleLifespan) {
        this.beetles.splice(i, 1);
        this._addDetritus(b.x, b.z, S.beetleDetritus);
        this.emit('beetle-died', b);
        continue;
      }

      // choose behavior
      if (b.energy < S.beetleHungry) {
        const target = this._nearestEdiblePlant(b.x, b.z);
        if (target) {
          b.targetId = target.id;
          const dx = target.x - b.x, dz = target.z - b.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.26) {
            b.state = 'feed';
            b.biteTimer -= dt;
            if (b.biteTimer <= 0) {
              b.biteTimer = S.beetleBiteEvery;
              // eat the fullest leaf
              let best = 0;
              for (let l = 1; l < target.leaves.length; l++) {
                if (target.leaves[l] > target.leaves[best]) best = l;
              }
              const bite = Math.min(target.leaves[best], S.beetleBite);
              target.leaves[best] -= bite;
              b.energy = clamp(b.energy + S.beetleBiteEnergy * (bite / S.beetleBite), 0, S.beetleEnergyMax);
              this.emit('beetle-bite', { x: b.x, z: b.z });
            }
          } else {
            b.state = 'seek';
            b.heading = Math.atan2(dz, dx) + noise1(this.time * 0.7, b.seed) * 0.4;
            this._walk(b, S.beetleSpeed * rest, dt);
          }
        } else {
          b.state = 'wander';
          this._wander(b, S.beetleSpeed * rest * 0.8, dt);
        }
      } else {
        b.state = 'wander';
        this._wander(b, S.beetleSpeed * rest * 0.6, dt);
      }

      // reproduction
      if (b.energy > S.beetleBreedEnergy && this.beetles.length < CAPS.beetles) {
        if (Math.random() < S.beetleBreedChance * dt) {
          b.energy -= S.beetleBreedCost;
          const child = this._addBeetle(b.x + rand(-0.15, 0.15), b.z + rand(-0.15, 0.15), 46);
          this.emit('beetle-born', child);
        }
      }
    }
  }

  _nearestEdiblePlant(x, z) {
    let best = null, bd = Infinity;
    for (const p of this.plants) {
      if (p.growth < 0.22) continue;
      const meat = p.leaves.reduce((a, v) => a + v, 0);
      if (meat < 0.12) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ------------------------------------------------------------
  _stepMantises(dt, light) {
    for (let i = this.mantises.length - 1; i >= 0; i--) {
      const m = this.mantises[i];
      m.age += dt;
      m.energy -= S.mantisDrain * lerp(0.7, 1, light) * dt;

      if (m.energy <= 0 || m.age > S.mantisLifespan) {
        this.mantises.splice(i, 1);
        this._addDetritus(m.x, m.z, S.mantisDetritus);
        this.emit('mantis-died', m);
        continue;
      }

      if (m.feastT > 0) { m.feastT -= dt; m.state = 'feast'; continue; }
      if (m.restT > 0) { m.restT -= dt; m.state = 'idle'; this._wander(m, 0.08, dt); continue; }

      if (m.energy < S.mantisHungry && this.beetles.length > 0) {
        const prey = this._nearestBeetle(m.x, m.z);
        if (prey) {
          m.targetId = prey.id;
          const dx = prey.x - m.x, dz = prey.z - m.z;
          const dist = Math.hypot(dx, dz);
          if (m.state === 'pounce') {
            m.pounceT -= dt;
            m.x += m.vx * dt;
            m.z += m.vz * dt;
            clampToJar(m, 0.05);
            if (dist < S.mantisKillRange) {
              // the strike lands
              const idx = this.beetles.indexOf(prey);
              if (idx >= 0) this.beetles.splice(idx, 1);
              m.energy = clamp(m.energy + S.mantisMealEnergy, 0, S.mantisEnergyMax);
              m.feastT = 2.6;
              this._addDetritus(prey.x, prey.z, 0.8);
              this.emit('mantis-ate', { x: m.x, z: m.z });
            } else if (m.pounceT <= 0) {
              m.state = 'idle';
              m.restT = 1.8;
            }
          } else if (dist < S.mantisPounceRange) {
            m.state = 'pounce';
            m.pounceT = 0.45;
            const inv = 1 / Math.max(dist, 0.01);
            m.vx = dx * inv * S.mantisPounceSpeed;
            m.vz = dz * inv * S.mantisPounceSpeed;
            m.heading = Math.atan2(dz, dx);
            this.emit('mantis-pounce', { x: m.x, z: m.z });
          } else {
            m.state = 'stalk';
            m.heading = Math.atan2(dz, dx) + noise1(this.time * 0.4, m.seed) * 0.25;
            this._walk(m, S.mantisStalkSpeed, dt);
          }
        }
      } else {
        m.state = 'idle';
        this._wander(m, 0.09, dt);
      }

      // reproduction — slow, precious
      if (m.energy > S.mantisBreedEnergy && this.mantises.length < CAPS.mantises) {
        if (Math.random() < S.mantisBreedChance * dt) {
          m.energy -= S.mantisBreedCost;
          const child = this._addMantis(m.x + rand(-0.2, 0.2), m.z + rand(-0.2, 0.2), 55);
          this.emit('mantis-born', child);
        }
      }
    }
  }

  _nearestBeetle(x, z) {
    let best = null, bd = Infinity;
    for (const b of this.beetles) {
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // ------------------------------------------------------------
  _stepMushrooms(dt) {
    for (let i = this.mushrooms.length - 1; i >= 0; i--) {
      const m = this.mushrooms[i];
      m.age += dt;

      // find food
      let patch = null;
      for (const d of this.detritus) {
        if (d.amount > 0.03 && Math.hypot(d.x - m.x, d.z - m.z) < S.mushroomReach) { patch = d; break; }
      }
      if (patch) {
        m.starve = 0;
        m.feeding = true;
        const eaten = Math.min(patch.amount, S.mushroomEat * dt);
        patch.amount -= eaten;
        this.nutrients = clamp(this.nutrients + (S.mushroomYield / S.mushroomEat) * eaten, 0, S.nutrientsMax);
        m.growth = clamp(m.growth + dt / S.mushroomGrowTime, 0, 1);
      } else {
        m.feeding = false;
        m.starve += dt;
        // a young spore can wait a little longer than a grown cap
        const patience = m.growth < 0.2 ? S.mushroomStarveTime * 1.6 : S.mushroomStarveTime;
        if (m.starve > patience) {
          this.mushrooms.splice(i, 1);
          this.nutrients = clamp(this.nutrients + 0.6, 0, S.nutrientsMax);
          this.emit('mushroom-died', m);
          continue;
        }
      }

      if (m.age > S.mushroomLifespan) {
        this.mushrooms.splice(i, 1);
        this._addDetritus(m.x, m.z, 1.4);
        this.emit('mushroom-died', m);
        continue;
      }

      // first sprout event (for a chime + puff)
      if (!m.sprouted && m.growth > 0.15) {
        m.sprouted = true;
        this.emit('mushroom-sprout', m);
      }
    }
  }

  // ------------------------------------------------------------
  _stepDetritus(dt) {
    for (let i = this.detritus.length - 1; i >= 0; i--) {
      const d = this.detritus[i];
      d.amount -= S.detritusSelfDecay * dt;
      this.nutrients = clamp(this.nutrients + S.detritusSelfDecay * dt * 0.5, 0, S.nutrientsMax);
      if (d.amount <= 0.04) this.detritus.splice(i, 1);
    }
  }

  // ------------------------------------------------------------
  // movement helpers
  // ------------------------------------------------------------
  _wander(e, speed, dt) {
    e.heading += noise1(this.time * 0.45, e.seed) * 2.2 * dt;
    this._walk(e, speed, dt);
  }

  _walk(e, speed, dt) {
    let nx = e.x + Math.cos(e.heading) * speed * dt;
    let nz = e.z + Math.sin(e.heading) * speed * dt;
    // steer off the glass
    const r = Math.hypot(nx, nz);
    if (r > CFG.jar.walkRadius - 0.05) {
      e.heading += (Math.atan2(-e.z, -e.x) - e.heading) * 0.35 + rand(-0.2, 0.2);
      nx = e.x + Math.cos(e.heading) * speed * dt;
      nz = e.z + Math.sin(e.heading) * speed * dt;
    }
    // don't swim
    if (isInPond(nx, nz)) {
      const away = Math.atan2(e.z - CFG.pond.z, e.x - CFG.pond.x);
      e.heading += (away - e.heading) * 0.5;
      nx = e.x + Math.cos(e.heading) * speed * dt;
      nz = e.z + Math.sin(e.heading) * speed * dt;
      if (isInPond(nx, nz)) { nx = e.x; nz = e.z; }
    }
    if (Number.isFinite(nx) && Number.isFinite(nz)) {
      e.x = nx; e.z = nz;
      clampToJar(e, 0.04);
    }
  }

  // ------------------------------------------------------------
  _updateVitality(dt) {
    const c = this.counts;
    const present = (c.plants > 0) + (c.beetles > 0) + (c.mantises > 0) + (c.mushrooms > 0);
    const diversity = present / 4;

    const healths = [];
    if (c.plants) {
      const avgBio = this.plants.reduce((a, p) => a + (p.biomass ?? 1), 0) / c.plants;
      healths.push(clamp(c.plants / 7, 0, 1) * (0.4 + 0.6 * avgBio));
    }
    if (c.beetles) {
      const avgE = this.beetles.reduce((a, b) => a + b.energy, 0) / c.beetles / S.beetleEnergyMax;
      healths.push(clamp(c.beetles / 6, 0, 1) * (0.3 + 0.7 * avgE));
    }
    if (c.mantises) {
      const avgE = this.mantises.reduce((a, m) => a + m.energy, 0) / c.mantises / S.mantisEnergyMax;
      healths.push(clamp(c.mantises / 2, 0, 1) * (0.3 + 0.7 * avgE));
    }
    if (c.mushrooms) healths.push(clamp(c.mushrooms / 3, 0, 1));
    const popHealth = healths.length ? healths.reduce((a, v) => a + v, 0) / healths.length : 0;

    const resHealth = 0.5 * smoothstep(5, 40, this.water) + 0.5 * smoothstep(5, 35, this.nutrients);

    const raw = clamp(0.42 * diversity + 0.38 * popHealth + 0.2 * resHealth, 0, 1);
    this.vitality = lerp(this.vitality, raw, clamp(dt * 0.6, 0, 1));
    if (!Number.isFinite(this.vitality)) this.vitality = 0;
  }

  // ------------------------------------------------------------
  _warnings() {
    const warn = (key, msg) => {
      const last = this._warnAt[key] || -999;
      if (this.time - last > 32) {
        this._warnAt[key] = this.time;
        this.emit('warn', { key, msg });
      }
    };
    if (this.beetles.length > 0) {
      const avgE = this.beetles.reduce((a, b) => a + b.energy, 0) / this.beetles.length;
      if (avgE < 32) warn('beetles', 'the beetles are hungry…');
    }
    if (this.mantises.length > 0) {
      const avgE = this.mantises.reduce((a, m) => a + m.energy, 0) / this.mantises.length;
      if (avgE < 28) warn('mantis', 'the mantis prowls on an empty stomach…');
    }
    if (this.water < 20) warn('water', 'the air in the jar grows dry…');
    if (this.nutrients < 15) warn('soil', 'the soil is growing thin…');
    if (this.plants.length === 1) warn('lastplant', 'a single plant holds the whole garden…');
  }
}
