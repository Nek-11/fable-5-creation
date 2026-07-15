# Loop Heist 💎

A pixel-art heist in 20-second time loops. Every run you take is recorded;
when time rewinds, your past self replays it beside you as a translucent
cyan **ghost**. Past-yous hold the pressure plates, flip the switches and
carry the loot — you run the crew.

**Team delivery:** gems reset to their pedestals every loop, and the heist
is complete the moment **every gem is inside the getaway zone at once** —
carried by you, or by ghosts standing in the exit with you. Ending a
recording while standing on the exit parks that ghost there, loot and all:
that's the core technique of the later jobs. Guards can't see ghosts.
Lasers only zap the real you.

## How to play

- **WASD / arrows** — move. The loop clock starts on your first step.
- **R** — rewind now. Your run becomes a ghost; end a recording on a plate
  to keep it held, or on the exit to park your loot there.
- **F / Shift (hold)** — fast-forward 3×. Ghosts, guards, doors and the
  clock all accelerate together; waiting is never the puzzle.
- **ESC** — pause (restart heist / back to hideout). **M** — sound.

Each job caps how many ghosts can coexist — one more rewind past the cap
and the **oldest ghost fades**. The HUD shows a pip per gem: dim = still
on its pedestal, amber = carried but not delivered, lit = in the getaway
zone. Fewer loops = better heist stats (saved locally, per level).

Five jobs: *First Job*, *Two Hands*, *Timing Lock*, *Night Watch* and
*The Vault* — plates, timed doors, a patrolling guard with a vision cone,
blinking laser corridors, a two-switch vault, and one gem that only a
parked ghost can deliver in time.

## Tech

- Vite + vanilla canvas 2D, zero runtime dependencies, no asset files —
  tiles, sprites (3-frame walk cycles), per-level accent décor (rugs,
  paintings, banners, lamp glow), UI and audio are all procedural.
- Deterministic fixed 60 Hz simulation: input is recorded per tick and
  ghosts re-run it through the same movement code, so replays never desync
  (pause, tab-blur and fast-forward safe — fast-forward just runs more
  fixed ticks per frame).
- WebAudio-synthesized soundtrack: swung heist bassline (tempo and pitch
  lift while fast-forwarding), plate clicks, the rewind whoosh, and a
  last-3-seconds heartbeat.
- World renders at 320×192 and integer-upscales with crisp pixels, plus a
  CSS scanline/vignette CRT pass.

## Run locally

```bash
npm install
npm run dev
```
