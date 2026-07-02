// DOM overlay: HUD scraps, start / crash screens, banners, milestones.
import { CONFIG as C } from "./config.js";

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.hud = $("hud");
    this.startScreen = $("start-screen");
    this.crashScreen = $("crash-screen");
    this.dist = $("dist");
    this.best = $("best");
    this.speedFill = $("speed-fill");
    this.altFill = $("alt-fill");
    this.wetFill = $("wet-fill");
    this.stormBanner = $("storm-banner");
    this.birdBanner = $("bird-banner");
    this.milestone = $("milestone");
    this.crashTitle = $("crash-title");
    this.crashReason = $("crash-reason");
    this.crashDist = $("crash-dist");
    this.crashBest = $("crash-best");
    this.newBest = $("new-best");
    this.milestoneTimer = null;
  }

  showStart() {
    this.startScreen.classList.remove("hidden");
    this.crashScreen.classList.add("hidden");
    this.hud.classList.add("hidden");
  }

  showFlying(best) {
    this.startScreen.classList.add("hidden");
    this.crashScreen.classList.add("hidden");
    this.hud.classList.remove("hidden");
    this.best.textContent = Math.floor(best);
    this.stormBanner.classList.add("hidden");
    this.birdBanner.classList.add("hidden");
    this.milestone.classList.add("hidden");
  }

  update(state) {
    this.dist.textContent = Math.floor(state.distance);
    this.speedFill.style.width = `${Math.min(100, (state.speed / C.MAX_SPEED) * 100)}%`;
    this.altFill.style.width = `${Math.min(100, (state.altitude / 120) * 100)}%`;
    this.wetFill.style.height = `${state.wetness * 100}%`;

    if (state.weatherPhase === "warning") {
      this.stormBanner.textContent = "⚡ storm rolling in…";
      this.stormBanner.classList.remove("hidden");
    } else if (state.weatherPhase === "storm") {
      this.stormBanner.textContent = "🌧 rain! you're getting soaked!";
      this.stormBanner.classList.remove("hidden");
    } else {
      this.stormBanner.classList.add("hidden");
    }

    this.birdBanner.classList.toggle("hidden", !state.birdsChasing);
  }

  showMilestone(text) {
    this.milestone.textContent = text;
    this.milestone.classList.remove("hidden");
    // retrigger the CSS animation
    this.milestone.style.animation = "none";
    void this.milestone.offsetWidth;
    this.milestone.style.animation = "";
    clearTimeout(this.milestoneTimer);
    this.milestoneTimer = setTimeout(
      () => this.milestone.classList.add("hidden"),
      1700,
    );
  }

  showCrash(reason, distance, best, isNewBest) {
    const titles = {
      building: "Splat!",
      ground: "Crumpled!",
      bird: "Snipped!",
    };
    const reasons = {
      building: "you flew face-first into a paper building.",
      ground: "the pavement is not a landing strip.",
      bird: "a scissors-bird cut you clean in half. ✂",
    };
    this.crashTitle.textContent = titles[reason] || "Crumpled!";
    this.crashReason.textContent = reasons[reason] || "";
    this.crashDist.textContent = Math.floor(distance);
    this.crashBest.textContent = Math.floor(best);
    this.newBest.classList.toggle("hidden", !isNewBest);
    this.hud.classList.add("hidden");
    this.crashScreen.classList.remove("hidden");
  }
}
