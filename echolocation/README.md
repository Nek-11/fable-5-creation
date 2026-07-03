# Echolocation 🦇

You are a blind creature in the drowned dark. Your only sight is sound:
click to echo, and a halo of light blooms outward through the water —
lighting the kelp forests, the coral gardens, the things that were
swimming toward you — before the dark closes back in.

Everything down here hears you too.

## Run it

```bash
npm install
npm run dev
```

Then open the printed localhost URL in a browser.

## How to play

| Input | Action |
| --- | --- |
| mouse | look |
| `W A S D` | swim (in the direction you're facing) |
| `Space` / `C` | rise / sink |
| `click` / `F` | echo — see, and be heard |
| `Shift` | burst swim (fast, loud) |
| `E` / right-click | shriek — stuns everything near you (limited charges) |

- **Sound is sight, sound is danger.** Every echo, stroke and burst raises
  your *presence* meter; the louder you've been, the farther creatures hear.
- **Lurkers** are jaws and bulk behind a dangling red lure — they hunt by
  ear. **Wraiths** are ribbon-bodied horrors that hunt with their own red
  sonar; their pings reveal the reef to you as well.
- **You cannot fight.** Outswim them, hang silent in the dark, or shriek to
  stun everything close and slip away. The shriek is heard across the level.
- **Lanternfish** are your only allies. Find them sheltering in the gardens
  (follow the gold glimmer and the chirps), and they'll school around you,
  softly echo-pinging for free vision. Only their light can wake each
  level's gate.
- **The way out is findable.** The sealed gate smoulders red in the
  distance; once woken it turns blue, raises a column of light to the
  surface, calls to you with beacon pings, the HUD shows its distance —
  and your lanternfish dart ahead to lead you to it.
- **Three gates down, then the moon.** Dying restarts the level with the
  same layout: the water remembers its shape, and so can you.

## Tech

- [Three.js](https://threejs.org/) + Vite, no other dependencies, no assets.
- **Zero lights.** All illumination is a single custom GLSL system: a shared
  pool of expanding sonar halos (player cyan, wraith red, lanternfish gold,
  beacon blue) evaluated per-fragment as travelling point lights — normal
  shading from the ping origin, distance attenuation, long afterglow, soft
  highlight knee — over vertex-colored scenery, plus UnrealBloom.
- Procedural canyon reefs: dune floor, displaced cliffs and spires, swaying
  kelp/grass/fan corals (vertex-shader current), branching corals and
  bioluminescent anemones, all merged into one draw call; thousands of
  marine-snow motes catch the light in open water via a Points shader.
- Free-3D swimming with watery inertia; steering-based creature AI.
- Procedural WebAudio: sonar blooms, open-water feedback-delay reverb, a
  lowpass "underwater" master bus, distant moans, jaw-snaps, and a heartbeat
  that quickens as the hunt closes in.
