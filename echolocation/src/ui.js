const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.hud = $('hud');
    this.screens = {
      title: $('title-screen'),
      inter: $('inter-screen'),
      pause: $('pause-screen'),
      dead: $('death-screen'),
      won: $('win-screen'),
    };
    this.banner = $('banner');
    this.bannerTimer = null;
  }

  showScreen(name) {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('hidden', k !== name);
    this.hud.classList.toggle('hidden', name !== null);
  }

  showHUD() {
    for (const el of Object.values(this.screens)) el.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  setLevel(name) {
    $('level-name').textContent = name;
  }

  setMoths(have, need) {
    $('moth-count').textContent = have;
    $('moth-need').textContent = need;
  }

  setShriek(charges) {
    $('pip0').classList.toggle('ready', charges >= 1);
    $('pip1').classList.toggle('ready', charges >= 2);
  }

  setPresence(v) {
    const fill = $('presence-fill');
    fill.style.width = `${Math.round(v * 100)}%`;
    fill.classList.toggle('hot', v > 0.66);
  }

  setHunted(on) {
    document.body.classList.toggle('hunted', on);
  }

  showBanner(text, dur = 3) {
    this.banner.textContent = text;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.classList.remove('show'), dur * 1000);
  }

  setInter(title, flavor) {
    $('inter-title').textContent = title;
    $('inter-flavor').textContent = flavor;
  }

  setDeathReason(text) {
    $('death-reason').textContent = text;
  }
}
