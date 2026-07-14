# 🫙 Glass Garden

*A world you can only give to.*

A meditative add-only ecosystem terrarium built with Three.js. A sealed glass jar
sits on a wooden desk by a window. You are the caretaker — you may plant seeds,
release beetles and a mantis, scatter mushroom spores, and offer water. But
**nothing placed in the jar may ever be taken out**. Keep the tiny world in
balance as long as you can; the jar dies when the last living thing inside it
is gone.

## Run it

```bash
npm install
npm run dev
```

Then open the printed localhost URL.

## How to play

| Input | Action |
| --- | --- |
| `click` | place the selected gift inside the jar |
| `1–5` | choose a gift: seed / beetle / mantis / spore / water |
| mouse drag | orbit the jar (drifts on its own when idle) |
| `esc` | stillness (pause) |
| `M` | mute |

**The ecosystem:** plants grow from soil nutrients and water, and seed themselves
when mature. Beetles graze the leaves, breed when well-fed, and starve when the
garden is stripped. The mantis stalks and pounces on beetles. Mushrooms grow on
detritus — everything that dies — and return it to the soil as nutrients. Water
evaporates in the sun; only you can refill it. At night, healthy jars glow:
fireflies gather and the moss turns bioluminescent.

**Strategy:** a greedy caretaker collapses the jar in about two minutes (too many
beetles strip the plants; the starvation cascade follows). A patient one keeps
every loop closed — plants feeding herbivores, herbivores feeding the mantis,
mushrooms feeding the soil — indefinitely. Your longest garden is remembered.

## How it works

- **Scene** — lathe-geometry jar with `MeshPhysicalMaterial` transmission +
  clearcoat over a `RoomEnvironment` PMREM env map; layered substrate strata,
  displaced soil disc, shader-rippled pond, merged-geometry moss carpet,
  driftwood tubes; procedural canvas textures (wood, cork, strata).
- **Light** — a 120-second day: keyframed sun color/angle/intensity from warm
  noon through amber dusk to cool moonlight, with hemisphere fill, rim light,
  and a faint interior glow that follows the jar's vitality at night.
  UnrealBloom (tuned subtle, stronger at night) + custom vignette pass.
- **Simulation** — fixed-tick (0.25 s) agent ecosystem decoupled from render:
  nutrients/water/light resources, three plant species with per-leaf biomass,
  noise-steered beetles, a stalk-and-pounce mantis, decomposer mushrooms,
  detritus patches, and a smoothed vitality score (diversity + population
  health + resources).
- **Audio** — 100 % generative WebAudio: a detuned triangle pad whose filter
  breathes with the day/night cycle, pentatonic plucks for gifts and births,
  soft descending tones for deaths, filtered plips for water.

No assets, no models — everything is generated at runtime.
