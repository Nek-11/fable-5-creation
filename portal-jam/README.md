# Portal Jam 🏀🌀

Puzzle basketball in a midnight gym. The hoop is unreachable — walled off, caged in,
or a full court away — so you link a pair of rifts on the light panels and shoot
*through* them. Momentum carries across the link.

## How to play

- **Slingshot the ball**: grab it, pull it back along the court in any
  direction, release to fling it the opposite way. Longer pull = more power
  and a flatter throw; the dotted preview turns **gold** when the shot is in.
- **Click a light panel** to place a portal — clicks alternate cyan / magenta;
  a new click replaces the oldest portal.
- **Drag empty space** to orbit the camera, **scroll** to zoom.
- **R** returns the ball, **C** clears the rifts, **M** mutes.

Six levels: a warm-up, a wall, a caged hoop, a full-court relay, a windmill to
time, and a gauntlet that stacks everything. Par is per level; a clean make with
no rim or backboard touch counts as a **swish**.

## Tech

- [three.js](https://threejs.org/) + Vite, no other dependencies
- Custom sphere-vs-OBB physics with rotating obstacles, momentum-preserving
  portal teleports, gentle rim assist, and a verlet-cloth net the ball really
  pushes through (the aim preview simulates the same step function, portals included)
- Procedural canvas textures (hardwood, ball pebbling), shader-driven portal swirls,
  UnrealBloom, all-synth WebAudio SFX

## Run locally

```bash
npm install
npm run dev
```
