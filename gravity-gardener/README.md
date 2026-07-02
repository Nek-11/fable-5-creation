# 🪐 Gravity Gardener

A cosy-but-tense territory-war game on a tiny procedural planet, built with Three.js.

You are a little gardener walking the curve of a sleeping world. Plant **luminous flora** —
mature blooms fire **spores that arc ballistically through the planet's gravity** and seed new
blooms where they land. Meanwhile the **void rot** wakes on the far side and creeps across the
surface. Light and rot fight for every vertex of the planet in a live reaction-diffusion
simulation; cover **70%** of the world in light before the rot claims **62%**.

## Run it

```bash
npm install
npm run dev
```

Then open the printed localhost URL (defaults to Vite's port; the repo's launch config uses 5199).

## How to play

| Input | Action |
| --- | --- |
| `W A S D` / arrows | walk the sphere |
| `shift` | sprint |
| `space` | plant a seed (they regrow over time) |
| `E` | light burst — purges rot cores and cleanses ground around you |
| mouse drag | orbit the camera |
| `M` / `P` / `esc` | mute / pause |

**Strategy:** the garden spreads itself through spores, but the rot spawns cores faster the
more you bloom. Bursts are your only hard counter — hunt the oldest cores before they entrench,
and ring rot territory with flora: a surrounded core is slowly strangled by radiance.

## How it works

- **Planet** — welded icosphere (~5.7k vertices) displaced by seeded simplex FBM. A scalar
  *territory field* in [-1, 1] lives on the vertices and evolves by diffusion + growth − decay,
  with flora and rot cores as sources. The surface shader renders neutral stone, mossy
  bioluminescent freckles, and pulsing rot veins straight from that per-vertex field.
- **Spores** — true central-gravity ballistics (`a = -g·r̂`), landing checks against the
  terrain height function, sparkle trails from a pooled particle system.
- **Spherical character controller** — position as a unit direction, tangent-plane movement,
  quaternion basis alignment, chase camera with surface-normal up.
- **Rendering** — instanced flora (stems/bulbs/light pools), UnrealBloom + custom
  vignette/grain pass, procedural starfield and nebula dome.
- **Audio** — 100% procedural WebAudio: detuned saw drone pad, pentatonic plucks for every
  garden event, filtered-noise sweeps for spores and bursts.

No assets, no textures, no models — everything is generated at runtime.
