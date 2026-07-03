# Echolocation 🦇

You are a blind creature in a lightless cave. Your only sight is sound:
click to emit a sonar pulse that ripples outward and paints the world as
glowing contours — briefly — before the dark closes back in.

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
| `W A S D` | move |
| `click` / `Space` | echo — see, and be heard |
| `Shift` | run (fast, loud) |
| `E` / right-click | shriek — stuns nearby creatures (limited charges) |

- **Sound is sight, sound is danger.** Every echo, footstep and sprint raises
  your *presence* meter; the louder you've been, the farther creatures hear.
- **Crawlers** hunt by ear and smell. **Stalkers** hunt with their own
  blood-red sonar — their pings reveal the cave to you as well.
- **You cannot fight.** Outrun them, wait in silence, or shriek to stun
  everything close and slip away. The shriek is heard across the whole level.
- **Glow-moths** are your only allies. Find them in dead ends (listen for the
  chirps), and they'll orbit you, softly echo-pinging for free vision. Only
  when you've freed enough moths does the exit gate unseal — it then calls to
  you with slow blue beacon pings.
- **Three levels down, then the light.** Dying restarts the level with the
  same layout: the cave remembers its shape, and so can you.

## Tech

- [Three.js](https://threejs.org/) + Vite, no other dependencies, no assets.
- **Zero lights.** All rendering is a single custom GLSL material: a shared
  pool of expanding sonar wavefronts (player cyan, stalker red, moth gold,
  beacon blue) evaluated per-fragment against world position, layered over
  wobbled topographic contour lines with distance attenuation, afterglow
  decay and film grain.
- Procedural levels: braided recursive-backtracker mazes with chambers,
  noise-displaced cave geometry (floor, drooping ceiling, merged wall boxes),
  grid collision, BFS pathfinding for creature AI.
- Procedural WebAudio: sonar chirps, cave-verb feedback delay, drips, growls,
  skitters, heartbeat that quickens as the hunt closes in.
