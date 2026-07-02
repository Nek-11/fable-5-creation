# Paper Storm ✈️

You are a paper airplane, thrown out of an office window. Glide as far as you
can through an endless papercraft city.

## Run it

```bash
npm install
npm run dev
```

Then open the printed localhost URL in a browser.

## How to play

| Key | Action |
| --- | --- |
| `↑` / `W` | pitch up (trade speed for altitude) |
| `↓` / `S` | dive (trade altitude for speed) |
| `←` `→` / `A` `D` | bank & turn |
| `Space` | launch / retry |

- **Glide physics** — the plane has no engine. Dive to build speed, pull up to
  climb, but bleed too much speed and you stall.
- **Vent updrafts** — rooftop vents and street grates push columns of rising
  air (look for the floating motes). Ride them to regain altitude for free.
- **Rain** — storms roll in on a cycle. Rain soaks the paper, weighing you
  down and drooping your wings; fly fast in clear air to dry off.
- **Scissors-birds** — office scissors that fly like gulls and chase you.
  They're fast but tire quickly: dive and outrun them.
- **Scoring** — horizontal meters flown. Best distance is saved locally.

## Tech

- [Three.js](https://threejs.org/) + Vite, no other dependencies.
- Endless city: deterministic seeded chunks, merged vertex-colored geometry
  (one mesh + one fold-line `LineSegments` per chunk) for low draw calls.
- Folded-paper look: flat shading, pastel construction-paper palette, soft
  directional shadows, warm hemisphere fill, fog.
- Procedural WebAudio: wind that follows airspeed, rain wash, scissor snips,
  crumple crash.
