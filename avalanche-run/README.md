# Avalanche Run 🏂

Endless downhill snowboarding on a procedural mountainside — with the whole
mountain coming down behind you. Carve, tuck, launch off rollers, land spins
for speed, and stay ahead of the wall of snow. Trees and rocks won't kill you,
but the time you lose tumbling might.

## How to play

- **← / →** (or A/D) — carve. Your line drifts back to the fall line when you let go.
- **↓** (or S) — tuck for extra top speed.
- **Space** (or ↑ / W) — jump. In the air, **← / →** spins the board.
- Land a clean **360 or more** for a burst of speed. Land sideways and you eat snow.
- **R** or Space — restart after you're buried.

The avalanche gauge (bottom right) shows how much slope is left between you and
it. Distance is the score; your best run is saved locally.

## Tech

- Three.js + Vite, no assets — terrain, rider, avalanche and audio are all procedural.
- The mountainside is a pure `height(x, z)` function sampled by recycled plane
  chunks, so physics, chunk meshes and the avalanche all agree on the ground.
- Instanced pines/boulders reseeded per chunk, snow glint shader via
  `onBeforeCompile`, bloom + vignette post chain, WebAudio-synthesized wind,
  carve scrape and rumble.

## Run locally

```bash
npm install
npm run dev
```
