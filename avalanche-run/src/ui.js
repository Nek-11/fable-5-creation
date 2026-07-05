// DOM HUD + screens. All elements live in index.html.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.hud = $("hud");
    this.startScreen = $("start-screen");
    this.deathScreen = $("death-screen");
    this.dist = $("dist");
    this.best = $("best");
    this.speedFill = $("speed-fill");
    this.gapFill = $("gap-fill");
    this.gapCard = $("gap-card");
    this.trickPop = $("trick-pop");
    this.milestone = $("milestone");
    this.whiteout = $("whiteout");
    this.deathDist = $("death-dist");
    this.deathBest = $("death-best");
    this.newBest = $("new-best");
    this._trickTimer = null;
    this._mileTimer = null;
  }

  showStart() {
    this.startScreen.classList.remove("hidden");
    this.deathScreen.classList.add("hidden");
    this.hud.classList.add("hidden");
    this.whiteout.style.opacity = 0;
  }

  showRun() {
    this.startScreen.classList.add("hidden");
    this.deathScreen.classList.add("hidden");
    this.hud.classList.remove("hidden");
  }

  showDeath(dist, best, isNewBest) {
    this.deathScreen.classList.remove("hidden");
    this.hud.classList.add("hidden");
    this.deathDist.textContent = Math.floor(dist);
    this.deathBest.textContent = Math.floor(best);
    this.newBest.classList.toggle("hidden", !isNewBest);
  }

  update(dist, best, speedFrac, gapFrac) {
    this.dist.textContent = Math.floor(dist);
    this.best.textContent = Math.floor(best);
    this.speedFill.style.width = `${Math.min(speedFrac * 100, 100)}%`;
    // gapFrac: 1 = safe, 0 = caught
    this.gapFill.style.width = `${Math.max(Math.min(gapFrac, 1), 0) * 100}%`;
    this.gapCard.classList.toggle("danger", gapFrac < 0.3);
  }

  setWhiteout(v) {
    this.whiteout.style.opacity = Math.max(Math.min(v, 1), 0).toFixed(2);
  }

  popTrick(text) {
    this.trickPop.textContent = text;
    this.trickPop.classList.remove("hidden", "pop");
    void this.trickPop.offsetWidth; // restart animation
    this.trickPop.classList.add("pop");
    clearTimeout(this._trickTimer);
    this._trickTimer = setTimeout(() => this.trickPop.classList.add("hidden"), 1400);
  }

  popMilestone(text) {
    this.milestone.textContent = text;
    this.milestone.classList.remove("hidden", "pop");
    void this.milestone.offsetWidth;
    this.milestone.classList.add("pop");
    clearTimeout(this._mileTimer);
    this._mileTimer = setTimeout(() => this.milestone.classList.add("hidden"), 1600);
  }
}
