# Loop Heist 💎

A pixel-art heist in 20-second time loops. Every run you take is recorded;
when time rewinds, your past self replays it beside you as a translucent
cyan **ghost**. Past-yous hold the pressure plates, flip the switches and
haul the loot — present-you walks out with everything.

Clear a job by carrying **all** of its gems onto the EXIT in a single loop.
Ghosts can grab gems too: whatever a ghost is carrying gets dropped on the
spot where its recording ends — the "ghost relay" that the later vaults are
built around. Guards can't see ghosts. Lasers only zap the real you.

## How to play

- **WASD / arrows** — move. The loop clock starts on your first step.
- **R** — rewind now. Your run becomes a ghost; ending a recording on a
  plate means the ghost keeps holding it.
- **ESC** — pause (restart heist / back to hideout).
- **M** — sound on/off.

Each job caps how many ghosts can coexist — one more rewind past the cap
and the **oldest ghost fades**. Fewer loops = better heist stats (saved
locally, per level).

Five jobs: *First Job*, *Two Hands*, *Timing Lock*, *Night Watch* and
*The Vault* — plates, timed doors, patrolling guards with vision cones,
blinking laser corridors, a two-switch vault and one gem that really wants
to be relayed.

## Tech

- Vite + vanilla canvas 2D, zero runtime dependencies, no asset files —
  tiles, sprites (3-frame walk cycles), UI and audio are all procedural.
- Deterministic fixed 60 Hz simulation: input is recorded per tick and
  ghosts re-run it through the same movement code, so replays never desync
  (pause and tab-blur safe).
- WebAudio-synthesized soundtrack: swung heist bassline, plate clicks, the
  rewind whoosh, last-3-seconds heartbeat.
- World renders at 320×192 and integer-upscales with crisp pixels, plus a
  CSS scanline/vignette CRT pass.

## Run locally

```bash
npm install
npm run dev
```
